-- ============================================================
-- 030: Remove ai_overview, add wine_attributes JSONB
--
-- ai_overview ("who makes this wine and one fun fact") is
-- redundant with the producer column and the other ai_* fields.
-- Dropping it simplifies the data model and prevents confusion
-- in the recommendation algorithm.
--
-- wine_attributes (JSONB) captures machine-readable style
-- signals extracted by the LLM at label-scan time:
--   oak, oak_intensity, climate, body_inferred,
--   tannin_inferred, acidity_inferred, style
-- These power implicit preference inference in the Taste Graph
-- recommendation engine (v0.6+), allowing the engine to match
-- bottle metadata against user preferences even when users
-- haven't filled in explicit rating fields.
-- ============================================================

ALTER TABLE wines
  DROP COLUMN IF EXISTS ai_overview,
  ADD COLUMN IF NOT EXISTS wine_attributes jsonb;

-- DROP + recreate view (cannot remove a column with CREATE OR REPLACE)
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
  w.ai_geography,
  w.ai_production,
  w.ai_tasting_notes,
  w.ai_pairings,
  w.wine_attributes,
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

ALTER VIEW public.wines_with_price_privacy SET (security_invoker = on);

GRANT SELECT ON wines_with_price_privacy TO authenticated;
