-- Create storage bucket for business context documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-context-docs', 'business-context-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow everyone to read the business context file
CREATE POLICY IF NOT EXISTS "Public read access to business context"
ON storage.objects FOR SELECT
USING (bucket_id = 'business-context-docs');

-- Allow authenticated users to insert/upload the business context file
CREATE POLICY IF NOT EXISTS "Authenticated users can upload business context"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'business-context-docs' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update the business context file
CREATE POLICY IF NOT EXISTS "Authenticated users can update business context"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'business-context-docs' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete the business context file
CREATE POLICY IF NOT EXISTS "Authenticated users can delete business context"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'business-context-docs' 
  AND auth.role() = 'authenticated'
);
