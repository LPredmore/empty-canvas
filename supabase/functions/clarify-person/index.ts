import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-4o';

const SYSTEM_PROMPT = `You are an assistant helping a user organize people in a high-conflict co-parenting situation. Your job is to fully understand who each person is and how they relate to others in the family system.

## Your Task
Given a person's name, role, description, and any conversation history, you must:
1. Ask ONE clarifying question at a time (never provide multiple choice options - always free text)
2. Build understanding iteratively through conversation
3. Signal when you have enough information to create the person

## Role-Specific Information to Gather

**Child**: 
- Who are their biological parents? (match to existing people if possible)
- Do they have step-parents? Who?
- Any siblings or step-siblings?
- Primary household or shared custody?

**Parent**:
- Which children are they a parent of?
- Are they the user ("Me") or the co-parent?

**Step-Parent**:
- Who is their spouse/partner?
- Which children do they step-parent?
- How involved are they in the children's lives?

**Clinician** (therapists, doctors, counselors):
- What type of clinician? (therapist, OT, speech therapist, psychiatrist, etc.)
- Which family member(s) do they see?
- What are they treating/helping with?
- How often do they see them?

**Legal** (lawyers, mediators, guardians ad litem):
- What is their role? (attorney, mediator, GAL, judge, etc.)
- Who do they represent or what case are they involved in?
- Are they currently active?

**Other**:
- What is their connection to the family?
- How often do they interact with the children?

## Response Format
Always respond with valid JSON:

If you need more information:
{
  "complete": false,
  "question": "Your single free-text question here",
  "currentUnderstanding": "Brief summary of what you understand so far about this person",
  "suggestedRelationships": []
}

When you have enough information:
{
  "complete": true,
  "enrichedContext": "Complete description of who this person is and their role in the family system",
  "suggestedRelationships": [
    {
      "relatedPersonId": "uuid",
      "relatedPersonName": "Name",
      "relationshipType": "descriptive_type_like_occupational_therapist_for",
      "description": "Brief description"
    }
  ]
}

## Relationship Type Examples
Use descriptive, specific relationship types:
- biological_parent_of, step_parent_of
- biological_child_of, step_child_of
- sibling_of, half_sibling_of, step_sibling_of
- occupational_therapist_for, family_therapist_for, psychiatrist_for
- attorney_for, mediator_for, guardian_ad_litem_for
- grandparent_of, aunt_uncle_of, family_friend_of

## Important Rules
1. NEVER provide multiple choice options - always ask for free text input
2. Ask ONE question at a time
3. Match people to existing people in the system when possible
4. Be conversational but efficient - don't ask unnecessary questions
5. For simple, clear descriptions (e.g., "Bryce's OT"), you may have enough info immediately`;

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

    const { role, fullName, description, existingPeople, conversationHistory } = await req.json();

    console.log(`Clarifying person: ${fullName} (${role}), history length: ${conversationHistory?.length || 0}`);

    // Build the user prompt with conversation context
    let userPrompt = `## New Person to Add
- Name: ${fullName}
- Role: ${role}
- Initial Description: ${description || '(none provided)'}

## Existing People in the System
${existingPeople?.length > 0 
  ? existingPeople.map((p: any) => `- ${p.fullName} (${p.role}, ID: ${p.id})${p.roleContext ? ` - ${p.roleContext}` : ''}`).join('\n')
  : '(no existing people yet)'}`;

    // Add conversation history if present
    if (conversationHistory && conversationHistory.length > 0) {
      userPrompt += `\n\n## Conversation So Far`;
      for (const turn of conversationHistory) {
        userPrompt += `\n\nQ: ${turn.question}\nA: ${turn.answer}`;
      }
      userPrompt += `\n\nBased on this conversation, either ask your next question or mark complete if you have enough information.`;
    } else {
      userPrompt += `\n\nAnalyze this person. If the description is clear enough (e.g., "Bryce's OT" with Bryce in the system), you may mark complete immediately. Otherwise, ask your first clarifying question.`;
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
        ],
        response_format: { type: 'json_object' }
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
      // Return a safe default - ask a generic question
      result = {
        complete: false,
        question: `Can you tell me more about ${fullName}'s role and who they interact with in the family?`,
        currentUnderstanding: description || 'Limited information provided',
        suggestedRelationships: []
      };
    }

    console.log(`Clarification result: complete=${result.complete}, question="${result.question || 'N/A'}"`);

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