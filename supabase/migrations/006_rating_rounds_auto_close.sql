-- Auto-close rating rounds 5 minutes after they start.
-- This migration only creates the function. To run it on a schedule, use one of:
--   (1) pg_cron (if enabled on your Supabase plan): e.g.
--       SELECT cron.schedule('close-old-rating-rounds', '* * * * *', $$ SELECT close_old_rating_rounds(); $$);
--   (2) External cron (e.g. GitHub Actions, or a server cron) that calls an Edge Function
--       which runs: SELECT close_old_rating_rounds(); (with service role).
-- See docs/setup/RATING_ROUNDS_AUTO_CLOSE.md for details.

CREATE OR REPLACE FUNCTION close_old_rating_rounds()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE rating_rounds
  SET ended_at = now(),
      is_active = false
  WHERE is_active = true
    AND started_at < now() - interval '5 minutes';
$$;
