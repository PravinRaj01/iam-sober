-- Create a secure function to count online members
-- This is needed because RLS now restricts users to only see their own status

CREATE OR REPLACE FUNCTION public.count_online_members()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_count integer;
BEGIN
  SELECT COUNT(*)
  INTO member_count
  FROM public.online_members
  WHERE last_seen > NOW() - INTERVAL '5 minutes';
  
  RETURN member_count;
END;
$$;

COMMENT ON FUNCTION public.count_online_members IS 'Counts online members (active in last 5 minutes). SECURITY DEFINER allows bypassing RLS for counting only.';