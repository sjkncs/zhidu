-- Migration: Add RLS policies for temp-edits storage bucket
-- Fix: "new row violates row-level security policy" when uploading to temp-edits

-- Ensure RLS is enabled on storage.objects (Supabase default, but explicit is safer)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can upload files to temp-edits
CREATE POLICY "Authenticated users can upload to temp-edits"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'temp-edits');

-- Policy: Anyone can read files from temp-edits (public bucket, signed URLs for time-limited access)
CREATE POLICY "Anyone can read temp-edits objects"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'temp-edits');

-- Policy: Authenticated users can update their own uploads in temp-edits
CREATE POLICY "Authenticated users can update temp-edits"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'temp-edits');

-- Policy: Authenticated users can delete from temp-edits
CREATE POLICY "Authenticated users can delete temp-edits"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'temp-edits');

-- Also create a general-purpose uploads bucket for chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760,  -- 10MB limit
  ARRAY[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf',
    'text/plain', 'text/markdown', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload to chat-attachments
CREATE POLICY "Authenticated users can upload to chat-attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

-- Policy: Users can read their own chat attachments (path starts with their user_id)
CREATE POLICY "Users can read own chat attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can delete their own chat attachments
CREATE POLICY "Users can delete own chat attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
