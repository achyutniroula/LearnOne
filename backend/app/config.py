from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    db_url: str
    db_username: str
    db_password: str
    redis_url: str
    jwt_secret: str
    jwt_expiration_ms: int = 86400000
    groq_api_key: str = ""
    gemini_api_key: str = ""
    gemini_live_model: str = "gemini-2.5-flash-native-audio-preview-12-2025"
    gemini_thinker_model: str = "gemini-2.5-flash"
    embedding_model: str = "gemini-embedding-001"
    thinker_cooldown_default_secs: int = 60
    github_token: str = ""
    cohere_api_key: str = ""
    judge0_rapidapi_key: str = ""
    voice_provider: str = "webspeech"           # "webspeech" or "elevenlabs"
    elevenlabs_api_key: str = ""
    elevenlabs_default_voice_id: str = "EXAVITQu4vr4xnSDxMaL"  # Rachel

    @property
    def database_url(self) -> str:
        # Convert jdbc URL to psycopg2 URL if needed
        url = self.db_url
        if url.startswith("jdbc:postgresql://"):
            url = url[len("jdbc:"):]
        # Inject credentials
        if "@" not in url:
            proto, rest = url.split("://", 1)
            url = f"{proto}://{self.db_username}:{self.db_password}@{rest}"
        return url

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

settings = Settings()
