from fastapi import APIRouter
from app.db.supabase import get_client
from app.di.calculator import CONFLICT_BASELINE

router = APIRouter()

@router.get("/global")
def global_ei():
    db = get_client()
    try:
        data = db.table("deterrence_index").select("region,di_score,gz_score,ex_score,rh_score,date").order("date",desc=True).limit(60).execute()
        seen = set()
        results = []
        for row in data.data:
            r = row["region"]
            if r not in seen:
                seen.add(r)
                # Remap di_score → ei_score in response
                row["ei_score"] = row.pop("di_score", None)
                results.append(row)
        return {"data": results}
    except Exception as e:
        return {"data": [], "error": str(e)}

@router.get("/region/{region}")
def region_ei(region: str):
    db = get_client()
    try:
        data = db.table("deterrence_index").select("*").eq("region",region).order("date",desc=True).limit(1).execute()
        if data.data:
            row = data.data[0]
            row["ei_score"] = row.pop("di_score", None)
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
        data = db.table("deterrence_index").select("date,di_score").eq("region",region).gte("date",since).order("date").execute()
        result = []
        for row in data.data:
            result.append({"date": row["date"], "ei_score": row["di_score"]})
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
        now  = db.table("deterrence_index").select("di_score").eq("region", region).eq("date", today).execute().data
        prev = db.table("deterrence_index").select("di_score").eq("region", region).eq("date", week_ago).execute().data
        if now and prev:
            delta = round(now[0]["di_score"] - prev[0]["di_score"], 1)
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
        all_data = db.table("deterrence_index").select("region,di_score,date").order("date").execute().data
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
                oldest = rows[0]["di_score"]
                newest = rows[-1]["di_score"]
                delta = round(newest - oldest, 1)
                trends[region] = delta

        total_points = len(all_data)
        return {"trends": trends, "data_points": total_points}
    except Exception:
        return {"trends": {}, "data_points": 0}
