-- ============================================================
-- 022: Fix infinite recursion in RLS policies
--
-- Root cause: events SELECT policy references event_members,
-- and event_members SELECT policy references events, creating
-- a circular dependency that triggers "infinite recursion
-- detected in policy for relation 'events'".
--
-- Fix:
--   1. Break the cycle by making event_members policy
--      self-referential (no events subquery).  This is safe
--      because migration 021 backfills all hosts into
--      event_members.
--   2. Simplify wines event policy to only check event_members
--      (hosts are always in event_members).
--   3. Split wines SELECT into cellar vs event policies so
--      cellar reads never touch events/event_members.
--   4. Guard the view's CASE expressions so cellar wine rows
--      never trigger event subqueries.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Break the circular dependency: event_members no longer
--    references events.  "Can I see this membership row?" →
--    "Am I that member, or am I also a member of the same event?"
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Read event_members for participants" ON event_members;

CREATE POLICY "Read event_members for participants" ON event_members
  FOR SELECT TO authenticated
  USING (
    -- I can always see my own membership rows
    member_id = auth.uid()
    -- I can see other members if I'm also in the same event
    OR EXISTS (
      SELECT 1 FROM event_members em2
      WHERE em2.event_id = event_members.event_id
        AND em2.member_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 2. Split wines SELECT policy
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Read wines for participants" ON wines;
DROP POLICY IF EXISTS "Read own cellar wines" ON wines;
DROP POLICY IF EXISTS "Read event wines for participants" ON wines;

-- Cellar wines: simple ownership check, no event subqueries
CREATE POLICY "Read own cellar wines" ON wines
  FOR SELECT TO authenticated
  USING (event_id IS NULL AND auth.uid() = brought_by);

-- Event wines: only check event_members (hosts are backfilled)
-- This avoids touching events table from wines RLS entirely.
CREATE POLICY "Read event wines for participants" ON wines
  FOR SELECT TO authenticated
  USING (
    event_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.event_id = wines.event_id
        AND em.member_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 3. Recreate view with guarded CASE expressions
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
