# LearnOne — Claude Code Instructions

## Agent Workflow (MANDATORY)

This project has three custom agents in `.claude/agents/`. They MUST be used for all feature work:

### When to use each agent

| Situation | Agent |
|---|---|
| Planning a new feature, designing an API, schema change, or architectural decision | `software-architect` |
| Writing or modifying any backend (Python/FastAPI) or frontend (React) code | `code-writer` |
| After any code is written or modified | `code-reviewer` |

### Required sequence for any non-trivial change

1. **`software-architect`** — design first. Produces component breakdown, DB schema, API contract, sequence flow, and risks.
2. **`code-writer`** — implement from the architect's design. Never skip the architect step for anything larger than a single-file fix.
3. **`code-reviewer`** — review all written code before reporting the task complete. This is proactive — invoke it without being asked.

### When agents may be skipped

- Single-line typo/config fix → skip architect, still run reviewer
- Documentation-only change → skip all three

## Stack

- **Backend:** Python 3.11+ + FastAPI + SQLAlchemy, plain SQL migrations (`backend/migrations/V{n}__{name}.sql`, applied manually)
- **Frontend:** React 18 + Vite + TypeScript + Tailwind
- **DB:** PostgreSQL via Supabase (pgvector extension, free tier — 500 MB)
- **Cache:** Redis via Upstash (free tier — 10k commands/day)
- **AI:** Gemini + Groq (fallback chain via `thinker.py`)
- **Hosting:** Render (backend) + Vercel (frontend)

## Hard rules

- All secrets via environment variables — never hardcoded
- All DB changes via new numbered SQL migration files — never alter schema manually
- The app is public — no auth. Do not reintroduce login/JWT without an explicit product decision.
