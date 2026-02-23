-- Members (synced from auth.users via trigger or app upsert)
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text NOT NULL UNIQUE,
  push_token text,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  theme text NOT NULL,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_by uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Event membership (who joined which event)
CREATE TABLE IF NOT EXISTS event_members (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  checked_in boolean DEFAULT false,
  PRIMARY KEY (event_id, member_id)
);

-- Wines (bottles brought to an event)
CREATE TABLE IF NOT EXISTS wines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  brought_by uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  producer text,
  varietal text,
  vintage int,
  region text,
  label_photo_url text,
  ai_summary text,
  created_at timestamptz DEFAULT now()
);

-- Rating rounds (host starts/ends; one round per wine)
CREATE TABLE IF NOT EXISTS rating_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  wine_id uuid NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  is_active boolean DEFAULT true
);

-- Ratings: one per member per wine, value -1 (down) / 0 (meh) / 1 (up)
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wine_id uuid NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1, 0, 1)),
  created_at timestamptz DEFAULT now(),
  UNIQUE (wine_id, member_id)
);

-- Anonymous aggregate view (exposed only when event is ended)
CREATE OR REPLACE VIEW wine_rating_summary AS
SELECT
  wine_id,
  COUNT(*) FILTER (WHERE value = 1) AS thumbs_up,
  COUNT(*) FILTER (WHERE value = 0) AS meh,
  COUNT(*) FILTER (WHERE value = -1) AS thumbs_down,
  COUNT(*) AS total_votes
FROM ratings
GROUP BY wine_id;

-- RLS: enable
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Members: read all (for admin/list), update own row, insert on signup via app
CREATE POLICY "Members can read all members" ON members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members can insert own" ON members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Members can update own" ON members FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- Events: read all for now (or restrict to created_by + event_members)
CREATE POLICY "Authenticated read events" ON events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create events" ON events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator update event" ON events FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

-- Event members: read if in event or host
CREATE POLICY "Read event_members" ON event_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert event_members" ON event_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = member_id);
CREATE POLICY "Update event_members" ON event_members FOR UPDATE TO authenticated
  USING (auth.uid() = member_id);

-- Wines: read for event participants
CREATE POLICY "Read wines" ON wines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert wines" ON wines FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = brought_by);
CREATE POLICY "Update own wines" ON wines FOR UPDATE TO authenticated
  USING (auth.uid() = brought_by);

-- Rating rounds: read all, insert/update for event creator
CREATE POLICY "Read rating_rounds" ON rating_rounds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert rating_rounds" ON rating_rounds FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.created_by = auth.uid())
  );
CREATE POLICY "Update rating_rounds" ON rating_rounds FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.created_by = auth.uid())
  );

-- Ratings: insert own vote, read blocked (use view for aggregates only)
CREATE POLICY "Insert ratings" ON ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = member_id);
CREATE POLICY "Update own rating" ON ratings FOR UPDATE TO authenticated
  USING (auth.uid() = member_id);

-- Service role can read ratings for vote count (Edge Function)
-- No policy for SELECT on ratings for authenticated: clients never see raw ratings.

-- Function: return aggregate ratings only for ended events (so clients never see raw ratings)
CREATE OR REPLACE FUNCTION get_event_wine_ratings(p_event_id uuid)
RETURNS TABLE (wine_id uuid, thumbs_up bigint, meh bigint, thumbs_down bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.wine_id,
    COUNT(*) FILTER (WHERE r.value = 1),
    COUNT(*) FILTER (WHERE r.value = 0),
    COUNT(*) FILTER (WHERE r.value = -1)
  FROM ratings r
  JOIN wines w ON w.id = r.wine_id
  JOIN events e ON e.id = w.event_id
  WHERE e.id = p_event_id AND e.status = 'ended'
  GROUP BY r.wine_id;
$$;

-- Storage bucket for label photos (create via dashboard or here)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('labels', 'labels', true);
-- RLS on storage.objects: allow authenticated upload, public read
