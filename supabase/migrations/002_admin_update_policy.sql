-- Allow admins to update any member's is_admin field (e.g. promote/demote).
-- Members can still update their own profile; this adds update access for admins on other rows.
CREATE POLICY "Admins can update any member"
  ON members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM members m WHERE m.id = auth.uid() AND m.is_admin = true)
  );
