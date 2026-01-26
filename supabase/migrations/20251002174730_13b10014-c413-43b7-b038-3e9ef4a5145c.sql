-- Add huggingface_token field to profiles table for AI integration
ALTER TABLE profiles 
ADD COLUMN huggingface_token TEXT;

-- Add comment for documentation
COMMENT ON COLUMN profiles.huggingface_token IS 'Hugging Face API token for AI features (sentiment analysis, pattern detection, goal suggestions)';