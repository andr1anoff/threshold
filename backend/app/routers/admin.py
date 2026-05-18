import logging, os, threading
from fastapi import APIRouter, HTTPException
from app.scrapers.universal_scraper import scrape_all_sources
from app.scrapers.ukraine_osint import scrape_ukraine_osint
from app.scrapers.jme_scraper import scrape_all_exercises
from app.di.calculator import calculate_all_regions
from app.llm.classifier import run_classification_pipeline, generate_narrative, cross_verify_incidents
from app.llm.exercise_classifier import classify_all_exercises, generate_exercise_brief
from app.db.supabase import get_client

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/test-llm")
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

@router.post("/scrape")
async def trigger_scrape():
    db = get_client()
    result = await scrape_all_sources(db)
    ukraine = await scrape_ukraine_osint(db)
    exercises = await scrape_all_exercises(db)
    result["ukraine_osint"] = ukraine.get("inserted", 0)
    result["exercises"] = exercises.get("total", 0)
    return {"status":"done", **result}

@router.post("/scrape/exercises")
async def scrape_exercises_ep():
    return await scrape_all_exercises(get_client())

@router.post("/scrape/reliefweb")
async def scrape_rw():
    from app.scrapers.universal_scraper import scrape_reliefweb
    return {"inserted": await scrape_reliefweb(get_client())}

@router.post("/scrape/ucdp")
async def scrape_ucdp_ep():
    from app.scrapers.universal_scraper import scrape_ucdp
    return {"inserted": await scrape_ucdp(get_client())}

@router.post("/scrape/wikipedia")
async def scrape_wiki():
    from app.scrapers.universal_scraper import scrape_wikipedia
    return {"inserted": await scrape_wikipedia(get_client())}

@router.post("/scrape/un-news")
async def scrape_un():
    from app.scrapers.universal_scraper import scrape_un_news
    return {"inserted": await scrape_un_news(get_client())}

@router.post("/scrape/ukraine")
async def scrape_ua():
    return await scrape_ukraine_osint(get_client())

@router.post("/classify")
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

@router.post("/classify/exercises")
def classify_exercises_ep():
    return {"classified": classify_all_exercises(get_client())}

@router.post("/calculate-ei")
def trigger_ei():
    return {"status":"done","results":calculate_all_regions()}

# Legacy alias
@router.post("/calculate-di")
def trigger_di():
    return {"status":"done","results":calculate_all_regions()}

@router.post("/pipeline")
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
def get_narrative(region: str):
    db = get_client()
    incidents = db.table("incidents").select("title,category,escalation_level,date").eq("region",region).order("date",desc=True).limit(10).execute().data
    exercises = db.table("exercises").select("name,scale,lead_nation,signal_target,exercise_type,domain").eq("region",region).limit(4).execute().data
    if not incidents and not exercises:
        raise HTTPException(status_code=404, detail=f"No data for region '{region}'. Run scrapers first.")
    narrative = generate_narrative(region, incidents, exercises)
    if not narrative:
        raise HTTPException(status_code=502, detail="LLM returned empty response. Check GROQ_API_KEY.")
    return {"region":region,"narrative":narrative}

@router.get("/exercise-brief/{exercise_id}")
def get_exercise_brief(exercise_id: str):
    db = get_client()
    ex = db.table("exercises").select("*").eq("id",exercise_id).execute().data
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    brief = generate_exercise_brief(ex[0])
    return {"exercise":ex[0].get("name"),"brief":brief}

@router.get("/status")
def get_status():
    db = get_client()
    return {
        "incidents": db.table("incidents").select("id",count="exact").execute().count,
        "exercises": db.table("exercises").select("id",count="exact").execute().count,
        "ei_records": db.table("deterrence_index").select("id",count="exact").execute().count if True else 0,
        "sources": ["RSS×13","ReliefWeb/OCHA","Guardian","Wikipedia","UN News×6","UCDP","GDELT","DeepState","CIT","SHAPE NATO","Defense.gov"],
    }
