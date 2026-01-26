import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Milestone days to celebrate
const MILESTONES = [1, 3, 7, 14, 21, 30, 60, 90, 100, 180, 365, 500, 730, 1000];

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

    // Check if specific user_id is provided (for immediate celebration)
    // or run for all users (scheduled job)
    const body = await req.json().catch(() => ({}));
    const specificUserId = body.user_id;
    const specificMilestone = body.milestone;

    if (specificUserId && specificMilestone) {
      // Send to specific user
      return await sendToUser(supabase, specificUserId, specificMilestone);
    }

    // Batch check for all users hitting milestones today
    console.log("Running milestone check for all users");

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(`
        id,
        pseudonym,
        notification_preferences,
        current_streak,
        sobriety_start_date
      `)
      .not("notification_preferences", "is", null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    let sentCount = 0;
    let skippedCount = 0;

    for (const profile of profiles || []) {
      const prefs = profile.notification_preferences as any;
      
      // Skip if milestone alerts disabled
      if (!prefs?.milestone_alerts) {
        skippedCount++;
        continue;
      }

      // Calculate days sober
      const startDate = new Date(profile.sobriety_start_date);
      const today = new Date();
      const daysSober = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Check if today is a milestone day
      if (!MILESTONES.includes(daysSober)) {
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

      // Build celebration message
      const message = getMilestoneMessage(daysSober);

      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      const payload = JSON.stringify({
        title: `🎉 ${daysSober} Day${daysSober > 1 ? 's' : ''} Sober!`,
        body: message,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        url: "/achievements",
        data: { type: "milestone_alert", days: daysSober },
        timestamp: Date.now(),
      });

      try {
        await webpush.sendNotification(pushSubscription, payload);
        console.log(`Sent milestone alert to user ${profile.id} for ${daysSober} days`);
        sentCount++;
      } catch (pushError: any) {
        console.error(`Error sending to user ${profile.id}:`, pushError.message);
        
        if (pushError.statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", profile.id);
        }
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

async function sendToUser(supabase: any, userId: string, milestone: number) {
  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@iamsober.app";

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);

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

  const message = getMilestoneMessage(milestone);

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  const payload = JSON.stringify({
    title: `🎉 ${milestone} Day${milestone > 1 ? 's' : ''} Sober!`,
    body: message,
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    url: "/achievements",
    data: { type: "milestone_alert", days: milestone },
    timestamp: Date.now(),
  });

  await webpush.sendNotification(pushSubscription, payload);

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { "Content-Type": "application/json" } }
  );
}

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
