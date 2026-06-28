import math, logging
from datetime import date, timedelta
from app.db.supabase import get_client
from app.scrapers.event_grouper import group_into_events

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

# Severity model: convex weights so tragedy beats noise. Level 5 = 40x level 1
# (not 5x as a raw sum makes it). Theory-driven, interpretable.
SEVERITY_WEIGHT = {1: 0.10, 2: 0.30, 3: 0.80, 4: 2.00, 5: 4.00}

RECENT_DAYS = 7
RECENT_BOOST = 1.6

def _corroboration_bonus(c: int) -> float:
    # sub-linear, capped: 1 src->1.00, 5->1.24, 20->1.45
    return 1.0 + 0.15 * math.log(max(c, 1))

# GZ* = 1 - exp(-sum / KAPPA), bounded [0,1]. KAPPA calibrated so an
# Ukraine-class theatre lands ~0.85, leaving headroom below 1.0.
KAPPA = 15.0


def _gz_from_events(events: list, target_date: date) -> float:
    if not events:
        return 0.0
    cutoff_recent = target_date - timedelta(days=RECENT_DAYS)
    total = 0.0
    for ev in events:
        s = max(1, min(5, int(ev.get("severity") or 1)))
        w = SEVERITY_WEIGHT[s]
        d = ev.get("date")
        recent = False
        if d:
            try:
                recent = date.fromisoformat(str(d)[:10]) >= cutoff_recent
            except Exception:
                recent = False
        w *= RECENT_BOOST if recent else 1.0
        w *= _corroboration_bonus(int(ev.get("corroboration") or 1))
        total += w
    return min(1.0 - math.exp(-total / KAPPA), 1.0)


def calculate_ei(region: str, target_date: date = None) -> dict:
    if target_date is None:
        target_date = date.today()
    db = get_client()
    w30 = (target_date - timedelta(days=30)).isoformat()

    rows = db.table("incidents").select("id,date,title,escalation_level") \
        .eq("region", region).gte("date", w30).execute().data

    events = group_into_events(rows)
    gz_raw = _gz_from_events(events, target_date)

    future = (target_date + timedelta(days=14)).isoformat()
    exercises = db.table("exercises").select("scale,rhetoric_score") \
        .eq("region", region).gte("end_date", target_date.isoformat()) \
        .lte("start_date", future).execute().data

    if exercises:
        ex_raw = min(sum(min((e.get("scale") or 5000)/80000.0, 1.0) for e in exercises)/max(len(exercises),1), 1.0)
        rh_vals = [float(e["rhetoric_score"]) for e in exercises if e.get("rhetoric_score") is not None]
        rh_raw = (sum(rh_vals)/len(rh_vals)+1)/2 if rh_vals else 0.5
    else:
        ex_raw = 0.0; rh_raw = 0.5

    baseline = CONFLICT_BASELINE.get(region, 0.05)
    ei = (gz_raw*0.45 + ex_raw*0.35 + baseline*0.20) * 100
    # removed old "*1.15 if >=5 incidents" multiplier — it re-added count bias.

    result = {
        "region": region, "date": target_date.isoformat(),
        "ei_score": round(min(ei, 100.0), 1),
        "gz_score": round(gz_raw*100, 1),
        "ex_score": round(ex_raw*100, 1),
        "rh_score": round(rh_raw*100, 1),
        "incident_count_30d": len(rows),
        "event_count_30d": len(events),
    }
    try:
        db.table("deterrence_index").upsert({
            "region": region, "date": target_date.isoformat(),
            "di_score": result["ei_score"],
            "gz_score": result["gz_score"],
            "ex_score": result["ex_score"],
            "rh_score": result["rh_score"],
        }, on_conflict="region,date").execute()
    except Exception as e:
        logger.warning(f"[ei] upsert {region}: {e}")
    return result


def calculate_di(region, target_date=None):
    return calculate_ei(region, target_date)


def calculate_all_regions() -> list:
    results = []
    for region in REGIONS:
        try:
            r = calculate_ei(region)
            results.append(r)
            logger.info(f"[ei] {region}: {r['ei_score']} "
                        f"({r['event_count_30d']} events / {r['incident_count_30d']} raw)")
        except Exception as e:
            logger.error(f"[ei] {region}: {e}")
    return results
