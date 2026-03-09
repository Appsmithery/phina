-- Add Partiful cross-link, description, and AI event image fields to events table

ALTER TABLE events ADD COLUMN partiful_url text;
ALTER TABLE events ADD COLUMN description text;
ALTER TABLE events ADD COLUMN event_image_url text;
ALTER TABLE events ADD COLUMN event_image_status text DEFAULT 'none'
  CHECK (event_image_status IN ('none', 'pending', 'generated', 'failed'));
