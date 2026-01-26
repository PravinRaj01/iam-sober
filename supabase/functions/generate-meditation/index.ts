import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sanitize user input to prevent prompt injection
function sanitizeInput(input: string, maxLength: number = 500): string {
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description, duration } = await req.json();
    
    // Sanitize user inputs
    const sanitizedTitle = sanitizeInput(title, 200);
    const sanitizedDescription = sanitizeInput(description, 1000);
    
    if (!sanitizedTitle || !sanitizedDescription) {
      throw new Error('Invalid title or description');
    }
    
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY is not configured');
    }

    const durationMinutes = Math.floor(duration / 60);
    const prompt = `Create a calming, guided meditation script for "${sanitizedTitle}".
    
    Description: ${sanitizedDescription}
    The meditation should be approximately ${durationMinutes} minutes long.
    
    The script should be ready to be read aloud by a text-to-speech engine.
    Do NOT include any headers, titles, or meta-instructions like "(Opening Music...)" or "**Introduction**".
    The script should flow as a single piece of spoken text.
    Indicate pauses in speech with [pause].
    
    The script should have three parts:
    1. A brief, welcoming introduction.
    2. The main meditation practice, focusing on recovery, self-compassion, and managing cravings. Include breathing instructions and mindfulness cues.
    3. A gentle closing.
    
    Use a calm, soothing, and compassionate tone.`;

    const systemPrompt = 'You are a compassionate meditation guide specializing in addiction recovery and emotional wellbeing. Create calming, supportive guided meditations.';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const meditationScript = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(
      JSON.stringify({ script: meditationScript }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating meditation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
