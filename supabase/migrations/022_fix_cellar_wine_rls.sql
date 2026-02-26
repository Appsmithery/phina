-- ============================================================
-- 022: Fix infinite recursion in RLS policies
--
-- Root cause: events ↔ event_members have circular RLS
-- references, and self-referential event_members policies also
-- recurse.  PostgreSQL applies RLS recursively to subqueries
-- inside policies, so any cross-table or self-referencing
-- cycle triggers "infinite recursion detected in policy".
--
-- Fix: create a SECURITY DEFINER helper function that checks
-- event membership WITHOUT RLS.  Use it in all policies that
-- previously did cross-table subqueries into event_members or
-- events.  SECURITY DEFINER runs as the function owner
-- (superuser), bypassing RLS entirely — breaking every cycle.
-- ============================================================

-- ------------------------------------------------------------
-- 1. SECURITY DEFINER helper: "is this user a member of this
--    event?"  Hosts are always in event_members (backfilled by
--    migration 021), so this covers both hosts and members.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_event_member(p_event_id uuid, p_member_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_members
    WHERE event_id = p_event_id AND member_id = p_member_id
  );
$$;

-- ------------------------------------------------------------
-- 2. Fix events SELECT policy (was referencing event_members)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Read own or joined events" ON events;

CREATE POLICY "Read own or joined events" ON events
  FOR SELECT TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_event_member(events.id, auth.uid())
  );

-- ------------------------------------------------------------
-- 3. Fix event_members SELECT policy (was referencing events
--    and self-referencing event_members — both cause recursion)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Read event_members for participants" ON event_members;

CREATE POLICY "Read event_members for participants" ON event_members
  FOR SELECT TO authenticated
  USING (
    public.is_event_member(event_members.event_id, auth.uid())
  );

-- ------------------------------------------------------------
-- 4. Split wines SELECT policy
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Read wines for participants" ON wines;
DROP POLICY IF EXISTS "Read own cellar wines" ON wines;
DROP POLICY IF EXISTS "Read event wines for participants" ON wines;

-- Cellar wines: simple ownership check, no event subqueries
CREATE POLICY "Read own cellar wines" ON wines
  FOR SELECT TO authenticated
  USING (event_id IS NULL AND auth.uid() = brought_by);

-- Event wines: use the SECURITY DEFINER helper
CREATE POLICY "Read event wines for participants" ON wines
  FOR SELECT TO authenticated
  USING (
    event_id IS NOT NULL
    AND public.is_event_member(wines.event_id, auth.uid())
  );

-- ------------------------------------------------------------
-- 5. Fix rating_rounds SELECT policy (same pattern)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Read rating_rounds for participants" ON rating_rounds;

CREATE POLICY "Read rating_rounds for participants" ON rating_rounds
  FOR SELECT TO authenticated
  USING (
    public.is_event_member(rating_rounds.event_id, auth.uid())
  );

-- ------------------------------------------------------------
-- 6. Recreate view with guarded CASE expressions
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
