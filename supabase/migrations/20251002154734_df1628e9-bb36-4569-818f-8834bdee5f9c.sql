-- Add new columns to profiles table for personalization
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS addiction_type TEXT,
ADD COLUMN IF NOT EXISTS background_image_url TEXT,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Create storage bucket for background images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backgrounds',
  'backgrounds',
  false,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for backgrounds bucket
CREATE POLICY "Users can upload their own background"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'backgrounds' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own background"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'backgrounds' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own background"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'backgrounds' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own background"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'backgrounds' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add check constraint for addiction_type
ALTER TABLE public.profiles
ADD CONSTRAINT valid_addiction_type 
CHECK (addiction_type IS NULL OR addiction_type IN (
  'alcohol', 'drugs', 'smoking', 'pornography', 
  'gambling', 'gaming', 'food', 'other'
));