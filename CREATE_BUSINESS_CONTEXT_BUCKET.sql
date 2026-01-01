-- =====================================================
-- CREATE BUSINESS CONTEXT STORAGE BUCKET
-- =====================================================
-- Run this in your Supabase SQL Editor to fix the "bucket not found" error
-- when saving business-context.md files

-- Step 1: Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-context-docs', 
  'business-context-docs', 
  true,
  5242880, -- 5MB limit
  ARRAY['text/markdown', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create storage policies for the bucket

-- Allow everyone to read/download the business context file
DROP POLICY IF EXISTS "Public read access to business context" ON storage.objects;
CREATE POLICY "Public read access to business context"
ON storage.objects FOR SELECT
USING (bucket_id = 'business-context-docs');

-- Allow authenticated users to insert/upload the business context file
DROP POLICY IF EXISTS "Authenticated users can upload business context" ON storage.objects;
CREATE POLICY "Authenticated users can upload business context"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'business-context-docs' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update the business context file
DROP POLICY IF EXISTS "Authenticated users can update business context" ON storage.objects;
CREATE POLICY "Authenticated users can update business context"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'business-context-docs' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete the business context file
DROP POLICY IF EXISTS "Authenticated users can delete business context" ON storage.objects;
CREATE POLICY "Authenticated users can delete business context"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'business-context-docs' 
  AND auth.role() = 'authenticated'
);

-- Step 3: Verify the bucket was created
SELECT 
  id, 
  name, 
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets 
WHERE id = 'business-context-docs';
