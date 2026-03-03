-- Add optional phone number to member profiles.
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS phone text;
