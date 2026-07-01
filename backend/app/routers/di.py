from fastapi import APIRouter
from app.db.supabase import get_client
from app.di.calculator import CONFLICT_BASELINE

router = APIRouter()

@router.get("/global")
def global_ei():
    db = get_client()
    try:
        data = db.table("escalation_index").select("region,ei_score,gz_score,ex_score,rh_score,date").order("date",desc=True).limit(60).execute()
        seen = set()
        results = []
        for row in data.data:
            r = row["region"]
            if r not in seen:
                seen.add(r)
                results.append(row)
        return {"data": results}
    except Exception as e:
        return {"data": [], "error": str(e)}

@router.get("/region/{region}")
def region_ei(region: str):
    db = get_client()
    try:
        data = db.table("escalation_index").select("*").eq("region",region).order("date",desc=True).limit(1).execute()
        if data.data:
            row = data.data[0]
            # baseline is a per-region constant (not stored per-row); expose it
            # so the frontend can show the real BASE component, not a guess.
            row["base_score"] = round(CONFLICT_BASELINE.get(region, 0.05) * 100, 1)
            return row
        return {}
    except Exception as e:
        return {"error": str(e)}

@router.get("/history/{region}")
def region_history(region: str, days: int = 90):
    """Returns all available history for sparkline. Returns empty if no history yet."""
    db = get_client()
    try:
        from datetime import date, timedelta
        since = (date.today() - timedelta(days=days)).isoformat()
        data = db.table("escalation_index").select("date,ei_score").eq("region",region).gte("date",since).order("date").execute()
        result = []
        for row in data.data:
            result.append({"date": row["date"], "ei_score": row["ei_score"]})
        return {"data": result, "count": len(result)}
    except Exception as e:
        return {"data": [], "count": 0}

@router.get("/trend/{region}")
def region_trend(region: str):
    db = get_client()
    from datetime import date, timedelta
    today = date.today().isoformat()
    week_ago = (date.today() - timedelta(days=7)).isoformat()
    try:
        now  = db.table("escalation_index").select("ei_score").eq("region", region).eq("date", today).execute().data
        prev = db.table("escalation_index").select("ei_score").eq("region", region).eq("date", week_ago).execute().data
        if now and prev:
            delta = round(now[0]["ei_score"] - prev[0]["ei_score"], 1)
            return {"region": region, "trend": delta}
    except Exception:
        pass
    return {"region": region, "trend": None}

@router.get("/trends")
def all_trends():
    """Returns trends for all regions. Uses most recent vs oldest available record.
    Returns None for regions with only one data point (no trend possible yet)."""
    db = get_client()
    try:
        # Get all records - we'll compute trend from available data
        all_data = db.table("escalation_index").select("region,ei_score,date").order("date").execute().data
        if not all_data:
            return {"trends": {}, "data_points": 0}

        # Group by region
        by_region = {}
        for row in all_data:
            r = row["region"]
            if r not in by_region:
                by_region[r] = []
            by_region[r].append(row)

        trends = {}
        for region, rows in by_region.items():
            if len(rows) < 2:
                trends[region] = None  # Not enough data yet
            else:
                oldest = rows[0]["ei_score"]
                newest = rows[-1]["ei_score"]
                delta = round(newest - oldest, 1)
                trends[region] = delta

        total_points = len(all_data)
        return {"trends": trends, "data_points": total_points}
    except Exception:
        return {"trends": {}, "data_points": 0}

@router.get("/overview")
def overview(days: int = 30):
    """
    One call that powers the Home page with REAL data:
    per region — latest EI, 7-day delta, and up to `days` of history for
    sparklines. Replaces the seed-generated fake sparklines and trends.
    """
    db = get_client()
    from datetime import date, timedelta
    since = (date.today() - timedelta(days=days)).isoformat()
    week_ago = (date.today() - timedelta(days=7)).isoformat()
    try:
        rows = db.table("escalation_index").select("region,ei_score,date") \
            .gte("date", since).order("date").execute().data
    except Exception as e:
        return {"data": {}, "error": str(e)}

    by_region: dict[str, list] = {}
    for r in rows:
        by_region.setdefault(r["region"], []).append(r)

    out = {}
    for region, series in by_region.items():
        latest = series[-1]
        # closest point at or before 7 days ago (index may skip days)
        prev = None
        for p in series:
            if p["date"] <= week_ago:
                prev = p
        delta = round(latest["ei_score"] - prev["ei_score"], 1) if prev else None
        out[region] = {
            "ei_score": latest["ei_score"],
            "delta_7d": delta,
            "history": [{"date": p["date"], "ei_score": p["ei_score"]} for p in series],
        }
    return {"data": out, "days": days}
