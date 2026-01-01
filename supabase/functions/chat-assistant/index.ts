import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.5-flash';

// System prompts for different operations
const SYSTEM_PROMPTS = {
  chat: `You are a strategic advisor for high-conflict co-parenting situations. You provide:
- Specific, actionable insights backed by evidence from the user's data
- Pattern recognition across communications and behaviors
- Strategic recommendations for documentation and response
- Draft communications that are court-ready, using BIFF principles (Brief, Informative, Friendly, Firm)
- Direct, honest assessments without excessive hedging

When analyzing, cite specific evidence. When drafting, remove emotion and focus on facts.`,

  parseFile: `You are a data extraction specialist. Extract conversation data from the provided image or text.
Return a JSON object with this exact structure:
{
  "title": "Brief descriptive title",
  "sourceType": "OFW" | "Email" | "SMS" | "Manual Note",
  "participants": ["Name1", "Name2"],
  "messages": [
    {
      "sender": "Name",
      "timestamp": "ISO date string or best estimate",
      "text": "Message content"
    }
  ],
  "startDate": "ISO date of first message"
}
Extract ALL messages visible. Preserve exact wording. Infer sourceType from formatting.`,

  analyzePerson: `You are a forensic behavioral analyst specializing in high-conflict family dynamics.
Provide a clinical assessment including:
1. Communication patterns and tendencies
2. Potential manipulation tactics or concerning behaviors
3. Recommended strategies for interaction
4. Key issues to monitor or document

Be direct and specific. Cite evidence from the provided data. Structure your response as JSON:
{
  "assessment": "Clinical summary paragraph",
  "patterns": ["Pattern 1", "Pattern 2"],
  "concerns": ["Concern 1", "Concern 2"],
  "strategies": ["Strategy 1", "Strategy 2"],
  "monitoringPriorities": ["Priority 1", "Priority 2"]
}`
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { operation, messages, fileData, personData, model } = await req.json();
    const selectedModel = model || DEFAULT_MODEL;

    console.log(`Processing operation: ${operation}, model: ${selectedModel}`);

    let systemPrompt: string;
    let userContent: any;
    let stream = false;

    switch (operation) {
      case 'chat':
        systemPrompt = SYSTEM_PROMPTS.chat;
        stream = true;
        break;

      case 'parse-file':
        systemPrompt = SYSTEM_PROMPTS.parseFile;
        if (fileData?.base64) {
          userContent = [
            { type: 'text', text: 'Extract conversation data from this image:' },
            { type: 'image_url', image_url: { url: fileData.base64 } }
          ];
        } else if (fileData?.text) {
          userContent = `Extract conversation data from this text:\n\n${fileData.text}`;
        } else {
          throw new Error('No file data provided');
        }
        break;

      case 'analyze-person':
        systemPrompt = SYSTEM_PROMPTS.analyzePerson;
        userContent = `Analyze this person based on the following data:\n\n${JSON.stringify(personData, null, 2)}`;
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    // Build messages array
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...(messages || []),
      ...(userContent ? [{ role: 'user', content: userContent }] : [])
    ];

    const requestBody: any = {
      model: selectedModel,
      messages: apiMessages,
    };

    if (stream) {
      requestBody.stream = true;
    }

    console.log(`Calling OpenRouter with ${apiMessages.length} messages`);

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'CoParent Intel'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter error: ${response.status} - ${errorText}`);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `OpenRouter API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For streaming responses, pass through the stream
    if (stream && response.body) {
      return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' }
      });
    }

    // For non-streaming, parse and return JSON
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenRouter response');
    }

    // Try to parse as JSON for structured responses
    let result;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content;
      result = JSON.parse(jsonStr);
    } catch {
      // Return raw content if not JSON
      result = { content };
    }

    console.log(`Operation ${operation} completed successfully`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in chat-assistant function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
