from fastapi import APIRouter, Query
from typing import Optional
from app.db.supabase import get_client

router = APIRouter()


@router.get("/")
def get_correlations(
    region: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    db = get_client()
    query = (
        db.table("correlations")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if region:
        query = query.eq("region", region)

    result = query.execute()
    return {"data": result.data, "count": len(result.data)}


@router.get("/{region}")
def get_correlations_by_region(region: str):
    db = get_client()
    result = (
        db.table("correlations")
        .select("*")
        .eq("region", region)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"region": region, "data": result.data}
