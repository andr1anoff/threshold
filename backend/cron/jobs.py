import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.scrapers.nato_shape import scrape_nato_exercises, scrape_gdelt_incidents
from app.di.calculator import calculate_all_regions

scheduler = AsyncIOScheduler()


def setup_jobs():
    # Scrape NATO SHAPE every 6 hours
    scheduler.add_job(
        lambda: asyncio.create_task(scrape_nato_exercises()),
        "interval",
        hours=6,
        id="nato_scraper",
    )

    # Scrape GDELT every 4 hours
    scheduler.add_job(
        lambda: asyncio.create_task(scrape_gdelt_incidents()),
        "interval",
        hours=4,
        id="gdelt_scraper",
    )

    # Recalculate Deterrence Index daily at 06:00
    scheduler.add_job(
        calculate_all_regions,
        "cron",
        hour=6,
        minute=0,
        id="di_calculator",
    )

    scheduler.start()
    print("[cron] Scheduler started")
