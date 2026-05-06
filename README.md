# LearnOne

Jarvis-style AI educator — persistent, personalized, multimodal.

**Stack:** Java 21 + Spring Boot 3 | React + Vite + TypeScript | PostgreSQL (Supabase) | Redis (Upstash)

## Prerequisites

- Java 21+
- Maven 3.9+
- Node 20+
- A free [Supabase](https://supabase.com) project
- A free [Upstash](https://upstash.com) Redis database

## Setup

### 1. Environment variables

```bash
cp backend/.env.example backend/.env   # fill in DB_URL, DB_PASSWORD, REDIS_URL, JWT_SECRET
cp frontend/.env.example frontend/.env # fill in VITE_API_BASE_URL
```

### 2. Backend

```bash
cd backend
mvn spring-boot:run
```

Backend runs on `http://localhost:8080`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Auth endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT |
| GET  | `/api/user/me` | Current user (requires Bearer token) |

## Phase status

- [x] Phase 0 — Foundation & Dev Environment
- [x] Phase 1 — Core AI Teaching Loop
- [x] Phase 2 — Multimodal Learning Engine
- [x] Phase 3 — Persistent Memory & Learning Graph
- [ ] Phase 4 — Polish & Production
- [ ] Phase 5 — Advanced Features
