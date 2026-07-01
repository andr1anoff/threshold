-- =====================================================================
-- Migration: deterrence_index -> escalation_index, di_score -> ei_score
-- Run this in Supabase SQL Editor BEFORE deploying the updated backend.
-- Rename is metadata-only: instant, no data copied, no downtime.
-- =====================================================================

BEGIN;

ALTER TABLE deterrence_index RENAME TO escalation_index;
ALTER TABLE escalation_index RENAME COLUMN di_score TO ei_score;

-- Compatibility view: any old code (or the currently-deployed Railway
-- instance during the deploy window) that still SELECTs from
-- deterrence_index keeps working. Writes through the view will fail,
-- which is fine — the new backend writes to escalation_index directly.
CREATE VIEW deterrence_index AS
SELECT *, ei_score AS di_score FROM escalation_index;

COMMIT;

-- Rollback (if needed):
-- BEGIN;
-- DROP VIEW deterrence_index;
-- ALTER TABLE escalation_index RENAME COLUMN ei_score TO di_score;
-- ALTER TABLE escalation_index RENAME TO deterrence_index;
-- COMMIT;
