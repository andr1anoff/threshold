-- Run this in Supabase SQL Editor to set up the schema

-- INCIDENTS (Gray Zone events)
CREATE TABLE IF NOT EXISTS incidents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date             DATE NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  category         TEXT CHECK (category IN ('cyber','airspace','maritime','disinfo','economic','proxy','unknown','none')),
  actors           TEXT[],
  region           TEXT,
  source_url       TEXT UNIQUE,
  source_name      TEXT,
  escalation_level INT CHECK (escalation_level BETWEEN 1 AND 5) DEFAULT 1,
  raw_text         TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- EXERCISES (Joint Military Exercises)
CREATE TABLE IF NOT EXISTS exercises (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  start_date     DATE,
  end_date       DATE,
  region         TEXT,
  participants   TEXT[],
  scale          INT,
  lead_nation    TEXT,
  exercise_type  TEXT CHECK (exercise_type IN ('NATO','bilateral','national','SCO','CSTO','unknown')),
  signal_target  TEXT,
  rhetoric_score FLOAT CHECK (rhetoric_score BETWEEN -1.0 AND 1.0),
  source_url     TEXT UNIQUE,
  statements     JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- DETERRENCE INDEX (calculated daily per region)
CREATE TABLE IF NOT EXISTS deterrence_index (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region     TEXT NOT NULL,
  actor_pair TEXT,
  date       DATE NOT NULL,
  di_score   FLOAT NOT NULL CHECK (di_score BETWEEN 0 AND 100),
  gz_score   FLOAT,
  ex_score   FLOAT,
  rh_score   FLOAT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (region, date)
);

-- CORRELATIONS (incident → exercise patterns)
CREATE TABLE IF NOT EXISTS correlations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  UUID REFERENCES incidents(id) ON DELETE CASCADE,
  exercise_id  UUID REFERENCES exercises(id) ON DELETE CASCADE,
  region       TEXT,
  actor_pair   TEXT,
  lag_days     INT,
  pattern_type TEXT,
  narrative    TEXT,
  confidence   FLOAT CHECK (confidence BETWEEN 0 AND 1),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_incidents_region ON incidents(region);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(date DESC);
CREATE INDEX IF NOT EXISTS idx_exercises_region ON exercises(region);
CREATE INDEX IF NOT EXISTS idx_exercises_start ON exercises(start_date);
CREATE INDEX IF NOT EXISTS idx_di_region_date ON deterrence_index(region, date DESC);

-- Enable Row Level Security (all data is public read)
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE deterrence_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE correlations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON incidents FOR SELECT USING (true);
CREATE POLICY "Public read" ON exercises FOR SELECT USING (true);
CREATE POLICY "Public read" ON deterrence_index FOR SELECT USING (true);
CREATE POLICY "Public read" ON correlations FOR SELECT USING (true);

-- v7: content deduplication
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS content_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_content_hash ON incidents(content_hash);
