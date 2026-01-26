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

    console.log(`[generate-motivation] User: ${user.id}`);

    // Get user's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("addiction_type, sobriety_start_date")
      .eq("id", user.id)
      .single();

    // Calculate days sober
    const daysSober = Math.floor(
      (new Date().getTime() - new Date(profile?.sobriety_start_date || new Date()).getTime()) / (1000 * 60 * 60 * 24)
    );

    console.log(`[generate-motivation] Days sober: ${daysSober}, addiction: ${profile?.addiction_type}`);

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      console.error("[generate-motivation] GOOGLE_API_KEY not configured");
      throw new Error("GOOGLE_API_KEY not configured");
    }

    const prompt = `Generate a short, inspiring motivational message for someone in recovery from ${profile?.addiction_type || "addiction"}. They are ${daysSober} days into their journey. Keep it under 100 characters, positive, and encouraging.`;

    console.log("[generate-motivation] Calling Gemini API...");

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 100
            }
          }),
        }
      );

      const responseTime = Date.now() - startTime;
      console.log(`[generate-motivation] API response in ${responseTime}ms, status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[generate-motivation] API error:`, errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[generate-motivation] Raw AI response:`, JSON.stringify(data));
      
      let message = "Every day is a victory. Keep moving forward!";
      
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (generatedText) {
        let generated = generatedText.trim();
        
        // Remove quotes if present
        generated = generated.replace(/^["']|["']$/g, '');
        
        // If the message is already a good length, use it
        if (generated.length > 20 && generated.length < 200) {
          message = generated;
          // Ensure it ends with punctuation
          if (!/[.!?]$/.test(message)) {
            message += '.';
          }
        } else {
          // Try to extract first sentence
          const firstSentence = generated.split(/[.!?]/)[0];
          if (firstSentence && firstSentence.length > 20) {
            message = firstSentence + '.';
          }
        }
      }

      console.log(`[generate-motivation] Success! Generated: "${message}"`);
      
      return new Response(
        JSON.stringify({ message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("[generate-motivation] AI API error:", error);
      
      // Return fallback message
      const fallbackMessages = [
        "Every day sober is a victory. You're stronger than you know!",
        `${daysSober} days of courage and determination. Keep going!`,
        "Your journey matters. One day at a time, you're building a better future.",
        "Recovery is progress, not perfection. You're doing great!",
      ];
      
      return new Response(
        JSON.stringify({ 
          message: fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)]
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("[generate-motivation] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
