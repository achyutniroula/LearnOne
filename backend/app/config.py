from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    db_url: str
    db_username: str
    db_password: str
    redis_url: str
    jwt_secret: str
    jwt_expiration_ms: int = 86400000
    cohere_api_key: str = ""
    judge0_rapidapi_key: str = ""

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
