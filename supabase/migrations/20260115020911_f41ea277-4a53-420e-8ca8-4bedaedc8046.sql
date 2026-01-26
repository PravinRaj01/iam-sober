-- Add notification_preferences column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT jsonb_build_object(
  'daily_reminder', true,
  'daily_reminder_time', '09:00',
  'weekly_report', true,
  'weekly_report_day', 'monday',
  'milestone_alerts', true,
  'supporter_updates', false
);

-- Update existing profiles with default notification preferences
UPDATE public.profiles
SET notification_preferences = jsonb_build_object(
  'daily_reminder', true,
  'daily_reminder_time', '09:00',
  'weekly_report', true,
  'weekly_report_day', 'monday',
  'milestone_alerts', true,
  'supporter_updates', false
)
WHERE notification_preferences IS NULL;