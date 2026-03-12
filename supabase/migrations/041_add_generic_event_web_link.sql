-- Bridge event links from Partiful-specific naming to a generic external web link.
-- Keep the legacy partiful_url column mirrored temporarily so database-first deploys
-- do not break older clients during rollout.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS web_link text;

UPDATE events
SET web_link = partiful_url
WHERE web_link IS NULL
  AND partiful_url IS NOT NULL;

COMMENT ON COLUMN events.web_link IS
  'Optional external event, ticketing, or info URL set by the host.';

COMMENT ON COLUMN events.partiful_url IS
  'Deprecated compatibility mirror for web_link. Remove after all clients use web_link.';

CREATE OR REPLACE FUNCTION sync_event_web_link_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old_web_link text := NULL;
  v_old_partiful_url text := NULL;
  v_new_web_link text := NULLIF(BTRIM(NEW.web_link), '');
  v_new_partiful_url text := NULLIF(BTRIM(NEW.partiful_url), '');
  v_source text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old_web_link := NULLIF(BTRIM(OLD.web_link), '');
    v_old_partiful_url := NULLIF(BTRIM(OLD.partiful_url), '');
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_source := COALESCE(v_new_web_link, v_new_partiful_url);
  ELSIF v_new_web_link IS DISTINCT FROM v_old_web_link THEN
    v_source := v_new_web_link;
  ELSIF v_new_partiful_url IS DISTINCT FROM v_old_partiful_url THEN
    v_source := v_new_partiful_url;
  ELSE
    v_source := COALESCE(v_new_web_link, v_new_partiful_url);
  END IF;

  NEW.web_link := v_source;
  NEW.partiful_url := v_source;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_event_web_link_columns_on_events ON events;

CREATE TRIGGER sync_event_web_link_columns_on_events
BEFORE INSERT OR UPDATE OF web_link, partiful_url ON events
FOR EACH ROW
EXECUTE FUNCTION sync_event_web_link_columns();

CREATE OR REPLACE FUNCTION create_hosted_event(
  p_title text,
  p_theme text,
  p_date date,
  p_tasting_mode text DEFAULT 'single_blind',
  p_description text DEFAULT NULL,
  p_web_link text DEFAULT NULL,
  p_partiful_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid := auth.uid();
  v_balance bigint := 0;
  v_event_id uuid;
  v_is_admin boolean := false;
  v_event_web_link text := COALESCE(NULLIF(BTRIM(p_web_link), ''), NULLIF(BTRIM(p_partiful_url), ''));
BEGIN
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(is_admin, false)
  INTO v_is_admin
  FROM members
  WHERE id = v_member_id
  FOR UPDATE;

  IF COALESCE(v_is_admin, false) IS NOT TRUE THEN
    SELECT COALESCE(SUM(delta), 0)::bigint
    INTO v_balance
    FROM host_credit_ledger
    WHERE member_id = v_member_id;

    IF v_balance < 1 THEN
      RAISE EXCEPTION 'You need a host credit to create an event';
    END IF;
  END IF;

  INSERT INTO events (
    title,
    theme,
    date,
    status,
    created_by,
    tasting_mode,
    description,
    web_link,
    partiful_url,
    event_image_status
  )
  VALUES (
    p_title,
    COALESCE(NULLIF(p_theme, ''), 'Tasting'),
    p_date,
    'active',
    v_member_id,
    COALESCE(NULLIF(p_tasting_mode, ''), 'single_blind')::text,
    p_description,
    v_event_web_link,
    v_event_web_link,
    'pending'
  )
  RETURNING id INTO v_event_id;

  INSERT INTO event_members (event_id, member_id, checked_in)
  VALUES (v_event_id, v_member_id, true)
  ON CONFLICT (event_id, member_id)
  DO UPDATE SET checked_in = EXCLUDED.checked_in;

  IF COALESCE(v_is_admin, false) IS NOT TRUE THEN
    INSERT INTO host_credit_ledger (member_id, delta, source, event_id, metadata)
    VALUES (
      v_member_id,
      -1,
      'event_creation',
      v_event_id,
      jsonb_build_object('title', p_title, 'date', p_date)
    );
  END IF;

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_hosted_event(text, text, date, text, text, text, text) TO authenticated;
