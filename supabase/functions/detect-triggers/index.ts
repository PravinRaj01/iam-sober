import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  ];
  
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  return sanitized;
}

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

    const { text } = await req.json();
    
    // Sanitize user input
    const sanitizedText = sanitizeInput(text, 2000);
    if (!sanitizedText) {
      throw new Error("Invalid text input");
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY not configured");
    }

    const candidateLabels = [
      "stress and anxiety",
      "anger and frustration", 
      "sadness and depression",
      "temptation and cravings",
      "loneliness and isolation",
      "boredom and restlessness",
      "peer pressure",
      "relationship conflict"
    ];

    const prompt = `Analyze this text and classify the primary emotional trigger. Respond with ONLY a JSON object: {"trigger": "one of: ${candidateLabels.join(', ')}", "confidence": number between 0 and 1, "topLabels": ["label1", "label2", "label3"], "topScores": [0.9, 0.05, 0.03]}. Text: "${sanitizedText}"`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 200,
            temperature: 0.2
          }
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Gemini API error:", error);
      throw new Error("Failed to detect triggers");
    }

    const data = await response.json();
    console.log("Trigger detection result:", data);
    
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```/);
    let result;
    if (jsonMatch && jsonMatch[1]) {
      result = JSON.parse(jsonMatch[1]);
    } else {
      try {
        result = JSON.parse(generatedText);
      } catch {
        result = { trigger: null, confidence: 0, topLabels: [], topScores: [] };
      }
    }
    
    const topTrigger = result.confidence > 0.4 ? result.trigger : null;
    const confidence = result.confidence;
    
    // Provide coping strategies based on trigger type
    const copingStrategies: Record<string, string[]> = {
      "stress and anxiety": [
        "Try deep breathing: 4-7-8 technique",
        "Take a short walk outside",
        "Practice progressive muscle relaxation"
      ],
      "anger and frustration": [
        "Count to 10 slowly",
        "Write down your feelings",
        "Do physical exercise to release tension"
      ],
      "sadness and depression": [
        "Reach out to a friend or supporter",
        "Engage in a hobby you enjoy",
        "Practice self-compassion"
      ],
      "temptation and cravings": [
        "Use the HALT method (Hungry, Angry, Lonely, Tired)",
        "Delay and distract for 10 minutes",
        "Call your accountability partner"
      ],
      "loneliness and isolation": [
        "Connect with someone from your support network",
        "Join an online support group",
        "Volunteer or help others"
      ],
      "boredom and restlessness": [
        "Start a new hobby or project",
        "Set a small achievable goal",
        "Listen to a motivational podcast"
      ]
    };
    
    const strategies = topTrigger ? copingStrategies[topTrigger] || [] : [];
    
    return new Response(
      JSON.stringify({ 
        trigger: topTrigger,
        confidence: confidence,
        copingStrategies: strategies,
        allLabels: result.topLabels?.slice(0, 3) || [],
        allScores: result.topScores?.slice(0, 3) || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in detect-triggers:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
