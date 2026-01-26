import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error("Unauthorized");
    }

    // Get check-ins from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: checkIns } = await supabase
      .from("check_ins")
      .select("mood, urge_intensity, created_at")
      .eq("user_id", user.id)
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (!checkIns || checkIns.length === 0) {
      return new Response(
        JSON.stringify({ 
          pattern: "Not enough data yet",
          insight: "Keep logging your check-ins to see patterns!",
          trend: "neutral"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate averages
    const avgUrge = checkIns.reduce((sum, c) => sum + (c.urge_intensity || 0), 0) / checkIns.length;
    
    // Determine trend
    let trend = "stable";
    let insight = "Your mood has been consistent this week.";
    
    if (avgUrge > 7) {
      trend = "challenging";
      insight = "You've been experiencing strong urges. Remember to use your coping tools!";
    } else if (avgUrge < 4) {
      trend = "positive";
      insight = "Great work! Your urges have been manageable this week.";
    }

    // Mood frequency
    const moodCounts: Record<string, number> = {};
    checkIns.forEach(c => {
      moodCounts[c.mood] = (moodCounts[c.mood] || 0) + 1;
    });

    const mostCommonMood = Object.entries(moodCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || "unknown";

    return new Response(
      JSON.stringify({
        pattern: `Most common mood: ${mostCommonMood}`,
        insight,
        trend,
        avgUrge: avgUrge.toFixed(1),
        totalCheckIns: checkIns.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in detect-mood-patterns:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
