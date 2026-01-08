import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4.1';

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

CRITICAL MESSAGE BOUNDARY RULES:
- A new message ONLY starts when there is a clear new sender/author line or header
- DO NOT split a single message into multiple messages based on paragraph breaks
- DO NOT treat "Thank you", "Hello", "Hi", "Yes", "No", etc. at the start of a paragraph as a new message
- Multiple paragraphs from the same sender in the same email/message = ONE message
- Only create separate messages when you can clearly identify DIFFERENT senders or DIFFERENT timestamps/date headers
- When in doubt, keep content as a single message rather than splitting

Return a JSON object with this exact structure:
{
  "title": "Brief descriptive title",
  "sourceType": "OFW" | "Email" | "SMS" | "Manual Note",
  "participants": ["Name1", "Name2"],
  "messages": [
    {
      "sender": "Name",
      "timestamp": "ISO date string or best estimate",
      "text": "Complete message content - include ALL paragraphs from this sender's message"
    }
  ],
  "startDate": "ISO date of first message"
}
Extract ALL messages visible. Preserve exact wording. Include all paragraphs per message. Infer sourceType from formatting.`,

  analyzePerson: `You are a forensic behavioral analyst specializing in high-conflict family dynamics.
Provide a clinical assessment including:
1. Communication patterns and tendencies
2. Potential manipulation tactics or concerning behaviors
3. Recommended strategies for interaction
4. Key issues to monitor or document

Consider the person's role context (their description and purpose in the family system) when analyzing.

Be direct and specific. Cite evidence from the provided data. Structure your response as JSON:
{
  "assessment": "Clinical summary paragraph",
  "patterns": ["Pattern 1", "Pattern 2"],
  "concerns": ["Concern 1", "Concern 2"],
  "strategies": ["Strategy 1", "Strategy 2"],
  "monitoringPriorities": ["Priority 1", "Priority 2"]
}`,

  extractEntities: `You are an entity extraction specialist for a co-parenting case management system.
Given a user message and a list of people in the case, identify:
1. Which people are being discussed (by name, nickname, or role like "my ex", "the therapist", "our daughter")
2. What topics are being referenced that might relate to tracked issues
3. Whether the user is asking about rules, agreements, or legal documents
4. Whether the user is asking about past conversations or communications

IMPORTANT: 
- Include "Me" or the user themselves if they are part of the conversation being discussed
- Match partial names (e.g., "James" matches "James Smith")
- Match role references (e.g., "my ex" likely refers to a Parent role, "the kids" to Child roles)

Return ONLY valid JSON with no markdown formatting:
{
  "mentionedPeopleIds": ["id1", "id2"],
  "topicKeywords": ["schedule", "custody"],
  "needsRules": true,
  "needsConversations": true,
  "reasoning": "Brief explanation of why these were selected"
}`
};

/**
 * Build a context-aware system prompt with case data
 */
function buildContextualSystemPrompt(context: any): string {
  const sections: string[] = [];
  
  sections.push(`You are CoParent Intel, a forensic advisor for high-conflict co-parenting.

## YOUR MANDATE
- NEVER give generic platitudes. ALWAYS cite specific evidence from the case data below.
- When drafting responses: Court-ready, BIFF-compliant (Brief, Informative, Friendly, Firm)
- When analyzing: Reference specific dates, quotes, and agreement clauses
- If a rule exists that applies, CITE IT by topic name

## CRITICAL RULES
1. Reference the case data below - never ask for information that's provided
2. Be direct and specific - cite dates, names, and evidence
3. Identify manipulation tactics, JADE violations, baiting attempts
4. Draft communications that remove emotion and focus on verifiable facts
5. If asked about someone not in the data, say so clearly

---`);

  // PEOPLE section
  if (context.people?.length > 0) {
    sections.push(`## PEOPLE INVOLVED IN THIS CONVERSATION\n`);
    for (const person of context.people) {
      const notes = context.profileNotes?.filter((n: any) => n.personId === person.id) || [];
      const rels = context.relationships?.filter((r: any) => 
        r.personId === person.id || r.relatedPersonId === person.id
      ) || [];
      
      const relText = rels.length > 0 
        ? rels.map((r: any) => `${r.relationshipType}: ${r.description || 'N/A'}`).join(', ')
        : 'None documented';
      
      const noteText = notes.length > 0
        ? notes.map((n: any) => `- [${n.type}] ${n.content}`).join('\n')
        : '- None on file';
      
      sections.push(`### ${person.fullName} (${person.role})
Context: ${person.roleContext || 'None specified'}
Relationships: ${relText}
Clinical Notes:
${noteText}`);
    }
  }

  // ISSUES section
  if (context.issues?.length > 0) {
    sections.push(`\n## TRACKED ISSUES INVOLVING THESE PEOPLE\n`);
    for (const issue of context.issues) {
      sections.push(`### ${issue.title} [${issue.status} / ${issue.priority}]
${issue.description}
Last Updated: ${issue.updatedAt}`);
    }
  }

  // RULES section
  if (context.rules?.length > 0) {
    sections.push(`\n## APPLICABLE RULES & AGREEMENTS\n`);
    for (const rule of context.rules) {
      const text = rule.summary || (rule.fullText?.substring(0, 300) + '...');
      sections.push(`- **[${rule.topic}]** ${text}`);
    }
  }

  // RECENT MESSAGES section
  if (context.messages?.length > 0) {
    sections.push(`\n## RECENT COMMUNICATIONS\n`);
    // Group by conversation
    const grouped: Record<string, any[]> = {};
    for (const m of context.messages) {
      if (!grouped[m.conversationId]) grouped[m.conversationId] = [];
      grouped[m.conversationId].push(m);
    }
    
    for (const [convId, msgs] of Object.entries(grouped)) {
      const conv = context.conversations?.find((c: any) => c.id === convId);
      sections.push(`### ${conv?.title || 'Conversation'} (${conv?.sourceType || 'Unknown source'})`);
      for (const msg of (msgs as any[]).slice(-15)) {
        const sender = context.people?.find((p: any) => p.id === msg.senderId);
        const truncatedText = msg.rawText?.length > 250 
          ? msg.rawText.substring(0, 250) + '...' 
          : msg.rawText;
        sections.push(`[${msg.sentAt}] ${sender?.fullName || 'Unknown'}: "${truncatedText}"`);
      }
    }
  }

  // CONVERSATION ANALYSES section
  if (context.conversationAnalyses?.length > 0) {
    sections.push(`\n## PRIOR CONVERSATION ANALYSES\n`);
    for (const analysis of context.conversationAnalyses) {
      const summary = analysis.summary?.substring(0, 200) || 'No summary';
      sections.push(`- **Tone: ${analysis.overallTone}** - ${summary}`);
    }
  }

  return sections.join('\n\n');
}

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

    const { operation, messages, fileData, personData, model, peopleList, context } = await req.json();
    const selectedModel = model || DEFAULT_MODEL;

    console.log(`Processing operation: ${operation}, model: ${selectedModel}`);

    let systemPrompt: string;
    let userContent: any;
    let stream = false;

    switch (operation) {
      case 'chat':
        // Use context-aware prompt if context is provided
        if (context && Object.keys(context).length > 0) {
          systemPrompt = buildContextualSystemPrompt(context);
        } else {
          systemPrompt = SYSTEM_PROMPTS.chat;
        }
        stream = true;
        break;

      case 'extract-entities':
        systemPrompt = SYSTEM_PROMPTS.extractEntities;
        userContent = JSON.stringify({
          userMessage: messages[messages.length - 1]?.content || '',
          availablePeople: peopleList || []
        });
        stream = false; // Must be non-streaming for JSON parsing
        break;

      case 'parse-file':
        systemPrompt = SYSTEM_PROMPTS.parseFile;
        if (fileData?.base64) {
          // Single image (screenshot, photo)
          userContent = [
            { type: 'text', text: 'Extract conversation data from this image:' },
            { type: 'image_url', image_url: { url: fileData.base64 } }
          ];
        } else if (fileData?.images && Array.isArray(fileData.images)) {
          // Multiple images (scanned PDF pages)
          userContent = [
            { type: 'text', text: `Extract conversation data from these ${fileData.images.length} PDF pages. Combine all messages into a single chronological list:` },
            ...fileData.images.map((img: string) => ({ 
              type: 'image_url', 
              image_url: { url: img } 
            }))
          ];
        } else if (fileData?.text) {
          // Text content (extracted PDF text or text file)
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

    // Estimate token count and reject oversized requests before API call
    const estimateTokens = (content: any): number => {
      if (typeof content === 'string') {
        return Math.ceil(content.length / 4);
      }
      if (Array.isArray(content)) {
        return content.reduce((sum: number, item: any) => {
          if (item.type === 'text') return sum + Math.ceil((item.text?.length || 0) / 4);
          if (item.type === 'image_url') return sum + 2000; // Conservative per-image estimate
          return sum;
        }, 0);
      }
      return Math.ceil(JSON.stringify(content).length / 4);
    };

    const totalTokens = apiMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
    if (totalTokens > 100000) {
      console.error(`Request too large: estimated ${totalTokens} tokens`);
      return new Response(
        JSON.stringify({ 
          error: 'File content exceeds maximum size. Please use a smaller file or split into multiple uploads.',
          estimatedTokens: totalTokens
        }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody: any = {
      model: selectedModel,
      messages: apiMessages,
    };

    if (stream) {
      requestBody.stream = true;
    }

    console.log(`Calling OpenRouter with ${apiMessages.length} messages, estimated ${totalTokens} tokens`);

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
