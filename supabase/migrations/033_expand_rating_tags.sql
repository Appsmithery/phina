-- Expand allowed rating tags to include oak and floral.
-- Adds tags/note columns if missing (in case migration 028 was not applied),
-- drops the old constraint if it exists, then creates the updated one.

ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS note text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ratings_tags_valid' AND table_name = 'ratings'
  ) THEN
    ALTER TABLE ratings DROP CONSTRAINT ratings_tags_valid;
  END IF;
END $$;

ALTER TABLE ratings
  ADD CONSTRAINT ratings_tags_valid
  CHECK (tags <@ ARRAY['minerality','fruit','spice','tannic','oak','floral']::text[]);
