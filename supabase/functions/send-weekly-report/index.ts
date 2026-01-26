import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

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
    const currentUTCDay = DAYS_OF_WEEK[now.getUTCDay()];
    const currentUTCHour = now.getUTCHours();
    
    console.log(`Running weekly report check at UTC day: ${currentUTCDay}, hour: ${currentUTCHour}`);

    // Get date range for the past week
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();

    // Get all profiles with push subscriptions and weekly reports enabled
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(`
        id,
        pseudonym,
        notification_preferences,
        current_streak,
        xp,
        level
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
      
      // Skip if weekly report is disabled
      if (!prefs?.weekly_report) {
        skippedCount++;
        continue;
      }

      // Get user's preferred day and timezone
      const reportDay = (prefs.weekly_report_day || 'monday').toLowerCase();
      const userTimezone = prefs.timezone || 'UTC';
      
      // Calculate what day and hour it currently is in the user's timezone
      let userCurrentDay: string;
      let userCurrentHour: number;
      try {
        const dayFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          weekday: 'long',
        });
        const hourFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          hour: 'numeric',
          hour12: false,
        });
        userCurrentDay = dayFormatter.format(now).toLowerCase();
        userCurrentHour = parseInt(hourFormatter.format(now), 10);
      } catch (e) {
        // Fallback to UTC if timezone is invalid
        console.log(`Invalid timezone ${userTimezone} for user ${profile.id}, using UTC`);
        userCurrentDay = currentUTCDay;
        userCurrentHour = currentUTCHour;
      }
      
      // Check if it's the right day in the user's timezone
      // Also check if it's around 10am in their local time (the scheduled time for weekly reports)
      if (userCurrentDay !== reportDay || userCurrentHour !== 10) {
        skippedCount++;
        continue;
      }
      
      console.log(`User ${profile.id}: timezone=${userTimezone}, localDay=${userCurrentDay}, localHour=${userCurrentHour}`);

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

      // Get weekly stats
      const { data: checkIns, error: checkInsError } = await supabase
        .from("check_ins")
        .select("mood, urge_intensity")
        .eq("user_id", profile.id)
        .gte("created_at", weekAgoStr);

      const { data: journalEntries, error: journalError } = await supabase
        .from("journal_entries")
        .select("id")
        .eq("user_id", profile.id)
        .gte("created_at", weekAgoStr);

      const { data: achievements, error: achievementsError } = await supabase
        .from("user_achievements")
        .select("id")
        .eq("user_id", profile.id)
        .gte("earned_at", weekAgoStr);

      // Calculate stats
      const checkInCount = checkIns?.length || 0;
      const journalCount = journalEntries?.length || 0;
      const achievementCount = achievements?.length || 0;
      const streak = profile.current_streak || 0;

      // Calculate average mood if we have check-ins
      let avgMoodText = "";
      if (checkIns && checkIns.length > 0) {
        const moodScores: { [key: string]: number } = {
          "great": 5, "good": 4, "okay": 3, "struggling": 2, "difficult": 1
        };
        const avgScore = checkIns.reduce((sum, c) => {
          return sum + (moodScores[c.mood] || 3);
        }, 0) / checkIns.length;
        
        if (avgScore >= 4) avgMoodText = "Your mood was great this week! 🌟";
        else if (avgScore >= 3) avgMoodText = "You had a balanced week. ";
        else avgMoodText = "It was a challenging week. You're still here! ";
      }

      // Build summary message
      let message = `📊 Weekly Summary: `;
      message += `${streak} day streak, ${checkInCount} check-ins, ${journalCount} journal entries. `;
      if (achievementCount > 0) {
        message += `You earned ${achievementCount} new achievement${achievementCount > 1 ? 's' : ''}! 🏆 `;
      }
      message += avgMoodText;

      // Build the push subscription object
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      const payload = JSON.stringify({
        title: "📈 Your Weekly Progress Report",
        body: message,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        url: "/progress",
        data: { type: "weekly_report" },
        timestamp: Date.now(),
      });

      try {
        await webpush.sendNotification(pushSubscription, payload);
        console.log(`Sent weekly report to user ${profile.id}`);
        sentCount++;
      } catch (pushError: any) {
        console.error(`Error sending to user ${profile.id}:`, pushError.message);
        
        if (pushError.statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", profile.id);
          console.log(`Deleted expired subscription for user ${profile.id}`);
        }
      }
    }

    console.log(`Weekly report complete: ${sentCount} sent, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        skipped: skippedCount 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-weekly-report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
