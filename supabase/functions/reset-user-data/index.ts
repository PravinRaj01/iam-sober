import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    const safeDelete = async (table: string) => {
      const { error } = await supabase.from(table).delete().eq("user_id", userId);
      if (error) throw new Error(`[reset-user-data] Failed deleting from ${table}: ${error.message}`);
    };

    // Child tables first (avoid FK issues)
    await Promise.all([
      safeDelete("community_comments"),
      safeDelete("community_reactions"),
      safeDelete("goal_completions"),
      safeDelete("chat_messages"),
    ]);

    // Parent tables (order not critical once children are removed)
    await Promise.all([
      safeDelete("check_ins"),
      safeDelete("journal_entries"),
      safeDelete("goals"),
      safeDelete("user_achievements"),
      safeDelete("coping_activities"),
      safeDelete("relapses"),
      safeDelete("triggers"),
      safeDelete("motivations"),
      safeDelete("reflections"),
      safeDelete("community_interactions"),
      safeDelete("conversations"),
      safeDelete("biometric_logs"),
      safeDelete("ai_interventions"),
      safeDelete("ai_observability_logs"),
      safeDelete("supporters"),
      safeDelete("push_subscriptions"),
      safeDelete("online_members"),
    ]);

    // Reset profile (keep the account)
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        current_streak: 0,
        longest_streak: 0,
        xp: 0,
        level: 1,
        points: 0,
        sobriety_start_date: new Date().toISOString(),
        last_check_in: null,
        onboarding_completed: false,
      })
      .eq("id", userId);

    if (profileError) {
      throw new Error(`[reset-user-data] Failed resetting profile: ${profileError.message}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
