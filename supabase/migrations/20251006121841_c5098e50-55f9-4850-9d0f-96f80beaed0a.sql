-- Phase 1: Add Gamification Columns to Profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_check_in TIMESTAMP WITH TIME ZONE;

-- Create Achievements Table
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  requirements JSONB NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create User Achievements Junction Table
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Achievements (public read)
CREATE POLICY "Anyone can view achievements"
ON public.achievements FOR SELECT
USING (true);

-- RLS Policies for User Achievements
CREATE POLICY "Users can view their own achievements"
ON public.user_achievements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements"
ON public.user_achievements FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create Community Interactions Table
CREATE TABLE IF NOT EXISTS public.community_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT,
  anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.community_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Community Interactions
CREATE POLICY "Users can view all community interactions"
ON public.community_interactions FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own interactions"
ON public.community_interactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions"
ON public.community_interactions FOR DELETE
USING (auth.uid() = user_id);

-- Seed Initial Achievements
INSERT INTO public.achievements (title, description, icon, category, requirements, xp_reward) VALUES
('First Step', 'Complete your first check-in', 'Star', 'check_in', '{"check_ins": 1}', 10),
('Week Warrior', 'Maintain a 7-day check-in streak', 'Flame', 'streak', '{"streak": 7}', 50),
('Month Master', 'Maintain a 30-day check-in streak', 'Trophy', 'streak', '{"streak": 30}', 200),
('Journal Journey', 'Write your first journal entry', 'BookOpen', 'journal', '{"journal_entries": 1}', 10),
('Reflection Pro', 'Write 10 journal entries', 'BookMarked', 'journal', '{"journal_entries": 10}', 50),
('Goal Getter', 'Complete your first goal', 'Target', 'goals', '{"completed_goals": 1}', 25),
('Goal Master', 'Complete 5 goals', 'Award', 'goals', '{"completed_goals": 5}', 100),
('Century Club', '100 days of sobriety', 'Medal', 'sobriety', '{"days_sober": 100}', 500)
ON CONFLICT DO NOTHING;