-- Allow wines to be library-only (not tied to an event). event_id null = personal library; event_id set = event wine.
ALTER TABLE wines
  ALTER COLUMN event_id DROP NOT NULL;
