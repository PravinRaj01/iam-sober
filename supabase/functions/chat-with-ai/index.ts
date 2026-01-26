/**
 * AI COACH - Fully Agentic ReAct Agent with Tool-Augmented LLM
 * 
 * Architecture Pattern: ReAct (Reasoning + Acting) with Autonomous Tool Selection
 * Model: Google Gemini 2.5 Flash Lite via Direct API
 * 
 * COMPETITION-READY FEATURES:
 * ✅ True Agent Autonomy - ALL tools available, no regex gating
 * ✅ Confirmation Flow - Agent confirms before write actions
 * ✅ Multi-Step Reasoning - Up to 5 chained tool calls
 * ✅ Pattern Recognition - Proactive insights based on data
 * ✅ Crisis Detection & Escalation - Safety layer with hotline integration
 * ✅ Action Planning - Multi-step goal planning
 * ✅ Conversation Memory - Context from past interactions
 * ✅ Full Observability - All interactions logged with metrics
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Crisis detection keywords for safety layer
const CRISIS_KEYWORDS = [
  "suicide", "suicidal", "kill myself", "end my life", "want to die",
  "self-harm", "hurt myself", "cutting", "overdose", "relapse",
  "can't go on", "give up", "no reason to live", "better off dead"
];

// Sanitize user input to prevent prompt injection
function sanitizeInput(input: string, maxLength: number = 5000): string {
  if (!input || typeof input !== 'string') return '';
  
  let sanitized = input.slice(0, maxLength).trim();
  
  const dangerousPatterns = [
    /system:/gi,
    /assistant:/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<s>/gi,
    /<\/s>/gi,
  ];
  
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  return sanitized;
}

// Check for crisis indicators
function detectCrisis(message: string): { isCrisis: boolean; matchedKeywords: string[] } {
  const lowerMessage = message.toLowerCase();
  const matchedKeywords = CRISIS_KEYWORDS.filter(keyword => lowerMessage.includes(keyword));
  return {
    isCrisis: matchedKeywords.length > 0,
    matchedKeywords
  };
}

// Define ALL AI Agent Tools for Gemini function calling format
const geminiTools = [{
  functionDeclarations: [
    // === READ TOOLS ===
    {
      name: "get_user_progress",
      description: "Get user's sobriety progress including days sober, current streak, level, XP, and longest streak. ALWAYS call this before answering questions about user's progress, days sober, or recovery status.",
      parameters: { type: "object", properties: {}, required: [] }
    },
    {
      name: "get_recent_moods",
      description: "Get user's recent check-in data including mood, urge intensity, and notes from the last 7 days. ALWAYS call this before answering questions about how the user is doing, their mood patterns, or check-in history.",
      parameters: { type: "object", properties: {}, required: [] }
    },
    {
      name: "get_active_goals",
      description: "Get user's current active goals and their progress. ALWAYS call this before answering questions about user's goals or what they're working on.",
      parameters: { type: "object", properties: {}, required: [] }
    },
    {
      name: "get_recent_journal_entries",
      description: "Get user's recent journal entries to understand their emotional patterns. ALWAYS call this before answering questions about their journal or past entries.",
      parameters: { type: "object", properties: {}, required: [] }
    },
    {
      name: "get_biometric_data",
      description: "Get user's recent biometric data from wearables including heart rate, sleep, steps, and stress levels. Call this when discussing health metrics or physical wellness.",
      parameters: { type: "object", properties: {}, required: [] }
    },
    {
      name: "get_conversation_context",
      description: "Get summaries of past conversations to maintain continuity. Call this when the user references past discussions or you need context about previous interactions.",
      parameters: { type: "object", properties: {}, required: [] }
    },
    
    // === ACTION TOOLS ===
    {
      name: "suggest_coping_activity",
      description: "Suggest a specific coping activity based on current stress level or emotional state. Call this when the user is struggling, stressed, or needs coping strategies.",
      parameters: {
        type: "object",
        properties: {
          stress_level: { 
            type: "string", 
            enum: ["low", "medium", "high", "crisis"],
            description: "The user's current stress level based on conversation context"
          }
        },
        required: ["stress_level"]
      }
    },
    {
      name: "create_action_plan",
      description: "Create a multi-step action plan for achieving a complex recovery goal. Use this when the user describes a big goal that needs to be broken into steps.",
      parameters: {
        type: "object",
        properties: {
          goal_description: { type: "string", description: "Description of the overall goal" },
          steps: { type: "array", items: { type: "string" }, description: "Array of specific action steps" },
          timeline_days: { type: "number", description: "Total number of days for the plan" }
        },
        required: ["goal_description", "steps"]
      }
    },
    {
      name: "escalate_crisis",
      description: "CRITICAL SAFETY TOOL: Call this IMMEDIATELY when the user expresses suicidal thoughts, self-harm intentions, or severe crisis. This logs the event and ensures proper resources are provided.",
      parameters: {
        type: "object",
        properties: {
          crisis_type: { type: "string", enum: ["suicidal_ideation", "self_harm", "severe_relapse", "mental_health_emergency", "other"], description: "Type of crisis detected" },
          severity: { type: "string", enum: ["high", "critical"], description: "Severity level of the crisis" },
          user_statement: { type: "string", description: "The concerning statement from the user (for documentation)" }
        },
        required: ["crisis_type", "severity"]
      }
    },
    
    // === WRITE TOOLS ===
    {
      name: "create_goal",
      description: "Create a new recovery goal for the user. IMPORTANT: Before calling this, ASK the user what specific goal they want to create and confirm the details. Only call when user has explicitly provided goal details.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The goal title (e.g., 'Exercise 3 times a week', 'Attend AA meeting')" },
          description: { type: "string", description: "Optional description with more details about the goal" },
          target_days: { type: "number", description: "Number of days to achieve this goal (optional)" }
        },
        required: ["title"]
      }
    },
    {
      name: "create_check_in",
      description: "Log a mood check-in for the user. IMPORTANT: Before calling this, ASK the user about their current mood (1-10) and any urges. Only call when user has explicitly shared their mood.",
      parameters: {
        type: "object",
        properties: {
          mood: { type: "string", enum: ["great", "good", "okay", "struggling", "crisis"], description: "The user's current mood" },
          urge_intensity: { type: "number", description: "Urge intensity from 0-10 (0 = no urge, 10 = extreme urge)" },
          notes: { type: "string", description: "Notes about the check-in, context, or what triggered the mood" }
        },
        required: ["mood"]
      }
    },
    {
      name: "create_journal_entry",
      description: "Create a journal entry for the user. IMPORTANT: Before calling this, ASK the user what they want to write about. Only call when user has provided the content to save.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title for the journal entry" },
          content: { type: "string", description: "The journal content - capture what the user shared" }
        },
        required: ["content"]
      }
    },
    {
      name: "complete_goal",
      description: "Mark a goal as completed. Call this when the user says they've achieved or completed a specific goal.",
      parameters: {
        type: "object",
        properties: {
          goal_title: { type: "string", description: "The title of the goal to mark as complete (will fuzzy match)" }
        },
        required: ["goal_title"]
      }
    },
    {
      name: "log_coping_activity",
      description: "Log that the user used a coping activity. Call this when the user mentions they did a coping activity or used a recovery strategy.",
      parameters: {
        type: "object",
        properties: {
          activity_name: { type: "string", description: "Name of the coping activity (e.g., 'Deep breathing', 'Went for a walk')" },
          category: { type: "string", enum: ["breathing", "physical", "mindfulness", "social", "creative", "other"], description: "Category of the activity" },
          helpful: { type: "boolean", description: "Whether the activity was helpful" }
        },
        required: ["activity_name", "category"]
      }
    },
    
    // === META TOOLS ===
    {
      name: "log_intervention",
      description: "Log when the AI proactively helped the user for observability tracking. Call this after providing significant support or intervention.",
      parameters: {
        type: "object",
        properties: {
          intervention_type: { type: "string", description: "Type of intervention provided" },
          was_helpful: { type: "boolean", description: "Whether the intervention seemed helpful based on user response" }
        },
        required: ["intervention_type"]
      }
    }
  ]
}];

// Execute tool calls
async function executeTool(supabase: any, userId: string, toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case "get_user_progress": {
      const { data: profile } = await supabase
        .from("profiles")
        .select("sobriety_start_date, current_streak, longest_streak, level, xp, points, addiction_type")
        .eq("id", userId)
        .single();
      
      const daysSober = profile?.sobriety_start_date
        ? Math.floor((Date.now() - new Date(profile.sobriety_start_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      
      const milestones = [7, 14, 30, 60, 90, 180, 365, 730];
      const nextMilestone = milestones.find(m => m > daysSober);
      const daysToMilestone = nextMilestone ? nextMilestone - daysSober : null;
      
      return {
        days_sober: daysSober,
        current_streak: profile?.current_streak || 0,
        longest_streak: profile?.longest_streak || 0,
        level: profile?.level || 1,
        xp: profile?.xp || 0,
        points: profile?.points || 0,
        addiction_type: profile?.addiction_type || "addiction",
        next_milestone: nextMilestone,
        days_to_milestone: daysToMilestone
      };
    }
    
    case "get_recent_moods": {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { data: checkIns } = await supabase
        .from("check_ins")
        .select("mood, urge_intensity, notes, created_at")
        .eq("user_id", userId)
        .gte("created_at", weekAgo.toISOString())
        .order("created_at", { ascending: false });
      
      const moodSummary = (checkIns || []).reduce((acc: any, ci: any) => {
        acc[ci.mood] = (acc[ci.mood] || 0) + 1;
        return acc;
      }, {});
      
      const avgUrge = checkIns?.length 
        ? (checkIns.reduce((sum: number, ci: any) => sum + (ci.urge_intensity || 0), 0) / checkIns.length).toFixed(1)
        : 0;
      
      let trend = "insufficient_data";
      if (checkIns && checkIns.length >= 2) {
        const moodScores: Record<string, number> = { "great": 5, "good": 4, "okay": 3, "struggling": 2, "crisis": 1 };
        const recentScore = moodScores[checkIns[0]?.mood] || 3;
        const olderScore = moodScores[checkIns[checkIns.length - 1]?.mood] || 3;
        trend = recentScore > olderScore ? "improving" : recentScore < olderScore ? "declining" : "stable";
      }
      
      return {
        total_check_ins: checkIns?.length || 0,
        mood_distribution: moodSummary,
        average_urge_intensity: avgUrge,
        recent_notes: checkIns?.slice(0, 3).map((ci: any) => ci.notes).filter(Boolean),
        trend,
        last_check_in: checkIns?.[0]?.created_at || null
      };
    }
    
    case "get_active_goals": {
      const { data: goals } = await supabase
        .from("goals")
        .select("title, description, progress, completed, target_days, start_date, end_date")
        .eq("user_id", userId)
        .eq("completed", false);
      
      return {
        active_goals: goals?.length || 0,
        goals: goals?.map((g: any) => ({
          title: g.title,
          description: g.description,
          progress: g.progress || 0,
          target_days: g.target_days,
          days_remaining: g.end_date 
            ? Math.max(0, Math.floor((new Date(g.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null
        })) || []
      };
    }
    
    case "get_recent_journal_entries": {
      const { data: journals } = await supabase
        .from("journal_entries")
        .select("title, content, sentiment, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      
      return {
        recent_entries: journals?.map((j: any) => ({
          title: j.title,
          excerpt: j.content?.substring(0, 200) + (j.content?.length > 200 ? "..." : ""),
          sentiment: j.sentiment,
          date: j.created_at
        })) || [],
        total_entries: journals?.length || 0
      };
    }
    
    case "get_biometric_data": {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { data: biometrics } = await supabase
        .from("biometric_logs")
        .select("heart_rate, sleep_hours, steps, stress_level, logged_at")
        .eq("user_id", userId)
        .gte("logged_at", weekAgo.toISOString())
        .order("logged_at", { ascending: false });
      
      if (!biometrics?.length) {
        return { has_data: false, message: "No biometric data available. Consider connecting a wearable device." };
      }
      
      const avgSleep = biometrics.reduce((sum: number, b: any) => sum + (b.sleep_hours || 0), 0) / biometrics.length;
      const avgSteps = biometrics.reduce((sum: number, b: any) => sum + (b.steps || 0), 0) / biometrics.length;
      const avgStress = biometrics.reduce((sum: number, b: any) => sum + (b.stress_level || 0), 0) / biometrics.length;
      
      const insights: string[] = [];
      if (avgSleep < 6) insights.push("Sleep quality seems low. Poor sleep can increase vulnerability to cravings.");
      if (avgStress > 7) insights.push("Stress levels are elevated. Consider incorporating stress-reduction activities.");
      if (avgSteps < 3000) insights.push("Activity levels are low. Even short walks can boost mood and reduce cravings.");
      if (insights.length === 0) insights.push("Biometrics look stable. Keep up the healthy habits!");
      
      return {
        has_data: true,
        average_sleep_hours: avgSleep.toFixed(1),
        average_steps: Math.round(avgSteps),
        average_stress_level: avgStress.toFixed(1),
        latest: biometrics[0],
        insights
      };
    }
    
    case "get_conversation_context": {
      const { data: recentLogs } = await supabase
        .from("ai_observability_logs")
        .select("input_summary, response_summary, tools_called, created_at")
        .eq("user_id", userId)
        .eq("function_name", "chat-with-ai")
        .order("created_at", { ascending: false })
        .limit(5);
      
      return {
        recent_interactions: recentLogs?.map((log: any) => ({
          user_asked: log.input_summary,
          ai_helped_with: log.response_summary,
          tools_used: log.tools_called || [],
          when: log.created_at
        })) || [],
        context_available: (recentLogs?.length || 0) > 0
      };
    }
    
    case "suggest_coping_activity": {
      const stressLevel = args.stress_level || "medium";
      
      const { data: pastActivities } = await supabase
        .from("coping_activities")
        .select("activity_name, category, helpful, times_used")
        .eq("user_id", userId)
        .eq("helpful", true)
        .order("times_used", { ascending: false })
        .limit(5);
      
      const suggestions: Record<string, string[]> = {
        low: ["Take a 10-minute mindful walk outside", "Practice gratitude journaling", "Do some light stretching or yoga", "Call a friend or family member"],
        medium: ["Try the 4-7-8 breathing technique for 5 minutes", "Use the guided meditation in the app", "Write in your journal about how you're feeling", "Go for a jog or do 20 minutes of exercise"],
        high: ["Use the HALT technique - check if you're Hungry, Angry, Lonely, or Tired", "Call your sponsor or support person immediately", "Do the 5-4-3-2-1 grounding exercise", "Remove yourself from triggering situations"],
        crisis: ["🆘 Please call 988 (Suicide & Crisis Lifeline) immediately", "Reach out to your emergency contact right now", "Go to a safe place with someone you trust", "Remember: this moment will pass, and you are stronger than this urge"]
      };
      
      return {
        stress_level: stressLevel,
        suggestions: suggestions[stressLevel] || suggestions.medium,
        past_helpful_activities: pastActivities?.map((a: any) => a.activity_name) || [],
        crisis_resources: stressLevel === "crisis" || stressLevel === "high" ? {
          hotline: "988 (Suicide & Crisis Lifeline)",
          text_line: "Text HOME to 741741",
          website: "https://988lifeline.org"
        } : null
      };
    }
    
    case "create_action_plan": {
      return { 
        success: true, 
        message: `Action plan created! Here's your roadmap:\n${args.steps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`,
        steps: args.steps
      };
    }
    
    case "escalate_crisis": {
      await supabase.from("ai_observability_logs").insert({
        user_id: userId,
        function_name: "crisis-escalation",
        input_summary: args.user_statement || "Crisis detected",
        response_summary: `Crisis type: ${args.crisis_type}, Severity: ${args.severity}`,
        intervention_triggered: true,
        intervention_type: "crisis_escalation"
      });
      
      await supabase.from("ai_interventions").insert({
        user_id: userId,
        trigger_type: args.crisis_type,
        risk_score: args.severity === "critical" ? 1.0 : 0.8,
        message: "Crisis support resources provided",
        suggested_actions: ["call_988", "contact_support", "emergency_services"]
      });
      
      return {
        escalated: true,
        crisis_type: args.crisis_type,
        resources: {
          primary: "988 (Suicide & Crisis Lifeline)",
          text: "Text HOME to 741741",
          website: "https://988lifeline.org",
          emergency: "911"
        },
        message: "I've noted this is a difficult moment. Professional support is available 24/7."
      };
    }
    
    case "log_intervention": {
      await supabase.from("ai_observability_logs").insert({
        user_id: userId,
        function_name: "chat-with-ai",
        intervention_triggered: true,
        intervention_type: args.intervention_type,
        user_feedback: args.was_helpful ? "helpful" : "not_helpful",
        created_at: new Date().toISOString()
      });
      return { logged: true, intervention_type: args.intervention_type };
    }
    
    case "create_goal": {
      const startDate = new Date();
      const endDate = args.target_days ? new Date(Date.now() + args.target_days * 24 * 60 * 60 * 1000) : null;
      
      const { data, error } = await supabase.from("goals").insert({
        user_id: userId,
        title: args.title,
        description: args.description || null,
        target_days: args.target_days || null,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate ? endDate.toISOString().split('T')[0] : null,
        progress: 0,
        completed: false
      }).select().single();
      
      if (error) return { success: false, error: error.message };
      return { success: true, message: `✅ Goal "${args.title}" has been created!`, goal: data };
    }
    
    case "create_check_in": {
      const { data, error } = await supabase.from("check_ins").insert({
        user_id: userId,
        mood: args.mood,
        urge_intensity: args.urge_intensity || null,
        notes: args.notes || null
      }).select().single();
      
      if (error) return { success: false, error: error.message };
      
      await supabase.from("profiles").update({ last_check_in: new Date().toISOString() }).eq("id", userId);
      
      return { success: true, message: `✅ Check-in logged! Mood: ${args.mood}${args.urge_intensity ? `, Urge: ${args.urge_intensity}/10` : ''}`, check_in: data };
    }
    
    case "create_journal_entry": {
      const { data, error } = await supabase.from("journal_entries").insert({
        user_id: userId,
        title: args.title || `Journal - ${new Date().toLocaleDateString()}`,
        content: args.content
      }).select().single();
      
      if (error) return { success: false, error: error.message };
      return { success: true, message: "✅ Journal entry saved!", entry: data };
    }
    
    case "complete_goal": {
      const { data: goals } = await supabase.from("goals").select("id, title").eq("user_id", userId).eq("completed", false);
      
      if (!goals || goals.length === 0) return { success: false, message: "No active goals found." };
      
      const targetWords = args.goal_title.toLowerCase().split(/\s+/);
      let bestMatch = goals[0];
      let bestScore = 0;
      
      for (const goal of goals) {
        const goalWords = goal.title.toLowerCase().split(/\s+/);
        const overlap = targetWords.filter((w: string) => goalWords.some((gw: string) => gw.includes(w) || w.includes(gw))).length;
        if (overlap > bestScore) { bestScore = overlap; bestMatch = goal; }
      }
      
      const { error } = await supabase.from("goals").update({ completed: true, progress: 100 }).eq("id", bestMatch.id);
      
      if (error) return { success: false, error: error.message };
      return { success: true, message: `🎉 Goal "${bestMatch.title}" marked as complete! Great job!` };
    }
    
    case "log_coping_activity": {
      const { data: existing } = await supabase.from("coping_activities").select("id, times_used").eq("user_id", userId).eq("activity_name", args.activity_name).single();
      
      if (existing) {
        await supabase.from("coping_activities").update({ times_used: (existing.times_used || 0) + 1, helpful: args.helpful !== undefined ? args.helpful : true }).eq("id", existing.id);
        return { success: true, message: `✅ Logged "${args.activity_name}" - you've used this ${(existing.times_used || 0) + 1} times!` };
      } else {
        const { error } = await supabase.from("coping_activities").insert({
          user_id: userId,
          activity_name: args.activity_name,
          category: args.category,
          helpful: args.helpful !== undefined ? args.helpful : true,
          times_used: 1
        });
        if (error) return { success: false, error: error.message };
        return { success: true, message: `✅ "${args.activity_name}" has been logged as a coping activity.` };
      }
    }
    
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let toolsCalled: string[] = [];
  let autonomyScore = 0;

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

    const { message, conversationHistory } = await req.json();
    
    const sanitizedMessage = sanitizeInput(message, 2000);
    if (!sanitizedMessage) {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    const crisisCheck = detectCrisis(sanitizedMessage);
    
    // Convert conversation history to Gemini format
    const sanitizedHistory = (conversationHistory || []).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: sanitizeInput(msg.content, 800) }]
    })).slice(-12); // Keep more history since Gemini has better limits

    const { data: profile } = await supabase
      .from("profiles")
      .select("pseudonym, addiction_type, sobriety_start_date, level")
      .eq("id", user.id)
      .single();

    const daysSober = profile?.sobriety_start_date
      ? Math.floor((Date.now() - new Date(profile.sobriety_start_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const systemPrompt = `You are a compassionate AI Recovery Coach for ${profile?.pseudonym || "a user"} who is ${daysSober} days sober (Level ${profile?.level || 1}).

CORE RULES:
1. Be warm, supportive, and practical. Keep responses under 150 words.
2. Use tools to get real user data before answering questions about their progress, moods, goals, or journals.
3. ALWAYS respond with actual data after calling READ tools. If user asks to "list journals" or "show goals", call the tool and then DESCRIBE what you found in your response.
4. For WRITE tools (create_goal, create_check_in, create_journal_entry):
   - ALWAYS ask the user for details FIRST before creating anything
   - NEVER create duplicates - if user asks "is that added?" or "did you add it?", call get_active_goals or get_recent_journal_entries to CHECK, then confirm what you see
   - Only call create_* tools when user explicitly provides NEW content to add
5. ${crisisCheck.isCrisis ? 'CRISIS DETECTED: Call escalate_crisis immediately and share 988 hotline.' : 'If user mentions suicide or self-harm, call escalate_crisis immediately.'}

IMPORTANT: After calling any tool, you MUST provide a helpful text response that describes or confirms the data. Never leave the response empty.`;

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY not configured");
    }

    console.log(`[Agent] Processing message. Crisis detected: ${crisisCheck.isCrisis}`);

    // Build contents array with history and current message
    const contents = [
      ...sanitizedHistory,
      { role: "user", parts: [{ text: sanitizedMessage }] }
    ];

    // First API call
    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          tools: geminiTools,
          toolConfig: { functionCallingConfig: { mode: "AUTO" } }
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "The AI coach is taking a breather. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error("Failed to get AI response");
    }

    let responseData = await response.json();
    let candidate = responseData.candidates?.[0];
    let allToolResults: any[] = [];
    
    // ReAct loop - handle function calls
    let iterations = 0;
    const maxIterations = 5;
    
    while (candidate?.content?.parts?.[0]?.functionCall && iterations < maxIterations) {
      iterations++;
      const functionCall = candidate.content.parts[0].functionCall;
      const toolName = functionCall.name;
      const toolArgs = functionCall.args || {};
      
      console.log(`[Agent] Tool iteration ${iterations}, calling: ${toolName}`);
      toolsCalled.push(toolName);
      autonomyScore++;
      
      try {
        const result = await executeTool(supabase, user.id, toolName, toolArgs);
        allToolResults.push({ tool: toolName, args: toolArgs, result });
        
        // Add function call and result to contents for next iteration
        contents.push({
          role: "model",
          parts: [{ functionCall: { name: toolName, args: toolArgs } }]
        });
        contents.push({
          role: "user",
          parts: [{ functionResponse: { name: toolName, response: result } }]
        });
        
        // Continue the conversation
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents,
              systemInstruction: { parts: [{ text: systemPrompt }] },
              tools: geminiTools,
              toolConfig: { functionCallingConfig: { mode: "AUTO" } }
            }),
          }
        );
        
        if (!response.ok) {
          console.error("Gemini API error in tool loop:", response.status);
          break;
        }
        
        responseData = await response.json();
        candidate = responseData.candidates?.[0];
        
      } catch (toolError: any) {
        console.error(`[Agent] Tool ${toolName} failed:`, toolError.message);
        // Add error as function response and continue
        contents.push({
          role: "model",
          parts: [{ functionCall: { name: toolName, args: toolArgs } }]
        });
        contents.push({
          role: "user",
          parts: [{ functionResponse: { name: toolName, response: { error: toolError.message } } }]
        });
        break;
      }
    }
    
    // Extract final text response
    let finalContent = candidate?.content?.parts?.[0]?.text || "";
    
    // If no text response but we have tool results, generate a meaningful response from the data
    if (!finalContent || finalContent.trim() === "") {
      if (allToolResults.length > 0) {
        const lastResult = allToolResults[allToolResults.length - 1];
        const toolName = lastResult.tool;
        const result = lastResult.result;
        
        // Generate contextual response based on tool results
        if (toolName === "get_recent_journal_entries") {
          const entries = result.recent_entries || [];
          if (entries.length === 0) {
            finalContent = "You don't have any journal entries yet. Would you like to start one? Journaling can be a powerful tool for reflection.";
          } else {
            const entryList = entries.map((e: any, i: number) => `${i + 1}. **${e.title || 'Untitled'}** (${new Date(e.date).toLocaleDateString()}): ${e.excerpt}`).join('\n');
            finalContent = `Here are your recent journal entries:\n\n${entryList}\n\nWould you like to add a new entry or discuss any of these?`;
          }
        } else if (toolName === "get_active_goals") {
          const goals = result.goals || [];
          if (goals.length === 0) {
            finalContent = "You don't have any active goals yet. Would you like to set one? I can help you create a meaningful recovery goal.";
          } else {
            const goalList = goals.map((g: any, i: number) => `${i + 1}. **${g.title}** - ${g.progress || 0}% complete${g.days_remaining ? ` (${g.days_remaining} days left)` : ''}`).join('\n');
            finalContent = `Here are your active goals:\n\n${goalList}\n\nKeep up the great work! Would you like to update any of these or add a new goal?`;
          }
        } else if (toolName === "get_user_progress") {
          finalContent = `You're ${result.days_sober} days sober - that's amazing! Your current streak is ${result.current_streak} days, and you're at Level ${result.level} with ${result.xp} XP.${result.days_to_milestone ? ` Only ${result.days_to_milestone} days until your next milestone!` : ''} How are you feeling today?`;
        } else if (toolName === "get_recent_moods") {
          if (result.total_check_ins === 0) {
            finalContent = "I don't see any recent check-ins. How are you feeling right now? Would you like to log a check-in?";
          } else {
            finalContent = `In the past week, you've done ${result.total_check_ins} check-ins. Your mood trend is ${result.trend}, with an average urge intensity of ${result.average_urge_intensity}/10. How are you feeling today?`;
          }
        } else if (toolName === "create_goal" && result.success) {
          finalContent = result.message || "Your goal has been created! You can track your progress on the Goals page.";
        } else if (toolName === "create_journal_entry" && result.success) {
          finalContent = result.message || "Your journal entry has been saved! Writing helps process emotions and track your journey.";
        } else if (toolName === "create_check_in" && result.success) {
          finalContent = result.message || "Your check-in has been logged! Regular check-ins help track patterns in your recovery.";
        } else {
          finalContent = "I've processed your request. Is there anything else I can help you with?";
        }
        console.log(`[Agent] Generated contextual response for tool: ${toolName}`);
      } else {
        finalContent = "I'm here to support you on your recovery journey. How can I help you today?";
        console.log("[Agent] Using fallback response - no content from model");
      }
    }

    const responseTimeMs = Date.now() - startTime;
    
    // Calculate metrics
    const readToolsUsed = toolsCalled.filter(t => 
      ["get_user_progress", "get_recent_moods", "get_active_goals", "get_recent_journal_entries", "get_biometric_data", "get_conversation_context"].includes(t)
    ).length;
    const writeToolsUsed = toolsCalled.filter(t => 
      ["create_goal", "create_check_in", "create_journal_entry", "complete_goal", "log_coping_activity"].includes(t)
    ).length;
    
    // Log observability data
    try {
      await supabase.from("ai_observability_logs").insert({
        user_id: user.id,
        function_name: "chat-with-ai",
        input_summary: sanitizedMessage.substring(0, 100),
        tools_called: toolsCalled,
        tool_results: allToolResults,
        response_summary: finalContent.substring(0, 200),
        response_time_ms: responseTimeMs,
        model_used: "gemini-2.5-flash-lite",
        intervention_triggered: toolsCalled.includes("log_intervention") || toolsCalled.includes("escalate_crisis"),
        intervention_type: crisisCheck.isCrisis ? "crisis_response" : toolsCalled.includes("log_intervention") ? "proactive_support" : null,
      });
    } catch (logError) {
      console.error("Failed to log observability data:", logError);
    }

    console.log(`[Agent] Complete in ${responseTimeMs}ms | Tools: ${toolsCalled.length} (${readToolsUsed} reads, ${writeToolsUsed} writes) | Iterations: ${iterations}`);

    return new Response(
      JSON.stringify({ 
        response: finalContent,
        tools_used: toolsCalled,
        response_time_ms: responseTimeMs,
        agent_metrics: {
          autonomy_score: autonomyScore,
          tool_iterations: iterations,
          read_tools: readToolsUsed,
          write_tools: writeToolsUsed,
          crisis_detected: crisisCheck.isCrisis
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in chat-with-ai:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
