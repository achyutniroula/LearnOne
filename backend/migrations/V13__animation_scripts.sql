CREATE TABLE IF NOT EXISTS repo_stories (
    id            BIGSERIAL PRIMARY KEY,
    repo_id       BIGINT NOT NULL UNIQUE REFERENCES indexed_repos(id) ON DELETE CASCADE,
    story         JSONB NOT NULL DEFAULT '{}',
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status        VARCHAR NOT NULL DEFAULT 'pending',
    error         TEXT
);

CREATE TABLE IF NOT EXISTS animation_scripts (
    id            BIGSERIAL PRIMARY KEY,
    session_id    BIGINT NOT NULL UNIQUE REFERENCES learning_sessions(id) ON DELETE CASCADE,
    repo_id       BIGINT NOT NULL REFERENCES indexed_repos(id),
    script        JSONB NOT NULL DEFAULT '{}',
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status        VARCHAR NOT NULL DEFAULT 'pending',
    error         TEXT
);

CREATE INDEX IF NOT EXISTS repo_stories_repo_id_idx      ON repo_stories(repo_id);
CREATE INDEX IF NOT EXISTS animation_scripts_repo_id_idx ON animation_scripts(repo_id);
