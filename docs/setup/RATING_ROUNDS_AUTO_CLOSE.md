# Rating rounds: auto-close after 5 minutes

Active rating rounds are closed automatically 5 minutes after they start. The migration `006_rating_rounds_auto_close.sql` creates a function `close_old_rating_rounds()` that updates any round where `is_active = true` and `started_at` is older than 5 minutes.

You must run this function on a schedule (e.g. every minute) for auto-close to take effect.

## Option A — pg_cron (Supabase Pro or if enabled)

If your project has the `pg_cron` extension enabled:

1. In SQL Editor, run:
   ```sql
   SELECT cron.schedule(
     'close-old-rating-rounds',
     '* * * * *',
     $$ SELECT close_old_rating_rounds(); $$
   );
   ```
2. This runs the function every minute. To unschedule: `SELECT cron.unschedule('close-old-rating-rounds');`

## Option B — Edge Function + external cron

1. Create an Edge Function that uses the Supabase service role client to run:
   ```sql
   SELECT close_old_rating_rounds();
   ```
2. Call that function every minute from an external cron (e.g. GitHub Actions workflow, or a cron job on a server that `curl`s the function URL with an auth header).

The host can still tap "End round" to close early; the scheduled job only closes rounds that have been open for more than 5 minutes.
