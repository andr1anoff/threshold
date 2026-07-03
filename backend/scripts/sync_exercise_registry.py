"""
Sync the curated exercise registry (data/exercises_registry.yaml) into the
`exercises` table. Idempotent: upserts by registry_id, so re-running after a
registry edit updates records in place and never duplicates.

Usage (from backend/):
    SUPABASE_URL=... SUPABASE_KEY=... python3.11 scripts/sync_exercise_registry.py

Requires: pip3.11 install pyyaml --user  (one-time)

Design note: this script is the ONLY writer for registry-sourced exercises.
The LLM classifier may later enrich rhetoric_score, but names, dates, scale
and regions in the registry are human-curated with a source URL per entry —
see the registry header for the rules.
"""
import os
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("pyyaml missing: pip3.11 install pyyaml --user")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.db.supabase import get_client  # noqa: E402

REGISTRY = Path(__file__).resolve().parents[1] / "data" / "exercises_registry.yaml"


def main() -> None:
    with open(REGISTRY) as f:
        registry = yaml.safe_load(f)

    entries = registry.get("exercises", [])
    if not entries:
        sys.exit("Registry is empty — refusing to sync.")

    db = get_client()
    created, updated = 0, 0

    for e in entries:
        rid = e["id"]
        row = {
            "registry_id": rid,
            "name": e["name"],
            "exercise_type": e.get("exercise_type"),
            "lead_nation": e.get("lead_nation"),
            "participants": [x.strip() for x in e["participants"].split(",")] if e.get("participants") else None,
            "domain": e.get("domain"),
            "region": e.get("region"),
            "start_date": str(e["start_date"]),
            "end_date": str(e["end_date"]),
            "scale": e.get("scale"),
            "lat": e.get("lat"),
            "lng": e.get("lng"),
            "signal_target": e.get("signal_target"),
            "announcement_status": e.get("status", "projected"),
            "source_url": e.get("source"),
            "notes": e.get("notes"),
        }
        existing = db.table("exercises").select("id").eq("registry_id", rid).execute()
        if existing.data:
            db.table("exercises").update(row).eq("registry_id", rid).execute()
            updated += 1
        else:
            db.table("exercises").insert(row).execute()
            created += 1

    print(f"Registry sync: {created} created, {updated} updated, {len(entries)} total entries.")
    print("Reminder: run rebuild_history.py so the EX component picks up the changes.")


if __name__ == "__main__":
    main()
