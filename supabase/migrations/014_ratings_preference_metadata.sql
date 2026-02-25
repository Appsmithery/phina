-- MVP taste-graph inputs: body, sweetness, confidence (optional per rating).
-- Allow members to read their own ratings for pre-fill on the rate screen.
ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS body text CHECK (body IN ('light', 'medium', 'full'));
ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS sweetness text CHECK (sweetness IN ('dry', 'off-dry', 'sweet'));
ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS confidence real CHECK (confidence >= 0 AND confidence <= 1);

CREATE POLICY "Members can read own ratings" ON ratings
  FOR SELECT TO authenticated
  USING (auth.uid() = member_id);
