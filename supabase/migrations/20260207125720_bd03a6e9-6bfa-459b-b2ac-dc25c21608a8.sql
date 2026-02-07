ALTER TABLE public.profiles
ADD COLUMN preferred_language text DEFAULT 'en';

-- Add check constraint separately (more compatible)
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_preferred_language_check
CHECK (preferred_language IN ('en', 'ms', 'ta'));