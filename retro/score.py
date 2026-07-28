#!/usr/bin/env python3
"""
Score the Escalation Index over a retro window and evaluate it.

Two modes, deliberately separate:

  --propose-threshold   Reads ONLY the control windows (periods with no
                        ground-truth event) and reports distribution stats plus
                        a suggested threshold. Does not touch event periods and
                        does not evaluate anything.

  --evaluate            Requires `threshold` and `registered_commit` to be set
                        in the groundtruth YAML. Runs the event study.

The split is the point. If one command both chose the threshold and reported
hits, you would have no way to prove to a reviewer -- or to yourself six weeks
from now -- that the threshold was not tuned until the hits looked good.

Two GZ variants are always computed side by side:

  raw    GZ = count of conflict-coded events in the window.
  norm   GZ = that count divided by total article volume in the window.

`raw` is what the live formula uses. On Ukraine 2013-2014 article volume rises
roughly 38x, so `raw` will climb whether or not escalation does. If the two
variants disagree, the 0.45 weight on GZ is measuring media attention.

Usage:
    python3.11 score.py --db retro.duckdb --region ukraine --propose-threshold
    python3.11 score.py --db retro.duckdb --region ukraine --evaluate

Requires:
    pip install duckdb pyyaml pandas
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
import yaml

# Live weights. Change here only, never inline.
W_GZ = 0.45
W_EX = 0.35
W_BASE = 0.20

GDELT2_START = pd.Timestamp("2015-02-19")


def daily_series(con, region: str, window_days: int) -> pd.DataFrame:
    """
    Daily series with a complete date spine. The spine matters: GDELT has days
    with no rows at all for a region, and a rolling window over a gappy index
    silently shortens itself.
    """
    df = con.execute("""
        SELECT event_date,
               sum(n_events) FILTER (WHERE in_gz)      AS gz_events,
               sum(n_events) FILTER (WHERE in_ex)      AS ex_events,
               sum(n_events)                           AS all_events,
               sum(n_articles)                         AS articles,
               sum(goldstein_sum)                      AS goldstein_sum
        FROM incidents_retro_daily
        WHERE region_key = ?
        GROUP BY 1 ORDER BY 1
    """, [region]).fetch_df()
    if df.empty:
        raise SystemExit(f"no rows for region '{region}'")

    df["event_date"] = pd.to_datetime(df["event_date"])
    spine = pd.date_range(df.event_date.min(), df.event_date.max(), freq="D")
    df = (df.set_index("event_date").reindex(spine).fillna(0.0)
            .rename_axis("event_date").reset_index())

    r = lambda c: df[c].rolling(window_days, min_periods=window_days).sum()
    df["gz_w"] = r("gz_events")
    df["ex_w"] = r("ex_events")
    df["all_w"] = r("all_events")
    df["art_w"] = r("articles")
    df["gold_w"] = r("goldstein_sum")

    # GDELT 2.0 begins 2015-02-19 and the two generations never overlap, so the
    # date alone identifies the instrument. A rolling window straddling the
    # handover mixes both; those days are labelled by their end date and should
    # be read with that in mind.
    df["gen"] = np.where(df.event_date >= GDELT2_START, "gdelt20", "gdelt10")
    return df


def _scale(vals: np.ndarray, ref: np.ndarray, mode: str) -> np.ndarray:
    """
    Put a term on a comparable scale so the nominal weights mean something.

    legacy   what the live formula does: log1p of a shifted z for GZ, raw z for
             EX. Kept only so the broken behaviour stays visible next to the
             alternatives.
    zscore   z against the holdout, clipped to +/-4. Simple, but sensitive to a
             tiny holdout sd -- which is exactly what blows EX up, since force
             posture is 0.3% of events.
    rank     percentile position within the holdout distribution, 0..1. Bounded
             by construction, so no term can dominate regardless of sparsity.
             The right default for sparse counts.
    """
    ref = ref[~np.isnan(ref)]
    if mode == "rank":
        if len(ref) == 0:
            return np.full_like(vals, np.nan, dtype=float)
        srt = np.sort(ref)
        out = np.searchsorted(srt, vals, side="right") / len(srt)
        return np.where(np.isnan(vals), np.nan, out)
    mu, sd = ref.mean(), ref.std(ddof=1)
    if not sd or math.isnan(sd) or sd == 0:
        raise SystemExit("holdout sd is zero; widen the holdout window")
    z = (vals - mu) / sd
    if mode == "zscore":
        return np.clip(z, -4.0, 4.0)
    return np.log1p(np.clip(z + 1.0, 0.0, None))      # legacy


def build_ei(df: pd.DataFrame, holdouts: dict, mode: str) -> pd.DataFrame:
    """
    Scaling parameters are calibrated per GDELT generation.

    Version 2 added coverage of 65 languages, so the corpus expands sharply at
    the 2015-02-19 handover. Ranks calibrated on version 1 then place ordinary
    version 2 days near the ceiling, which is what produced every false
    positive in the first calibration run. Calibrating each generation against
    its own quiet holdout removes the artefact.

    EX is expressed as a share of all events rather than as a count, for the
    same reason GZ is: a raw count rises whenever the corpus does.
    """
    out = df.copy()
    out["gz_norm_w"] = out.gz_w / out.art_w.replace(0, np.nan)
    out["ex_share_w"] = out.ex_w / out.all_w.replace(0, np.nan)
    out["gold_neg_w"] = -out.gold_w

    for c in ["gzterm_raw", "gzterm_norm", "exterm", "ei_goldstein"]:
        out[c] = np.nan

    for gen, (h0, h1) in holdouts.items():
        seg = out.gen == gen
        if not seg.any():
            continue
        h = out[seg & (out.event_date >= h0) & (out.event_date <= h1)]
        if len(h) < 30:
            raise SystemExit(
                f"holdout for {gen} ({h0}..{h1}) has {len(h)} days; need >= 30. "
                f"Widen it in the groundtruth YAML.")

        out.loc[seg, "exterm"] = W_EX * _scale(
            out.loc[seg, "ex_share_w"].to_numpy(float),
            h.ex_share_w.to_numpy(float), mode)
        for name, col in [("raw", "gz_w"), ("norm", "gz_norm_w")]:
            out.loc[seg, f"gzterm_{name}"] = W_GZ * _scale(
                out.loc[seg, col].to_numpy(float), h[col].to_numpy(float), mode)
        # The baseline is calibrated on the whole generation, not on the quiet
        # holdout. Ranking a conflict scalar against a period with almost no
        # conflict pins nearly every later day at 1.0, which is what made the
        # first baseline comparison useless: every recorded hit sat exactly at
        # the ceiling. Using the full distribution costs the baseline nothing
        # in fairness, since it is a fixed public series rather than something
        # being fitted.
        ref_gold = out.loc[seg, "gold_neg_w"].to_numpy(float)
        out.loc[seg, "ei_goldstein"] = _scale(
            out.loc[seg, "gold_neg_w"].to_numpy(float), ref_gold, mode)

    for name in ["raw", "norm"]:
        out[f"exterm_{name}"] = out["exterm"]
        out[f"ei_{name}"] = out[f"gzterm_{name}"] + out["exterm"] + W_BASE * 1.0
    return out


def term_scales(df: pd.DataFrame) -> None:
    """
    Weights only mean what you think if the terms share a scale. log1p squashes
    GZ into roughly 0-3 while a raw z-score on EX is unbounded, so nominal
    weights of 0.45 and 0.35 can hide a term ratio of 1:20.
    """
    print("\n--- term contributions (mean |value| over complete windows) ---")
    d = df.dropna(subset=["ei_raw"])
    for v in ["raw", "norm"]:
        g = d[f"gzterm_{v}"].abs().mean()
        e = d[f"exterm_{v}"].abs().mean()
        b = W_BASE
        tot = g + e + b
        print(f"  EI_{v:<5} GZ {g:8.3f} ({100*g/tot:5.1f}%)   "
              f"EX {e:8.3f} ({100*e/tot:5.1f}%)   BASE {b:6.3f} ({100*b/tot:5.1f}%)")
    print("  Nominal weights are GZ 0.45 / EX 0.35 / BASE 0.20.")
    print("  If the realised shares differ sharply, the weights are decorative.")


def confound(df: pd.DataFrame) -> None:
    print("\n--- confound check (whole series, complete windows only) ---")
    d = df.dropna(subset=["ei_raw", "ei_norm", "art_w", "gold_w"])
    for v in ["raw", "norm"]:
        c_art = d[f"ei_{v}"].corr(d.art_w)
        c_gold = d[f"ei_{v}"].corr(d.gold_w)
        verdict = ("EI is essentially an article counter" if abs(c_art) > 0.85
                   else "some independence from volume" if abs(c_art) > 0.6
                   else "largely independent of volume")
        print(f"  EI_{v:<5} vs article volume : {c_art:+.3f}   <- {verdict}")
        print(f"  EI_{v:<5} vs Goldstein sum   : {c_gold:+.3f}")
    print("\n  Goldstein is GDELT's own conflict scalar and costs nothing to")
    print("  compute. If EI does not beat it, EI has no product in it.")


def propose(df: pd.DataFrame, controls: list[dict], mode: str) -> None:
    bounded = (mode == "rank")
    print("\n--- threshold proposal, control windows ONLY ---")
    print("  Event periods were not read. Nothing below was tuned to a hit.")
    for v in ["raw", "norm"]:
        vals = []
        for w in controls:
            m = ((df.event_date >= str(w["start"])) & (df.event_date <= str(w["end"])))
            vals.append(df.loc[m, f"ei_{v}"].dropna())
        s = pd.concat(vals)
        if s.empty:
            print(f"  EI_{v}: no complete windows in the control periods")
            continue
        mu, sd = s.mean(), s.std(ddof=1)
        ceil_ = W_GZ + W_EX + W_BASE
        sat = (s >= ceil_ - 1e-9).mean() if bounded else 0.0
        print(f"\n  EI_{v}:  n={len(s)}  mean={mu:.4f}  sd={sd:.4f}")
        if bounded:
            print(f"          saturated at ceiling: {sat:.1%} of control days")
            if sat > 0.10:
                print("          >10% pinned at the ceiling. The holdout is too")
                print("          narrow to rank against. Widen `holdout` in the")
                print("          groundtruth YAML before pinning any threshold.")
        print(f"          p90={s.quantile(.90):.4f}  p95={s.quantile(.95):.4f}  "
              f"p99={s.quantile(.99):.4f}  max={s.max():.4f}")
        ceiling = W_GZ + W_EX + W_BASE      # rank terms are bounded at 1.0
        for k in (1.5, 2.0):
            cand = mu + k * sd
            flag = ""
            if bounded and cand > ceiling:
                flag = f"  UNREACHABLE (scale caps at {ceiling:.2f})"
            elif cand > s.max():
                flag = "  never reached in the control period"
            print(f"          mean+{k}sd = {cand:.4f}{flag}")
        if bounded:
            print(f"\n          rank scaling is BOUNDED: EI in "
                  f"[{W_BASE:.2f}, {ceiling:.2f}].")
            print("          mean+k*sd is the wrong rule here. Use a control")
            print("          percentile instead:")
            print(f"          p95 = {s.quantile(.95):.4f}   "
                  f"p99 = {s.quantile(.99):.4f}   <- use one of these")
    print("\n  Pin one of these in groundtruth/<region>.yaml as `threshold`,")
    print("  record which in `threshold_basis`, commit, then run --evaluate.")


def evaluate(df: pd.DataFrame, gt: dict, variant: str) -> tuple[int, int, float]:
    thr = float(gt["threshold"])
    if variant == "goldstein":
        # The pre-registered threshold was derived for EI_norm, which lives on
        # [0.20, 1.00]. The Goldstein series is a bare rank on [0, 1], so
        # reusing that number would compare two different rulers. Derive the
        # baseline's own threshold by the SAME procedure -- p95 of the control
        # windows -- so only the signal differs.
        segs = []
        for w in gt.get("control_windows", []):
            m = ((df.event_date >= str(w["start"])) & (df.event_date <= str(w["end"])))
            segs.append(df.loc[m, "ei_goldstein"].dropna())
        pooled = pd.concat(segs)
        thr = float(pooled.quantile(0.95))
        ceil_hits = float((pooled >= 0.999).mean())
        print(f"\n  baseline threshold re-derived as p95 of controls: {thr:.4f}")
        print(f"  baseline saturation on control days: {ceil_hits:.1%}")
        if ceil_hits > 0.10 or thr >= 0.999:
            print("  Baseline is saturated, so this comparison is not valid and")
            print("  must not be cited. Widen its calibration reference before")
            print("  reporting any figure from it.")
    lead = int(gt["lead_window_days"])
    col = f"ei_{variant}"
    s = df.set_index("event_date")[col]

    print(f"\n--- event study, EI_{variant}, threshold {thr:.4f}, "
          f"lead {lead}d ---")
    hits = misses = 0
    print(f"{'event':<34}{'date':<12}{'tier':<6}{'peak':>9}  result")
    for e in gt["events"]:
        d = pd.Timestamp(str(e["event_date"]))
        w = s.loc[d - pd.Timedelta(days=lead): d - pd.Timedelta(days=1)].dropna()
        if w.empty:
            print(f"{e['event_key']:<34}{str(d.date()):<12}{e['severity_tier']:<6}"
                  f"{'--':>9}  no data")
            continue
        peak = w.max()
        crossed = peak >= thr
        # A crossing only counts if the window did not START above threshold --
        # otherwise the "hit" is inherited from the previous event.
        started_above = w.iloc[0] >= thr
        if crossed and not started_above:
            hits += 1
            tag = "HIT"
        elif crossed and started_above:
            tag = "hit (inherited, already elevated)"
        else:
            misses += 1
            tag = "miss"
        print(f"{e['event_key']:<34}{str(d.date()):<12}{e['severity_tier']:<6}"
              f"{peak:>9.4f}  {tag}")

    fp = days = 0
    print("\n  false positives by control window:")
    for w in gt.get("control_windows", []):
        seg = s.loc[str(w["start"]):str(w["end"])].dropna()
        n = int((seg >= thr).sum())
        fp += n
        days += len(seg)
        r = n / len(seg) if len(seg) else float("nan")
        note = (w.get("notes") or "").split(".")[0][:44]
        print(f"    {w['start']} .. {w['end']}  {n:>4} / {len(seg):>4}  "
              f"{r:>6.1%}   {note}")
    rate = fp / days if days else float("nan")
    print(f"\n  hits {hits}   misses {misses}")
    print(f"  false positives {fp} of {days} control days -> {rate:.1%}")
    print("  A single pooled rate hides which window they sit in. If they")
    print("  cluster in an active-conflict window, the index is describing the")
    print("  present rather than forecasting -- a nowcast, not a forecast.")
    print("\n  Report this rate whatever it is. An index with a documented 40%")
    print("  false positive rate is sellable. One without the number is not.")
    return hits, misses, rate


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", type=Path, default=Path("retro.duckdb"))
    ap.add_argument("--region", required=True)
    ap.add_argument("--window-days", type=int, default=7)
    ap.add_argument("--variant", choices=["raw", "norm", "goldstein"], default="raw")
    ap.add_argument("--scaling", choices=["legacy", "zscore", "rank"], default="rank",
                    help="legacy reproduces the current broken weighting")
    m = ap.add_mutually_exclusive_group(required=True)
    m.add_argument("--propose-threshold", action="store_true")
    m.add_argument("--evaluate", action="store_true")
    m.add_argument("--compare-scalings", action="store_true",
                   help="print term contributions under all three scalings and exit")
    a = ap.parse_args()

    root = Path(__file__).resolve().parent
    gt_path = root / "groundtruth" / f"{a.region}.yaml"
    if not gt_path.exists():
        raise SystemExit(f"no groundtruth file at {gt_path}")
    gt = yaml.safe_load(gt_path.read_text(encoding="utf-8"))
    controls = gt.get("control_windows") or []
    if not controls:
        raise SystemExit("groundtruth has no control_windows; false positives "
                         "cannot be counted and the result would be meaningless")

    con = duckdb.connect(str(a.db), read_only=True)
    df = daily_series(con, a.region, a.window_days)

    # Restrict to the region's declared window. Without this the series runs
    # 1979-2026 and every statistic is an average over four decades of
    # unrelated history.
    # Holdout may legitimately predate the scoring window: ranking against 143
    # unusually calm days pins most of the later series at the ceiling and makes
    # any threshold unreachable. An explicit `holdout` in the groundtruth YAML
    # overrides the first control window.
    ho = gt.get("holdout") or {}
    if "start" in ho or not ho:
        flat = (str(ho.get("start") or controls[0]["start"]),
                str(ho.get("end") or controls[0]["end"]))
        holdouts = {"gdelt10": flat, "gdelt20": flat}
        print("WARNING: one holdout for both GDELT generations. The corpus "
              "expands\n  at the 2015-02-19 handover, so this understates "
              "version 2. Define\n  holdout.gdelt10 and holdout.gdelt20 "
              "separately.")
    else:
        holdouts = {g: (str(v["start"]), str(v["end"])) for g, v in ho.items()}
    holdout = holdouts.get("gdelt10") or list(holdouts.values())[0]

    reg_path = root / "regions" / f"{a.region}.yaml"
    if reg_path.exists():
        w = (yaml.safe_load(reg_path.read_text(encoding="utf-8")) or {}).get("window")
        if w:
            lo, hi = pd.Timestamp(str(w["start"])), pd.Timestamp(str(w["end"]))
            # Never clip a holdout away: one of them may sit outside the
            # scoring window entirely, which is fine and often desirable.
            for h0, h1 in holdouts.values():
                lo = min(lo, pd.Timestamp(h0))
                hi = max(hi, pd.Timestamp(h1))
            df = df[(df.event_date >= lo - pd.Timedelta(days=a.window_days))
                    & (df.event_date <= hi)].reset_index(drop=True)
            print(f"window from regions/{a.region}.yaml: {w['start']} .. {w['end']}")

    if a.compare_scalings:
        _ = holdout
        print(f"\nnominal weights GZ {W_GZ} / EX {W_EX} / BASE {W_BASE}")
        for mode in ["legacy", "zscore", "rank"]:
            d = build_ei(df, holdouts, mode)
            print(f"\n[{mode}]")
            term_scales(d)
            cd = d.dropna(subset=["ei_raw", "ei_goldstein"])
            print(f"  corr(EI_raw, articles)   {cd.ei_raw.corr(cd.art_w):+.3f}")
            print(f"  corr(EI_raw, Goldstein)  {cd.ei_raw.corr(cd.ei_goldstein):+.3f}")
        con.close()
        return 0

    df = build_ei(df, holdouts, a.scaling)

    print(f"region {a.region}   window {a.window_days}d rolling")
    print(f"series {df.event_date.min().date()} .. {df.event_date.max().date()}"
          f"   {len(df):,} days")
    print(f"scaling={a.scaling}   calibration per GDELT generation:")
    for g, (h0, h1) in holdouts.items():
        n = int(((df.gen == g) & (df.event_date >= h0)
                 & (df.event_date <= h1)).sum())
        print(f"  {g}: holdout {h0} .. {h1}  ({n} days)")
    print("BASELINE term is a constant placeholder (no SIPRI/COW/V-Dem yet):")
    print("  it shifts the level, not the shape.")

    term_scales(df)
    confound(df)

    if a.propose_threshold:
        propose(df, controls, a.scaling)
    else:
        if gt.get("threshold") in (None, ""):
            raise SystemExit(
                "\nthreshold is not set in the groundtruth YAML.\n"
                "Run --propose-threshold, pin a value, commit, then evaluate.")
        if not gt.get("registered_commit"):
            raise SystemExit(
                "\nregistered_commit is empty. The pre-registration is not\n"
                "committed, so any result here is unreportable. Commit the\n"
                "groundtruth file and paste the SHA in first.")
        evaluate(df, gt, a.variant)

    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
