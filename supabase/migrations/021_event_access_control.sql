-- ============================================================
-- 021: Tighten event access control
--
-- Before: every authenticated user could read every event,
-- event_members row, wine, and rating_round.
--
-- After: visibility is scoped to participants only:
--   - Host (events.created_by = auth.uid())
--   - Members who joined (event_members row exists for auth.uid())
--
-- Also backfills existing event hosts into event_members so
-- they don't lose access to their own events.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Backfill: add existing event hosts as event_members
--    (safe to run on already-populated data; upsert = no-op
--     if the row already exists)
-- ------------------------------------------------------------
INSERT INTO event_members (event_id, member_id, checked_in)
SELECT id AS event_id, created_by AS member_id, true AS checked_in
FROM events
ON CONFLICT (event_id, member_id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. events: restrict SELECT to host or joined member
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read events" ON events;

CREATE POLICY "Read own or joined events" ON events
  FOR SELECT TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.event_id = events.id
        AND em.member_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 3. event_members: restrict SELECT to participants of the
--    same event (host or fellow member)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Read event_members" ON event_members;

CREATE POLICY "Read event_members for participants" ON event_members
  FOR SELECT TO authenticated
  USING (
    -- User is the event host
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id
        AND e.created_by = auth.uid()
    )
    -- Or user is themselves a member of the same event
    OR EXISTS (
      SELECT 1 FROM event_members em2
      WHERE em2.event_id = event_members.event_id
        AND em2.member_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4. wines: restrict SELECT to event participants
--    Cellar wines (event_id IS NULL) are only visible to their owner.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Read wines" ON wines;

CREATE POLICY "Read wines for participants" ON wines
  FOR SELECT TO authenticated
  USING (
    -- Personal cellar wine: only the owner can read
    (event_id IS NULL AND auth.uid() = brought_by)
    -- Event wine: readable by the event host
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = wines.event_id
        AND e.created_by = auth.uid()
    )
    -- Event wine: readable by event members
    OR EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.event_id = wines.event_id
        AND em.member_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 5. rating_rounds: restrict SELECT to event participants
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Read rating_rounds" ON rating_rounds;

CREATE POLICY "Read rating_rounds for participants" ON rating_rounds
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = rating_rounds.event_id
        AND e.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.event_id = rating_rounds.event_id
        AND em.member_id = auth.uid()
    )
  );
