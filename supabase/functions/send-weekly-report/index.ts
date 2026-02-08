import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { sendWebPush, getVapidKeys } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Helper to get user's local time info
function getUserLocalTime(timezone: string, now: Date): { 
  hour: number; 
  minute: number; 
  dayName: string; 
  isoWeek: string;
} {
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
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
    });
    
    const hour = parseInt(hourFormatter.format(now), 10);
    const minute = parseInt(minuteFormatter.format(now), 10);
    const dayName = dayFormatter.format(now).toLowerCase();
    
    // Calculate ISO week number for dedupe key
    const localDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const startOfYear = new Date(localDate.getFullYear(), 0, 1);
    const days = Math.floor((localDate.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    const isoWeek = `${localDate.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
    
    return { hour, minute, dayName, isoWeek };
  } catch (_e) {
    // Fallback to UTC if timezone is invalid
    const weekNumber = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    return {
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      dayName: DAYS_OF_WEEK[now.getUTCDay()],
      isoWeek: `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`,
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

    console.log(`Running weekly report check at ${now.toISOString()}${dryRun ? ' (DRY RUN)' : ''}`);

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
    let alreadySentCount = 0;
    const dryRunResults: any[] = [];

    for (const profile of profiles || []) {
      // If targeting specific user in dry_run, skip others
      if (targetUserId && profile.id !== targetUserId) {
        continue;
      }

      const prefs = profile.notification_preferences as any;
      
      if (!prefs?.weekly_report) {
        skippedCount++;
        continue;
      }

      const reportDay = (prefs.weekly_report_day || 'monday').toLowerCase();
      const reportTime = prefs.weekly_report_time || '10:00';
      const [reportHourStr, reportMinuteStr] = reportTime.split(':');
      const reportHour = parseInt(reportHourStr, 10);
      const reportMinute = parseInt(reportMinuteStr || '0', 10);
      const userTimezone = prefs.timezone || 'UTC';
      
      const { hour: userCurrentHour, minute: userCurrentMinute, dayName: userCurrentDay, isoWeek } = getUserLocalTime(userTimezone, now);
      
      // Check if current time matches (day + hour + minute)
      const dayMatches = userCurrentDay === reportDay;
      const timeMatches = userCurrentHour === reportHour && userCurrentMinute === reportMinute;
      const shouldSend = dayMatches && timeMatches;
      
      if (dryRun) {
        dryRunResults.push({
          user_id: profile.id,
          timezone: userTimezone,
          current_local_day: userCurrentDay,
          current_local_time: `${userCurrentHour.toString().padStart(2, '0')}:${userCurrentMinute.toString().padStart(2, '0')}`,
          report_day: reportDay,
          report_time: reportTime,
          iso_week: isoWeek,
          would_send: shouldSend,
          weekly_report_enabled: prefs.weekly_report,
        });
        continue;
      }

      if (!shouldSend) {
        skippedCount++;
        continue;
      }
      
      // Check quiet hours
      const quietHoursEnabled = prefs.quiet_hours_enabled ?? false;
      if (quietHoursEnabled) {
        const quietStart = parseInt((prefs.quiet_hours_start || "22:00").split(':')[0], 10);
        const quietEnd = parseInt((prefs.quiet_hours_end || "08:00").split(':')[0], 10);
        
        const inQuietHours = quietStart > quietEnd
          ? (userCurrentHour >= quietStart || userCurrentHour < quietEnd)
          : (userCurrentHour >= quietStart && userCurrentHour < quietEnd);
        
        if (inQuietHours) {
          console.log(`User ${profile.id} in quiet hours, skipping weekly report`);
          skippedCount++;
          continue;
        }
      }

      // Build dedupe key: weekly_report:YYYY-WW:day:HH:MM
      const dedupeKey = `weekly_report:${isoWeek}:${reportDay}:${reportTime}`;
      
      // Try to insert into notification_deliveries (dedupe check)
      const { error: dedupeError } = await supabase
        .from("notification_deliveries")
        .insert({
          user_id: profile.id,
          type: 'weekly_report',
          scheduled_for: now.toISOString(),
          dedupe_key: dedupeKey,
        });
      
      if (dedupeError) {
        // Unique constraint violation means already sent
        if (dedupeError.code === '23505') {
          console.log(`User ${profile.id} already received weekly report for ${dedupeKey}`);
          alreadySentCount++;
          continue;
        }
        console.error(`Dedupe insert error for user ${profile.id}:`, dedupeError);
      }
      
      console.log(`User ${profile.id}: timezone=${userTimezone}, localDay=${userCurrentDay}, localTime=${userCurrentHour}:${userCurrentMinute.toString().padStart(2, '0')}`);

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

    if (dryRun) {
      return new Response(
        JSON.stringify({ dry_run: true, results: dryRunResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Weekly report complete: ${sentCount} sent, ${alreadySentCount} already sent, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, already_sent: alreadySentCount, skipped: skippedCount }),
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
