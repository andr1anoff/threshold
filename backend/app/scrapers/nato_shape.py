import feedparser
import httpx
from datetime import datetime
from app.db.supabase import get_client

NATO_SHAPE_RSS = "https://shape.nato.int/shape-news/rss"


async def scrape_nato_exercises():
    """Fetch and parse NATO SHAPE RSS for exercise announcements."""
    print("[scraper] Fetching NATO SHAPE RSS...")
    feed = feedparser.parse(NATO_SHAPE_RSS)
    db = get_client()
    inserted = 0

    for entry in feed.entries:
        text = f"{entry.get('title', '')} {entry.get('summary', '')}"

        # Basic filter: only process exercise-related entries
        keywords = ["exercise", "drill", "maneuver", "training", "operation"]
        if not any(kw in text.lower() for kw in keywords):
            continue

        # Check duplicate
        existing = (
            db.table("exercises")
            .select("id")
            .eq("source_url", entry.get("link", ""))
            .execute()
        )
        if existing.data:
            continue

        # Insert raw entry for LLM classification in Phase 3
        record = {
            "name": entry.get("title", "Unknown"),
            "source_url": entry.get("link", ""),
            "lead_nation": "NATO",
            "exercise_type": "NATO",
            "region": "Europe",  # default, LLM will refine in Phase 3
            "statements": {"raw_title": entry.get("title", ""), "raw_summary": entry.get("summary", "")},
        }

        db.table("exercises").insert(record).execute()
        inserted += 1

    print(f"[scraper] NATO SHAPE: inserted {inserted} new entries")
    return inserted


async def scrape_gdelt_incidents():
    """Fetch gray zone incidents from GDELT API."""
    print("[scraper] Fetching GDELT...")
    # GDELT query for military/security events
    url = (
        "https://api.gdeltproject.org/api/v2/doc/doc"
        "?query=military%20exercise%20OR%20airspace%20violation%20OR%20cyber%20attack"
        "&mode=artlist&maxrecords=50&format=json&timespan=3days"
    )
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(url)
            data = resp.json()
        except Exception as e:
            print(f"[scraper] GDELT error: {e}")
            return 0

    db = get_client()
    articles = data.get("articles", [])
    inserted = 0

    for article in articles:
        existing = (
            db.table("incidents")
            .select("id")
            .eq("source_url", article.get("url", ""))
            .execute()
        )
        if existing.data:
            continue

        record = {
            "title": article.get("title", ""),
            "source_url": article.get("url", ""),
            "source_name": article.get("domain", ""),
            "date": article.get("seendate", "")[:10] if article.get("seendate") else None,
            "raw_text": article.get("title", ""),
            "region": "Unknown",      # LLM will classify in Phase 3
            "category": "unknown",    # LLM will classify in Phase 3
            "escalation_level": 1,    # default
        }

        db.table("incidents").insert(record).execute()
        inserted += 1

    print(f"[scraper] GDELT: inserted {inserted} new entries")
    return inserted
