CREATE TABLE IF NOT EXISTS curricula (
    id           BIGSERIAL PRIMARY KEY,
    session_id   BIGINT NOT NULL UNIQUE REFERENCES learning_sessions(id) ON DELETE CASCADE,
    content      JSONB NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
