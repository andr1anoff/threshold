#!/usr/bin/env python3
"""
Collapse candidate articles into distinct exercises.

The unit of the product is an exercise, not an article. BALTOPS 2024 is one row
in the registry however many hundred articles covered it. Everything measured
per-article answers a question about the filter rather than about the registry.

This script groups the candidate URLs by exercise identity, derived from the
URL slug plus the article date. It is fully deterministic: no model, no API, no
rate limit, no labelling. Each cluster it produces is a prospective registry row
and a bundle of sources to extract that row from.

Two numbers come out of it:

  * how many distinct exercises the candidate set actually contains, which is
    the registry's starting size
  * how many articles per exercise, which sets the real extraction budget --
    you need a handful of sources per exercise for cross-checking, not all
    three hundred

Usage:
    python3.11 exercises_cluster.py --urls data/code15_urls.csv
    python3.11 exercises_cluster.py --urls data/code15_urls.csv \\
        --out data/exercise_clusters.csv --max-per-exercise 6

Requires:
    pip install duckdb
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from collections import defaultdict
from pathlib import Path

import duckdb

# Pattern -> canonical name. This is now the single source of truth for
# exercise naming; exercises_funnel.py should import it rather than keep its
# own list. Keys are regexes matched against the lowercased URL slug.
#
# The list is NATO, Nordic, Baltic and Russian only. That is a known and
# deliberate limitation for the Baltic theatre, and the reason it cannot be
# carried to other theatres unchanged.
CANONICAL = {
    r"baltops": "BALTOPS",
    r"saber[-_]?strike": "Saber Strike",
    r"saber[-_]?guardian": "Saber Guardian",
    r"saber[-_]?junction": "Saber Junction",
    r"steadfast[-_]?defender": "Steadfast Defender",
    r"steadfast[-_]?noon": "Steadfast Noon",
    r"steadfast[-_]?dart": "Steadfast Dart",
    r"steadfast[-_]?jazz": "Steadfast Jazz",
    r"trident[-_]?juncture": "Trident Juncture",
    r"cold[-_]?response": "Cold Response",
    r"nordic[-_]?response": "Nordic Response",
    r"aurora": "Aurora",
    r"defender[-_]?europe": "Defender Europe",
    r"ramstein[-_]?\w+": "Ramstein series",
    r"zapad|запад": "Zapad",
    r"vostok|восток": "Vostok",
    r"union[-_]?resolve|союзная[-_]?решимость": "Union Resolve",
    r"sea[-_]?breeze": "Sea Breeze",
    r"dynamic[-_]?(manta|mongoose|mariner|guard)": "Dynamic series",
    r"joint[-_]?viking": "Joint Viking",
    r"northern[-_]?(coast|forest)": "Northern Coast/Forest",
    r"arrow[-_]?\d{2}": "Arrow",
    r"griffin[-_]?\w+": "Griffin series",
    r"iron[-_]?wolf|gelezinis[-_]?vilkas|geleu017einis": "Iron Wolf",
    r"flaming[-_]?thunder|perkuno": "Flaming Thunder",
    r"namejs": "Namejs",
    r"crystal[-_]?arrow": "Crystal Arrow",
    r"hedgehog|siil": "Hedgehog (Siil)",
    r"spring[-_]?storm|kevadtorm": "Spring Storm",
    r"slavic[-_]?brotherhood|славянское[-_]?братство": "Slavic Brotherhood",
    r"anaconda": "Anaconda",
    r"allied[-_]?spirit": "Allied Spirit",
    r"swift[-_]?response": "Swift Response",
    r"atlantic[-_]?resolve": "Atlantic Resolve",
    r"brilliant[-_]?jump": "Brilliant Jump",
    r"grand[-_]?quadriga": "Grand Quadriga",
    r"immediate[-_]?response": "Immediate Response",
    r"dragon[-_]?\d{2}|smok[-_]?\d{2}": "Dragon",
    r"trojan[-_]?footprint": "Trojan Footprint",
    r"joint[-_]?warrior": "Joint Warrior",
    r"brave[-_]?warrior": "Brave Warrior",
    r"neptune[-_]?strike": "Neptune Strike",
    r"karelian[-_]?sword|karjalan": "Karelian Sword",
    r"kevadtorm": "Spring Storm",
    r"caucasus[-_]?\d{4}|kavkaz": "Kavkaz",
}
COMPILED = [(re.compile(p, re.I), name) for p, name in CANONICAL.items()]

# A year in the slug beats the publication date: an article written in December
# about "zapad-2021" is about the 2021 edition, not a 2021 edition of whatever
# December implies.
YEAR_RE = re.compile(r"(?<!\d)(20[0-2]\d)(?!\d)")
YEAR2_RE = re.compile(r"[-_](\d{2})(?![\d])")


def identify(url: str, sqldate: int) -> tuple[str, str] | None:
    """Return (canonical name, edition year) or None if no name matched."""
    slug = url.lower()
    for rx, name in COMPILED:
        m = rx.search(slug)
        if not m:
            continue
        tail = slug[m.start():m.start() + 40]
        y = YEAR_RE.search(tail)
        if y:
            return (name, y.group(1))
        y2 = YEAR2_RE.search(tail)
        if y2:
            v = int(y2.group(1))
            if 10 <= v <= 29:
                return (name, f"20{v:02d}")
        # No edition in the slug: fall back to the publication year, and accept
        # that articles published in January about the previous year's edition
        # will land in the wrong cluster. Flagged in the output as inferred.
        return (name, f"{str(sqldate)[:4]}*")
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--urls", type=Path, default=Path("data/code15_urls.csv"))
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--max-per-exercise", type=int, default=6,
                    help="sources to keep per exercise for extraction")
    ap.add_argument("--top", type=int, default=30)
    ap.add_argument("--confirmed-only", action="store_true",
                    help="list only editions with an explicit year in the slug")
    a = ap.parse_args()

    if not a.urls.exists():
        print(f"{a.urls} not found.")
        return 1

    con = duckdb.connect(":memory:")
    rows = con.execute(f"""
        SELECT DISTINCT SOURCEURL, min(SQLDATE) AS d, count(*) AS n
        FROM read_csv_auto('{a.urls.as_posix()}', header=true)
        WHERE SOURCEURL IS NOT NULL
        GROUP BY SOURCEURL
    """).fetchall()

    clusters: dict[tuple[str, str], dict] = defaultdict(
        lambda: {"urls": [], "dates": []})
    unnamed = 0
    for url, d, _ in rows:
        got = identify(url, int(d))
        if not got:
            unnamed += 1
            continue
        c = clusters[got]
        c["urls"].append(url)
        c["dates"].append(int(d))

    total_articles = sum(len(c["urls"]) for c in clusters.values())

    # A cluster whose edition year came from the publication date is not an
    # exercise. Zapad runs every four years, so "Zapad 2022" is really "articles
    # published in 2022 that mention Zapad" -- previews of the next edition and
    # retrospectives on the last. Counting those as registry rows inflates the
    # registry with editions that never happened.
    confirmed = {k: v for k, v in clusters.items() if not k[1].endswith("*")}
    inferred = {k: v for k, v in clusters.items() if k[1].endswith("*")}
    conf_articles = sum(len(c["urls"]) for c in confirmed.values())
    inf_articles = sum(len(c["urls"]) for c in inferred.values())

    print(f"\n--- clustering, {len(rows):,} distinct URLs ---")
    print(f"  matched a known exercise name  {total_articles:>8,}")
    print(f"  no name in slug                {unnamed:>8,}")
    print(f"\n  CONFIRMED EDITIONS             {len(confirmed):>8,}"
          f"   ({conf_articles:,} articles)")
    print(f"    edition year explicit in the URL slug. These are registry rows.")
    print(f"  UNRESOLVED MENTIONS            {len(inferred):>8,}"
          f"   ({inf_articles:,} articles)")
    print(f"    no edition in the slug, so the year is the publication date.")
    print(f"    Not exercises. The articles are real and need their edition")
    print(f"    resolved from the text before they can join a registry row.")
    print(f"\n  DISTINCT EXERCISES (all)       {len(clusters):>8,}")
    if clusters:
        avg = total_articles / len(clusters)
        print(f"  articles per exercise, mean    {avg:>8.1f}")
        med = sorted(len(c["urls"]) for c in clusters.values())[len(clusters)//2]
        print(f"  articles per exercise, median  {med:>8,}")

    src = confirmed if a.confirmed_only else clusters
    ordered = sorted(src.items(), key=lambda kv: -len(kv[1]["urls"]))
    label = "confirmed editions" if a.confirmed_only else "all clusters"
    print(f"\n--- top {a.top} by coverage, {label} ---")
    print(f"  {'exercise':<26}{'edition':<10}{'articles':>9}  span")
    for (name, year), c in ordered[:a.top]:
        d0, d1 = min(c["dates"]), max(c["dates"])
        print(f"  {name:<26}{year:<10}{len(c['urls']):>9,}  {d0} .. {d1}")

    singles = sum(1 for _, c in confirmed.items() if len(c["urls"]) == 1)
    print(f"\n  confirmed editions with a single source  {singles:,} "
          f"({100*singles/max(len(confirmed),1):.0f}%)")
    print("  Single-source rows cannot be cross-checked and should carry low")
    print("  confidence in the registry rather than being dropped.")

    budget = sum(min(len(c["urls"]), a.max_per_exercise)
                 for c in confirmed.values())
    print(f"\n--- extraction budget, confirmed editions only ---")
    print(f"  keeping up to {a.max_per_exercise} sources per exercise: "
          f"{budget:,} articles")
    print(f"  tokens per pass  {budget*2020/1e6:>8.2f} M")
    print(f"\n  Resolving the {inf_articles:,} unresolved mentions would add")
    print(f"  {inf_articles*2020/1e6:.2f} M per pass, and is a separate job: the model")
    print(f"  has to read the text to say which edition an article is about.")

    print(f"\n  The {unnamed:,} unnamed candidates are the real open question:")
    print("  each may be an exercise this name list has never heard of. That is")
    print("  where recall is lost, and identifying them needs a model, not a")
    print("  regex. Size that separately once the named path works end to end.")

    if a.out:
        a.out.parent.mkdir(parents=True, exist_ok=True)
        with a.out.open("w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["exercise", "edition", "edition_inferred",
                        "n_articles", "first_seen", "last_seen", "sources"])
            for (name, year), c in sorted(clusters.items(),
                                          key=lambda kv: -len(kv[1]["urls"])):
                keep = c["urls"][:a.max_per_exercise]
                w.writerow([name, year.rstrip("*"), int(year.endswith("*")),
                            len(c["urls"]), min(c["dates"]), max(c["dates"]),
                            " ".join(keep)])
        print(f"\nwrote {len(ordered):,} prospective registry rows -> {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
