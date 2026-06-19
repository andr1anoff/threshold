from fastapi import APIRouter, Query
from typing import Optional
from app.db.supabase import get_client

router = APIRouter()


@router.get("/")
def get_incidents(
    region: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(200, ge=1, le=500),
):
    db = get_client()
    query = db.table("incidents").select("*").order("date", desc=True).limit(limit)
    count_query = db.table("incidents").select("id", count="exact")

    if region:
        query = query.eq("region", region)
        count_query = count_query.eq("region", region)
    if category:
        query = query.eq("category", category)
        count_query = count_query.eq("category", category)

    result = query.execute()
    total = count_query.execute().count
    return {"data": result.data, "count": len(result.data), "total": total}


@router.get("/{incident_id}")
def get_incident(incident_id: str):
    db = get_client()
    result = db.table("incidents").select("*").eq("id", incident_id).single().execute()
    return result.data


@router.get("/region/{region}")
def get_incidents_by_region(region: str, days: int = Query(30)):
    db = get_client()
    result = (
        db.table("incidents")
        .select("*")
        .eq("region", region)
        .order("date", desc=True)
        .limit(100)
        .execute()
    )
    return {"region": region, "data": result.data, "count": len(result.data)}
