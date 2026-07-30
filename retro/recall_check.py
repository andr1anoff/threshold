#!/usr/bin/env python3
"""
Measure registry recall against an external reference list.

Every number so far has been internal: how many URLs the filter kept, how many
clusters they formed. None of it says whether the registry contains the
exercises that actually happened. This does, by checking against a list built
from official announcements rather than from the pipeline's own output.

The output that matters is not the recall percentage but the breakdown of
misses, because the two causes need different fixes:

  NAME MISSING     the exercise is not in the CANONICAL map at all.
                   Fix: extend the map. Cheap, and bounded by what you know.

  NAME KNOWN, NO HIT   the name is in the map but no URL slug carried it.
                   Fix: neither the map nor the regex helps. Either GDELT never
                   indexed coverage of it, or the coverage exists under URLs
                   with numeric slugs. This is the failure that a bigger name
                   list cannot solve, and the reason the unnamed candidates
                   have to be resolved by a model eventually.

Usage:
    python3.11 recall_check.py --clusters data/exercise_clusters.csv \\
        --reference groundtruth/exercises_2024_baltic.yaml

Requires:
    pip install pyyaml
"""

from __future__ import annotations

import argparse
import csv
import math
import re
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from exercises_cluster import COMPILED  # noqa: E402


def wilson(k: int, n: int) -> tuple[float, float]:
    if n == 0:
        return (0.0, 1.0)
    z, p, d = 1.96, k / n, 1 + 1.96 ** 2 / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def name_is_known(name: str, aliases: list[str]) -> bool:
    """Would the clusterer recognise this name if it appeared in a slug?"""
    for probe in [name] + list(aliases or []):
        slug = re.sub(r"\s+", "-", probe.lower())
        if any(rx.search(slug) for rx, _ in COMPILED):
            return True
    return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--clusters", type=Path,
                    default=Path("data/exercise_clusters.csv"))
    ap.add_argument("--reference", type=Path,
                    default=Path("groundtruth/exercises_baltic_reference.yaml"))
    a = ap.parse_args()

    for p in (a.clusters, a.reference):
        if not p.exists():
            print(f"{p} not found.")
            return 1

    ref = yaml.safe_load(a.reference.read_text(encoding="utf-8"))
    found: dict[tuple[str, str], int] = {}
    with a.clusters.open() as fh:
        for r in csv.DictReader(fh):
            if r.get("edition_inferred") == "1":
                continue          # publication-year artefacts are not editions
            found[(norm(r["exercise"]), r["edition"])] = int(r["n_articles"])

    hits, missing_name, missing_hit = [], [], []
    by_year: dict[str, list[int]] = {}
    by_tier: dict[str, list[int]] = {}
    for e in ref["in_scope"]:
        ed = str(e["edition"])
        probes = [e["name"]] + list(e.get("aliases") or [])
        got = None
        for p in probes:
            for (cname, cedition), n in found.items():
                if cedition == ed and (norm(p) in cname or cname in norm(p)):
                    got = (cname, n)
                    break
            if got:
                break
        ok = 1 if got else 0
        by_year.setdefault(ed, []).append(ok)
        by_tier.setdefault(e.get("tier", "unspecified"), []).append(ok)
        if got:
            hits.append((e["name"], ed, got[1]))
        elif name_is_known(e["name"], e.get("aliases")):
            missing_hit.append((e["name"], ed))
        else:
            missing_name.append((e["name"], ed))

    n = len(ref["in_scope"])
    k = len(hits)
    lo, hi = wilson(k, n)

    print(f"\n--- registry recall vs external reference ---")
    print(f"  reference: {a.reference.name}")
    for s in ref.get("sources", []):
        print(f"    {s['name']}")
    print(f"\n  in-scope exercises  {n}")
    print(f"  found in registry   {k}")
    print(f"  RECALL              {k/n:.0%}   [95% CI {lo:.0%} .. {hi:.0%}]")

    print(f"\n  by edition year")
    for y in sorted(by_year):
        v = by_year[y]
        print(f"    {y}   {sum(v)}/{len(v)}   {sum(v)/len(v):.0%}")
    print(f"\n  by reference source tier")
    for t in sorted(by_tier):
        v = by_tier[t]
        print(f"    {t:<12}{sum(v)}/{len(v)}   {sum(v)/len(v):.0%}")
    if len(by_tier) > 1:
        rates = {t: sum(v)/len(v) for t, v in by_tier.items()}
        if max(rates.values()) - min(rates.values()) > 0.25:
            print("    Tiers diverge by more than 25 points. Report them")
            print("    separately: a single pooled figure would blend recall")
            print("    against primary announcements with recall against a")
            print("    third-party tracker.")

    if hits:
        print(f"\n  FOUND")
        for name, ed, cnt in sorted(hits):
            print(f"    {name} {ed:<8} {cnt:>4} articles")
    if missing_hit:
        print(f"\n  MISSED, name is known to the clusterer  ({len(missing_hit)})")
        for name, ed in sorted(missing_hit):
            print(f"    {name} {ed}")
        print("    No URL slug carried the name. Extending the name map will")
        print("    not recover these; only reading article text will.")
    if missing_name:
        print(f"\n  MISSED, name not in the map  ({len(missing_name)})")
        for name, ed in sorted(missing_name):
            print(f"    {name} {ed}")
        print("    Add these to CANONICAL in exercises_cluster.py and re-run.")
        print("    Cheap, but it only ever fixes the exercises you already")
        print("    know about, which is the structural limit of this approach.")

    print(f"\n  Reference list caveat: {ref['in_scope'][0]['name']} and the rest")
    print("  come from NATO's own announced programme. National exercises")
    print("  outside it and all Russian and Belarusian activity are absent, so")
    print("  this is recall against NATO's calendar, not against reality.")
    print("  Quote it that way or it overstates coverage.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
