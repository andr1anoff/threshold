# retro/ — historical backfill and backtest

Batch tooling. Runs locally, not deployed. Nothing in this directory belongs in
the Railway backend or in a `cp` to the live app.

Storage is a local DuckDB file, not Supabase. The two extracts are ~2.9M rows,
roughly 430 MB, against a 500 MB free-tier database that also serves the live
app. Validation scaffolding does not compete with production for quota.

## What ships and what doesn't

| Lane | Artifact | Ships in Bifrost |
|---|---|---|
| Product | `exercises_retro` | yes — this is the asset |
| Validation | `incidents_retro`, `groundtruth_events`, `backtest_runs` | no |

The incident stream exists to prove the Escalation Index does something. It is
derived from GDELT, which is public — there is no product in reselling it. The
exercise registry is the thing nobody else has in machine-readable form.

Consequence: hold the exercise pipeline to production standard. Treat the
backtest as scaffolding and do not gold-plate it.

## Hard rules

1. **Never write retro rows into `incidents`.** If retro data lands in the live
   table the live index silently starts including 2013, and you find out weeks
   later from wrong numbers.
2. **One scorer, two callers.** The Escalation Index must be computed by the
   same code path for live and retro. If you write a separate retro scoring
   function you are comparing two implementations, not two periods. This means
   refactoring the scorer into a pure function: window of data in, EI out.
3. **`license_class` gates the product lane.** Anything not `open` may be used
   for validation and must never reach Bifrost.

## Excluded on purpose

**ACLED is unusable here, in both lanes.** Its EULA bars using the data to
train, test, develop or improve ML/LLM systems regardless of whether the use is
commercial, academic or experimental, and separately bars monetized derivative
products. The pipeline is LLM-based and Bifrost is commercial. Both clauses
apply. Do not add it back later having forgotten why it is absent.

**IISS Military Balance** — paywalled.

Usable and clean: GDELT, UCDP GED (CC-BY), SIPRI, Correlates of War, V-Dem,
NOTAM and navigational warnings, OSCE Vienna Document notifications, OpenSky.

## Two decisions to make before the first run

Both have to be settled now, not discovered later.

### 1. Kappa regime

Per-region kappa normalization was calibrated on live data. Applying live kappa
to retro is wrong. Recalibrating kappa on retro is circular. Pick one and record
it in `backtest_runs.kappa_mode`:

- `fixed_holdout` — calibrate kappa on a slice of the retro window that
  contains no ground-truth event, freeze it, score the rest. Cleaner.
- `two_regime_documented` — separate kappa for retro and live, with the
  discontinuity stated explicitly in the report. Weaker but simpler.

### 2. Threshold

`groundtruth/ukraine.yaml` ships with `threshold: null` deliberately. You set
it, from the control window statistics only — for example region mean plus
1.5 standard deviations over 2013-07 to 2013-10, which contains no event.
Record how you derived it in `threshold_basis`. Setting the threshold after
looking at event-period data is fitting, not validation.

## The number that matters most

`backtest_runs.corr_ei_volume` — correlation between EI and raw article volume
for the region.

The GZ term carries 0.45 of the index and is count-based. Article volume about
Ukraine rose by orders of magnitude between mid-2013 and March 2014, so the
index will climb whether or not it measures anything. If EI and volume correlate
around 0.9, the index is a headline counter with extra steps and the weighting
needs rework before Bifrost has customers.

Ukraine is the worst case for this confound, which makes it an excellent test of
the confound and a poor test of prediction. That is why it is the calibration
case and the Baltic is the validation case.

## Known instrument problems in this window

- **GDELT 2.0 begins 2015-02-19.** Before that, GDELT 1.0: daily updates and no
  translingual coverage. Russian- and Ukrainian-language media are largely
  absent, so the pre-2015 stream reflects Western attention rather than local
  signal. Western attention to Ukraine surged *after* Maidan. The index may
  therefore look lagging when the instrument, not the method, is at fault.
- **Coding change 2013-04-01.** From that date GDELT 1.0 stores records by the
  date the event was found in the media, not the date it occurred. The window
  starts after this, so no split, but document it.
- **Field accuracy roughly 55%, redundancy up to 20%** per a 2025 audit of the
  event database. Deduplicate and expect noise. This is why the region
  definition uses two independent selectors and records which one matched.

## Run order

```bash
# 1. schema
psql "$SUPABASE_URL" -f migrations/001_retro_schema.sql

# 2. see what a pull would cost before spending anything
python3.11 extract_gdelt.py --region regions/ukraine.yaml --out data/ \
    --max-gb 8 --dry-run

# 3. pin the pre-registration: review groundtruth/ukraine.yaml, set threshold
#    and threshold_basis, commit, paste the SHA into registered_commit
git add groundtruth/ukraine.yaml && git commit -m "pre-register ukraine backtest"

# 4. see which scaling makes the weights real (reads control windows only)
python3.11 score.py --db retro.duckdb --region ukraine --compare-scalings

# 5. propose a threshold from control windows only
python3.11 score.py --db retro.duckdb --region ukraine --propose-threshold

# 6. pin threshold + threshold_basis, commit, paste SHA into registered_commit

# 7. evaluate, then compare against the free baseline
python3.11 score.py --db retro.duckdb --region ukraine --evaluate
python3.11 score.py --db retro.duckdb --region ukraine --evaluate --variant goldstein
```

`--evaluate` refuses to run until both `threshold` and `registered_commit` are
set. That is not nagging, it is the only structural guarantee that the threshold
was not tuned until the hits looked good.

BigQuery's free tier is 1 TB scanned per month. The script dry-runs every
segment and refuses to execute over budget. Raise `--max-gb` deliberately, never
reflexively.

## Scaling: the bug this pipeline found on day one

The live formula is `EI = log1p(GZ)*0.45 + z(EX)*0.35 + BASE*0.20`. Running it
over Ukraine 2013-2015 gives realised term contributions of:

    legacy   GZ  8.3%   EX 90.5%   BASE 1.3%

against nominal weights of 45 / 35 / 20. The weights are decorative. `log1p`
compresses GZ into roughly 0-3 while a raw z-score on EX is unbounded, and EX
is built on CAMEO root code 15, which is 0.3% of all events. A tiny holdout
standard deviation on a sparse count sends the z-score past 40.

Result: the index is 90% one noisy term. Its peaks sit wherever a handful of
force-posture events happened to land.

`score.py --compare-scalings` puts three options side by side:

| mode | GZ / EX / BASE | corr with article volume |
|---|---|---|
| `legacy` | 8.3 / 90.5 / 1.3 | +0.828 |
| `zscore` | 53.3 / 39.7 / 7.0 | +0.665 |
| `rank` | 44.4 / 34.1 / 21.5 | +0.590 |

`rank` — percentile position within the holdout distribution — reproduces the
intended 45 / 35 / 20 almost exactly and cuts the volume confound the most. It
is bounded by construction, so no term can dominate through sparsity. That is
why it is the default.

`legacy` is kept only so the broken behaviour stays visible next to the fix. It
reproduces the live asymmetry faithfully: log1p on GZ, raw unclipped z on EX.

### The number still unexplained

Correlation between EI and Goldstein is roughly 0.00 to 0.02 under every
scaling. Goldstein is GDELT's own conflict scalar, free, already in the
extract. Two readings, and the event study is what separates them:

- EI captures something Goldstein misses. That would be the product.
- EI captures noise. That would mean the approach needs rework, not the weights.

`score.py --evaluate --variant goldstein` runs the same event study on the
Goldstein series. If Goldstein beats EI on hits and false positives, the index
is not the thing worth selling — the exercise registry is.

## Not built yet

- Refactoring the LIVE scorer to call the same scaling code. Right now `score.py`
  reimplements the formula; until the live path calls one shared pure function,
  you are comparing two implementations rather than two periods.
- BASELINE is a constant placeholder. SIPRI Milex, Correlates of War and V-Dem
  are all open-licensed and not yet wired in. Until they are, the term shifts
  the level and not the shape.
- Retro/live classification overlap test: same weeks scored by the CAMEO
  crosswalk and by the live LLM classifier, to measure the bias between them.
- Exercise ingest — port the Wikidata and Wikipedia connectors from ELITKA.
  An exercise resolves better than a person: hard anchors on dates, country
  sets and code names, rather than fuzzy name matching.
