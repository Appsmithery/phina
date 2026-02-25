-- Add structured summary fields to wines table
ALTER TABLE wines
  ADD COLUMN ai_overview text,
  ADD COLUMN ai_geography text,
  ADD COLUMN ai_production text,
  ADD COLUMN ai_tasting_notes text,
  ADD COLUMN ai_pairings text;
