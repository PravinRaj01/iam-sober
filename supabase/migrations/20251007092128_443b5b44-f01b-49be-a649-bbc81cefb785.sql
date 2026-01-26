-- Update RLS on profiles to allow viewing pseudonyms when users opt-in
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile and opted-in pseudonyms"
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id
  OR COALESCE((privacy_settings->>'share_milestones')::boolean, false) = true
);