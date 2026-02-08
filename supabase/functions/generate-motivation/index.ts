import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_MESSAGES = [
  "Every day sober is a victory. You're stronger than you know!",
  "Your journey matters. One day at a time, you're building a better future.",
  "Recovery is progress, not perfection. You're doing great!",
  "Strength doesn't come from what you can do. It comes from overcoming the things you thought you couldn't.",
  "You've already proven you can do hard things. Keep going!",
];

// Call Cerebras Llama 3.1 70B as fallback
async function callCerebras(prompt: string): Promise<string | null> {
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
        model: "llama-3.3-70b",
        messages: [
          { role: "system", content: "You generate short, inspiring motivational messages for people in addiction recovery. Keep messages under 100 characters, positive, and encouraging. Respond with ONLY the message, no quotes." },
          { role: "user", content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      console.error(`[generate-motivation] Cerebras error ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (text && text.length > 20 && text.length < 200) {
      return text.replace(/^["']|["']$/g, '');
    }
    return null;
  } catch (error) {
    console.error("[generate-motivation] Cerebras failed:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[generate-motivation] Request started at ${new Date().toISOString()}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[generate-motivation] No authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - no token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("[generate-motivation] Auth error:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("addiction_type, sobriety_start_date")
      .eq("id", user.id)
      .single();

    const daysSober = Math.floor(
      (new Date().getTime() - new Date(profile?.sobriety_start_date || new Date()).getTime()) / (1000 * 60 * 60 * 24)
    );

    const prompt = `Generate a short, inspiring motivational message for someone in recovery from ${profile?.addiction_type || "addiction"}. They are ${daysSober} days into their journey. Keep it under 100 characters, positive, and encouraging.`;

    let message: string | null = null;
    let modelUsed = "unknown";

    // ---- PRIMARY: Gemini 2.5 Flash Lite ----
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (GOOGLE_API_KEY) {
      try {
        console.log("[generate-motivation] Trying Gemini...");
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 100 }
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (generatedText) {
            let generated = generatedText.replace(/^["']|["']$/g, '');
            if (generated.length > 20 && generated.length < 200) {
              message = generated;
              if (message && !/[.!?]$/.test(message)) message += '.';
              modelUsed = "gemini-2.5-flash-lite";
            } else {
              const firstSentence = generated.split(/[.!?]/)[0];
              if (firstSentence && firstSentence.length > 20) {
                message = firstSentence + '.';
                modelUsed = "gemini-2.5-flash-lite";
              }
            }
          }
        } else if (response.status === 429) {
          console.log("[generate-motivation] Gemini 429, trying Cerebras fallback...");
        } else {
          console.error(`[generate-motivation] Gemini error ${response.status}`);
        }
      } catch (error) {
        console.error("[generate-motivation] Gemini failed:", error);
      }
    }

    // ---- FALLBACK: Cerebras Llama 3.1 70B ----
    if (!message) {
      console.log("[generate-motivation] Trying Cerebras fallback...");
      message = await callCerebras(prompt);
      if (message) {
        modelUsed = "cerebras-llama3.1-70b";
        if (!/[.!?]$/.test(message)) message += '.';
      }
    }

    // ---- STATIC FALLBACK ----
    if (!message) {
      const dynamicFallbacks = [
        ...FALLBACK_MESSAGES,
        `${daysSober} days of courage and determination. Keep going!`,
      ];
      message = dynamicFallbacks[Math.floor(Math.random() * dynamicFallbacks.length)];
      modelUsed = "fallback-static";
    }

    const responseTime = Date.now() - startTime;
    console.log(`[generate-motivation] Success via ${modelUsed} in ${responseTime}ms: "${message}"`);
    
    return new Response(
      JSON.stringify({ message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[generate-motivation] Error:", error);
    return new Response(
      JSON.stringify({ 
        message: FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)]
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
