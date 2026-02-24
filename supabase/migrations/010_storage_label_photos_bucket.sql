-- Storage bucket for wine label photos (public read so label_photo_url can be displayed).
INSERT INTO storage.buckets (id, name, public)
VALUES ('label-photos', 'label-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: allow authenticated uploads to label-photos; allow public read.
CREATE POLICY "Authenticated upload label-photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'label-photos');

CREATE POLICY "Public read label-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'label-photos');

-- Allow authenticated users to update/delete their own uploads (owner stored in storage.objects.owner).
CREATE POLICY "Authenticated update own label-photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'label-photos' AND owner = auth.uid());

CREATE POLICY "Authenticated delete own label-photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'label-photos' AND owner = auth.uid());
