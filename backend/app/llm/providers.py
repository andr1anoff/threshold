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


class ProviderError(Exception):
    """
    A provider failed for a reason that is NOT a rate limit: bad/expired key,
    5xx, deprecated model, network error.

    This class exists because of the 2026-07-12 outage. Before it, _call_groq
    swallowed every non-429 failure and returned None. call_llm only caught
    DailyLimitError, so a 401 (expired GROQ_API_KEY) never reached the fallback
    path — it just returned None, and every brief on the site died with
    "LLM returned an empty response". The fallback existed and did nothing.

    Now: any provider failure is raised, and call_llm treats ALL of them as a
    reason to try the next provider. Groq dying no longer takes the site down.
    """
    def __init__(self, provider: str, detail: str):
        self.provider = provider
        self.detail = detail
        super().__init__(f"[{provider}] {detail}")


# tier -> model per provider
GROQ_MODELS = {
    "fast":  "llama-3.1-8b-instant",
    "smart": "llama-3.3-70b-versatile",
}
OPENROUTER_MODELS = {
    "fast":  "meta-llama/llama-3.1-8b-instruct:free",
    "smart": "meta-llama/llama-3.3-70b-instruct:free",
}

_groq_client = None


def _get_groq():
    global _groq_client
    if _groq_client is None:
        from groq import Groq
        _groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _groq_client


def _call_groq(prompt: str, tier: str, max_tokens: int, temperature: float) -> str | None:
    """Returns text, or raises RateLimitError / DailyLimitError / ProviderError."""
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
        # Everything else — 401 expired key, 404 deprecated model, 5xx, network.
        # Previously this returned None and silently killed the request.
        logger.error(f"[groq] error: {e}")
        raise ProviderError("groq", err)


def _call_openrouter(prompt: str, tier: str, max_tokens: int, temperature: float) -> str | None:
    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        raise ProviderError("openrouter", "OPENROUTER_API_KEY not set — no fallback configured")
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
    except ProviderError:
        raise
    except Exception as e:
        logger.error(f"[openrouter] error: {e}")
        raise ProviderError("openrouter", str(e))


# Sticky flag: once Groq TPD is exhausted, skip it for the rest of this process
# (resets on next scheduled run — GH Actions spawns a fresh process each time).
_groq_exhausted = False

# Sticky flag: once Groq's credentials are proven bad (401/403), stop hammering
# it for the life of this process. A dead key does not heal within a request.
_groq_dead = False


def call_llm(prompt: str, tier: str = "fast", max_tokens: int = 200,
             temperature: float = 0.1, interactive: bool = False) -> str | None:
    """
    Try Groq; on ANY failure fall through to OpenRouter (if configured).

    The distinction that matters: before 2026-07-12 this only fell through on
    DailyLimitError. An expired GROQ_API_KEY (401) returned None instead, so the
    fallback never fired and every brief on the site broke. Now every Groq
    failure mode — TPD, bad key, deprecated model, 5xx, network — routes to the
    fallback. Groq is a preference, not a dependency.

    interactive=True — a human is watching a spinner. Retry backoff on the
    fallback drops from 15/30/45s (90s total, unacceptable for a web request)
    to a single 3s attempt. Batch callers (the nightly pipeline) leave this
    False and keep the patient retries, because nobody is waiting on them.

    Raises:
      RateLimitError  — transient RPM limit; caller may retry
      DailyLimitError — every provider is unusable; caller aborts
    """
    global _groq_exhausted, _groq_dead

    if not (_groq_exhausted or _groq_dead):
        try:
            return _call_groq(prompt, tier, max_tokens, temperature)

        except DailyLimitError:
            _groq_exhausted = True
            if not os.getenv("OPENROUTER_API_KEY"):
                raise  # no fallback configured — preserve old abort behaviour
            logger.warning("[providers] Groq TPD exhausted — falling back to OpenRouter")

        except ProviderError as e:
            # Bad credentials will not fix themselves. Stop retrying Groq in
            # this process so we don't burn a round-trip on every subsequent call.
            if "401" in e.detail or "403" in e.detail or "api_key" in e.detail.lower():
                _groq_dead = True
                logger.error("[providers] Groq credentials rejected — check GROQ_API_KEY. "
                             "Falling back to OpenRouter for the rest of this process.")
            else:
                logger.warning(f"[providers] Groq failed ({e.detail[:120]}) — trying OpenRouter")

            if not os.getenv("OPENROUTER_API_KEY"):
                raise DailyLimitError(
                    f"Groq failed and no OPENROUTER_API_KEY is configured: {e.detail[:200]}"
                )

    # Fallback path
    attempts   = 1 if interactive else 3
    backoff    = (3,) if interactive else (15, 30, 45)
    last = None
    for attempt in range(attempts):
        try:
            return _call_openrouter(prompt, tier, max_tokens, temperature)
        except RateLimitError:
            last = "rate limited"
            if attempt + 1 >= attempts:
                break
            wait = backoff[attempt]
            logger.warning(f"[openrouter] 429, retry in {wait}s ({attempt+1}/{attempts})")
            time.sleep(wait)
        except ProviderError as e:
            last = e.detail
            logger.error(f"[providers] OpenRouter failed: {e.detail[:160]}")
            break  # not a rate limit — retrying will not help

    raise DailyLimitError(f"All LLM providers unavailable. Last error: {last or 'unknown'}")


def provider_health() -> dict:
    """Cheap introspection for /api/admin/status — shows which providers are live."""
    return {
        "groq_key_present": bool(os.getenv("GROQ_API_KEY")),
        "groq_dead": _groq_dead,
        "groq_tpd_exhausted": _groq_exhausted,
        "openrouter_configured": bool(os.getenv("OPENROUTER_API_KEY")),
    }
