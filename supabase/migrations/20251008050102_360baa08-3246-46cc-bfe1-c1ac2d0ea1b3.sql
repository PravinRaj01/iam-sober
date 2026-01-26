-- Enable realtime for community tables (skip if already enabled)
DO $$ 
BEGIN
  ALTER TABLE public.community_interactions REPLICA IDENTITY FULL;
  ALTER TABLE public.community_reactions REPLICA IDENTITY FULL;
  ALTER TABLE public.community_comments REPLICA IDENTITY FULL;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if already set
END $$;

-- Add tables to realtime publication (skip if already added)
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_interactions;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Create a view for tracking online members (users active in last 5 minutes)
CREATE OR REPLACE VIEW public.online_members AS
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