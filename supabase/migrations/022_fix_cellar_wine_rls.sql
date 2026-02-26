-- ============================================================
-- 022: Fix cellar wine visibility for non-admin users
--
-- The single "Read wines for participants" policy contained
-- subqueries into events and event_members even for personal
-- cellar wines (event_id IS NULL).  Combined with circular RLS
-- between events ↔ event_members and the security-invoker view,
-- this could cause cellar wines to be invisible to non-admin
-- users.
--
-- Fix: split into two policies so cellar-wine reads never
-- touch events/event_members.  Also guard the view's CASE
-- expressions to avoid the same circular path.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Split wines SELECT policy
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Read wines for participants" ON wines;

-- Cellar wines: simple ownership check, no event subqueries
CREATE POLICY "Read own cellar wines" ON wines
  FOR SELECT TO authenticated
  USING (event_id IS NULL AND auth.uid() = brought_by);

-- Event wines: only evaluated when event_id IS NOT NULL
CREATE POLICY "Read event wines for participants" ON wines
  FOR SELECT TO authenticated
  USING (
    event_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = wines.event_id
          AND e.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM event_members em
        WHERE em.event_id = wines.event_id
          AND em.member_id = auth.uid()
      )
    )
  );

-- ------------------------------------------------------------
-- 2. Recreate view with guarded CASE expressions
--    Guard the events subquery with event_id IS NOT NULL so it
--    is never evaluated for cellar wines.
-- ------------------------------------------------------------
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
  w.ai_overview,
  w.ai_geography,
  w.ai_production,
  w.ai_tasting_notes,
  w.ai_pairings,
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
