import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FITBIT_CLIENT_ID = Deno.env.get("FITBIT_CLIENT_ID")!;
const FITBIT_CLIENT_SECRET = Deno.env.get("FITBIT_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Helper: get authenticated user from request
async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const supabaseClient = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

// Helper: refresh Fitbit token if expired
async function refreshFitbitToken(supabaseAdmin: any, userId: string, tokenRow: any) {
  // Check if token is expired (with 5-minute buffer)
  const expiresAt = new Date(tokenRow.expires_at);
  const now = new Date(Date.now() + 5 * 60 * 1000); // 5 min buffer

  if (expiresAt > now) {
    // Token still valid
    return tokenRow.access_token;
  }

  console.log(`Refreshing Fitbit token for user ${userId}`);

  const refreshResponse = await fetch("https://api.fitbit.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${btoa(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenRow.refresh_token,
    }),
  });

  if (!refreshResponse.ok) {
    const errorText = await refreshResponse.text();
    console.error("Fitbit token refresh failed:", errorText);
    throw new Error("Fitbit token refresh failed. Please reconnect your Fitbit account.");
  }

  const newTokens = await refreshResponse.json();

  // Update stored tokens
  const { error: updateError } = await supabaseAdmin
    .from("fitbit_tokens")
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
    })
    .eq("user_id", userId);

  if (updateError) {
    console.error("Failed to update refreshed tokens:", updateError);
  }

  return newTokens.access_token;
}

// Helper: fetch data from Fitbit API
async function fetchFitbitData(accessToken: string) {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Fetch multiple endpoints in parallel
  const [heartRes, sleepRes, activityRes] = await Promise.all([
    fetch(`https://api.fitbit.com/1/user/-/activities/heart/date/${today}/1d.json`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(`https://api.fitbit.com/1.2/user/-/sleep/date/${today}.json`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(`https://api.fitbit.com/1/user/-/activities/date/${today}.json`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  let heartRate: number | null = null;
  let restingHeartRate: number | null = null;
  let sleepHours: number | null = null;
  let steps: number | null = null;
  let hrv: number | null = null;

  // Parse heart rate
  if (heartRes.ok) {
    try {
      const heartData = await heartRes.json();
      const heartValues = heartData?.["activities-heart"]?.[0]?.value;
      restingHeartRate = heartValues?.restingHeartRate || null;
      heartRate = restingHeartRate;
      console.log("Heart rate data:", JSON.stringify(heartValues));
    } catch (e) {
      console.error("Error parsing heart rate:", e);
    }
  } else {
    console.warn("Heart rate fetch failed:", heartRes.status, await heartRes.text());
  }

  // Parse sleep
  if (sleepRes.ok) {
    try {
      const sleepData = await sleepRes.json();
      const totalMinutes = sleepData?.summary?.totalMinutesAsleep || 0;
      sleepHours = totalMinutes > 0 ? parseFloat((totalMinutes / 60).toFixed(1)) : null;
      console.log("Sleep data - total minutes asleep:", totalMinutes);
    } catch (e) {
      console.error("Error parsing sleep:", e);
    }
  } else {
    console.warn("Sleep fetch failed:", sleepRes.status, await sleepRes.text());
  }

  // Parse activity (steps)
  if (activityRes.ok) {
    try {
      const activityData = await activityRes.json();
      steps = activityData?.summary?.steps || null;
      console.log("Activity data - steps:", steps);
    } catch (e) {
      console.error("Error parsing activity:", e);
    }
  } else {
    console.warn("Activity fetch failed:", activityRes.status, await activityRes.text());
  }

  // Try to fetch HRV (only available on newer Fitbit devices)
  try {
    const hrvRes = await fetch(
      `https://api.fitbit.com/1/user/-/hrv/date/${today}.json`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (hrvRes.ok) {
      const hrvData = await hrvRes.json();
      hrv = hrvData?.hrv?.[0]?.value?.dailyRmssd
        ? Math.round(hrvData.hrv[0].value.dailyRmssd)
        : null;
      console.log("HRV data:", hrv);
    }
  } catch (e) {
    console.log("HRV not available:", e);
  }

  return { heart_rate: heartRate, sleep_hours: sleepHours, steps, hrv };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ─── AUTHORIZE ──────────────────────────────────────────────
    if (action === "authorize") {
      const user = await getUser(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { callbackUrl } = await req.json();
      const state = crypto.randomUUID();

      const scopes = ["activity", "heartrate", "sleep", "profile"].join("%20");

      const fitbitAuthUrl =
        `https://www.fitbit.com/oauth2/authorize?` +
        `response_type=code&` +
        `client_id=${FITBIT_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
        `scope=${scopes}&` +
        `state=${state}`;

      return new Response(JSON.stringify({ authUrl: fitbitAuthUrl, state }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── CALLBACK ───────────────────────────────────────────────
    if (action === "callback") {
      const user = await getUser(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { code, callbackUrl } = await req.json();

      // Exchange code for tokens
      const tokenResponse = await fetch("https://api.fitbit.com/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: callbackUrl,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Fitbit token exchange failed:", errorText);
        let errorDetail = "Failed to exchange code for token";
        try {
          const parsed = JSON.parse(errorText);
          errorDetail = parsed.errors?.[0]?.message || parsed.error_description || errorDetail;
        } catch (_) {}
        return new Response(JSON.stringify({ error: errorDetail }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokens = await tokenResponse.json();
      console.log("Fitbit tokens received. Scopes:", tokens.scope, "User:", tokens.user_id);

      // Store tokens securely in fitbit_tokens table (upsert)
      const { error: upsertError } = await supabaseAdmin
        .from("fitbit_tokens")
        .upsert({
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          fitbit_user_id: tokens.user_id,
          scope: tokens.scope,
          token_type: tokens.token_type || "Bearer",
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Failed to store Fitbit tokens:", upsertError);
        return new Response(JSON.stringify({ error: "Failed to store tokens" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile to mark Fitbit as connected
      await supabaseAdmin
        .from("profiles")
        .update({
          privacy_settings: {
            fitbit_connected: true,
            fitbit_user_id: tokens.user_id,
          },
        })
        .eq("id", user.id);

      return new Response(JSON.stringify({
        success: true,
        user_id: tokens.user_id,
        scope: tokens.scope,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── SYNC ───────────────────────────────────────────────────
    if (action === "sync") {
      const user = await getUser(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get stored tokens
      const { data: tokenRow, error: tokenError } = await supabaseAdmin
        .from("fitbit_tokens")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (tokenError || !tokenRow) {
        console.error("No Fitbit tokens found for user:", user.id);
        return new Response(JSON.stringify({ error: "Fitbit not connected. Please connect your Fitbit first." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Refresh token if needed
      let accessToken: string;
      try {
        accessToken = await refreshFitbitToken(supabaseAdmin, user.id, tokenRow);
      } catch (refreshError: any) {
        // Token refresh failed — mark as disconnected
        await supabaseAdmin
          .from("profiles")
          .update({ privacy_settings: { fitbit_connected: false } })
          .eq("id", user.id);

        return new Response(JSON.stringify({ error: refreshError.message || "Token refresh failed" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch real data from Fitbit API
      const fitbitData = await fetchFitbitData(accessToken);
      console.log("Fitbit data fetched:", JSON.stringify(fitbitData));

      // Save to biometric_logs
      const { error: insertError } = await supabaseAdmin
        .from("biometric_logs")
        .insert({
          user_id: user.id,
          heart_rate: fitbitData.heart_rate,
          sleep_hours: fitbitData.sleep_hours,
          steps: fitbitData.steps,
          hrv: fitbitData.hrv,
          source: "fitbit",
          logged_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Failed to save Fitbit data:", insertError);
        return new Response(JSON.stringify({ error: "Failed to save data" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: fitbitData,
        message: "Fitbit data synced successfully",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── DISCONNECT ─────────────────────────────────────────────
    if (action === "disconnect") {
      const user = await getUser(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Revoke token at Fitbit
      const { data: tokenRow } = await supabaseAdmin
        .from("fitbit_tokens")
        .select("access_token")
        .eq("user_id", user.id)
        .single();

      if (tokenRow?.access_token) {
        try {
          await fetch("https://api.fitbit.com/oauth2/revoke", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Authorization": `Basic ${btoa(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`)}`,
            },
            body: new URLSearchParams({ token: tokenRow.access_token }),
          });
        } catch (e) {
          console.warn("Failed to revoke Fitbit token:", e);
        }
      }

      // Delete stored tokens
      await supabaseAdmin.from("fitbit_tokens").delete().eq("user_id", user.id);

      // Update profile
      await supabaseAdmin
        .from("profiles")
        .update({ privacy_settings: { fitbit_connected: false } })
        .eq("id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Fitbit auth error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
