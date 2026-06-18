<p align="center">
  <b style="font-size:2rem;">LEON</b>
</p>

<p align="center">
  Jarvis-style voice AI and adaptive learning platform — talk to it, learn from it
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?style=flat-square&logo=google&logoColor=white" alt="Gemini"/>
  <img src="https://img.shields.io/badge/pgvector-0.3-336791?style=flat-square&logo=postgresql&logoColor=white" alt="pgvector"/>
</p>

<p align="center">
  <a href="#-overview">Overview</a> · <a href="#-quick-start">Quick Start</a> · <a href="#-features">Features</a> · <a href="#-architecture">Architecture</a>
</p>

---

## 📖 Overview

**LEON** is a voice-first AI learning assistant. You talk — it listens, reasons, and responds with voice. Under the hood it runs a full adaptive learning engine: structured curricula, spaced-repetition reviews, quizzes, and a knowledge graph that tracks what you know.

The voice layer uses the **Gemini Live API** — a real-time bidirectional audio WebSocket with barge-in interruption, session resumption across 10-minute connection windows, and context window compression so sessions can run indefinitely. A thinker service (fallback chain of Gemini and Groq models) handles complex reasoning and RAG lookups over the repo knowledge base.

### Highlights

- **Real-time voice** — Gemini Live WebSocket with barge-in, VAD, and PCM audio streaming at 16kHz in / 24kHz out
- **Session persistence** — GoAway reconnect with resumption handles; context window compression prevents the 15-min session cap
- **Fallback reasoning chain** — `gemini-2.5-flash` → `gemini-2.5-flash-lite` → Groq models; per-model Redis cooldowns on 429
- **Repo RAG** — LearnOne codebase chunked and ingested into pgvector (`gemini-embedding-001`, 768-dim); retrieved at query time inside the thinker
- **Adaptive learning engine** — SM-2 spaced repetition, knowledge graph extraction, mastery tracking with EMA scoring
- **Animated orb UI** — state-driven glass sphere: idle (breathing) → listening (ripple rings) → thinking (orbiting particle) → speaking (waveform)

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node 20+
- A free [Supabase](https://supabase.com) project (PostgreSQL + pgvector extension)
- A free [Upstash](https://upstash.com) Redis database
- A [Google AI Studio](https://aistudio.google.com) Gemini API key
- A [Groq](https://console.groq.com) API key (thinker fallback)

### 1. Clone

```bash
git clone https://github.com/achyutniroula/LearnOne.git
cd LearnOne
git checkout leon
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env` (see `backend/.env.example`):

```env
DB_URL=postgresql://your-supabase-host:5432/postgres
DB_USERNAME=postgres
DB_PASSWORD=your-password
REDIS_URL=rediss://your-upstash-url
JWT_SECRET=your-256-bit-secret
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
```

Apply the migration in Supabase SQL editor (`backend/migrations/V10__repo_chunks.sql`), then ingest the repo:

```bash
python scripts/ingest_repo.py
```

Start:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5174**

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

**🎙️ Real-time Voice Sessions**

Press once — LEON listens continuously. Barge-in interruption stops playback the moment you speak. Session resumption and context compression keep it running past the 10-min connection window.

</td>
<td width="50%" valign="top">

**🧠 Thinker Service**

A fallback reasoning chain (Gemini 2.5 Flash → Flash Lite → Groq Llama) handles complex questions. Per-model Redis cooldowns route around 429s automatically. RAG context from the repo is injected into every thinker call.

</td>
</tr>
<tr>
<td width="50%" valign="top">

**📚 Adaptive Learning Sessions**

Create a session with any goal — LEON generates a structured curriculum. SM-2 spaced repetition schedules concept reviews. Mastery is tracked with EMA scoring across sessions.

</td>
<td width="50%" valign="top">

**🗂️ Repo RAG**

The full LearnOne codebase is chunked (function/class-aware for Python and TypeScript) and stored in pgvector. At query time, the top-5 chunks are retrieved by cosine similarity and injected into the thinker prompt.

</td>
</tr>
<tr>
<td width="50%" valign="top">

**🕸️ Knowledge Graph**

Every conversation is mined for concepts. The graph tracks what you know, how confidently, and when to review it next — surfaced as due-review cards on the dashboard.

</td>
<td width="50%" valign="top">

**🧩 Quiz Generation**

Quizzes are generated from curriculum content. MCQ and open-ended questions, with explanations. Results feed back into the mastery tracker.

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
LearnOne/
├── backend/
│   ├── main.py                    # FastAPI app entry point, router registration
│   ├── app/
│   │   ├── routers/
│   │   │   ├── voice.py           # Gemini Live WebSocket — session resumption, GoAway, thinker tool
│   │   │   ├── chat.py            # Learning session chat (text)
│   │   │   ├── leon.py            # LEON stateless assistant endpoints
│   │   │   └── ...                # auth, sessions, quiz, review, progress
│   │   ├── services/
│   │   │   ├── thinker.py         # Fallback chain + Redis cooldown
│   │   │   └── rag.py             # pgvector cosine retrieval
│   │   ├── llm_registry.py        # Single source of truth for all model name strings
│   │   ├── models.py              # SQLAlchemy ORM (incl. RepoChunk / Vector(768))
│   │   ├── config.py              # Pydantic settings
│   │   └── claude.py              # Gemini generate_content helpers (curriculum, quiz, summary)
│   ├── migrations/                # Flyway-style SQL migrations (V1–V10)
│   └── scripts/
│       └── ingest_repo.py         # One-time repo ingestion into pgvector
└── frontend/
    └── src/
        ├── pages/
        │   ├── ChatPage.tsx        # Learning session UI
        │   └── LeonPage.tsx        # Voice session entry point
        └── components/
            └── leon/
                ├── VoiceSession.tsx  # WebSocket + PCM audio + reconnect logic
                └── LeonOrb.tsx       # Animated state-driven orb
```

### Voice session flow

```
Browser mic (PCM 16kHz)
        ↓
  VoiceSession.tsx  →  WebSocket  →  voice.py
                                          ↓
                               audio_queue (asyncio.Queue)
                                          ↓
                         client.aio.live.connect(gemini-2.5-flash-native-audio)
                                    ↙           ↘
                           send_audio()     receive_and_forward()
                                                  ├── SessionResumptionUpdate → store handle
                                                  ├── GoAway → reconnect with stored handle
                                                  ├── tool_call(consult_thinker)
                                                  │       ↓
                                                  │   thinker.py → RAG → Gemini/Groq fallback
                                                  ├── model audio → ws.send_bytes()
                                                  ├── output_transcription → ws.send_json()
                                                  └── turn_complete → save to DB
```

### Thinker fallback chain

```
consult_thinker(query)
        ↓
  retrieve_context(query)   ← pgvector cosine search (top 5 repo chunks)
        ↓
  Try THINKER_CHAIN in order:
    gemini-2.5-flash          ← skip if Redis cooldown key exists
    gemini-2.5-flash-lite     ← skip if Redis cooldown key exists
    llama-3.3-70b (Groq)      ← skip if Redis cooldown key exists
    llama-3.1-8b (Groq)       ← last resort
        ↓  (on 429)
  set Redis key learnone:thinker:cooldown:{model_id}  TTL = retryDelay
```

---

## 🛠️ Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Python 3.11, FastAPI, SQLAlchemy, python-jose, passlib |
| AI — Voice | Gemini Live API (`gemini-2.5-flash-native-audio-preview`) |
| AI — Reasoning | Gemini 2.5 Flash / Flash Lite, Groq Llama 3.3 70B / 3.1 8B |
| AI — Embeddings | `gemini-embedding-001` (768-dim) |
| Database | PostgreSQL via Supabase + pgvector extension |
| Cache | Redis via Upstash (session cooldowns, SM-2 queue) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Auth | JWT in React memory (never localStorage) + bcrypt |

---

