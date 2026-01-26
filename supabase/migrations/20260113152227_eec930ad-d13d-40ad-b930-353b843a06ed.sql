-- Create biometric_logs table for wearable data
CREATE TABLE public.biometric_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  heart_rate INTEGER,
  sleep_hours DECIMAL(4,2),
  steps INTEGER,
  stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10),
  hrv INTEGER,
  blood_oxygen DECIMAL(5,2),
  source TEXT DEFAULT 'manual',
  notes TEXT,
  logged_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ai_observability_logs table for tracking AI decisions
CREATE TABLE public.ai_observability_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,
  input_summary TEXT,
  tools_called JSONB DEFAULT '[]'::jsonb,
  tool_results JSONB DEFAULT '{}'::jsonb,
  response_summary TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  response_time_ms INTEGER,
  intervention_triggered BOOLEAN DEFAULT false,
  intervention_type TEXT,
  user_feedback TEXT,
  model_used TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ai_interventions table for proactive interventions
CREATE TABLE public.ai_interventions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  risk_score DECIMAL(3,2),
  message TEXT NOT NULL,
  suggested_actions JSONB DEFAULT '[]'::jsonb,
  was_acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  action_taken TEXT,
  was_helpful BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.biometric_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_observability_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interventions ENABLE ROW LEVEL SECURITY;

-- RLS policies for biometric_logs
CREATE POLICY "Users can view their own biometric logs"
  ON public.biometric_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own biometric logs"
  ON public.biometric_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own biometric logs"
  ON public.biometric_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own biometric logs"
  ON public.biometric_logs FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for ai_observability_logs
CREATE POLICY "Users can view their own AI logs"
  ON public.ai_observability_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert AI logs"
  ON public.ai_observability_logs FOR INSERT
  WITH CHECK (true);

-- RLS policies for ai_interventions
CREATE POLICY "Users can view their own interventions"
  ON public.ai_interventions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert interventions"
  ON public.ai_interventions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own interventions"
  ON public.ai_interventions FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_biometric_logs_user_date ON public.biometric_logs(user_id, logged_at DESC);
CREATE INDEX idx_ai_observability_logs_user_date ON public.ai_observability_logs(user_id, created_at DESC);
CREATE INDEX idx_ai_observability_logs_function ON public.ai_observability_logs(function_name, created_at DESC);
CREATE INDEX idx_ai_interventions_user_date ON public.ai_interventions(user_id, created_at DESC);
CREATE INDEX idx_ai_interventions_unacknowledged ON public.ai_interventions(user_id, was_acknowledged) WHERE was_acknowledged = false;