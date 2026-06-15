-- RAG knowledge base: one row per code/doc chunk from the LearnOne repo.
-- Embedding dimension 768 matches gemini-embedding-001.
-- ivfflat index with lists=50 is appropriate for tens of thousands of chunks.
CREATE TABLE IF NOT EXISTS repo_chunks (
    id          BIGSERIAL PRIMARY KEY,
    file_path   TEXT    NOT NULL,
    chunk_index INTEGER NOT NULL,
    content     TEXT    NOT NULL,
    embedding   vector(768),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS repo_chunks_embedding_idx
    ON repo_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50);
