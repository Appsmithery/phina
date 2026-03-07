-- ============================================================
-- Migration 031: Enable RLS on image_generation_errors
--
-- The table is only written to by edge functions using the
-- service role key (which bypasses RLS). No client access
-- is needed, so RLS with no policies = deny all client access.
-- ============================================================

ALTER TABLE image_generation_errors ENABLE ROW LEVEL SECURITY;
