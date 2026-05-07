CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS embedding vector(1024);
CREATE INDEX IF NOT EXISTS idx_chat_messages_embedding
    ON chat_messages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

CREATE TABLE concept_reviews (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    concept_slug     VARCHAR(160) NOT NULL,
    concept_label    VARCHAR(255) NOT NULL,
    ease_factor      DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    interval_days    INT NOT NULL DEFAULT 1,
    repetitions      INT NOT NULL DEFAULT 0,
    next_review_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reviewed_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, concept_slug)
);
CREATE INDEX idx_concept_reviews_due ON concept_reviews(user_id, next_review_at);
