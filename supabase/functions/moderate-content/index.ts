const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NEGATIVE_PATTERNS = [
  /\b(stupid|idiot|loser|failure|worthless|pathetic)\b/gi,
  /\b(kill yourself|kys|die|hate you)\b/gi,
  /\b(f[u\*]ck|sh[i\*]t|damn|hell)\b/gi,
  /\b(useless|hopeless|waste)\b/gi,
];

const SPAM_PATTERNS = [
  /(.)\1{5,}/g, // Repeated characters
  /https?:\/\//gi, // URLs
  /\b(buy|sell|click|subscribe|follow me)\b/gi,
];

function moderateContent(text: string): { isAppropriate: boolean; reason?: string } {
  if (!text || text.trim().length === 0) {
    return { isAppropriate: false, reason: 'Content cannot be empty' };
  }

  // Check for excessive negativity
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(text)) {
      return { 
        isAppropriate: false, 
        reason: 'Content contains inappropriate language. Please keep messages supportive and constructive.' 
      };
    }
  }

  // Check for spam
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return { 
        isAppropriate: false, 
        reason: 'Content appears to be spam. Please share genuine recovery experiences.' 
      };
    }
  }

  // Check for all caps (potential shouting)
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.7 && text.length > 20) {
    return { 
      isAppropriate: false, 
      reason: 'Please avoid using excessive capital letters.' 
    };
  }

  return { isAppropriate: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, type = 'milestone' } = await req.json();

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // First, use regex-based moderation
    const regexModeration = moderateContent(content);

    if (!regexModeration.isAppropriate) {
      return new Response(
        JSON.stringify({ 
          appropriate: false, 
          reason: regexModeration.reason 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // For more nuanced content, use AI moderation with Gemini
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    
    // If no API key, fall back to regex-only moderation
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ appropriate: true }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const prompt = `You are a content moderator for a recovery support app. Analyze this ${type} content and determine if it's appropriate for a supportive recovery community.

Content: "${content}"

Respond with ONLY a JSON object: {"appropriate": true/false, "reason": "brief reason if not appropriate"}

Guidelines:
- Allow genuine expressions of struggle and emotion
- Allow discussions of addiction and recovery experiences
- Block harassment, hate speech, or content promoting substance use
- Block spam or promotional content
- Be lenient with minor language issues in emotional contexts`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 100,
            temperature: 0.1
          }
        }),
      }
    );

    if (!response.ok) {
      // Fallback to regex result if AI fails
      console.error('Gemini moderation failed, using regex fallback');
      return new Response(
        JSON.stringify({ appropriate: true }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    try {
      const result = JSON.parse(resultText);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    } catch {
      // If parsing fails, default to appropriate
      return new Response(
        JSON.stringify({ appropriate: true }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

  } catch (error) {
    console.error('Content moderation error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
