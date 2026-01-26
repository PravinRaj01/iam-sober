-- Schedule daily reminder to run every hour (checks user timezone preferences)
SELECT cron.schedule(
  'send-daily-reminder',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://jivpbjhroujuoatdqtpx.supabase.co/functions/v1/send-daily-reminder',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppdnBiamhyb3VqdW9hdGRxdHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTM4MzYsImV4cCI6MjA3NDk4OTgzNn0.eU12SDSoSmjy7HvTQh7_j-8-4Ail-1hOOH1XpTN2tOs"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Schedule weekly report to run daily at 10am UTC (checks user day preferences)
SELECT cron.schedule(
  'send-weekly-report',
  '0 10 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://jivpbjhroujuoatdqtpx.supabase.co/functions/v1/send-weekly-report',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppdnBiamhyb3VqdW9hdGRxdHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTM4MzYsImV4cCI6MjA3NDk4OTgzNn0.eU12SDSoSmjy7HvTQh7_j-8-4Ail-1hOOH1XpTN2tOs"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);