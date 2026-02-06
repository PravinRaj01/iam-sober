import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') return '';
  let sanitized = input.slice(0, maxLength).trim();
  const dangerousPatterns = [
    /system:/gi, /assistant:/gi, /<\|im_start\|>/gi, /<\|im_end\|>/gi,
    /\[INST\]/gi, /\[\/INST\]/gi,
  ];
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }
  return sanitized;
}

interface Goal {
  title: string;
  completed: boolean;
}

const HARDCODED_SUGGESTIONS = [
  { title: "Practice daily mindfulness", description: "Spend 10 minutes each day in mindful meditation to build emotional resilience.", target_days: 14 },
  { title: "Connect with support network", description: "Reach out to at least one supportive person each week to strengthen your recovery community.", target_days: 30 },
  { title: "Establish a sleep routine", description: "Go to bed and wake up at consistent times to improve physical and mental health.", target_days: 7 },
];

// Call Groq Llama 3.1 70B as fallback for JSON output
async function callGroqFallback(prompt: string): Promise<any[] | null> {
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  if (!GROQ_API_KEY) return null;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are a recovery coach that generates personalized recovery goals. You MUST respond with ONLY a valid JSON array, no markdown, no code fences, no explanation. Just the raw JSON array." },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      console.error(`[suggest-recovery-goals] Groq error ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    let cleaned = text;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
    }
    const parsed = JSON.parse(cleaned);
    const suggestions = Array.isArray(parsed) ? parsed : parsed.suggestions;
    return Array.isArray(suggestions) ? suggestions : null;
  } catch (error) {
    console.error("[suggest-recovery-goals] Groq fallback failed:", error);
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userPrompt } = await req.json();
    const sanitizedPrompt = userPrompt ? sanitizeInput(userPrompt, 500) : '';
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error("Unauthorized");
    }

    // Get user context
    const { data: profile } = await supabase
      .from("profiles")
      .select("addiction_type, sobriety_start_date")
      .eq("id", user.id)
      .single();

    console.log("[suggest-recovery-goals] Fetching user context...");

    const { data: existingGoals } = await supabase
      .from("goals")
      .select("title, completed")
      .eq("user_id", user.id);

    const { data: recentCheckIns } = await supabase
      .from("check_ins")
      .select("mood, urge_intensity")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    const daysSober = Math.floor(
      (new Date().getTime() - new Date(profile.sobriety_start_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    const completedGoals = (existingGoals as Goal[])?.filter(g => g.completed).map(g => g.title).join(", ") || "None";
    const activeGoals = (existingGoals as Goal[])?.filter(g => !g.completed).map(g => g.title).join(", ") || "None";
    const recentMoods = recentCheckIns?.map(c => `Mood: ${c.mood}, Urge: ${c.urge_intensity}/10`).join('; ') || "None";

    const randomSeed = Date.now();
    const userContext = sanitizedPrompt ? `\nUser's interests/focus: ${sanitizedPrompt}` : "";

    const prompt = `You are a recovery coach. Generate 3 UNIQUE, personalized recovery goals. Use this random seed for variety: ${randomSeed}

Context:
- Days sober: ${daysSober} from ${profile.addiction_type || "addiction"}
- Completed goals: ${completedGoals}
- Active goals: ${activeGoals}
- Recent check-ins: ${recentMoods}${userContext}

Requirements:
- Create NEW goals different from existing ones
- Make them practical and achievable
- Vary the difficulty and timeframes
- If user provided interests, incorporate them

Return a JSON array with exactly 3 objects, each containing: "title" (max 60 chars), "description" (brief), "target_days" (7, 14, or 30).`;

    let suggestions: any[] | null = null;
    let modelUsed = "unknown";

    // ---- PRIMARY: Gemini 2.5 Flash Lite ----
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (GOOGLE_API_KEY) {
      try {
        console.log("[suggest-recovery-goals] Trying Gemini...");
        const aiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                maxOutputTokens: 500,
                temperature: 0.9
              }
            }),
          }
        );

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const suggestionsText = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
          
          try {
            const jsonMatch = suggestionsText.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && jsonMatch[1]) {
              suggestions = JSON.parse(jsonMatch[1]);
            } else {
              suggestions = JSON.parse(suggestionsText);
            }
            if (Array.isArray(suggestions)) {
              modelUsed = "gemini-2.5-flash-lite";
            } else {
              suggestions = null;
            }
          } catch {
            console.error("[suggest-recovery-goals] Failed to parse Gemini response");
            suggestions = null;
          }
        } else if (aiResponse.status === 429) {
          console.log("[suggest-recovery-goals] Gemini 429, trying Groq fallback...");
        } else {
          console.error(`[suggest-recovery-goals] Gemini error ${aiResponse.status}`);
        }
      } catch (error) {
        console.error("[suggest-recovery-goals] Gemini failed:", error);
      }
    }

    // ---- FALLBACK: Groq Llama 3.1 70B ----
    if (!suggestions) {
      console.log("[suggest-recovery-goals] Trying Groq fallback...");
      suggestions = await callGroqFallback(prompt);
      if (suggestions) {
        modelUsed = "groq-llama3.1-70b";
      }
    }

    // ---- STATIC FALLBACK ----
    if (!suggestions || !Array.isArray(suggestions)) {
      console.log("[suggest-recovery-goals] Using hardcoded fallback");
      suggestions = HARDCODED_SUGGESTIONS;
      modelUsed = "fallback-static";
    }

    console.log(`[suggest-recovery-goals] Success via ${modelUsed}, ${suggestions.length} suggestions`);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("Error in suggest-recovery-goals:", error);
    return new Response(JSON.stringify({ suggestions: HARDCODED_SUGGESTIONS }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
