import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sanitize user input to prevent prompt injection
function sanitizeInput(input: string, maxLength: number = 2000): string {
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
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const startedAt = Date.now();
    console.log('[suggest-coping-strategies] Request started at', new Date(startedAt).toISOString());

    const { situation } = await req.json();
    if (!situation || typeof situation !== 'string' || !situation.trim()) {
      console.error('[suggest-coping-strategies] Missing or invalid "situation"');
      return new Response(JSON.stringify({ error: 'Missing or invalid "situation"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Sanitize user input
    const sanitizedSituation = sanitizeInput(situation, 1000);
    if (!sanitizedSituation) {
      console.error('[suggest-coping-strategies] Invalid situation after sanitization');
      return new Response(JSON.stringify({ error: 'Invalid situation content' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      console.error('[suggest-coping-strategies] GOOGLE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Generate 3 personalized coping strategies for someone in recovery who is experiencing the following situation: "${sanitizedSituation}"

Each strategy should include:
1. A clear, actionable title
2. A brief description of why this strategy is helpful
3. 2-3 specific action steps to implement the strategy

Format the response as a JSON array with objects containing "title", "description", and "actionSteps" (array).`;

    console.log('[suggest-coping-strategies] Calling Gemini API...');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[suggest-coping-strategies] AI API error ${response.status}: ${text}`);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    let content: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    console.log('[suggest-coping-strategies] Raw content length:', (content || '').length);

    const tryParse = (text: string) => {
      try { return JSON.parse(text); } catch { return null; }
    };

    let strategies: any[] = [];
    if (typeof content === 'string') {
      let cleaned = content.trim();
      // Remove code fences if present
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/,'').trim();
      }
      let parsed = tryParse(cleaned);

      // Fallback: extract first JSON array from the text
      if (!parsed) {
        const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          parsed = tryParse(arrayMatch[0]);
        }
      }

      if (Array.isArray(parsed)) {
        strategies = parsed;
      }
    }

    if (!Array.isArray(strategies)) strategies = [];
    const duration = Date.now() - startedAt;
    console.log(`[suggest-coping-strategies] Success. strategies=${strategies.length}, duration=${duration}ms`);

    return new Response(JSON.stringify({ strategies }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('[suggest-coping-strategies] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
