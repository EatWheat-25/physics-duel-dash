-- Add image_url column to questions table
ALTER TABLE public.questions 
ADD COLUMN image_url TEXT;

-- Create storage bucket for question images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload question images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'question-images' 
  AND auth.role() = 'authenticated'
);

-- Allow anyone to view question images (public bucket)
CREATE POLICY "Anyone can view question images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'question-images');