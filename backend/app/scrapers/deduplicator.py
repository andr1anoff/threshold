import hashlib
import logging
from app.regions import resolve, canonicalize

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

    # Region canonicalization — every incident must land on one of the 20
    # canonical regions, else it vanishes from the index.
    region = canonicalize(record.get("region"))
    if not region:
        # scraper didn't set a canonical region — try to detect from text
        region = resolve(record.get("title",""), record.get("raw_text",""),
                         record.get("description",""))
    record["region"] = region or "Unknown"

    try:
        existing = db.table("incidents").select("id").eq("content_hash", h).execute()
        if existing.data:
            return False
        title = (record.get("title") or "").strip()
        date  = (record.get("date") or "")
        if title and date:
            title_check = db.table("incidents").select("id").eq("title", title).eq("date", date).execute()
            if title_check.data:
                logger.debug(f"[dedup] skipped title+date duplicate: {title[:60]}")
                return False
        db.table("incidents").insert(record).execute()
        return True
    except Exception as e:
        logger.warning(f"[dedup] insert failed: {e}")
        return False
