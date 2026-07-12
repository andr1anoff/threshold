import logging, os, threading
import time
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Header, Depends, Request
from app.scrapers.universal_scraper import scrape_all_sources
from app.scrapers.ukraine_osint import scrape_ukraine_osint
from app.scrapers.jme_scraper import scrape_all_exercises
from app.di.calculator import calculate_all_regions
from app.llm.classifier import run_classification_pipeline, generate_narrative, cross_verify_incidents, resweep_unclassifiable
from app.llm.exercise_classifier import classify_all_exercises, generate_exercise_brief
from app.llm.providers import DailyLimitError, RateLimitError, provider_health
from app.db.supabase import get_client

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Public narrative generation: cheap in-process guard ──────────────
# Variant B (public generation restored) but not naked: a per-IP token
# bucket stops a crawler from walking all 20 regions and burning the day's
# Groq budget in one pass. Legit humans click one region at a time and
# never notice. In-process (resets on redeploy) — good enough for a single
# Railway instance; if it ever scales out, move this to Supabase.
_NARRATIVE_HITS: dict = defaultdict(list)
_NARRATIVE_WINDOW = 3600      # 1 hour
_NARRATIVE_MAX = 8           # max fresh generations per IP per hour

def _rate_ok(ip: str) -> bool:
    now = time.time()
    hits = [t for t in _NARRATIVE_HITS[ip] if now - t < _NARRATIVE_WINDOW]
    _NARRATIVE_HITS[ip] = hits
    if len(hits) >= _NARRATIVE_MAX:
        return False
    hits.append(now)
    return True


def _key_ok(key: str) -> bool:
    expected = os.getenv("ADMIN_API_KEY")
    return bool(expected) and key == expected


def require_admin(x_admin_key: str = Header(default="")):
    """
    Guard for mutating/expensive endpoints. Applied per-endpoint (not router-wide)
    because the frontend calls GET /narrative and /status without a key.
    If ADMIN_API_KEY is unset, everything is denied — fail closed, not open.
    """
    if not os.getenv("ADMIN_API_KEY"):
        raise HTTPException(503, "ADMIN_API_KEY not configured on server")
    if not _key_ok(x_admin_key):
        raise HTTPException(401, "Invalid or missing X-Admin-Key header")


ADMIN = [Depends(require_admin)]

@router.get("/test-llm", dependencies=ADMIN)
async def test_llm():
    try:
        from groq import Groq
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        r = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role":"user","content":"Reply with just: OK"}],
            max_tokens=5,
        )
        return {"status":"ok","response":r.choices[0].message.content}
    except Exception as e:
        logger.exception(f"LLM test failed: {e}")
        return {"status":"error","detail":str(e)}

@router.post("/scrape", dependencies=ADMIN)
async def trigger_scrape():
    db = get_client()
    result = await scrape_all_sources(db)
    ukraine = await scrape_ukraine_osint(db)
    exercises = await scrape_all_exercises(db)
    result["ukraine_osint"] = ukraine.get("inserted", 0)
    result["exercises"] = exercises.get("total", 0)
    return {"status":"done", **result}

@router.post("/scrape/exercises", dependencies=ADMIN)
async def scrape_exercises_ep():
    return await scrape_all_exercises(get_client())

@router.post("/scrape/reliefweb", dependencies=ADMIN)
async def scrape_rw():
    from app.scrapers.universal_scraper import scrape_reliefweb
    return {"inserted": await scrape_reliefweb(get_client())}

@router.post("/scrape/ucdp", dependencies=ADMIN)
async def scrape_ucdp_ep():
    from app.scrapers.universal_scraper import scrape_ucdp
    return {"inserted": await scrape_ucdp(get_client())}

@router.post("/scrape/wikipedia", dependencies=ADMIN)
async def scrape_wiki():
    from app.scrapers.universal_scraper import scrape_wikipedia
    return {"inserted": await scrape_wikipedia(get_client())}

@router.post("/scrape/un-news", dependencies=ADMIN)
async def scrape_un():
    from app.scrapers.universal_scraper import scrape_un_news
    return {"inserted": await scrape_un_news(get_client())}

@router.post("/scrape/ukraine", dependencies=ADMIN)
async def scrape_ua():
    return await scrape_ukraine_osint(get_client())

@router.post("/classify", dependencies=ADMIN)
def trigger_classify():
    def _run():
        db = get_client()
        run_classification_pipeline(db)
        classify_all_exercises(db)
        cross_verify_incidents(db)
    t = threading.Thread(target=_run, daemon=True)
    t.start()
    return {"status": "started", "message": "Classification running in background"}

@router.get("/classify/status")
def classify_status():
    db = get_client()
    none_count    = db.table("incidents").select("id", count="exact").eq("category", "none").execute().count
    unknown_count = db.table("incidents").select("id", count="exact").eq("category", "unknown").execute().count
    return {"remaining": none_count + unknown_count, "none": none_count, "unknown": unknown_count}

@router.post("/classify/exercises", dependencies=ADMIN)
def classify_exercises_ep():
    return {"classified": classify_all_exercises(get_client())}

@router.post("/calculate-ei", dependencies=ADMIN)
def trigger_ei():
    return {"status":"done","results":calculate_all_regions()}

# Legacy alias
@router.post("/calculate-di", dependencies=ADMIN)
def trigger_di():
    return {"status":"done","results":calculate_all_regions()}

@router.post("/pipeline", dependencies=ADMIN)
async def full_pipeline():
    db = get_client()
    scraped = await scrape_all_sources(db)
    ukraine = await scrape_ukraine_osint(db)
    exercises = await scrape_all_exercises(db)
    classified = run_classification_pipeline(db)
    ex_classified = classify_all_exercises(db)
    ei = calculate_all_regions()
    return {"status":"done","scraped":scraped,"ukraine":ukraine,"exercises":exercises,"classified":classified,"exercises_classified":ex_classified,"ei_regions":len(ei)}

@router.get("/narrative/{region}")
def get_narrative(region: str, request: Request, force: bool = False, x_admin_key: str = Header(default="")):
    from app.cache.brief_cache import get_cached, set_cached, invalidate
    admin = _key_ok(x_admin_key)
    # force refresh is admin-only (bypasses cache); public force is downgraded
    if force and not admin:
        force = False

    # Cache-first: served to everyone, costs nothing.
    if not force:
        cached = get_cached(region)
        if cached:
            return {"region": region, "narrative": cached, "cached": True}
    else:
        invalidate(region)

    # Cache miss -> fresh generation. Public callers pass an IP rate limit;
    # admin bypasses it. This keeps generation public (variant B) without
    # letting a crawler drain the Groq budget.
    if not admin:
        ip = (request.client.host if request.client else "unknown")
        if not _rate_ok(ip):
            # Serve stale cache if we have any; otherwise ask them to wait.
            cached = get_cached(region)
            if cached:
                return {"region": region, "narrative": cached, "cached": True}
            raise HTTPException(status_code=429, detail="Too many briefs generated recently. Try again shortly.")

    db = get_client()
    incidents = db.table("incidents").select("title,category,escalation_level,date").eq("region",region).order("date",desc=True).limit(10).execute().data
    exercises = db.table("exercises").select("name,scale,lead_nation,signal_target,exercise_type,domain").eq("region",region).neq("announcement_status","archived-manual").limit(4).execute().data
    if not incidents and not exercises:
        raise HTTPException(status_code=404, detail=f"No recent open-source data for \"{region}\" yet.")

    # generate_narrative raises now instead of returning "". If we don't catch
    # these, FastAPI emits a bare 500 with no body, the frontend can't parse it,
    # and the spinner turns forever. Translate each failure into something the
    # user can act on.
    try:
        narrative = generate_narrative(region, incidents, exercises)
    except DailyLimitError as e:
        logger.error(f"[narrative] all providers down for {region}: {e}")
        raise HTTPException(
            status_code=503,
            detail="Brief generation is temporarily unavailable — no LLM provider is responding. "
                   "This is a Threshold-side problem, not a gap in the data.",
        )
    except RateLimitError:
        raise HTTPException(
            status_code=429,
            detail="Provider rate limit reached. Try again in a minute.",
        )

    if not narrative:
        raise HTTPException(status_code=502, detail="LLM returned an empty response.")
    set_cached(region, narrative)
    return {"region": region, "narrative": narrative, "cached": False}

@router.get("/exercise-brief/{exercise_id}")
def get_exercise_brief(exercise_id: str, x_admin_key: str = Header(default="")):
    from app.cache.brief_cache import get_cached, set_cached
    cache_key = f"exbrief:{exercise_id}"
    cached = get_cached(cache_key)
    if cached:
        return {"exercise_id": exercise_id, "brief": cached, "cached": True}
    if not _key_ok(x_admin_key):
        # Same quota rule as /narrative: no key, no fresh LLM call.
        raise HTTPException(status_code=404, detail="Brief not generated yet.")
    db = get_client()
    ex = db.table("exercises").select("*").eq("id",exercise_id).execute().data
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    brief = generate_exercise_brief(ex[0])
    set_cached(cache_key, brief)
    return {"exercise": ex[0].get("name"), "brief": brief, "cached": False}

@router.get("/status")
def get_status():
    db = get_client()
    return {
        "incidents": db.table("incidents").select("id",count="exact").execute().count,
        "exercises": db.table("exercises").select("id",count="exact").execute().count,
        "ei_records": db.table("escalation_index").select("id",count="exact").execute().count if True else 0,
        "sources": ["RSS×38","ReliefWeb/OCHA","Guardian","Wikipedia","UN News×6","UCDP","GDELT","DeepState","CIT","SHAPE NATO","Defense.gov"],
    }

@router.post("/resweep", dependencies=ADMIN)
def resweep_ep(limit: int = 200):
    """Reset stale 'unclassifiable' incidents (with text) back to 'unknown' for retry."""
    return resweep_unclassifiable(get_client(), limit=limit)

@router.get("/stats/categories")
def category_stats():
    """Per-category incident counts — makes the 'unclassifiable' black hole visible."""
    db = get_client()
    cats = ["cyber","airspace","maritime","disinfo","proxy","economic",
            "military","diplomatic","civilian","unknown","unclassifiable","none"]
    out = {}
    for c in cats:
        try:
            out[c] = db.table("incidents").select("id", count="exact").eq("category", c).execute().count
        except Exception:
            out[c] = None
    return {"categories": out}
