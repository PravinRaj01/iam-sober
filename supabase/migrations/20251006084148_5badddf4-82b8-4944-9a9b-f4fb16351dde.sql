-- Add gemini_api_key column to profiles table if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;