CREATE TABLE quizzes (
    id           BIGSERIAL PRIMARY KEY,
    session_id   BIGINT NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id)
);

CREATE TABLE quiz_questions (
    id             BIGSERIAL PRIMARY KEY,
    quiz_id        BIGINT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question       TEXT NOT NULL,
    type           VARCHAR(20) NOT NULL DEFAULT 'MCQ',
    choices        JSONB,
    correct_answer TEXT NOT NULL,
    explanation    TEXT,
    sort_order     SMALLINT NOT NULL DEFAULT 0
);
