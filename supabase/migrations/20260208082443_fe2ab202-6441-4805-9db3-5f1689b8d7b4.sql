-- Add cron job for milestone alerts (runs daily at 6 AM UTC)
SELECT cron.schedule(
  'send-milestone-alert',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url:='https://jivpbjhroujuoatdqtpx.supabase.co/functions/v1/send-milestone-alert',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppdnBiamhyb3VqdW9hdGRxdHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTM4MzYsImV4cCI6MjA3NDk4OTgzNn0.eU12SDSoSmjy7HvTQh7_j-8-4Ail-1hOOH1XpTN2tOs"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Add cron job for proactive AI checks (runs every 4 hours)
SELECT cron.schedule(
  'proactive-check-scheduled',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url:='https://jivpbjhroujuoatdqtpx.supabase.co/functions/v1/proactive-check-scheduled',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppdnBiamhyb3VqdW9hdGRxdHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTM4MzYsImV4cCI6MjA3NDk4OTgzNn0.eU12SDSoSmjy7HvTQh7_j-8-4Ail-1hOOH1XpTN2tOs"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);