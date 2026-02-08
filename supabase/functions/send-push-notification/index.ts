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
    const { user_id, title, body, icon, url, data, delay_seconds } = await req.json();

    if (!user_id) {
      throw new Error("user_id is required");
    }

    // Server-side delay (max 120s to stay within edge function limits)
    if (delay_seconds && delay_seconds > 0) {
      const actualDelay = Math.min(delay_seconds, 120);
      console.log(`Sleeping ${actualDelay}s before sending push to user: ${user_id}`);
      await new Promise(r => setTimeout(r, actualDelay * 1000));
    }

    const { data: subscription, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (subError || !subscription) {
      console.log("No push subscription found for user:", user_id);
      return new Response(
        JSON.stringify({ success: false, message: "No subscription found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = JSON.stringify({
      title: title || "I Am Sober",
      body: body || "You have a new notification",
      icon: icon || "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      url: url || "/",
      data: data || {},
      timestamp: Date.now(),
    });

    const pushSub = {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    };

    const result = await sendWebPush(pushSub, payload, vapid);

    if (result.status === 410 || result.status === 404) {
      console.log("Subscription expired for user:", user_id);
      await supabase.from("push_subscriptions").delete().eq("user_id", user_id);
      return new Response(
        JSON.stringify({ success: false, message: "Subscription expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!result.ok) {
      console.error("Push service error:", result.status, result.body);
      throw new Error(`Push service responded with ${result.status}: ${result.body}`);
    }

    console.log("Push notification sent to user:", user_id);
    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error sending push notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
