CREATE TABLE IF NOT EXISTS chat_messages (
    id          BIGSERIAL PRIMARY KEY,
    session_id  BIGINT NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL,
    content     TEXT NOT NULL,
    token_count INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_session_id ON chat_messages(session_id);
