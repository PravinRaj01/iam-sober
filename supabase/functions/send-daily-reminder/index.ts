import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { sendWebPush, getVapidKeys } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to get user's local time (hour and minute)
function getUserLocalTime(timezone: string, now: Date): { hour: number; minute: number; dateStr: string } {
  try {
    const hourFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const minuteFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      minute: 'numeric',
    });
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    const hour = parseInt(hourFormatter.format(now), 10);
    const minute = parseInt(minuteFormatter.format(now), 10);
    const dateStr = dateFormatter.format(now); // YYYY-MM-DD format
    
    return { hour, minute, dateStr };
  } catch (_e) {
    // Fallback to UTC if timezone is invalid
    return {
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      dateStr: now.toISOString().split('T')[0],
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const vapid = getVapidKeys();
    const now = new Date();
    
    // Parse optional request body for dry_run mode
    let dryRun = false;
    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      dryRun = body.dry_run === true;
      targetUserId = body.user_id || null;
    } catch (_e) {
      // No body or invalid JSON, continue normally
    }

    console.log(`Running daily reminder check at ${now.toISOString()}${dryRun ? ' (DRY RUN)' : ''}`);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(`id, pseudonym, notification_preferences, current_streak, last_check_in`)
      .not("notification_preferences", "is", null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} profiles with notification preferences`);

    let sentCount = 0;
    let skippedCount = 0;
    let alreadySentCount = 0;
    const dryRunResults: any[] = [];

    for (const profile of profiles || []) {
      // If targeting specific user in dry_run, skip others
      if (targetUserId && profile.id !== targetUserId) {
        continue;
      }

      const prefs = profile.notification_preferences as any;
      
      if (!prefs?.daily_reminder) {
        skippedCount++;
        continue;
      }

      const reminderTime = prefs.daily_reminder_time || '09:00';
      const userTimezone = prefs.timezone || 'UTC';
      const [reminderHourStr, reminderMinuteStr] = reminderTime.split(':');
      const reminderHour = parseInt(reminderHourStr, 10);
      const reminderMinute = parseInt(reminderMinuteStr || '0', 10);
      
      const { hour: userCurrentHour, minute: userCurrentMinute, dateStr: userDateStr } = getUserLocalTime(userTimezone, now);
      
      // Check if current time matches the reminder time (exact minute)
      const timeMatches = userCurrentHour === reminderHour && userCurrentMinute === reminderMinute;
      
      if (dryRun) {
        dryRunResults.push({
          user_id: profile.id,
          timezone: userTimezone,
          current_local_time: `${userCurrentHour.toString().padStart(2, '0')}:${userCurrentMinute.toString().padStart(2, '0')}`,
          reminder_time: reminderTime,
          would_send: timeMatches,
          daily_reminder_enabled: prefs.daily_reminder,
        });
        continue;
      }

      if (!timeMatches) {
        skippedCount++;
        continue;
      }
      
      // Check quiet hours
      const quietHoursEnabled = prefs.quiet_hours_enabled ?? false;
      if (quietHoursEnabled) {
        const quietStart = parseInt((prefs.quiet_hours_start || "22:00").split(':')[0], 10);
        const quietEnd = parseInt((prefs.quiet_hours_end || "08:00").split(':')[0], 10);
        
        // Check if current hour is in quiet hours
        const inQuietHours = quietStart > quietEnd
          ? (userCurrentHour >= quietStart || userCurrentHour < quietEnd)
          : (userCurrentHour >= quietStart && userCurrentHour < quietEnd);
        
        if (inQuietHours) {
          console.log(`User ${profile.id} in quiet hours, skipping`);
          skippedCount++;
          continue;
        }
      }

      // Check if already checked in today
      const lastCheckIn = profile.last_check_in ? new Date(profile.last_check_in).toISOString().split('T')[0] : null;
      if (lastCheckIn === userDateStr) {
        console.log(`User ${profile.id} already checked in today (${userDateStr}), skipping`);
        skippedCount++;
        continue;
      }

      // Build dedupe key: daily_reminder:YYYY-MM-DD:HH:MM (in user's local time)
      const dedupeKey = `daily_reminder:${userDateStr}:${reminderTime}`;
      
      // Try to insert into notification_deliveries (dedupe check)
      const { error: dedupeError } = await supabase
        .from("notification_deliveries")
        .insert({
          user_id: profile.id,
          type: 'daily_reminder',
          scheduled_for: now.toISOString(),
          dedupe_key: dedupeKey,
        });
      
      if (dedupeError) {
        // Unique constraint violation means already sent
        if (dedupeError.code === '23505') {
          console.log(`User ${profile.id} already received daily reminder for ${dedupeKey}`);
          alreadySentCount++;
          continue;
        }
        console.error(`Dedupe insert error for user ${profile.id}:`, dedupeError);
      }

      console.log(`User ${profile.id}: timezone=${userTimezone}, localTime=${userCurrentHour}:${userCurrentMinute.toString().padStart(2, '0')}, reminderTime=${reminderTime}`);

      const { data: subscription, error: subError } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", profile.id)
        .single();

      if (subError || !subscription) {
        console.log(`No push subscription for user ${profile.id}`);
        skippedCount++;
        continue;
      }

      const streak = profile.current_streak || 0;
      let message = "";
      
      if (streak === 0) {
        message = "Start your recovery journey today! A quick check-in takes just a moment.";
      } else if (streak < 7) {
        message = `You're on day ${streak + 1}! Keep building momentum with a check-in.`;
      } else if (streak < 30) {
        message = `${streak} days strong! 💪 Your daily check-in helps track your progress.`;
      } else if (streak < 90) {
        message = `Amazing! ${streak} days sober. Take a moment to reflect on how far you've come.`;
      } else {
        message = `${streak} days! You're an inspiration. How are you feeling today?`;
      }

      const pushSub = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      };

      const payload = JSON.stringify({
        title: "🌅 Daily Check-in Reminder",
        body: message,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        url: "/check-in",
        data: { type: "daily_reminder" },
        timestamp: Date.now(),
      });

      try {
        const result = await sendWebPush(pushSub, payload, vapid);
        if (result.ok) {
          console.log(`Sent daily reminder to user ${profile.id}`);
          sentCount++;
        } else if (result.status === 410) {
          await supabase.from("push_subscriptions").delete().eq("user_id", profile.id);
          console.log(`Deleted expired subscription for user ${profile.id}`);
        } else {
          console.error(`Error sending to user ${profile.id}: ${result.status} ${result.body}`);
        }
      } catch (pushError: any) {
        console.error(`Error sending to user ${profile.id}:`, pushError.message);
      }
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({ dry_run: true, results: dryRunResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Daily reminder complete: ${sentCount} sent, ${alreadySentCount} already sent, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, already_sent: alreadySentCount, skipped: skippedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-daily-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
