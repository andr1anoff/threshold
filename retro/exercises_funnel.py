#!/usr/bin/env python3
"""
Bifrost exercise extraction, stage 1: the funnel.

The problem this exists to solve. CAMEO root code 15 in the Baltic theatre,
2015-2026, covers 435,452 events across 2,531,959 article mentions. Running an
LLM over that is not a compute problem to be solved with a bigger allocation;
it is the wrong shape of job. Almost all of those articles are routine coverage
that mentions a deployment in passing.

So the funnel narrows before it spends anything:

  stage 0  BigQuery: code-15 events with SOURCEURL      -> see exercises_urls.sql
  stage 1  deduplicate URLs                             -> this script
  stage 2  cheap lexical prefilter on slug and title    -> this script
  stage 3  LLM extraction, candidates only              -> next stage
  stage 4  entity resolution into exercises_retro       -> next stage

Stages 1 and 2 cost nothing and are what make stage 3 affordable. The
--estimate mode reports the token budget stage 3 would need, which is the
number to put in a compute request rather than asking for capacity in the
abstract.

Usage:
    python3.11 exercises_funnel.py --urls data/code15_urls.csv --estimate
    python3.11 exercises_funnel.py --urls data/code15_urls.csv --out data/candidates.csv

Requires:
    pip install duckdb pyyaml
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import duckdb

# Exercise names are almost always two capitalised words plus a year or roman
# numeral: BALTOPS 25, Saber Strike 2024, Steadfast Defender, Zapad-2021.
# Applied to the URL slug, which is free -- no fetching required.
NAME_HINTS = [
    r"baltops", r"saber[-_]?(strike|guardian|junction)", r"steadfast[-_]?\w+",
    r"trident[-_]?juncture", r"cold[-_]?response", r"aurora[-_]?\d{2}",
    r"defender[-_]?europe", r"ramstein[-_]?\w+", r"zapad", r"vostok",
    r"union[-_]?resolve", r"sea[-_]?breeze", r"dynamic[-_]?\w+",
    r"joint[-_]?viking", r"northern[-_]?(coast|forest)", r"arrow[-_]?\d{2}",
    r"griffin[-_]?\w+", r"iron[-_]?wolf", r"flaming[-_]?thunder",
    r"namejs", r"crystal[-_]?arrow", r"hedgehog", r"siil",
]

# Generic exercise vocabulary in the languages that actually cover this theatre.
GENERIC = [
    r"\bexercise\b", r"\bexercises\b", r"\bdrill(s)?\b", r"\bwar[-_]?game",
    r"\bmanoeuvre", r"\bmaneuver", r"ubung", r"uebung", r"manover",
    r"ucheniya", r"ucheni", r"pratybos", r"macibas", r"oppe",
]

# Domains that publish exercise announcements rather than commentary. A hit
# here raises confidence but is never required -- restricting to these would
# bias the registry toward NATO's own framing.
PREFERRED = [
    "nato.int", "shape.nato.int", "act.nato.int", "defense.gov", "army.mil",
    "navy.mil", "af.mil", "eucom.mil", "mod.gov", "bundeswehr.de",
    "forsvaret.no", "forsvarsmakten.se", "mil.ee", "kam.lt", "mod.gov.lv",
    "puolustusvoimat.fi", "mil.ru", "mil.pl",
]

NAME_RE = re.compile("|".join(NAME_HINTS), re.I)
GEN_RE = re.compile("|".join(GENERIC), re.I)

# Tokens per article at stage 3. Title plus the first few paragraphs is enough
# to extract name, dates, participants and stated scale; sending whole articles
# multiplies cost without adding fields.
TOKENS_PER_ARTICLE = 1800
TOKENS_OUT = 220


def classify(url: str) -> tuple[bool, bool, bool]:
    try:
        u = urlparse(url)
    except Exception:
        return (False, False, False)
    host = (u.netloc or "").lower().removeprefix("www.")
    slug = (u.path or "").lower()
    return (
        bool(NAME_RE.search(slug)),
        bool(GEN_RE.search(slug)),
        any(host == d or host.endswith("." + d) for d in PREFERRED),
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--urls", type=Path, required=True,
                    help="CSV from stage 0 with at least a SOURCEURL column")
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--estimate", action="store_true",
                    help="report funnel yield and the stage-3 token budget")
    a = ap.parse_args()

    if not a.urls.exists():
        print(f"{a.urls} not found. Run exercises_urls.sql in BigQuery first "
              f"and save the result there.")
        return 1

    con = duckdb.connect(":memory:")
    con.execute(f"""
        CREATE TABLE raw AS
        SELECT * FROM read_csv_auto('{a.urls.as_posix()}', header=true)
    """)
    total = con.execute("SELECT count(*) FROM raw").fetchone()[0]
    urls = [r[0] for r in con.execute(
        "SELECT DISTINCT SOURCEURL FROM raw WHERE SOURCEURL IS NOT NULL"
    ).fetchall()]

    named = generic = preferred = 0
    keep: list[tuple[str, int, int, int]] = []
    for u in urls:
        n, g, p = classify(u)
        named += n
        generic += g
        preferred += p
        if n or (g and p):
            keep.append((u, int(n), int(g), int(p)))

    print(f"\n--- funnel, Baltic theatre code-15 URLs ---")
    print(f"  stage 0  rows from BigQuery        {total:>10,}")
    print(f"  stage 1  distinct URLs             {len(urls):>10,}"
          f"   ({100*len(urls)/max(total,1):5.1f}% of rows)")
    print(f"  stage 2  named-exercise slug       {named:>10,}")
    print(f"           generic exercise word     {generic:>10,}")
    print(f"           preferred publisher       {preferred:>10,}")
    print(f"           CANDIDATES                {len(keep):>10,}"
          f"   ({100*len(keep)/max(len(urls),1):5.1f}% of distinct)")

    if a.estimate:
        n = len(keep)
        tin, tout = n * TOKENS_PER_ARTICLE, n * TOKENS_OUT
        print(f"\n--- stage 3 budget, {n:,} candidates ---")
        print(f"  input   {tin:>14,} tokens   (at {TOKENS_PER_ARTICLE}/article)")
        print(f"  output  {tout:>14,} tokens   (at {TOKENS_OUT}/article)")
        print(f"  total   {tin+tout:>14,} tokens")
        print()
        for lab, cap in [("Groq free tier, 100k tokens/day", 100_000),
                         ("1M tokens/day", 1_000_000),
                         ("10M tokens/day", 10_000_000)]:
            days = (tin + tout) / cap
            print(f"  {lab:<34}{days:>8.1f} days for one full pass")
        print("\n  One pass is the floor, not the plan: prompt revisions mean")
        print("  three to five passes before the schema settles. Quote the")
        print("  multiple in any compute request rather than the single pass.")

    if a.out:
        a.out.parent.mkdir(parents=True, exist_ok=True)
        con.execute("CREATE TABLE cand (url VARCHAR, named INT, generic INT, preferred INT)")
        con.executemany("INSERT INTO cand VALUES (?,?,?,?)", keep)
        con.execute(f"COPY cand TO '{a.out.as_posix()}' (HEADER, DELIMITER ',')")
        print(f"\nwrote {len(keep):,} candidates -> {a.out}")

    print("\n  Note: the prefilter runs on URL slugs only, so it never fetches")
    print("  and never costs anything. It will miss exercises whose slug is a")
    print("  numeric article id. Measure that recall loss on a hand-labelled")
    print("  sample of 200 URLs before trusting the yield.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
