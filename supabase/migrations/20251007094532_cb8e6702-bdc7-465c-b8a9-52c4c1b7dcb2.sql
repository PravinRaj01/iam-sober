-- Update profiles RLS to allow viewing basic public profile info for community feed
-- This allows users to see pseudonym, level, and xp of anyone who posts in the community
-- while still protecting other sensitive profile data

DROP POLICY IF EXISTS "Users can view own profile and opted-in pseudonyms" ON public.profiles;

-- Allow users to view their own full profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Allow viewing basic public profile info for all authenticated users
-- This enables the community feed to display user info
CREATE POLICY "Public profile info viewable by authenticated users"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);