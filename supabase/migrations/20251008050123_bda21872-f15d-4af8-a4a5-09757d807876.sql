-- Fix security definer view by explicitly setting SECURITY INVOKER
DROP VIEW IF EXISTS public.online_members;

CREATE VIEW public.online_members
WITH (security_invoker = true)
AS
SELECT DISTINCT user_id, MAX(created_at) as last_seen
FROM (
  SELECT user_id, created_at FROM community_interactions WHERE created_at > NOW() - INTERVAL '5 minutes'
  UNION
  SELECT user_id, created_at FROM community_reactions WHERE created_at > NOW() - INTERVAL '5 minutes'
  UNION
  SELECT user_id, created_at FROM community_comments WHERE created_at > NOW() - INTERVAL '5 minutes'
) AS recent_activity
GROUP BY user_id;

-- Grant access to the view
GRANT SELECT ON public.online_members TO authenticated;