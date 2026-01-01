import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o';

const SYSTEM_PROMPT = `You are an assistant helping a user organize people in a high-conflict co-parenting situation.

When given a new person's name, role, and description, analyze the information and:

1. If the description clearly identifies relationships to existing people (e.g., "Bryce's OT" matches an existing child named Bryce), suggest those relationships.

2. If the description is ambiguous or missing important context for the role, ask clarifying questions. Be minimal - only ask what's necessary.

Role-specific clarifications needed:
- therapist: What type of therapy? Which family member(s) do they treat?
- step_parent: Which child are they a step-parent to?
- lawyer: Whose lawyer are they? What type of law?
- other: What is their connection to the family situation?

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "id": "unique_id",
      "question": "The question to ask",
      "type": "select" | "text",
      "options": ["Option1", "Option2"] // only for select type
    }
  ],
  "suggestedRelationships": [
    {
      "relatedPersonId": "uuid of matched person",
      "relatedPersonName": "Name of matched person",
      "relationshipType": "therapist_for" | "step_parent_of" | "lawyer_for" | "parent_of" | "sibling_of" | "professional_for" | "other",
      "description": "Brief description of the relationship"
    }
  ],
  "enrichedContext": "A cleaner, more complete version of the role context incorporating any inferences made"
}

If no questions are needed and relationships are clear, return empty questions array.
If no relationships can be inferred, return empty suggestedRelationships array.
Always return enrichedContext with the best understanding of who this person is.`;

serve(async (req) => {
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

    const { role, fullName, description, existingPeople, answers } = await req.json();

    console.log(`Clarifying person: ${fullName} (${role})`);

    let userPrompt = `New person to add:
- Name: ${fullName}
- Role: ${role}
- Description: ${description || '(none provided)'}

Existing people in the system:
${existingPeople?.length > 0 
  ? existingPeople.map((p: any) => `- ${p.fullName} (${p.role}, ID: ${p.id})`).join('\n')
  : '(no existing people)'}`;

    if (answers && Object.keys(answers).length > 0) {
      userPrompt += `\n\nUser provided these answers to previous questions:
${Object.entries(answers).map(([q, a]) => `- ${q}: ${a}`).join('\n')}

Now provide the final enrichedContext and any relationships based on these answers. Do not ask more questions.`;
    }

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'CoParent Intel'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      })
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
        JSON.stringify({ error: `API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in response');
    }

    // Parse JSON from response
    let result;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content;
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Return safe default
      result = {
        questions: [],
        suggestedRelationships: [],
        enrichedContext: description || ''
      };
    }

    console.log(`Clarification complete: ${result.questions?.length || 0} questions, ${result.suggestedRelationships?.length || 0} relationships`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in clarify-person function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
