-- Create table to track daily goal completions
CREATE TABLE IF NOT EXISTS public.goal_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  completion_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(goal_id, completion_date)
);

-- Enable RLS
ALTER TABLE public.goal_completions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own goal completions"
  ON public.goal_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goal completions"
  ON public.goal_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goal completions"
  ON public.goal_completions FOR DELETE
  USING (auth.uid() = user_id);

-- Add index for better query performance
CREATE INDEX idx_goal_completions_goal_id ON public.goal_completions(goal_id);
CREATE INDEX idx_goal_completions_user_id ON public.goal_completions(user_id);