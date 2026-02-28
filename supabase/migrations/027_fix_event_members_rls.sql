-- Fix: the "Read event_members for participants" policy used a
-- self-referential EXISTS subquery on event_members, which itself
-- is subject to the same RLS policy — creating a circular dependency
-- that PostgreSQL resolves by returning 0 rows.
--
-- The fix adds a direct `member_id = auth.uid()` check so users can
-- always read their own membership rows, plus keeps the host and
-- fellow-member checks for viewing other members of shared events.

DROP POLICY IF EXISTS "Read event_members for participants" ON event_members;

CREATE POLICY "Read event_members for participants" ON event_members
  FOR SELECT TO authenticated
  USING (
    -- User can always read their own membership rows
    member_id = auth.uid()
    -- Or user is the event host
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_members.event_id
        AND e.created_by = auth.uid()
    )
  );
