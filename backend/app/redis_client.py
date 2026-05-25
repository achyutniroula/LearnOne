import redis
from .config import settings

_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(settings.redis_url, decode_responses=True)
    return _client


def rate_limit_check(user_id: int, limit: int = 30) -> bool:
    """Returns True if under limit, False if exceeded."""
    r = get_redis()
    key = f"learnone:rate:{user_id}:messages"
    count = r.incr(key)
    if count == 1:
        r.expire(key, 3600)
    return count <= limit
