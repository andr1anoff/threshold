"""
Centralized rate limiter for all scrapers.
Prevents blacklisting by enforcing per-domain delays and exponential backoff.
"""
import asyncio
import time
from collections import defaultdict

# Minimum seconds between requests to same domain
DOMAIN_DELAYS = {
    "api.gdeltproject.org": 7.0,
    "api.reliefweb.int": 1.0,
    "nato.int": 3.0,
    "defense.gov": 3.0,
    "understandingwar.org": 2.0,
    "acleddata.com": 2.0,
    "deepstatemap.live": 5.0,
    "citeam.org": 3.0,
    "mash.ru": 4.0,
    "default": 2.0,
}

_last_request: dict[str, float] = defaultdict(float)
_lock = asyncio.Lock()


def _get_domain(url: str) -> str:
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc
    except Exception:
        return "default"


async def wait_for_domain(url: str):
    """Wait appropriate time before making a request to this domain."""
    domain = _get_domain(url)
    delay = DOMAIN_DELAYS.get(domain, DOMAIN_DELAYS["default"])
    async with _lock:
        elapsed = time.monotonic() - _last_request[domain]
        if elapsed < delay:
            await asyncio.sleep(delay - elapsed)
        _last_request[domain] = time.monotonic()


async def fetch_with_backoff(client, url: str, max_retries: int = 3, **kwargs) -> dict | None:
    """Fetch URL with rate limiting and exponential backoff on failure."""
    await wait_for_domain(url)
    headers = kwargs.pop("headers", {})
    headers.setdefault("User-Agent", "ThresholdBot/1.0 (JFKI FU Berlin research; +https://threshold-lyart.vercel.app)")
    headers.setdefault("Accept", "application/rss+xml, application/xml, application/json, text/html")

    for attempt in range(max_retries):
        try:
            resp = await client.get(url, headers=headers, timeout=15, follow_redirects=True, **kwargs)
            if resp.status_code == 429:
                wait = 30 * (2 ** attempt)
                print(f"[rate_limit] 429 on {url}, waiting {wait}s")
                await asyncio.sleep(wait)
                continue
            if resp.status_code >= 500:
                await asyncio.sleep(5 * (2 ** attempt))
                continue
            return resp
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"[fetch] Failed {url}: {e}")
                return None
            await asyncio.sleep(3 * (2 ** attempt))
    return None
