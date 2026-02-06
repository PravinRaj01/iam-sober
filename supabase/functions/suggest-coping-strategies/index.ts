import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sanitizeInput(input: string, maxLength: number = 2000): string {
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

const HARDCODED_STRATEGIES = [
  {
    title: "Deep Breathing Exercise",
    description: "Controlled breathing activates your parasympathetic nervous system, reducing stress and cravings.",
    actionSteps: ["Find a quiet space and sit comfortably", "Breathe in for 4 counts, hold for 7, exhale for 8", "Repeat 3-5 times until you feel calmer"]
  },
  {
    title: "Grounding Technique (5-4-3-2-1)",
    description: "This sensory awareness technique helps bring you back to the present moment when overwhelmed.",
    actionSteps: ["Name 5 things you can see, 4 you can touch, 3 you can hear", "Focus on 2 things you can smell and 1 you can taste", "Take a deep breath and notice how you feel"]
  },
  {
    title: "Reach Out to Support",
    description: "Connection with others is one of the most powerful tools in recovery.",
    actionSteps: ["Call or text a trusted friend, sponsor, or family member", "Share what you're going through honestly", "If no one is available, consider a support hotline or online meeting"]
  }
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
          { role: "system", content: "You generate personalized coping strategies for people in addiction recovery. You MUST respond with ONLY a valid JSON array, no markdown, no code fences, no explanation. Just the raw JSON array." },
          { role: "user", content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`[suggest-coping-strategies] Groq error ${response.status}: ${errBody}`);
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    // Clean markdown fences if present
    let cleaned = text;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
    }
    const parsed = JSON.parse(cleaned);
    const strategies = Array.isArray(parsed) ? parsed : parsed.strategies;
    return Array.isArray(strategies) ? strategies : null;
  } catch (error) {
    console.error("[suggest-coping-strategies] Groq fallback failed:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const startedAt = Date.now();
    console.log('[suggest-coping-strategies] Request started at', new Date(startedAt).toISOString());

    const { situation } = await req.json();
    if (!situation || typeof situation !== 'string' || !situation.trim()) {
      return new Response(JSON.stringify({ error: 'Missing or invalid "situation"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const sanitizedSituation = sanitizeInput(situation, 1000);
    if (!sanitizedSituation) {
      return new Response(JSON.stringify({ error: 'Invalid situation content' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Generate 3 personalized coping strategies for someone in recovery who is experiencing the following situation: "${sanitizedSituation}"

Each strategy should include:
1. A clear, actionable title
2. A brief description of why this strategy is helpful
3. 2-3 specific action steps to implement the strategy

Format the response as a JSON array with objects containing "title", "description", and "actionSteps" (array).`;

    let strategies: any[] | null = null;
    let modelUsed = "unknown";

    // ---- PRIMARY: Gemini 2.5 Flash Lite ----
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (GOOGLE_API_KEY) {
      try {
        console.log('[suggest-coping-strategies] Trying Gemini...');
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" }
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          
          if (typeof content === 'string') {
            let cleaned = content.trim();
            if (cleaned.startsWith('```')) {
              cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
            }
            try {
              let parsed = JSON.parse(cleaned);
              if (Array.isArray(parsed)) {
                strategies = parsed;
                modelUsed = "gemini-2.5-flash-lite";
              }
            } catch {
              const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
              if (arrayMatch) {
                try {
                  const parsed = JSON.parse(arrayMatch[0]);
                  if (Array.isArray(parsed)) {
                    strategies = parsed;
                    modelUsed = "gemini-2.5-flash-lite";
                  }
                } catch {}
              }
            }
          }
        } else if (response.status === 429) {
          console.log('[suggest-coping-strategies] Gemini 429, trying Groq fallback...');
        } else {
          console.error(`[suggest-coping-strategies] Gemini error ${response.status}`);
        }
      } catch (error) {
        console.error('[suggest-coping-strategies] Gemini failed:', error);
      }
    }

    // ---- FALLBACK: Groq Llama 3.1 70B ----
    if (!strategies) {
      console.log('[suggest-coping-strategies] Trying Groq fallback...');
      strategies = await callGroqFallback(prompt);
      if (strategies) {
        modelUsed = "groq-llama3.1-70b";
      }
    }

    // ---- STATIC FALLBACK ----
    if (!strategies || !Array.isArray(strategies)) {
      console.log('[suggest-coping-strategies] Using hardcoded fallback');
      strategies = HARDCODED_STRATEGIES;
      modelUsed = "fallback-static";
    }

    const duration = Date.now() - startedAt;
    console.log(`[suggest-coping-strategies] Success via ${modelUsed}. strategies=${strategies.length}, duration=${duration}ms`);

    return new Response(JSON.stringify({ strategies }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('[suggest-coping-strategies] Error:', error);
    return new Response(JSON.stringify({ strategies: HARDCODED_STRATEGIES }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
