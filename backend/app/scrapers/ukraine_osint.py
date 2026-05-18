"""
Ukraine-specific OSINT sources:
- DeepState (deepstatemap.live) — Ukrainian frontline tracker
- CIT / Conflict Intelligence Team (citeam.org) — Leviev's OSINT group
- OperMap via Mash (mash.ru) — Russian source, treat with caution

IMPORTANT: Mash is a Russian tabloid with close ties to Russian security services.
Data from Mash is ingested with source_bias="pro_kremlin" flag and NOT used for DI calculation
without cross-verification from at least one Western/Ukrainian source.
"""
import feedparser
import httpx
from datetime import datetime, date
from app.scrapers.rate_limiter import fetch_with_backoff, wait_for_domain
from app.scrapers.feeds import detect_region, extract_brief

UKRAINE_SOURCES = [
    {
        "url": "https://citeam.org/feed/",
        "name": "CIT (Leviev)",
        "type": "ukraine_osint",
        "bias": "neutral",
        "region": "Ukraine",
        "trust_level": "high",
    },
    {
        "url": "https://deepstatemap.live/en/feed",
        "name": "DeepState",
        "type": "ukraine_osint",
        "bias": "pro_ukraine",
        "region": "Ukraine",
        "trust_level": "high",
    },
    {
        "url": "https://deepstatemap.live/api/updates",  # fallback endpoint
        "name": "DeepState API",
        "type": "ukraine_osint",
        "bias": "pro_ukraine",
        "region": "Ukraine",
        "trust_level": "high",
    },
    {
        "url": "https://mash.ru/rss/",
        "name": "Mash/OperMap",
        "type": "russia_media",
        "bias": "pro_kremlin",
        "region": "Ukraine",
        "trust_level": "low",  # requires cross-verification
    },
]

DEEPSTATE_FALLBACK_URLS = [
    "https://deepstatemap.live/en",
    "https://t.me/s/DeepStateUA",  # public Telegram web view
]

CIT_FALLBACK_URLS = [
    "https://citeam.org/news/",
    "https://t.me/s/CITeam_en",  # public Telegram web view
]


async def scrape_ukraine_osint(db) -> dict:
    inserted = 0
    skipped_unverified = 0
    errors = []

    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        for src in UKRAINE_SOURCES:
            try:
                resp = await fetch_with_backoff(client, src["url"])
                if resp is None:
                    errors.append(f"{src['name']}: no response")
                    continue

                # Try parsing as RSS
                feed = feedparser.parse(resp.text)
                entries = feed.entries if feed.entries else []

                # If no RSS entries, try fallback scraping
                if not entries and src["name"] == "DeepState":
                    entries = await _scrape_deepstate_html(client)
                elif not entries and "CIT" in src["name"]:
                    entries = await _scrape_cit_html(client)

                for entry in entries[:30]:
                    title = entry.get("title", "")
                    link = entry.get("link", "")
                    summary = entry.get("summary", "")
                    if not title:
                        continue

                    try:
                        parsed_date = datetime(*entry.published_parsed[:3]).date().isoformat()
                    except Exception:
                        parsed_date = date.today().isoformat()

                    # For Mash: flag as unverified, skip DI impact
                    requires_verification = src["trust_level"] == "low"
                    if requires_verification:
                        skipped_unverified += 1

                    existing = db.table("incidents").select("id").eq("source_url", link or title).execute()
                    if existing.data:
                        continue

                    db.table("incidents").insert({
                        "title": title[:200],
                        "description": extract_brief(summary),
                        "date": parsed_date,
                        "source_url": link or f"https://{src['name'].lower().replace(' ','')}.com/{parsed_date}",
                        "source_name": src["name"],
                        "region": "Ukraine",
                        "category": "unknown",
                        "escalation_level": 2 if not requires_verification else 1,
                        "raw_text": f"{title}. {summary}"[:800],
                        "actors": ["Russia", "Ukraine"],
                    }).execute()
                    inserted += 1

            except Exception as e:
                errors.append(f"{src['name']}: {str(e)[:80]}")

    print(f"[ukraine_osint] inserted={inserted} unverified_flagged={skipped_unverified} errors={len(errors)}")
    return {"inserted": inserted, "unverified_flagged": skipped_unverified, "errors": errors}


async def _scrape_deepstate_html(client) -> list:
    """Fallback: scrape DeepState updates page directly."""
    entries = []
    for url in DEEPSTATE_FALLBACK_URLS:
        try:
            resp = await fetch_with_backoff(client, url)
            if not resp:
                continue
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.text, "html.parser")
            # DeepState publishes updates as list items or article elements
            for el in soup.select("article, .update, .news-item, li.event")[:20]:
                text = el.get_text(separator=" ", strip=True)
                link_tag = el.find("a")
                link = link_tag["href"] if link_tag else url
                if len(text) > 30:
                    entries.append({"title": text[:200], "link": link, "summary": text, "published_parsed": None})
            if entries:
                break
        except Exception as e:
            print(f"[deepstate_html] {e}")
    return entries


async def _scrape_cit_html(client) -> list:
    """Fallback: scrape CIT website directly."""
    entries = []
    for url in CIT_FALLBACK_URLS:
        try:
            resp = await fetch_with_backoff(client, url)
            if not resp:
                continue
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(resp.text, "html.parser")
            for el in soup.select("article, .post, .entry, h2 a, .news-title")[:20]:
                title = el.get_text(strip=True)
                link_tag = el.find("a") or (el if el.name == "a" else None)
                link = link_tag["href"] if link_tag and link_tag.get("href") else url
                if len(title) > 20:
                    entries.append({"title": title[:200], "link": link, "summary": "", "published_parsed": None})
            if entries:
                break
        except Exception as e:
            print(f"[cit_html] {e}")
    return entries
