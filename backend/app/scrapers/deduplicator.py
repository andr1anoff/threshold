import hashlib
import logging

logger = logging.getLogger(__name__)

def make_hash(title: str, url: str) -> str:
    return hashlib.sha256(f"{url}|{title[:100]}".encode()).hexdigest()

def is_duplicate(title: str, url: str, db) -> bool:
    h = make_hash(title, url)
    try:
        r = db.table("incidents").select("id").eq("content_hash", h).execute()
        return len(r.data) > 0
    except Exception as e:
        logger.warning(f"[dedup] check failed: {e}")
        return False

def insert_with_dedup(record: dict, db) -> bool:
    h = make_hash(record.get("title",""), record.get("source_url",""))
    record["content_hash"] = h
    try:
        existing = db.table("incidents").select("id").eq("content_hash", h).execute()
        if existing.data:
            return False
        db.table("incidents").insert(record).execute()
        return True
    except Exception as e:
        logger.warning(f"[dedup] insert failed: {e}")
        return False
