#!/usr/bin/env python3
"""
audit_state.py — what is actually in the database, measured not assumed.

Before any backtest is designed, the inputs it would run on have to be known:
how deep the history goes, how escalation levels are distributed, how many
exercises carry a scale, and which regions sit in the kappa regimes that make
the index behave differently.

Everything here calls the live calculator's own functions. Nothing is
reimplemented, because a reimplementation is what produced two days of results
about a formula the project does not use.

Usage, from backend/:
    SUPABASE_URL=... SUPABASE_KEY=... python3.11 scripts/audit_state.py
    python3.11 scripts/audit_state.py --region Baltic     # one region in detail

Read-only. Writes nothing.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.supabase import get_client                      # noqa: E402
from app.di.calculator import (                             # noqa: E402
    BASELINE_WINDOW, COLD_START_MIN_DAYS, CONFLICT_BASELINE, KAPPA,
    KAPPA_FLOOR, LOAD_WINDOW, NORM_C, REGIONS,
    _kappa_for_region, _load_from_events, _median,
)
from app.scrapers.event_grouper import group_into_events    # noqa: E402


def rule(title: str) -> None:
    print(f"\n{title}\n{'-' * len(title)}")


def fetch_all(db, table: str, cols: str, page: int = 1000) -> list[dict]:
    """Supabase caps a single select; page through it."""
    out, start = [], 0
    while True:
        chunk = db.table(table).select(cols).range(start, start + page - 1).execute().data
        out.extend(chunk)
        if len(chunk) < page:
            return out
        start += page


def audit_incidents(db) -> list[dict]:
    rows = fetch_all(db, "incidents", "id,date,title,region,category,escalation_level")
    rule(f"incidents: {len(rows):,} rows")
    if not rows:
        print("  empty")
        return rows

    dates = sorted(r["date"] for r in rows if r.get("date"))
    print(f"  date range        {dates[0]} .. {dates[-1]}  "
          f"({(date.fromisoformat(dates[-1]) - date.fromisoformat(dates[0])).days} days)")

    lv = Counter(int(r.get("escalation_level") or 0) for r in rows)
    print("  escalation_level  " + "  ".join(
        f"{k}:{lv.get(k, 0):,}" for k in sorted(lv)))
    top = lv.most_common(1)[0]
    print(f"                    level {top[0]} is {100*top[1]/len(rows):.0f}% of all rows")

    cat = Counter(r.get("category") or "NULL" for r in rows)
    dead = sum(cat.get(c, 0) for c in ("unknown", "unclassifiable", "none", "NULL"))
    print(f"  unclassified      {dead:,} ({100*dead/len(rows):.1f}%) across "
          f"unknown / unclassifiable / none / null")
    print("  categories        " + ", ".join(
        f"{c}:{n:,}" for c, n in cat.most_common(6)))

    noreg = sum(1 for r in rows if not r.get("region"))
    offreg = Counter(r["region"] for r in rows
                     if r.get("region") and r["region"] not in REGIONS)
    print(f"  no region         {noreg:,}")
    if offreg:
        print(f"  region not in REGIONS  {dict(offreg.most_common(5))}")
    return rows


def audit_exercises(db) -> list[dict]:
    rows = fetch_all(db, "exercises",
                     "id,name,region,start_date,end_date,scale,rhetoric_score,"
                     "announcement_status,registry_id,source_url")
    rule(f"exercises: {len(rows):,} rows")
    if not rows:
        print("  empty. EX is structurally zero for every region.")
        return rows

    live = [r for r in rows if r.get("announcement_status") != "archived-manual"]
    print(f"  active (not archived-manual)  {len(live):,}")
    no_scale = sum(1 for r in live if r.get("scale") in (None, 0))
    print(f"  scale is NULL or zero         {no_scale:,} "
          f"({100*no_scale/max(len(live),1):.0f}%)")
    if no_scale:
        print(f"    each of those contributes 5000/80000 = 0.0625 to EX by the")
        print(f"    `(scale or 5000)` default, not zero. That is a silent floor.")

    no_rh = sum(1 for r in live if r.get("rhetoric_score") is None)
    print(f"  rhetoric_score NULL           {no_rh:,} "
          f"({100*no_rh/max(len(live),1):.0f}%)   "
          f"[reported as rh_score, not used in EI]")
    no_reg = sum(1 for r in live if not r.get("region"))
    print(f"  no region assigned            {no_reg:,}   [cannot reach any EX]")
    from_registry = sum(1 for r in live if r.get("registry_id"))
    print(f"  from versioned registry       {from_registry:,} of {len(live):,}")

    starts = sorted(r["start_date"] for r in live if r.get("start_date"))
    if starts:
        print(f"  start_date range              {starts[0]} .. {starts[-1]}")
    per_region = Counter(r.get("region") or "NULL" for r in live)
    print("  per region                    " + ", ".join(
        f"{k}:{v}" for k, v in per_region.most_common(8)))
    return rows


def audit_index(db) -> None:
    rows = fetch_all(db, "escalation_index",
                     "region,date,ei_score,gz_score,ex_score,methodology_version")
    rule(f"escalation_index: {len(rows):,} stored daily points")
    if not rows:
        print("  empty")
        return
    dates = sorted(r["date"] for r in rows)
    print(f"  date range        {dates[0]} .. {dates[-1]}")
    ver = Counter(r.get("methodology_version") or "NULL" for r in rows)
    print(f"  methodology       {dict(ver)}")
    if len(ver) > 1:
        print("    Mixed versions. Any history chart spanning these is a mix of")
        print("    formulas; rebuild_history.py exists to normalise that.")
    per = Counter(r["region"] for r in rows)
    thin = {k: v for k, v in per.items() if v < 30}
    if thin:
        print(f"  regions with under 30 stored days: {thin}")


def audit_kappa(db, rows: list[dict], only: str | None) -> None:
    """
    Which kappa regime each region is in, computed with the live function.

    Three regimes behave differently and the difference is large:
      cold start   no usable history, legacy global kappa = 15
      floored      median is zero but enough non-zero days, kappa pinned at 3
      normalised   kappa tracks the region's own trailing median

    The floored band is where a stale event can outscore a fresh one, because
    the cold-start guard has switched off while the median is still zero.
    """
    rule("kappa regime per region, via the live _kappa_for_region")
    today = date.today()
    by_region: dict[str, list[dict]] = defaultdict(list)
    cutoff = (today - timedelta(days=LOAD_WINDOW + BASELINE_WINDOW)).isoformat()
    for r in rows:
        if r.get("region") and str(r.get("date") or "") >= cutoff:
            by_region[r["region"]].append(r)

    print(f"  {'region':<22}{'events':>7}{'load':>8}{'nonzero':>9}"
          f"{'median':>9}{'kappa':>8}  regime")
    banded = []
    for region in (REGIONS if not only else [only]):
        raw = by_region.get(region, [])
        events = group_into_events(raw)
        k = _kappa_for_region(events, today)
        load = _load_from_events(events, today)
        loads = [_load_from_events(events, today - timedelta(days=d))
                 for d in range(1, BASELINE_WINDOW + 1)]
        med = _median(loads)
        nz = sum(1 for x in loads if x > 0)
        if k == KAPPA and med <= 0:
            regime = "cold start"
        elif abs(k - KAPPA_FLOOR) < 1e-9:
            regime = "FLOORED"
            banded.append(region)
        else:
            regime = "normalised"
        print(f"  {region:<22}{len(events):>7}{load:>8.2f}{nz:>9}"
              f"{med:>9.2f}{k:>8.2f}  {regime}")

    if banded:
        print(f"\n  {len(banded)} region(s) sit at the kappa floor: "
              f"{', '.join(banded)}")
        print("  In that regime GZ is very sensitive by design, and the recency")
        print("  invariant can invert: a 20-day-old event can score above a")
        print("  fresher one, because the cold-start guard is off while the")
        print("  median is still zero. test_recent_events_weigh_more does not")
        print("  catch this, since it passes a fixed kappa instead of the")
        print("  per-region one.")


def audit_backtest_feasibility(db, rows: list[dict]) -> None:
    rule("what a backtest could actually run on")
    if not rows:
        print("  no incidents; nothing to run on")
        return
    dates = sorted(r["date"] for r in rows if r.get("date"))
    span = (date.fromisoformat(dates[-1]) - date.fromisoformat(dates[0])).days
    usable = max(0, span - LOAD_WINDOW - BASELINE_WINDOW)
    print(f"  incident history      {span} days")
    print(f"  minus warm-up         {LOAD_WINDOW + BASELINE_WINDOW} days "
          f"(30d load window + 90d baseline)")
    print(f"  scorable window       {usable} days")
    if usable <= 0:
        print("\n  The history is shorter than the warm-up the index needs, so")
        print("  no day in it can be scored with a per-region kappa. Anything")
        print("  computed today runs on the cold-start fallback.")
    elif usable < 60:
        print("\n  Enough to check that the instrument behaves, not enough for")
        print("  an event study. Treat any run on this as diagnostics.")
    print("\n  The README names Crimea 2014, Nagorno-Karabakh 2020 and February")
    print("  2022 as the intended validation anchors. None fall inside this")
    print("  window, and the feeds are RSS with no archive, so reaching them")
    print("  means running the classifier over a historical corpus first.")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", default=None, help="detail one region only")
    a = ap.parse_args()

    for var in ("SUPABASE_URL", "SUPABASE_KEY"):
        if not os.environ.get(var):
            print(f"{var} is not set")
            return 1

    db = get_client()
    print("Threshold state audit. Read-only.")
    rows = audit_incidents(db)
    audit_exercises(db)
    audit_index(db)
    if rows:
        audit_kappa(db, rows, a.region)
        audit_backtest_feasibility(db, rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
