CREATE OR REPLACE FUNCTION create_hosted_event(
  p_title text,
  p_theme text,
  p_date date,
  p_tasting_mode text DEFAULT 'single_blind',
  p_description text DEFAULT NULL,
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
    p_partiful_url,
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

GRANT EXECUTE ON FUNCTION create_hosted_event(text, text, date, text, text, text) TO authenticated;
