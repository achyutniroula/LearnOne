-- Switch embeddings from Gemini (768-dim, external API) to local fastembed
-- bge-small-en-v1.5 (384-dim, in-process). Existing 768-dim vectors are
-- incompatible with the new dimension and must be cleared; affected repos
-- are reset to 'pending' so they get re-indexed with the new model.
TRUNCATE TABLE repo_chunks;
ALTER TABLE repo_chunks ALTER COLUMN embedding TYPE vector(384);

-- updated_at is backdated so the app's staleness-recovery check (repos.py
-- _is_stale, 3-minute threshold) unconditionally treats every reset row as
-- safe to re-index on next submit, regardless of when this migration runs
-- relative to a row's last real activity.
UPDATE indexed_repos
SET status = 'pending',
    file_count = NULL,
    total_chunks = NULL,
    chunk_count = NULL,
    indexed_at = NULL,
    error_message = NULL,
    updated_at = NOW() - INTERVAL '10 minutes';

TRUNCATE TABLE repo_explanations;
