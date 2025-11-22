-- Create storage bucket for business context
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-context-docs', 'business-context-docs', true);

-- Allow everyone to read the business context file
CREATE POLICY "Public read access to business context"
ON storage.objects FOR SELECT
USING (bucket_id = 'business-context-docs');

-- Allow authenticated users to insert/update the business context file
CREATE POLICY "Authenticated users can upload business context"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'business-context-docs' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update business context"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'business-context-docs' 
  AND auth.role() = 'authenticated'
);