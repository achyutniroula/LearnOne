import asyncio
import logging
from google import genai
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from ..database import get_db, SessionLocal
from ..models import User, ChatMessage, Curriculum
from ..config import settings
from ..auth import ALGORITHM
from ..prompts import build_system_prompt
from ..services.thinker import consult_thinker
from .chat import _get_session_or_404, _build_history, _build_memory_block, _last_session_context
from google.genai import types

router = APIRouter(prefix="/ws/sessions", tags=["voice"])

_gemini_client: genai.Client | None = None


def _get_gemini_client() -> genai.Client:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=settings.gemini_api_key or None)
    return _gemini_client


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
    system_prompt = build_system_prompt(
        user.email, session.learning_goal, curriculum_json, memory_block, last_ctx
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

                        async for response in gemini_session.receive():
                            # ── Session resumption: store the latest handle ──────────
                            update = getattr(response, "session_resumption_update", None)
                            if update is not None:
                                resumable = getattr(update, "resumable", False)
                                new_handle = getattr(update, "new_handle", None)
                                if resumable and new_handle:
                                    resumption_handle = new_handle

                            # ── GoAway: server closing connection, reconnect ──────────
                            go_away = getattr(response, "go_away", None)
                            if go_away is not None:
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
                                        await websocket.send_json({"event": "thinking", "query": query})
                                        thinker_response = await consult_thinker(query, system_prompt)
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

                            # ── Barge-in ─────────────────────────────────────────────
                            if getattr(sc, "interrupted", False):
                                await websocket.send_json({"event": "interrupted"})
                                if current_user_text or current_model_text:
                                    save_turn_to_db(current_user_text, current_model_text)
                                    current_user_text = ""
                                    current_model_text = ""
                                continue

                            # ── Model audio ──────────────────────────────────────────
                            model_turn = getattr(sc, "model_turn", None)
                            if model_turn:
                                for part in model_turn.parts:
                                    if getattr(part, "inline_data", None):
                                        await websocket.send_bytes(part.inline_data.data)

                            # ── Model speech transcription ───────────────────────────
                            output_transcription = getattr(sc, "output_transcription", None)
                            if output_transcription and getattr(output_transcription, "text", None):
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
                                        current_user_text = (current_user_text + " " + it_text).strip()
                                        await websocket.send_json({
                                            "event": "user_transcript",
                                            "text": current_user_text,
                                            "is_final": True,
                                        })
                                    else:
                                        await websocket.send_json({
                                            "event": "user_transcript",
                                            "text": it_text,
                                            "is_final": False,
                                        })

                            # ── Turn complete ────────────────────────────────────────
                            if getattr(sc, "turn_complete", False):
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
        browser_reader.cancel()
        if current_user_text or current_model_text:
            save_turn_to_db(current_user_text, current_model_text)
        try:
            await websocket.close()
        except Exception:
            pass
