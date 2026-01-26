-- Add foreign key relationship between community_interactions and profiles
ALTER TABLE public.community_interactions
ADD CONSTRAINT fk_community_interactions_profiles
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;