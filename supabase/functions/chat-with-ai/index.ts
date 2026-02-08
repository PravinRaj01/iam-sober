/**
 * AI COACH - Multi-Model Router Architecture with ReAct Agent
 * 
 * Architecture: 3-Layer Router
 * Layer 1: Intent Router (Groq Llama 3.1 8B) - ~100-200ms classification
 * Layer 2: Specialist Agents:
 *   - Chat Agent (Cerebras Llama 3.3 70B) - fast conversation, no tools
 *   - Data/Action/Support Agents (Groq Llama 3.3 70B) - PRIMARY tool-calling
 * Layer 3: Fallback (Gemini 2.5 Flash Lite) - when Groq fails/429s
 * 
 * FEATURES:
 * ✅ Intent-based routing for optimal latency
 * ✅ Tool-subset selection (3-9 tools vs all)
 * ✅ Multi-model fallback chain (Groq -> Gemini -> static)
 * ✅ Crisis detection (never skipped)
 * ✅ Full observability with routing metrics
 * ✅ tool_choice: "required" for data/action routes (anti-hallucination)
 * ✅ Response sanitization for tool text leaks
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

function sanitizeInput(input: string, maxLength: number = 5000): string {
  if (!input || typeof input !== 'string') return '';
  let sanitized = input.slice(0, maxLength).trim();
  const dangerousPatterns = [
    /system:/gi, /assistant:/gi, /<\|im_start\|>/gi, /<\|im_end\|>/gi,
    /\[INST\]/gi, /\[\/INST\]/gi, /<s>/gi, /<\/s>/gi,
  ];
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }
  return sanitized;
}

// ============================================================
// LANGUAGE DETECTION
// ============================================================

function detectLanguage(message: string, preferredLanguage?: string): "en" | "ms" | "ta" {
  // Priority 1: User profile preference
  if (preferredLanguage && ["en", "ms", "ta"].includes(preferredLanguage)) {
    return preferredLanguage as "en" | "ms" | "ta";
  }

  // Priority 2: Tamil script detection (U+0B80-U+0BFF)
  const tamilScriptRegex = /[\u0B80-\u0BFF]/;
  if (tamilScriptRegex.test(message)) return "ta";

  // Priority 3: Malay keyword detection
  const malayKeywords = ["saya", "aku", "kamu", "awak", "nak", "boleh", "tak", "tidak", "macam", "mana", "kenapa", "bagaimana", "terima kasih", "tolong", "lah", "kan", "buat", "hari", "sudah"];
  const lowerMsg = message.toLowerCase();
  const malayCount = malayKeywords.filter(kw => lowerMsg.includes(kw)).length;
  if (malayCount >= 2) return "ms";

  // Priority 4: Tamil romanized (Tanglish) keyword detection
  const tamilRomanKeywords = ["naan", "nee", "enna", "epdi", "romba", "thala", "nanba", "panna", "vaanga", "sollu", "theriyum", "theriyala", "aamam", "illai", "nandri", "pomozhuthu"];
  const tamilRomanCount = tamilRomanKeywords.filter(kw => lowerMsg.includes(kw)).length;
  if (tamilRomanCount >= 2) return "ta";

  return "en";
}

function getLanguageSystemPromptAddition(lang: "en" | "ms" | "ta"): string {
  switch (lang) {
    case "ms":
      return "\n\nLANGUAGE: Respond in Bahasa Melayu or Manglish. Be warm and use local expressions like 'lah', 'kan'. If the user writes in Malay, always reply in Malay.";
    case "ta":
      return "\n\nLANGUAGE: Respond in Tamil script or Tanglish (romanized Tamil). Use culturally appropriate references. If the user writes in Tamil, always reply in Tamil.";
    default:
      return "";
  }
}

// ============================================================
// SEA-LION REGIONAL MODEL - Malay & Tamil (tools + chat)
// ============================================================

async function callSeaLionWithTools(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: any[],
  tools: any[],
  toolChoiceMode: "auto" | "required" = "auto"
): Promise<{ content: string | null; toolCalls: any[] | null }> {
  const SEALION_API_KEY = Deno.env.get("SEALION_API_KEY");
  if (!SEALION_API_KEY) {
    console.warn("[SEA-LION] SEALION_API_KEY not set");
    return { content: null, toolCalls: null };
  }

  try {
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10).map((msg: any) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      })),
      { role: "user", content: userMessage }
    ];

    const body: any = {
      model: "aisingapore/Gemma-SEA-LION-v4-27B-IT",
      messages,
      max_tokens: 500,
      temperature: 0.7,
    };

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = toolChoiceMode;
    }

    const response = await fetch("https://api.sea-lion.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SEALION_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[SEA-LION] Error ${response.status}: ${errText}`);
      return { content: null, toolCalls: null };
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message;
    return {
      content: choice?.content || null,
      toolCalls: choice?.tool_calls || null
    };
  } catch (error) {
    console.error("[SEA-LION] Failed:", error);
    return { content: null, toolCalls: null };
  }
}

async function callSeaLionChat(
  systemPrompt: string,
  message: string,
  conversationHistory: any[]
): Promise<string | null> {
  const result = await callSeaLionWithTools(systemPrompt, message, conversationHistory, []);
  return result.content;
}

// ============================================================
// SARVAM-M - Tamil Deep Reasoning (chat only, Thinking Mode)
// ============================================================

async function callSarvamChat(
  systemPrompt: string,
  message: string,
  conversationHistory: any[]
): Promise<string | null> {
  const SARVAM_API_KEY = Deno.env.get("SARVAM_API_KEY");
  if (!SARVAM_API_KEY) {
    console.warn("[Sarvam] SARVAM_API_KEY not set");
    return null;
  }

  try {
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10).map((msg: any) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      })),
      { role: "user", content: message }
    ];

    const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": SARVAM_API_KEY,
      },
      body: JSON.stringify({
        model: "sarvam-m",
        messages,
        max_tokens: 500,
        temperature: 0.7,
        reasoning_effort: "medium",
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[Sarvam] Error ${response.status}: ${errText}`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error("[Sarvam] Failed:", error);
    return null;
  }
}

function detectCrisis(message: string): { isCrisis: boolean; matchedKeywords: string[] } {
  const lowerMessage = message.toLowerCase();
  const matchedKeywords = CRISIS_KEYWORDS.filter(keyword => lowerMessage.includes(keyword));
  return { isCrisis: matchedKeywords.length > 0, matchedKeywords };
}

// Sanitize AI output to remove internal reasoning leaks and XML tags
function sanitizeOutput(text: string): string {
  return text
    // Strip raw XML function tags
    .replace(/<function[^>]*>[\s\S]*?<\/function>/gi, '')
    .replace(/<function=[^>]*>/gi, '')
    .replace(/<\/function>/gi, '')
    // Strip internal reasoning like "READ check_ins READ goals"
    .replace(/^(READ|WRITE|CALL)\s+\w+(\s+(READ|WRITE|CALL)\s+\w+)*$/gm, '')
    // Strip tool-name-only lines
    .replace(/^(get_\w+|create_\w+|edit_\w+|update_\w+|delete_\w+|complete_\w+|log_\w+|suggest_\w+|escalate_\w+)\s*$/gm, '')
    // Clean up multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================
// TOOL DEFINITIONS - Split by agent category
// ============================================================

const dataToolDeclarations = [
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
  {
    name: "analyze_mood_trend",
    description: "Analyze user's mood history over 14-30 days to predict risk windows and detect patterns. Call this when user asks about mood trends, risk prediction, or pattern analysis.",
    parameters: { type: "object", properties: { days: { type: "number", description: "Number of days to analyze (default 14, max 30)" } }, required: [] }
  },
  {
    name: "fetch_wearable_insights",
    description: "Correlate biometric data (sleep, steps, stress, heart rate) with mood data to generate holistic health-recovery insights. Call when user asks about health correlations or wearable insights.",
    parameters: { type: "object", properties: {}, required: [] }
  },
  {
    name: "summarize_weekly_progress",
    description: "Generate a narrative summary of the user's week including check-ins, goals, journal entries, and streaks. Call when user asks for a weekly summary or progress report.",
    parameters: { type: "object", properties: {}, required: [] }
  },
];

const actionToolDeclarations = [
  {
    name: "create_goal",
    description: "Create a new recovery goal for the user. IMPORTANT: Before calling this, ASK the user what specific goal they want to create and confirm the details.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "The goal title" },
        description: { type: "string", description: "Optional description" },
        target_days: { type: "number", description: "Number of days to achieve this goal" }
      },
      required: ["title"]
    }
  },
  {
    name: "create_check_in",
    description: "Log a mood check-in for the user. IMPORTANT: Before calling this, ASK the user about their current mood and any urges.",
    parameters: {
      type: "object",
      properties: {
        mood: { type: "string", enum: ["great", "good", "okay", "struggling", "crisis"], description: "The user's current mood" },
        urge_intensity: { type: "number", description: "Urge intensity from 0-10" },
        notes: { type: "string", description: "Notes about the check-in" }
      },
      required: ["mood"]
    }
  },
  {
    name: "create_journal_entry",
    description: "Create a journal entry for the user. IMPORTANT: Before calling this, ASK the user what they want to write about.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title for the journal entry" },
        content: { type: "string", description: "The journal content" }
      },
      required: ["content"]
    }
  },
  {
    name: "complete_goal",
    description: "Mark a goal as completed. Call this when the user says they've achieved a specific goal.",
    parameters: {
      type: "object",
      properties: {
        goal_title: { type: "string", description: "The title of the goal to mark as complete" }
      },
      required: ["goal_title"]
    }
  },
  {
    name: "log_coping_activity",
    description: "Log that the user used a coping activity.",
    parameters: {
      type: "object",
      properties: {
        activity_name: { type: "string", description: "Name of the coping activity" },
        category: { type: "string", enum: ["breathing", "physical", "mindfulness", "social", "creative", "other"] },
        helpful: { type: "boolean", description: "Whether the activity was helpful" }
      },
      required: ["activity_name", "category"]
    }
  },
  // --- Edit/Delete tools (CONFIRMATION REQUIRED) ---
  {
    name: "edit_journal_entry",
    description: "Edit an existing journal entry by matching its title. CRITICAL: Do NOT call this tool until the user has explicitly told you WHAT to change (new title or new content). If they just say 'edit' or 'change', you MUST ask them what the new content or title should be FIRST. NEVER invent or assume new content.",
    parameters: {
      type: "object",
      properties: {
        entry_title: { type: "string", description: "The current title of the journal entry to edit (fuzzy matched)" },
        new_title: { type: "string", description: "New title for the entry (optional)" },
        new_content: { type: "string", description: "New content for the entry (optional)" }
      },
      required: ["entry_title"]
    }
  },
  {
    name: "delete_journal_entry",
    description: "Delete a journal entry by matching its title. CRITICAL: Do NOT call this tool until the user has explicitly CONFIRMED deletion. First tell the user which entry will be deleted and ask 'Are you sure you want to delete this?'. Only call this tool AFTER the user confirms with yes/sure/confirm/do it.",
    parameters: {
      type: "object",
      properties: {
        entry_title: { type: "string", description: "The title of the journal entry to delete (fuzzy matched)" }
      },
      required: ["entry_title"]
    }
  },
  {
    name: "update_goal",
    description: "Update an existing goal's title, description, or target days. CRITICAL: Do NOT call this tool until the user has explicitly told you WHAT to change. If they just say 'update' or 'edit my goal', you MUST ask what they want to change FIRST. NEVER invent or assume new values.",
    parameters: {
      type: "object",
      properties: {
        goal_title: { type: "string", description: "The current title of the goal to update (fuzzy matched)" },
        new_title: { type: "string", description: "New title for the goal (optional)" },
        new_description: { type: "string", description: "New description for the goal (optional)" },
        new_target_days: { type: "number", description: "New target days for the goal (optional)" }
      },
      required: ["goal_title"]
    }
  },
  {
    name: "delete_goal",
    description: "Delete a goal by matching its title. CRITICAL: Do NOT call this tool until the user has explicitly CONFIRMED deletion. First tell the user which goal will be deleted and ask 'Are you sure?'. Only call this tool AFTER the user confirms with yes/sure/confirm/do it.",
    parameters: {
      type: "object",
      properties: {
        goal_title: { type: "string", description: "The title of the goal to delete (fuzzy matched)" }
      },
      required: ["goal_title"]
    }
  },
  {
    name: "schedule_reminder",
    description: "Create a custom reminder or suggestion for the user. Call when user wants to set a reminder or schedule something.",
    parameters: { type: "object", properties: { title: { type: "string", description: "Reminder title" }, message: { type: "string", description: "Reminder message" }, suggested_time: { type: "string", description: "Suggested time (e.g., 'morning', 'evening')" } }, required: ["title", "message"] }
  },
  {
    name: "generate_relapse_prevention_plan",
    description: "Build a personalized relapse prevention plan based on user's trigger history, past relapses, and successful coping activities. Call when user asks for a prevention plan.",
    parameters: { type: "object", properties: { focus_area: { type: "string", description: "Specific trigger or situation to focus on (optional)" } }, required: [] }
  },
];

const supportToolDeclarations = [
  {
    name: "suggest_coping_activity",
    description: "Suggest a specific coping activity based on current stress level or emotional state.",
    parameters: {
      type: "object",
      properties: {
        stress_level: { type: "string", enum: ["low", "medium", "high", "crisis"], description: "Current stress level" }
      },
      required: ["stress_level"]
    }
  },
  {
    name: "create_action_plan",
    description: "Create a multi-step action plan for achieving a complex recovery goal.",
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
    description: "CRITICAL SAFETY TOOL: Call this IMMEDIATELY when the user expresses suicidal thoughts, self-harm intentions, or severe crisis.",
    parameters: {
      type: "object",
      properties: {
        crisis_type: { type: "string", enum: ["suicidal_ideation", "self_harm", "severe_relapse", "mental_health_emergency", "other"] },
        severity: { type: "string", enum: ["high", "critical"] },
        user_statement: { type: "string", description: "The concerning statement from the user" }
      },
      required: ["crisis_type", "severity"]
    }
  },
  {
    name: "log_intervention",
    description: "Log when the AI proactively helped the user for observability tracking.",
    parameters: {
      type: "object",
      properties: {
        intervention_type: { type: "string", description: "Type of intervention provided" },
        was_helpful: { type: "boolean", description: "Whether the intervention seemed helpful" }
      },
      required: ["intervention_type"]
    }
  },
  {
    name: "get_community_support_matches",
    description: "Find community members with similar recovery journeys for peer support. Call when user wants to find support buddies or mentors.",
    parameters: { type: "object", properties: {}, required: [] }
  },
  {
    name: "translate_response",
    description: "Signal that the response should be translated to the user's preferred language. Use when language switching is needed mid-conversation.",
    parameters: { type: "object", properties: { target_language: { type: "string", enum: ["en", "ms", "ta"], description: "Target language code" }, text: { type: "string", description: "Text to contextualize" } }, required: ["target_language"] }
  },
];

// Build Gemini-format tool groups
function getGeminiTools(category: string) {
  let declarations;
  switch (category) {
    case "data": declarations = dataToolDeclarations; break;
    case "action": declarations = [...actionToolDeclarations]; break;
    case "support": declarations = [...supportToolDeclarations]; break;
    default: declarations = [...dataToolDeclarations, ...actionToolDeclarations, ...supportToolDeclarations]; break;
  }
  return [{ functionDeclarations: declarations }];
}

// Convert to OpenAI-format tools for Groq
function getOpenAITools(category: string) {
  let declarations;
  switch (category) {
    case "data": declarations = dataToolDeclarations; break;
    case "action": declarations = [...actionToolDeclarations]; break;
    case "support": declarations = [...supportToolDeclarations]; break;
    default: declarations = [...dataToolDeclarations, ...actionToolDeclarations, ...supportToolDeclarations]; break;
  }
  return declarations.map(d => ({
    type: "function" as const,
    function: {
      name: d.name,
      description: d.description,
      parameters: d.parameters
    }
  }));
}

// ============================================================
// INTENT ROUTER - Groq Llama 3.1 8B
// ============================================================

async function classifyIntent(message: string, crisisDetected: boolean): Promise<string> {
  if (crisisDetected) return "support";

  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  if (!GROQ_API_KEY) {
    console.warn("[Router] GROQ_API_KEY not set, falling back to all-tools mode");
    return "all";
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `Classify the user message into exactly ONE category. Respond with ONLY the category word, nothing else.

Categories:
- data: User asks about their progress, stats, moods, goals, journals, biometrics, history, mood trends, weekly summary, wearable insights, or wants to LIST/VIEW/CHECK/ANALYZE existing entries
- action: User wants to create, update, edit, delete, complete, log, schedule, or plan something (goals, check-ins, journal entries, coping activities, reminders, prevention plans)
- support: User is struggling emotionally, needs coping strategies, is in crisis, needs an action plan, wants peer support, or needs community connections
- chat: General conversation, greetings, motivation, questions about recovery, or anything not fitting above categories`
          },
          { role: "user", content: message }
        ],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error(`[Router] Groq error ${response.status}`);
      return "all";
    }

    const data = await response.json();
    const category = (data.choices?.[0]?.message?.content || "").trim().toLowerCase();
    
    if (["data", "action", "support", "chat"].includes(category)) {
      console.log(`[Router] Classified as: ${category}`);
      return category;
    }
    
    console.warn(`[Router] Unknown category "${category}", using all`);
    return "all";
  } catch (error) {
    console.error("[Router] Classification failed:", error);
    return "all";
  }
}

// ============================================================
// CEREBRAS CHAT AGENT - Fast conversation, no tools
// ============================================================

async function callCerebrasChat(
  systemPrompt: string,
  message: string,
  conversationHistory: any[]
): Promise<string | null> {
  const CEREBRAS_API_KEY = Deno.env.get("CEREBRAS_API_KEY");
  if (!CEREBRAS_API_KEY) {
    console.warn("[CerebrasChat] CEREBRAS_API_KEY not set");
    return null;
  }

  try {
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10).map((msg: any) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      })),
      { role: "user", content: message }
    ];

    const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CEREBRAS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b",
        messages,
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[CerebrasChat] Error ${response.status}: ${errText}`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error("[CerebrasChat] Failed:", error);
    return null;
  }
}

// ============================================================
// GROQ PRIMARY WORKER - Tool calling (Llama 3.3 70B)
// ============================================================

async function callGroqWithTools(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: any[],
  tools: any[],
  toolChoiceMode: "auto" | "required" = "auto"
): Promise<{ content: string | null; toolCalls: any[] | null }> {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  if (!GROQ_API_KEY) {
    console.warn("[GroqPrimary] GROQ_API_KEY not set");
    return { content: null, toolCalls: null };
  }

  try {
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10).map((msg: any) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      })),
      { role: "user", content: userMessage }
    ];

    const body: any = {
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 500,
      temperature: 0.7,
    };
    
    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = toolChoiceMode;
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[GroqPrimary] Error ${response.status}: ${errText}`);
      return { content: null, toolCalls: null };
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message;
    
    return {
      content: choice?.content || null,
      toolCalls: choice?.tool_calls || null
    };
  } catch (error) {
    console.error("[GroqPrimary] Failed:", error);
    return { content: null, toolCalls: null };
  }
}

// Get follow-up response from Groq after tool execution
async function getGroqFollowUp(
  systemPrompt: string,
  userMessage: string,
  toolCalls: any[],
  toolResults: any[]
): Promise<string> {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  if (!GROQ_API_KEY) return "";

  try {
    const followUpMessages: any[] = [
      { 
        role: "system", 
        content: systemPrompt + "\n\nCRITICAL: The tool results below contain REAL user data from the database. Use ONLY this data in your response. Do NOT invent, fabricate, or hallucinate any entries, goals, check-ins, or journal data. If the tool returned empty results, say there are none."
      },
      { role: "user", content: userMessage },
      {
        role: "assistant",
        tool_calls: toolCalls.map((tc: any) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.function.name, arguments: tc.function.arguments }
        }))
      },
      ...toolResults.map((tr, i) => ({
        role: "tool",
        tool_call_id: toolCalls[i]?.id || `call_${i}`,
        content: JSON.stringify(tr.result)
      }))
    ];

    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: followUpMessages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      return data.choices?.[0]?.message?.content || "";
    }
    return "";
  } catch (e) {
    console.error("[GroqPrimary] Follow-up failed:", e);
    return "";
  }
}

// ============================================================
// GEMINI FALLBACK WORKER - When Groq fails
// ============================================================

async function callGeminiWithTools(
  systemPrompt: string,
  contents: any[],
  tools: any[],
  apiKey: string
): Promise<{ ok: boolean; status: number; data?: any }> {
  const body: any = {
    contents,
    systemInstruction: { parts: [{ text: systemPrompt }] },
  };
  if (tools.length > 0) {
    body.tools = tools;
    body.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const data = await response.json();
  return { ok: true, status: 200, data };
}

// ============================================================
// FUZZY TITLE MATCHING - Shared helper for edit/delete tools
// ============================================================

function fuzzyMatchTitle(items: any[], targetTitle: string): any | null {
  if (!items || items.length === 0) return null;
  
  const targetWords = targetTitle.toLowerCase().split(/\s+/);
  let bestMatch = items[0];
  let bestScore = 0;

  for (const item of items) {
    const itemTitle = (item.title || "").toLowerCase();
    // Exact match
    if (itemTitle === targetTitle.toLowerCase()) return item;
    
    const itemWords = itemTitle.split(/\s+/);
    const overlap = targetWords.filter((w: string) => 
      itemWords.some((iw: string) => iw.includes(w) || w.includes(iw))
    ).length;
    if (overlap > bestScore) { bestScore = overlap; bestMatch = item; }
  }

  return bestScore > 0 ? bestMatch : items[0];
}

// ============================================================
// TOOL EXECUTOR - Handles all tool calls regardless of model
// ============================================================

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
      
      return {
        days_sober: daysSober,
        current_streak: profile?.current_streak || 0,
        longest_streak: profile?.longest_streak || 0,
        level: profile?.level || 1,
        xp: profile?.xp || 0,
        points: profile?.points || 0,
        addiction_type: profile?.addiction_type || "addiction",
        next_milestone: nextMilestone,
        days_to_milestone: nextMilestone ? nextMilestone - daysSober : null
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
      
      const match = fuzzyMatchTitle(goals, args.goal_title);
      const { error } = await supabase.from("goals").update({ completed: true, progress: 100 }).eq("id", match.id);
      if (error) return { success: false, error: error.message };
      return { success: true, message: `🎉 Goal "${match.title}" marked as complete! Great job!` };
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

    // --- NEW: Edit/Delete tools ---
    case "edit_journal_entry": {
      const { data: entries } = await supabase
        .from("journal_entries")
        .select("id, title, content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (!entries || entries.length === 0) return { success: false, message: "No journal entries found to edit." };
      
      const match = fuzzyMatchTitle(entries, args.entry_title);
      const updates: any = {};
      if (args.new_title) updates.title = args.new_title;
      if (args.new_content) updates.content = args.new_content;
      updates.updated_at = new Date().toISOString();
      
      const { error } = await supabase.from("journal_entries").update(updates).eq("id", match.id);
      if (error) return { success: false, error: error.message };
      return { success: true, message: `✅ Journal entry "${match.title}" has been updated!` };
    }

    case "delete_journal_entry": {
      const { data: entries } = await supabase
        .from("journal_entries")
        .select("id, title")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (!entries || entries.length === 0) return { success: false, message: "No journal entries found to delete." };
      
      const match = fuzzyMatchTitle(entries, args.entry_title);
      const { error } = await supabase.from("journal_entries").delete().eq("id", match.id);
      if (error) return { success: false, error: error.message };
      return { success: true, message: `🗑️ Journal entry "${match.title}" has been deleted.` };
    }

    case "update_goal": {
      const { data: goals } = await supabase
        .from("goals")
        .select("id, title, description, target_days")
        .eq("user_id", userId)
        .eq("completed", false);
      
      if (!goals || goals.length === 0) return { success: false, message: "No active goals found to update." };
      
      const match = fuzzyMatchTitle(goals, args.goal_title);
      const updates: any = {};
      if (args.new_title) updates.title = args.new_title;
      if (args.new_description) updates.description = args.new_description;
      if (args.new_target_days) {
        updates.target_days = args.new_target_days;
        updates.end_date = new Date(Date.now() + args.new_target_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
      
      const { error } = await supabase.from("goals").update(updates).eq("id", match.id);
      if (error) return { success: false, error: error.message };
      return { success: true, message: `✅ Goal "${match.title}" has been updated!` };
    }

    case "delete_goal": {
      const { data: goals } = await supabase
        .from("goals")
        .select("id, title")
        .eq("user_id", userId);
      
      if (!goals || goals.length === 0) return { success: false, message: "No goals found to delete." };
      
      const match = fuzzyMatchTitle(goals, args.goal_title);
      // Delete completions first (FK constraint)
      await supabase.from("goal_completions").delete().eq("goal_id", match.id);
      const { error } = await supabase.from("goals").delete().eq("id", match.id);
      if (error) return { success: false, error: error.message };
      return { success: true, message: `🗑️ Goal "${match.title}" has been deleted.` };
    }
    
    case "analyze_mood_trend": {
      const days = args.days || 14;
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - Math.min(days, 30));
      const { data: checkIns } = await supabase.from("check_ins").select("mood, urge_intensity, created_at").eq("user_id", userId).gte("created_at", sinceDate.toISOString()).order("created_at", { ascending: true });
      if (!checkIns || checkIns.length < 3) return { has_data: false, message: "Not enough check-in data for trend analysis. Keep logging daily!" };
      const moodScores: Record<string, number> = { great: 5, good: 4, okay: 3, struggling: 2, crisis: 1 };
      const dayMap: Record<string, { scores: number[]; urges: number[] }> = {};
      for (const ci of checkIns) {
        const day = new Date(ci.created_at).toLocaleDateString("en-US", { weekday: "long" });
        if (!dayMap[day]) dayMap[day] = { scores: [], urges: [] };
        dayMap[day].scores.push(moodScores[ci.mood] || 3);
        dayMap[day].urges.push(ci.urge_intensity || 0);
      }
      const dayRisks = Object.entries(dayMap).map(([day, data]) => ({
        day, avgMood: (data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1),
        avgUrge: (data.urges.reduce((a, b) => a + b, 0) / data.urges.length).toFixed(1),
      })).sort((a, b) => Number(a.avgMood) - Number(b.avgMood));
      const recentScores = checkIns.slice(-7).map((ci: any) => moodScores[ci.mood] || 3);
      const olderScores = checkIns.slice(0, 7).map((ci: any) => moodScores[ci.mood] || 3);
      const recentAvg = recentScores.reduce((a: number, b: number) => a + b, 0) / recentScores.length;
      const olderAvg = olderScores.length > 0 ? olderScores.reduce((a: number, b: number) => a + b, 0) / olderScores.length : recentAvg;
      const trend = recentAvg > olderAvg + 0.3 ? "improving" : recentAvg < olderAvg - 0.3 ? "declining" : "stable";
      return { has_data: true, period_days: days, total_check_ins: checkIns.length, overall_trend: trend, highest_risk_days: dayRisks.slice(0, 2).map(d => d.day), day_breakdown: dayRisks, recent_avg_mood: recentAvg.toFixed(1), prediction: trend === "declining" ? "⚠️ Mood trending down. Consider extra self-care." : trend === "improving" ? "📈 Great progress! Mood improving." : "➡️ Mood stable. Consistency is key." };
    }

    case "fetch_wearable_insights": {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const [biometricsRes, checkInsRes] = await Promise.all([
        supabase.from("biometric_logs").select("sleep_hours, steps, stress_level, heart_rate, logged_at").eq("user_id", userId).gte("logged_at", weekAgo.toISOString()),
        supabase.from("check_ins").select("mood, urge_intensity, created_at").eq("user_id", userId).gte("created_at", weekAgo.toISOString())
      ]);
      const biometrics = biometricsRes.data || []; const checkIns = checkInsRes.data || [];
      if (biometrics.length === 0) return { has_data: false, message: "No wearable data available. Connect a device to get health-recovery insights." };
      const moodScores: Record<string, number> = { great: 5, good: 4, okay: 3, struggling: 2, crisis: 1 };
      const avgSleep = biometrics.reduce((s: number, b: any) => s + (b.sleep_hours || 0), 0) / biometrics.length;
      const avgStress = biometrics.reduce((s: number, b: any) => s + (b.stress_level || 0), 0) / biometrics.length;
      const avgSteps = biometrics.reduce((s: number, b: any) => s + (b.steps || 0), 0) / biometrics.length;
      const avgMood = checkIns.length > 0 ? checkIns.reduce((s: number, c: any) => s + (moodScores[c.mood] || 3), 0) / checkIns.length : null;
      const insights: string[] = [];
      if (avgSleep < 6 && avgMood && avgMood < 3.5) insights.push("💤 Low sleep correlates with lower mood. Prioritizing rest could improve recovery.");
      if (avgStress > 6 && checkIns.some((c: any) => (c.urge_intensity || 0) > 5)) insights.push("😤 High stress aligns with stronger urges. Try stress-reduction techniques.");
      if (avgSteps > 5000 && avgMood && avgMood > 3.5) insights.push("🏃 Active days show better mood! Keep moving.");
      if (insights.length === 0) insights.push("✨ Health metrics and mood are well-balanced.");
      return { has_data: true, avg_sleep: avgSleep.toFixed(1), avg_stress: avgStress.toFixed(1), avg_steps: Math.round(avgSteps), avg_mood: avgMood?.toFixed(1) || "N/A", correlations: insights };
    }

    case "summarize_weekly_progress": {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const [checkInsRes, goalsRes, journalsRes, profileRes] = await Promise.all([
        supabase.from("check_ins").select("mood, created_at").eq("user_id", userId).gte("created_at", weekAgo.toISOString()),
        supabase.from("goals").select("title, completed, created_at").eq("user_id", userId),
        supabase.from("journal_entries").select("title, created_at").eq("user_id", userId).gte("created_at", weekAgo.toISOString()),
        supabase.from("profiles").select("current_streak, sobriety_start_date, level, xp").eq("id", userId).single()
      ]);
      const checkIns = checkInsRes.data || []; const goals = goalsRes.data || []; const journals = journalsRes.data || []; const prof = profileRes.data;
      const daysSober = prof?.sobriety_start_date ? Math.floor((Date.now() - new Date(prof.sobriety_start_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const completedThisWeek = goals.filter((g: any) => g.completed && new Date(g.created_at) >= weekAgo).length;
      return { week_summary: { check_ins_logged: checkIns.length, journal_entries_written: journals.length, active_goals: goals.filter((g: any) => !g.completed).length, goals_completed_this_week: completedThisWeek, current_streak: prof?.current_streak || 0, days_sober: daysSober, level: prof?.level || 1, xp: prof?.xp || 0 }, highlights: checkIns.length >= 5 ? "🌟 Great consistency with check-ins!" : checkIns.length >= 3 ? "👍 Good check-in frequency" : "📝 Try to check in more often" };
    }

    case "schedule_reminder": {
      return { success: true, reminder: { title: args.title, message: args.message, suggested_time: args.suggested_time || "morning" }, note: `📝 Reminder noted: "${args.title}" - ${args.message}. Suggested time: ${args.suggested_time || "morning"}.` };
    }

    case "generate_relapse_prevention_plan": {
      const [triggersRes, relapsesRes, copingRes] = await Promise.all([
        supabase.from("triggers").select("trigger_type, intensity, situation").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
        supabase.from("relapses").select("triggers, notes, relapse_date").eq("user_id", userId).order("relapse_date", { ascending: false }).limit(10),
        supabase.from("coping_activities").select("activity_name, category, helpful, times_used").eq("user_id", userId).eq("helpful", true).order("times_used", { ascending: false }).limit(10)
      ]);
      const triggers = triggersRes.data || []; const relapses = relapsesRes.data || []; const copingActivities = copingRes.data || [];
      const topTriggers = triggers.slice(0, 5).map((t: any) => t.trigger_type);
      const effectiveCoping = copingActivities.slice(0, 5).map((c: any) => c.activity_name);
      const relapsePatterns = relapses.map((r: any) => r.triggers || []).flat();
      const plan: any = {
        identified_triggers: topTriggers.length > 0 ? topTriggers : ["No triggers recorded yet"],
        relapse_patterns: relapsePatterns.length > 0 ? [...new Set(relapsePatterns)].slice(0, 5) : ["No relapse data - keep going!"],
        proven_coping_strategies: effectiveCoping.length > 0 ? effectiveCoping : ["Breathing exercises", "Physical activity", "Journaling"],
        prevention_steps: ["1. Identify early warning signs", "2. Use proven coping strategies immediately", "3. Reach out to support", "4. Remove yourself from triggering environments", "5. Practice self-compassion"],
        emergency_contacts: { crisis_line: "988 (Suicide & Crisis Lifeline)", text_line: "Text HOME to 741741" }
      };
      if (args.focus_area) plan.prevention_steps.unshift(`0. For "${args.focus_area}": Plan specific avoidance strategies`);
      return plan;
    }

    case "get_community_support_matches": {
      const { data: userProfile } = await supabase.from("profiles").select("level, addiction_type, current_streak").eq("id", userId).single();
      const { data: matches } = await supabase.from("profiles").select("id, pseudonym, level, current_streak, addiction_type").neq("id", userId).not("pseudonym", "is", null).order("current_streak", { ascending: false }).limit(10);
      if (!matches || matches.length === 0) return { matches: [], message: "No community members found yet." };
      const scored = matches.map((m: any) => {
        let score = 0;
        if (m.addiction_type === userProfile?.addiction_type) score += 3;
        if (Math.abs((m.level || 1) - (userProfile?.level || 1)) <= 2) score += 2;
        if (Math.abs((m.current_streak || 0) - (userProfile?.current_streak || 0)) <= 14) score += 1;
        return { ...m, similarity_score: score };
      }).sort((a: any, b: any) => b.similarity_score - a.similarity_score).slice(0, 5);
      return { matches: scored.map((m: any) => ({ pseudonym: m.pseudonym, level: m.level, streak: m.current_streak, same_recovery_type: m.addiction_type === userProfile?.addiction_type })), message: `Found ${scored.length} community members on similar journeys!` };
    }

    case "translate_response": {
      return { target_language: args.target_language, instruction: `Respond in ${args.target_language === "ms" ? "Bahasa Melayu" : args.target_language === "ta" ? "Tamil" : "English"}.`, text_context: args.text || "" };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// Generate contextual response from tool results when all models fail
function generateFallbackFromTools(allToolResults: any[]): string {
  if (allToolResults.length === 0) {
    return "I'm here to support you on your recovery journey. How can I help you today?";
  }
  
  const lastResult = allToolResults[allToolResults.length - 1];
  const toolName = lastResult.tool;
  const result = lastResult.result;
  
  if (toolName === "get_recent_journal_entries") {
    const entries = result.recent_entries || [];
    if (entries.length === 0) return "You don't have any journal entries yet. Would you like to start one?";
    const entryList = entries.map((e: any, i: number) => `${i + 1}. **${e.title || 'Untitled'}** (${new Date(e.date).toLocaleDateString()}): ${e.excerpt}`).join('\n');
    return `Here are your recent journal entries:\n\n${entryList}\n\nWould you like to add a new entry or discuss any of these?`;
  } else if (toolName === "get_active_goals") {
    const goals = result.goals || [];
    if (goals.length === 0) return "You don't have any active goals yet. Would you like to set one?";
    const goalList = goals.map((g: any, i: number) => `${i + 1}. **${g.title}** - ${g.progress || 0}% complete${g.days_remaining ? ` (${g.days_remaining} days left)` : ''}`).join('\n');
    return `Here are your active goals:\n\n${goalList}\n\nKeep up the great work!`;
  } else if (toolName === "get_user_progress") {
    return `You're ${result.days_sober} days sober - that's amazing! Your current streak is ${result.current_streak} days, Level ${result.level} with ${result.xp} XP.${result.days_to_milestone ? ` Only ${result.days_to_milestone} days until your next milestone!` : ''} How are you feeling today?`;
  } else if (toolName === "get_recent_moods") {
    if (result.total_check_ins === 0) return "I don't see any recent check-ins. How are you feeling right now?";
    return `In the past week, you've done ${result.total_check_ins} check-ins. Your mood trend is ${result.trend}, with an average urge intensity of ${result.average_urge_intensity}/10.`;
  } else if (result?.success && result?.message) {
    return result.message;
  }
  
  return "I've processed your request. Is there anything else I can help you with?";
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let toolsCalled: string[] = [];
  let autonomyScore = 0;
  let routerCategory = "unknown";
  let modelUsed = "unknown";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { message, conversationHistory, preferred_language } = await req.json();
    
    const sanitizedMessage = sanitizeInput(message, 2000);
    if (!sanitizedMessage) {
      return new Response(JSON.stringify({ error: "Invalid message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    const crisisCheck = detectCrisis(sanitizedMessage);
    
    // ---- STEP 1: Classify Intent via Groq Router ----
    const routerStart = Date.now();
    routerCategory = await classifyIntent(sanitizedMessage, crisisCheck.isCrisis);
    const routerMs = Date.now() - routerStart;
    console.log(`[Agent] Router: ${routerCategory} (${routerMs}ms) | Crisis: ${crisisCheck.isCrisis}`);

    // Get user profile for system prompt
    const { data: profile } = await supabase
      .from("profiles")
      .select("pseudonym, addiction_type, sobriety_start_date, level, preferred_language")
      .eq("id", user.id)
      .single();

    // Detect language
    const detectedLanguage = detectLanguage(sanitizedMessage, preferred_language || profile?.preferred_language);
    console.log(`[Agent] Detected language: ${detectedLanguage}`);

    const daysSober = profile?.sobriety_start_date
      ? Math.floor((Date.now() - new Date(profile.sobriety_start_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const systemPrompt = `You are a compassionate AI Recovery Coach for ${profile?.pseudonym || "a user"} who is ${daysSober} days free from ${profile?.addiction_type || "addiction"} (Level ${profile?.level || 1}).

CRITICAL CONTEXT: The user is recovering from "${profile?.addiction_type || "addiction"}". NEVER reference alcohol, drinking, or "minum" unless their addiction type is specifically "alcohol". Always use language and examples appropriate to their specific recovery type.

CORE RULES:
1. Be warm, supportive, and practical. Keep responses under 150 words.
2. Use tools to get real user data before answering questions about their progress, moods, goals, or journals.
3. ALWAYS respond with actual data after calling READ tools. NEVER fabricate or invent data.
4. For WRITE tools (create_goal, create_check_in, create_journal_entry):
   - ALWAYS ask the user for details FIRST before creating anything
   - NEVER create duplicates
   - Only call create_* tools when user explicitly provides NEW content to add
5. For EDIT tools (edit_journal_entry, update_goal):
   - ALWAYS ask "What would you like to change it to?" BEFORE calling the tool
   - NEVER invent or assume new content - the user MUST provide the new text
   - If user says "edit my entry" without specifying changes, ASK what they want to change
   - Do NOT call the edit tool until you have the user's explicit new content
6. For DELETE tools (delete_journal_entry, delete_goal):
   - If the user says "delete an entry" without specifying WHICH one, list the entries and ask which one to delete
   - ALWAYS confirm by saying "Are you sure you want to delete [title]?" BEFORE calling the delete tool
   - Only call the delete tool AFTER the user explicitly confirms (says yes/confirm/sure/do it/go ahead)
   - NEVER delete without asking for confirmation first
7. ${crisisCheck.isCrisis ? 'CRISIS DETECTED: Call escalate_crisis immediately and share 988 hotline.' : 'If user mentions suicide or self-harm, call escalate_crisis immediately.'}
8. NEVER output internal tool names, reasoning traces, or raw function names in your response.

IMPORTANT: After calling any tool, provide a helpful text response that describes or confirms the data. Use ONLY real data from tool results.` + getLanguageSystemPromptAddition(detectedLanguage);

    // ---- STEP 2: Route to appropriate agent ----

    // === CHAT PATH: Language-aware routing ===
    if (routerCategory === "chat") {
      let finalContent: string | null = null;

      if (detectedLanguage === "ms") {
        // Malay: SEA-LION -> Cerebras -> Groq
        console.log("[Agent] Chat path -> SEA-LION (Malay)");
        modelUsed = "sealion-v4-27b";
        finalContent = await callSeaLionChat(systemPrompt, sanitizedMessage, conversationHistory || []);
        if (!finalContent) { console.log("[Agent] SEA-LION failed, fallback Cerebras"); modelUsed = "cerebras-llama3.3-70b"; finalContent = await callCerebrasChat(systemPrompt, sanitizedMessage, conversationHistory || []); }
        if (!finalContent) { console.log("[Agent] Cerebras failed, fallback Groq"); modelUsed = "groq-llama3.3-70b"; const gr = await callGroqWithTools(systemPrompt, sanitizedMessage, conversationHistory || [], []); finalContent = gr.content; }
      } else if (detectedLanguage === "ta") {
        // Tamil: Sarvam-M -> SEA-LION -> Cerebras -> Groq
        console.log("[Agent] Chat path -> Sarvam-M (Tamil)");
        modelUsed = "sarvam-m-24b";
        finalContent = await callSarvamChat(systemPrompt, sanitizedMessage, conversationHistory || []);
        if (!finalContent) { console.log("[Agent] Sarvam failed, fallback SEA-LION"); modelUsed = "sealion-v4-27b"; finalContent = await callSeaLionChat(systemPrompt, sanitizedMessage, conversationHistory || []); }
        if (!finalContent) { console.log("[Agent] SEA-LION failed, fallback Cerebras"); modelUsed = "cerebras-llama3.3-70b"; finalContent = await callCerebrasChat(systemPrompt, sanitizedMessage, conversationHistory || []); }
        if (!finalContent) { console.log("[Agent] Cerebras failed, fallback Groq"); modelUsed = "groq-llama3.3-70b"; const gr = await callGroqWithTools(systemPrompt, sanitizedMessage, conversationHistory || [], []); finalContent = gr.content; }
      } else {
        // English: Cerebras -> Groq -> Gemini
        console.log("[Agent] Chat path -> Cerebras (English)");
        modelUsed = "cerebras-llama3.3-70b";
        finalContent = await callCerebrasChat(systemPrompt, sanitizedMessage, conversationHistory || []);
        if (!finalContent) { console.log("[Agent] Cerebras failed, fallback Groq"); modelUsed = "groq-llama3.3-70b"; const gr = await callGroqWithTools(systemPrompt, sanitizedMessage, conversationHistory || [], []); finalContent = gr.content; }
        if (!finalContent) {
          console.log("[Agent] Groq failed, fallback Gemini");
          modelUsed = "gemini-2.5-flash-lite";
          const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
          if (GOOGLE_API_KEY) {
            const sanitizedHistory = (conversationHistory || []).map((msg: any) => ({ role: msg.role === "user" ? "user" : "model", parts: [{ text: sanitizeInput(msg.content, 800) }] })).slice(-12);
            const contents = [...sanitizedHistory, { role: "user", parts: [{ text: sanitizedMessage }] }];
            const geminiResult = await callGeminiWithTools(systemPrompt, contents, [], GOOGLE_API_KEY);
            if (geminiResult.ok) { finalContent = geminiResult.data?.candidates?.[0]?.content?.parts?.[0]?.text || null; }
          }
        }
      }

      if (!finalContent) {
        finalContent = "I'm here to support you on your recovery journey. How can I help you today?";
        modelUsed = "fallback-static";
      }

      finalContent = sanitizeOutput(finalContent);

      const responseTimeMs = Date.now() - startTime;
      
      try {
        await supabase.from("ai_observability_logs").insert({
          user_id: user.id,
          function_name: "chat-with-ai",
          input_summary: sanitizedMessage.substring(0, 100),
          tools_called: [],
          response_summary: finalContent.substring(0, 200),
          response_time_ms: responseTimeMs,
          model_used: modelUsed,
          router_category: routerCategory,
          intervention_triggered: false,
        });
      } catch (logError) {
        console.error("Failed to log:", logError);
      }

      console.log(`[Agent] Chat complete in ${responseTimeMs}ms via ${modelUsed}`);

      return new Response(
        JSON.stringify({ 
          response: finalContent,
          tools_used: [],
          response_time_ms: responseTimeMs,
          agent_metrics: {
            autonomy_score: 0,
            tool_iterations: 0,
            read_tools: 0,
            write_tools: 0,
            crisis_detected: crisisCheck.isCrisis,
            router_category: routerCategory,
            model_used: modelUsed,
            router_latency_ms: routerMs,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === TOOL PATH: Language-aware routing ===
    const openaiTools = getOpenAITools(routerCategory);
    const toolChoice = (routerCategory === "data" || routerCategory === "action") ? "required" : "auto";

    let finalContent = "";
    let allToolResults: any[] = [];
    let iterations = 0;

    // For Malay/Tamil: Try SEA-LION first as regional primary
    if (detectedLanguage !== "en") {
      console.log(`[Agent] Tool path -> SEA-LION PRIMARY for ${detectedLanguage} (tool_choice: ${toolChoice})`);
      modelUsed = "sealion-v4-27b";
      const seaLionResult = await callSeaLionWithTools(systemPrompt, sanitizedMessage, conversationHistory || [], openaiTools, toolChoice as "auto" | "required");
      if (seaLionResult.toolCalls && seaLionResult.toolCalls.length > 0) {
        for (const tc of seaLionResult.toolCalls) {
          iterations++;
          const toolName = tc.function.name;
          let toolArgs = {};
          try { toolArgs = JSON.parse(tc.function.arguments || "{}"); } catch {}
          console.log(`[Agent] SEA-LION tool call: ${toolName}`);
          toolsCalled.push(toolName);
          autonomyScore++;
          try {
            const result = await executeTool(supabase, user.id, toolName, toolArgs);
            allToolResults.push({ tool: toolName, args: toolArgs, result });
          } catch (toolError: any) {
            console.error(`[Agent] Tool ${toolName} failed:`, toolError.message);
            allToolResults.push({ tool: toolName, args: toolArgs, result: { error: toolError.message } });
          }
        }
        finalContent = await getGroqFollowUp(systemPrompt, sanitizedMessage, seaLionResult.toolCalls, allToolResults);
      } else if (seaLionResult.content) {
        finalContent = seaLionResult.content;
      }
    }

    // Groq fallback (or English primary)
    if (!finalContent && allToolResults.length === 0) {
      console.log(`[Agent] Tool path -> Groq ${detectedLanguage === "en" ? "PRIMARY" : "FALLBACK"} (tool_choice: ${toolChoice})`);
      modelUsed = "groq-llama3.3-70b";
      const groqResult = await callGroqWithTools(systemPrompt, sanitizedMessage, conversationHistory || [], openaiTools, toolChoice as "auto" | "required");
      if (groqResult.toolCalls && groqResult.toolCalls.length > 0) {
        for (const tc of groqResult.toolCalls) {
          iterations++;
          const toolName = tc.function.name;
          let toolArgs = {};
          try { toolArgs = JSON.parse(tc.function.arguments || "{}"); } catch {}
          console.log(`[Agent] Groq tool call: ${toolName}`);
          toolsCalled.push(toolName);
          autonomyScore++;
          try {
            const result = await executeTool(supabase, user.id, toolName, toolArgs);
            allToolResults.push({ tool: toolName, args: toolArgs, result });
          } catch (toolError: any) {
            console.error(`[Agent] Tool ${toolName} failed:`, toolError.message);
            allToolResults.push({ tool: toolName, args: toolArgs, result: { error: toolError.message } });
          }
        }
        finalContent = await getGroqFollowUp(systemPrompt, sanitizedMessage, groqResult.toolCalls, allToolResults);
      } else if (groqResult.content) {
        finalContent = groqResult.content;
      }
    }

    // ---- FALLBACK: Gemini if Groq produced nothing useful ----
    if (!finalContent || finalContent.trim() === "") {
      console.log("[Agent] Groq produced no content, falling back to Gemini");
      modelUsed = "gemini-2.5-flash-lite";
      
      const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
      if (GOOGLE_API_KEY) {
        const geminiTools = getGeminiTools(routerCategory);
        const sanitizedHistory = (conversationHistory || []).map((msg: any) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: sanitizeInput(msg.content, 800) }]
        })).slice(-12);

        const contents = [
          ...sanitizedHistory,
          { role: "user", parts: [{ text: sanitizedMessage }] }
        ];

        const geminiResult = await callGeminiWithTools(systemPrompt, contents, geminiTools, GOOGLE_API_KEY);

        if (geminiResult.ok) {
          let candidate = geminiResult.data?.candidates?.[0];
          const maxIter = 5;
          
          while (candidate?.content?.parts?.[0]?.functionCall && iterations < maxIter) {
            iterations++;
            const functionCall = candidate.content.parts[0].functionCall;
            const toolName = functionCall.name;
            const toolArgs = functionCall.args || {};
            
            console.log(`[Agent] Gemini fallback tool iteration ${iterations}: ${toolName}`);
            toolsCalled.push(toolName);
            autonomyScore++;
            
            try {
              const result = await executeTool(supabase, user.id, toolName, toolArgs);
              allToolResults.push({ tool: toolName, args: toolArgs, result });
              
              contents.push({
                role: "model",
                parts: [{ functionCall: { name: toolName, args: toolArgs } }]
              });
              contents.push({
                role: "user",
                parts: [{ functionResponse: { name: toolName, response: result } }]
              });
              
              const nextResult = await callGeminiWithTools(systemPrompt, contents, geminiTools, GOOGLE_API_KEY);
              
              if (!nextResult.ok) {
                console.log(`[Agent] Gemini ${nextResult.status} mid-loop`);
                modelUsed = "gemini+fallback";
                break;
              }
              
              candidate = nextResult.data?.candidates?.[0];
            } catch (toolError: any) {
              console.error(`[Agent] Tool ${toolName} failed:`, toolError.message);
              break;
            }
          }
          
          finalContent = candidate?.content?.parts?.[0]?.text || "";
        }
      }
    }

    // ---- LAST RESORT: Static fallback from tool results ----
    if (!finalContent || finalContent.trim() === "") {
      finalContent = generateFallbackFromTools(allToolResults);
      modelUsed = allToolResults.length > 0 ? `${modelUsed}+fallback` : "fallback-static";
      console.log(`[Agent] Used static fallback response`);
    }

    // Sanitize output
    finalContent = sanitizeOutput(finalContent);

    if (!finalContent) {
      finalContent = generateFallbackFromTools(allToolResults);
    }

    const responseTimeMs = Date.now() - startTime;
    
    const readToolsUsed = toolsCalled.filter(t => 
      ["get_user_progress", "get_recent_moods", "get_active_goals", "get_recent_journal_entries", "get_biometric_data", "get_conversation_context", "analyze_mood_trend", "fetch_wearable_insights", "summarize_weekly_progress", "get_community_support_matches", "translate_response"].includes(t)
    ).length;
    const writeToolsUsed = toolsCalled.filter(t => 
      ["create_goal", "create_check_in", "create_journal_entry", "complete_goal", "log_coping_activity", "edit_journal_entry", "delete_journal_entry", "update_goal", "delete_goal", "schedule_reminder", "generate_relapse_prevention_plan"].includes(t)
    ).length;
    
    // Log observability
    try {
      await supabase.from("ai_observability_logs").insert({
        user_id: user.id,
        function_name: "chat-with-ai",
        input_summary: sanitizedMessage.substring(0, 100),
        tools_called: toolsCalled,
        tool_results: allToolResults,
        response_summary: finalContent.substring(0, 200),
        response_time_ms: responseTimeMs,
        model_used: modelUsed,
        router_category: routerCategory,
        intervention_triggered: toolsCalled.includes("log_intervention") || toolsCalled.includes("escalate_crisis"),
        intervention_type: crisisCheck.isCrisis ? "crisis_response" : toolsCalled.includes("log_intervention") ? "proactive_support" : null,
      });
    } catch (logError) {
      console.error("Failed to log observability data:", logError);
    }

    console.log(`[Agent] Complete in ${responseTimeMs}ms | Route: ${routerCategory} | Model: ${modelUsed} | Tools: ${toolsCalled.length} (${readToolsUsed}R/${writeToolsUsed}W) | Iterations: ${iterations}`);

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
          crisis_detected: crisisCheck.isCrisis,
          router_category: routerCategory,
          model_used: modelUsed,
          router_latency_ms: routerMs,
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
