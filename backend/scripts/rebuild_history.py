"""
rebuild_history.py — recompute the full daily index history with the v16 formula.

Why:
  deterrence_index stores one row per region per day. Those historical rows were
  written by older formula versions, so the history chart is a mix of old and new
  math (flat steps, a jump at the last point). This recomputes every day in the
  window with the current event-based, severity-dominant formula, using each
  day's correct 30-day window (the calculator now bounds incidents by
  date <= target_date, so no lookahead).

Run once (after deploying the di calculator date-bound fix):
    cd backend
    python scripts/rebuild_history.py            # default: last 45 days
    python scripts/rebuild_history.py 60         # custom day count

Needs SUPABASE_URL / SUPABASE_KEY in env. Idempotent (upsert on region,date).
"""
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.di.calculator import calculate_ei, REGIONS


def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 45
    today = date.today()
    print(f"Rebuilding {days} days of history for {len(REGIONS)} regions "
          f"({days * len(REGIONS)} recomputations)…")

    written = 0
    for d_off in range(days, -1, -1):
        target = today - timedelta(days=d_off)
        for region in REGIONS:
            try:
                calculate_ei(region, target)   # computes + upserts that day's row
                written += 1
            except Exception as e:
                print(f"  ! {region} {target}: {e}")
        if d_off % 10 == 0:
            print(f"  …{target.isoformat()} done")

    print(f"\nDone. {written} daily points recomputed with v16 formula.")


if __name__ == "__main__":
    main()
