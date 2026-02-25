-- Fix Supabase linter: view security invoker + function search_path
-- See https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view
-- See https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- 1) View: run with caller's permissions so RLS on wines/events/members applies.
--    (CREATE OR REPLACE in 019 resets this; re-apply.)
ALTER VIEW public.wines_with_price_privacy SET (security_invoker = on);

-- 2) Function: set immutable search_path to avoid search path injection.
CREATE OR REPLACE FUNCTION public.event_favorites_wine_belongs_to_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM wines w WHERE w.id = NEW.wine_id AND w.event_id = NEW.event_id) THEN
    RAISE EXCEPTION 'wine_id must belong to the event (wines.event_id = event_id)';
  END IF;
  RETURN NEW;
END;
$$;
