"""
APScheduler — runs scrape every 12h, classify+DI every 12h (offset by 2h).
Calls functions directly, no HTTP self-calls.
"""
import logging
import asyncio
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

def start_scheduler():
    scheduler = BackgroundScheduler(timezone="UTC")

    @scheduler.scheduled_job(IntervalTrigger(hours=12), id="scrape", next_run_time=None)
    def scheduled_scrape():
        logger.info("=== Scheduled scrape starting ===")
        try:
            from app.scrapers.universal_scraper import scrape_all_sources
            from app.scrapers.ukraine_osint import scrape_ukraine_osint
            from app.db.supabase import get_client
            db = get_client()
            result = asyncio.run(scrape_all_sources(db))
            ua = asyncio.run(scrape_ukraine_osint(db))
            logger.info(f"Scrape done: {result}, ukraine: {ua}")
        except Exception as e:
            logger.exception(f"Scheduled scrape failed: {e}")

    @scheduler.scheduled_job(IntervalTrigger(hours=12, start_date="2026-01-01 02:00:00"), id="analyze")
    def scheduled_analyze():
        logger.info("=== Scheduled classify+DI starting ===")
        try:
            from app.llm.classifier import run_classification_pipeline
            from app.di.calculator import calculate_all_regions
            from app.db.supabase import get_client
            db = get_client()
            classified = run_classification_pipeline(db)
            di = calculate_all_regions()
            logger.info(f"Classify done: {classified}, DI regions: {len(di)}")
        except Exception as e:
            logger.exception(f"Scheduled analysis failed: {e}")

    scheduler.start()
    logger.info("Scheduler started: scrape every 12h, classify+DI every 12h (offset 2h)")
    return scheduler
