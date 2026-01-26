-- Allow authenticated users to view public profile information
-- This policy works alongside the existing "Users can view own profile" policy
-- RLS will return data if EITHER policy passes (they're OR'd together)
CREATE POLICY "Authenticated users can view public profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);