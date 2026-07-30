-- exercises_urls.sql
-- Stage 0 of the Bifrost extraction funnel.
--
-- Pulls the source article URLs behind CAMEO root code 15 (exhibit force
-- posture) for the Baltic theatre. These are pointers, not data: code 15 tells
-- you where to look, the article tells you who exercised, when, and at what
-- scale.
--
-- COST: BigQuery charges for columns scanned, not rows returned, and neither
-- gdelt-bq.full.events nor gdelt-bq.gdeltv2.events prunes on SQLDATE. The WHERE
-- clause therefore does not reduce the bill; the SELECT list does. SOURCEURL is
-- a long string and likely the most expensive column here.
--
-- Check the validator estimate before running. Budget roughly 40-70 GB against
-- a 1 TB monthly free-tier allowance.
--
-- Save results via Save results -> Google Drive, then to retro/data/.

SELECT
    SQLDATE,
    ActionGeo_CountryCode,
    Actor1CountryCode,
    Actor2CountryCode,
    SOURCEURL
FROM `gdelt-bq.gdeltv2.events`
WHERE EventRootCode = '15'
  AND ActionGeo_CountryCode IN
      ('LG','LH','EN','FI','SW','NO','PL','RS','BO')   -- LV LT EE FI SE NO PL RU BY
  AND SQLDATE >= 20150219
  AND SOURCEURL IS NOT NULL
GROUP BY 1, 2, 3, 4, 5;

-- GROUP BY rather than DISTINCT on purpose: it collapses the many events that
-- cite the same article on the same day, which is most of the 435,452 events
-- in this slice. Expect the row count out to be far below that.
--
-- If the estimate comes back above budget, drop Actor1CountryCode and
-- Actor2CountryCode first. They are useful for provenance but the article
-- itself carries participant information more reliably than CAMEO actor codes,
-- which resolve to a single country per side and cannot represent a ten-nation
-- exercise.
