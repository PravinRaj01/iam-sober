-- Remove dangerous API key column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS gemini_api_key;

-- Fix supporters table RLS - ensure users can only view their own supporters
DROP POLICY IF EXISTS "Users can view own supporters" ON public.supporters;

CREATE POLICY "Users can view only their own supporters"
ON public.supporters
FOR SELECT
USING (auth.uid() = user_id);