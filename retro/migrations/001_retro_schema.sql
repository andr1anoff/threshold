-- 001_retro_schema.sql
-- Retrospective backfill + backtest tables.
--
-- HARD RULE: nothing here touches the live `incidents` table. The live
-- Escalation Index must never see a retro row. If you ever find yourself
-- writing a JOIN between `incidents` and `incidents_retro` in production
-- code, stop.
--
-- Idempotent: safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- Retro incident stream (validation lane, never ships in Bifrost)
-- ---------------------------------------------------------------------------

create table if not exists incidents_retro (
    id              bigserial primary key,

    -- dedupe_key is computed in Python (see retro/extract_gdelt.py :: dedupe_key)
    -- and NOT as a generated column: date/number -> text casts in Postgres are
    -- only STABLE, not IMMUTABLE, so a generated column would be rejected.
    dedupe_key      text        not null unique,

    region_key      text        not null,
    event_date      date        not null,

    -- Our own taxonomy, assigned by the deterministic CAMEO crosswalk.
    -- Deliberately NOT constrained by a CHECK here: the crosswalk is the
    -- single source of truth and a CHECK constraint drifting out of sync with
    -- it is exactly the bug that burned 944k tokens in June.
    category        text        not null,

    -- Provenance / licensing. license_class gates what may ever reach Bifrost.
    source_version  text        not null
        check (source_version in ('gdelt10', 'gdelt20')),
    license_class   text        not null
        check (license_class in ('open', 'academic_only', 'restricted')),

    -- Raw GDELT fields kept verbatim so the crosswalk can be re-run without
    -- re-querying BigQuery (which costs money; see cost guard in the script).
    cameo_code      text,
    goldstein       numeric(6, 2),
    num_mentions    integer,
    num_sources     integer,
    num_articles    integer,
    avg_tone        numeric(8, 4),
    actor1          text,
    actor2          text,
    geo_lat         numeric(9, 6),
    geo_lon         numeric(9, 6),
    source_url      text,

    ingested_at     timestamptz not null default now()
);

create index if not exists idx_incidents_retro_region_date
    on incidents_retro (region_key, event_date);
create index if not exists idx_incidents_retro_date
    on incidents_retro (event_date);
create index if not exists idx_incidents_retro_license
    on incidents_retro (license_class);

comment on table incidents_retro is
    'Historical incident stream for backtesting only. Never read by the live index.';
comment on column incidents_retro.license_class is
    'open = redistributable; academic_only = validation lane only, must never enter Bifrost; restricted = do not use.';

-- ---------------------------------------------------------------------------
-- Retro exercise registry (Bifrost lane -- this one DOES ship)
-- ---------------------------------------------------------------------------

create table if not exists exercises_retro (
    id              bigserial primary key,
    dedupe_key      text        not null unique,

    -- Canonical name plus the aliases it appears under in sources.
    name            text        not null,
    aliases         text[]      not null default '{}',

    region_key      text        not null,
    date_start      date        not null,
    date_end        date,

    -- ISO 3166-1 alpha-2 where possible.
    participants    text[]      not null default '{}',
    lead_nation     text,

    -- Free text is deliberate: source reporting on scale is inconsistent and
    -- forcing it into an enum destroys information. Normalize downstream.
    scale_personnel integer,
    scale_note      text,
    exercise_type   text,
    domains         text[]      not null default '{}',   -- land / sea / air / cyber / nuclear
    equipment       text[]      not null default '{}',

    -- The field that may carry the most signal in the whole dataset:
    -- a notified exercise and a snap exercise mean different things.
    announced       boolean,
    announcement_source text,                            -- e.g. 'vienna_document', 'press', null

    geo_lat         numeric(9, 6),
    geo_lon         numeric(9, 6),
    geo_note        text,

    -- 0.0-1.0. Bifrost sells confidence and provenance; these two columns are
    -- the product, not metadata.
    confidence      numeric(3, 2) not null
        check (confidence >= 0 and confidence <= 1),
    provenance      jsonb       not null default '[]'::jsonb,
    license_class   text        not null default 'open'
        check (license_class in ('open', 'academic_only', 'restricted')),

    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_exercises_retro_region_start
    on exercises_retro (region_key, date_start);
create index if not exists idx_exercises_retro_announced
    on exercises_retro (announced);

comment on column exercises_retro.provenance is
    'JSON array of {source_url, source_type, retrieved_at, extracted_fields[]}. Every claim must be traceable to at least one entry.';
comment on column exercises_retro.announced is
    'true = notified in advance (Vienna Document or public schedule); false = snap/unannounced; null = unknown. Do not default to false.';

-- ---------------------------------------------------------------------------
-- Pre-registered ground truth
-- ---------------------------------------------------------------------------

create table if not exists groundtruth_events (
    id              bigserial primary key,
    event_key       text        not null unique,
    region_key      text        not null,
    event_date      date        not null,
    label           text        not null,
    severity_tier   smallint    not null check (severity_tier between 1 and 3),
    notes           text,

    -- Which GDELT generation covers this date. Events before 2015-02-19 are
    -- gdelt10-only, which means no translingual coverage -- see README.
    coverage        text        not null
        check (coverage in ('gdelt10', 'gdelt20')),

    -- Pre-registration guard. The git commit that fixed this row BEFORE any
    -- backtest was run. If this is null, the row is not pre-registered and
    -- must be excluded from any reported result.
    registered_commit text,
    registered_at   timestamptz,

    created_at      timestamptz not null default now()
);

create index if not exists idx_groundtruth_region_date
    on groundtruth_events (region_key, event_date);

comment on column groundtruth_events.registered_commit is
    'Git SHA of the commit that pinned this event, window and threshold. Null = not pre-registered = not reportable.';

-- ---------------------------------------------------------------------------
-- Backtest run ledger
-- ---------------------------------------------------------------------------

create table if not exists backtest_runs (
    id              bigserial primary key,
    run_key         text        not null unique,        -- config_hash + started_at
    config_hash     text        not null,               -- sha256 of the resolved config
    config          jsonb       not null,
    code_commit     text,                               -- git SHA of the scorer at run time

    region_key      text        not null,
    window_start    date        not null,
    window_end      date        not null,
    lead_window_days integer    not null,
    threshold       numeric(6, 3) not null,

    -- Kappa regime. See README: applying live kappa to retro is wrong,
    -- recalibrating on retro is circular. Record which choice was made.
    kappa_mode      text        not null
        check (kappa_mode in ('fixed_holdout', 'two_regime_documented')),
    kappa_values    jsonb       not null default '{}'::jsonb,

    -- Results
    hits            integer,
    misses          integer,
    false_positives integer,
    fp_rate         numeric(6, 4),

    -- The confound test. If |corr_ei_volume| is high, the 0.45 GZ weight is
    -- measuring media attention, not escalation. Record it every run.
    corr_ei_volume     numeric(6, 4),
    corr_ei_goldstein  numeric(6, 4),

    notes           text,
    started_at      timestamptz not null default now(),
    finished_at     timestamptz
);

create index if not exists idx_backtest_runs_config
    on backtest_runs (config_hash);

comment on column backtest_runs.corr_ei_volume is
    'Correlation between EI and raw article volume for the region. The single most important number in the run: if it is ~0.9 the index is a headline counter.';

commit;
