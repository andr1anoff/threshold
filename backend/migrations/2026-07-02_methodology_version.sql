-- v18: per-region kappa normalization. Track which formula produced each row
-- so history charts can mark methodology transitions honestly.
ALTER TABLE escalation_index ADD COLUMN IF NOT EXISTS methodology_version TEXT DEFAULT 'v16';
-- Rows written after this migration get 'v18' from the backend explicitly.
