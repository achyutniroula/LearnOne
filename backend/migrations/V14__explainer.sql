CREATE TABLE IF NOT EXISTS repo_explanations (
    id            BIGSERIAL PRIMARY KEY,
    repo_id       BIGINT NOT NULL REFERENCES indexed_repos(id) ON DELETE CASCADE,
    mode          VARCHAR(16) NOT NULL,
    section       VARCHAR(16) NOT NULL
                  CHECK (section IN ('preface','contents','pipeline','indepth')),
    content       JSONB,
    status        VARCHAR(16) NOT NULL DEFAULT 'pending',
    error         TEXT,
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT repo_explanations_uniq UNIQUE (repo_id, mode, section)
);
CREATE INDEX IF NOT EXISTS repo_explanations_repo_mode_idx ON repo_explanations(repo_id, mode);

DROP TABLE IF EXISTS animation_scripts;
DROP TABLE IF EXISTS repo_stories;
DROP TABLE IF EXISTS curricula;
DROP TABLE IF EXISTS quiz_questions;
DROP TABLE IF EXISTS quizzes;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS concept_reviews;
DROP TABLE IF EXISTS knowledge_nodes;
DROP TABLE IF EXISTS user_memories;
DROP TABLE IF EXISTS learning_sessions;
DROP TABLE IF EXISTS voice_preferences;
DROP TABLE IF EXISTS users;
