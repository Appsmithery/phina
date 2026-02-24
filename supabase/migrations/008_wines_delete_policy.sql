-- Allow the member who added the wine or the event host to delete a wine from the event.
CREATE POLICY "Delete own wine or event host can delete" ON wines FOR DELETE TO authenticated
  USING (
    (auth.uid() = brought_by)
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = wines.event_id AND e.created_by = auth.uid()
    )
  );
