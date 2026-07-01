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

# ── GZ saturation: per-region κ (v18 normalization) ─────────────────
#
# v17 and earlier: one global KAPPA=15 for all theatres. With a 28x volume
# spread between regions (Gaza ~417 raw incidents/30d vs Sudan ~15), a single
# κ pins high-volume regions to the ceiling and low-volume ones to the floor
# regardless of dynamics — and adding sources to a region creates a step
# change in GZ that reflects observability, not escalation.
#
# v18: κ_region = NORM_C × trailing_median(30-day load over the past 90 days),
# floored at KAPPA_FLOOR. GZ then measures deviation from the region's own
# observed norm: load == median → GZ = GZ_AT_NORM for every region, so a
# 4-source theatre and a 12-source theatre are comparable by construction.
# Adding sources raises the median together with the signal, so the
# observability step decays over one 90-day recalibration window.
# Cross-region "raw intensity" ordering is carried by CONFLICT_BASELINE.

GZ_AT_NORM = 0.35          # GZ when current load equals the trailing median
NORM_C = 1.0 / -math.log(1.0 - GZ_AT_NORM)   # ≈ 2.32
KAPPA_FLOOR = 3.0          # weight units; protects zero-history regions.
                           # One recent level-4 event (2.0×1.6=3.2) in a dead
                           # theatre → GZ≈0.66: loud, and deliberately so.
BASELINE_WINDOW = 90       # days of history the median is computed over
LOAD_WINDOW = 30           # the load window itself (unchanged from v17)

KAPPA = 15.0               # legacy global κ — kept for reference/tests


def _load_from_events(events: list, target_date: date) -> float:
    """Σ of severity/recency/corroboration weights — the raw 30-day load."""
    if not events:
        return 0.0
    cutoff_recent = target_date - timedelta(days=RECENT_DAYS)
    window_start = target_date - timedelta(days=LOAD_WINDOW)
    total = 0.0
    for ev in events:
        d = ev.get("date")
        ev_date = None
        if d:
            try:
                ev_date = date.fromisoformat(str(d)[:10])
            except Exception:
                ev_date = None
        # respect the load window when the caller passes a wider event set
        if ev_date and (ev_date < window_start or ev_date > target_date):
            continue
        s = max(1, min(5, int(ev.get("severity") or 1)))
        w = SEVERITY_WEIGHT[s]
        recent = bool(ev_date) and ev_date >= cutoff_recent
        w *= RECENT_BOOST if recent else 1.0
        w *= _corroboration_bonus(int(ev.get("corroboration") or 1))
        total += w
    return total


def _median(values: list) -> float:
    if not values:
        return 0.0
    v = sorted(values)
    n = len(v)
    mid = n // 2
    return v[mid] if n % 2 else (v[mid - 1] + v[mid]) / 2.0


def _kappa_for_region(events_120d: list, target_date: date) -> float:
    """
    κ_region from the trailing median of daily 30-day loads over the past
    BASELINE_WINDOW days (days -90..-1 relative to target; today excluded so
    the current spike is measured against the pre-existing norm).
    """
    loads = []
    for d_off in range(1, BASELINE_WINDOW + 1):
        anchor = target_date - timedelta(days=d_off)
        loads.append(_load_from_events(events_120d, anchor))
    med = _median(loads)
    return max(KAPPA_FLOOR, NORM_C * med)


def _gz_from_events(events: list, target_date: date, kappa: float = KAPPA) -> float:
    total = _load_from_events(events, target_date)
    if total <= 0:
        return 0.0
    return min(1.0 - math.exp(-total / kappa), 1.0)


def calculate_ei(region: str, target_date: date = None) -> dict:
    if target_date is None:
        target_date = date.today()
    db = get_client()
    # 120d = 30d load window + 90d baseline window for κ_region
    w120 = (target_date - timedelta(days=LOAD_WINDOW + BASELINE_WINDOW)).isoformat()

    rows = db.table("incidents").select("id,date,title,escalation_level") \
        .eq("region", region).gte("date", w120).lte("date", target_date.isoformat()).execute().data

    events = group_into_events(rows)
    kappa = _kappa_for_region(events, target_date)
    gz_raw = _gz_from_events(events, target_date, kappa=kappa)

    # counts reported for the 30-day window only (matches v17 semantics)
    w30 = target_date - timedelta(days=LOAD_WINDOW)
    def _in30(x):
        try:
            return date.fromisoformat(str(x.get("date"))[:10]) >= w30
        except Exception:
            return False
    rows_30 = [r for r in rows if _in30(r)]
    events_30 = [e for e in events if _in30(e)]

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
        "kappa": round(kappa, 2),
        "incident_count_30d": len(rows_30),
        "event_count_30d": len(events_30),
    }
    try:
        db.table("escalation_index").upsert({
            "region": region, "date": target_date.isoformat(),
            "ei_score": result["ei_score"],
            "gz_score": result["gz_score"],
            "ex_score": result["ex_score"],
            "rh_score": result["rh_score"],
            "methodology_version": "v18",
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
