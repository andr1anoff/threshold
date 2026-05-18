import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.scrapers.universal_scraper import scrape_all_sources
from app.scrapers.ukraine_osint import scrape_ukraine_osint
from app.scrapers.jme_scraper import scrape_all_exercises
from app.llm.classifier import run_classification_pipeline
from app.llm.exercise_classifier import classify_all_exercises
from app.di.calculator import calculate_all_regions
from app.db.supabase import get_client

async def main():
    db = get_client()
    print("=== Scraping incidents ===")
    result = await scrape_all_sources(db)
    print(f"Sources: {result}")

    print("=== Scraping Ukraine OSINT ===")
    ukraine = await scrape_ukraine_osint(db)
    print(f"Ukraine: {ukraine}")

    print("=== Scraping JMEs ===")
    exercises = await scrape_all_exercises(db)
    print(f"Exercises: {exercises}")

    print("=== Classifying incidents ===")
    classified = run_classification_pipeline(db)
    print(f"Classified: {classified}")

    print("=== Classifying exercises (NATO taxonomy + LLM) ===")
    ex_classified = classify_all_exercises(db)
    print(f"Exercises classified: {ex_classified}")

    print("=== Calculating Escalation Index ===")
    ei = calculate_all_regions()
    for r in ei:
        print(f"{r['region']}: EI={r['ei_score']} ({r['incident_count_30d']} events)")

    print("=== Done ===")

asyncio.run(main())
