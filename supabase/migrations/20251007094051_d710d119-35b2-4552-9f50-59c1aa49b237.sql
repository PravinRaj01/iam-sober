-- Create community_reactions table for social interactions
CREATE TABLE public.community_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interaction_id UUID NOT NULL REFERENCES public.community_interactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('support', 'heart', 'celebrate')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(interaction_id, user_id)
);

-- Enable RLS
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view all reactions
CREATE POLICY "Anyone can view reactions"
ON public.community_reactions
FOR SELECT
USING (true);

-- Users can add their own reactions
CREATE POLICY "Users can add their own reactions"
ON public.community_reactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reactions
CREATE POLICY "Users can delete their own reactions"
ON public.community_reactions
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_community_reactions_interaction_id ON public.community_reactions(interaction_id);
CREATE INDEX idx_community_reactions_user_id ON public.community_reactions(user_id);

-- Enable realtime for community_reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_reactions;