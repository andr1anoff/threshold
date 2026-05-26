import math, logging
from datetime import date, timedelta
from app.db.supabase import get_client

logger = logging.getLogger(__name__)

REGIONS = [
    "Gaza & Middle East","Ukraine","Sudan","South China Sea","Taiwan Strait",
    "Yemen","Sahel","Korean Peninsula","Myanmar","DRC","Syria","Somalia",
    "Baltic","Haiti","Ethiopia","South Caucasus","Libya","Kosovo","Arctic","Mozambique"
]

CONFLICT_BASELINE = {
    "Gaza & Middle East":0.30,"Ukraine":0.28,"Sudan":0.26,"Yemen":0.22,"Sahel":0.20,
    "Myanmar":0.18,"DRC":0.18,"Syria":0.16,"Somalia":0.16,"Haiti":0.14,"Ethiopia":0.14,"Mozambique":0.12,
    "South China Sea":0.08,"Taiwan Strait":0.08,"Korean Peninsula":0.06,"Baltic":0.06,
    "South Caucasus":0.05,"Libya":0.10,"Kosovo":0.04,"Arctic":0.03,
}

def _log_score(count: int, max_ref: int = 60) -> float:
    """log(1+x) — standard for sparse event data, avoids log(0)"""
    if count <= 0: return 0.0
    return min(math.log(1 + count) / math.log(1 + max_ref), 1.0)

def calculate_ei(region: str, target_date: date = None) -> dict:
    if target_date is None: target_date = date.today()
    db = get_client()
    w7  = (target_date - timedelta(days=7)).isoformat()
    w30 = (target_date - timedelta(days=30)).isoformat()

    inc_30 = db.table("incidents").select("date,escalation_level").eq("region",region).gte("date",w30).execute().data
    inc_7  = [i for i in inc_30 if i.get("date","") >= w7]

    score_30 = sum(int(e.get("escalation_level") or 1) for e in inc_30)
    score_7  = sum(int(e.get("escalation_level") or 1) for e in inc_7) * 2
    gz_raw   = _log_score(score_30 + score_7, max_ref=60)

    future = (target_date + timedelta(days=14)).isoformat()
    exercises = db.table("exercises").select("scale,rhetoric_score").eq("region",region).gte("end_date",target_date.isoformat()).lte("start_date",future).execute().data

    if exercises:
        ex_raw = min(sum(min((e.get("scale") or 5000)/80000.0,1.0) for e in exercises)/max(len(exercises),1),1.0)
        rh_vals = [float(e["rhetoric_score"]) for e in exercises if e.get("rhetoric_score") is not None]
        rh_raw  = (sum(rh_vals)/len(rh_vals)+1)/2 if rh_vals else 0.5
    else:
        ex_raw = 0.0; rh_raw = 0.5

    # Weights: GZ 45%, EX 35%, BASELINE 20%
    baseline = CONFLICT_BASELINE.get(region, 0.05)
    ei = (gz_raw*0.45 + ex_raw*0.35 + baseline*0.20) * 100

    if len(inc_30) >= 5:   ei = min(ei*1.15, 100)
    elif len(inc_30) >= 2: ei = min(ei*1.05, 100)

    result = {
        "region": region, "date": target_date.isoformat(),
        "ei_score": round(min(ei, 100.0), 1),
        "gz_score": round(gz_raw*100, 1),
        "ex_score": round(ex_raw*100, 1),
        "rh_score": round(rh_raw*100, 1),
        "incident_count_30d": len(inc_30),
    }
    try:
        db.table("deterrence_index").upsert({
            "region": region, "date": target_date.isoformat(),
            "di_score": result["ei_score"],  # column stays di_score in DB for compatibility
            "gz_score": result["gz_score"],
            "ex_score": result["ex_score"],
            "rh_score": result["rh_score"],
        }).execute()
    except Exception as e:
        logger.warning(f"[ei] upsert {region}: {e}")
    return result

# Alias for backward compat
def calculate_di(region, target_date=None): return calculate_ei(region, target_date)

def calculate_all_regions() -> list:
    results = []
    for region in REGIONS:
        try:
            r = calculate_ei(region)
            results.append(r)
            logger.info(f"[ei] {region}: {r['ei_score']} ({r['incident_count_30d']} events)")
        except Exception as e:
            logger.error(f"[ei] {region}: {e}")
    return results
