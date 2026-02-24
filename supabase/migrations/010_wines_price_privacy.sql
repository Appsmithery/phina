-- Add optional price metadata to wines; visible only to uploader, event host, or admin.
ALTER TABLE wines
  ADD COLUMN IF NOT EXISTS price_range text
    CHECK (price_range IS NULL OR price_range IN ('<$20', '20-35', '35-50', '>50'));
ALTER TABLE wines
  ADD COLUMN IF NOT EXISTS price_cents integer
    CHECK (price_cents IS NULL OR price_cents >= 0);

-- View: same as wines but price_range and price_cents are null unless requester is
-- the wine's brought_by, the event's created_by, or an admin.
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
