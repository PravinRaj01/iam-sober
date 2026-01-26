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

  const startTime = Date.now();
  console.log(`[analyze-journal-sentiment] Request started at ${new Date().toISOString()}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      console.error("[analyze-journal-sentiment] Unauthorized request");
      throw new Error("Unauthorized");
    }

    const { text, entryId } = await req.json();

    if (!text || !entryId) {
      console.error("[analyze-journal-sentiment] Missing required fields");
      throw new Error("Missing text or entryId");
    }
    
    // Sanitize user input
    const sanitizedText = sanitizeInput(text, 10000);
    if (!sanitizedText) {
      console.error("[analyze-journal-sentiment] Invalid text after sanitization");
      throw new Error("Invalid text content");
    }

    console.log(`[analyze-journal-sentiment] User: ${user.id}, Entry: ${entryId}, Text length: ${sanitizedText.length}`);

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      console.error("[analyze-journal-sentiment] GOOGLE_API_KEY not configured");
      throw new Error("GOOGLE_API_KEY not configured");
    }

    console.log("[analyze-journal-sentiment] Calling Gemini API...");

    const prompt = `Analyze the sentiment of this text and respond with ONLY a JSON object in this exact format: {"label": "positive" or "negative" or "neutral", "score": number between 0 and 1}. Text: "${sanitizedText}"`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 50,
            temperature: 0.1
          }
        }),
      }
    );

    const responseTime = Date.now() - startTime;
    console.log(`[analyze-journal-sentiment] API response in ${responseTime}ms, status: ${response.status}`);

    if (!response.ok) {
      const error = await response.text();
      console.error("[analyze-journal-sentiment] Gemini API error:", error);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("Failed to analyze sentiment");
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    
    console.log(`[analyze-journal-sentiment] Raw AI response: ${generatedText}`);
    
    // Extract JSON from markdown if present
    const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```/);
    let sentiment;
    if (jsonMatch && jsonMatch[1]) {
      sentiment = JSON.parse(jsonMatch[1]);
    } else {
      sentiment = JSON.parse(generatedText);
    }

    console.log(`[analyze-journal-sentiment] Parsed sentiment:`, sentiment);

    // Update journal entry with sentiment
    if (entryId) {
      const { error: updateError } = await supabase
        .from("journal_entries")
        .update({ sentiment })
        .eq("id", entryId)
        .eq("user_id", user.id);

      if (updateError) {
        console.error("[analyze-journal-sentiment] Error updating journal entry:", updateError);
      } else {
        console.log(`[analyze-journal-sentiment] Successfully updated entry ${entryId}`);
      }
    }

    console.log(`[analyze-journal-sentiment] Success! Analyzed in ${responseTime}ms`);
    
    return new Response(
      JSON.stringify({ sentiment }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[analyze-journal-sentiment] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
