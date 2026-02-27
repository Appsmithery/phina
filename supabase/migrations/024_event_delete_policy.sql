-- Allow event hosts and admins to delete events.
-- CASCADE constraints on event_members, wines, rating_rounds, and event_favorites
-- will automatically clean up all dependent data.

CREATE POLICY "Host or admin delete event" ON events
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = auth.uid() AND m.is_admin = true
    )
  );
