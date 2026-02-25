-- Allow admins to start and end rating rounds for any event (e.g. for testing / reopen).
CREATE POLICY "Admins can insert rating_rounds" ON rating_rounds
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM members m WHERE m.id = auth.uid() AND m.is_admin = true)
  );

CREATE POLICY "Admins can update rating_rounds" ON rating_rounds
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM members m WHERE m.id = auth.uid() AND m.is_admin = true)
  );
