-- Allow the event host to update wines in their event (in addition to bringer via "Update own wines").
CREATE POLICY "Event host can update wine" ON wines FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = wines.event_id AND e.created_by = auth.uid()
    )
  );
