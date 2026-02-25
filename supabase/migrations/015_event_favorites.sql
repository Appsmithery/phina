-- One favorite bottle per event per user (event rating flow only).
CREATE TABLE IF NOT EXISTS event_favorites (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  wine_id uuid NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_id, member_id)
);

-- Enforce that the favorite wine belongs to the event (CHECK cannot use subqueries).
CREATE OR REPLACE FUNCTION event_favorites_wine_belongs_to_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM wines w WHERE w.id = NEW.wine_id AND w.event_id = NEW.event_id) THEN
    RAISE EXCEPTION 'wine_id must belong to the event (wines.event_id = event_id)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_favorites_wine_belongs_to_event_trigger
  BEFORE INSERT OR UPDATE ON event_favorites
  FOR EACH ROW EXECUTE FUNCTION event_favorites_wine_belongs_to_event();

ALTER TABLE event_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read own event_favorites" ON event_favorites
  FOR SELECT TO authenticated USING (auth.uid() = member_id);

CREATE POLICY "Members can insert own event_favorites" ON event_favorites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Members can update own event_favorites" ON event_favorites
  FOR UPDATE TO authenticated USING (auth.uid() = member_id);

CREATE POLICY "Members can delete own event_favorites" ON event_favorites
  FOR DELETE TO authenticated USING (auth.uid() = member_id);
