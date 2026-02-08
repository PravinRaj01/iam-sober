import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { sendWebPush, getVapidKeys } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const currentUTCHour = now.getUTCHours();
    
    console.log(`Running daily reminder check at UTC hour: ${currentUTCHour}`);

    const today = new Date().toISOString().split('T')[0];

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

    for (const profile of profiles || []) {
      const prefs = profile.notification_preferences as any;
      
      if (!prefs?.daily_reminder) {
        skippedCount++;
        continue;
      }

      const reminderTime = prefs.daily_reminder_time || '09:00';
      const userTimezone = prefs.timezone || 'UTC';
      const reminderHour = parseInt(reminderTime.split(':')[0], 10);
      
      let userCurrentHour: number;
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          hour: 'numeric',
          hour12: false,
        });
        userCurrentHour = parseInt(formatter.format(now), 10);
      } catch (_e) {
        console.log(`Invalid timezone ${userTimezone} for user ${profile.id}, using UTC`);
        userCurrentHour = currentUTCHour;
      }
      
      if (userCurrentHour !== reminderHour) {
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
      
      console.log(`User ${profile.id}: timezone=${userTimezone}, localHour=${userCurrentHour}, reminderHour=${reminderHour}`);

      const lastCheckIn = profile.last_check_in ? new Date(profile.last_check_in).toISOString().split('T')[0] : null;
      if (lastCheckIn === today) {
        console.log(`User ${profile.id} already checked in today, skipping`);
        skippedCount++;
        continue;
      }

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

    console.log(`Daily reminder complete: ${sentCount} sent, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, skipped: skippedCount }),
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
