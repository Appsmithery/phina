-- Add tags (controlled vocabulary) and free-text note to ratings.
-- Tags feed the per-user taste graph (private); aggregates are exposed
-- via get_event_wine_tag_summary (SECURITY DEFINER, ended events only).

ALTER TABLE ratings
  ADD COLUMN tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN note text;

ALTER TABLE ratings
  ADD CONSTRAINT ratings_tags_valid
  CHECK (tags <@ ARRAY['minerality', 'fruit', 'spice', 'tannic']::text[]);

-- Aggregate tag counts per wine for a given (ended) event.
-- Mirrors the security model of get_event_wine_ratings: SECURITY DEFINER,
-- only returns data when event.status = 'ended', never exposes individual rows.
CREATE OR REPLACE FUNCTION get_event_wine_tag_summary(p_event_id uuid)
RETURNS TABLE (wine_id uuid, tag text, tag_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.wine_id, unnest(r.tags) AS tag, COUNT(*) AS tag_count
  FROM ratings r
  JOIN wines w ON w.id = r.wine_id
  JOIN events e ON e.id = w.event_id
  WHERE e.id = p_event_id
    AND e.status = 'ended'
    AND cardinality(r.tags) > 0
  GROUP BY r.wine_id, tag
  ORDER BY r.wine_id, tag_count DESC;
$$;
