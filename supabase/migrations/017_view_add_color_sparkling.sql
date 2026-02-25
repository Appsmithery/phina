-- Update wines_with_price_privacy view to include color and is_sparkling
CREATE OR REPLACE VIEW wines_with_price_privacy AS
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
  w.created_at,
  CASE
    WHEN w.brought_by = auth.uid()
      OR EXISTS (SELECT 1 FROM events e WHERE e.id = w.event_id AND e.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM members m WHERE m.id = auth.uid() AND m.is_admin = true)
    THEN w.price_range
    ELSE NULL
  END AS price_range,
  CASE
    WHEN w.brought_by = auth.uid()
      OR EXISTS (SELECT 1 FROM events e WHERE e.id = w.event_id AND e.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM members m WHERE m.id = auth.uid() AND m.is_admin = true)
    THEN w.price_cents
    ELSE NULL
  END AS price_cents
FROM wines w;

GRANT SELECT ON wines_with_price_privacy TO authenticated;
