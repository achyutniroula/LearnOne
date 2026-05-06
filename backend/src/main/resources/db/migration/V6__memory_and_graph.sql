CREATE TABLE user_memories (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key               VARCHAR(120) NOT NULL,
    value             TEXT NOT NULL,
    category          VARCHAR(40) NOT NULL,
    confidence        SMALLINT NOT NULL DEFAULT 50,
    source_session_id BIGINT REFERENCES learning_sessions(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, key)
);
CREATE INDEX idx_user_memories_user ON user_memories(user_id, confidence DESC);

CREATE TABLE knowledge_nodes (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    concept_slug    VARCHAR(160) NOT NULL,
    concept_label   VARCHAR(255) NOT NULL,
    mastery         SMALLINT NOT NULL DEFAULT 0,
    exposures       INT NOT NULL DEFAULT 1,
    last_session_id BIGINT REFERENCES learning_sessions(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, concept_slug)
);
CREATE INDEX idx_knowledge_nodes_user_mastery ON knowledge_nodes(user_id, mastery DESC);
