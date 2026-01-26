import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RiskSignal {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  weight: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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

    // Check for unacknowledged interventions first
    const { data: existingIntervention } = await supabase
      .from("ai_interventions")
      .select("*")
      .eq("user_id", user.id)
      .eq("was_acknowledged", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingIntervention) {
      return new Response(JSON.stringify({
        needs_intervention: true,
        intervention: existingIntervention,
        is_existing: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Collect risk signals
    const riskSignals: RiskSignal[] = [];
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // 1. Check for missed check-ins
    const { data: recentCheckIns } = await supabase
      .from("check_ins")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", twoDaysAgo.toISOString());

    if (!recentCheckIns || recentCheckIns.length === 0) {
      riskSignals.push({
        type: "missed_check_ins",
        severity: "medium",
        description: "You haven't checked in for 2+ days",
        weight: 0.3
      });
    }

    // 1b. Check for chat inactivity (3+ days without chatting)
    const { data: recentChats } = await supabase
      .from("chat_messages")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("role", "user")
      .gte("created_at", threeDaysAgo.toISOString())
      .limit(1);

    if (!recentChats || recentChats.length === 0) {
      riskSignals.push({
        type: "chat_inactivity",
        severity: "medium",
        description: "I haven't heard from you in a while. I'm here whenever you need to talk.",
        weight: 0.25
      });
    }

    // 1c. Check for journal inactivity (3+ days without journaling)
    const { data: recentJournals } = await supabase
      .from("journal_entries")
      .select("created_at")
      .eq("user_id", user.id)
      .gte("created_at", threeDaysAgo.toISOString())
      .limit(1);

    if (!recentJournals || recentJournals.length === 0) {
      riskSignals.push({
        type: "journal_inactivity",
        severity: "low",
        description: "Writing can help process your feelings. Consider journaling today.",
        weight: 0.2
      });
    }

    // 2. Check for declining mood trend
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { data: weeklyCheckIns } = await supabase
      .from("check_ins")
      .select("mood, urge_intensity, created_at")
      .eq("user_id", user.id)
      .gte("created_at", weekAgo.toISOString())
      .order("created_at", { ascending: true });

    if (weeklyCheckIns && weeklyCheckIns.length >= 3) {
      const moodScores: Record<string, number> = {
        "great": 5, "good": 4, "okay": 3, "struggling": 2, "crisis": 1
      };
      
      const recentMoods = weeklyCheckIns.slice(-3);
      const avgRecentScore = recentMoods.reduce((sum, ci) => sum + (moodScores[ci.mood] || 3), 0) / recentMoods.length;
      
      if (avgRecentScore <= 2) {
        riskSignals.push({
          type: "declining_mood",
          severity: "high",
          description: "Your recent moods indicate you might be struggling",
          weight: 0.4
        });
      }
    }

    // 3. Check for high urge intensity
    const { data: recentUrges } = await supabase
      .from("check_ins")
      .select("urge_intensity")
      .eq("user_id", user.id)
      .gte("created_at", twoDaysAgo.toISOString())
      .not("urge_intensity", "is", null);

    if (recentUrges && recentUrges.length > 0) {
      const avgUrge = recentUrges.reduce((sum, ci) => sum + (ci.urge_intensity || 0), 0) / recentUrges.length;
      if (avgUrge >= 7) {
        riskSignals.push({
          type: "high_urges",
          severity: "high",
          description: "Your urge levels have been elevated",
          weight: 0.5
        });
      } else if (avgUrge >= 5) {
        riskSignals.push({
          type: "moderate_urges",
          severity: "medium",
          description: "You've been experiencing some urges",
          weight: 0.25
        });
      }
    }

    // 4. Check biometric data for stress indicators
    const { data: biometrics } = await supabase
      .from("biometric_logs")
      .select("stress_level, sleep_hours")
      .eq("user_id", user.id)
      .gte("logged_at", twoDaysAgo.toISOString());

    if (biometrics && biometrics.length > 0) {
      const avgStress = biometrics.reduce((sum, b) => sum + (b.stress_level || 0), 0) / biometrics.length;
      const avgSleep = biometrics.reduce((sum, b) => sum + (b.sleep_hours || 0), 0) / biometrics.length;

      if (avgStress >= 8) {
        riskSignals.push({
          type: "high_stress",
          severity: "high",
          description: "Your stress levels are very high",
          weight: 0.4
        });
      }

      if (avgSleep < 5) {
        riskSignals.push({
          type: "poor_sleep",
          severity: "medium",
          description: "You haven't been getting enough sleep",
          weight: 0.3
        });
      }
    }

    // 5. Check for approaching difficult dates (sobriety milestones often trigger)
    const { data: profile } = await supabase
      .from("profiles")
      .select("sobriety_start_date, pseudonym")
      .eq("id", user.id)
      .single();

    if (profile?.sobriety_start_date) {
      const daysSober = Math.floor((now.getTime() - new Date(profile.sobriety_start_date).getTime()) / (1000 * 60 * 60 * 24));
      const criticalMilestones = [7, 14, 30, 60, 90, 180, 365];
      
      for (const milestone of criticalMilestones) {
        if (daysSober >= milestone - 2 && daysSober <= milestone + 1) {
          riskSignals.push({
            type: "milestone_approaching",
            severity: "low",
            description: `You're approaching your ${milestone}-day milestone!`,
            weight: 0.15
          });
          break;
        }
      }
    }

    // Calculate risk score
    const riskScore = Math.min(1, riskSignals.reduce((sum, s) => sum + s.weight, 0));

    // Determine if intervention is needed
    const needsIntervention = riskScore >= 0.4 || riskSignals.some(s => s.severity === "high" || s.severity === "critical");

    if (!needsIntervention) {
      return new Response(JSON.stringify({
        needs_intervention: false,
        risk_score: riskScore,
        signals_detected: riskSignals.length
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Generate intervention message using Google Gemini API
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY not configured");
    }

    const signalsSummary = riskSignals.map(s => `- ${s.description} (${s.severity})`).join("\n");
    const userName = profile?.pseudonym || "Friend";
    
    // Create context-specific prompt based on primary signal
    const primarySignal = riskSignals[0]?.type;
    let promptContext = "";
    if (primarySignal === "chat_inactivity") {
      promptContext = "The user hasn't chatted with the AI Coach in several days. Generate a warm, non-intrusive check-in message that invites them back without pressure.";
    } else if (primarySignal === "journal_inactivity") {
      promptContext = "The user hasn't journaled recently. Gently encourage them to write about their feelings without being pushy.";
    } else if (primarySignal === "missed_check_ins") {
      promptContext = "The user hasn't done a daily check-in recently. Encourage them to take a moment to reflect on how they're doing.";
    } else {
      promptContext = "Generate a supportive check-in message based on the detected risk signals.";
    }

    const systemPrompt = `You are a caring AI Recovery Coach. ${promptContext} Be warm but not alarming. Offer 2-3 specific, actionable suggestions. Keep it under 100 words. Use the user's name: ${userName}`;
    const userPrompt = `Risk signals detected:\n${signalsSummary}\n\nGenerate a supportive check-in message.`;

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
        }),
      }
    );

    if (!aiResponse.ok) {
      // Fallback to template message
      const fallbackMessage = `Hey ${userName}, I noticed you might be going through a challenging time. Remember, you're not alone in this. Would you like to talk, try a coping exercise, or just check in?`;
      
      const { data: intervention } = await supabase
        .from("ai_interventions")
        .insert({
          user_id: user.id,
          trigger_type: riskSignals[0]?.type || "general_check",
          risk_score: riskScore,
          message: fallbackMessage,
          suggested_actions: ["talk_to_coach", "try_meditation", "do_check_in"]
        })
        .select()
        .single();

      return new Response(JSON.stringify({
        needs_intervention: true,
        intervention,
        risk_signals: riskSignals
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Determine suggested actions based on signals
    const suggestedActions: string[] = [];
    if (riskSignals.some(s => s.type === "high_urges" || s.type === "moderate_urges")) {
      suggestedActions.push("try_coping_tool");
    }
    if (riskSignals.some(s => s.type === "declining_mood" || s.type === "high_stress")) {
      suggestedActions.push("talk_to_coach");
    }
    if (riskSignals.some(s => s.type === "chat_inactivity")) {
      suggestedActions.push("talk_to_coach");
    }
    if (riskSignals.some(s => s.type === "journal_inactivity")) {
      suggestedActions.push("write_journal");
    }
    if (riskSignals.some(s => s.type === "missed_check_ins")) {
      suggestedActions.push("do_check_in");
    }
    if (riskSignals.some(s => s.type === "poor_sleep")) {
      suggestedActions.push("try_meditation");
    }
    if (suggestedActions.length === 0) {
      suggestedActions.push("talk_to_coach", "do_check_in");
    }

    // Save intervention
    const { data: intervention } = await supabase
      .from("ai_interventions")
      .insert({
        user_id: user.id,
        trigger_type: riskSignals[0]?.type || "proactive_check",
        risk_score: riskScore,
        message: aiMessage,
        suggested_actions: suggestedActions
      })
      .select()
      .single();

    // Log observability
    await supabase.from("ai_observability_logs").insert({
      user_id: user.id,
      function_name: "proactive-check",
      input_summary: `Risk signals: ${riskSignals.map(s => s.type).join(", ")}`,
      response_summary: aiMessage.substring(0, 200),
      response_time_ms: Date.now() - startTime,
      model_used: "gemini-2.5-flash-lite",
      intervention_triggered: true,
      intervention_type: riskSignals[0]?.type
    });

    // Send push notification to user
    try {
      const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user.id,
          title: "💙 Recovery Check-in",
          body: aiMessage.substring(0, 100) + (aiMessage.length > 100 ? "..." : ""),
          url: "/ai-insights",
          data: {
            type: "proactive_intervention",
            intervention_id: intervention?.id,
            risk_score: riskScore,
          }
        }),
      });
      
      if (pushResponse.ok) {
        console.log("Push notification sent for intervention:", intervention?.id);
      }
    } catch (pushError) {
      console.error("Failed to send push notification:", pushError);
      // Don't fail the whole request if push fails
    }

    return new Response(JSON.stringify({
      needs_intervention: true,
      intervention,
      risk_signals: riskSignals,
      risk_score: riskScore
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Error in proactive-check:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
