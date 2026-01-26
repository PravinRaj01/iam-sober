-- Fix Critical Security Issues: Profiles Table and Online Members View

-- =================================================================
-- ISSUE 1: Fix profiles table RLS policy
-- Remove overly permissive policy that exposes all user data
-- =================================================================

-- Drop the insecure policy
DROP POLICY IF EXISTS "Public profile info viewable by authenticated users" ON public.profiles;

-- Create secure policy that only allows users to view their own profile
CREATE POLICY "Users can view only their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create a public view for community features (only non-sensitive data)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT 
  id,
  pseudonym,
  level,
  xp,
  current_streak,
  longest_streak,
  created_at
FROM public.profiles;

-- Grant access to the public view
GRANT SELECT ON public.public_profiles TO authenticated;

-- Add comment explaining the view
COMMENT ON VIEW public.public_profiles IS 'Public profile information safe for community features. Does not expose sensitive data like API keys or health information.';

-- =================================================================
-- ISSUE 2: Fix online_members view security issue
-- Convert to table with proper RLS instead of unsecured view
-- =================================================================

-- Drop the insecure view
DROP VIEW IF EXISTS public.online_members;

-- Create a proper table with RLS enabled
CREATE TABLE IF NOT EXISTS public.online_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen timestamptz NOT NULL DEFAULT NOW()
);

-- Enable RLS on the table
ALTER TABLE public.online_members ENABLE ROW LEVEL SECURITY;

-- Users can only see their own activity
CREATE POLICY "Users can view own online status"
ON public.online_members
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow the system to update online status
CREATE POLICY "Users can update own online status"
ON public.online_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can upsert own online status"
ON public.online_members
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_online_members_last_seen ON public.online_members(last_seen);

-- Create function to update online status
CREATE OR REPLACE FUNCTION public.update_online_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.online_members (user_id, last_seen)
  VALUES (auth.uid(), NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET last_seen = NOW();
END;
$$;

-- Create function to clean up old entries (older than 5 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_online_members()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.online_members
  WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$$;

-- Add comments
COMMENT ON TABLE public.online_members IS 'Tracks online user activity with proper RLS protection';
COMMENT ON FUNCTION public.update_online_status IS 'Updates the current users online status timestamp';
COMMENT ON FUNCTION public.cleanup_online_members IS 'Removes stale online status entries (run periodically)';