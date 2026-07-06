-- Migration: Create temp-edits storage bucket for WPS online editing
-- The EditPanel uploads Markdown files to this bucket and generates signed URLs
-- for WPS WebOffice (kdocs.cn) to open them for online editing.

-- Create the bucket (public — signed URLs have built-in expiry for access control)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'temp-edits',
  'temp-edits',
  true,
  5242880,  -- 5MB limit
  ARRAY['text/markdown', 'text/plain']::text[]
)
ON CONFLICT (id) DO NOTHING;
