import asyncio
import json
import logging
import logging.handlers
import os
import time
from typing import Any
from google import genai
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from ..database import get_db, SessionLocal
from ..models import User, ChatMessage, Curriculum
from ..config import settings
from ..auth import ALGORITHM, get_current_user
from ..prompts import build_system_prompt
from ..services.thinker import consult_thinker
from .chat import _get_session_or_404, _build_history, _build_memory_block, _last_session_context
from ..llm_registry import LIVE_VOICE_NAME
from google.genai import types

router = APIRouter(prefix="/ws/sessions", tags=["voice"])
diag_router = APIRouter(prefix="/api/voice", tags=["voice-diag"])

_gemini_client: genai.Client | None = None
_diag_file_logger: logging.Logger | None = None

# Log file lives next to the backend package: backend/logs/voice_diag.jsonl
_LOGS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")


def _get_gemini_client() -> genai.Client:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=settings.gemini_api_key or None)
    return _gemini_client


def _get_diag_file_logger() -> logging.Logger:
    global _diag_file_logger
    if _diag_file_logger is None:
        os.makedirs(_LOGS_DIR, exist_ok=True)
        logger = logging.getLogger("voice_diag")
        logger.setLevel(logging.INFO)
        if not logger.handlers:
            handler = logging.handlers.RotatingFileHandler(
                os.path.join(_LOGS_DIR, "voice_diag.jsonl"),
                maxBytes=5 * 1024 * 1024,  # 5 MB per file
                backupCount=3,
                encoding="utf-8",
            )
            handler.setFormatter(logging.Formatter("%(message)s"))
            logger.addHandler(handler)
            logger.propagate = False  # don't double-emit to root logger
        _diag_file_logger = logger
    return _diag_file_logger


def _diag(event: str, **kwargs) -> None:
    """Emit one structured JSON diagnostic line.

    Grep for [VOICE-DIAG] to filter from other log output.
    Events prefixed WARN_ flag anomalies worth investigating.
    Fields:
      ts_mono  — monotonic clock (use for latency deltas within a session)
      utc      — wall clock (use for correlating with external logs)
      event    — event name
      turn     — which turn within the session (0-indexed)
    """
    payload: dict = {
        "ts_mono": round(time.monotonic(), 4),
        "utc": round(time.time(), 3),
        "event": event,
        "source": "backend",
    }
    payload.update(kwargs)
    line = json.dumps(payload, default=str)
    logging.info("[VOICE-DIAG] %s", line)
    _get_diag_file_logger().info(line)


def get_user_from_token(token: str, db: Session) -> User | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            return None
        return db.query(User).filter(User.email == email).first()
    except JWTError:
        return None


@router.websocket("/{session_id}/voice")
async def websocket_voice(
    websocket: WebSocket,
    session_id: int,
    token: str = Query(None),
    db: Session = Depends(get_db),
):
    await websocket.accept()

    # NOTE: token via query param is a known WebSocket limitation — browsers cannot set
    # Authorization headers. Mitigate in production by issuing short-lived (30s) one-time
    # voice tickets via a REST endpoint, then passing the ticket here instead of the JWT.
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user = get_user_from_token(token, db)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        session = _get_session_or_404(session_id, user.id, db)
    except Exception:
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    curriculum = db.query(Curriculum).filter(Curriculum.session_id == session_id).first()
    curriculum_json = curriculum.content if curriculum else None

    memory_block = _build_memory_block(user.id, db)
    last_ctx = _last_session_context(user.id, session_id, db)
    repo_info = session.repo_url or session.learning_goal
    system_prompt = build_system_prompt(
        user.email, repo_info, curriculum_json, memory_block, last_ctx,
        voice_mode=True,
    )

    client = _get_gemini_client()

    consult_thinker_tool = types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="consult_thinker",
                description=(
                    "Consult the reasoning model to answer complex questions about the "
                    "LearnOne codebase, look up curriculum details, review session history, "
                    "or perform multi-step analysis."
                ),
                parameters=types.Schema(
                    type="OBJECT",
                    properties={
                        "query": types.Schema(
                            type="STRING",
                            description="The specific question or topic to reason about.",
                        )
                    },
                    required=["query"],
                ),
            )
        ]
    )

    current_user_text = ""
    current_model_text = ""

    # ── Session-level diagnostic state ────────────────────────────────────────
    _diag_session_start   = time.monotonic()
    _diag_frames_to_browser = 0     # cumulative audio frames forwarded to browser

    # ── Per-turn diagnostic state (reset at every turn boundary) ─────────────
    # A "turn" is the interval between turn_complete / interrupted events.
    _diag_turn_no:             int         = 0
    _diag_turn_start:          float       = time.monotonic()
    _diag_turn_had_audio:      bool        = False  # model sent ≥1 audio frame
    _diag_turn_had_interrupt:  bool        = False  # Gemini sent interrupted this turn
    _diag_turn_user_final_ts:  float | None = None  # ts of last user is_final transcript
    _diag_turn_first_audio_ts: float | None = None  # ts of first audio frame sent to browser
    _diag_turn_audio_bytes:    int         = 0      # bytes of audio sent to browser this turn

    _diag("session_start",
          session_id=session_id,
          user=user.email,
          model=settings.gemini_live_model,
          voice=LIVE_VOICE_NAME)

    def save_turn_to_db(user_text: str, model_text: str) -> None:
        if not user_text and not model_text:
            return
        local_db = SessionLocal()
        try:
            if user_text:
                local_db.add(ChatMessage(session_id=session_id, role="USER", content=user_text))
            if model_text:
                local_db.add(ChatMessage(session_id=session_id, role="ASSISTANT", content=model_text))
            local_db.commit()
        except Exception as e:
            logging.error(f"Voice: error saving turn: {e}")
            local_db.rollback()
        finally:
            local_db.close()

    def build_live_config(resumption_handle: str | None) -> types.LiveConnectConfig:
        return types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=LIVE_VOICE_NAME,
                    )
                )
            ),
            # Context window compression: compress when context > 25600 tokens,
            # sliding window keeps ~12800 tokens — enables sessions well past 15 min.
            context_window_compression=types.ContextWindowCompressionConfig(
                trigger_tokens=25600,
                sliding_window=types.SlidingWindow(target_tokens=12800),
            ),
            # Session resumption: pass stored handle on reconnect, None on first connect.
            # Server sends SessionResumptionUpdate events with new handles (~every 30s).
            # On GoAway (connection lifetime ~10 min), reconnect transparently with last handle.
            session_resumption=types.SessionResumptionConfig(
                handle=resumption_handle,
            ),
            tools=[consult_thinker_tool],
            system_instruction=types.Content(
                parts=[types.Part.from_text(text=system_prompt)]
            ),
        )

    # audio_queue: browser mic PCM chunks buffered so they survive Gemini reconnects.
    audio_queue: asyncio.Queue[bytes] = asyncio.Queue()

    async def read_browser_audio() -> None:
        """Continuously read binary audio from the browser WebSocket into audio_queue."""
        try:
            while True:
                message = await websocket.receive()
                if message.get("type") == "websocket.disconnect":
                    break
                if "bytes" in message:
                    await audio_queue.put(message["bytes"])
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logging.error(f"Voice: read_browser_audio error: {e}")

    browser_reader = asyncio.create_task(read_browser_audio())

    resumption_handle: str | None = None

    try:
        # Outer reconnect loop: re-enters on GoAway to reconnect transparently.
        while not browser_reader.done():
            config = build_live_config(resumption_handle)

            try:
                async with client.aio.live.connect(
                    model=settings.gemini_live_model, config=config
                ) as gemini_session:

                    async def send_audio() -> None:
                        """Forward queued browser audio to Gemini Live."""
                        while True:
                            audio_data = await audio_queue.get()
                            await gemini_session.send_realtime_input(
                                audio=types.Blob(
                                    data=audio_data,
                                    mime_type="audio/pcm;rate=16000",
                                )
                            )

                    async def receive_and_forward() -> bool:
                        """
                        Forward Gemini responses to the browser.
                        Returns True if we should reconnect (GoAway received),
                        False if we should stop (normal end or browser disconnected).
                        """
                        nonlocal resumption_handle, current_user_text, current_model_text
                        nonlocal _diag_frames_to_browser, _diag_turn_no
                        nonlocal _diag_turn_start, _diag_turn_had_audio, _diag_turn_had_interrupt
                        nonlocal _diag_turn_user_final_ts, _diag_turn_first_audio_ts
                        nonlocal _diag_turn_audio_bytes

                        async for response in gemini_session.receive():
                            _recv_ts = time.monotonic()

                            # ── Session resumption: store the latest handle ──────────
                            update = getattr(response, "session_resumption_update", None)
                            if update is not None:
                                resumable = getattr(update, "resumable", False)
                                new_handle = getattr(update, "new_handle", None)
                                if resumable and new_handle:
                                    resumption_handle = new_handle
                                _diag("session_resumption_update",
                                      resumable=resumable,
                                      has_handle=bool(new_handle))

                            # ── GoAway: server closing connection, reconnect ──────────
                            go_away = getattr(response, "go_away", None)
                            if go_away is not None:
                                _diag("go_away",
                                      turn=_diag_turn_no,
                                      has_resumption_handle=bool(resumption_handle),
                                      session_age_s=round(_recv_ts - _diag_session_start, 1))
                                logging.info("Voice: received GoAway, reconnecting with resumption handle")
                                if current_user_text or current_model_text:
                                    save_turn_to_db(current_user_text, current_model_text)
                                    current_user_text = ""
                                    current_model_text = ""
                                return True  # signal outer loop to reconnect

                            # ── Tool calls (consult_thinker) ─────────────────────────
                            tool_call = getattr(response, "tool_call", None)
                            if tool_call:
                                for fc in tool_call.function_calls:
                                    if fc.name == "consult_thinker":
                                        query = fc.args.get("query", "")
                                        _diag("tool_call_start",
                                              turn=_diag_turn_no,
                                              name=fc.name,
                                              query_preview=query[:120])
                                        await websocket.send_json({"event": "thinking", "query": query})
                                        _thinker_t0 = time.monotonic()
                                        thinker_response = await consult_thinker(
                                            query, system_prompt, repo_id=session.repo_id
                                        )
                                        _diag("tool_call_complete",
                                              turn=_diag_turn_no,
                                              name=fc.name,
                                              latency_s=round(time.monotonic() - _thinker_t0, 2))
                                        await gemini_session.send_tool_response(
                                            function_responses=[
                                                types.FunctionResponse(
                                                    id=fc.id,
                                                    name=fc.name,
                                                    response={"result": thinker_response},
                                                )
                                            ]
                                        )
                                        await websocket.send_json({"event": "thinking_complete"})

                            sc = getattr(response, "server_content", None)
                            if sc is None:
                                continue

                            # ── Barge-in / interrupted ────────────────────────────────
                            if getattr(sc, "interrupted", False):
                                _diag_turn_had_interrupt = True
                                _diag("interrupted",
                                      turn=_diag_turn_no,
                                      had_audio=_diag_turn_had_audio,
                                      audio_bytes_this_turn=_diag_turn_audio_bytes)
                                await websocket.send_json({"event": "interrupted"})
                                if current_user_text or current_model_text:
                                    save_turn_to_db(current_user_text, current_model_text)
                                    current_user_text = ""
                                    current_model_text = ""
                                # Reset audio sub-tracking for remainder of this turn
                                _diag_turn_had_audio = False
                                _diag_turn_first_audio_ts = None
                                _diag_turn_audio_bytes = 0
                                continue

                            # ── Model audio ──────────────────────────────────────────
                            model_turn = getattr(sc, "model_turn", None)
                            if model_turn:
                                for part in model_turn.parts:
                                    if getattr(part, "inline_data", None):
                                        chunk = part.inline_data.data
                                        chunk_len = len(chunk)
                                        if not _diag_turn_had_audio:
                                            # First audio frame this turn — measure response latency
                                            _diag_turn_had_audio = True
                                            _diag_turn_first_audio_ts = _recv_ts
                                            if _diag_turn_user_final_ts is not None:
                                                latency = _recv_ts - _diag_turn_user_final_ts
                                                _diag("first_audio_frame",
                                                      turn=_diag_turn_no,
                                                      response_latency_s=round(latency, 3))
                                            else:
                                                _diag("first_audio_frame",
                                                      turn=_diag_turn_no,
                                                      response_latency_s=None,
                                                      note="no_user_final_transcript_seen_yet")
                                        _diag_turn_audio_bytes += chunk_len
                                        _diag_frames_to_browser += 1
                                        await websocket.send_bytes(chunk)

                            # ── Model speech transcription ───────────────────────────
                            output_transcription = getattr(sc, "output_transcription", None)
                            if output_transcription and getattr(output_transcription, "text", None):
                                _diag("model_transcript",
                                      turn=_diag_turn_no,
                                      text=output_transcription.text[:200])
                                current_model_text += output_transcription.text
                                await websocket.send_json({
                                    "event": "model_transcript",
                                    "text": output_transcription.text,
                                })

                            # ── User speech transcription ────────────────────────────
                            input_transcription = getattr(sc, "input_transcription", None)
                            if input_transcription:
                                it_text = getattr(input_transcription, "text", None)
                                is_final = getattr(input_transcription, "is_final", True)
                                if it_text:
                                    if is_final:
                                        _diag_turn_user_final_ts = _recv_ts
                                        _diag("user_transcript_final",
                                              turn=_diag_turn_no,
                                              text=it_text[:200],
                                              model_was_speaking=_diag_turn_had_audio)
                                        current_user_text = (current_user_text + " " + it_text).strip()
                                        await websocket.send_json({
                                            "event": "user_transcript",
                                            "text": current_user_text,
                                            "is_final": True,
                                        })
                                    else:
                                        _diag("user_transcript_interim",
                                              turn=_diag_turn_no,
                                              text=it_text[:80])
                                        await websocket.send_json({
                                            "event": "user_transcript",
                                            "text": it_text,
                                            "is_final": False,
                                        })

                            # ── Turn complete ────────────────────────────────────────
                            if getattr(sc, "turn_complete", False):
                                # Detect potential premature turn_complete (known Gemini bug):
                                # model was generating audio AND the user spoke mid-response,
                                # but Gemini never sent an 'interrupted' event. The response
                                # was truncated silently rather than barged-in cleanly.
                                premature = (
                                    _diag_turn_had_audio
                                    and not _diag_turn_had_interrupt
                                    and _diag_turn_user_final_ts is not None
                                    and _diag_turn_first_audio_ts is not None
                                    and _diag_turn_user_final_ts > _diag_turn_first_audio_ts
                                )
                                _diag(
                                    "WARN_premature_turn_complete" if premature else "turn_complete",
                                    turn=_diag_turn_no,
                                    had_audio=_diag_turn_had_audio,
                                    had_interrupt=_diag_turn_had_interrupt,
                                    audio_bytes=_diag_turn_audio_bytes,
                                    session_frames_total=_diag_frames_to_browser,
                                )

                                # Reset per-turn state
                                _diag_turn_no           += 1
                                _diag_turn_start         = time.monotonic()
                                _diag_turn_had_audio     = False
                                _diag_turn_had_interrupt = False
                                _diag_turn_user_final_ts  = None
                                _diag_turn_first_audio_ts = None
                                _diag_turn_audio_bytes    = 0

                                if current_user_text or current_model_text:
                                    save_turn_to_db(current_user_text, current_model_text)
                                    current_user_text = ""
                                    current_model_text = ""
                                await websocket.send_json({"event": "turn_complete"})

                        return False  # normal end of receive loop

                    send_task = asyncio.create_task(send_audio())
                    should_reconnect = await receive_and_forward()
                    send_task.cancel()
                    try:
                        await send_task
                    except asyncio.CancelledError:
                        pass

                    if not should_reconnect:
                        break

            except Exception as e:
                logging.error(f"Voice: Gemini Live session error: {e}")
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logging.error(f"Voice: WebSocket handler crashed: {e}")
    finally:
        _diag("session_end",
              session_id=session_id,
              total_turns=_diag_turn_no,
              total_audio_frames=_diag_frames_to_browser,
              duration_s=round(time.monotonic() - _diag_session_start, 1))
        browser_reader.cancel()
        if current_user_text or current_model_text:
            save_turn_to_db(current_user_text, current_model_text)
        try:
            await websocket.close()
        except Exception:
            pass


# ── Frontend diagnostic flush endpoint ───────────────────────────────────────
# The browser POSTs its accumulated diag events here on session close so they
# land in the same voice_diag.jsonl file alongside backend events.

class _FrontendDiagBatch(BaseModel):
    session_id: int
    events: list[dict[str, Any]]


@diag_router.post("/diag", status_code=204)
async def post_frontend_diag(
    payload: _FrontendDiagBatch,
    user: User = Depends(get_current_user),
) -> None:
    file_logger = _get_diag_file_logger()
    for event in payload.events:
        event["source"] = "frontend"
        event["session_id"] = payload.session_id
        event["user"] = user.email
        file_logger.info(json.dumps(event, default=str))
