-- Fix overly permissive RLS policies by restricting to service role operations
-- Drop the permissive policies
DROP POLICY IF EXISTS "Service role can insert AI logs" ON public.ai_observability_logs;
DROP POLICY IF EXISTS "Service role can insert interventions" ON public.ai_interventions;

-- Create more restrictive policies that still allow edge functions to insert
-- Edge functions use service_role key which bypasses RLS, so we can restrict to user_id match
CREATE POLICY "Users can insert their own AI logs"
  ON public.ai_observability_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interventions"
  ON public.ai_interventions FOR INSERT
  WITH CHECK (auth.uid() = user_id);