-- Add color and sparkling fields to wines table
ALTER TABLE wines
  ADD COLUMN color text CHECK (color IS NULL OR color IN ('red', 'white', 'skin-contact')),
  ADD COLUMN is_sparkling boolean NOT NULL DEFAULT false;
