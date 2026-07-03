-- Curated exercise registry support (v1.8.1)
-- Adds map coordinates, registry identity for idempotent sync,
-- announcement status, and curation metadata.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS registry_id text UNIQUE;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS participants text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS announcement_status text DEFAULT 'confirmed';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS notes text;

-- Archive the May manual batch: real curated data, keep it, but mark
-- provenance so it is distinguishable from the versioned registry.
UPDATE exercises SET announcement_status = 'archived-manual'
WHERE registry_id IS NULL;
