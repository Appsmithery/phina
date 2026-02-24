-- Allow wines to be cellar-only (not tied to an event). event_id null = personal cellar; event_id set = event wine.
ALTER TABLE wines
  ALTER COLUMN event_id DROP NOT NULL;
