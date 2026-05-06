import json
import redis.asyncio as aioredis
from app.config import get_settings

settings = get_settings()
_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def close_redis():
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None


async def set_test_cancelled(test_id: str):
    r = await get_redis()
    await r.set(f"test:cancel:{test_id}", "1", ex=3600)


async def is_test_cancelled(test_id: str) -> bool:
    r = await get_redis()
    return await r.exists(f"test:cancel:{test_id}") > 0


async def set_test_progress(test_id: str, completed: int, total: int, errors: int):
    r = await get_redis()
    await r.set(
        f"test:progress:{test_id}",
        json.dumps({"completed": completed, "total": total, "errors": errors}),
        ex=3600,
    )


async def get_test_progress(test_id: str) -> dict | None:
    r = await get_redis()
    raw = await r.get(f"test:progress:{test_id}")
    return json.loads(raw) if raw else None


async def clear_test_keys(test_id: str):
    r = await get_redis()
    await r.delete(f"test:cancel:{test_id}", f"test:progress:{test_id}")
