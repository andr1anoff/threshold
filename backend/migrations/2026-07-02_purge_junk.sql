-- POSTMORTEM PURGE: 2026-07-01 ~23:20 UTC scrape ran with a broken (fail-open)
-- security filter. Every incident inserted in that window bypassed the gate.
-- Deleting the whole window is safe: real incidents will be re-ingested by the
-- next scrape (feeds keep 30+ entries), this time through the working filter.

-- 1. Look first — sanity check the count and eyeball a few titles:
SELECT count(*) FROM incidents WHERE created_at >= '2026-07-01T23:00:00Z';
SELECT title, region, source_name FROM incidents
WHERE created_at >= '2026-07-01T23:00:00Z' ORDER BY created_at DESC LIMIT 20;

-- 2. If the sample is the expected garbage — purge:
DELETE FROM incidents WHERE created_at >= '2026-07-01T23:00:00Z';
