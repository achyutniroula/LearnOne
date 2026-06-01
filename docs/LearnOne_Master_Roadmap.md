# LearnOne — Master Build Roadmap

**Target:** Junior Software Engineer roles, wide net across startups, scale-ups, AI companies, and cloud-native teams  
**Duration:** 10 weeks · ~3–4 hours/day  
**Stack:** Python FastAPI · React TypeScript · PostgreSQL · Redis · GKE · GitHub Actions · Grafana · WebSockets · Cloud Pub/Sub · BigQuery  
**Goal:** A production-grade, live, monitored, AI-powered SaaS that makes any recruiter stop scrolling

---

## What LearnOne Is

LearnOne is an AI-powered adaptive learning platform. You give it a topic you want to learn — "machine learning fundamentals" or "system design" — and it generates a structured curriculum, teaches you through a Socratic conversation loop, quizzes you, tracks which concepts you know well and which need reinforcement, and schedules spaced-repetition reviews so you retain what you learn.

The application is not a toy. By the end of this roadmap it will be:
- Deployed at a real public URL on Google Kubernetes Engine
- Automatically deployed every time you push to `main`
- Monitored by a live Grafana dashboard showing request latency, error rate, cache hit ratio, and active users — all publicly visible, all linkable from your resume
- Multi-tenant: organisations can sign up and their data is completely isolated from other organisations at the database level
- Real-time: chat sessions update live using WebSockets, not polling
- Event-driven: every meaningful action (lesson completed, quiz passed, concept reviewed) publishes an event that feeds analytics

That description, backed by a live URL, is what makes a recruiter stop and actually read the rest of your resume.

---

## Why This Stack

Every choice below is justified on two axes: **maximum recruiter recognition** (the widest hiring market) and **maximum learning return** (every skill transfers directly to a job).

| Technology | Why this one | What it replaces / What it adds |
|---|---|---|
| Python FastAPI | #1 language for AI-adjacent companies. FastAPI is modern, async-first, production-proven. You already have it. | Nothing — keep what works |
| React + TypeScript | Most in-demand frontend combination. Hiring volume is enormous. | Upgrade type safety depth |
| PostgreSQL | Universal. Every company uses it or something compatible. Advanced features (window functions, RLS) are senior-level signals. | Upgrade query depth |
| Redis | Universal cache + queue. Every backend engineer is expected to know it. | Upgrade from rate-limit-only to full cache-aside + sorted sets |
| GKE (Kubernetes) | The production deployment story. Almost no junior candidate has deployed to Kubernetes. It is a massive differentiator. | Replace manual deploys / Render free tier |
| GitHub Actions | The CI/CD story. Shows you work like a professional engineering team. | Replace manual deploys |
| Grafana + Prometheus | Monitoring. Extremely rare at the junior level. A public Grafana dashboard is a portfolio piece by itself. | New — nothing exists yet |
| WebSockets | Real-time. Shows you understand persistent connections vs request-response. | Replace polling in chat |
| Cloud Pub/Sub | Event-driven architecture. Shows you understand decoupled systems. | New — nothing exists yet |
| BigQuery | Analytics data warehouse. Strong signal at data-heavy companies. | New — nothing exists yet |
| OpenTelemetry | Distributed tracing. Senior-level observability concept. | New — nothing exists yet |

---

## Current State of the Codebase

Before week 1 starts, understand exactly what exists today:

**Backend (`backend/`)**
- `main.py` — FastAPI app with CORS middleware, all routers registered
- `app/auth.py` — bcrypt password hashing, JWT creation and verification with python-jose
- `app/config.py` — Pydantic Settings loading from `.env`
- `app/database.py` — SQLAlchemy engine, `SessionLocal`, `get_db()` dependency
- `app/models.py` — SQLAlchemy ORM models: `User`, `LearningSession`, `ChatMessage`, `Curriculum`, `UserMemory`, `KnowledgeNode`, `Quiz`, `QuizQuestion`, `ConceptReview`
- `app/schemas.py` — Pydantic v2 request/response models for all endpoints
- `app/claude.py` — `run_claude(prompt)` using `subprocess.run` against the Claude CLI
- `app/redis_client.py` — Redis connection singleton, `rate_limit_check()`
- `app/prompts.py` — Prompt builders for curriculum generation, chat, memory extraction
- `app/routers/auth.py` — `POST /api/auth/register`, `POST /api/auth/login`
- `app/routers/sessions.py` — Session CRUD, curriculum generation (background thread)
- `app/routers/chat.py` — Chat with context windowing, memory extraction, EMA mastery
- `app/routers/quiz.py` — Quiz generation and retrieval
- `app/routers/review.py` — SM-2 spaced repetition due/record
- `app/routers/progress.py` — Mastery breakdown and review due count
- `app/routers/code.py` — Code execution via Judge0 API
- `app/routers/user.py` — `GET /api/user/me`

**Frontend (`frontend/src/`)**
- Vite + React + TypeScript
- `api/api.ts` — Axios client with base URL `''` (proxied by Vite dev server)
- Auth pages: Register, Login
- Dashboard with session list and chat interface
- Basic quiz, review, progress views

**Database**
- PostgreSQL on Supabase with Flyway migrations V1–V8
- Tables: users, learning_sessions, chat_messages, curricula, user_memories, knowledge_nodes, quizzes, quiz_questions, concept_reviews

**What is missing:**
- No production deployment (runs only locally)
- No CI/CD
- No monitoring or observability
- No real-time (chat polling instead of WebSocket)
- No multi-tenancy
- No analytics layer
- No event system
- No tests
- No HTTPS / real domain

---

## The 10-Week Plan at a Glance

| Week | Theme | Key Deliverable |
|---|---|---|
| 1 | Observability foundation | Structured logging, Prometheus metrics, OpenTelemetry traces |
| 2 | Grafana + domain + HTTPS | Public monitoring dashboard, live URL, TLS cert |
| 3 | PostgreSQL depth | Window functions, CTEs, EXPLAIN ANALYZE, indexes, query optimisation |
| 4 | Redis depth | Cache-aside pattern, sorted sets for review queue, cache invalidation |
| 5 | Docker + GKE | Multi-stage Docker builds, GKE cluster, three-service deployment |
| 6 | GitHub Actions CI/CD | Automated test → build → push → deploy on every push to main |
| 7 | TypeScript depth + Redux | Discriminated unions, generics, Redux Toolkit, RTK Query |
| 8 | RxJS reactive frontend | Observable streams, switchMap search, combineLatest filters |
| 9 | Multi-tenancy + WebSockets | PostgreSQL RLS, tenant isolation, real-time chat via WebSocket |
| 10 | Pub/Sub + BigQuery + polish | Event architecture, analytics layer, UI polish, demo video |

---

---

# WEEK 1 — Observability Foundation

## What

Add structured logging, Prometheus metrics collection, and OpenTelemetry distributed tracing to the FastAPI backend. By the end of the week the backend emits machine-readable JSON logs, exposes a `/metrics` endpoint that Prometheus can scrape, and attaches trace IDs to every request so you can follow a single HTTP request through every function it touches.

## Why

**For the job:** Observability is how production engineers understand running systems. It is the difference between "I think the server is slow" and "the p99 latency on `POST /api/sessions/{id}/chat` is 4.2 seconds because `run_claude()` blocks for 3.8s". Every company running software at scale requires this. Most junior candidates have never heard of it. Adding it to your project puts you in a different category.

**For the project:** The Claude CLI subprocess is a black box right now. If it hangs, you find out when a user complains. With tracing you will see exactly how long each Claude call takes and whether it is the database, Redis, or Claude that is slow on any given request.

## How

### Structured Logging

**What it is:** Instead of `print("User registered")`, you emit `{"event": "user_registered", "user_id": 42, "email": "...", "duration_ms": 14, "request_id": "abc-123"}`. Every log line is valid JSON. This means you can query logs with tools like Loki, CloudWatch Insights, or BigQuery — you cannot query plain text logs at scale.

**Implementation:**

Install `structlog`:
```
structlog==24.1.0
```

Create `app/logging_config.py`:
```python
import structlog
import logging

def configure_logging():
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )
```

Add a FastAPI middleware in `main.py` that:
1. Generates a `request_id` UUID for every incoming request
2. Binds it to `structlog.contextvars` so every log line in that request's lifetime includes the same `request_id`
3. Logs `request_started` and `request_finished` with method, path, status code, and duration in milliseconds

Replace every `print()` and bare `logging.info()` call in the routers with `structlog.get_logger().info("event_name", key=value)`.

**What this enables:** When a user reports "something went wrong", you search logs for their `user_id` and see every single thing that happened in that request, in order, with timings. This is how production debugging works.

### Prometheus Metrics

**What it is:** Prometheus is a time-series metrics database. It scrapes a `/metrics` endpoint on your app every 15 seconds and stores counters and histograms. Grafana then queries Prometheus to draw charts.

**Implementation:**

Install `prometheus-fastapi-instrumentator`:
```
prometheus-fastapi-instrumentator==6.1.0
```

Add to `main.py`:
```python
from prometheus_fastapi_instrumentator import Instrumentator
Instrumentator().instrument(app).expose(app)
```

This automatically instruments every route and exposes:
- `http_requests_total` — counter by method, path, status code
- `http_request_duration_seconds` — histogram of response times
- `http_requests_in_progress` — gauge of concurrent requests

Add custom metrics in `app/metrics.py`:
```python
from prometheus_client import Counter, Histogram, Gauge

claude_calls_total = Counter("claude_calls_total", "Total Claude CLI invocations", ["status"])
claude_call_duration = Histogram("claude_call_duration_seconds", "Claude CLI call duration")
redis_cache_hits = Counter("redis_cache_hits_total", "Redis cache hits", ["endpoint"])
redis_cache_misses = Counter("redis_cache_misses_total", "Redis cache misses", ["endpoint"])
active_websocket_connections = Gauge("active_websocket_connections", "Active WebSocket connections")
```

Instrument `run_claude()` in `app/claude.py` to record duration and increment `claude_calls_total` with status `success` or `error`.

### OpenTelemetry Tracing

**What it is:** Every HTTP request gets a `trace_id`. As the request flows through your code — hitting the database, calling Redis, invoking Claude — each step creates a `span` with a start time, end time, and attributes. You can visualise the full request as a timeline showing exactly where time was spent.

**Implementation:**

Install:
```
opentelemetry-sdk==1.24.0
opentelemetry-instrumentation-fastapi==0.45b0
opentelemetry-instrumentation-sqlalchemy==0.45b0
opentelemetry-instrumentation-redis==0.45b0
opentelemetry-exporter-otlp==1.24.0
```

Create `app/tracing.py`:
```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor

def configure_tracing(app, engine):
    provider = TracerProvider()
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint="http://otel-collector:4317"))
    )
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
    SQLAlchemyInstrumentor().instrument(engine=engine)
    RedisInstrumentor().instrument()
```

With this in place, every database query and Redis call automatically becomes a child span inside the parent HTTP request span. You will see in Grafana Tempo (or Jaeger): "This `/api/sessions/{id}/chat` call took 4.2s: 0.1s in the route handler, 0.2s in PostgreSQL, 3.8s in `run_claude()`."

## Week 1 Deliverable

The backend runs locally with:
- Every HTTP request logged as structured JSON including `request_id`, method, path, status, duration
- `GET /metrics` returning Prometheus-format metrics
- OpenTelemetry spans being exported (even if the collector is not yet set up — exporter fails silently)
- Custom metrics tracking Claude call counts, durations, and cache hits/misses

---

---

# WEEK 2 — Grafana Dashboard + Domain + HTTPS

## What

Stand up Grafana and Prometheus as Docker containers (locally first, then on GKE in Week 5). Register a domain for LearnOne. Configure HTTPS. By end of week the app is accessible at `https://learnone.yourdomain.com` with a live Grafana dashboard at `https://grafana.learnone.yourdomain.com` that anyone can view.

## Why

**For the job:** A publicly accessible Grafana dashboard on your resume is a portfolio piece by itself. It proves the app is real, running, and that you understand production operations at a level that most seniors at small companies do not bother with. You can link directly to it: "Live monitoring: grafana.learnone.io". No recruiter expects a junior to have this.

**For the project:** You cannot know if your cache-aside pattern (Week 4) actually helps without seeing cache hit ratios over time. You cannot know if your CI/CD pipeline (Week 6) caused a latency regression without a baseline. Observability must come before optimization.

## How

### Domain Registration

Register a `.dev` or `.io` domain at Namecheap or Cloudflare (~$10–15/year). Use Cloudflare as your DNS provider regardless of where you register — Cloudflare's free plan provides DDoS protection, CDN, and automatic TLS certificates.

Recommended domain pattern: `learnone.dev` or `learnone.app`. Keep it short — it will appear on your resume.

Subdomains you will use:
- `app.learnone.dev` — the React frontend
- `api.learnone.dev` — the FastAPI backend
- `grafana.learnone.dev` — Grafana dashboard (public read-only)

### TLS / HTTPS

On GKE (Week 5) you will use `cert-manager` with Let's Encrypt to auto-provision and renew TLS certificates. For now, understand the flow:

1. `cert-manager` watches for `Certificate` Kubernetes resources
2. It talks to Let's Encrypt via the ACME protocol (DNS-01 challenge via Cloudflare API)
3. Let's Encrypt issues a 90-day certificate, stored as a Kubernetes `Secret`
4. The GKE Ingress uses that Secret to terminate TLS

This means HTTPS is fully automated — certificates renew themselves. You never manually handle a `.pem` file.

### Grafana Setup (Local Docker)

`docker-compose.yml` (for local development):
```yaml
services:
  prometheus:
    image: prom/prometheus:v2.51.0
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:10.4.0
    volumes:
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    ports:
      - "3001:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
```

`monitoring/prometheus.yml`:
```yaml
scrape_configs:
  - job_name: learnone-api
    static_configs:
      - targets: ["host.docker.internal:8080"]
    scrape_interval: 15s
    metrics_path: /metrics
```

`GF_AUTH_ANONYMOUS_ENABLED=true` is the key setting — anyone visiting the Grafana URL can view dashboards without logging in. This is intentional: you want recruiters to be able to open the link and immediately see live charts.

### Dashboard Design

Build four panels in Grafana:

**Panel 1 — Request Rate:** `rate(http_requests_total[5m])` — line chart showing requests per second over the last hour, coloured by HTTP status code. A healthy app shows green (2xx) with occasional yellow (4xx). No red (5xx) spikes.

**Panel 2 — Latency Percentiles:** `histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))`, same for 0.95 and 0.99. Shows p50/p95/p99 response time. The gap between p50 and p99 tells you how consistent your performance is.

**Panel 3 — Claude Call Duration:** `histogram_quantile(0.95, rate(claude_call_duration_seconds_bucket[5m]))` — how long the AI calls take. This will be the dominant latency driver. Seeing it explicitly makes the caching work in Week 4 measurable.

**Panel 4 — Cache Performance:** Two counters side by side: `rate(redis_cache_hits_total[5m])` and `rate(redis_cache_misses_total[5m])`. After Week 4 the hit rate should be above 85% for session list and progress endpoints.

Provision the dashboard as a JSON file in `monitoring/grafana/dashboards/learnone.json` so it is version-controlled and automatically appears when Grafana starts — you never click "save" in the UI.

## Week 2 Deliverable

- Domain registered, Cloudflare DNS configured
- `docker-compose up` starts the full local stack including Prometheus and Grafana
- Grafana dashboard shows all four panels with real data from the running backend
- Dashboard JSON is committed to the repository
- README updated with: "Live monitoring: [link to grafana]" (pointing to the future GKE URL for now)

---

---

# WEEK 3 — PostgreSQL Depth

## What

Upgrade every significant database query in the backend to use the most efficient PostgreSQL feature for that query's pattern. Add window functions to the progress and review routers, rewrite the memory extraction query as a CTE, add partial indexes on the most-queried columns, and implement `EXPLAIN ANALYZE` analysis on every slow query identified by the Grafana latency panel.

## Why

**For the job:** "I know SQL" is on every junior resume. "I used window functions to compute week-over-week concept mastery trends in a single query instead of N+1 Python loops, and reduced that endpoint's latency by 70%" is on almost none of them. Advanced PostgreSQL is a senior-level signal that is directly applicable at any company that stores data — which is all of them.

**For the project:** The progress endpoint currently fetches all `concept_reviews` for a user and aggregates in Python. For a user with 200 concepts reviewed 10 times each, that is 2,000 rows fetched to Python to compute five numbers. A single window function query returns those five numbers directly from Postgres in one round trip.

## How

### Window Functions

**What they are:** A window function computes a value for each row by looking at a "window" of related rows — without collapsing the result set the way `GROUP BY` does.

**Current progress query (inefficient):**
```python
# In app/routers/progress.py
reviews = db.query(ConceptReview).filter(ConceptReview.user_id == user_id).all()
mastery_by_concept = {}
for r in reviews:
    if r.concept_slug not in mastery_by_concept or r.reviewed_at > mastery_by_concept[r.concept_slug].reviewed_at:
        mastery_by_concept[r.concept_slug] = r
# then aggregate in Python
```

**Replacement — single window function query via SQLAlchemy `text()`:**
```sql
WITH latest_reviews AS (
    SELECT
        concept_slug,
        mastery_score,
        next_review_at,
        ROW_NUMBER() OVER (
            PARTITION BY concept_slug
            ORDER BY reviewed_at DESC
        ) AS rn
    FROM concept_reviews
    WHERE user_id = :user_id
),
mastery_bands AS (
    SELECT
        concept_slug,
        mastery_score,
        next_review_at,
        CASE
            WHEN mastery_score >= 0.8 THEN 'strong'
            WHEN mastery_score >= 0.5 THEN 'developing'
            ELSE 'weak'
        END AS band
    FROM latest_reviews
    WHERE rn = 1
)
SELECT
    band,
    COUNT(*) AS concept_count,
    AVG(mastery_score) AS avg_mastery,
    MIN(next_review_at) AS earliest_due
FROM mastery_bands
GROUP BY band
```

This is one query, one round trip, zero Python loops, and returns exactly what the progress endpoint needs.

**Week-over-week mastery trend** (new analytics endpoint you will add):
```sql
SELECT
    DATE_TRUNC('week', reviewed_at) AS week,
    concept_slug,
    AVG(mastery_score) AS avg_mastery,
    AVG(mastery_score) - LAG(AVG(mastery_score)) OVER (
        PARTITION BY concept_slug
        ORDER BY DATE_TRUNC('week', reviewed_at)
    ) AS mastery_delta
FROM concept_reviews
WHERE user_id = :user_id
  AND reviewed_at >= NOW() - INTERVAL '8 weeks'
GROUP BY DATE_TRUNC('week', reviewed_at), concept_slug
ORDER BY week, concept_slug
```

`LAG()` accesses the previous row's value — this computes the change in mastery score week over week in pure SQL with no application-side logic.

### Common Table Expressions (CTEs)

**What they are:** Named subqueries defined at the top of a SQL statement with `WITH`. They make complex queries readable by breaking them into named steps that can reference each other.

The memory extraction query currently does several round trips to check if a `KnowledgeNode` already exists before creating or updating it. Rewrite as a single CTE using `INSERT ... ON CONFLICT DO UPDATE` (upsert):

```sql
WITH incoming AS (
    SELECT unnest(:slugs::text[]) AS slug,
           unnest(:labels::text[]) AS label
)
INSERT INTO knowledge_nodes (user_id, session_id, concept_slug, label, strength, last_seen_at)
SELECT :user_id, :session_id, slug, label, 0.1, NOW()
FROM incoming
ON CONFLICT (user_id, concept_slug) DO UPDATE
    SET strength = knowledge_nodes.strength + 0.05,
        last_seen_at = NOW()
RETURNING concept_slug, strength
```

One query, one round trip, handles both insert and update atomically.

### EXPLAIN ANALYZE

**What it is:** `EXPLAIN ANALYZE` runs a query and shows the execution plan PostgreSQL chose — which indexes it used, how many rows it scanned, and where time was spent.

For every endpoint that shows latency above 100ms on the Grafana dashboard:

1. Get the query from SQLAlchemy by adding `echo=True` to the engine temporarily
2. Run `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) <your query>` in psql
3. Read the output: look for `Seq Scan` on large tables (bad — it's reading every row), `Index Scan` (good — using an index), and `Hash Join` vs `Nested Loop` (nested loop on large tables is a performance problem)

### Indexes

**Current state:** The Flyway migrations create the tables and primary keys but no performance indexes.

**Indexes to add in a new Flyway migration `V9__performance_indexes.sql`:**

```sql
-- Most common query pattern: get all sessions for a user
CREATE INDEX CONCURRENTLY idx_learning_sessions_user_id
    ON learning_sessions(user_id);

-- Chat message retrieval: get messages for a session, ordered by time
CREATE INDEX CONCURRENTLY idx_chat_messages_session_id_created
    ON chat_messages(session_id, created_at DESC);

-- Review queue: find reviews due for a user
CREATE INDEX CONCURRENTLY idx_concept_reviews_due
    ON concept_reviews(user_id, next_review_at)
    WHERE next_review_at IS NOT NULL;

-- Knowledge nodes: slug lookup per user
CREATE INDEX CONCURRENTLY idx_knowledge_nodes_user_slug
    ON knowledge_nodes(user_id, concept_slug);
```

The `WHERE next_review_at IS NOT NULL` on the review index is a **partial index** — it only indexes rows where a review is actually scheduled. Since many concept_reviews have `NULL` next_review_at (newly created concepts), this index is much smaller and faster than a full index.

`CONCURRENTLY` allows the index to build without locking the table — safe on a production database.

## Week 3 Deliverable

- `V9__performance_indexes.sql` migration committed, applied
- Progress endpoint rewritten as single window function query
- Week-over-week mastery trend endpoint added (`GET /api/progress/trend`)
- Memory extraction upsert rewritten as single CTE query
- EXPLAIN ANALYZE run on all endpoints showing >100ms on Grafana, findings documented in a `docs/query_optimization.md` file showing before/after latency

---

---

# WEEK 4 — Redis Depth

## What

Upgrade Redis usage from a single rate-limit counter to a full cache-aside pattern for session lists and progress summaries, a sorted set for the review due queue, and a Pub/Sub channel for internal service communication. Add cache invalidation on writes.

## Why

**For the job:** Redis is on almost every backend job description. But most developers only use it for session storage or basic key-value caching. Understanding cache-aside (when to read from cache vs when to go to the database, and how to handle invalidation) is a more sophisticated pattern that signals real production experience.

**For the project:** The session list endpoint and progress endpoint are the two most frequently called endpoints. Both are currently pure Postgres queries. After this week, the first call populates a Redis cache with a 5-minute TTL and all subsequent calls in that window hit Redis at sub-millisecond latency. The Grafana cache hit ratio panel will show the improvement.

## How

### Cache-Aside Pattern

**What it is:** The application manages the cache manually:
1. Incoming request → check Redis for the cached result
2. Cache hit → return the cached value immediately, log `redis_cache_hits_total`
3. Cache miss → query PostgreSQL, store the result in Redis with a TTL, log `redis_cache_misses_total`, return the result

Create `app/cache.py`:
```python
import json
from app.redis_client import get_redis
from app.metrics import redis_cache_hits, redis_cache_misses

def cache_aside(key: str, ttl_seconds: int, endpoint: str):
    """Decorator that wraps a function with cache-aside logic."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            redis = get_redis()
            cached = redis.get(key)
            if cached:
                redis_cache_hits.labels(endpoint=endpoint).inc()
                return json.loads(cached)
            result = await func(*args, **kwargs)
            redis.setex(key, ttl_seconds, json.dumps(result, default=str))
            redis_cache_misses.labels(endpoint=endpoint).inc()
            return result
        return wrapper
    return decorator
```

Apply to the session list endpoint with `ttl=300` (5 minutes) and the progress endpoint with `ttl=120` (2 minutes — progress changes more often).

### Cache Invalidation

**The rule:** Every write that changes what a cached read would return must invalidate (delete) that cache entry. If it does not, the cache will serve stale data until the TTL expires.

Write operations that require cache invalidation:
- `POST /api/sessions` → invalidate `sessions:{user_id}`
- `POST /api/sessions/{id}/chat` → invalidate `progress:{user_id}` (mastery scores change after chat)
- `POST /api/review/{slug}/record` → invalidate `progress:{user_id}` and `review_queue:{user_id}`

Add an `invalidate_cache(pattern: str)` function that calls `redis.delete(key)`. Call it at the end of every write endpoint that affects a cached resource.

### Sorted Sets for Review Queue

**What they are:** Redis sorted sets store members with an associated floating-point score. Members are always ordered by score. This is a natural fit for a due-review queue where the score is the Unix timestamp of when each concept is next due.

**Current review queue logic:** The `GET /api/review/due` endpoint queries PostgreSQL for all `concept_reviews` where `next_review_at <= NOW()` for the user, ordered by `next_review_at`. For a user with 500 concepts, this scans up to 500 rows.

**Redis sorted set replacement:**

On every `POST /api/review/{slug}/record` call (after SM-2 computes the next review date):
```python
redis.zadd(
    f"review_queue:{user_id}",
    {concept_slug: next_review_at.timestamp()}
)
```

On `GET /api/review/due`:
```python
now = datetime.utcnow().timestamp()
due_slugs = redis.zrangebyscore(f"review_queue:{user_id}", 0, now, start=0, num=20)
```

`ZRANGEBYSCORE` returns all members with scores between 0 (epoch) and now — the due concepts — ordered by due date ascending. This is O(log N + M) where M is the number of due items, vs O(N) for the Postgres scan. At 500 concepts the difference is small; at 50,000 it is the difference between 1ms and 200ms.

Seed the sorted set from Postgres on first miss (same cache-aside pattern).

### Redis Pub/Sub Preview

**What it is:** Redis has a lightweight publish-subscribe system. One part of your application publishes a message to a channel; any subscriber to that channel receives it. This is the conceptual preview for Cloud Pub/Sub in Week 10.

Add a publisher in `app/events.py`:
```python
def publish_event(event_type: str, payload: dict):
    redis = get_redis()
    redis.publish("learnone:events", json.dumps({"type": event_type, "payload": payload}))
```

Call it at the end of the chat endpoint: `publish_event("message_sent", {"user_id": ..., "session_id": ...})`.

No subscriber yet — this is instrumentation for Week 10 when the real event system arrives. But the publish calls are now in place.

## Week 4 Deliverable

- Cache-aside on session list (300s TTL) and progress (120s TTL)
- Cache invalidation wired to all write endpoints
- Review queue backed by Redis sorted set
- Grafana cache hit ratio panel showing >80% hit rate after 30 minutes of use
- `publish_event()` called at the end of chat, review record, and lesson completion endpoints

---

---

# WEEK 5 — Docker + GKE Deployment

## What

Build production-grade Docker images for the backend and frontend. Create a GKE Standard cluster. Write Kubernetes manifests for three deployments: FastAPI backend, React frontend (nginx), and a monitoring stack (Prometheus + Grafana). Deploy everything. LearnOne is now live at a real URL.

## Why

**For the job:** Kubernetes deployment is the single most differentiating item on a junior resume. Companies do not expect junior engineers to know Kubernetes — the bar for this skill is typically mid-senior. Having shipped a real Kubernetes deployment that is live and inspectable is a top-tier portfolio signal.

**For the project:** The free Render dyno sleeps after 15 minutes of inactivity. GKE Standard with a single `e2-small` preemptible node runs 24/7 for approximately $15–20/month. It restarts automatically if the container crashes. It handles rolling updates without downtime.

## How

### Multi-Stage Docker Builds

**What they are:** A Dockerfile with multiple `FROM` stages. Earlier stages compile or build the application; later stages copy only the output artifacts into a minimal final image. The final image does not contain build tools, source code, or development dependencies.

**Backend `backend/Dockerfile`:**
```dockerfile
# Stage 1: dependency install
FROM python:3.14-slim AS deps
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: production image
FROM python:3.14-slim AS production
WORKDIR /app
COPY --from=deps /usr/local/lib/python3.14/site-packages /usr/local/lib/python3.14/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY app/ ./app/
COPY main.py .
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
```

**Why two stages:** The `deps` stage installs pip packages (slow, ~300MB). If `requirements.txt` has not changed, Docker caches the entire `deps` stage and the subsequent build takes 10 seconds instead of 3 minutes. The `production` stage is clean — no cached pip files, no build tools.

**Frontend `frontend/Dockerfile`:**
```dockerfile
# Stage 1: build React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

`nginx.conf` must handle client-side routing — all paths serve `index.html` and let React Router handle routing:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

It also proxies `/api` to the backend service:
```nginx
location /api {
    proxy_pass http://learnone-api:8080;
}
```

### GKE Cluster Setup

Create a GKE Standard cluster with one node pool:
```bash
gcloud container clusters create learnone \
  --zone us-central1-a \
  --num-nodes 2 \
  --machine-type e2-small \
  --disk-size 20 \
  --preemptible
```

`--preemptible` nodes cost ~70% less and are sufficient for a portfolio project. They may restart every 24 hours; Kubernetes recreates your Pods automatically.

Enable Workload Identity (correct way to give Pods access to GCP services without storing service account keys in Kubernetes Secrets):
```bash
gcloud container clusters update learnone \
  --workload-pool=YOUR_PROJECT.svc.id.goog \
  --zone us-central1-a
```

### Kubernetes Manifests

Create `k8s/` directory with the following files:

**`k8s/namespace.yaml`:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: learnone
```

**`k8s/api-deployment.yaml`** (core structure):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: learnone-api
  namespace: learnone
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0   # never take a pod down before the new one is ready
  selector:
    matchLabels:
      app: learnone-api
  template:
    metadata:
      labels:
        app: learnone-api
    spec:
      containers:
      - name: api
        image: REGION-docker.pkg.dev/PROJECT/learnone/api:latest
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: "100m"
            memory: "256Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
        envFrom:
        - secretRef:
            name: learnone-secrets
        - configMapRef:
            name: learnone-config
        livenessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
          failureThreshold: 3
```

**Why `maxUnavailable: 0`:** During a rolling update, this setting ensures that at least 2 replicas are always serving traffic. Without it, Kubernetes might terminate a pod before the new one is ready, causing brief downtime.

**Why two probes:**
- `livenessProbe`: Is the process alive? If this fails 3 times, Kubernetes kills and restarts the container. Catches frozen processes.
- `readinessProbe`: Is the process ready to serve traffic? If this fails, Kubernetes removes the Pod from the Service's endpoints. Catches startup failures — the Pod exists but is still loading.

**`k8s/api-service.yaml`:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: learnone-api
  namespace: learnone
spec:
  selector:
    app: learnone-api
  ports:
  - port: 8080
    targetPort: 8080
  type: ClusterIP
```

`ClusterIP` means the service is only accessible within the cluster. The Ingress (below) is the only entry point from the internet.

**`k8s/ingress.yaml`** (using GKE's built-in HTTP(S) Load Balancer):
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: learnone-ingress
  namespace: learnone
  annotations:
    kubernetes.io/ingress.class: "gce"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - app.learnone.dev
    - api.learnone.dev
    secretName: learnone-tls
  rules:
  - host: app.learnone.dev
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: learnone-frontend
            port:
              number: 80
  - host: api.learnone.dev
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: learnone-api
            port:
              number: 8080
```

**`k8s/secrets.yaml`** (stored as a Kubernetes Secret, values are base64-encoded):

Never commit actual secret values. The CI/CD pipeline (Week 6) will create this Secret from GitHub Secrets at deploy time. The manifest file itself contains placeholder values:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: learnone-secrets
  namespace: learnone
type: Opaque
stringData:
  DATABASE_URL: "REPLACED_BY_CI"
  JWT_SECRET: "REPLACED_BY_CI"
  REDIS_URL: "REPLACED_BY_CI"
```

### Resource Requests and Limits

**Why they matter:** On a shared Kubernetes cluster, if one Pod consumes all CPU, other Pods are starved. Resource `requests` tell the Kubernetes scheduler how much CPU/memory to reserve for a Pod when deciding which node to schedule it on. Resource `limits` tell the kernel the maximum the Pod can consume — exceed the memory limit and the process is killed (`OOMKilled`).

Setting `requests: cpu: 100m` means "this Pod needs 0.1 CPU cores to function". Setting `limits: cpu: 500m` means "this Pod may burst to 0.5 cores but no more".

For the FastAPI backend with 2 Uvicorn workers, `256Mi` memory request and `512Mi` limit is appropriate. The JVM-based Scala alternative would need `512Mi` request and `1Gi` limit — Python's smaller footprint is a real operational advantage here.

## Week 5 Deliverable

- Backend and frontend Docker images building successfully with multi-stage builds
- GKE cluster running with 2 nodes
- All Kubernetes manifests in `k8s/` committed to the repository
- `kubectl apply -f k8s/` deploys the full stack
- LearnOne accessible at `https://app.learnone.dev`
- Grafana accessible at `https://grafana.learnone.dev` with anonymous read access
- TLS certificates auto-provisioned by cert-manager

---

---

# WEEK 6 — GitHub Actions CI/CD Pipeline

## What

Build a complete automated pipeline: every push to `main` runs the test suite, builds Docker images tagged with the git commit SHA, pushes them to Google Artifact Registry, and deploys to GKE using a rolling update. A failed health check triggers automatic rollback. No manual steps from commit to production.

## Why

**For the job:** CI/CD is a non-negotiable practice in every professional engineering team. Being able to say "the project auto-deploys on merge with automated rollback" shows you work in the same way that real engineering teams work — something the vast majority of junior candidates have never experienced.

**For the project:** Right now deploying a change means manually building the Docker image, pushing it to a registry, and running kubectl commands. After this week that entire process happens automatically in under 4 minutes. You `git push` and walk away.

## How

### Repository Structure

```
.github/
  workflows/
    ci.yml        # runs on every push and pull request
    cd.yml        # runs only on push to main
```

### CI Workflow (`.github/workflows/ci.yml`)

```yaml
name: CI
on:
  push:
  pull_request:

jobs:
  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: learnone_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-retries 5
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.14"
          cache: "pip"
      - run: pip install -r backend/requirements.txt pytest pytest-asyncio httpx
      - run: pytest backend/tests/ -v --tb=short
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/learnone_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret-not-real

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
        working-directory: frontend
      - run: npm run type-check
        working-directory: frontend
      - run: npm test -- --run
        working-directory: frontend
```

**Why real services in CI:** The `services:` block starts real Postgres and Redis containers alongside the test runner. This means your tests hit a real database and a real Redis instance — not mocks. Tests that pass against mocks but fail against real databases are a common source of production incidents. The extra 30 seconds is worth it.

**`cache: "pip"` and `cache: "npm"`:** GitHub Actions caches the pip and npm dependency directories between runs. The first run downloads everything. All subsequent runs skip the download step (~90 seconds saved per run for pip, ~60 for npm).

### Tests to Write (Backend)

Create `backend/tests/` with:

**`tests/test_auth.py`** — integration tests using `httpx.AsyncClient` against the FastAPI app:
```python
async def test_register_creates_user(client, db):
    response = await client.post("/api/auth/register", json={
        "email": "test@example.com", "password": "password123"
    })
    assert response.status_code == 201
    assert "token" in response.json()

async def test_login_returns_token(client, db, registered_user):
    response = await client.post("/api/auth/login", json={
        "email": "test@example.com", "password": "password123"
    })
    assert response.status_code == 200
    assert "token" in response.json()

async def test_duplicate_email_returns_409(client, db, registered_user):
    response = await client.post("/api/auth/register", json={
        "email": "test@example.com", "password": "different"
    })
    assert response.status_code == 409
```

**`tests/test_progress.py`** — tests for the window function query:
```python
async def test_progress_returns_mastery_bands(client, auth_headers, db, seeded_reviews):
    response = await client.get("/api/progress", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "strong" in data["masteryBands"]
    assert "developing" in data["masteryBands"]
    assert "weak" in data["masteryBands"]
```

### CD Workflow (`.github/workflows/cd.yml`)

```yaml
name: CD
on:
  push:
    branches: [main]
needs: [test-backend, test-frontend]  # only runs if CI passes

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # required for Workload Identity

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker us-central1-docker.pkg.dev

      - name: Build and push backend
        run: |
          IMAGE="us-central1-docker.pkg.dev/${{ vars.GCP_PROJECT }}/learnone/api:${{ github.sha }}"
          docker build -t $IMAGE backend/
          docker push $IMAGE

      - name: Build and push frontend
        run: |
          IMAGE="us-central1-docker.pkg.dev/${{ vars.GCP_PROJECT }}/learnone/frontend:${{ github.sha }}"
          docker build -t $IMAGE frontend/
          docker push $IMAGE

      - name: Get GKE credentials
        uses: google-github-actions/get-gke-credentials@v2
        with:
          cluster_name: learnone
          location: us-central1-a

      - name: Deploy to GKE
        run: |
          kubectl set image deployment/learnone-api \
            api=us-central1-docker.pkg.dev/${{ vars.GCP_PROJECT }}/learnone/api:${{ github.sha }} \
            -n learnone
          kubectl set image deployment/learnone-frontend \
            frontend=us-central1-docker.pkg.dev/${{ vars.GCP_PROJECT }}/learnone/frontend:${{ github.sha }} \
            -n learnone

      - name: Wait and verify rollout
        run: |
          kubectl rollout status deployment/learnone-api -n learnone --timeout=120s
          kubectl rollout status deployment/learnone-frontend -n learnone --timeout=120s

      - name: Rollback on failure
        if: failure()
        run: |
          kubectl rollout undo deployment/learnone-api -n learnone
          kubectl rollout undo deployment/learnone-frontend -n learnone
```

**Why image tags are git SHAs (`${{ github.sha }}`):** Using `latest` as the image tag in production is an anti-pattern. If you deploy `api:latest` and something breaks, you cannot tell which code is running. With SHA tags, every deployed image is traceable to an exact commit. `kubectl rollout history` shows you the SHA of every deployed version.

**Why Workload Identity instead of service account keys:** A service account key JSON file stored in GitHub Secrets is a long-lived credential — if the secret is ever leaked, an attacker has permanent access. Workload Identity Federation creates short-lived tokens using OIDC — GitHub Actions proves its identity to Google and gets a 1-hour token. No long-lived credential ever exists.

## Week 6 Deliverable

- `backend/tests/` with at minimum 15 integration tests covering auth, sessions, progress, and review endpoints
- CI passes on every push, running tests against real Postgres and Redis
- CD deploys to GKE automatically on merge to `main`
- GitHub Actions workflow summary shows pipeline duration and pass/fail status
- `README.md` updated with CI/CD badge: `![CI](https://github.com/USERNAME/learnone/workflows/CI/badge.svg)`
- Full pipeline completes in under 6 minutes

---

---

# WEEK 7 — TypeScript Depth + Redux Toolkit

## What

Upgrade the frontend TypeScript from basic types to professional-grade patterns: discriminated unions for all loading states, generic API client, utility types for form payloads. Replace `useState`-based data fetching with Redux Toolkit and RTK Query. Every component that fetches data should use a generated RTK Query hook.

## Why

**For the job:** TypeScript is on every frontend and full-stack job description. But "I know TypeScript" on a resume is as meaningful as "I know JavaScript" — everyone says it. Showing discriminated unions for loading states, generic utility types, and RTK Query demonstrates you have moved past beginner TypeScript into the patterns that senior engineers use and expect in code reviews.

**For the project:** The current frontend has at least a dozen places where `isLoading: boolean` and `error: string | null` sit next to a `data` field. This creates impossible states — `isLoading: true` and `data: [...something]` at the same time. Discriminated unions make impossible states impossible to represent in the type system.

## How

### Discriminated Unions for Loading States

**Current pattern (has impossible states):**
```typescript
const [sessions, setSessions] = useState<Session[]>([])
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
```

This allows the state `{ isLoading: true, data: [...], error: "something" }` — which makes no sense. Is it loading? Does it have data? Is there an error? All three at once?

**Replacement pattern (impossible states are impossible):**
```typescript
type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string }

// In a component:
const [state, setState] = useState<LoadState<Session[]>>({ status: 'idle' })

// In the render:
switch (state.status) {
  case 'loading': return <Spinner />
  case 'error': return <ErrorMessage message={state.error} />
  case 'success': return <SessionList sessions={state.data} />
  case 'idle': return null
}
```

TypeScript's exhaustiveness checking will warn you if you add a new status variant and forget to handle it in the switch.

Replace every loading/error/data triple in the codebase with this pattern.

### Generic API Client

**Current `api.ts` (separate function per endpoint):**
```typescript
export async function getSessions(): Promise<Session[]> { ... }
export async function createSession(data: CreateSessionRequest): Promise<Session> { ... }
export async function getProgress(): Promise<ProgressResponse> { ... }
```

**Replacement (one generic function, all endpoints expressed as typed call sites):**
```typescript
async function apiRequest<TResponse, TBody = undefined>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: TBody
): Promise<TResponse> {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
    throw new ApiError(res.status, err.detail)
  }
  return res.json() as Promise<TResponse>
}

export const api = {
  sessions: {
    list: () => apiRequest<Session[]>('GET', '/api/sessions'),
    create: (body: CreateSessionRequest) => apiRequest<Session, CreateSessionRequest>('POST', '/api/sessions', body),
  },
  progress: {
    get: () => apiRequest<ProgressResponse>('GET', '/api/progress'),
    trend: () => apiRequest<TrendPoint[]>('GET', '/api/progress/trend'),
  },
}
```

### Redux Toolkit Setup

Install:
```
@reduxjs/toolkit react-redux
```

Create `frontend/src/store/`:

**`store/index.ts`:**
```typescript
import { configureStore } from '@reduxjs/toolkit'
import { learnoneApi } from './api'
import authReducer from './authSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [learnoneApi.reducerPath]: learnoneApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(learnoneApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

**`store/authSlice.ts`:**
```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AuthState {
  token: string | null
  userId: number | null
}

const authSlice = createSlice({
  name: 'auth',
  initialState: { token: null, userId: null } as AuthState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ token: string; userId: number }>) => {
      state.token = action.payload.token
      state.userId = action.payload.userId
    },
    logout: (state) => {
      state.token = null
      state.userId = null
    },
  },
})
```

**`store/api.ts` (RTK Query):**
```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { RootState } from './index'

export const learnoneApi = createApi({
  reducerPath: 'learnoneApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token
      if (token) headers.set('Authorization', `Bearer ${token}`)
      return headers
    },
  }),
  tagTypes: ['Session', 'Progress', 'Review'],
  endpoints: (builder) => ({
    getSessions: builder.query<Session[], void>({
      query: () => '/sessions',
      providesTags: ['Session'],
    }),
    createSession: builder.mutation<Session, CreateSessionRequest>({
      query: (body) => ({ url: '/sessions', method: 'POST', body }),
      invalidatesTags: ['Session'],
    }),
    getProgress: builder.query<ProgressResponse, void>({
      query: () => '/progress',
      providesTags: ['Progress'],
    }),
    getProgressTrend: builder.query<TrendPoint[], void>({
      query: () => '/progress/trend',
      providesTags: ['Progress'],
    }),
  }),
})

export const {
  useGetSessionsQuery,
  useCreateSessionMutation,
  useGetProgressQuery,
  useGetProgressTrendQuery,
} = learnoneApi
```

**Using RTK Query in components:**
```typescript
// Before: 15 lines of useState + useEffect + fetch + error handling
// After:
function SessionList() {
  const { data: sessions, isLoading, error } = useGetSessionsQuery()
  if (isLoading) return <Spinner />
  if (error) return <ErrorMessage />
  return <ul>{sessions.map(s => <SessionItem key={s.id} session={s} />)}</ul>
}
```

RTK Query handles: caching (does not re-fetch if data is fresh), deduplication (two components requesting the same endpoint simultaneously result in one HTTP call), background refetch on window focus, and automatic cache invalidation when a mutation with matching tags runs.

## Week 7 Deliverable

- All `useState` loading/error/data triples replaced with `LoadState<T>` discriminated unions
- Generic `apiRequest<TResponse, TBody>` function replacing per-endpoint functions
- Redux store configured with auth slice and RTK Query
- All data-fetching components using RTK Query hooks
- Zero `useEffect(() => { fetch(...) }, [])` patterns remaining in the codebase
- `npm run type-check` passes with zero errors

---

---

# WEEK 8 — RxJS Reactive Frontend

## What

Add RxJS Observable streams for the two use cases where they are the correct tool: the chat interface (where messages stream in and the user types, creating concurrent events that need coordination) and the dashboard filter bar (where multiple filter inputs should combine into a single debounced API call rather than firing a new request on every keystroke).

## Why

**For the job:** RxJS appears explicitly on many frontend and full-stack job descriptions, particularly at companies with complex real-time UIs — dashboards, trading platforms, live collaboration tools. Most React developers have never used it. Understanding *when* to use RxJS (event coordination over time) vs when to use Redux (shared state) is a senior-level judgment that almost no junior demonstrates.

**For the project:** The progress dashboard currently fires a new API call immediately every time any filter changes. With three filter inputs (date range start, date range end, topic), this means a user adjusting the date range fires 6 API calls (3 keystrokes × 2 fields) before they finish typing. RxJS `combineLatest` + `debounceTime(300)` reduces this to 1 call, fired 300ms after the user stops adjusting.

## How

### The Core Mental Model

An Observable is a stream of values over time. Unlike a Promise (one value, once), an Observable can emit zero or more values, at any time, until it completes or errors. The power is in combining and transforming streams with operators.

```
time ──────────────────────────────────►
user typing: "pyt" "pyth" "pytho" "python"
                 │       │        │       │
   debounceTime(300ms)  only emit after 300ms quiet
                                         │
                                   "python" → API call
```

### Search with `switchMap`

The chat search and topic filter use a search input. Without `switchMap`:
1. User types "py" → API call A starts
2. User types "pyt" → API call B starts
3. API call A returns (slow network) → renders "py" results, overwriting "pyt" results

This is a race condition. `switchMap` cancels API call A the moment the user types another character — only the most recent call ever completes.

Create `frontend/src/hooks/useSearch.ts`:
```typescript
import { useState, useEffect } from 'react'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged, switchMap, catchError, of } from 'rxjs/operators'

export function useSearch<T>(
  searchFn: (query: string) => Promise<T>,
  debounceMs = 300
) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const subject = new Subject<string>()
    const subscription = subject.pipe(
      debounceTime(debounceMs),
      distinctUntilChanged(),
      switchMap((q) => {
        setIsLoading(true)
        return from(searchFn(q)).pipe(catchError(() => of(null)))
      })
    ).subscribe((result) => {
      setResults(result)
      setIsLoading(false)
    })

    subject.next(query)
    return () => subscription.unsubscribe()  // cleanup prevents memory leaks
  }, [query])

  return { query, setQuery, results, isLoading }
}
```

### Dashboard Filters with `combineLatest`

The progress dashboard has three filters: `startDate`, `endDate`, `topicSlug`. Each can change independently. The API should be called with all three values combined, but only 300ms after the last change.

Create `frontend/src/hooks/useProgressFilters.ts`:
```typescript
import { BehaviorSubject, combineLatest } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'

const startDate$ = new BehaviorSubject<string>('')
const endDate$ = new BehaviorSubject<string>('')
const topic$ = new BehaviorSubject<string>('')

const filters$ = combineLatest([startDate$, endDate$, topic$]).pipe(
  debounceTime(300),
  distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
)

export function useProgressFilters() {
  const [filters, setFilters] = useState({ startDate: '', endDate: '', topic: '' })

  useEffect(() => {
    const sub = filters$.subscribe(([startDate, endDate, topic]) => {
      setFilters({ startDate, endDate, topic })
    })
    return () => sub.unsubscribe()
  }, [])

  return {
    filters,
    setStartDate: (v: string) => startDate$.next(v),
    setEndDate: (v: string) => endDate$.next(v),
    setTopic: (v: string) => topic$.next(v),
  }
}
```

`BehaviorSubject` is both an Observable and an Observer — it has a current value and emits that value to any new subscriber immediately. `combineLatest` emits the latest value from all three subjects whenever any one of them emits. The `debounceTime(300)` ensures the combined emission waits 300ms after the last individual change before firing.

Pass `filters` from `useProgressFilters()` to an RTK Query hook with `skip: !filters.startDate` to avoid firing before filters are set.

### When RxJS vs When Redux

This distinction is a common interview question:

- **Use Redux** when you need shared state across components, when you need cache invalidation, or when you need the Redux DevTools time-travel debugging. Data that lives in the application and is shown in multiple places simultaneously.
- **Use RxJS** when you need to coordinate events over time — debouncing, cancelling stale requests, combining multiple input streams. Input handling, WebSocket message streams, real-time data pipelines.

In LearnOne: session data, user data, quiz state → Redux. Search inputs, filter combinations, WebSocket message streams → RxJS.

## Week 8 Deliverable

- `useSearch` hook using `switchMap` + `debounceTime` applied to any search input in the app
- `useProgressFilters` hook using `combineLatest` + `BehaviorSubject` for the progress dashboard filters
- Zero `useEffect(() => { fetch(...) }, [dependency])` patterns for search or filter handling
- All Observable subscriptions have `return () => subscription.unsubscribe()` cleanup
- The progress dashboard fires exactly one API call when the user adjusts filters, not one per keystroke

---

---

# WEEK 9 — Multi-Tenancy + WebSockets

## What

Add organisation-level multi-tenancy to the database and backend: every row in every table belongs to a tenant, PostgreSQL row-level security policies enforce isolation at the database level, and the FastAPI request chain propagates the tenant identity automatically. Replace the chat's polling mechanism with a persistent WebSocket connection.

## Why

**For the job:** Multi-tenancy is the architectural pattern that defines SaaS. Being able to implement it correctly — especially using PostgreSQL RLS rather than just application-level filtering — demonstrates the kind of database security thinking that most junior engineers never encounter. Every SaaS company deals with this. WebSockets show you understand the difference between request-response and full-duplex communication, a core systems concept.

**For the project:** Currently every user's data is completely visible to every other user if they know the right user_id. There are no ownership checks at the database level. This is a security hole. RLS closes it permanently — the database itself refuses to return another tenant's data even if application code has a bug.

## How

### Multi-Tenancy Design Choice

Three strategies exist (as covered in the original curriculum doc). For LearnOne:

**Row-level isolation** is the right choice because:
- Single database (fits Supabase free tier)
- Simpler migrations
- PostgreSQL RLS provides database-level enforcement as a safety net
- LearnOne's tenants (organisations/teams) do not have compliance requirements for separate databases

The trade-off: a catastrophic application bug that bypasses RLS could theoretically leak data. The risk is low because RLS is enforced by PostgreSQL's query planner, not application code.

### Database Changes

New Flyway migration `V10__multi_tenancy.sql`:

```sql
-- Add organisations table
CREATE TABLE organisations (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add org_id to users
ALTER TABLE users ADD COLUMN org_id BIGINT REFERENCES organisations(id);

-- Add org_id to all tenant-scoped tables
ALTER TABLE learning_sessions ADD COLUMN org_id BIGINT REFERENCES organisations(id);
ALTER TABLE concept_reviews    ADD COLUMN org_id BIGINT REFERENCES organisations(id);
ALTER TABLE knowledge_nodes    ADD COLUMN org_id BIGINT REFERENCES organisations(id);
ALTER TABLE user_memories      ADD COLUMN org_id BIGINT REFERENCES organisations(id);
ALTER TABLE quizzes            ADD COLUMN org_id BIGINT REFERENCES organisations(id);

-- Enable RLS on all tenant-scoped tables
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_reviews   ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_nodes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes           ENABLE ROW LEVEL SECURITY;

-- Create RLS policies: each table only visible to its org
CREATE POLICY sessions_org_isolation ON learning_sessions
    USING (org_id = current_setting('app.current_org_id')::BIGINT);

CREATE POLICY reviews_org_isolation ON concept_reviews
    USING (org_id = current_setting('app.current_org_id')::BIGINT);

CREATE POLICY nodes_org_isolation ON knowledge_nodes
    USING (org_id = current_setting('app.current_org_id')::BIGINT);

CREATE POLICY memories_org_isolation ON user_memories
    USING (org_id = current_setting('app.current_org_id')::BIGINT);

CREATE POLICY quizzes_org_isolation ON quizzes
    USING (org_id = current_setting('app.current_org_id')::BIGINT);
```

`current_setting('app.current_org_id')` reads a PostgreSQL session variable. Before every query, the backend sets this variable to the authenticated user's `org_id`. The RLS policy then automatically filters every query on that table to only return rows matching that org_id.

### Tenant Context in FastAPI

Add `org_id` to the JWT payload when a user logs in.

Create a FastAPI dependency `get_tenant_db` that:
1. Calls `get_current_user` to authenticate the JWT
2. Extracts `org_id` from the user record
3. Gets a database connection
4. Executes `SET app.current_org_id = :org_id` on that connection
5. Yields the connection (all subsequent queries on this connection are RLS-filtered)

```python
async def get_tenant_db(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.execute(text("SET app.current_org_id = :org_id"), {"org_id": current_user.org_id})
    try:
        yield db
    finally:
        db.execute(text("RESET app.current_org_id"))
```

Replace `db: Session = Depends(get_db)` with `db: Session = Depends(get_tenant_db)` in every router that handles tenant data.

**Why this is safe:** Even if a developer forgets to add the `org_id` filter in a query, the PostgreSQL RLS policy will add it automatically. The application cannot return another tenant's data even with a buggy query.

### WebSocket Chat

**Current chat flow:** Frontend polls `GET /api/sessions/{id}/messages` every 2 seconds. This is 30 HTTP requests per minute per open chat window, and the chat response still has up to 2 seconds of latency after Claude finishes generating.

**WebSocket flow:**
1. Frontend connects: `const ws = new WebSocket('wss://api.learnone.dev/api/sessions/{id}/ws')`
2. User sends a message: `ws.send(JSON.stringify({ content: "..." }))`
3. Backend receives the message, calls Claude, streams the response tokens back as they arrive
4. Frontend receives each token as a separate WebSocket message and appends it to the UI
5. No polling. No 2-second lag. The response appears character-by-character as Claude generates it.

Add to `app/routers/chat.py`:
```python
from fastapi import WebSocket, WebSocketDisconnect

@router.websocket("/api/sessions/{session_id}/ws")
async def chat_websocket(
    session_id: int,
    websocket: WebSocket,
    token: str = Query(...),  # token passed as query param since WS headers are limited
    db: Session = Depends(get_db)
):
    current_user = await get_current_user_from_token(token, db)
    await websocket.accept()
    active_websocket_connections.inc()  # prometheus gauge from Week 1
    try:
        while True:
            data = await websocket.receive_json()
            user_message = data.get("content", "")
            # ... same chat processing logic as before ...
            response = run_claude(prompt)
            await websocket.send_json({
                "type": "message",
                "role": "assistant",
                "content": response
            })
    except WebSocketDisconnect:
        active_websocket_connections.dec()
```

On the frontend, replace the chat's polling `useEffect` with:
```typescript
useEffect(() => {
  const ws = new WebSocket(`wss://api.learnone.dev/api/sessions/${sessionId}/ws?token=${token}`)
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    dispatch(learnoneApi.util.updateQueryData('getMessages', sessionId, (draft) => {
      draft.push(msg)
    }))
  }
  return () => ws.close()
}, [sessionId])
```

## Week 9 Deliverable

- `V10__multi_tenancy.sql` migration applied, RLS policies active on all 5 tables
- `get_tenant_db` dependency applied to all tenant-scoped endpoints
- Integration test verifying User A cannot see User B's sessions even when querying directly
- Chat migrated from polling to WebSocket — messages appear without page refresh
- Grafana `active_websocket_connections` gauge panel added to dashboard
- Organisation registration endpoint: `POST /api/auth/register` accepts optional `org_name`, creates org if provided

---

---

# WEEK 10 — Pub/Sub + BigQuery + Polish

## What

Replace the Redis Pub/Sub preview from Week 4 with Cloud Pub/Sub for durable event delivery. Add a BigQuery table and a Pub/Sub consumer that writes analytics events to it. Polish the UI to production-quality: a landing page, responsive design, loading skeletons, and error boundaries. Record a demo video. Update all documentation.

## Why

**For the job:** Pub/Sub event-driven architecture shows you understand decoupled systems — a concept that separates junior from senior thinking. "When a lesson completes, three things happen: analytics are recorded, the review queue is updated, and the mastery score is recalculated — but none of them happen in the HTTP request, and a failure in any one of them does not affect the others." That is a senior architecture sentence. BigQuery shows analytical thinking. UI polish shows you care about the product, not just the code.

**For the project:** The analytics layer does not exist yet. Right now there is no way to answer "how many lessons has this user completed this week?" or "which concepts have the lowest mastery across all users?". BigQuery makes this queryable in seconds.

## How

### Cloud Pub/Sub

**What it is:** A fully managed message queue where publishers write messages to a topic, and subscribers pull from subscriptions attached to that topic. Messages are durably stored for 7 days. If the subscriber is down, messages queue up and are delivered when it recovers — nothing is lost.

This is architecturally different from Redis Pub/Sub, which is fire-and-forget. If no subscriber is listening when a Redis Pub/Sub message is published, it is lost.

**Topics to create:**
- `learnone-lesson-completed` — published when a chat response is received
- `learnone-review-recorded` — published when SM-2 review is completed
- `learnone-quiz-passed` — published when a quiz score exceeds threshold

Replace `app/events.py` to use the Google Cloud Pub/Sub client:
```python
from google.cloud import pubsub_v1
import json

publisher = pubsub_v1.PublisherClient()

def publish_event(topic_id: str, event_type: str, payload: dict):
    topic_path = publisher.topic_path(settings.gcp_project, topic_id)
    data = json.dumps({"type": event_type, "payload": payload, "timestamp": datetime.utcnow().isoformat()})
    publisher.publish(topic_path, data.encode("utf-8"))
```

### BigQuery Analytics Layer

Create a BigQuery dataset `learnone_analytics` with table `events`:
```sql
CREATE TABLE learnone_analytics.events (
    event_id      STRING NOT NULL,
    event_type    STRING NOT NULL,
    user_id       INT64,
    org_id        INT64,
    session_id    INT64,
    concept_slug  STRING,
    mastery_score FLOAT64,
    occurred_at   TIMESTAMP NOT NULL
)
PARTITION BY DATE(occurred_at)
CLUSTER BY org_id, event_type
```

`PARTITION BY DATE(occurred_at)` means queries that filter `WHERE occurred_at >= '2026-01-01'` only scan the relevant partitions — not the entire table. `CLUSTER BY org_id, event_type` sorts rows within each partition so queries filtering by org and event type skip entire data blocks.

Create a Pub/Sub subscriber as a separate Python worker `backend/workers/analytics_consumer.py`:
```python
from google.cloud import pubsub_v1, bigquery
import json

subscriber = pubsub_v1.SubscriberClient()
bq_client = bigquery.Client()

def callback(message: pubsub_v1.subscriber.message.Message):
    data = json.loads(message.data.decode("utf-8"))
    row = {
        "event_id": message.message_id,
        "event_type": data["type"],
        "user_id": data["payload"].get("user_id"),
        "org_id": data["payload"].get("org_id"),
        "session_id": data["payload"].get("session_id"),
        "concept_slug": data["payload"].get("concept_slug"),
        "mastery_score": data["payload"].get("mastery_score"),
        "occurred_at": data["timestamp"],
    }
    errors = bq_client.insert_rows_json("learnone_analytics.events", [row])
    if not errors:
        message.ack()

subscription_path = subscriber.subscription_path(PROJECT, "learnone-events-bq-sub")
streaming_pull_future = subscriber.subscribe(subscription_path, callback=callback)
streaming_pull_future.result()
```

Deploy this as a separate Kubernetes Deployment (a "worker") alongside the API. It runs continuously, consuming events. If it crashes, Kubernetes restarts it and Pub/Sub redelivers unacknowledged messages.

### Analytics Endpoints

Add `GET /api/analytics/weekly-activity` using the BigQuery client from the Play backend:
```python
query = """
    SELECT
        DATE_TRUNC(occurred_at, WEEK) AS week,
        event_type,
        COUNT(*) AS event_count
    FROM learnone_analytics.events
    WHERE user_id = @user_id
      AND occurred_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 8 WEEK)
    GROUP BY week, event_type
    ORDER BY week DESC
"""
```

Use this to power the progress trend chart — now backed by BigQuery instead of Postgres aggregation.

### UI Polish

**Landing Page (`frontend/src/pages/Landing.tsx`):**
A public-facing page at `/` for users who are not logged in. It should convey:
1. What LearnOne is (one sentence)
2. How it works (three steps with icons: Enter a topic → AI generates your curriculum → Practice with spaced repetition)
3. A live demo or screenshot
4. Sign up / Log in buttons

This is critical for the portfolio — when a recruiter clicks the live URL, they should immediately understand what they are looking at. A login page with no context communicates nothing.

**Loading Skeletons:**
Replace every spinner with skeleton screens — grey placeholder boxes in the shape of the content that will appear. Skeletons feel faster because the layout does not shift when content loads; spinners feel slow because nothing is visible until the load completes.

Install `react-loading-skeleton` and replace `if (isLoading) return <Spinner />` with a skeleton shaped like the content.

**Error Boundaries:**
React error boundaries catch JavaScript errors in component trees and show a fallback UI instead of a blank white screen. Wrap the main app router with:
```typescript
class AppErrorBoundary extends React.Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return <ErrorPage message="Something went wrong. We've been notified." />
    }
    return this.props.children
  }
}
```

**Responsive Design:**
The app should work on mobile. Review every page at 375px width (iPhone SE viewport). The chat interface is the hardest — ensure the input stays at the bottom of the viewport and messages are scrollable above it.

### Demo Video

Record a 2-minute Loom video showing:
1. The landing page and sign-up flow (30s)
2. Creating a session, seeing the AI-generated curriculum (30s)
3. The chat — asking questions, seeing mastery update in real time via WebSocket (30s)
4. The Grafana dashboard with live metrics (30s)

Upload to Loom (free). Link it in the README as "**Watch the demo →**" with a thumbnail. This is the most-clicked link on any portfolio project.

## Week 10 Deliverable

- Cloud Pub/Sub topics created, events published from all write endpoints
- `analytics_consumer.py` worker deployed to GKE, writing events to BigQuery
- `GET /api/analytics/weekly-activity` endpoint returning BigQuery-backed data
- Landing page live at `https://app.learnone.dev`
- Loading skeletons replacing all spinners
- Error boundary wrapping the entire React app
- All pages functional at 375px mobile viewport
- 2-minute Loom demo video linked in README

---

---

# Final State

At the end of Week 10, LearnOne is:

```
internet
    │
    ▼
Cloudflare (CDN + DDoS + DNS)
    │
    ▼
GKE Ingress (HTTPS, TLS via cert-manager)
    │
    ├──► learnone-frontend (nginx, React SPA)
    │
    └──► learnone-api (FastAPI, 2 replicas)
              │
              ├── PostgreSQL (Supabase) — transactional data, RLS-enforced
              ├── Redis (Upstash) — cache-aside, sorted set review queue
              ├── Claude CLI subprocess — AI tutoring
              └── Cloud Pub/Sub (publisher)
                        │
                        └──► learnone-worker (analytics consumer)
                                    │
                                    └── BigQuery — analytics warehouse

Monitoring stack (GKE):
    ├── Prometheus (scrapes /metrics every 15s)
    └── Grafana (public read-only dashboard)

CI/CD:
    git push → GitHub Actions → tests → Docker build → Artifact Registry → GKE rolling deploy
```

## Resume Description

> **LearnOne** — AI-powered adaptive learning platform with spaced repetition and real-time tutoring. Python FastAPI backend deployed on Google Kubernetes Engine via GitHub Actions CI/CD. PostgreSQL with row-level security for multi-tenant data isolation, Redis cache-aside (>85% hit rate), real-time chat via WebSockets, analytics pipeline via Cloud Pub/Sub → BigQuery. Monitored with Grafana/Prometheus (public dashboard). React/TypeScript frontend with Redux Toolkit, RTK Query, and RxJS reactive filter streams. Full test suite with CI integration tests against real database.
>
> [live.learnone.dev](https://app.learnone.dev) · [grafana.learnone.dev](https://grafana.learnone.dev) · [github.com/you/learnone](https://github.com)

That is 120 words. Every claim is verifiable by clicking a link.

---

## Week-by-Week Difficulty Curve

```
Week 1  ████░░░░░░  Structured logging — familiar Python, new libraries
Week 2  ████░░░░░░  Grafana setup — Docker Compose, config files
Week 3  ██████░░░░  PostgreSQL depth — window functions require deliberate practice
Week 4  █████░░░░░  Redis patterns — cache-aside is a new mental model
Week 5  ████████░░  GKE deployment — most YAML, most new concepts, biggest payoff
Week 6  ███████░░░  CI/CD + tests — GitHub Actions YAML + writing real tests
Week 7  █████░░░░░  TypeScript + Redux — builds on existing knowledge
Week 8  ██████░░░░  RxJS — new mental model, small surface area
Week 9  ███████░░░  Multi-tenancy + WebSockets — security-sensitive, test carefully
Week 10 █████░░░░░  Pub/Sub + BigQuery + polish — synthesis, no new paradigms
```

The hardest single day is Day 1 of Week 5: writing the first Kubernetes YAML, debugging why a Pod is in `CrashLoopBackOff`, and understanding the Deployment → Service → Ingress chain. Spend extra time here. Everything else in Kubernetes is variations on this foundation.

---

## What to Show, in Order, to a Recruiter

1. **The live URL** — they can use it immediately
2. **The Grafana dashboard** — shows it is real infrastructure, not a hobby project
3. **The GitHub Actions tab** — green CI/CD badges on every commit
4. **The `k8s/` directory** — Kubernetes manifests signal production engineering
5. **`backend/tests/`** — tests signal professional workflow
6. **The demo video** — 2 minutes covers everything above faster than any explanation
