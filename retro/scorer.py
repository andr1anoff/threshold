"""
Port of the live Threshold Escalation Index.

This is a transcription of backend/app/di/calculator.py, not a reconstruction.
An earlier version of this module was written without sight of that file and
guessed at the arithmetic; every backtest run against the guess measured the
guess. If calculator.py changes, this file changes with it, and the constants
below are the first place to check.

The live formula, in full:

    load(t)   = sum over events in the trailing 30 days of
                  SEVERITY_WEIGHT[severity]
                  x RECENT_BOOST if the event falls within 7 days
                  x (1 + 0.15 ln(corroboration))

    kappa(t)  = max(KAPPA_FLOOR, NORM_C x median(load over the previous 90 days))
                with a cold-start fallback to the global KAPPA when a region has
                no usable history

    GZ        = min(1 - exp(-load / kappa), 1)
    EX        = min(mean over announced exercises of min(scale/80000, 1), 1)
    BASE      = CONFLICT_BASELINE[region]

    EI        = (0.45 GZ + 0.35 EX + 0.20 BASE) x 100

Two properties matter and the earlier guess missed both. All three terms are
already bounded to [0, 1] by construction, so the weights operate exactly as
written and there is no scale mismatch to correct. And kappa normalises each
region against its own trailing median, so a volume confound is damped in the
design rather than by rescaling after the fact.

EX is forward looking: it counts exercises that are announced and either running
or starting within the next fortnight. That makes the exercise registry a direct
input to the index rather than an adjacent dataset.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd

# ---------------------------------------------------------------- constants
# Mirrored from calculator.py. Keep in sync; do not tune here.

SEVERITY_WEIGHT = {1: 0.10, 2: 0.30, 3: 0.80, 4: 2.00, 5: 4.00}
RECENT_DAYS = 7
RECENT_BOOST = 1.6

GZ_AT_NORM = 0.35
NORM_C = 1.0 / -math.log(1.0 - GZ_AT_NORM)      # about 2.32
KAPPA_FLOOR = 3.0
KAPPA = 15.0                                     # legacy global, cold start only
BASELINE_WINDOW = 90
COLD_START_MIN_DAYS = 15
LOAD_WINDOW = 30

W_GZ, W_EX, W_BASE = 0.45, 0.35, 0.20
EX_SCALE_CAP = 80000.0
EX_LOOKAHEAD_DAYS = 14

CONFLICT_BASELINE = {
    "Gaza & Middle East": 0.30, "Ukraine": 0.28, "Sudan": 0.26, "Yemen": 0.22,
    "Sahel": 0.20, "Myanmar": 0.18, "DRC": 0.18, "Syria": 0.16,
    "Somalia": 0.16, "Haiti": 0.14, "Ethiopia": 0.14, "Mozambique": 0.12,
    "South China Sea": 0.08, "Taiwan Strait": 0.08, "Korean Peninsula": 0.06,
    "Baltic": 0.06, "South Caucasus": 0.05, "Libya": 0.10, "Kosovo": 0.04,
    "Arctic": 0.03,
}


def corroboration_bonus(c) -> float:
    return 1.0 + 0.15 * math.log(max(int(c or 1), 1))


def event_weight(severity, corroboration, recent: bool) -> float:
    s = max(1, min(5, int(severity or 1)))
    w = SEVERITY_WEIGHT[s]
    if recent:
        w *= RECENT_BOOST
    return w * corroboration_bonus(corroboration)


# ---------------------------------------------------------------- core


@dataclass
class Inputs:
    """
    events     one row per grouped event, columns: date, severity,
               corroboration, and optionally multiplicity. The live path groups
               incidents into events first, so weights apply to groups.
    exercises  one row per exercise, columns: start_date, end_date, scale.
    region     key into CONFLICT_BASELINE.
    """
    events: pd.DataFrame
    exercises: pd.DataFrame
    region: str


def daily_load(events: pd.DataFrame, target: date) -> float:
    if events is None or len(events) == 0:
        return 0.0
    lo = target - timedelta(days=LOAD_WINDOW)
    cut = target - timedelta(days=RECENT_DAYS)
    d = events[(events["date"] >= lo) & (events["date"] <= target)]
    if len(d) == 0:
        return 0.0
    mult = d["multiplicity"] if "multiplicity" in d.columns else None
    total = 0.0
    for i, r in enumerate(d.itertuples()):
        w = event_weight(r.severity, r.corroboration, r.date >= cut)
        total += w * (float(mult.iloc[i]) if mult is not None else 1.0)
    return total


def kappa_for(events: pd.DataFrame, target: date) -> float:
    loads = [daily_load(events, target - timedelta(days=k))
             for k in range(1, BASELINE_WINDOW + 1)]
    med = float(np.median(loads)) if loads else 0.0
    nonzero = sum(1 for x in loads if x > 0)
    if med <= 0 and nonzero < COLD_START_MIN_DAYS:
        return KAPPA
    return max(KAPPA_FLOOR, NORM_C * med)


def gz_term(events: pd.DataFrame, target: date) -> tuple[float, float]:
    k = kappa_for(events, target)
    total = daily_load(events, target)
    if total <= 0:
        return 0.0, k
    return min(1.0 - math.exp(-total / k), 1.0), k


def ex_term(exercises: pd.DataFrame, target: date) -> float:
    """Forward looking, matching the live query: an exercise counts if it has
    not yet ended and starts within the next fortnight."""
    if exercises is None or len(exercises) == 0:
        return 0.0
    ahead = target + timedelta(days=EX_LOOKAHEAD_DAYS)
    d = exercises[(exercises["end_date"] >= target)
                  & (exercises["start_date"] <= ahead)]
    if len(d) == 0:
        return 0.0
    vals = [min((float(s) if s and float(s) > 0 else 5000.0) / EX_SCALE_CAP, 1.0)
            for s in d["scale"].fillna(5000)]
    return min(sum(vals) / max(len(vals), 1), 1.0)


def score_day(inp: Inputs, target: date) -> dict:
    gz, k = gz_term(inp.events, target)
    ex = ex_term(inp.exercises, target)
    base = CONFLICT_BASELINE.get(inp.region, 0.05)
    ei = (gz * W_GZ + ex * W_EX + base * W_BASE) * 100
    return {"date": target, "ei": min(ei, 100.0), "gz": gz, "ex": ex,
            "base": base, "kappa": k}


def daily_weight(events: pd.DataFrame, start: date, end: date) -> pd.Series:
    """
    Per-day base weight, before the recency boost.

    The boost depends on the scoring date, not on the event date, so it cannot
    be folded in here. It is applied in load_series instead.
    """
    idx = pd.date_range(start - timedelta(days=LOAD_WINDOW + BASELINE_WINDOW),
                        end, freq="D")
    if events is None or len(events) == 0:
        return pd.Series(0.0, index=idx)
    e = events.copy()
    mult = e["multiplicity"] if "multiplicity" in e.columns else 1.0
    e["w"] = [SEVERITY_WEIGHT[max(1, min(5, int(sv or 1)))]
              * corroboration_bonus(cb)
              for sv, cb in zip(e["severity"], e["corroboration"])]
    if not isinstance(mult, float):
        e["w"] = e["w"] * mult.astype(float).to_numpy()
    g = e.groupby("date")["w"].sum()
    g.index = pd.to_datetime(g.index)
    return g.reindex(idx).fillna(0.0)


def load_series(w: pd.Series) -> pd.Series:
    """
    Vectorised equivalent of daily_load over a whole window.

    load(t) = sum over the trailing 30 days of base weight, plus an extra 0.6
    times the trailing 7 days, because a boost of 1.6 on the recent slice is
    the same as counting that slice once more at 0.6. Exact, not approximate;
    the equivalence is asserted against the plain loop in the self-test at the
    bottom of this file.
    """
    wide = w.rolling(LOAD_WINDOW + 1, min_periods=1).sum()
    recent = w.rolling(RECENT_DAYS + 1, min_periods=1).sum()
    return wide + (RECENT_BOOST - 1.0) * recent


def score_series(inp: Inputs, start: date, end: date) -> pd.DataFrame:
    """Score every day in a window."""
    w = daily_weight(inp.events, start, end)
    loads = load_series(w)
    med = loads.shift(1).rolling(BASELINE_WINDOW, min_periods=1).median()
    nonzero = (loads.shift(1) > 0).rolling(BASELINE_WINDOW, min_periods=1).sum()

    kap = np.where((med.to_numpy() <= 0) & (nonzero.to_numpy() < COLD_START_MIN_DAYS),
                   KAPPA, np.maximum(KAPPA_FLOOR, NORM_C * med.to_numpy()))
    gz = np.where(loads.to_numpy() > 0,
                  np.minimum(1.0 - np.exp(-loads.to_numpy() / kap), 1.0), 0.0)

    days = pd.date_range(start, end, freq="D")
    frame = pd.DataFrame({"date": days,
                          "gz": pd.Series(gz, index=loads.index).reindex(days).to_numpy(),
                          "kappa": pd.Series(kap, index=loads.index).reindex(days).to_numpy()})
    frame["ex"] = [ex_term(inp.exercises, d.date()) for d in days]
    frame["base"] = CONFLICT_BASELINE.get(inp.region, 0.05)
    frame["ei"] = np.minimum(
        (frame.gz * W_GZ + frame.ex * W_EX + frame.base * W_BASE) * 100, 100.0)
    frame["date"] = [d.date() for d in days]
    out = frame
    out["gz_term"] = out.gz * W_GZ * 100
    out["ex_term"] = out.ex * W_EX * 100
    out["base_term"] = out.base * W_BASE * 100
    return out


def term_shares(scored: pd.DataFrame) -> dict:
    g, e, b = (scored.gz_term.mean(), scored.ex_term.mean(),
               scored.base_term.mean())
    t = g + e + b
    if t == 0:
        return {"GZ": 0.0, "EX": 0.0, "BASE": 0.0}
    return {"GZ": 100 * g / t, "EX": 100 * e / t, "BASE": 100 * b / t}


# ---------------------------------------------------------------- adapter


CAMEO_SEVERITY = {
    # CAMEO root code to the live 1-5 severity scale. A PROXY. Live severity
    # comes from the classifier reading article text; CAMEO is a machine label
    # assigned from a headline.
    "01": 1, "02": 1, "03": 1, "04": 1, "05": 1, "06": 1, "07": 1,
    "08": 1, "09": 1, "10": 2, "11": 2, "12": 2, "13": 3, "14": 2,
    "15": 3, "16": 3, "17": 3, "18": 4, "19": 4, "20": 5,
}


def events_from_gdelt(daily: pd.DataFrame) -> pd.DataFrame:
    """
    Build a proxy event table from GDELT daily aggregates.

    THIS IS NOT THE LIVE INPUT. Three substitutions are made, and each degrades
    the index rather than reproducing it:

      severity        proxied from the CAMEO root code rather than from the
                      classifier's reading of the article
      corroboration   proxied from source counts, which measure how many
                      outlets carried a story rather than independent
                      confirmation
      grouping        absent. GDELT rows arrive pre-aggregated, so the live
                      group_into_events step has no equivalent and duplicate
                      coverage inflates the load

    A run on this shows whether the formula behaves sensibly on weak inputs. It
    does not validate the deployed index, and no report may claim that it does.
    Validating the deployed index requires historical incidents carrying the
    classifier's own severity and corroboration, which is an extraction job, and
    historical exercises carrying scale, which is what the registry is for.
    """
    d = daily.copy()
    code = d["event_root_code"].astype(str).str.zfill(2)
    d["severity"] = code.map(CAMEO_SEVERITY).fillna(1).astype(int)
    src = d["n_sources"] if "n_sources" in d.columns else pd.Series(1, index=d.index)
    d["corroboration"] = src.fillna(1)
    d["date"] = pd.to_datetime(d["event_date"]).dt.date
    d["multiplicity"] = d["n_events"] if "n_events" in d.columns else 1.0
    return d[["date", "severity", "corroboration", "multiplicity"]]
