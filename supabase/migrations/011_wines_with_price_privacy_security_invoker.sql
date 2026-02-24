-- Fix security advisor: view must run with caller's permissions so RLS on wines/events/members applies.
-- See https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view
ALTER VIEW public.wines_with_price_privacy SET (security_invoker = on);
