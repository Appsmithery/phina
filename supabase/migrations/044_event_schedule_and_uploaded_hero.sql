-- Add explicit event scheduling, configurable round durations, and host-uploaded event hero support.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS default_rating_window_minutes smallint,
  ADD COLUMN IF NOT EXISTS event_image_source text;

UPDATE public.events
SET timezone = COALESCE(NULLIF(timezone, ''), 'America/New_York')
WHERE timezone IS NULL OR timezone = '';

UPDATE public.events
SET starts_at = COALESCE(
  starts_at,
  date::timestamp AT TIME ZONE timezone
)
WHERE starts_at IS NULL;

UPDATE public.events
SET ends_at = COALESCE(
  ends_at,
  ((date + 1)::timestamp AT TIME ZONE timezone) - interval '1 second'
)
WHERE ends_at IS NULL;

UPDATE public.events
SET default_rating_window_minutes = COALESCE(default_rating_window_minutes, 5)
WHERE default_rating_window_minutes IS NULL;

UPDATE public.events
SET event_image_source = CASE
  WHEN event_image_url IS NOT NULL THEN 'generated'
  ELSE 'none'
END
WHERE event_image_source IS NULL;

UPDATE public.events
SET event_image_status = 'generated'
WHERE event_image_url IS NOT NULL
  AND event_image_status IN ('none', 'pending');

ALTER TABLE public.events
  ALTER COLUMN starts_at SET NOT NULL,
  ALTER COLUMN ends_at SET NOT NULL,
  ALTER COLUMN timezone SET NOT NULL,
  ALTER COLUMN default_rating_window_minutes SET DEFAULT 5,
  ALTER COLUMN default_rating_window_minutes SET NOT NULL,
  ALTER COLUMN event_image_source SET DEFAULT 'none',
  ALTER COLUMN event_image_source SET NOT NULL;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_default_rating_window_minutes_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_default_rating_window_minutes_check
  CHECK (default_rating_window_minutes IN (5, 10, 15));

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_event_image_status_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_event_image_status_check
  CHECK (event_image_status IN ('none', 'pending', 'generated', 'uploaded', 'failed'));

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_event_image_source_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_event_image_source_check
  CHECK (event_image_source IN ('none', 'generated', 'uploaded'));

ALTER TABLE public.rating_rounds
  ADD COLUMN IF NOT EXISTS duration_minutes smallint;

UPDATE public.rating_rounds
SET duration_minutes = COALESCE(duration_minutes, 5)
WHERE duration_minutes IS NULL;

ALTER TABLE public.rating_rounds
  ALTER COLUMN duration_minutes SET DEFAULT 5,
  ALTER COLUMN duration_minutes SET NOT NULL;

ALTER TABLE public.rating_rounds
  DROP CONSTRAINT IF EXISTS rating_rounds_duration_minutes_check;

ALTER TABLE public.rating_rounds
  ADD CONSTRAINT rating_rounds_duration_minutes_check
  CHECK (duration_minutes IN (5, 10, 15));

CREATE OR REPLACE FUNCTION public.close_expired_rating_rounds()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.rating_rounds
  SET ended_at = now(),
      is_active = false
  WHERE is_active = true
    AND started_at + make_interval(mins => duration_minutes) <= now();
$$;

CREATE OR REPLACE FUNCTION public.close_old_rating_rounds()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.close_expired_rating_rounds();
$$;

CREATE OR REPLACE FUNCTION public.end_expired_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.events
  SET status = 'ended'
  WHERE status = 'active'
    AND ends_at <= now();
$$;

DROP FUNCTION IF EXISTS public.create_hosted_event(text, text, date, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_hosted_event(
  p_title text,
  p_theme text,
  p_date date,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_default_rating_window_minutes smallint DEFAULT 5,
  p_tasting_mode text DEFAULT 'single_blind',
  p_description text DEFAULT NULL,
  p_web_link text DEFAULT NULL,
  p_partiful_url text DEFAULT NULL,
  p_event_image_url text DEFAULT NULL,
  p_event_image_status text DEFAULT 'none'
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
  v_timezone text := COALESCE(NULLIF(BTRIM(p_timezone), ''), 'America/New_York');
  v_event_web_link text := COALESCE(NULLIF(BTRIM(p_web_link), ''), NULLIF(BTRIM(p_partiful_url), ''));
  v_event_image_url text := NULLIF(BTRIM(p_event_image_url), '');
  v_event_image_status text := COALESCE(NULLIF(BTRIM(p_event_image_status), ''), 'none');
  v_event_image_source text := 'none';
  v_start_local_date date;
  v_end_local_date date;
BEGIN
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_starts_at IS NULL OR p_ends_at IS NULL THEN
    RAISE EXCEPTION 'Event start and end time are required';
  END IF;

  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'Event end time must be after the start time';
  END IF;

  v_start_local_date := (p_starts_at AT TIME ZONE v_timezone)::date;
  v_end_local_date := (p_ends_at AT TIME ZONE v_timezone)::date;

  IF p_date IS DISTINCT FROM v_start_local_date OR v_start_local_date IS DISTINCT FROM v_end_local_date THEN
    RAISE EXCEPTION 'Events must start and end on the same local date';
  END IF;

  IF p_default_rating_window_minutes NOT IN (5, 10, 15) THEN
    RAISE EXCEPTION 'Rating window must be 5, 10, or 15 minutes';
  END IF;

  IF v_event_image_url IS NOT NULL THEN
    v_event_image_status := 'uploaded';
    v_event_image_source := 'uploaded';
  ELSE
    v_event_image_status := 'pending';
    v_event_image_source := 'none';
  END IF;

  SELECT COALESCE(is_admin, false)
  INTO v_is_admin
  FROM public.members
  WHERE id = v_member_id
  FOR UPDATE;

  IF COALESCE(v_is_admin, false) IS NOT TRUE THEN
    SELECT COALESCE(SUM(delta), 0)::bigint
    INTO v_balance
    FROM public.host_credit_ledger
    WHERE member_id = v_member_id;

    IF v_balance < 1 THEN
      RAISE EXCEPTION 'You need a host credit to create an event';
    END IF;
  END IF;

  INSERT INTO public.events (
    title,
    theme,
    date,
    starts_at,
    ends_at,
    timezone,
    default_rating_window_minutes,
    status,
    created_by,
    tasting_mode,
    description,
    web_link,
    partiful_url,
    event_image_url,
    event_image_status,
    event_image_source
  )
  VALUES (
    p_title,
    COALESCE(NULLIF(p_theme, ''), 'Tasting'),
    p_date,
    p_starts_at,
    p_ends_at,
    v_timezone,
    p_default_rating_window_minutes,
    'active',
    v_member_id,
    COALESCE(NULLIF(p_tasting_mode, ''), 'single_blind')::text,
    p_description,
    v_event_web_link,
    v_event_web_link,
    v_event_image_url,
    v_event_image_status,
    v_event_image_source
  )
  RETURNING id INTO v_event_id;

  INSERT INTO public.event_members (event_id, member_id, checked_in)
  VALUES (v_event_id, v_member_id, true)
  ON CONFLICT (event_id, member_id)
  DO UPDATE SET checked_in = EXCLUDED.checked_in;

  IF COALESCE(v_is_admin, false) IS NOT TRUE THEN
    INSERT INTO public.host_credit_ledger (member_id, delta, source, event_id, metadata)
    VALUES (
      v_member_id,
      -1,
      'event_creation',
      v_event_id,
      jsonb_build_object(
        'title', p_title,
        'date', p_date,
        'starts_at', p_starts_at,
        'ends_at', p_ends_at
      )
    );
  END IF;

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_hosted_event(
  text,
  text,
  date,
  timestamptz,
  timestamptz,
  text,
  smallint,
  text,
  text,
  text,
  text,
  text,
  text
) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated upload event-images'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated upload event-images"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'event-images')
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read event-images'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Public read event-images"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'event-images')
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated update own event-images'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated update own event-images"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'event-images' AND owner = auth.uid())
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated delete own event-images'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Authenticated delete own event-images"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'event-images' AND owner = auth.uid())
    $policy$;
  END IF;
END $$;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    FOR v_job_id IN
      SELECT jobid
      FROM cron.job
      WHERE jobname IN ('close-old-rating-rounds', 'close-expired-rating-rounds', 'end-expired-events')
    LOOP
      EXECUTE format('SELECT cron.unschedule(%s)', v_job_id);
    END LOOP;

    EXECUTE format(
      'SELECT cron.schedule(%L, %L, %L)',
      'close-expired-rating-rounds',
      '* * * * *',
      'SELECT public.close_expired_rating_rounds();'
    );

    EXECUTE format(
      'SELECT cron.schedule(%L, %L, %L)',
      'end-expired-events',
      '* * * * *',
      'SELECT public.end_expired_events();'
    );
  END IF;
END $$;

