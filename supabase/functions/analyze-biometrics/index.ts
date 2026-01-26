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

    const { biometricData } = await req.json();

    // Save biometric data
    const { data: savedData, error: saveError } = await supabase
      .from("biometric_logs")
      .insert({
        user_id: user.id,
        heart_rate: biometricData.heart_rate,
        sleep_hours: biometricData.sleep_hours,
        steps: biometricData.steps,
        stress_level: biometricData.stress_level,
        hrv: biometricData.hrv,
        blood_oxygen: biometricData.blood_oxygen,
        source: biometricData.source || "manual",
        notes: biometricData.notes,
        logged_at: biometricData.logged_at || new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      throw new Error(`Failed to save biometric data: ${saveError.message}`);
    }

    // Fetch historical data for analysis
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: historicalData } = await supabase
      .from("biometric_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("logged_at", weekAgo.toISOString())
      .order("logged_at", { ascending: true });

    // Fetch check-in data for correlation
    const { data: checkIns } = await supabase
      .from("check_ins")
      .select("mood, urge_intensity, created_at")
      .eq("user_id", user.id)
      .gte("created_at", weekAgo.toISOString())
      .order("created_at", { ascending: true });

    // Get user profile for context
    const { data: profile } = await supabase
      .from("profiles")
      .select("pseudonym, addiction_type, sobriety_start_date")
      .eq("id", user.id)
      .single();

    const daysSober = profile?.sobriety_start_date
      ? Math.floor((Date.now() - new Date(profile.sobriety_start_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Call Google Gemini API for analysis
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY not configured");
    }

    const systemPrompt = `You are a health data analyst for a recovery app. Analyze biometric data and correlate it with recovery patterns. Provide actionable insights without making medical diagnoses. Focus on:
1. Sleep quality and its impact on cravings
2. Stress patterns and recovery challenges
3. Activity levels and mood correlation
4. Specific recommendations for the user

Keep response concise and supportive. Format as JSON with fields: insights (array of {title, description, severity}), recommendations (array of strings), correlations (array of {factor1, factor2, relationship}), risk_level (low/medium/high).`;

    const userPrompt = `Analyze this health data for ${profile?.pseudonym || "User"} (${daysSober} days in recovery from ${profile?.addiction_type || "addiction"}):

Current biometrics:
- Heart Rate: ${biometricData.heart_rate || "N/A"} bpm
- Sleep: ${biometricData.sleep_hours || "N/A"} hours
- Steps: ${biometricData.steps || "N/A"}
- Stress Level: ${biometricData.stress_level || "N/A"}/10
- HRV: ${biometricData.hrv || "N/A"} ms
- Blood Oxygen: ${biometricData.blood_oxygen || "N/A"}%

Historical data (${historicalData?.length || 0} entries this week):
${JSON.stringify(historicalData?.slice(-5) || [], null, 2)}

Recent check-ins (${checkIns?.length || 0} this week):
${JSON.stringify(checkIns?.slice(-5) || [], null, 2)}

Provide analysis and recommendations. Respond with valid JSON only.`;

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            responseMimeType: "application/json"
          }
        }),
      }
    );

    let analysis;
    
    if (!aiResponse.ok) {
      // Fallback analysis if AI fails
      console.error("AI analysis failed, using fallback");
      
      analysis = {
        insights: [
          {
            title: "Data Recorded",
            description: "Your biometric data has been saved successfully.",
            severity: "info"
          }
        ],
        recommendations: [
          "Continue tracking your health metrics regularly",
          "Aim for 7-8 hours of sleep per night",
          "Try to manage stress through breathing exercises"
        ],
        correlations: [],
        risk_level: "low"
      };
    } else {
      const aiData = await aiResponse.json();
      try {
        const responseText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        analysis = JSON.parse(responseText);
      } catch {
        analysis = {
          insights: [{ title: "Analysis Complete", description: aiData.candidates?.[0]?.content?.parts?.[0]?.text || "Analysis completed", severity: "info" }],
          recommendations: [],
          correlations: [],
          risk_level: "low"
        };
      }
    }

    // Log observability
    await supabase.from("ai_observability_logs").insert({
      user_id: user.id,
      function_name: "analyze-biometrics",
      input_summary: `HR:${biometricData.heart_rate} Sleep:${biometricData.sleep_hours} Stress:${biometricData.stress_level}`,
      response_summary: JSON.stringify(analysis.insights?.slice(0, 2) || []),
      response_time_ms: Date.now() - startTime,
      model_used: "gemini-2.5-flash-lite"
    });

    return new Response(JSON.stringify({
      saved: savedData,
      analysis,
      historical_count: historicalData?.length || 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Error in analyze-biometrics:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
