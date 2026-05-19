"""
Incident classifier — LLM-based gray zone event classification.
Uses Groq llama-3.1-8b-instant for speed and cost efficiency.
Rate limit: 30 RPM / 1000 RPD on free tier → 2.5s delay between requests.
"""
import os, json, logging, time
from groq import Groq

# Must match incidents_category_check constraint in Supabase exactly
VALID_CATEGORIES = frozenset({
    'cyber', 'airspace', 'maritime', 'disinfo', 'proxy', 'economic',
    'military', 'diplomatic', 'civilian',
    'unknown', 'unclassifiable', 'none',
})

logger = logging.getLogger(__name__)

FAST_MODEL = "llama-3.1-8b-instant"
SMART_MODEL = "llama-3.3-70b-versatile"

CLASSIFY_PROMPT = """Classify this gray zone incident. Return ONLY valid JSON, no explanation.

Text: {text}

JSON schema:
{{
  "category": "cyber|airspace|maritime|disinfo|proxy|economic|military|diplomatic|civilian|unknown",
  "escalation_level": 1-5,
  "region": "region name or null",
  "actors": ["actor1"],
  "summary": "one sentence"
}}

Escalation levels:
1 = rhetoric, threats, diplomatic pressure
2 = troop movements, buildup, sanctions
3 = cyberattack, airspace violation, naval incident
4 = attack with casualties, airstrike
5 = full-scale combat, mass casualties"""

RHETORIC_PROMPT = """Analyze the military signaling intent of this exercise. Return ONLY valid JSON.

Text: {text}

JSON:
{{
  "rhetoric_score": -1.0 to 1.0,
  "signal_target": "country or organization"
}}"""


class RateLimitError(Exception):
    """RPM limit — retry after backoff."""
    pass

class DailyLimitError(Exception):
    """TPD exhausted — stop pipeline entirely for today."""
    pass


def _call_groq(prompt: str, model: str = FAST_MODEL, max_tokens: int = 200) -> str | None:
    """Single Groq API call with error handling."""
    try:
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        r = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=0.1,
        )
        return r.choices[0].message.content.strip()
    except Exception as e:
        err = str(e)
        if "429" in err or "rate_limit" in err.lower():
            # Distinguish TPD (tokens per day) from RPM
            if "tokens per day" in err.lower() or "TPD" in err:
                logger.error("[groq] Daily token limit (TPD) exhausted — aborting pipeline")
                raise DailyLimitError()
            logger.warning(f"[groq] Rate limited (RPM): {e}")
            raise RateLimitError()
        logger.error(f"[groq] Error: {e}")
        return None


def classify_incident(text: str) -> dict | None:
    """Classify a single incident. Returns dict or None on failure."""
    prompt = CLASSIFY_PROMPT.format(text=text[:600])
    for attempt in range(3):
        try:
            raw = _call_groq(prompt)
            if not raw:
                return None
            raw = raw.replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except DailyLimitError:
            raise  # propagate up to pipeline → abort
        except RateLimitError:
            wait = 60 * (attempt + 1)
            logger.warning(f"[classify] RPM limit, waiting {wait}s (attempt {attempt+1}/3)")
            time.sleep(wait)
        except json.JSONDecodeError:
            logger.warning("[classify] JSON parse error")
            return None
        except Exception as e:
            logger.error(f"[classify] {e}")
            return None
    return None


def analyze_rhetoric(text: str) -> dict | None:
    """Analyze exercise rhetoric score."""
    try:
        raw = _call_groq(RHETORIC_PROMPT.format(text=text[:400]), model=FAST_MODEL)
        if not raw:
            return None
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)
    except Exception as e:
        logger.error(f"[rhetoric] {e}")
        return None


def generate_narrative(region: str, incidents: list, exercises: list) -> str:
    """Generate LLM analytical narrative for a region."""
    inc_text = "\n".join(f"- [{i.get('category','?')}] {i.get('title','')}" for i in incidents[:8])
    ex_text = "\n".join(f"- {e.get('name','')} ({e.get('signal_target','')})" for e in exercises[:3])
    prompt = f"""You are a senior analyst at JFKI, Freie Universität Berlin.
Write a 2-3 paragraph analytical assessment (150-200 words) of the current escalation dynamics in {region}.

Recent incidents:
{inc_text or 'No recent incidents indexed.'}

Active exercises:
{ex_text or 'No exercises in current window.'}

Focus on: observable patterns, actor intent, escalation trajectory.
Be precise. Do not speculate beyond the evidence. Academic tone."""
    try:
        raw = _call_groq(prompt, model=SMART_MODEL, max_tokens=400)
        return raw or ""
    except Exception as e:
        logger.error(f"[narrative] {e}")
        return ""


def cross_verify_incidents(db) -> dict:
    """Count incidents verified by multiple sources (same region+date)."""
    from datetime import date, timedelta
    from collections import defaultdict
    window = (date.today() - timedelta(days=7)).isoformat()
    incidents = db.table("incidents").select("id,region,date").gte("date", window).execute().data
    groups = defaultdict(list)
    for inc in incidents:
        groups[f"{inc.get('region','')}_{inc.get('date','')}"].append(inc)
    verified = sum(len(g) for g in groups.values() if len(g) >= 2)
    return {"verified": verified}


def run_classification_pipeline(db) -> dict:
    """
    Classify all 'none' and 'unknown' incidents via LLM.

    Key fixes vs previous version:
    1. VALID_CATEGORIES allowlist → bad LLM output never hits DB constraint
    2. DB write failure → mark 'unclassifiable', don't retry forever
    3. DailyLimitError (TPD) → abort pipeline immediately, not spin all night
    """
    classified_inc = 0
    skipped_inc = 0
    batch_size = 50
    max_batches = 30

    for batch_num in range(max_batches):
        unknown_batch = db.table("incidents").select("id,title,raw_text,category") \
            .eq("category", "unknown").limit(batch_size).execute().data
        none_batch = db.table("incidents").select("id,title,raw_text,category") \
            .eq("category", "none").limit(batch_size).execute().data
        batch = unknown_batch + none_batch

        if not batch:
            logger.info(f"[classifier] ✓ Done. classified={classified_inc} skipped={skipped_inc} batches={batch_num}")
            break

        logger.info(f"[classifier] Batch {batch_num + 1}: {len(batch)} incidents")

        for inc in batch:
            raw = (inc.get("raw_text") or inc.get("title") or "").strip()

            if not raw:
                db.table("incidents").update({"category": "unclassifiable"}).eq("id", inc["id"]).execute()
                skipped_inc += 1
                continue

            try:
                result = classify_incident(raw)
            except DailyLimitError:
                logger.error(f"[classifier] TPD exhausted after {classified_inc} classified — stopping")
                return {"incidents": classified_inc, "exercises": 0, "aborted": "tpd_exhausted"}

            time.sleep(2.5)

            if not result:
                # LLM failed all retries — leave as 'unknown', will retry next scheduled cycle
                continue

            # Allowlist guard: if LLM returns anything not in DB constraint → 'unknown'
            category = (result.get("category") or "").strip().lower()
            if category not in VALID_CATEGORIES or category in ("none", "unclassifiable"):
                category = "unknown"

            esc_level = max(1, min(5, int(result.get("escalation_level", 2) or 2)))

            update = {"category": category, "escalation_level": esc_level}
            if result.get("actors"):
                update["actors"] = [a for a in result["actors"] if a]
            if result.get("region") and result["region"] not in ("Other", "none", None):
                update["region"] = result["region"]
            if result.get("summary"):
                update["description"] = result["summary"]

            try:
                db.table("incidents").update(update).eq("id", inc["id"]).execute()
                classified_inc += 1
            except Exception as e:
                # DB write failed (e.g. constraint) — mark unclassifiable so we never retry
                logger.warning(f"[classifier] DB error for {inc['id']}, marking unclassifiable: {e}")
                try:
                    db.table("incidents").update({"category": "unclassifiable"}).eq("id", inc["id"]).execute()
                except Exception:
                    pass
                skipped_inc += 1

    else:
        logger.warning(f"[classifier] Hit max_batches ({max_batches}). classified={classified_inc}")

    # Also classify exercise rhetoric
    classified_ex = 0
    try:
        unanalyzed = db.table("exercises").select("id,name,statements").is_("rhetoric_score", "null").limit(20).execute()
        for ex in unanalyzed.data:
            stmts = ex.get("statements") or {}
            text = stmts.get("raw_summary") or ex.get("name") or ""
            if not text:
                continue
            result = analyze_rhetoric(text)
            if not result:
                continue
            try:
                db.table("exercises").update({
                    "rhetoric_score": max(-1.0, min(1.0, float(result.get("rhetoric_score", 0) or 0))),
                    "signal_target": result.get("signal_target", "Unknown"),
                }).eq("id", ex["id"]).execute()
                classified_ex += 1
            except Exception as e:
                logger.warning(f"[classifier] ex update error: {e}")
            time.sleep(0.5)
    except Exception as e:
        logger.error(f"[classifier] exercise rhetoric error: {e}")

    logger.info(f"[classifier] Done. incidents={classified_inc} exercises={classified_ex}")
    return {"incidents": classified_inc, "exercises": classified_ex}
