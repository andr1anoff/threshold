"""
Bootstrap script — run once after deployment to populate all data.
Scrapes last 35 days, classifies, calculates DI for all 20 regions.

Usage: python bootstrap.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.supabase import get_client
from app.scrapers.feeds import scrape_all_feeds, scrape_reliefweb, scrape_gdelt, scrape_acled
from app.scrapers.ukraine_osint import scrape_ukraine_osint
from app.llm.classifier import run_classification_pipeline, cross_verify_incidents
from app.di.calculator import calculate_all_regions


async def bootstrap():
    print("=" * 60)
    print("THRESHOLD BOOTSTRAP — populating last 35 days")
    print("=" * 60)
    db = get_client()

    print("\n[1/6] Scraping RSS feeds (NATO, ISW, Reuters, etc.)...")
    feeds = await scrape_all_feeds(db)
    print(f"  → {feeds['incidents']} incidents, {feeds['exercises']} exercises")

    print("\n[2/6] Scraping OCHA/ReliefWeb (conflict data)...")
    rw = await scrape_reliefweb(db)
    print(f"  → {rw} reports")

    print("\n[3/6] Scraping Ukraine OSINT (DeepState, CIT, Mash)...")
    ua = await scrape_ukraine_osint(db)
    print(f"  → {ua['inserted']} events, {ua['unverified_flagged']} flagged unverified")

    print("\n[4/6] Scraping GDELT (with rate limiting)...")
    gdelt = await scrape_gdelt(db)
    print(f"  → {gdelt} events")

    print("\n[5/6] Scraping ACLED (if configured)...")
    acled = await scrape_acled(db)
    print(f"  → {acled} events")

    print("\n[6/6] LLM classification pipeline...")
    classified = run_classification_pipeline(db)
    verified = cross_verify_incidents(db)
    print(f"  → {classified['incidents']} incidents classified, {classified['exercises']} exercises analyzed")
    print(f"  → {verified['verified']} cross-verified")

    print("\n[7/7] Calculating Deterrence Index for all 20 regions...")
    di_results = calculate_all_regions()
    for r in di_results:
        print(f"  {r['region']}: DI={r['ei_score']}")

    print("\n" + "=" * 60)
    print("BOOTSTRAP COMPLETE")
    total_inc = db.table("incidents").select("id", count="exact").execute().count
    total_ex = db.table("exercises").select("id", count="exact").execute().count
    print(f"  Total incidents in DB: {total_inc}")
    print(f"  Total exercises in DB: {total_ex}")
    print(f"  DI calculated for: {len(di_results)} regions")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(bootstrap())
