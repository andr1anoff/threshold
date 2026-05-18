from fastapi import APIRouter, Query
from typing import Optional
from app.db.supabase import get_client

router = APIRouter()


@router.get("/")
def get_exercises(
    region: Optional[str] = Query(None),
    lead_nation: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    db = get_client()
    query = db.table("exercises").select("*").order("start_date", desc=True).limit(limit)

    if region:
        query = query.eq("region", region)
    if lead_nation:
        query = query.eq("lead_nation", lead_nation)

    result = query.execute()
    return {"data": result.data, "count": len(result.data)}


@router.get("/upcoming")
def get_upcoming_exercises():
    from datetime import date
    today = date.today().isoformat()
    db = get_client()
    result = (
        db.table("exercises")
        .select("*")
        .gte("start_date", today)
        .order("start_date")
        .limit(20)
        .execute()
    )
    return {"data": result.data, "count": len(result.data)}


@router.get("/{exercise_id}")
def get_exercise(exercise_id: str):
    db = get_client()
    result = db.table("exercises").select("*").eq("id", exercise_id).single().execute()
    return result.data
