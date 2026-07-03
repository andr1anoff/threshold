"""
JME Scraper — collects military exercise data from open sources.
Sources: SHAPE NATO, GlobalSecurity, Wikipedia, Defense.gov, EUCOM
"""
import httpx, asyncio, logging, re, os
from datetime import date, timedelta
from bs4 import BeautifulSoup
from app.scrapers.deduplicator import insert_with_dedup
from app.db.supabase import get_client

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Threshold/1.0 (FU Berlin academic research; ivaa03@zedat.fu-berlin.de)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

REGION_EXERCISE_MAP = {
    "Baltic":          ["baltic","estonia","latvia","lithuania","nordic","scandinavia","high north","norway","finland","sweden","barents"],
    "Ukraine":         ["ukraine","eastern europe","bucharest","romania","poland","nato eastern","defender europe"],
    "South China Sea": ["south china sea","philippine","indo-pacific","pacific command"],
    "Taiwan Strait":   ["taiwan","east china sea","western pacific"],
    "Korean Peninsula":["korea","peninsula","ulchi","foal eagle","reception"],
    "Arctic":          ["arctic","high north","svalbard","norway","barents"],
    "Mediterranean":   ["mediterranean","southern europe","nato south"],
    "Baltic":          ["baltic","north sea","north atlantic","atlantic"],
    "Gaza & Middle East":["middle east","centcom","israel","red sea","horn of africa"],
}

REGION_KEYWORDS = {
    "Baltic":           ["baltic","estonia","latvia","lithuania","norway","finland","sweden","high north"],
    "Ukraine":          ["ukraine","eastern europe","poland","romania","defender"],
    "South China Sea":  ["pacific","philippine","indo-pacific","south china"],
    "Taiwan Strait":    ["taiwan","east china"],
    "Korean Peninsula": ["korea","korean"],
    "Arctic":           ["arctic","barents","svalbard"],
    "Gaza & Middle East":["middle east","centcom","red sea","israel"],
    "Mediterranean":    ["mediterranean","nato south"],
}

def detect_region(text: str):
    """Fail closed: no keyword match -> None, caller must skip the record.
    A wrong-region exercise poisons a theatre's EX component; a skipped one
    costs a news cycle. Same asymmetry as the incident filter (v1.8 postmortem)."""
    t = text.lower()
    for region, kws in REGION_KEYWORDS.items():
        if any(kw in t for kw in kws):
            return region
    return None

def parse_exercise_dates(text: str):
    patterns = [
        r'(\d{1,2})[–\-](\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})',
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})[–\-](\d{1,2})[,\s]+(\d{4})',
        r'(\d{4})',
    ]
    months = {"january":1,"february":2,"march":3,"april":4,"may":5,"june":6,"july":7,"august":8,"september":9,"october":10,"november":11,"december":12}
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            try:
                groups = m.groups()
                if len(groups) == 4 and groups[2].lower() in months:
                    day1, day2, month, year = int(groups[0]), int(groups[1]), months[groups[2].lower()], int(groups[3])
                    return date(year, month, day1).isoformat(), date(year, month, day2).isoformat()
                elif len(groups) == 4 and groups[0].lower() in months:
                    month, day1, day2, year = months[groups[0].lower()], int(groups[1]), int(groups[2]), int(groups[3])
                    return date(year, month, day1).isoformat(), date(year, month, day2).isoformat()
                elif len(groups) == 1:
                    year = int(groups[0])
                    return date(year, 1, 1).isoformat(), date(year, 12, 31).isoformat()
            except Exception:
                pass
    return date.today().isoformat(), (date.today() + timedelta(days=14)).isoformat()

def extract_troop_count(text: str) -> int | None:
    patterns = [
        r'(\d[\d,]+)\s*(?:troops|soldiers|personnel|participants|service members)',
        r'(?:more than|over|about|approximately|some)\s*(\d[\d,]+)',
        r'(\d[\d,]+)\s*(?:NATO|allied|multinational)',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            try:
                return int(m.group(1).replace(",",""))
            except Exception:
                pass
    return None

async def _fetch(client, url, delay=5.0):
    await asyncio.sleep(delay)
    for attempt in range(3):
        try:
            r = await client.get(url, headers=HEADERS, timeout=25, follow_redirects=True)
            if r.status_code in [403, 503]:
                logger.warning(f"{r.status_code} on {url[:60]}")
                return None
            if r.status_code == 429:
                await asyncio.sleep(30 * (attempt + 1))
                continue
            return r
        except Exception as e:
            logger.error(f"Fetch {url[:60]}: {e}")
            if attempt < 2:
                await asyncio.sleep(10)
    return None

async def scrape_shape_exercises(db) -> int:
    """SHAPE NATO news archive for exercise announcements."""
    inserted = 0
    urls = [
        "https://shape.nato.int/news-archive/2026",
        "https://shape.nato.int/news-archive/2025",
    ]
    async with httpx.AsyncClient(timeout=30) as client:
        for url in urls:
            resp = await _fetch(client, url, delay=10)
            if not resp:
                continue
            soup = BeautifulSoup(resp.text, "html.parser")
            links = soup.find_all("a", href=True)
            exercise_links = [l for l in links if any(kw in l.get_text().lower() for kw in ["exercise","steadfast","defender","mongoose","aurora","trident","neptune","dynamic","iron","talisman","rimpac"])]

            for link in exercise_links[:15]:
                href = link.get("href","")
                if not href.startswith("http"):
                    href = f"https://shape.nato.int{href}"
                title = link.get_text(strip=True)
                if len(title) < 5:
                    continue
                await asyncio.sleep(5)
                detail_resp = await _fetch(client, href, delay=3)
                if not detail_resp:
                    continue
                detail = BeautifulSoup(detail_resp.text, "html.parser")
                body = detail.get_text(separator=" ", strip=True)[:2000]
                troops = extract_troop_count(body)
                start, end = parse_exercise_dates(body)
                region = detect_region(f"{title} {body[:500]}")
                if region is None:
                    continue
                record = {
                    "name": title[:200],
                    "region": region,
                    "start_date": start,
                    "end_date": end,
                    "scale": troops,
                    "lead_nation": "NATO/SHAPE",
                    "exercise_type": None,
                    "source_url": href,
                    "statements": {"raw_summary": body[:500]},
                }
                try:
                    ex = db.table("exercises").select("id").eq("name", title[:200]).execute()
                    if not ex.data:
                        db.table("exercises").insert(record).execute()
                        inserted += 1
                        logger.info(f"[shape] +1 {title[:50]}")
                except Exception as e:
                    logger.warning(f"[shape] insert {e}")

    logger.info(f"[shape] inserted={inserted}")
    return inserted

async def scrape_wikipedia_exercises(db) -> int:
    """Wikipedia List of military exercises for structured data."""
    inserted = 0
    async with httpx.AsyncClient(timeout=25) as client:
        urls = [
            "https://en.wikipedia.org/wiki/List_of_NATO_exercises",
            "https://en.wikipedia.org/wiki/List_of_United_States_military_exercises",
        ]
        for url in urls:
            resp = await _fetch(client, url, delay=5)
            if not resp:
                continue
            soup = BeautifulSoup(resp.text, "html.parser")
            tables = soup.find_all("table", class_="wikitable")
            for table in tables[:3]:
                for row in table.find_all("tr")[1:]:
                    cells = row.find_all(["td","th"])
                    if len(cells) < 2:
                        continue
                    name = cells[0].get_text(strip=True)
                    if len(name) < 3 or len(name) > 100:
                        continue
                    context = " ".join(c.get_text(strip=True) for c in cells)
                    region = detect_region(context)
                    if region is None:
                        continue
                    start, end = parse_exercise_dates(context)
                    troops = extract_troop_count(context)
                    link_tag = cells[0].find("a")
                    src = f"https://en.wikipedia.org{link_tag['href']}" if link_tag and link_tag.get("href","").startswith("/wiki/") else url
                    record = {
                        "name": name,
                        "region": region,
                        "start_date": start,
                        "end_date": end,
                        "scale": troops,
                        "lead_nation": "NATO/US",
                        "exercise_type": None,
                        "source_url": src,
                        "statements": {"raw_summary": context[:400]},
                    }
                    try:
                        ex = db.table("exercises").select("id").eq("name", name).execute()
                        if not ex.data:
                            db.table("exercises").insert(record).execute()
                            inserted += 1
                    except Exception as e:
                        logger.warning(f"[wiki_ex] {e}")

    logger.info(f"[wiki_exercises] inserted={inserted}")
    return inserted

async def scrape_defense_gov_exercises(db) -> int:
    """Defense.gov news for US-led exercises."""
    inserted = 0
    async with httpx.AsyncClient(timeout=25) as client:
        resp = await _fetch(client, "https://www.defense.gov/News/News-Stories/", delay=5)
        if not resp:
            return 0
        soup = BeautifulSoup(resp.text, "html.parser")
        articles = soup.find_all("article")[:20]
        for art in articles:
            title = art.find("h3") or art.find("h2")
            if not title:
                continue
            title_text = title.get_text(strip=True)
            if not any(kw in title_text.lower() for kw in ["exercise","drill","maneuver","operations"]):
                continue
            link = art.find("a", href=True)
            href = link["href"] if link else ""
            if href and not href.startswith("http"):
                href = f"https://www.defense.gov{href}"
            region = detect_region(title_text)
            if region is None:
                continue
            start, end = parse_exercise_dates(title_text)
            record = {
                "name": title_text[:200],
                "region": region,
                "start_date": start,
                "end_date": end,
                "scale": None,
                "lead_nation": "US DoD",
                "exercise_type": None,
                "source_url": href or "https://www.defense.gov",
                "statements": {"raw_summary": title_text},
            }
            try:
                ex = db.table("exercises").select("id").eq("name", title_text[:200]).execute()
                if not ex.data:
                    db.table("exercises").insert(record).execute()
                    inserted += 1
            except Exception as e:
                logger.warning(f"[defense_gov] {e}")

    logger.info(f"[defense_gov] inserted={inserted}")
    return inserted

async def scrape_all_exercises(db=None) -> dict:
    if db is None:
        db = get_client()
    shape   = await scrape_shape_exercises(db)
    wiki    = await scrape_wikipedia_exercises(db)
    defense = await scrape_defense_gov_exercises(db)
    total   = shape + wiki + defense
    logger.info(f"[exercises_all] total={total}")
    return {"shape": shape, "wikipedia": wiki, "defense_gov": defense, "total": total}
