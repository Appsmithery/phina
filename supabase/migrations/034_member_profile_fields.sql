-- Add profile fields to members table
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS wine_experience text CHECK (
    wine_experience IN ('beginner', 'intermediate', 'advanced', 'professional')
  ),
  ADD COLUMN IF NOT EXISTS profile_complete boolean DEFAULT false;

-- Backfill: split existing name into first_name/last_name, mark profile complete
UPDATE members
SET
  first_name = split_part(name, ' ', 1),
  last_name = CASE
    WHEN position(' ' IN name) > 0
    THEN substring(name FROM position(' ' IN name) + 1)
    ELSE NULL
  END,
  profile_complete = true
WHERE name IS NOT NULL AND name != '';

-- Trigger to keep name column in sync with first_name + last_name
CREATE OR REPLACE FUNCTION sync_member_name() RETURNS TRIGGER AS $$
BEGIN
  NEW.name := trim(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_member_name
  BEFORE INSERT OR UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION sync_member_name();
