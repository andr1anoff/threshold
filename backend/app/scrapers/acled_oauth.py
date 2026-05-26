"""
ACLED scraper with OAuth authentication.
Fetches conflict events for all 20 Threshold regions.
"""
import os
import httpx
import asyncio
from datetime import date, timedelta
from app.scrapers.feeds import detect_region, extract_brief

# ACLED country mapping per region
REGION_COUNTRIES = {
    "Gaza & Middle East": "Israel:OR:country=Palestine:OR:country=Lebanon:OR:country=Syria:OR:country=Yemen:OR:country=Iran:OR:country=Iraq",
    "Ukraine": "Ukraine:OR:country=Russia",
    "Sudan": "Sudan:OR:country=South Sudan",
    "South China Sea": "Philippines:OR:country=Vietnam:OR:country=China:OR:country=Malaysia",
    "Taiwan Strait": "Taiwan",
    "Yemen": "Yemen",
    "Sahel": "Mali:OR:country=Burkina Faso:OR:country=Niger:OR:country=Chad:OR:country=Nigeria",
    "Korean Peninsula": "South Korea:OR:country=North Korea",
    "Myanmar": "Myanmar",
    "DRC": "Democratic Republic of Congo",
    "Syria": "Syria",
    "Somalia": "Somalia:OR:country=Ethiopia:OR:country=Kenya",
    "Baltic": "Estonia:OR:country=Latvia:OR:country=Lithuania:OR:country=Finland",
    "Haiti": "Haiti",
    "Ethiopia": "Ethiopia",
    "South Caucasus": "Armenia:OR:country=Azerbaijan:OR:country=Georgia",
    "Libya": "Libya",
    "Kosovo": "Kosovo:OR:country=Serbia",
    "Arctic": "Norway:OR:country=Russia",
    "Mozambique": "Mozambique",
}

ACLED_CATS = {
    "Battles": "proxy",
    "Explosions/Remote violence": "proxy",
    "Violence against civilians": "proxy",
    "Protests": "disinfo",
    "Riots": "proxy",
    "Strategic developments": "proxy",
}


async def get_acled_token(email: str, password: str) -> str | None:
    """Get OAuth bearer token from ACLED."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://acleddata.com/oauth/token",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "username": email,
                    "password": password,
                    "grant_type": "password",
                    "client_id": "acled",
                    "scope": "authenticated",
                }
            )
            if resp.status_code == 200:
                return resp.json().get("access_token")
            else:
                print(f"[acled_oauth] Token error {resp.status_code}: {resp.text[:200]}")
                return None
    except Exception as e:
        print(f"[acled_oauth] Token exception: {e}")
        return None


async def scrape_acled_oauth(db) -> int:
    email = os.getenv("ACLED_EMAIL")
    password = os.getenv("ACLED_PASSWORD")

    if not email or not password:
        print("[acled_oauth] No credentials, skipping")
        return 0

    print("[acled_oauth] Getting OAuth token...")
    token = await get_acled_token(email, password)
    if not token:
        print("[acled_oauth] Failed to get token")
        return 0

    since = (date.today() - timedelta(days=35)).strftime("%Y-%m-%d")
    today = date.today().strftime("%Y-%m-%d")
    inserted = 0
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        for region, countries in REGION_COUNTRIES.items():
            try:
                await asyncio.sleep(1)  # polite delay between regions
                resp = await client.get(
                    "https://acleddata.com/api/acled/read",
                    headers=headers,
                    params={
                        "_format": "json",
                        "country": countries,
                        "event_date": f"{since}|{today}",
                        "event_date_where": "BETWEEN",
                        "fields": "event_date|event_type|sub_event_type|actor1|actor2|country|location|notes|source|fatalities|latitude|longitude",
                        "limit": 100,
                    }
                )

                if resp.status_code != 200:
                    print(f"[acled_oauth] {region}: HTTP {resp.status_code}")
                    continue

                data = resp.json()
                if data.get("status") != 200:
                    print(f"[acled_oauth] {region}: API status {data.get('status')}")
                    continue

                events = data.get("data", [])
                reg_inserted = 0

                for ev in events:
                    title = f"{ev.get('sub_event_type') or ev.get('event_type','')} in {ev.get('location','')}, {ev.get('country','')}"
                    actor1 = ev.get("actor1", "")
                    actor2 = ev.get("actor2", "")
                    notes = ev.get("notes", "")
                    ev_date = ev.get("event_date", today)
                    source = ev.get("source", "ACLED")
                    fat = int(ev.get("fatalities", 0) or 0)

                    # Unique URL from event data
                    source_url = f"https://acleddata.com/data/?country={ev.get('country','').replace(' ','+')}#{ev.get('event_date','')}-{ev.get('location','').replace(' ','')}"

                    existing = db.table("incidents").select("id").eq("source_url", source_url).execute()
                    if existing.data:
                        continue

                    esc = min(5, max(1,
                        1
                        + (2 if fat >= 10 else 1 if fat >= 1 else 0)
                        + (2 if ev.get("event_type") in ["Battles", "Explosions/Remote violence"] else 0)
                    ))

                    db.table("incidents").insert({
                        "title": title[:200],
                        "description": extract_brief(notes),
                        "date": ev_date,
                        "source_url": source_url,
                        "source_name": f"ACLED ({source})",
                        "region": region,
                        "actors": [a for a in [actor1, actor2] if a],
                        "category": ACLED_CATS.get(ev.get("event_type", ""), "unknown"),
                        "escalation_level": esc,
                        "raw_text": f"{title}. {notes}"[:600],
                    }).execute()
                    reg_inserted += 1

                inserted += reg_inserted
                print(f"[acled_oauth] {region}: +{reg_inserted}")

            except Exception as e:
                print(f"[acled_oauth] {region} error: {e}")

    print(f"[acled_oauth] Total inserted: {inserted}")
    return inserted
