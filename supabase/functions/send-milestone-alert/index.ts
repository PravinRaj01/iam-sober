import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { sendWebPush, getVapidKeys } from "../_shared/web-push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MILESTONES = [1, 3, 7, 14, 21, 30, 60, 90, 100, 180, 365, 500, 730, 1000];

function getMilestoneMessage(days: number): string {
  const messages: { [key: number]: string } = {
    1: "You made it through your first day! Every journey starts with a single step. 💪",
    3: "Three days strong! You're building real momentum now. Keep going!",
    7: "One week sober! 🌟 This is a huge accomplishment. You're proving you can do this.",
    14: "Two weeks! Your body and mind are already thanking you. Amazing work!",
    21: "Three weeks! They say it takes 21 days to form a habit. Look at you go! 🚀",
    30: "ONE MONTH! 🏆 This is a major milestone. You should be incredibly proud.",
    60: "Two months of strength and courage. You're rewriting your story every day.",
    90: "90 days! 🎊 You've made it through the hardest part. The future is bright!",
    100: "Triple digits! 100 days of choosing yourself. Incredible! 💯",
    180: "Six months sober! Half a year of freedom. You're an inspiration! 🌈",
    365: "ONE YEAR! 🎆 365 days of strength. This is life-changing. You did it!",
    500: "500 days! You've built a new life. Keep shining! ✨",
    730: "TWO YEARS! 🏅 730 days of courage. You're living proof that recovery works.",
    1000: "1000 DAYS! 🌟 This is legendary. You're a true champion of recovery!"
  };
  return messages[days] || `${days} days sober! Every day counts. Keep going! 💪`;
}

async function sendToUser(supabase: any, userId: string, milestone: number, vapid: any) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("notification_preferences")
    .eq("id", userId)
    .single();

  if (profileError) {
    return new Response(
      JSON.stringify({ error: "Profile not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const prefs = profile?.notification_preferences as any;
  if (!prefs?.milestone_alerts) {
    return new Response(
      JSON.stringify({ success: false, message: "Milestone alerts disabled" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: subscription, error: subError } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (subError || !subscription) {
    return new Response(
      JSON.stringify({ success: false, message: "No subscription found" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const pushSub = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };

  const payload = JSON.stringify({
    title: `🎉 ${milestone} Day${milestone > 1 ? 's' : ''} Sober!`,
    body: getMilestoneMessage(milestone),
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    url: "/achievements",
    data: { type: "milestone_alert", days: milestone },
    timestamp: Date.now(),
  });

  await sendWebPush(pushSub, payload, vapid);

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { "Content-Type": "application/json" } }
  );
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

    const body = await req.json().catch(() => ({}));
    const specificUserId = body.user_id;
    const specificMilestone = body.milestone;

    if (specificUserId && specificMilestone) {
      return await sendToUser(supabase, specificUserId, specificMilestone, vapid);
    }

    console.log("Running milestone check for all users");

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(`id, pseudonym, notification_preferences, current_streak, sobriety_start_date`)
      .not("notification_preferences", "is", null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    let sentCount = 0;
    let skippedCount = 0;

    for (const profile of profiles || []) {
      const prefs = profile.notification_preferences as any;
      
      if (!prefs?.milestone_alerts) {
        skippedCount++;
        continue;
      }

      const startDate = new Date(profile.sobriety_start_date);
      const today = new Date();
      const daysSober = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      if (!MILESTONES.includes(daysSober)) {
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

      const pushSub = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      };

      const payload = JSON.stringify({
        title: `🎉 ${daysSober} Day${daysSober > 1 ? 's' : ''} Sober!`,
        body: getMilestoneMessage(daysSober),
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        url: "/achievements",
        data: { type: "milestone_alert", days: daysSober },
        timestamp: Date.now(),
      });

      try {
        const result = await sendWebPush(pushSub, payload, vapid);
        if (result.ok) {
          console.log(`Sent milestone alert to user ${profile.id} for ${daysSober} days`);
          sentCount++;
        } else if (result.status === 410) {
          await supabase.from("push_subscriptions").delete().eq("user_id", profile.id);
        } else {
          console.error(`Error sending to user ${profile.id}: ${result.status} ${result.body}`);
        }
      } catch (pushError: any) {
        console.error(`Error sending to user ${profile.id}:`, pushError.message);
      }
    }

    console.log(`Milestone check complete: ${sentCount} sent, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, skipped: skippedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-milestone-alert:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
