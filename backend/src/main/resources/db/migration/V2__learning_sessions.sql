CREATE TABLE IF NOT EXISTS learning_sessions (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        VARCHAR(255),
    learning_goal TEXT NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON learning_sessions(user_id);
