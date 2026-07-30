# retro/ — historical backfill and backtest

Batch tooling. Runs locally, not deployed. Nothing in this directory belongs in
the Railway backend or in a `cp` to the live app.

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

# 4. pull
python3.11 extract_gdelt.py --region regions/ukraine.yaml --out data/ \
    --max-gb 8 --execute
```

BigQuery's free tier is 1 TB scanned per month. The script dry-runs every
segment and refuses to execute over budget. Raise `--max-gb` deliberately, never
reflexively.

## Not built yet

- `crosswalk.py` — deterministic CAMEO to category mapping. Not an LLM. This is
  also where the retro/live classification bias overlap test lives.
- `load.py` — JSONL into `incidents_retro`, idempotent on `dedupe_key`.
- `score.py` — calls the shared scorer over a retro window.
- `evaluate.py` — event study, false positive rate, both confound correlations.
- Exercise ingest — port the Wikidata and Wikipedia connectors from ELITKA.
  An exercise resolves better than a person: hard anchors on dates, country
  sets and code names, rather than fuzzy name matching.
