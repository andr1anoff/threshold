"""
providers.py — unified LLM call layer with provider fallback.

Chain: Groq (primary, fast+cheap) -> OpenRouter (fallback, free-tier models).
Rationale: Groq free tier TPD exhaustion used to abort the whole pipeline
(see the 944k-token night). With a fallback, TPD exhaustion on Groq degrades
to a slower provider instead of stopping classification for the day.

Env:
  GROQ_API_KEY        — required for primary
  OPENROUTER_API_KEY  — optional; if unset, behavior is identical to before
                        (DailyLimitError propagates and aborts the pipeline)

Usage:
  from app.llm.providers import call_llm, RateLimitError, DailyLimitError
  raw = call_llm(prompt, tier="fast", max_tokens=200)   # str | None
"""
import os, logging, time
import httpx

logger = logging.getLogger(__name__)


class RateLimitError(Exception):
    """RPM limit — caller may retry after backoff."""


class DailyLimitError(Exception):
    """All providers exhausted for today — caller should abort pipeline."""


# tier -> model per provider
GROQ_MODELS = {
    "fast":  "llama-3.1-8b-instant",
    "smart": "llama-3.3-70b-versatile",
}

# OpenRouter's free model roster ROTS. Models get renamed, retired, or moved to
# paid without notice. On 2026-07-12 the "fast" slug below was already dead:
#   meta-llama/llama-3.1-8b-instruct:free  -> 404, no endpoints for this model
# which meant the classifier's fallback path was silently broken and would have
# 404'd at 06:00 UTC in GitHub Actions with nobody watching.
#
# "openrouter/free" is OpenRouter's own auto-router: it picks whichever free
# model is currently available and capable of the request. Pinning to it instead
# of a specific slug means the fallback survives the next round of rot.
#
# Trade-off, stated plainly: we no longer control WHICH free model answers, so
# output quality on the fallback path can vary. That is the correct trade for a
# fallback — a slightly worse brief beats a 404. The primary path (Groq) stays
# pinned to exact models, where quality is controlled.
OPENROUTER_MODELS = {
    "fast":  "openrouter/free",
    "smart": "openrouter/free",
}

# If you ever want to pin again, these were alive on 2026-07-12:
#   smart: meta-llama/llama-3.3-70b-instruct:free
#   fast:  meta-llama/llama-3.2-3b-instruct:free   (3B — weak for classification)
# Check https://openrouter.ai/api/v1/models before trusting either.

_groq_client = None


def _get_groq():
    global _groq_client
    if _groq_client is None:
        from groq import Groq
        _groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _groq_client


def _call_groq(prompt: str, tier: str, max_tokens: int, temperature: float) -> str | None:
    """Returns text, or raises RateLimitError / DailyLimitError. None = hard failure."""
    try:
        r = _get_groq().chat.completions.create(
            model=GROQ_MODELS[tier],
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return r.choices[0].message.content.strip()
    except (RateLimitError, DailyLimitError):
        raise
    except Exception as e:
        err = str(e)
        if "429" in err or "rate_limit" in err.lower():
            if "tokens per day" in err.lower() or "TPD" in err:
                logger.error("[groq] TPD exhausted")
                raise DailyLimitError()
            logger.warning(f"[groq] RPM limited: {e}")
            raise RateLimitError()
        logger.error(f"[groq] error: {e}")
        return None


def _call_openrouter(prompt: str, tier: str, max_tokens: int, temperature: float) -> str | None:
    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        return None
    try:
        resp = httpx.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {key}",
                "HTTP-Referer": "https://threshold-osint.com",
                "X-Title": "Threshold",
            },
            json={
                "model": OPENROUTER_MODELS[tier],
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            timeout=45.0,
        )
        if resp.status_code == 429:
            logger.warning("[openrouter] rate limited")
            raise RateLimitError()
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except RateLimitError:
        raise
    except Exception as e:
        logger.error(f"[openrouter] error: {e}")
        return None


# Sticky flag: once Groq TPD is exhausted, skip it for the rest of this process
# (resets on next scheduled run — GH Actions spawns a fresh process each time).
_groq_exhausted = False


def call_llm(prompt: str, tier: str = "fast", max_tokens: int = 200,
             temperature: float = 0.1) -> str | None:
    """
    Try Groq; on TPD exhaustion fall through to OpenRouter (if configured).
    Raises:
      RateLimitError  — transient RPM limit on current provider; caller retries
      DailyLimitError — Groq TPD gone AND no fallback available; caller aborts
    """
    global _groq_exhausted

    if not _groq_exhausted:
        try:
            return _call_groq(prompt, tier, max_tokens, temperature)
        except DailyLimitError:
            _groq_exhausted = True
            if not os.getenv("OPENROUTER_API_KEY"):
                raise  # old behavior: abort pipeline
            logger.warning("[providers] Groq TPD exhausted — falling back to OpenRouter")

    # Fallback path
    for attempt in range(3):
        try:
            return _call_openrouter(prompt, tier, max_tokens, temperature)
        except RateLimitError:
            wait = 15 * (attempt + 1)
            logger.warning(f"[openrouter] 429, retry in {wait}s ({attempt+1}/3)")
            time.sleep(wait)
    raise DailyLimitError()  # both providers dead
