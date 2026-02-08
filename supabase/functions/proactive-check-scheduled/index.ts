import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { sendWebPush, getVapidKeys } from "../_shared/web-push.ts";

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

// Cooldown periods in milliseconds based on frequency setting
const FREQUENCY_COOLDOWNS: Record<string, number> = {
  low: 24 * 60 * 60 * 1000,    // 24 hours
  medium: 6 * 60 * 60 * 1000,  // 6 hours
  high: 0,                      // No cooldown - send when risk detected
};

// Call Cerebras Llama 3.1 70B as fallback for text generation
async function callCerebras(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const CEREBRAS_API_KEY = Deno.env.get("CEREBRAS_API_KEY");
  if (!CEREBRAS_API_KEY) return null;

  try {
    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CEREBRAS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama3.1-70b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error(`[proactive-check-scheduled] Cerebras error ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("[proactive-check-scheduled] Cerebras failed:", error);
    return null;
  }
}

// Check if user is in quiet hours
function isInQuietHours(prefs: any, userTimezone: string, now: Date): boolean {
  if (!prefs?.quiet_hours_enabled) return false;
  
  const quietStart = parseInt((prefs.quiet_hours_start || "22:00").split(':')[0], 10);
  const quietEnd = parseInt((prefs.quiet_hours_end || "08:00").split(':')[0], 10);
  
  let userCurrentHour: number;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      hour: 'numeric',
      hour12: false,
    });
    userCurrentHour = parseInt(formatter.format(now), 10);
  } catch (_e) {
    userCurrentHour = now.getUTCHours();
  }
  
  // Handle quiet hours crossing midnight
  const inQuietHours = quietStart > quietEnd
    ? (userCurrentHour >= quietStart || userCurrentHour < quietEnd)
    : (userCurrentHour >= quietStart && userCurrentHour < quietEnd);
  
  return inQuietHours;
}

// Check cooldown based on user's frequency preference
async function shouldSkipDueToCooldown(
  supabase: any, 
  userId: string, 
  frequency: string, 
  riskScore: number,
  hasCriticalSignal: boolean
): Promise<boolean> {
  // Critical situations bypass cooldown
  if (riskScore >= 0.7 || hasCriticalSignal) {
    console.log(`[proactive-check-scheduled] User ${userId} bypassing cooldown due to critical risk`);
    return false;
  }

  const cooldownMs = FREQUENCY_COOLDOWNS[frequency] || FREQUENCY_COOLDOWNS.medium;
  
  // High frequency = no cooldown
  if (cooldownMs === 0) return false;

  const cooldownThreshold = new Date(Date.now() - cooldownMs);
  
  const { data: recentIntervention } = await supabase
    .from("ai_interventions")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", cooldownThreshold.toISOString())
    .limit(1)
    .single();

  if (recentIntervention) {
    console.log(`[proactive-check-scheduled] User ${userId} in cooldown (${frequency}), last intervention: ${recentIntervention.created_at}`);
    return true;
  }

  return false;
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
    const vapid = getVapidKeys();
    const now = new Date();

    console.log("[proactive-check-scheduled] Starting background check...");

    // Get all users with push subscriptions and proactive enabled
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth");

    if (subError) {
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
    }

    console.log(`[proactive-check-scheduled] Found ${subscriptions?.length || 0} users with push subscriptions`);

    let processedCount = 0;
    let interventionCount = 0;
    let skippedCount = 0;
    let cooldownSkippedCount = 0;

    for (const subscription of subscriptions || []) {
      const userId = subscription.user_id;
      
      // Get user profile and preferences
      const { data: profile } = await supabase
        .from("profiles")
        .select("notification_preferences, sobriety_start_date, pseudonym")
        .eq("id", userId)
        .single();

      if (!profile) {
        skippedCount++;
        continue;
      }

      const prefs = profile.notification_preferences as any;
      
      // Check if proactive notifications are enabled
      if (prefs?.proactive_enabled === false) {
        console.log(`[proactive-check-scheduled] User ${userId} has proactive disabled`);
        skippedCount++;
        continue;
      }

      const userTimezone = prefs?.timezone || 'UTC';
      const proactiveFrequency = prefs?.proactive_frequency || 'medium';
      
      // Check quiet hours
      if (isInQuietHours(prefs, userTimezone, now)) {
        console.log(`[proactive-check-scheduled] User ${userId} in quiet hours`);
        skippedCount++;
        continue;
      }

      // Check for existing unacknowledged intervention
      const { data: existingIntervention } = await supabase
        .from("ai_interventions")
        .select("id")
        .eq("user_id", userId)
        .eq("was_acknowledged", false)
        .limit(1)
        .single();

      if (existingIntervention) {
        console.log(`[proactive-check-scheduled] User ${userId} has pending intervention`);
        skippedCount++;
        continue;
      }

      // Collect risk signals
      const riskSignals: RiskSignal[] = [];
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      // Check for missed check-ins
      const { data: recentCheckIns } = await supabase
        .from("check_ins")
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", twoDaysAgo.toISOString());

      if (!recentCheckIns || recentCheckIns.length === 0) {
        riskSignals.push({
          type: "missed_check_ins",
          severity: "medium",
          description: "You haven't checked in for 2+ days",
          weight: 0.3
        });
      }

      // Chat inactivity
      const { data: recentChats } = await supabase
        .from("chat_messages")
        .select("created_at")
        .eq("user_id", userId)
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

      // Declining mood trend
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const { data: weeklyCheckIns } = await supabase
        .from("check_ins")
        .select("mood, urge_intensity")
        .eq("user_id", userId)
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

      // High urge intensity
      const { data: recentUrges } = await supabase
        .from("check_ins")
        .select("urge_intensity")
        .eq("user_id", userId)
        .gte("created_at", twoDaysAgo.toISOString())
        .not("urge_intensity", "is", null);

      if (recentUrges && recentUrges.length > 0) {
        const avgUrge = recentUrges.reduce((sum, ci) => sum + (ci.urge_intensity || 0), 0) / recentUrges.length;
        if (avgUrge >= 7) {
          riskSignals.push({ type: "high_urges", severity: "high", description: "Your urge levels have been elevated", weight: 0.5 });
        }
      }

      // Biometric stress indicators
      const { data: biometrics } = await supabase
        .from("biometric_logs")
        .select("stress_level, sleep_hours")
        .eq("user_id", userId)
        .gte("logged_at", twoDaysAgo.toISOString());

      if (biometrics && biometrics.length > 0) {
        const avgStress = biometrics.reduce((sum, b) => sum + (b.stress_level || 0), 0) / biometrics.length;
        const avgSleep = biometrics.reduce((sum, b) => sum + (b.sleep_hours || 0), 0) / biometrics.length;
        if (avgStress >= 8) {
          riskSignals.push({ type: "high_stress", severity: "high", description: "Your stress levels are very high", weight: 0.4 });
        }
        if (avgSleep < 5) {
          riskSignals.push({ type: "poor_sleep", severity: "medium", description: "You haven't been getting enough sleep", weight: 0.3 });
        }
      }

      // ========== NEW: Relapse history analysis ==========
      
      // Recent relapse in last 30 days
      const { data: recentRelapses } = await supabase
        .from("relapses")
        .select("relapse_date")
        .eq("user_id", userId)
        .gte("relapse_date", thirtyDaysAgo.toISOString());

      if (recentRelapses && recentRelapses.length > 0) {
        riskSignals.push({
          type: "recent_relapse",
          severity: "high",
          description: "You've had a recent setback - I'm here to support your continued journey",
          weight: 0.35
        });
      }

      // Multiple relapses in 90 days - CRITICAL
      const { data: ninetyDayRelapses } = await supabase
        .from("relapses")
        .select("relapse_date")
        .eq("user_id", userId)
        .gte("relapse_date", ninetyDaysAgo.toISOString());

      if (ninetyDayRelapses && ninetyDayRelapses.length >= 2) {
        riskSignals.push({
          type: "multiple_relapses",
          severity: "critical",
          description: "You've been through a challenging period - let's work together on stronger support strategies",
          weight: 0.5
        });
      }

      // ========== NEW: Journal sentiment decline ==========
      
      const { data: recentJournals } = await supabase
        .from("journal_entries")
        .select("sentiment")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(3);

      if (recentJournals && recentJournals.length >= 3) {
        const negativeCount = recentJournals.filter(j => {
          const sentiment = j.sentiment as any;
          return sentiment?.overall === 'negative' || sentiment?.score < 0.3;
        }).length;

        if (negativeCount >= 2) {
          riskSignals.push({
            type: "journal_sentiment_decline",
            severity: "medium",
            description: "Your recent journal entries suggest you might be going through a difficult time",
            weight: 0.25
          });
        }
      }

      // Calculate risk score
      const riskScore = Math.min(1, riskSignals.reduce((sum, s) => sum + s.weight, 0));
      const hasCriticalSignal = riskSignals.some(s => s.severity === "critical");
      const needsIntervention = riskScore >= 0.4 || riskSignals.some(s => s.severity === "high" || s.severity === "critical");

      if (!needsIntervention) {
        processedCount++;
        continue;
      }

      // ========== NEW: Check cooldown based on frequency preference ==========
      const shouldSkip = await shouldSkipDueToCooldown(supabase, userId, proactiveFrequency, riskScore, hasCriticalSignal);
      if (shouldSkip) {
        cooldownSkippedCount++;
        processedCount++;
        continue;
      }

      // Generate intervention message
      const signalsSummary = riskSignals.map(s => `- ${s.description} (${s.severity})`).join("\n");
      const userName = profile.pseudonym || "Friend";
      
      const primarySignal = riskSignals[0]?.type;
      let promptContext = "";
      if (primarySignal === "chat_inactivity") {
        promptContext = "The user hasn't chatted with the AI Coach in several days. Generate a warm, non-intrusive check-in message that invites them back without pressure.";
      } else if (primarySignal === "missed_check_ins") {
        promptContext = "The user hasn't done a daily check-in recently. Encourage them to take a moment to reflect.";
      } else if (primarySignal === "multiple_relapses" || primarySignal === "recent_relapse") {
        promptContext = "The user has experienced relapse(s) recently. Be extra compassionate and remind them that setbacks are part of recovery. Offer concrete support without judgment.";
      } else if (primarySignal === "journal_sentiment_decline") {
        promptContext = "The user's journal entries show declining mood. Acknowledge their feelings and offer gentle support.";
      } else {
        promptContext = "Generate a supportive check-in message based on the detected risk signals.";
      }

      // Add adaptive intensity note for critical situations
      const intensityNote = hasCriticalSignal || riskScore >= 0.7 
        ? " This is a critical situation - be especially warm and emphasize available support resources."
        : "";

      const systemPrompt = `You are a caring AI Recovery Coach. ${promptContext}${intensityNote} Be warm but not alarming. Offer 2-3 specific, actionable suggestions. Keep it under 100 words. Use the user's name: ${userName}`;
      const userPrompt = `Risk signals detected:\n${signalsSummary}\n\nGenerate a supportive check-in message.`;

      let aiMessage: string | null = null;
      let modelUsed = "unknown";

      // Try Gemini first
      const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
      if (GOOGLE_API_KEY) {
        try {
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

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            aiMessage = aiData.candidates?.[0]?.content?.parts?.[0]?.text || null;
            if (aiMessage) modelUsed = "gemini-2.5-flash-lite";
          }
        } catch (error) {
          console.error("[proactive-check-scheduled] Gemini failed:", error);
        }
      }

      // Fallback to Cerebras
      if (!aiMessage) {
        aiMessage = await callCerebras(systemPrompt, userPrompt);
        if (aiMessage) modelUsed = "cerebras-llama3.1-70b";
      }

      // Static fallback
      if (!aiMessage) {
        aiMessage = `Hey ${userName}, I noticed you might be going through a challenging time. Remember, you're not alone in this. Would you like to talk, try a coping exercise, or just check in?`;
        modelUsed = "fallback-static";
      }

      // Determine suggested actions based on signals
      const suggestedActions: string[] = [];
      if (riskSignals.some(s => s.type === "high_urges")) suggestedActions.push("try_coping_tool");
      if (riskSignals.some(s => s.type === "declining_mood" || s.type === "high_stress" || s.type === "chat_inactivity")) suggestedActions.push("talk_to_coach");
      if (riskSignals.some(s => s.type === "missed_check_ins")) suggestedActions.push("do_check_in");
      if (riskSignals.some(s => s.type === "poor_sleep")) suggestedActions.push("try_meditation");
      if (riskSignals.some(s => s.type === "recent_relapse" || s.type === "multiple_relapses")) {
        suggestedActions.push("talk_to_coach");
        suggestedActions.push("review_triggers");
      }
      if (riskSignals.some(s => s.type === "journal_sentiment_decline")) suggestedActions.push("write_journal");
      if (suggestedActions.length === 0) suggestedActions.push("talk_to_coach", "do_check_in");

      // Determine intervention type based on severity
      const interventionType = hasCriticalSignal ? "critical_outreach" : 
                               riskScore >= 0.7 ? "high_priority_check_in" : 
                               riskSignals[0]?.type || "proactive_scheduled";

      // Save intervention with adaptive metadata
      const { data: intervention } = await supabase
        .from("ai_interventions")
        .insert({
          user_id: userId,
          trigger_type: interventionType,
          risk_score: riskScore,
          message: aiMessage,
          suggested_actions: suggestedActions
        })
        .select()
        .single();

      // Log observability with additional context
      await supabase.from("ai_observability_logs").insert({
        user_id: userId,
        function_name: "proactive-check-scheduled",
        input_summary: `Risk signals: ${riskSignals.map(s => `${s.type}(${s.severity})`).join(", ")} | Frequency: ${proactiveFrequency} | Score: ${riskScore.toFixed(2)}`,
        response_summary: aiMessage.substring(0, 200),
        response_time_ms: Date.now() - startTime,
        model_used: modelUsed,
        intervention_triggered: true,
        intervention_type: interventionType
      });

      // Send push notification
      const pushSub = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      };

      // Customize notification based on severity
      const notificationTitle = hasCriticalSignal 
        ? "💙 We're Here for You" 
        : riskScore >= 0.6 
          ? "💙 Recovery Check-in" 
          : "💙 Thinking of You";

      const payload = JSON.stringify({
        title: notificationTitle,
        body: aiMessage.substring(0, 100) + (aiMessage.length > 100 ? "..." : ""),
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        url: "/",
        data: {
          type: "proactive_intervention",
          intervention_id: intervention?.id,
          risk_score: riskScore,
          is_critical: hasCriticalSignal,
        },
        timestamp: Date.now(),
      });

      try {
        const result = await sendWebPush(pushSub, payload, vapid);
        if (result.ok) {
          console.log(`[proactive-check-scheduled] Sent ${interventionType} to user ${userId} (score: ${riskScore.toFixed(2)})`);
          interventionCount++;
        } else if (result.status === 410) {
          await supabase.from("push_subscriptions").delete().eq("user_id", userId);
          console.log(`[proactive-check-scheduled] Deleted expired subscription for user ${userId}`);
        } else {
          console.error(`[proactive-check-scheduled] Push failed for ${userId}: ${result.status}`);
        }
      } catch (pushError: any) {
        console.error(`[proactive-check-scheduled] Push error for ${userId}:`, pushError.message);
      }

      processedCount++;
    }

    console.log(`[proactive-check-scheduled] Complete: ${processedCount} processed, ${interventionCount} interventions, ${skippedCount} skipped, ${cooldownSkippedCount} cooldown-skipped`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount, 
        interventions: interventionCount,
        skipped: skippedCount,
        cooldown_skipped: cooldownSkippedCount,
        duration_ms: Date.now() - startTime
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[proactive-check-scheduled] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
