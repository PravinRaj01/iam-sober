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

    const { user_id, supporter_name, message_type, message_preview } = await req.json();

    if (!user_id) {
      throw new Error("user_id is required");
    }

    // Check if user has supporter updates enabled
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("notification_preferences, pseudonym")
      .eq("id", user_id)
      .single();

    if (profileError || !profile) {
      console.log("Profile not found for user:", user_id);
      return new Response(
        JSON.stringify({ success: false, message: "Profile not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prefs = profile.notification_preferences as any;
    if (!prefs?.supporter_updates) {
      console.log("Supporter updates disabled for user:", user_id);
      return new Response(
        JSON.stringify({ success: false, message: "Supporter updates disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's push subscription
    const { data: subscription, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (subError || !subscription) {
      console.log("No push subscription found for user:", user_id);
      return new Response(
        JSON.stringify({ success: false, message: "No subscription found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build notification based on message type
    let title = "";
    let body = "";
    let url = "/";

    switch (message_type) {
      case "encouragement":
        title = `💌 ${supporter_name || "A supporter"} sent encouragement`;
        body = message_preview || "Someone believes in you! Check your messages.";
        url = "/dashboard";
        break;
      case "check_in":
        title = `👋 ${supporter_name || "A supporter"} is checking on you`;
        body = message_preview || "Your support network cares about your progress.";
        url = "/dashboard";
        break;
      case "milestone_reaction":
        title = `🎉 ${supporter_name || "Someone"} celebrated your milestone!`;
        body = message_preview || "Your supporter is proud of your achievement!";
        url = "/achievements";
        break;
      default:
        title = `📬 Message from ${supporter_name || "your support network"}`;
        body = message_preview || "You have a new message from your supporter.";
        url = "/dashboard";
    }

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    const payload = JSON.stringify({
      title,
      body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      url,
      data: { 
        type: "supporter_notification",
        supporter_name,
        message_type 
      },
      timestamp: Date.now(),
    });

    await webpush.sendNotification(pushSubscription, payload);

    console.log("Supporter notification sent to user:", user_id);

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error sending supporter notification:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
