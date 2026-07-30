#!/usr/bin/env python3
"""
Bifrost exercise registry: Wikidata ingest.

This is the product lane. Unlike the backtest scaffolding, what this builds is
the asset, so provenance and confidence are columns rather than metadata.

What Wikidata actually provides, measured rather than assumed (July 2026):

    2,957 distinct military exercises
    1,148 with any date          (38.8%)
      123 with any participant   ( 4.2%)
        9 with coordinates       ( 0.3%)

So Wikidata is a usable spine of names and dates and almost nothing else. That
gap is the reason the registry has a market: participants, scale, domain and
advance-notification status have to be assembled from elsewhere. This script
records the spine and leaves those fields null rather than guessing them, and
the coverage report it prints is itself a citable figure.

Usage:
    python3.11 exercises_wikidata.py --db retro.duckdb
    python3.11 exercises_wikidata.py --db retro.duckdb --since 2013-01-01
    python3.11 exercises_wikidata.py --db retro.duckdb --coverage-only

Requires:
    pip install duckdb requests
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import requests

ENDPOINT = "https://query.wikidata.org/sparql"
UA = {"User-Agent": "ThresholdBifrost/0.1 (academic research; contact via evandrianov.pro)"}

# Q357104 = military exercise. NOT Q1006311, which pulls in wars through the
# subclass chain -- the first query written for this returned the American
# Revolutionary War.
SPARQL = """
SELECT ?ex ?exLabel ?start ?end ?pit ?countryLabel ?partLabel ?coord ?locLabel WHERE {
  ?ex wdt:P31/wdt:P279* wd:Q357104 .
  OPTIONAL { ?ex wdt:P580 ?start }
  OPTIONAL { ?ex wdt:P582 ?end }
  OPTIONAL { ?ex wdt:P585 ?pit }
  OPTIONAL { ?ex wdt:P17  ?country }
  OPTIONAL { ?ex wdt:P710 ?part }
  OPTIONAL { ?ex wdt:P625 ?coord }
  OPTIONAL { ?ex wdt:P276 ?loc }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
"""

QID_ONLY = re.compile(r"^Q\d+$")
POINT = re.compile(r"Point\(([-0-9.]+) ([-0-9.]+)\)")

SCHEMA = """
CREATE TABLE IF NOT EXISTS exercises_retro (
    dedupe_key      VARCHAR PRIMARY KEY,
    wikidata_qid    VARCHAR,
    name            VARCHAR NOT NULL,
    date_start      DATE,
    date_end        DATE,
    participants    VARCHAR[],
    countries       VARCHAR[],
    location_name   VARCHAR,
    geo_lat         DOUBLE,
    geo_lon         DOUBLE,
    -- Left null on purpose. Wikidata does not carry these and guessing them
    -- would poison the asset the registry is meant to be.
    scale_personnel INTEGER,
    exercise_type   VARCHAR,
    domains         VARCHAR[],
    announced       BOOLEAN,
    announcement_source VARCHAR,
    confidence      DOUBLE NOT NULL,
    provenance      VARCHAR NOT NULL,
    license_class   VARCHAR NOT NULL DEFAULT 'open',
    ingested_at     TIMESTAMP DEFAULT current_timestamp
)
"""


def fetch() -> list[dict]:
    r = requests.get(ENDPOINT, params={"query": SPARQL, "format": "json"},
                     headers=UA, timeout=240)
    r.raise_for_status()
    return r.json()["results"]["bindings"]


def collapse(rows: list[dict]) -> dict:
    """One SPARQL row per participant, so fold them back into one record each."""
    out: dict[str, dict] = defaultdict(
        lambda: {"parts": set(), "countries": set(), "starts": set(),
                 "ends": set(), "loc": None, "lat": None, "lon": None,
                 "label": None})
    for b in rows:
        qid = b["ex"]["value"].rsplit("/", 1)[-1]
        e = out[qid]
        e["label"] = b.get("exLabel", {}).get("value") or qid
        for src, dst in [("start", "starts"), ("pit", "starts"), ("end", "ends")]:
            v = b.get(src, {}).get("value")
            if v:
                e[dst].add(v[:10])
        for src, dst in [("partLabel", "parts"), ("countryLabel", "countries")]:
            v = b.get(src, {}).get("value")
            if v and not QID_ONLY.match(v):
                e[dst].add(v)
        if b.get("locLabel") and not e["loc"]:
            v = b["locLabel"]["value"]
            e["loc"] = None if QID_ONLY.match(v) else v
        if b.get("coord") and e["lat"] is None:
            m = POINT.match(b["coord"]["value"])
            if m:
                e["lon"], e["lat"] = float(m.group(1)), float(m.group(2))
    return out


def score(e: dict) -> float:
    """
    Confidence is field completeness, not a guess about truth. A buyer needs to
    know which rows are thin, and a row with a name and nothing else is thin
    however real the exercise is.
    """
    c = 0.15
    if e["starts"]:
        c += 0.30
    if e["ends"]:
        c += 0.10
    if e["parts"]:
        c += 0.25
    if e["countries"]:
        c += 0.10
    if e["lat"] is not None:
        c += 0.10
    if QID_ONLY.match(e["label"] or ""):     # no English label at all
        c -= 0.15
    return round(max(0.0, min(1.0, c)), 2)


def as_date(vals: set[str]) -> str | None:
    ok = sorted(v for v in vals if re.match(r"^\d{4}-\d{2}-\d{2}$", v)
                and "0000" not in v)
    return ok[0] if ok else None


def coverage(recs: dict) -> None:
    n = len(recs)
    if not n:
        print("no records")
        return
    dated = sum(1 for e in recs.values() if e["starts"])
    parts = sum(1 for e in recs.values() if e["parts"])
    coord = sum(1 for e in recs.values() if e["lat"] is not None)
    ended = sum(1 for e in recs.values() if e["ends"])
    unlab = sum(1 for e in recs.values() if QID_ONLY.match(e["label"] or ""))
    print(f"\n--- Wikidata coverage, {n:,} distinct exercises ---")
    for lab, k in [("with a start date", dated), ("with an end date", ended),
                   ("with >=1 participant", parts), ("with coordinates", coord),
                   ("with no English label", unlab)]:
        print(f"  {lab:<24}{k:>6,}  ({100*k/n:5.1f}%)")
    print("\n  Participants and geography are the gap. That gap is the product:")
    print("  a registry that carries them does not currently exist in machine-")
    print("  readable form, and these percentages are the evidence for saying so.")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", type=Path, default=Path("retro.duckdb"))
    ap.add_argument("--since", default=None,
                    help="keep only exercises starting on/after this date")
    ap.add_argument("--coverage-only", action="store_true",
                    help="measure and report, write nothing")
    a = ap.parse_args()

    print("querying Wikidata ...")
    rows = fetch()
    recs = collapse(rows)
    print(f"  {len(rows):,} raw bindings -> {len(recs):,} distinct exercises")
    coverage(recs)

    if a.coverage_only:
        return 0

    con = duckdb.connect(str(a.db))
    con.execute(SCHEMA)
    kept = skipped_nodate = skipped_old = 0
    for qid, e in recs.items():
        ds = as_date(e["starts"])
        if not ds:
            skipped_nodate += 1
            continue
        if a.since and ds < a.since:
            skipped_old += 1
            continue
        de = as_date(e["ends"])
        key = hashlib.sha256(f"wikidata|{qid}".encode()).hexdigest()[:32]
        prov = json.dumps([{
            "source": "wikidata",
            "source_url": f"https://www.wikidata.org/wiki/{qid}",
            "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "fields": sorted(k for k, v in
                             [("name", e["label"]), ("date_start", ds),
                              ("date_end", de), ("participants", e["parts"]),
                              ("countries", e["countries"]),
                              ("geo", e["lat"])] if v),
        }])
        con.execute("""
            INSERT OR REPLACE INTO exercises_retro
              (dedupe_key, wikidata_qid, name, date_start, date_end,
               participants, countries, location_name, geo_lat, geo_lon,
               scale_personnel, exercise_type, domains, announced,
               announcement_source, confidence, provenance, license_class)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    NULL, NULL, NULL, NULL, NULL, ?, ?, 'open')
        """, [key, qid, e["label"], ds, de, sorted(e["parts"]),
              sorted(e["countries"]), e["loc"], e["lat"], e["lon"],
              score(e), prov])
        kept += 1

    print(f"\nwrote {kept:,} exercises")
    print(f"  skipped, no usable date: {skipped_nodate:,}")
    if a.since:
        print(f"  skipped, before {a.since}: {skipped_old:,}")

    print("\n--- confidence distribution ---")
    for lo, hi, lab in [(0.0, 0.4, "thin, name and date only"),
                        (0.4, 0.7, "partial"),
                        (0.7, 1.01, "rich, participants and geography")]:
        n = con.execute("SELECT count(*) FROM exercises_retro "
                        "WHERE confidence >= ? AND confidence < ?",
                        [lo, hi]).fetchone()[0]
        print(f"  {lab:<36}{n:>6,}")

    print("\nNothing here fills scale, domain or announced. Those come from")
    print("Vienna Document notifications and press releases, and are the part")
    print("nobody else has.")
    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
