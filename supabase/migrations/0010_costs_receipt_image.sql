-- Add receipt image URL column to fact_costs
ALTER TABLE fact_costs ADD COLUMN IF NOT EXISTS receipt_image_url text;

-- Create receipts storage bucket (public so URLs are directly accessible)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'])
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to receipts bucket
CREATE POLICY IF NOT EXISTS "Authenticated users can upload receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

-- Allow authenticated users to read receipts
CREATE POLICY IF NOT EXISTS "Authenticated users can read receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

-- Allow users to delete their own receipts
CREATE POLICY IF NOT EXISTS "Users can delete own receipts"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
