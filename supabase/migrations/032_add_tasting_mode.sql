-- ============================================================
-- Migration 032: Add tasting_mode to events
--
-- Single Blind (default): Guests see wine details but not
-- results until the event ends.
-- Double Blind: Guests see only wine numbers during active
-- rounds — details are revealed when the event ends.
-- ============================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS tasting_mode text DEFAULT 'single_blind'
    CHECK (tasting_mode IN ('single_blind', 'double_blind'));
