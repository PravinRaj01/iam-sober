
-- Create a secure table for storing Fitbit OAuth tokens
CREATE TABLE public.fitbit_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  fitbit_user_id text,
  scope text,
  token_type text DEFAULT 'Bearer',
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fitbit_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only view their own tokens
CREATE POLICY "Users can view their own fitbit tokens"
ON public.fitbit_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "Users can insert their own fitbit tokens"
ON public.fitbit_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "Users can update their own fitbit tokens"
ON public.fitbit_tokens
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own tokens (disconnect)
CREATE POLICY "Users can delete their own fitbit tokens"
ON public.fitbit_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_fitbit_tokens_updated_at
BEFORE UPDATE ON public.fitbit_tokens
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
