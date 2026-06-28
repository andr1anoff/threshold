"""
recanonicalize_regions.py — one-off backfill.

Re-resolves the `region` field for every existing incident using the central
resolver. Incidents currently sitting in "Unknown" or a non-canonical region
(e.g. raw "Lebanon", "Middle East", a country name) get mapped onto one of the
20 canonical regions, so they start counting in the index.

Run once after deploying the region fix:
    cd backend
    source venv/bin/activate         # if local
    python scripts/recanonicalize_regions.py

Needs SUPABASE_URL and SUPABASE_KEY in the environment (same as the app).
Idempotent: safe to run multiple times.
"""
import os
import sys
from collections import Counter

# allow "python scripts/recanonicalize_regions.py" from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.supabase import get_client
from app.regions import canonicalize, resolve, REGIONS, is_canonical


def main():
    db = get_client()
    print("Fetching all incidents…")
    rows = db.table("incidents").select(
        "id,region,title,raw_text,description"
    ).execute().data
    print(f"  {len(rows)} incidents total")

    changed = 0
    moved = Counter()
    still_unknown = 0

    for inc in rows:
        old = inc.get("region")
        # already on a canonical region and not the generic bucket -> leave it
        if is_canonical(old) and old != "Unknown":
            continue
        new = (canonicalize(old)
               or resolve(inc.get("title", ""),
                          inc.get("raw_text", ""),
                          inc.get("description", "")))
        if not new:
            still_unknown += 1
            continue
        if new != old:
            try:
                db.table("incidents").update({"region": new}).eq("id", inc["id"]).execute()
                changed += 1
                moved[f"{old or 'NULL'} -> {new}"] += 1
            except Exception as e:
                print(f"  ! failed {inc['id']}: {e}")

    print(f"\nUpdated {changed} incidents. {still_unknown} still unresolved.")
    if moved:
        print("\nTop remappings:")
        for k, v in moved.most_common(20):
            print(f"  {v:4d}  {k}")
    print("\nDone. Now recalculate the index:")
    print("  curl -X POST $RAILWAY_URL/api/admin/calculate-di")


if __name__ == "__main__":
    main()
