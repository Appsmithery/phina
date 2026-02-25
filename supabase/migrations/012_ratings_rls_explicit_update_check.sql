-- Explicit WITH CHECK on UPDATE so upsert (ON CONFLICT DO UPDATE) satisfies RLS.
-- Ensures the new row after update is allowed; avoids "new row violates row-level security" when auth.uid() is set.
DROP POLICY IF EXISTS "Update own rating" ON ratings;
CREATE POLICY "Update own rating" ON ratings
  FOR UPDATE TO authenticated
  USING (auth.uid() = member_id)
  WITH CHECK (auth.uid() = member_id);
