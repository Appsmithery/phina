-- Add quantity (1-12) to wines for event and future cellar use
ALTER TABLE wines
  ADD COLUMN IF NOT EXISTS quantity smallint NOT NULL DEFAULT 1
    CHECK (quantity >= 1 AND quantity <= 12);
