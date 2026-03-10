-- Migration: Add AI image generation columns to wines table
-- PRD-2026-007: AI-Enhanced Wine Bottle Image Generation

ALTER TABLE wines
  ADD COLUMN IF NOT EXISTS display_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS image_confidence_score INTEGER CHECK (image_confidence_score >= 0 AND image_confidence_score <= 100),
  ADD COLUMN IF NOT EXISTS image_generation_status TEXT CHECK (image_generation_status IN ('pending', 'generated', 'fallback_cleaned', 'fallback_raw', 'failed')),
  ADD COLUMN IF NOT EXISTS image_generation_metadata JSONB;

CREATE TABLE IF NOT EXISTS image_generation_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wine_id UUID REFERENCES wines(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
