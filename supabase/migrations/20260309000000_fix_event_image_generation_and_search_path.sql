-- Repair migration for event hero generation infrastructure and Supabase linter warning.

-- Fix mutable search_path warning on the member-name sync trigger function.
CREATE OR REPLACE FUNCTION public.sync_member_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.name := trim(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  RETURN NEW;
END;
$$;

-- Reconcile event image schema in environments that may have drifted.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_image_url text,
  ADD COLUMN IF NOT EXISTS event_image_status text;

UPDATE public.events
SET event_image_status = 'none'
WHERE event_image_status IS NULL;

ALTER TABLE public.events
  ALTER COLUMN event_image_status SET DEFAULT 'none',
  ALTER COLUMN event_image_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_event_image_status_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_event_image_status_check
      CHECK (event_image_status IN ('none', 'pending', 'generated', 'failed'));
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Reuse the existing image generation error log for event hero failures.
ALTER TABLE public.image_generation_errors
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;
