-- Fix linter: view must run with caller's permissions (RLS respected)
ALTER VIEW public.wine_rating_summary SET (security_invoker = on);
