-- Create notification_deliveries table for deduplication
CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add unique constraint on user_id + dedupe_key to prevent duplicates
ALTER TABLE public.notification_deliveries 
ADD CONSTRAINT notification_deliveries_user_dedupe_unique UNIQUE (user_id, dedupe_key);

-- Create index for faster lookups
CREATE INDEX idx_notification_deliveries_user_type ON public.notification_deliveries(user_id, type);
CREATE INDEX idx_notification_deliveries_created_at ON public.notification_deliveries(created_at);

-- Enable RLS
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Users can view their own deliveries (for debugging)
CREATE POLICY "Users can view their own notification deliveries"
ON public.notification_deliveries
FOR SELECT
USING (auth.uid() = user_id);

-- Add cleanup function to remove old records (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_notification_deliveries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notification_deliveries
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;