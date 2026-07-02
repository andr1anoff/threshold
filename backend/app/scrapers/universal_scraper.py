"""
Universal scraper v7.1 — 19 sources, LLM security filter, conservative rate limits.
Only security incidents pass through. Diplomatic/economic/cultural news filtered out.
"""
import httpx, asyncio, feedparser, re, logging, os
from datetime import date, timedelta
from bs4 import BeautifulSoup
from app.scrapers.deduplicator import insert_with_dedup
from app.db.supabase import get_client

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Threshold/1.0 (FU Berlin academic research; threshold@easily.berlin)",
    "Accept": "application/rss+xml, application/xml, application/json, text/html",
}

# ── Region detection ─────────────────────────────────────────────────

REGION_KEYWORDS = {
    "Gaza & Middle East": ["gaza","hamas","west bank","idf","rafah","hezbollah","israel","ceasefire","golan","intifada","occupied"],
    "Ukraine":            ["ukraine","zelenskyy","kyiv","donbas","kharkiv","zaporizhzhia","bakhmut","mariupol","russian forces","ukrainian army","frontline"],
    "Sudan":              ["sudan","khartoum","rsf","rapid support forces","darfur","al-burhan","hemedti"],
    "South China Sea":    ["south china sea","spratly","paracel","fiery cross","nine-dash","scarborough"],
    "Taiwan Strait":      ["taiwan","taipei","pla navy","taiwan strait"],
    "Yemen":              ["yemen","houthi","ansar allah","hodeidah","red sea attack"],
    "Sahel":              ["sahel","mali","burkina faso","niger","jnim","aqim","bamako","ouagadougou","niamey"],
    "Korean Peninsula":   ["north korea","dprk","kim jong","pyongyang","icbm"],
    "Myanmar":            ["myanmar","burma","tatmadaw","junta","arakan army","shan state","kachin","naypyidaw","rakhine","sagaing"],
    "DRC":                ["drc","congo","m23","monusco","goma","kivu","kinshasa"],
    "Syria":              ["syria","idlib","sdf","hts","damascus","aleppo"],
    "Somalia":            ["somalia","al-shabaab","mogadishu","atmis","puntland"],
    "Baltic":             ["estonia","latvia","lithuania","nato eastern","kaliningrad","suwalki","finland border","tallinn","riga","vilnius","gotland","gulf of finland","baltic sea"],
    "Haiti":              ["haiti","gang","port-au-prince","mss","viv ansanm"],
    "Ethiopia":           ["ethiopia","tigray","amhara","tplf","oromo","addis ababa"],
    "South Caucasus":     ["nagorno","karabakh","armenia","azerbaijan","south caucasus","yerevan","baku","tbilisi","abkhazia","south ossetia","zangezur"],
    "Libya":              ["libya","tripoli","gna","lna","haftar","benghazi"],
    "Kosovo":             ["kosovo","pristina","kfor","northern kosovo","kurti"],
    "Arctic":             ["arctic","svalbard","spitsbergen","greenland military","high north","northern sea route"],
    "Mozambique":         ["mozambique","cabo delgado","ansar al-sunna","isis mozambique","pemba"],
}

COUNTRY_MAP = {
    "palestine":"Gaza & Middle East","gaza":"Gaza & Middle East","israel":"Gaza & Middle East",
    "west bank":"Gaza & Middle East","hezbollah":"Gaza & Middle East","hamas":"Gaza & Middle East",
    "ukraine":"Ukraine","kyiv":"Ukraine","donbas":"Ukraine","zelenskyy":"Ukraine",
    "sudan":"Sudan","khartoum":"Sudan","darfur":"Sudan",
    "taiwan":"Taiwan Strait",
    "yemen":"Yemen","houthi":"Yemen",
    "mali":"Sahel","burkina faso":"Sahel","niger":"Sahel",
    "north korea":"Korean Peninsula","dprk":"Korean Peninsula",
    "myanmar":"Myanmar","burma":"Myanmar",
    "democratic republic of congo":"DRC","dr congo":"DRC","kivu":"DRC","goma":"DRC",
    "syria":"Syria","damascus":"Syria","aleppo":"Syria",
    "somalia":"Somalia","mogadishu":"Somalia","al-shabaab":"Somalia",
    "haiti":"Haiti",
    "ethiopia":"Ethiopia","tigray":"Ethiopia","addis ababa":"Ethiopia",
    "armenia":"South Caucasus","azerbaijan":"South Caucasus","nagorno":"South Caucasus","karabakh":"South Caucasus",
    "libya":"Libya","tripoli":"Libya","benghazi":"Libya",
    "kosovo":"Kosovo","pristina":"Kosovo",
    "mozambique":"Mozambique","cabo delgado":"Mozambique",
}

def detect_region(text: str) -> str | None:
    t = text.lower()
    for key, region in COUNTRY_MAP.items():
        if key in t:
            return region
    scores = {r: sum(1 for kw in kws if kw in t) for r, kws in REGION_KEYWORDS.items()}
    scores = {r: s for r, s in scores.items() if s >= 2}
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

# ── LLM Security Filter ──────────────────────────────────────────────

def _is_security_incident_sync(title: str, description: str) -> bool:
    """
    LLM gate for RSS entries. FAIL CLOSED: if the LLM is unreachable, the
    article is REJECTED, not accepted. A missed real incident costs one news
    cycle (the next scrape or another source catches it); a flood of accepted
    garbage poisons the index and takes a manual purge to undo — asymmetric
    costs, so the gate closes on failure. (Postmortem: 2026-07-01, a broken
    import made this filter fail open and ~700 non-security articles were
    ingested in one run.)
    """
    # Cheap keyword pre-gate: no security-adjacent term anywhere -> reject
    # without spending an LLM call. The LLM then only adjudicates candidates.
    # Recall tradeoff is acceptable: the vocabulary below is deliberately broad,
    # and an incident phrased entirely without it is rare in security reporting.
    SECURITY_TERMS = (
        "attack","strike","airstrike","missile","drone","shell","bomb","explos",
        "troop","militar","soldier","army","navy","naval","air force","weapon",
        "clash","fight","combat","offensive","invasion","incursion","infiltrat",
        "cyberattack","hack","sabotage","kill","casualt","wounded","dead",
        "ceasefire","border","frontline","artillery","rocket","siege","ambush",
        "insurgen","militia","rebel","jihadi","terror","hostage","abduct",
        "warship","fighter jet","air defense","air defence","mobiliz","mobilis",
        "exercise","drill","deployment","escalat","occupation","annex","coup",
        "paramilitary","mercenar","wagner","spec ops","special forces","gunmen",
        "shooting","shot down","intercept","violation","airspace","blockade",
        "sanction","nuclear","icbm","ballistic","warhead","detonat","ied",
        "checkpoint","evacuat","martial law","curfew","armed"
    )
    text_l = f"{title} {description}".lower()
    if not any(t in text_l for t in SECURITY_TERMS):
        return False

    prompt = f"""Classify this news as SECURITY_INCIDENT or NOT_SECURITY.

SECURITY_INCIDENT = military attack, airstrike, shelling, drone strike, troop movement,
naval incident, cyberattack, cross-border firing, armed clash, ceasefire violation,
missile launch, bombing, occupation activity, infiltration, border incident.

NOT_SECURITY = diplomatic meeting, political statement, economic news, aid delivery,
refugee report, opinion piece, cultural event, election news, protest (non-violent),
legislation, trade deal, summit, press conference, crime story, accident,
sports, business, technology, entertainment.

Title: {title}
Description: {description[:200]}

Reply with EXACTLY one word: SECURITY_INCIDENT or NOT_SECURITY."""
    try:
        from app.llm.providers import call_llm
        raw = call_llm(prompt, tier="fast", max_tokens=5, temperature=0.0)
        if not raw:
            logger.warning("Security filter: empty LLM response — REJECTING article (fail closed)")
            return False
        return "SECURITY_INCIDENT" in raw.strip().upper()
    except Exception as e:
        logger.warning(f"Security filter unavailable — REJECTING article (fail closed): {e}")
        return False


async def is_security_incident(title: str, description: str) -> bool:
    """Async wrapper — runs Groq in thread to avoid blocking the event loop."""
    return await asyncio.to_thread(_is_security_incident_sync, title, description)

# ── HTTP Helpers ─────────────────────────────────────────────────────

async def _fetch(client: httpx.AsyncClient, url: str, delay: float = 15.0, **kwargs) -> httpx.Response | None:
    await asyncio.sleep(delay)
    for attempt in range(3):
        try:
            resp = await client.get(url, headers=HEADERS, timeout=25, follow_redirects=True, **kwargs)
            if resp.status_code == 429:
                wait = delay * (2 ** attempt)
                logger.warning(f"429 on {url[:60]}, waiting {wait:.0f}s")
                await asyncio.sleep(wait)
                continue
            if resp.status_code in [403, 503]:
                logger.warning(f"{resp.status_code} on {url[:60]}, skipping")
                return None
            return resp
        except Exception as e:
            logger.error(f"Fetch error {url[:60]}: {e}")
            if attempt < 2:
                await asyncio.sleep(delay * (2 ** attempt))
    return None

# ── RSS Sources ──────────────────────────────────────────────────────

RSS_SOURCES = [
    # (name, url, delay_s, default_region)
    # default_region: fallback when keyword detection fails — critical for
    # regional outlets whose headlines omit the country name entirely
    # ("Airspace violation reported over Hiiumaa" contains no "estonia").
    # None = cross-regional source, keyword detection only.

    # ── Cross-regional (original pool) ──────────────────────────────
    ("UN News",           "https://news.un.org/feed/subscribe/en/news/all/rss.xml", 4, None),
    ("UN Security Council","https://www.un.org/press/en/feed/sec-consolidated",    4, None),
    ("ICRC",              "https://www.icrc.org/en/rss/news",                        4, None),
    ("Human Rights Watch","https://www.hrw.org/rss",                                4, None),
    ("Amnesty Intl",      "https://www.amnesty.org/en/feed/",                       4, None),
    ("Bellingcat",        "https://www.bellingcat.com/feed/",                       4, None),
    ("RUSI",              "https://www.rusi.org/rss.xml",                           4, None),
    ("War on the Rocks",  "https://warontherocks.com/feed/",                        4, None),
    ("The Diplomat",      "https://thediplomat.com/feed/",                          4, None),
    ("Sudan Tribune",     "https://sudantribune.com/feed/",                         4, "Sudan"),
    ("Middle East Eye",   "https://www.middleeasteye.net/rss",                      4, None),
    ("Kyiv Independent",  "https://kyivindependent.com/feed/",                      4, "Ukraine"),
    ("ISW",               "https://www.understandingwar.org/rss.xml",               4, None),

    # ── Coverage-floor expansion, verified 2026-07-02 ────────────────
    # Baltic (was ~0 dedicated sources)
    ("ERR News",          "https://news.err.ee/rss",                                4, "Baltic"),
    ("LSM",               "https://eng.lsm.lv/rss/",                                4, "Baltic"),
    ("LRT English",       "https://www.lrt.lt/en/news-in-english?rss",              4, "Baltic"),
    ("Yle News",          "https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_NEWS", 4, "Baltic"),
    # Taiwan / SCS
    ("Taipei Times",      "https://www.taipeitimes.com/xml/index.rss",              4, "Taiwan Strait"),
    ("Focus Taiwan",      "https://feeds.feedburner.com/rsscna/politics",           4, "Taiwan Strait"),
    # Korean Peninsula
    ("38 North",          "https://www.38north.org/feed/",                          4, "Korean Peninsula"),
    ("NK News",           "https://www.nknews.org/feed/",                           4, "Korean Peninsula"),
    # South Caucasus (was 0 dedicated sources)
    ("OC Media",          "https://oc-media.org/feed/",                             4, "South Caucasus"),
    ("JAMnews",           "https://jam-news.net/feed/",                             4, "South Caucasus"),
    ("Civil.ge",          "https://civil.ge/feed",                                  4, "South Caucasus"),
    # Balkans / Kosovo
    ("Balkan Insight",    "https://balkaninsight.com/feed/",                        4, "Kosovo"),
    # Arctic
    ("Eye on the Arctic", "https://www.rcinet.ca/eye-on-the-arctic/feed/",          4, "Arctic"),
    # Haiti
    ("Haitian Times",     "https://haitiantimes.com/feed/",                         4, "Haiti"),
    # Africa cluster
    ("Radio Dabanga",     "https://www.dabangasudan.org/en/all-news/rss",           4, "Sudan"),
    ("Libya Herald",      "https://libyaherald.com/feed/",                          4, "Libya"),
    ("Somali Guardian",   "https://somaliguardian.com/feed/",                       4, "Somalia"),
    ("Ethiopia Observer", "https://www.ethiopiaobserver.com/feed/",                 4, "Ethiopia"),
    ("Zitamar News",      "https://zitamar.com/feed/",                              4, "Mozambique"),
    # Myanmar
    ("Myanmar Now",       "https://myanmar-now.org/en/feed/",                       4, "Myanmar"),
    ("DVB English",       "https://english.dvb.no/feed/",                           4, "Myanmar"),
    # Defence trade press (exercise signal, cross-regional)
    ("Breaking Defense",  "https://breakingdefense.com/feed/",                      4, None),
    ("Defense News",      "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml", 4, None),
    ("Naval News",        "https://www.navalnews.com/feed/",                        4, None),
    ("Kyiv Post",         "https://www.kyivpost.com/feed",                          4, "Ukraine"),
]

async def scrape_rss_all(db) -> int:
    inserted = 0
    skipped_non_security = 0
    cutoff = (date.today() - timedelta(days=60)).isoformat()
    async with httpx.AsyncClient(timeout=25) as client:
        for name, url, delay, default_region in RSS_SOURCES:
            try:
                resp = await _fetch(client, url, delay=delay)
                if not resp:
                    continue
                feed = feedparser.parse(resp.text)
                source_inserted = 0
                for entry in feed.entries[:30]:
                    title = entry.get("title","")
                    summary = entry.get("summary","") or ""
                    link = entry.get("link","")
                    if not title or not link:
                        continue
                    try:
                        ev_date = date(*entry.published_parsed[:3]).isoformat()
                    except Exception:
                        ev_date = date.today().isoformat()
                    if ev_date < cutoff:
                        continue
                    # Keyword detection first; regional-outlet fallback second.
                    # Local headlines often omit the country name entirely.
                    region = detect_region(f"{title} {summary}") or default_region
                    if not region:
                        continue
                    
                    # 🔒 LLM SECURITY FILTER
                    if not await is_security_incident(title, summary):
                        skipped_non_security += 1
                        continue
                    
                    record = {
                        "title": title[:200],
                        "description": extract_brief(summary),
                        "date": ev_date,
                        "source_url": link,
                        "source_name": name,
                        "region": region,
                        "category": "unknown",
                        "escalation_level": 2,
                        "raw_text": f"{title}. {summary}"[:500],
                    }
                    if insert_with_dedup(record, db):
                        inserted += 1
                        source_inserted += 1
                logger.info(f"[rss] {name}: +{source_inserted}")
            except Exception as e:
                logger.error(f"[rss] {name}: {e}")
    logger.info(f"[rss_all] total={inserted}, skipped_non_security={skipped_non_security}")
    return inserted

# ── ReliefWeb per-country ────────────────────────────────────────────

REGION_COUNTRIES = {
    "Gaza & Middle East": ["Palestine","Israel","Lebanon","Iraq"],
    "Ukraine":            ["Ukraine"],
    "Sudan":              ["Sudan","South Sudan"],
    "Yemen":              ["Yemen"],
    "Sahel":              ["Mali","Burkina Faso","Niger","Chad"],
    "Myanmar":            ["Myanmar"],
    "DRC":                ["Democratic Republic of the Congo"],
    "Syria":              ["Syria"],
    "Somalia":            ["Somalia"],
    "Haiti":              ["Haiti"],
    "Ethiopia":           ["Ethiopia"],
    "South Caucasus":     ["Armenia","Azerbaijan"],
    "Libya":              ["Libya"],
    "Mozambique":         ["Mozambique"],
    "Kosovo":             ["Kosovo"],
}

async def scrape_reliefweb(db) -> int:
    inserted = 0
    skipped_non_security = 0
    since = (date.today() - timedelta(days=60)).isoformat()
    async with httpx.AsyncClient(timeout=30) as client:
        for region, countries in REGION_COUNTRIES.items():
            for country in countries[:2]:
                await asyncio.sleep(3)
                try:
                    params = {
                        "appname": "threshold-jfki-fu-berlin",
                        "limit": 20,
                        "fields[include][]": ["title","body","source","date","url","primary_country"],
                        "filter[operator]": "AND",
                        "filter[conditions][0][field]": "primary_country.name",
                        "filter[conditions][0][value]": country,
                        "filter[conditions][1][field]": "date.created",
                        "filter[conditions][1][value]": since,
                        "filter[conditions][1][operator]": ">=",
                        "sort[]": "date.created:desc",
                    }
                    resp = await client.get("https://api.reliefweb.int/v1/reports", params=params, headers=HEADERS, timeout=25)
                    if resp.status_code != 200:
                        continue
                    for item in resp.json().get("data",[]):
                        f = item.get("fields",{})
                        title = f.get("title","")
                        body = clean_html(f.get("body","") or "")
                        url_field = f.get("url",{})
                        link = url_field.get("canonical","") if isinstance(url_field,dict) else str(url_field)
                        date_field = f.get("date",{})
                        date_str = date_field.get("created","")[:10] if isinstance(date_field,dict) else date.today().isoformat()
                        src = f.get("source",[])
                        source_name = src[0].get("name","ReliefWeb") if isinstance(src,list) and src else "ReliefWeb"
                        if not link or not title: continue
                        
                        # 🔒 LLM SECURITY FILTER
                        if not await is_security_incident(title, body):
                            skipped_non_security += 1
                            continue
                        
                        record = {
                            "title": title[:200],
                            "description": extract_brief(body),
                            "date": date_str,
                            "source_url": link,
                            "source_name": f"{source_name} (OCHA)",
                            "region": region,
                            "category": "unknown",
                            "escalation_level": 2,
                            "raw_text": f"{title}. {body[:300]}",
                        }
                        if insert_with_dedup(record, db):
                            inserted += 1
                except Exception as e:
                    logger.error(f"[reliefweb] {country}: {e}")
    logger.info(f"[reliefweb] inserted={inserted}, skipped_non_security={skipped_non_security}")
    return inserted

# ── Guardian API ─────────────────────────────────────────────────────

async def scrape_guardian(db) -> int:
    api_key = os.getenv("GUARDIAN_API_KEY")
    if not api_key:
        logger.info("[guardian] No API key, skipping")
        return 0
    inserted = 0
    skipped_non_security = 0
    since = (date.today() - timedelta(days=30)).isoformat()
    async with httpx.AsyncClient(timeout=20) as client:
        for region, keywords in REGION_KEYWORDS.items():
            q = " OR ".join(f'"{kw}"' for kw in keywords[:4])
            await asyncio.sleep(1)
            try:
                params = {"q":q,"from-date":since,"api-key":api_key,"page-size":10,"show-fields":"trailText"}
                resp = await client.get("https://content.guardianapis.com/search", params=params, timeout=15)
                if resp.status_code != 200:
                    continue
                for art in resp.json().get("response",{}).get("results",[]):
                    title = art.get("webTitle","")
                    link = art.get("webUrl","")
                    pub_date = art.get("webPublicationDate","")[:10]
                    desc = art.get("fields",{}).get("trailText","")
                    if not link or not title: continue
                    
                    # 🔒 LLM SECURITY FILTER
                    if not await is_security_incident(title, desc):
                        skipped_non_security += 1
                        continue
                    
                    record = {
                        "title": title[:200],
                        "description": extract_brief(clean_html(desc)),
                        "date": pub_date or date.today().isoformat(),
                        "source_url": link,
                        "source_name": "The Guardian",
                        "region": region,
                        "category": "unknown",
                        "escalation_level": 2,
                        "raw_text": f"{title}. {desc}"[:400],
                    }
                    if insert_with_dedup(record, db):
                        inserted += 1
            except Exception as e:
                logger.error(f"[guardian] {region}: {e}")
    logger.info(f"[guardian] inserted={inserted}, skipped_non_security={skipped_non_security}")
    return inserted

# ── Wikipedia Current Events ─────────────────────────────────────────

async def scrape_wikipedia(db) -> int:
    inserted = 0
    skipped_non_security = 0
    async with httpx.AsyncClient(timeout=20) as client:
        for days_ago in range(5):
            d = date.today() - timedelta(days=days_ago)
            url = f"https://en.wikipedia.org/wiki/Portal:Current_events/{d.strftime('%B_%-d,_%Y')}"
            await asyncio.sleep(2)
            try:
                resp = await client.get(url, headers=HEADERS, timeout=20)
                if not resp or resp.status_code != 200:
                    continue
                soup = BeautifulSoup(resp.text, "html.parser")
                items = soup.select("div.current-events-content li") or soup.select(".vevent li")
                for item in items:
                    text = item.get_text(separator=" ", strip=True)
                    if len(text) < 40 or len(text) > 600:
                        continue
                    region = detect_region(text)
                    if not region:
                        continue
                    
                    # 🔒 LLM SECURITY FILTER
                    if not await is_security_incident(text[:200], text[200:400]):
                        skipped_non_security += 1
                        continue
                    
                    import hashlib
                    source_url = f"https://en.wikipedia.org/wiki/Portal:Current_events/{d.strftime('%B_%-d,_%Y')}#{hashlib.md5(text[:50].encode()).hexdigest()[:8]}"
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
                    if insert_with_dedup(record, db):
                        inserted += 1
            except Exception as e:
                logger.error(f"[wiki] {d}: {e}")
    logger.info(f"[wikipedia] inserted={inserted}, skipped_non_security={skipped_non_security}")
    return inserted

# ── UN News RSS regional ─────────────────────────────────────────────

UN_REGIONAL_FEEDS = [
    ("https://news.un.org/feed/subscribe/en/news/region/africa/feed/rss.xml", "UN News Africa", 10),
    ("https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml", "UN News Middle East", 10),
    ("https://news.un.org/feed/subscribe/en/news/region/asia-pacific/feed/rss.xml", "UN News Asia-Pacific", 10),
    ("https://news.un.org/feed/subscribe/en/news/region/europe/feed/rss.xml", "UN News Europe", 10),
    ("https://news.un.org/feed/subscribe/en/news/topic/peace-and-security/feed/rss.xml", "UN News Peace", 10),
    ("https://news.un.org/feed/subscribe/en/news/topic/humanitarian-aid/feed/rss.xml", "UN News Humanitarian", 10),
]

async def scrape_un_news(db) -> int:
    inserted = 0
    skipped_non_security = 0
    cutoff = (date.today()-timedelta(days=60)).isoformat()
    async with httpx.AsyncClient(timeout=20) as client:
        for url, name, delay in UN_REGIONAL_FEEDS:
            await asyncio.sleep(delay)
            try:
                resp = await client.get(url, headers=HEADERS, timeout=20)
                if resp.status_code != 200: continue
                feed = feedparser.parse(resp.text)
                for entry in feed.entries[:40]:
                    title = entry.get("title","")
                    summary = entry.get("summary","") or ""
                    link = entry.get("link","")
                    if not title or not link: continue
                    try: ev_date = date(*entry.published_parsed[:3]).isoformat()
                    except: ev_date = date.today().isoformat()
                    if ev_date < cutoff: continue
                    region = detect_region(f"{title} {summary}")
                    if not region: continue
                    
                    # 🔒 LLM SECURITY FILTER
                    if not await is_security_incident(title, summary):
                        skipped_non_security += 1
                        continue
                    
                    record = {
                        "title": title[:200],
                        "description": extract_brief(summary),
                        "date": ev_date,
                        "source_url": link,
                        "source_name": name,
                        "region": region,
                        "category": "unknown",
                        "escalation_level": 2,
                        "raw_text": f"{title}. {summary}"[:500],
                    }
                    if insert_with_dedup(record, db): inserted += 1
            except Exception as e:
                logger.error(f"[un] {name}: {e}")
    logger.info(f"[un_news] inserted={inserted}, skipped_non_security={skipped_non_security}")
    return inserted

# ── UCDP ─────────────────────────────────────────────────────────────

async def scrape_ucdp(db) -> int:
    inserted = 0
    cutoff = (date.today()-timedelta(days=180)).isoformat()
    async with httpx.AsyncClient(timeout=30) as client:
        for year in [2025, 2024]:
            for page in range(1, 4):
                await asyncio.sleep(5)
                try:
                    resp = await client.get(
                        f"https://ucdpapi.pcr.uu.se/api/gedevents/{year}",
                        params={"pagesize":200,"page":page}, headers=HEADERS, timeout=25
                    )
                    if resp.status_code != 200: break
                    events = resp.json().get("Result",[])
                    if not events: break
                    for ev in events:
                        ev_date = ev.get("date_start","")[:10]
                        if ev_date < cutoff: continue
                        country = ev.get("country","")
                        where = ev.get("where_description","") or ev.get("adm_1","") or ""
                        side_a = ev.get("side_a","")
                        side_b = ev.get("side_b","")
                        deaths = int(ev.get("best",0) or 0)
                        conflict_name = ev.get("conflict_name","")
                        title = f"{conflict_name or 'Armed clash'}: {side_a} vs {side_b} in {where}, {country}"
                        source_url = f"https://ucdp.uu.se/event/{ev.get('id','')}"
                        region = detect_region(f"{country} {where} {conflict_name} {side_a} {side_b}")
                        if not region: continue
                        esc = min(5,max(1,1+(2 if deaths>=25 else 1 if deaths>=5 else 0)))
                        
                        # UCDP events are verified security incidents by definition — no LLM filter needed
                        
                        record = {
                            "title": title[:200],
                            "description": f"{deaths} deaths. UCDP verified.",
                            "date": ev_date,
                            "source_url": source_url,
                            "source_name": "UCDP (Uppsala University)",
                            "region": region,
                            "actors": [a for a in [side_a,side_b] if a],
                            "category": "proxy",
                            "escalation_level": esc,
                            "raw_text": title[:400],
                        }
                        if insert_with_dedup(record, db): inserted += 1
                except Exception as e:
                    logger.error(f"[ucdp] {year} page {page}: {e}")
                    break
    logger.info(f"[ucdp] inserted={inserted}")
    return inserted

# ── Master scrape ────────────────────────────────────────────────────

async def scrape_all_sources(db=None) -> dict:
    if db is None: db = get_client()
    rss     = await scrape_rss_all(db)
    rw      = await scrape_reliefweb(db)
    guardian= await scrape_guardian(db)
    wiki    = await scrape_wikipedia(db)
    un      = await scrape_un_news(db)
    ucdp    = await scrape_ucdp(db)
    total   = rss + rw + guardian + wiki + un + ucdp
    logger.info(f"[scrape_all] total={total}")
    return {"rss":rss,"reliefweb":rw,"guardian":guardian,"wikipedia":wiki,"un_news":un,"ucdp":ucdp,"total":total}

# ── New sources added in v7.2 ────────────────────────────────────────

NEW_RSS_SOURCES = [
    ("SIPRI",              "https://www.sipri.org/news/rss",                          20),
    ("Atlantic Council",   "https://www.atlanticcouncil.org/feed/",                   20),
    ("Carnegie Endowment", "https://carnegieendowment.org/rss/",                      20),
    ("CSIS",               "https://www.csis.org/programs/defense-and-security/rss",  20),
    ("Crisis Group ICG",   "https://www.crisisgroup.org/rss",                         20),
    ("Defense News",       "https://www.defensenews.com/rss/",                        20),
    ("Small Wars Journal", "https://smallwarsjournal.com/rss",                        15),
]

async def scrape_new_sources(db=None) -> int:
    if db is None: db = get_client()
    inserted = 0
    cutoff = (date.today() - timedelta(days=60)).isoformat()
    async with httpx.AsyncClient(timeout=25) as client:
        for name, url, delay in NEW_RSS_SOURCES:
            try:
                resp = await _fetch(client, url, delay=delay)
                if not resp: continue
                feed = feedparser.parse(resp.text)
                src_count = 0
                for entry in feed.entries[:25]:
                    title = entry.get("title","")
                    summary = entry.get("summary","") or ""
                    link = entry.get("link","")
                    if not title or not link: continue
                    try: ev_date = date(*entry.published_parsed[:3]).isoformat()
                    except: ev_date = date.today().isoformat()
                    if ev_date < cutoff: continue
                    region = detect_region(f"{title} {summary}")
                    if not region: continue
                    record = {
                        "title": title[:200],
                        "description": extract_brief(summary),
                        "date": ev_date,
                        "source_url": link,
                        "source_name": name,
                        "region": region,
                        "category": "unknown",
                        "escalation_level": 2,
                        "raw_text": f"{title}. {summary}"[:500],
                    }
                    if insert_with_dedup(record, db):
                        inserted += 1; src_count += 1
                logger.info(f"[new_rss] {name}: +{src_count}")
            except Exception as e:
                logger.error(f"[new_rss] {name}: {e}")
    logger.info(f"[new_sources] total={inserted}")
    return inserted

async def scrape_gdelt(db=None) -> int:
    """GDELT DOC API — real-time conflict event stream."""
    if db is None: db = get_client()
    inserted = 0
    cutoff = (date.today() - timedelta(days=7)).isoformat()
    queries = ["military exercise NATO","conflict escalation","ceasefire violation","armed attack"]
    async with httpx.AsyncClient(timeout=20) as client:
        for q in queries:
            await asyncio.sleep(10)
            try:
                params = {"query":q,"mode":"artlist","maxrecords":"25","format":"json","timespan":"7DAYS","sort":"DateDesc"}
                resp = await client.get("https://api.gdeltproject.org/api/v2/doc/doc", params=params, headers=HEADERS, timeout=20)
                if resp.status_code != 200: continue
                data = resp.json()
                for art in (data.get("articles") or []):
                    title = art.get("title","")
                    url = art.get("url","")
                    seendate = art.get("seendate","")
                    if not title or not url: continue
                    ev_date = seendate[:8]
                    try: ev_date = date(int(ev_date[:4]),int(ev_date[4:6]),int(ev_date[6:8])).isoformat()
                    except: ev_date = date.today().isoformat()
                    if ev_date < cutoff: continue
                    region = detect_region(title)
                    if not region: continue
                    record = {
                        "title": title[:200],
                        "description": art.get("seendate","")[:280],
                        "date": ev_date,
                        "source_url": url,
                        "source_name": f"GDELT ({art.get('domain','')})",
                        "region": region,
                        "category": "unknown",
                        "escalation_level": 2,
                        "raw_text": title[:400],
                    }
                    if insert_with_dedup(record, db): inserted += 1
            except Exception as e:
                logger.error(f"[gdelt] {q}: {e}")
    logger.info(f"[gdelt] inserted={inserted}")
    return inserted

# Override master scrape to include new sources
_original_scrape_all = scrape_all_sources

async def scrape_all_sources(db=None) -> dict:
    if db is None: db = get_client()
    rss     = await scrape_rss_all(db)
    rw      = await scrape_reliefweb(db)
    guardian= await scrape_guardian(db)
    wiki    = await scrape_wikipedia(db)
    un      = await scrape_un_news(db)
    ucdp    = await scrape_ucdp(db)
    new     = await scrape_new_sources(db)
    gdelt   = await scrape_gdelt(db)
    total   = rss + rw + guardian + wiki + un + ucdp + new + gdelt
    logger.info(f"[scrape_all] total={total}")
    return {"rss":rss,"reliefweb":rw,"guardian":guardian,"wikipedia":wiki,"un_news":un,"ucdp":ucdp,"new_sources":new,"gdelt":gdelt,"total":total}
