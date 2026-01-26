-- Update community_reactions to support love and comment types
-- First, let's add a comments table for proper comment support
CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id uuid NOT NULL REFERENCES public.community_interactions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT content_length CHECK (char_length(content) <= 500)
);

-- Enable RLS on comments
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for comments
CREATE POLICY "Anyone can view comments"
  ON public.community_comments
  FOR SELECT
  USING (true);

CREATE POLICY "Users can add their own comments"
  ON public.community_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.community_comments
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.community_comments
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_community_comments_interaction ON public.community_comments(interaction_id);
CREATE INDEX idx_community_comments_user ON public.community_comments(user_id);

-- Update community_reactions to only support 'love' type now
-- Remove the unique constraint and recreate it
ALTER TABLE public.community_reactions DROP CONSTRAINT IF EXISTS unique_user_interaction_reaction;

-- Add new unique constraint for love reactions only
ALTER TABLE public.community_reactions 
ADD CONSTRAINT unique_user_interaction_love 
UNIQUE (interaction_id, user_id);

-- Update RLS policy for community_interactions to allow users to update/delete their own posts
DROP POLICY IF EXISTS "Users can delete their own interactions" ON public.community_interactions;
DROP POLICY IF EXISTS "Users can insert their own interactions" ON public.community_interactions;
DROP POLICY IF EXISTS "Users can view all community interactions" ON public.community_interactions;

CREATE POLICY "Users can view all community interactions"
  ON public.community_interactions
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own interactions"
  ON public.community_interactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interactions"
  ON public.community_interactions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions"
  ON public.community_interactions
  FOR DELETE
  USING (auth.uid() = user_id);