import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { sendWebPush, getVapidKeys } from "../_shared/web-push.ts";

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

    const vapid = getVapidKeys();
    const now = new Date();
    const currentUTCDay = DAYS_OF_WEEK[now.getUTCDay()];
    const currentUTCHour = now.getUTCHours();
    
    console.log(`Running weekly report check at UTC day: ${currentUTCDay}, hour: ${currentUTCHour}`);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(`id, pseudonym, notification_preferences, current_streak, xp, level`)
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
      
      if (!prefs?.weekly_report) {
        skippedCount++;
        continue;
      }

      const reportDay = (prefs.weekly_report_day || 'monday').toLowerCase();
      const userTimezone = prefs.timezone || 'UTC';
      
      let userCurrentDay: string;
      let userCurrentHour: number;
      try {
        const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, weekday: 'long' });
        const hourFormatter = new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, hour: 'numeric', hour12: false });
        userCurrentDay = dayFormatter.format(now).toLowerCase();
        userCurrentHour = parseInt(hourFormatter.format(now), 10);
      } catch (_e) {
        console.log(`Invalid timezone ${userTimezone} for user ${profile.id}, using UTC`);
        userCurrentDay = currentUTCDay;
        userCurrentHour = currentUTCHour;
      }
      
      if (userCurrentDay !== reportDay || userCurrentHour !== 10) {
        skippedCount++;
        continue;
      }
      
      console.log(`User ${profile.id}: timezone=${userTimezone}, localDay=${userCurrentDay}, localHour=${userCurrentHour}`);

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

      const { data: checkIns } = await supabase
        .from("check_ins")
        .select("mood, urge_intensity")
        .eq("user_id", profile.id)
        .gte("created_at", weekAgoStr);

      const { data: journalEntries } = await supabase
        .from("journal_entries")
        .select("id")
        .eq("user_id", profile.id)
        .gte("created_at", weekAgoStr);

      const { data: achievements } = await supabase
        .from("user_achievements")
        .select("id")
        .eq("user_id", profile.id)
        .gte("earned_at", weekAgoStr);

      const checkInCount = checkIns?.length || 0;
      const journalCount = journalEntries?.length || 0;
      const achievementCount = achievements?.length || 0;
      const streak = profile.current_streak || 0;

      let avgMoodText = "";
      if (checkIns && checkIns.length > 0) {
        const moodScores: { [key: string]: number } = {
          "great": 5, "good": 4, "okay": 3, "struggling": 2, "difficult": 1
        };
        const avgScore = checkIns.reduce((sum, c) => sum + (moodScores[c.mood] || 3), 0) / checkIns.length;
        
        if (avgScore >= 4) avgMoodText = "Your mood was great this week! 🌟";
        else if (avgScore >= 3) avgMoodText = "You had a balanced week. ";
        else avgMoodText = "It was a challenging week. You're still here! ";
      }

      let message = `📊 Weekly Summary: `;
      message += `${streak} day streak, ${checkInCount} check-ins, ${journalCount} journal entries. `;
      if (achievementCount > 0) {
        message += `You earned ${achievementCount} new achievement${achievementCount > 1 ? 's' : ''}! 🏆 `;
      }
      message += avgMoodText;

      const pushSub = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
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
        const result = await sendWebPush(pushSub, payload, vapid);
        if (result.ok) {
          console.log(`Sent weekly report to user ${profile.id}`);
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

    console.log(`Weekly report complete: ${sentCount} sent, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, skipped: skippedCount }),
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
