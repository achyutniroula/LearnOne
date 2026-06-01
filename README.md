# LEON

> A Jarvis-style AI voice assistant and adaptive learning platform.  
> Built as a production-quality portfolio project by [Achyut Niroula](https://github.com/achyutniroula).

---

## What is LEON?

LEON is an AI-powered learning platform with a voice-first interface. You talk to it — it listens, thinks, and responds with voice. Under the hood it runs a full adaptive learning engine: structured curricula, spaced-repetition reviews, quizzes, and a knowledge graph that tracks what you know.

The `/talk` page is LEON in pure assistant mode — a real-time two-way voice conversation powered by Groq's Whisper STT and llama-3.3-70b reasoning, with barge-in interruption and Voice Activity Detection.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.14 + FastAPI + SQLAlchemy |
| AI | Groq — llama-3.3-70b (chat) + whisper-large-v3-turbo (STT) |
| Database | PostgreSQL via Supabase |
| Cache | Redis via Upstash |
| Frontend | React 18 + TypeScript + Vite + Framer Motion |
| Auth | JWT (python-jose) + bcrypt |
| Voice | MediaRecorder → Groq Whisper + Web SpeechSynthesis |

---

## Features

**Voice Agent (`/talk`)**
- Press once to start — LEON listens continuously via VAD (Voice Activity Detection)
- Adaptive noise floor: only real speech triggers a response, not background noise
- Barge-in: speak while LEON is talking and it stops immediately
- Sentence-by-sentence TTS with natural female voice (Microsoft Aria/Natural)
- Mute button to silence the mic without ending the conversation
- Full-screen split layout: chat history left, orb + controls right

**Learning Sessions (`/chat`)**
- Create a session with any learning goal — LEON generates a curriculum
- Socratic chat loop with context windowing and session memory
- SM-2 spaced repetition scheduling for concept reviews
- Knowledge graph extraction from every conversation
- Quiz generation from curriculum content
- Mastery tracking with EMA scoring

**Animated Orb**
- Translucent glass sphere with layered glow
- State-driven animations: idle (breathing cyan) → listening (ripple rings) → thinking (orbiting particle) → speaking (waveform bars)

---

## Local Setup

### Prerequisites

- Python 3.11+
- Node 20+
- A free [Supabase](https://supabase.com) project (PostgreSQL)
- A free [Upstash](https://upstash.com) Redis database
- A free [Groq](https://console.groq.com) API key

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:

```env
DB_URL=postgresql://your-supabase-host:5432/postgres
DB_USERNAME=postgres
DB_PASSWORD=your-password
REDIS_URL=rediss://your-upstash-url
JWT_SECRET=your-secret-key
GROQ_API_KEY=gsk_...
```

Start:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8080
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5174`.

---

## API

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT |
| GET | `/api/user/me` | Current user |
| GET | `/api/sessions` | List sessions |
| POST | `/api/sessions` | Create session + generate curriculum |
| POST | `/api/sessions/:id/chat` | Chat (learning mode) |
| GET | `/api/sessions/:id/messages` | Message history |
| POST | `/api/leon/chat` | LEON voice agent (stateless) |
| POST | `/api/leon/transcribe` | Groq Whisper STT |
| GET | `/api/review/due` | Due concepts (SM-2) |
| POST | `/api/review/:slug/record` | Record review result |
| GET | `/api/progress` | Mastery breakdown |
| GET | `/api/quiz/:id` | Get quiz |

---

## Roadmap

- [x] Voice agent with barge-in and VAD
- [x] Groq llama-3.3-70b reasoning
- [x] Groq Whisper transcription
- [x] Adaptive learning sessions with SM-2 spaced repetition
- [x] Knowledge graph + memory extraction
- [ ] Observability — structlog, Prometheus, Grafana public dashboard
- [ ] PostgreSQL depth — window functions, CTEs, partial indexes
- [ ] Redis cache-aside + sorted set review queue
- [ ] Docker + GKE (Kubernetes) deployment
- [ ] GitHub Actions CI/CD pipeline
- [ ] Redux Toolkit + RTK Query frontend upgrade
- [ ] PostgreSQL Row-Level Security (multi-tenancy)
- [ ] WebSocket real-time chat
- [ ] Cloud Pub/Sub + BigQuery analytics
