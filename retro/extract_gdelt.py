#!/usr/bin/env python3
"""
GDELT retro extraction for the Threshold backtest.

Two things this script exists to prevent:

  1. Burning the BigQuery free tier. GDELT is enormous. A single careless
     `SELECT *` over gdeltv2.events scans hundreds of GB. Every query here is
     dry-run first and refused if it exceeds a byte budget you set explicitly.

  2. Silently mixing GDELT generations. 2.0 starts 2015-02-19. Anything before
     that is 1.0: daily updates, no translingual coverage. The two are tagged
     differently and never merged without the tag surviving.

Usage:
    python3.11 extract_gdelt.py --region regions/ukraine.yaml --out data/ \\
        --max-gb 8 --dry-run
    python3.11 extract_gdelt.py --region regions/ukraine.yaml --out data/ \\
        --max-gb 8 --execute

Requires:
    pip install google-cloud-bigquery pyyaml
    plus GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON,
    or `gcloud auth application-default login`.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

import yaml

GDELT2_START = date(2015, 2, 19)

# GDELT 2.0 partitions by _PARTITIONTIME on this public table.
TABLE_V2 = "gdelt-bq.gdeltv2.events"
# GDELT 1.0 full history. No partitioning -- filter on SQLDATE and expect a
# larger scan. This is why the byte budget matters.
TABLE_V1 = "gdelt-bq.full.events"

# Only the columns the crosswalk and the scorer actually need. Adding columns
# here costs real money on every run, so justify each one.
COLUMNS = [
    "GLOBALEVENTID",
    "SQLDATE",
    "EventCode",
    "EventRootCode",
    "QuadClass",
    "GoldsteinScale",
    "NumMentions",
    "NumSources",
    "NumArticles",
    "AvgTone",
    "Actor1CountryCode",
    "Actor2CountryCode",
    "ActionGeo_CountryCode",
    "ActionGeo_Lat",
    "ActionGeo_Long",
    "SOURCEURL",
]

GB = 1024 ** 3


@dataclass
class Region:
    key: str
    actor_codes: list[str]
    counterparty_codes: list[str]
    geo_fips: list[str]
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    start: date
    end: date

    @classmethod
    def load(cls, path: Path) -> "Region":
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
        bbox = raw["bounding_box"]
        win = raw["window"]
        return cls(
            key=raw["region_key"],
            actor_codes=list(raw.get("actor_country_codes_cameo") or []),
            counterparty_codes=list(raw.get("counterparty_codes_cameo") or []),
            geo_fips=list(raw.get("action_geo_country_codes_fips") or []),
            lat_min=float(bbox["lat_min"]),
            lat_max=float(bbox["lat_max"]),
            lon_min=float(bbox["lon_min"]),
            lon_max=float(bbox["lon_max"]),
            start=_as_date(win["start"]),
            end=_as_date(win["end"]),
        )


def _as_date(v) -> date:
    if isinstance(v, date):
        return v
    return datetime.strptime(str(v), "%Y-%m-%d").date()


def _sql_list(values: list[str]) -> str:
    inner = ", ".join("'" + v.replace("'", "''") + "'" for v in values)
    return "(" + inner + ")"


def build_query(region: Region, table: str, start: date, end: date) -> str:
    """
    Two independent selectors, OR'd, with which one matched recorded.

    GDELT geocoding accuracy is roughly 55% on key fields, so relying on the
    bounding box alone drops real events and relying on actor codes alone
    misses events coded with regional or organizational actors.
    """
    cols = ",\n        ".join(COLUMNS)
    actors = _sql_list(region.actor_codes)
    counterparties = _sql_list(region.actor_codes + region.counterparty_codes)
    fips = _sql_list(region.geo_fips)

    return f"""
    SELECT
        {cols},
        (Actor1CountryCode IN {actors}
            OR Actor2CountryCode IN {actors}) AS matched_actor,
        (ActionGeo_CountryCode IN {fips}) AS matched_geo_country,
        (ActionGeo_Lat BETWEEN {region.lat_min} AND {region.lat_max}
            AND ActionGeo_Long BETWEEN {region.lon_min} AND {region.lon_max})
            AS matched_bbox
    FROM `{table}`
    WHERE SQLDATE BETWEEN {start.strftime('%Y%m%d')} AND {end.strftime('%Y%m%d')}
      AND (
            Actor1CountryCode IN {actors}
         OR Actor2CountryCode IN {actors}
         OR (Actor1CountryCode IN {counterparties}
             AND Actor2CountryCode IN {counterparties})
         OR ActionGeo_CountryCode IN {fips}
         OR (ActionGeo_Lat BETWEEN {region.lat_min} AND {region.lat_max}
             AND ActionGeo_Long BETWEEN {region.lon_min} AND {region.lon_max})
      )
    """


def dedupe_key(row: dict, source_version: str) -> str:
    """
    Computed here rather than as a Postgres generated column: date and numeric
    to text casts in Postgres are STABLE, not IMMUTABLE, so a generated column
    is rejected. Keep this function and the SQL unique constraint in sync.

    GLOBALEVENTID is not used alone because GDELT reuses and resets IDs across
    the 1.0/2.0 switchover.
    """
    parts = [
        source_version,
        str(row.get("SQLDATE") or ""),
        str(row.get("EventCode") or ""),
        str(row.get("Actor1CountryCode") or ""),
        str(row.get("Actor2CountryCode") or ""),
        f"{row.get('ActionGeo_Lat') or ''}",
        f"{row.get('ActionGeo_Long') or ''}",
        str(row.get("SOURCEURL") or ""),
    ]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def split_by_generation(start: date, end: date) -> list[tuple[str, str, date, date]]:
    """Return [(source_version, table, start, end), ...] with no overlap."""
    segments: list[tuple[str, str, date, date]] = []
    if start < GDELT2_START:
        v1_end = min(end, date(2015, 2, 18))
        segments.append(("gdelt10", TABLE_V1, start, v1_end))
    if end >= GDELT2_START:
        v2_start = max(start, GDELT2_START)
        segments.append(("gdelt20", TABLE_V2, v2_start, end))
    return segments


def estimate_bytes(client, sql: str) -> int:
    from google.cloud.bigquery import QueryJobConfig

    cfg = QueryJobConfig(dry_run=True, use_query_cache=False)
    job = client.query(sql, job_config=cfg)
    return int(job.total_bytes_processed or 0)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument(
        "--max-gb",
        required=True,
        type=float,
        help="Hard byte budget across all segments. Refuses to run if exceeded. "
             "BigQuery's free tier is 1 TB of scanned data per month.",
    )
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true",
                      help="Estimate scan size and print the SQL. Costs nothing.")
    mode.add_argument("--execute", action="store_true")
    args = ap.parse_args()

    region = Region.load(args.region)
    segments = split_by_generation(region.start, region.end)

    print(f"region: {region.key}  window: {region.start} .. {region.end}")
    print(f"segments: {len(segments)}")
    for sv, table, s, e in segments:
        print(f"  {sv:8s} {table:28s} {s} .. {e}")
    if len(segments) > 1:
        print("\n  NOTE: window spans the 2015-02-19 instrument break.")
        print("  gdelt10 has no translingual coverage. Local-language media are")
        print("  largely absent before that date. Do not compare the two halves")
        print("  without saying so in the report.\n")

    try:
        from google.cloud import bigquery
    except ImportError:
        print("\ngoogle-cloud-bigquery not installed.")
        print("  pip install google-cloud-bigquery pyyaml")
        if args.dry_run:
            print("\nPrinting SQL only.\n")
            for sv, table, s, e in segments:
                print(f"-- {sv}\n{build_query(region, table, s, e)}\n")
            return 0
        return 1

    client = bigquery.Client()

    plans = []
    total = 0
    for sv, table, s, e in segments:
        sql = build_query(region, table, s, e)
        nbytes = estimate_bytes(client, sql)
        total += nbytes
        plans.append((sv, sql, nbytes, s, e))
        print(f"  {sv}: would scan {nbytes / GB:.2f} GB")

    budget = args.max_gb * GB
    print(f"\ntotal: {total / GB:.2f} GB   budget: {args.max_gb:.2f} GB")

    if total > budget:
        print("\nREFUSED: over budget. Narrow the window, drop columns, or raise")
        print("--max-gb deliberately. Do not raise it reflexively.")
        return 2

    if args.dry_run:
        print("\nDry run only. Nothing scanned, nothing charged.")
        return 0

    args.out.mkdir(parents=True, exist_ok=True)
    for sv, sql, nbytes, s, e in plans:
        print(f"\nrunning {sv} ...")
        rows = client.query(sql).result()
        path = args.out / f"{region.key}_{sv}_{s:%Y%m%d}_{e:%Y%m%d}.jsonl"
        n = 0
        with path.open("w", encoding="utf-8") as fh:
            for r in rows:
                d = dict(r.items())
                d["_source_version"] = sv
                d["_region_key"] = region.key
                d["_license_class"] = "open"
                d["_dedupe_key"] = dedupe_key(d, sv)
                fh.write(json.dumps(d, default=str) + "\n")
                n += 1
        print(f"  wrote {n} rows -> {path}")

    print("\nDone. Next: the CAMEO crosswalk, then load into incidents_retro.")
    print("Do NOT load into `incidents`.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
