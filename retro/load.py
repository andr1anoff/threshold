#!/usr/bin/env python3
"""
Load the GDELT daily-aggregate CSVs into a local DuckDB file.

Why DuckDB and not Supabase: the two extracts are ~2.95M rows, roughly 450 MB
in Postgres once indexed, against a 500 MB free-tier database that also serves
the live app. Validation scaffolding does not belong in the production database
under any circumstances, and it certainly does not belong there while competing
for the same quota. Only the exercise registry -- the part that ships as Bifrost
-- goes to Supabase later.

What it does:
  * reads both CSVs
  * drops rows with impossible SQLDATE and REPORTS how many (does not hide them)
  * maps FIPS country -> region_key
  * applies the deterministic CAMEO crosswalk
  * writes one table, idempotent on a content hash
  * prints a coverage summary so you can see what you actually have

Usage:
    python3.11 load.py --data data/ --db retro.duckdb
    python3.11 load.py --data data/ --db retro.duckdb --summary-only

Requires:
    pip install duckdb pyyaml
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import duckdb
import yaml

EXPECTED = {
    "gdelt10": "gdelt10_countries15.csv",
    "gdelt20": "gdelt20_countries15.csv",
}


def load_configs(root: Path) -> tuple[dict, dict]:
    cw = yaml.safe_load((root / "crosswalk.yaml").read_text(encoding="utf-8"))
    fm = yaml.safe_load((root / "regions" / "fips_map.yaml").read_text(encoding="utf-8"))
    return cw, fm


def sql_case(mapping: dict, column: str, default: str) -> str:
    """Build a CASE expression from a dict, so the crosswalk lives in YAML."""
    whens = "\n        ".join(
        f"WHEN {column} = '{k}' THEN '{v}'" for k, v in mapping.items()
    )
    return f"CASE\n        {whens}\n        ELSE '{default}'\n    END"


def create_schema(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("""
        CREATE TABLE IF NOT EXISTS incidents_retro_daily (
            dedupe_key       VARCHAR PRIMARY KEY,
            source_version   VARCHAR NOT NULL,
            event_date       DATE    NOT NULL,
            geo_country_fips VARCHAR NOT NULL,
            region_key       VARCHAR NOT NULL,
            event_root_code  VARCHAR NOT NULL,
            quad_class       SMALLINT,
            quad_label       VARCHAR,
            category         VARCHAR NOT NULL,
            in_gz            BOOLEAN NOT NULL,
            in_ex            BOOLEAN NOT NULL,
            n_events         BIGINT,
            n_articles       BIGINT,
            n_mentions       BIGINT,
            goldstein_mean   DOUBLE,
            goldstein_sum    DOUBLE,
            tone_mean        DOUBLE,
            license_class    VARCHAR NOT NULL DEFAULT 'open'
        )
    """)
    # Ledger of what was dropped, so junk is a measured quantity not a mystery.
    con.execute("""
        CREATE TABLE IF NOT EXISTS load_audit (
            source_version   VARCHAR,
            csv_rows         BIGINT,
            dropped_bad_date BIGINT,
            dropped_no_region BIGINT,
            inserted         BIGINT,
            loaded_at        TIMESTAMP DEFAULT current_timestamp
        )
    """)


def ingest(con, csv_path: Path, sv: str, cw: dict, fm: dict) -> None:
    bounds = fm["date_bounds"][sv]
    cat_case = sql_case(cw["root_codes"], "lpad(trim(EventRootCode), 2, '0')",
                        cw["unknown_category"])
    reg_case = sql_case(fm["fips_to_region"], "trim(ActionGeo_CountryCode)", "")
    quad_case = sql_case(
        {str(k): v for k, v in cw["quad_class_labels"].items()},
        "CAST(TRY_CAST(QuadClass AS INTEGER) AS VARCHAR)", "unknown",
    )
    gz = ", ".join(f"'{c}'" for c in cw["gz_root_codes"])
    ex = ", ".join(f"'{c}'" for c in cw["ex_root_codes"])

    con.execute(f"""
        CREATE OR REPLACE TEMP VIEW raw AS
        SELECT * FROM read_csv_auto('{csv_path.as_posix()}', header=true,
                                    types={{'EventRootCode':'VARCHAR',
                                            'QuadClass':'VARCHAR'}})
    """)
    csv_rows = con.execute("SELECT count(*) FROM raw").fetchone()[0]

    con.execute(f"""
        CREATE OR REPLACE TEMP VIEW staged AS
        SELECT
            '{sv}' AS source_version,
            TRY_CAST(SQLDATE AS BIGINT) AS sqldate,
            strptime(CAST(SQLDATE AS VARCHAR), '%Y%m%d')::DATE AS event_date,
            trim(ActionGeo_CountryCode) AS geo_country_fips,
            {reg_case} AS region_key,
            lpad(trim(EventRootCode), 2, '0') AS event_root_code,
            TRY_CAST(QuadClass AS SMALLINT) AS quad_class,
            {quad_case} AS quad_label,
            {cat_case} AS category,
            lpad(trim(EventRootCode), 2, '0') IN ({gz}) AS in_gz,
            lpad(trim(EventRootCode), 2, '0') IN ({ex}) AS in_ex,
            TRY_CAST(n_events AS BIGINT) AS n_events,
            TRY_CAST(n_articles AS BIGINT) AS n_articles,
            TRY_CAST(n_mentions AS BIGINT) AS n_mentions,
            TRY_CAST(goldstein_mean AS DOUBLE) AS goldstein_mean,
            TRY_CAST(goldstein_sum AS DOUBLE) AS goldstein_sum,
            TRY_CAST(tone_mean AS DOUBLE) AS tone_mean
        FROM raw
    """)

    bad_date = con.execute(f"""
        SELECT count(*) FROM staged
        WHERE sqldate IS NULL OR sqldate < {bounds['min']} OR sqldate > {bounds['max']}
    """).fetchone()[0]
    no_region = con.execute(f"""
        SELECT count(*) FROM staged
        WHERE region_key = ''
          AND sqldate BETWEEN {bounds['min']} AND {bounds['max']}
    """).fetchone()[0]

    before = con.execute("SELECT count(*) FROM incidents_retro_daily").fetchone()[0]
    con.execute(f"""
        INSERT OR IGNORE INTO incidents_retro_daily
        SELECT
            md5(source_version || '|' || CAST(event_date AS VARCHAR) || '|'
                || geo_country_fips || '|' || event_root_code || '|'
                || coalesce(CAST(quad_class AS VARCHAR), 'x')) AS dedupe_key,
            source_version, event_date, geo_country_fips, region_key,
            event_root_code, quad_class, quad_label, category, in_gz, in_ex,
            n_events, n_articles, n_mentions,
            goldstein_mean, goldstein_sum, tone_mean,
            'open'
        FROM staged
        WHERE sqldate BETWEEN {bounds['min']} AND {bounds['max']}
          AND region_key <> ''
    """)
    after = con.execute("SELECT count(*) FROM incidents_retro_daily").fetchone()[0]
    inserted = after - before

    con.execute(
        "INSERT INTO load_audit (source_version, csv_rows, dropped_bad_date, "
        "dropped_no_region, inserted) VALUES (?, ?, ?, ?, ?)",
        [sv, csv_rows, bad_date, no_region, inserted],
    )

    pct = 100 * bad_date / csv_rows if csv_rows else 0
    print(f"  {sv}: {csv_rows:,} csv rows")
    print(f"        dropped, impossible date: {bad_date:,} ({pct:.1f}%)")
    print(f"        dropped, unmapped country: {no_region:,}")
    print(f"        inserted: {inserted:,}")


def summary(con) -> None:
    print("\n--- coverage by region and source ---")
    rows = con.execute("""
        SELECT region_key, source_version,
               min(event_date) AS first_day, max(event_date) AS last_day,
               count(*) AS rows, sum(n_events) AS events
        FROM incidents_retro_daily
        GROUP BY 1, 2 ORDER BY 1, 2
    """).fetchall()
    print(f"{'region':<16}{'src':<10}{'from':<12}{'to':<12}{'rows':>10}{'events':>14}")
    for r in rows:
        print(f"{r[0]:<16}{r[1]:<10}{str(r[2]):<12}{str(r[3]):<12}{r[4]:>10,}{r[5]:>14,}")

    print("\n--- GZ / EX split ---")
    for label, col in [("GZ (incident pressure)", "in_gz"), ("EX (force posture)", "in_ex")]:
        r = con.execute(f"""
            SELECT sum(n_events) FILTER (WHERE {col}), sum(n_events)
            FROM incidents_retro_daily
        """).fetchone()
        share = 100 * r[0] / r[1] if r[1] else 0
        print(f"  {label:<26}{r[0]:>14,}  ({share:.1f}% of all events)")

    print("\n--- audit ---")
    for r in con.execute("SELECT * FROM load_audit ORDER BY loaded_at").fetchall():
        print(f"  {r[0]}: csv={r[1]:,} bad_date={r[2]:,} no_region={r[3]:,} inserted={r[4]:,}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=Path("data"))
    ap.add_argument("--db", type=Path, default=Path("retro.duckdb"))
    ap.add_argument("--summary-only", action="store_true")
    args = ap.parse_args()

    root = Path(__file__).resolve().parent
    cw, fm = load_configs(root)
    con = duckdb.connect(str(args.db))
    create_schema(con)

    if not args.summary_only:
        missing = [n for n in EXPECTED.values() if not (args.data / n).exists()]
        if missing:
            print("missing in " + str(args.data) + ":")
            for m in missing:
                print("  " + m)
            print("\nRename the BigQuery exports first. See README.")
            return 1
        print(f"loading into {args.db}")
        for sv, name in EXPECTED.items():
            ingest(con, args.data / name, sv, cw, fm)

    summary(con)
    con.close()
    print("\nNothing was written to Supabase. That is deliberate.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
