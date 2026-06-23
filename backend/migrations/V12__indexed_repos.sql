-- Repo index tracking table
CREATE TABLE IF NOT EXISTS indexed_repos (
    id              BIGSERIAL PRIMARY KEY,
    repo_url        TEXT NOT NULL UNIQUE,
    owner           VARCHAR(255) NOT NULL,
    repo_name       VARCHAR(255) NOT NULL,
    default_branch  VARCHAR(255) NOT NULL DEFAULT 'main',
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    file_count      INT,
    chunk_count     INT,
    error_message   TEXT,
    indexed_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rebuild repo_chunks with repo_id FK (drops V10 version which had no FK)
DROP TABLE IF EXISTS repo_chunks;
CREATE TABLE repo_chunks (
    id              BIGSERIAL PRIMARY KEY,
    repo_id         BIGINT NOT NULL REFERENCES indexed_repos(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL,
    chunk_index     INT NOT NULL,
    content         TEXT NOT NULL,
    token_estimate  INT,
    embedding       vector(768),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS repo_chunks_repo_id_idx
    ON repo_chunks(repo_id);

CREATE INDEX IF NOT EXISTS repo_chunks_embedding_idx
    ON repo_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50);

-- Link sessions to indexed repos (SET NULL so sessions survive repo deletion)
ALTER TABLE learning_sessions
    ADD COLUMN IF NOT EXISTS repo_id BIGINT REFERENCES indexed_repos(id) ON DELETE SET NULL;
