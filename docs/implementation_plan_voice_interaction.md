# Real-time Voice Interaction for LearnOne (Talker + Thinker Bridge)

Implement a real-time voice conversation feature using a "talker / thinker" split:
- **Talker**: Gemini Live API (real-time voice, VAD, barge-in, streaming 16kHz audio in / 24kHz audio out).
- **Thinker**: Text-only Gemini reasoning model (`gemini-2.5-flash` or `gemini-2.5-pro` via settings), called asynchronously via `consult_thinker(query: str) -> str`.

---

## Proposed Changes

### Backend (FastAPI)

We will introduce a new WebSocket endpoint `/ws/sessions/{session_id}/voice`. On connection:
1. Validate client token (passed via query parameter `?token=...` to support native browser WebSocket auth).
2. Fetch the session and curriculum details from the database.
3. Build the system instruction for the live session by reusing `build_system_prompt` from `app/prompts.py`.
4. Create a stateful Gemini Live session using the async client (`client.aio.live.connect`) with the model `"gemini-2.0-flash-exp"`.
5. Register one tool: `consult_thinker(query: str) -> str`.
6. Run bidirectional async loops:
   - **Browser-to-Gemini**: Receive raw 16kHz 16-bit Mono PCM bytes from the browser WebSocket and send them to the Gemini Live session using `session.send_realtime_input`.
   - **Gemini-to-Browser**: Receive messages from the Gemini Live session.
     - If audio output chunk is received (`part.inline_data`), send it as binary to the browser.
     - If user transcription text is received (`server_content.input_transcription.text`), accumulate it.
     - If model transcription text is received (`part.text`), accumulate it.
     - If `server_content.interrupted` is true, send a control JSON `{"event": "interrupted"}` to the browser to stop client playback instantly, write any partial turn text to the DB, and reset accumulators.
     - If `server_content.turn_complete` is true, write the finalized user and assistant messages to the DB and reset accumulators.
     - If tool call `consult_thinker` is triggered:
       - Run the thinker reasoning model with the query, system prompt, curriculum, and session history.
       - Send a message to the browser `{"event": "thinking"}` to update the UI status.
       - Return the thinker's text response to the Live API using `session.send_tool_response`.

#### [NEW] [voice.py](file:///d:/Projects/LearnOne/backend/app/routers/voice.py)
Create the new router defining the authenticated WebSocket endpoint `/ws/sessions/{session_id}/voice` and managing the bidirectional proxy and tool execution.

#### [MODIFY] [main.py](file:///d:/Projects/LearnOne/backend/main.py)
Include the new `voice` router in the FastAPI app: `app.include_router(voice.router)`.

#### [MODIFY] [config.py](file:///d:/Projects/LearnOne/backend/app/config.py)
Ensure variables for live model (`gemini_live_model: str = "gemini-2.0-flash-exp"`) and thinker model (`gemini_thinker_model: str = "gemini-2.5-flash"`) are available in settings.

---

### Frontend (React + TS)

We will build a beautiful, animated `VoiceSession` overlay overlaying the active session:
1. Capture mic input using the Web Audio API:
   - Set up an `AudioContext` at 16000Hz (Chrome/Firefox automatically resample input to this rate).
   - Use `createScriptProcessor` (or `AudioWorklet` if preferred, but `createScriptProcessor` works cleanly inside Vite without dynamic URL resolution issues) to downsample to 16-bit PCM mono (`Int16Array`) and send as binary over the WebSocket.
2. Play received audio using a queued Web Audio API player:
   - Play 24kHz PCM chunks smoothly using scheduled start times to avoid gaps.
   - Maintain a list of active audio sources.
   - When a control message `{"event": "interrupted"}` is received, call `.stop()` on all playing/queued sources immediately to implement clean barge-in.
3. Show visual indicators for the current state: `listening`, `thinking`, `speaking`.
4. Provide a visual animated `LeonOrb` with matching colors/effects.
5. Provide a button to end the session, cleanly closing the WebSocket connection.

#### [NEW] [VoiceSession.tsx](file:///d:/Projects/LearnOne/frontend/src/components/leon/VoiceSession.tsx)
Build the new overlay component that connects to the WebSocket, handles microphone capture, plays back Gemini Live audio, implements barge-in, and renders the glowing `LeonOrb`.

#### [MODIFY] [ChatPage.tsx](file:///d:/Projects/LearnOne/frontend/src/pages/ChatPage.tsx)
- Integrate a trigger to launch the `VoiceSession` overlay for the current active session.
- Make sure that when the Voice Session is closed, we refresh the message history from the backend so that transcripts appear inline.

---

## Verification Plan

### Automated Verification
- Run backend FastAPI server locally and check that it starts without error.
- Check WebSocket connection with a test client or by launching frontend.

### Manual Verification
1. Launch a learning session in the React frontend.
2. Click the Voice icon/button to start a real-time voice session.
3. Speak to LearnOne and verify it responds vocally.
4. Verify that asking complex academic questions triggers the "thinker" model (with visual "Thinking..." indicator) and the response is read back.
5. Verify that speaking while LearnOne is speaking halts its playback immediately (barge-in works).
6. End the session and check that the full transcript is saved and visible in the chat list.
