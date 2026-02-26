-- ============================================================
-- 023: Add wine lifecycle status and drinking window
--
-- New columns on wines:
--   status         – 'storage' (default) or 'consumed'
--   date_consumed  – date the wine was consumed
--   drink_from     – suggested year to start drinking
--   drink_until    – suggested year by which to drink
--
-- Also updates the wines_with_price_privacy view to expose
-- the new columns.
-- ============================================================

ALTER TABLE wines
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'storage'
    CHECK (status IN ('storage', 'consumed')),
  ADD COLUMN IF NOT EXISTS date_consumed date,
  ADD COLUMN IF NOT EXISTS drink_from smallint,
  ADD COLUMN IF NOT EXISTS drink_until smallint;

-- DROP + recreate view (CREATE OR REPLACE cannot reorder columns)
DROP VIEW IF EXISTS wines_with_price_privacy;
CREATE VIEW wines_with_price_privacy AS
SELECT
  w.id,
  w.event_id,
  w.brought_by,
  w.producer,
  w.varietal,
  w.vintage,
  w.region,
  w.label_photo_url,
  w.ai_summary,
  w.quantity,
  w.color,
  w.is_sparkling,
  w.ai_overview,
  w.ai_geography,
  w.ai_production,
  w.ai_tasting_notes,
  w.ai_pairings,
  w.status,
  w.date_consumed,
  w.drink_from,
  w.drink_until,
  w.created_at,
  CASE
    WHEN w.brought_by = auth.uid()
      OR EXISTS (SELECT 1 FROM members m WHERE m.id = auth.uid() AND m.is_admin = true)
      OR (w.event_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM events e WHERE e.id = w.event_id AND e.created_by = auth.uid()
         ))
    THEN w.price_range
    ELSE NULL
  END AS price_range,
  CASE
    WHEN w.brought_by = auth.uid()
      OR EXISTS (SELECT 1 FROM members m WHERE m.id = auth.uid() AND m.is_admin = true)
      OR (w.event_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM events e WHERE e.id = w.event_id AND e.created_by = auth.uid()
         ))
    THEN w.price_cents
    ELSE NULL
  END AS price_cents
FROM wines w;

-- CREATE OR REPLACE VIEW resets view options; re-apply security_invoker.
ALTER VIEW public.wines_with_price_privacy SET (security_invoker = on);

GRANT SELECT ON wines_with_price_privacy TO authenticated;
