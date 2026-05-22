# LearnOne — Claude Code Instructions

## Agent Workflow (MANDATORY)

This project has three custom agents in `.claude/agents/`. They MUST be used for all feature work:

### When to use each agent

| Situation | Agent |
|---|---|
| Planning a new feature, designing an API, schema change, or architectural decision | `software-architect` |
| Writing or modifying any backend (Java) or frontend (React) code | `code-writer` |
| After any code is written or modified | `code-reviewer` |

### Required sequence for any non-trivial change

1. **`software-architect`** — design first. Produces component breakdown, DB schema, API contract, sequence flow, and risks.
2. **`code-writer`** — implement from the architect's design. Never skip the architect step for anything larger than a single-file fix.
3. **`code-reviewer`** — review all written code before reporting the task complete. This is proactive — invoke it without being asked.

### When agents may be skipped

- Single-line typo/config fix → skip architect, still run reviewer
- Documentation-only change → skip all three

## Stack

- **Backend:** Java 21 + Spring Boot 3 + Lombok + JPA + Flyway
- **Frontend:** React 18 + Vite + TypeScript + Tailwind
- **DB:** PostgreSQL via Supabase (free tier — 500 MB)
- **Cache:** Redis via Upstash (free tier — 10k commands/day)
- **AI:** Claude API (Anthropic)
- **Hosting:** Render/Railway (backend) + Vercel (frontend)

## Hard rules

- All secrets via environment variables — never hardcoded
- All DB changes via Flyway migrations — never alter schema manually
- JWT stays in React memory — never localStorage
- Every new endpoint must enforce `userId == jwtUserId` ownership check
