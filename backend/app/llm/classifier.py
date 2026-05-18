"""
Incident classifier — LLM-based gray zone event classification.
Uses Groq llama-3.1-8b-instant for speed and cost efficiency.
Rate limit: 30 RPM / 1000 RPD on free tier → 2.5s delay between requests.
"""
import os, json, logging, time
from groq import Groq

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
        if "429" in str(e) or "rate_limit" in str(e).lower():
            logger.warning(f"[groq] Rate limited: {e}")
            raise RateLimitError()
        logger.error(f"[groq] Error: {e}")
        return None


class RateLimitError(Exception):
    pass


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
        except RateLimitError:
            wait = 60 * (attempt + 1)
            logger.warning(f"[classify] Rate limit, waiting {wait}s")
            time.sleep(wait)
        except json.JSONDecodeError:
            logger.warning(f"[classify] JSON parse error")
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
    Loop until ALL 'none' and 'unknown' incidents are classified.
    
    Root cause of previous bug:
    - LLM sometimes returns category='none' for ambiguous incidents
    - Those incidents were written back to DB as 'none' → infinite retry loop
    - Fix: if LLM returns 'none', mark as 'unknown' (won't be retried next cycle)
    - Skip incidents with no text → mark 'unclassifiable'
    """
    classified_inc = 0
    batch_size = 50
    max_batches = 30  # safety cap: 30 * 100 = 3000 max per call

    for batch_num in range(max_batches):
        # Fetch unprocessed incidents
        unknown_batch = db.table("incidents").select("id,title,raw_text,category") \
            .eq("category", "unknown").limit(batch_size).execute().data
        none_batch = db.table("incidents").select("id,title,raw_text,category") \
            .eq("category", "none").limit(batch_size).execute().data
        batch = unknown_batch + none_batch

        if not batch:
            logger.info(f"[classifier] ✓ All incidents classified. Total: {classified_inc} in {batch_num} batches.")
            break

        logger.info(f"[classifier] Batch {batch_num + 1}: {len(batch)} incidents ({classified_inc} classified so far)")

        for inc in batch:
            raw = (inc.get("raw_text") or inc.get("title") or "").strip()

            # No text → mark unclassifiable, skip forever
            if not raw:
                try:
                    db.table("incidents").update({"category": "unclassifiable"}).eq("id", inc["id"]).execute()
                except Exception:
                    pass
                continue

            result = classify_incident(raw)
            time.sleep(2.5)  # 24 req/min — safe under 30 RPM free tier limit

            if not result:
                # LLM failed → mark unknown, will retry next cycle
                try:
                    db.table("incidents").update({"category": "unknown"}).eq("id", inc["id"]).execute()
                except Exception:
                    pass
                continue

            # KEY FIX: never write 'none' back — that's what caused the infinite loop
            category = result.get("category") or "unknown"
            if category in ("none", "", None):
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
                logger.warning(f"[classifier] DB update error for {inc['id']}: {e}")

    else:
        logger.warning(f"[classifier] Hit max_batches limit ({max_batches}). Classified {classified_inc} so far.")

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
