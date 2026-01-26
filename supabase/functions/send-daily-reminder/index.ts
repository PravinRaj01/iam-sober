import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import webpush from "https://esm.sh/web-push@3.6.7";

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

    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@iamsober.app";

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error("VAPID keys not configured");
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    // Get current UTC time
    const now = new Date();
    const currentUTCHour = now.getUTCHours();
    
    console.log(`Running daily reminder check at UTC hour: ${currentUTCHour}`);

    // Find users who:
    // 1. Have push subscriptions
    // 2. Have daily_reminder enabled
    // 3. Have reminder time matching current hour (approximate)
    // 4. Haven't checked in today
    const today = new Date().toISOString().split('T')[0];

    // Get all profiles with push subscriptions and daily reminders enabled
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(`
        id,
        pseudonym,
        notification_preferences,
        current_streak,
        last_check_in
      `)
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
      
      // Skip if daily reminder is disabled
      if (!prefs?.daily_reminder) {
        skippedCount++;
        continue;
      }

      // Get user's preferred time and timezone
      const reminderTime = prefs.daily_reminder_time || '09:00';
      const userTimezone = prefs.timezone || 'UTC';
      const reminderHour = parseInt(reminderTime.split(':')[0], 10);
      
      // Calculate what hour it currently is in the user's timezone
      let userCurrentHour: number;
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          hour: 'numeric',
          hour12: false,
        });
        userCurrentHour = parseInt(formatter.format(now), 10);
      } catch (e) {
        // Fallback to UTC if timezone is invalid
        console.log(`Invalid timezone ${userTimezone} for user ${profile.id}, using UTC`);
        userCurrentHour = currentUTCHour;
      }
      
      // Check if it's the right hour in the user's timezone
      if (userCurrentHour !== reminderHour) {
        skippedCount++;
        continue;
      }
      
      console.log(`User ${profile.id}: timezone=${userTimezone}, localHour=${userCurrentHour}, reminderHour=${reminderHour}`);

      // Check if already checked in today
      const lastCheckIn = profile.last_check_in ? new Date(profile.last_check_in).toISOString().split('T')[0] : null;
      if (lastCheckIn === today) {
        console.log(`User ${profile.id} already checked in today, skipping`);
        skippedCount++;
        continue;
      }

      // Get user's push subscription
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

      // Build motivational message based on streak
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

      // Build the push subscription object
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
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
        await webpush.sendNotification(pushSubscription, payload);
        console.log(`Sent daily reminder to user ${profile.id}`);
        sentCount++;
      } catch (pushError: any) {
        console.error(`Error sending to user ${profile.id}:`, pushError.message);
        
        // Handle expired subscriptions
        if (pushError.statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", profile.id);
          console.log(`Deleted expired subscription for user ${profile.id}`);
        }
      }
    }

    console.log(`Daily reminder complete: ${sentCount} sent, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        skipped: skippedCount 
      }),
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
