import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

interface AmendRequest {
  currentSummary: string;
  userGuidance: string;
  conversationMessages: Array<{
    senderName: string;
    body: string;
    sentAt: string;
  }>;
}

const SYSTEM_PROMPT = `You are a Summary Amendment Reviewer for family conflict documentation.

TASK: Evaluate whether the user's requested amendment is factually supported by the conversation messages provided. If supported, incorporate it into the summary. If not supported, return the original summary unchanged.

CRITICAL RULES:
1. Compare the request against the actual messages provided below
2. If the request is NOT supported by evidence in the messages, return the original summary EXACTLY as provided - do not modify it at all
3. If the request IS supported by evidence, amend the summary to incorporate the valid points
4. Maintain the same professional, objective tone as the original summary
5. Never add accusations, conclusions, or characterizations not directly evidenced in the messages
6. Do not add any meta-commentary about your decision or whether you amended the summary
7. If the request contains multiple points, only incorporate those that ARE supported - ignore unsupported points

EVALUATION CRITERIA:
- Is the requested amendment factually accurate per the messages?
- Is it appropriate for professional documentation?
- Does it maintain objectivity and evidence-based standards?

If ANY of these are not met for a particular claim, do NOT include that claim in the summary.

OUTPUT: Return ONLY the summary text (either amended or original). No explanations, no JSON wrapper, no prefixes like "Summary:" - just the summary text itself.`;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY not configured');
      throw new Error('API key not configured');
    }

    const body: AmendRequest = await req.json();
    const { currentSummary, userGuidance, conversationMessages } = body;

    if (!currentSummary || !userGuidance || !conversationMessages) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Amend request received. Guidance: "${userGuidance.slice(0, 100)}..."`);
    console.log(`Messages count: ${conversationMessages.length}`);

    // Format messages for context
    const messagesContext = conversationMessages
      .map((m, i) => `[${i + 1}] ${m.senderName} (${m.sentAt}): ${m.body}`)
      .join('\n\n');

    const userPrompt = `CURRENT SUMMARY:
${currentSummary}

USER'S AMENDMENT REQUEST:
${userGuidance}

CONVERSATION MESSAGES (for evidence validation):
${messagesContext}

Based on the above, return the appropriate summary (amended if supported by evidence, or original if not).`;

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'Co-Parenting Assistant'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const result = await response.json();
    const amendedSummary = result.choices?.[0]?.message?.content?.trim();

    if (!amendedSummary) {
      console.error('No content in response');
      throw new Error('No content in API response');
    }

    console.log(`Amendment complete. Summary length: ${amendedSummary.length} chars`);

    // Return just the summary text as a string
    return new Response(
      JSON.stringify(amendedSummary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in amend-analysis-summary:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
