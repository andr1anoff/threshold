"""
Threshold scraper suite v3 — aggressive, paginated, no restrictive filters.

Sources:
1. ReliefWeb/OCHA — by country, no theme filter, paginated
2. UCDP — 2024+2025 data (2026 too recent)
3. Wikipedia Current Events — last 7 days
4. UN News RSS — peace/security + humanitarian
5. UNOCHA Situation Reports
"""
import httpx, asyncio, feedparser, re, json
from datetime import date, timedelta
from bs4 import BeautifulSoup
from app.scrapers.rate_limiter import fetch_with_backoff
from app.db.supabase import get_client

# Region → countries mapping for targeted queries
REGION_COUNTRIES = {
    "Gaza & Middle East": ["Palestine", "Israel", "Lebanon", "Syria", "Iraq", "Iran", "Jordan", "Egypt"],
    "Ukraine":            ["Ukraine", "Russia"],
    "Sudan":              ["Sudan", "South Sudan"],
    "South China Sea":    ["Philippines", "Vietnam", "Malaysia", "China"],
    "Taiwan Strait":      ["Taiwan"],
    "Yemen":              ["Yemen"],
    "Sahel":              ["Mali", "Burkina Faso", "Niger", "Chad", "Nigeria", "Mauritania"],
    "Korean Peninsula":   ["North Korea", "South Korea"],
    "Myanmar":            ["Myanmar"],
    "DRC":                ["Democratic Republic of the Congo", "Congo"],
    "Syria":              ["Syria"],
    "Somalia":            ["Somalia", "Kenya", "Ethiopia"],
    "Baltic":             ["Estonia", "Latvia", "Lithuania", "Finland", "Poland"],
    "Haiti":              ["Haiti"],
    "Ethiopia":           ["Ethiopia"],
    "South Caucasus":     ["Armenia", "Azerbaijan", "Georgia"],
    "Libya":              ["Libya"],
    "Kosovo":             ["Kosovo", "Serbia"],
    "Arctic":             ["Norway", "Russia", "Greenland"],
    "Mozambique":         ["Mozambique"],
}

REGION_KEYWORDS = {
    "Gaza & Middle East": ["gaza","hamas","west bank","idf","rafah","hezbollah","israel","occupied territory","golan","intifada"],
    "Ukraine":            ["ukraine","zelenskyy","kyiv","donbas","kharkiv","zaporizhzhia","bakhmut","mariupol","russian forces","ukrainian army"],
    "Sudan":              ["sudan","khartoum","rsf","rapid support forces","darfur","al-burhan","hemedti"],
    "South China Sea":    ["south china sea","spratly","paracel","fiery cross","nine-dash","scarborough"],
    "Taiwan Strait":      ["taiwan","taipei","pla navy","taiwan strait"],
    "Yemen":              ["yemen","houthi","ansar allah","hodeidah","red sea attack"],
    "Sahel":              ["sahel","mali","burkina faso","niger","jnim","aqim","bamako","ouagadougou","niamey","wagner africa"],
    "Korean Peninsula":   ["north korea","dprk","kim jong","pyongyang","icbm"],
    "Myanmar":            ["myanmar","burma","tatmadaw","junta","arakan army","shan state","kachin"],
    "DRC":                ["drc","congo","m23","monusco","goma","kivu","kinshasa"],
    "Syria":              ["syria","idlib","sdf","hts","damascus","aleppo"],
    "Somalia":            ["somalia","al-shabaab","mogadishu","atmis","puntland"],
    "Baltic":             ["estonia","latvia","lithuania","nato eastern","kaliningrad","suwalki","finland border"],
    "Haiti":              ["haiti","gang","port-au-prince","mss","viv ansanm"],
    "Ethiopia":           ["ethiopia","tigray","amhara","tplf","oromo","addis ababa"],
    "South Caucasus":     ["nagorno","karabakh","armenia","azerbaijan","south caucasus","yerevan","baku"],
    "Libya":              ["libya","tripoli","gna","lna","haftar","benghazi"],
    "Kosovo":             ["kosovo","pristina","kfor","northern kosovo","kurti"],
    "Arctic":             ["arctic","svalbard","spitsbergen","greenland military","high north","northern sea route"],
    "Mozambique":         ["mozambique","cabo delgado","ansar al-sunna","isis mozambique","pemba"],
}

def detect_region(text: str) -> str | None:
    t = text.lower()
    scores = {r: sum(1 for kw in kws if kw in t) for r, kws in REGION_KEYWORDS.items()}
    scores = {r: s for r, s in scores.items() if s > 0}
    return max(scores, key=scores.get) if scores else None

def clean_html(text: str) -> str:
    return re.sub(r'<[^>]+>', ' ', text or "")

def extract_brief(text: str, max_chars: int = 280) -> str:
    text = " ".join(clean_html(text).split())
    for sep in [". ", "! "]:
        parts = text.split(sep)
        sents = [p.strip() for p in parts[:2] if len(p.strip()) > 20]
        if sents:
            return sep.join(sents)[:max_chars]
    return text[:max_chars]

def db_insert(db, record: dict) -> bool:
    try:
        ex = db.table("incidents").select("id").eq("source_url", record["source_url"]).execute()
        if ex.data:
            return False
        db.table("incidents").insert(record).execute()
        return True
    except Exception as e:
        print(f"[db] {e}")
        return False


# ── 1. ReliefWeb — per country, no theme filter ──────────────────────
async def scrape_reliefweb(db=None) -> int:
    if db is None:
        db = get_client()
    inserted = 0
    since = (date.today() - timedelta(days=60)).isoformat()

    async with httpx.AsyncClient(timeout=30) as client:
        for region, countries in REGION_COUNTRIES.items():
            for country in countries[:3]:  # top 3 countries per region
                try:
                    await asyncio.sleep(0.5)
                    params = {
                        "appname": "threshold-jfki-fu-berlin",
                        "limit": 30,
                        "fields[include][]": ["title", "body", "source", "date", "url", "primary_country"],
                        "filter[operator]": "AND",
                        "filter[conditions][0][field]": "primary_country.name",
                        "filter[conditions][0][value]": country,
                        "filter[conditions][1][field]": "date.created",
                        "filter[conditions][1][value]": since,
                        "filter[conditions][1][operator]": ">=",
                        "sort[]": "date.created:desc",
                    }
                    resp = await fetch_with_backoff(client, "https://api.reliefweb.int/v1/reports", params=params)
                    if not resp:
                        continue
                    data = resp.json()

                    for item in data.get("data", []):
                        f = item.get("fields", {})
                        title = f.get("title", "")
                        body = clean_html(f.get("body", "") or "")
                        url_field = f.get("url", {})
                        link = url_field.get("canonical", "") if isinstance(url_field, dict) else str(url_field)
                        date_field = f.get("date", {})
                        date_str = date_field.get("created", "")[:10] if isinstance(date_field, dict) else date.today().isoformat()
                        src = f.get("source", [])
                        source_name = src[0].get("name", "ReliefWeb") if isinstance(src, list) and src else "ReliefWeb"

                        if not link or not title:
                            continue

                        record = {
                            "title": title[:200],
                            "description": extract_brief(body),
                            "date": date_str,
                            "source_url": link,
                            "source_name": f"{source_name} (OCHA/ReliefWeb)",
                            "region": region,
                            "category": "unknown",
                            "escalation_level": 2,
                            "raw_text": f"{title}. {body[:300]}",
                        }
                        if db_insert(db, record):
                            inserted += 1

                except Exception as e:
                    print(f"[reliefweb] {country}: {e}")

    print(f"[reliefweb] inserted={inserted}")
    return inserted


# ── 2. UCDP — 2024 + 2025 ────────────────────────────────────────────
async def scrape_ucdp(db=None) -> int:
    if db is None:
        db = get_client()
    inserted = 0
    cutoff = (date.today() - timedelta(days=180)).isoformat()

    async with httpx.AsyncClient(timeout=30) as client:
        for year in [2025, 2024]:
            for page in range(1, 6):  # up to 5 pages × 200 = 1000 events
                try:
                    await asyncio.sleep(1)
                    resp = await fetch_with_backoff(client,
                        f"https://ucdpapi.pcr.uu.se/api/gedevents/{year}",
                        params={"pagesize": 200, "page": page}
                    )
                    if not resp:
                        break
                    data = resp.json()
                    events = data.get("Result", [])
                    if not events:
                        break

                    for ev in events:
                        ev_date = ev.get("date_start", "")[:10]
                        if ev_date < cutoff:
                            continue
                        country = ev.get("country", "")
                        where = ev.get("where_description", "") or ev.get("adm_1", "") or ""
                        side_a = ev.get("side_a", "")
                        side_b = ev.get("side_b", "")
                        deaths = int(ev.get("best", 0) or 0)
                        conflict_name = ev.get("conflict_name", "")
                        title = f"{conflict_name or 'Armed clash'}: {side_a} vs {side_b} in {where}, {country}"
                        source_url = f"https://ucdp.uu.se/event/{ev.get('id','')}"
                        region = detect_region(f"{country} {where} {conflict_name} {side_a} {side_b}")
                        if not region:
                            continue
                        esc = min(5, max(1, 1 + (2 if deaths >= 25 else 1 if deaths >= 5 else 0)))
                        record = {
                            "title": title[:200],
                            "description": f"{deaths} deaths. UCDP verified event.",
                            "date": ev_date,
                            "source_url": source_url,
                            "source_name": "UCDP (Uppsala University)",
                            "region": region,
                            "actors": [a for a in [side_a, side_b] if a],
                            "category": "proxy",
                            "escalation_level": esc,
                            "raw_text": f"{title}. Deaths: {deaths}.",
                        }
                        if db_insert(db, record):
                            inserted += 1

                except Exception as e:
                    print(f"[ucdp] {year} page {page}: {e}")
                    break

    print(f"[ucdp] inserted={inserted}")
    return inserted


# ── 3. Wikipedia Current Events — last 7 days ───────────────────────
async def scrape_wikipedia_events(db=None) -> int:
    if db is None:
        db = get_client()
    inserted = 0

    async with httpx.AsyncClient(timeout=20) as client:
        for days_ago in range(7):
            d = date.today() - timedelta(days=days_ago)
            # Try multiple URL formats
            urls = [
                f"https://en.wikipedia.org/wiki/Portal:Current_events/{d.strftime('%B')}_{d.day},_{d.year}",
                f"https://en.wikipedia.org/wiki/Portal:Current_events/{d.strftime('%Y_%B_%-d')}",
            ]
            for url in urls:
                try:
                    resp = await fetch_with_backoff(client, url)
                    if not resp or resp.status_code != 200:
                        continue
                    soup = BeautifulSoup(resp.text, "html.parser")
                    # Try multiple selectors
                    items = (
                        soup.select("div.current-events-content li") or
                        soup.select(".vevent li") or
                        soup.select("#mw-content-text li") or
                        []
                    )
                    for item in items:
                        text = item.get_text(separator=" ", strip=True)
                        if len(text) < 40 or len(text) > 500:
                            continue
                        region = detect_region(text)
                        if not region:
                            continue
                        source_url = f"{url}#{hash(text) % 99999}"
                        record = {
                            "title": text[:200],
                            "description": text[:280],
                            "date": d.isoformat(),
                            "source_url": source_url,
                            "source_name": "Wikipedia Current Events",
                            "region": region,
                            "category": "unknown",
                            "escalation_level": 2,
                            "raw_text": text[:500],
                        }
                        if db_insert(db, record):
                            inserted += 1
                    if items:
                        break
                except Exception as e:
                    print(f"[wiki] {d}: {e}")
            await asyncio.sleep(1)

    print(f"[wikipedia] inserted={inserted}")
    return inserted


# ── 4. UN News RSS ───────────────────────────────────────────────────
async def scrape_un_news(db=None) -> int:
    if db is None:
        db = get_client()
    inserted = 0
    cutoff = (date.today() - timedelta(days=60)).isoformat()

    UN_FEEDS = [
        "https://news.un.org/feed/subscribe/en/news/topic/peace-and-security/feed/rss.xml",
        "https://news.un.org/feed/subscribe/en/news/topic/humanitarian-aid/feed/rss.xml",
        "https://news.un.org/feed/subscribe/en/news/topic/refugees/feed/rss.xml",
        "https://news.un.org/feed/subscribe/en/news/region/africa/feed/rss.xml",
        "https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml",
        "https://news.un.org/feed/subscribe/en/news/region/asia-pacific/feed/rss.xml",
        "https://news.un.org/feed/subscribe/en/news/region/europe/feed/rss.xml",
    ]

    async with httpx.AsyncClient(timeout=20) as client:
        for feed_url in UN_FEEDS:
            try:
                await asyncio.sleep(0.5)
                resp = await fetch_with_backoff(client, feed_url)
                if not resp:
                    continue
                feed = feedparser.parse(resp.text)
                for entry in feed.entries[:50]:
                    title = entry.get("title", "")
                    summary = entry.get("summary", "") or ""
                    link = entry.get("link", "")
                    if not title or not link:
                        continue
                    try:
                        ev_date = date(*entry.published_parsed[:3]).isoformat()
                    except Exception:
                        ev_date = date.today().isoformat()
                    if ev_date < cutoff:
                        continue
                    region = detect_region(f"{title} {summary}")
                    if not region:
                        continue
                    record = {
                        "title": title[:200],
                        "description": extract_brief(summary),
                        "date": ev_date,
                        "source_url": link,
                        "source_name": "UN News",
                        "region": region,
                        "category": "unknown",
                        "escalation_level": 2,
                        "raw_text": f"{title}. {summary}"[:500],
                    }
                    if db_insert(db, record):
                        inserted += 1
            except Exception as e:
                print(f"[un_news] {feed_url}: {e}")

    print(f"[un_news] inserted={inserted}")
    return inserted


# ── 5. UNOCHA Situation Reports ──────────────────────────────────────
async def scrape_unocha_sitreps(db=None) -> int:
    if db is None:
        db = get_client()
    inserted = 0
    since = (date.today() - timedelta(days=60)).isoformat()

    async with httpx.AsyncClient(timeout=25) as client:
        for page in range(1, 4):
            try:
                await asyncio.sleep(0.5)
                params = {
                    "appname": "threshold-jfki-fu-berlin",
                    "limit": 50,
                    "page": page,
                    "fields[include][]": ["title", "date", "url", "primary_country", "source"],
                    "filter[operator]": "AND",
                    "filter[conditions][0][field]": "format.name",
                    "filter[conditions][0][value]": "Situation Report",
                    "filter[conditions][1][field]": "date.created",
                    "filter[conditions][1][value]": since,
                    "filter[conditions][1][operator]": ">=",
                    "sort[]": "date.created:desc",
                }
                resp = await fetch_with_backoff(client, "https://api.reliefweb.int/v1/reports", params=params)
                if not resp:
                    break
                data = resp.json()
                items = data.get("data", [])
                if not items:
                    break

                for item in items:
                    f = item.get("fields", {})
                    title = f.get("title", "")
                    url_field = f.get("url", {})
                    link = url_field.get("canonical", "") if isinstance(url_field, dict) else ""
                    date_field = f.get("date", {})
                    date_str = date_field.get("created", "")[:10] if isinstance(date_field, dict) else ""
                    pc = f.get("primary_country")
                    country = pc.get("name", "") if isinstance(pc, dict) else ""
                    if not link or not title:
                        continue
                    region = detect_region(f"{title} {country}")
                    if not region:
                        continue
                    record = {
                        "title": title[:200],
                        "description": f"OCHA Situation Report — {country}",
                        "date": date_str or date.today().isoformat(),
                        "source_url": link,
                        "source_name": "UNOCHA Situation Report",
                        "region": region,
                        "category": "unknown",
                        "escalation_level": 2,
                        "raw_text": title[:400],
                    }
                    if db_insert(db, record):
                        inserted += 1

            except Exception as e:
                print(f"[unocha] page {page}: {e}")
                break

    print(f"[unocha_sitreps] inserted={inserted}")
    return inserted


# ── Master ───────────────────────────────────────────────────────────
async def scrape_all(db=None) -> dict:
    if db is None:
        db = get_client()
    rw    = await scrape_reliefweb(db)
    ucdp  = await scrape_ucdp(db)
    wiki  = await scrape_wikipedia_events(db)
    un    = await scrape_un_news(db)
    ocha  = await scrape_unocha_sitreps(db)
    total = rw + ucdp + wiki + un + ocha
    print(f"[scrape_all] total={total}")
    return {"reliefweb": rw, "ucdp": ucdp, "wikipedia": wiki, "un_news": un, "unocha_sitreps": ocha, "total": total}

async def scrape_all_feeds(db=None): return await scrape_all(db)
async def scrape_gdelt(db=None): return 0
async def scrape_acled(db=None): return 0


def detect_region_strict(text: str, country_hint: str = "") -> str | None:
    """
    Stricter version: requires 2+ keyword matches OR country_hint match.
    Prevents e.g. Libya data going to Kosovo just because of one word.
    """
    t = (text + " " + country_hint).lower()

    # Country-to-region direct mapping (highest confidence)
    COUNTRY_MAP = {
        "palestine": "Gaza & Middle East", "gaza": "Gaza & Middle East",
        "israel": "Gaza & Middle East", "west bank": "Gaza & Middle East",
        "ukraine": "Ukraine", "kyiv": "Ukraine",
        "sudan": "Sudan", "khartoum": "Sudan", "darfur": "Sudan",
        "taiwan": "Taiwan Strait",
        "yemen": "Yemen", "houthi": "Yemen",
        "mali": "Sahel", "burkina faso": "Sahel", "niger": "Sahel",
        "north korea": "Korean Peninsula", "dprk": "Korean Peninsula",
        "myanmar": "Myanmar", "burma": "Myanmar",
        "democratic republic of congo": "DRC", "drc": "DRC",
        "dr congo": "DRC", "kivu": "DRC", "goma": "DRC",
        "syria": "Syria", "damascus": "Syria", "aleppo": "Syria",
        "somalia": "Somalia", "mogadishu": "Somalia",
        "haiti": "Haiti",
        "ethiopia": "Ethiopia", "addis ababa": "Ethiopia",
        "armenia": "South Caucasus", "azerbaijan": "South Caucasus",
        "nagorno": "South Caucasus", "karabakh": "South Caucasus",
        "libya": "Libya", "tripoli": "Libya", "benghazi": "Libya",
        "kosovo": "Kosovo", "pristina": "Kosovo",
        "svalbard": "Arctic", "greenland": "Arctic",
        "mozambique": "Mozambique", "cabo delgado": "Mozambique",
    }

    for key, region in COUNTRY_MAP.items():
        if key in t:
            return region

    # Keyword scoring (need 2+ matches for ambiguous cases)
    scores = {}
    for region, kws in REGION_KEYWORDS.items():
        count = sum(1 for kw in kws if kw in t)
        if count >= 2:
            scores[region] = count
        elif count == 1 and country_hint.lower() in [k.lower() for k in kws]:
            scores[region] = 1

    return max(scores, key=scores.get) if scores else None
