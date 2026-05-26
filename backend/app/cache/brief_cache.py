"""
Brief cache — in-memory TTL cache for LLM narratives.
Saves Groq API calls: re-uses generated brief for 1 hour per region.
"""
import time
import logging

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[str, float]] = {}  # region -> (narrative, expires_at)
TTL = 3600  # 1 hour


def get_cached(region: str) -> str | None:
    entry = _cache.get(region)
    if entry and time.time() < entry[1]:
        logger.info(f"[brief_cache] HIT for {region}")
        return entry[0]
    if entry:
        del _cache[region]  # expired
    return None


def set_cached(region: str, narrative: str) -> None:
    _cache[region] = (narrative, time.time() + TTL)
    logger.info(f"[brief_cache] SET for {region} (TTL={TTL}s)")


def invalidate(region: str) -> None:
    _cache.pop(region, None)
