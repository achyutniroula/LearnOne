CREATE TABLE IF NOT EXISTS user_preferences (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    voice_provider VARCHAR(32)  NOT NULL DEFAULT 'webspeech',
    voice_id       VARCHAR(120),
    voice_rate     REAL         NOT NULL DEFAULT 1.0,
    voice_pitch    REAL         NOT NULL DEFAULT 1.0,
    auto_speak     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
