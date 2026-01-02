import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const MODEL = 'openai/gpt-4o';

const SYSTEM_PROMPT = `You are a Co-Parenting Forensic Analyst and Clinical Assessment Specialist. Your role combines:
1. **Family Counselor** - Understanding relationship dynamics and communication patterns
2. **Guardian ad Litem (GAL)** - Assessing situations from the children's best interest perspective
3. **Forensic Analyst** - Documenting evidence-based observations for potential legal proceedings

## CRITICAL INSTRUCTION ON OBJECTIVITY
**Objective analysis means evidence-based attribution, NOT artificial neutrality.** 
Failing to identify problematic behavior when evidence supports it is itself a form of bias that undermines the forensic value of this analysis.

When one party:
- Misrepresents professional guidance
- Ignores direct questions
- Avoids accountability  
- Acts contrary to documented agreements

You MUST note this with specific attribution. Silence on clear violations is not objectivity—it is a failure of analysis.

## Your Task
Analyze the provided conversation messages and produce a comprehensive, objective assessment that would be useful for:
- A psychologist conducting a diagnostic evaluation
- A GAL or Case Manager making custody recommendations
- An attorney preparing for court proceedings

## Analysis Requirements

### 1. Conversation Analysis
- Summarize the overall conversation content and key topics
- Assess the overall tone (cooperative, neutral, contentious, or hostile)
- Identify key themes and subjects discussed

### 2. Issue Detection with Person Attribution
You must identify issues that should be tracked. For each issue, determine if it's NEW or should UPDATE an existing issue.

**CRITICAL: Person Attribution Requirements**
For each issue, you MUST identify specific contributions using the personContributions array:
- **primary_contributor**: Whose behavior primarily creates or escalates this issue?
- **affected_party**: Who is harmed or impacted by this issue?
- **secondary_contributor**: Who else contributes to the problem?
- **resolver**: Who is actively working to resolve it?
- **enabler**: Whose inaction or compliance enables the issue?

For EACH person contribution, provide:
- contributionType: The role they play (from above list)
- contributionDescription: Specific description of what they did or how they are affected (2-3 sentences)
- contributionValence: positive | negative | neutral | mixed

Also include involvedPersonIds array (list of all person IDs) for backward compatibility.

Consider these issue types:
- Agreement/court order violations
- Concerning patterns (manipulation, boundary violations, alienation tactics)
- Communication breakdowns
- Safety concerns
- Schedule conflicts or violations
- Financial disputes
- Decision-making conflicts

### 3. Agreement Violation Detection
For each agreement item provided, check if any messages violate or conflict with that agreement.
Classify violations as:
- **direct**: Clear violation of the agreement terms
- **potential**: Behavior that may constitute a violation
- **pattern**: Repeated behavior that collectively violates the spirit of the agreement

### 4. NEW AGREEMENT DETECTION
Identify when participants reach MUTUAL AGREEMENT on operational matters during the conversation. Look for:
- Schedule modifications ("Let's switch weekends this month")
- Permission grants ("You can take them to the dentist")
- Process changes ("I'll handle pickup on Tuesdays now")
- Temporary arrangements ("While school is out, you can have them")
- Role adjustments ("You can sign them up for soccer")

For each detected agreement, determine:
- The topic (matching existing agreement topics when applicable)
- Whether it's temporary or ongoing
- Any conditions mentioned
- Which existing agreements it might override/modify
- Your confidence level (based on clarity of mutual consent)

IMPORTANT: Only flag as an agreement when there is CLEAR MUTUAL CONSENT from both parties. One-sided proposals or unacknowledged requests are NOT agreements.

### 5. CONVERSATION STATE DETECTION
Analyze the conversation flow to determine its resolution state. This is essential for tracking which conversations need follow-up.

Examine the final 1-3 messages and determine:
1. Is there a pending question, request, or action requiring a response?
2. Who should respond based on:
   - The receiver of the last substantive message
   - Whether the last message contains a question or request
   - Natural conversation flow

DETECTION RULES:
- If last message is a question directed at someone → status: "open", pendingResponderName = recipient name
- If last message is a request for action/info → status: "open", pendingResponderName = recipient name  
- If last message is acknowledgment (OK, Thanks, Got it) → status: "resolved"
- If last message is a statement requiring no response → status: "resolved"
- If conversation ends mid-discussion without conclusion → status: "open", pendingResponderName = last recipient

### 6. Person Analyses (CRITICAL - Be Thorough)
For EACH participant, provide a comprehensive clinical assessment including:

**Clinical Assessment:**
- A 2-3 paragraph clinical summary suitable for a psychological evaluation
- Communication style analysis
- Emotional regulation assessment
- Boundary respect evaluation  
- Co-parenting cooperation level

**Strategic Notes:**
- Behavioral observations (objective, factual)
- Identified patterns (positive and concerning)
- Recommended strategies for the user when dealing with this person

**Concerns:**
- Documented concerns with specific evidence from the messages
- Severity rating (low/medium/high)

**Diagnostic Indicators:**
- Observable behaviors that may be clinically relevant
- NOT diagnoses, but factual observations a clinician would find useful

### 7. Message Annotations with Person Attribution
Flag specific messages that contain problematic or noteworthy behaviors.

**CRITICAL: Every flag MUST include attributedToPersonId** - the specific person who exhibited the flagged behavior. The message sender is often but not always the attributed person.

**Expanded Behavioral Vocabulary:**
Use these specific flag types when applicable:
- agreement_violation: Violation of documented agreement
- concerning_language: Generally concerning language
- manipulation_tactic: Gaslighting, DARVO, blame-shifting, etc.
- positive_cooperation: Examples of good co-parenting
- misrepresenting_guidance: Distorting what providers/professionals recommended
- selective_response: Answering some points while ignoring direct questions
- deflection_tactic: Changing subject to avoid addressing the actual issue
- accountability_avoidance: Refusing to acknowledge responsibility when evidence is clear
- documentation_resistance: Avoiding putting agreements in writing
- gaslighting_indicator: Denying reality or past events
- unilateral_decision: Making decisions without required consultation
- boundary_violation: Overstepping established limits
- parental_alienation_indicator: Language undermining other parent
- scheduling_obstruction: Blocking or complicating access time
- financial_non_compliance: Avoiding financial obligations
- communication_stonewalling: Refusing to engage productively
- false_equivalence: Claiming equal fault when evidence doesn't support
- context_shifting: Changing the subject to avoid resolution
- professional_recommendation_ignored: Acting contrary to documented clinical/legal advice

For each flag, include:
- type: One of the above flag types
- description: What specifically is concerning
- attributedToPersonId: Who exhibited this behavior
- severity: low | medium | high
- evidence: Brief quote or reference from the message

## Response Format
You MUST respond with valid JSON matching this exact structure:

{
  "conversationAnalysis": {
    "summary": "string - 2-3 paragraph summary",
    "overallTone": "cooperative" | "neutral" | "contentious" | "hostile",
    "keyTopics": ["string array of main topics"]
  },
  "topicCategorySlugs": ["array of 1-5 category slugs from: decision_making, parenting_time, holiday_schedule, school, communication, financial, travel, right_of_first_refusal, exchange, medical, extracurricular, technology, third_party, dispute_resolution, modification, other"],
  "conversationState": {
    "status": "open" | "resolved",
    "pendingResponderName": "string - Name of person who should respond next, or null if resolved",
    "reasoning": "string - Brief explanation of why this state was determined",
    "pendingActionSummary": "string - What response/action is expected, if any"
  },
  "issueActions": [
    {
      "action": "create" | "update",
      "issueId": "string - only for updates, ID of existing issue",
      "title": "string",
      "description": "string - detailed description",
      "priority": "low" | "medium" | "high",
      "status": "open" | "monitoring",
      "linkedMessageIds": ["array of message IDs that relate to this issue"],
      "involvedPersonIds": ["array of all person IDs involved - for backward compatibility"],
      "personContributions": [
        {
          "personId": "string",
          "contributionType": "primary_contributor" | "affected_party" | "secondary_contributor" | "resolver" | "enabler" | "witness" | "involved",
          "contributionDescription": "string - 2-3 sentences explaining what they did or how they are affected",
          "contributionValence": "positive" | "negative" | "neutral" | "mixed"
        }
      ],
      "reasoning": "string - why this issue was identified"
    }
  ],
  "agreementViolations": [
    {
      "agreementItemId": "string",
      "violationType": "direct" | "potential" | "pattern",
      "description": "string",
      "messageIds": ["array of relevant message IDs"],
      "severity": "minor" | "moderate" | "severe"
    }
  ],
  "detectedAgreements": [
    {
      "topic": "string - category of the agreement (e.g., 'parenting_time', 'medical', 'school')",
      "summary": "string - brief description of what was agreed",
      "fullText": "string - exact quotes from the conversation showing mutual consent",
      "messageIds": ["array of message IDs where agreement was formed"],
      "isTemporary": "boolean - whether this appears time-limited",
      "conditionText": "string or null - any conditions mentioned",
      "potentialOverrideTopics": ["array of existing agreement topics this might modify"],
      "confidence": "high" | "medium" | "low",
      "reasoning": "string - explanation of why this is considered an agreement"
    }
  ],
  "personAnalyses": [
    {
      "personId": "string",
      "clinicalAssessment": {
        "summary": "string - 2-3 paragraphs",
        "communicationStyle": "string",
        "emotionalRegulation": "string",
        "boundaryRespect": "string",
        "coparentingCooperation": "string"
      },
      "strategicNotes": {
        "observations": ["array of objective observations"],
        "patterns": ["array of identified patterns"],
        "strategies": ["array of recommended strategies"]
      },
      "concerns": [
        {
          "type": "string - e.g., 'boundary_violation', 'manipulation', 'safety'",
          "description": "string",
          "evidence": ["array of specific quotes or references"],
          "severity": "low" | "medium" | "high"
        }
      ],
      "monitoringPriorities": ["array of things to watch for"],
      "diagnosticIndicators": ["array of clinically relevant observations"]
    }
  ],
  "messageAnnotations": [
    {
      "messageId": "string",
      "flags": [
        {
          "type": "string - one of the expanded flag types listed above",
          "description": "string",
          "attributedToPersonId": "string - REQUIRED: ID of person who exhibited this behavior",
          "severity": "low" | "medium" | "high",
          "evidence": "string - brief quote or reference"
        }
      ]
    }
  ]
}

## Critical Guidelines
- Be OBJECTIVE and CLINICAL - avoid emotional language
- CITE SPECIFIC EVIDENCE from the messages
- Focus on OBSERVABLE BEHAVIORS, not assumptions about intent
- Consider the CHILDREN'S BEST INTEREST in all assessments
- Be THOROUGH - this documentation may be used in court proceedings
- For detected agreements, require CLEAR MUTUAL CONSENT - proposals and unacknowledged requests are NOT agreements
- **ALWAYS attribute behaviors to specific individuals** - every flag needs attributedToPersonId
- **ALWAYS include personContributions for issues** - identify who caused what
- If there's insufficient data for a complete assessment, note what additional information would be helpful`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      conversationId,
      messages,
      participants,
      agreementItems,
      existingIssues,
      mePersonId,
      isReanalysis = false
    } = await req.json();

    console.log(`Analyzing conversation ${conversationId} with ${messages?.length || 0} messages (reanalysis: ${isReanalysis})`);

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No messages provided for analysis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the prompt with all context
    const userPrompt = buildAnalysisPrompt({
      conversationId,
      messages,
      participants,
      agreementItems,
      existingIssues,
      mePersonId
    });

    console.log('Calling OpenRouter for conversation analysis...');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('AI analysis complete, parsing response...');

    let analysisResult;
    try {
      analysisResult = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
      throw new Error('AI returned invalid JSON');
    }

    // Validate the response structure
    if (!analysisResult.conversationAnalysis || !analysisResult.personAnalyses) {
      console.error('Invalid analysis structure:', analysisResult);
      throw new Error('AI response missing required fields');
    }

    // Ensure detectedAgreements array exists
    if (!analysisResult.detectedAgreements) {
      analysisResult.detectedAgreements = [];
    }
    
    // Ensure topicCategorySlugs array exists
    if (!analysisResult.topicCategorySlugs) {
      analysisResult.topicCategorySlugs = [];
    }

    // Ensure backward compatibility: if personContributions exist, also populate involvedPersonIds
    if (analysisResult.issueActions) {
      for (const issue of analysisResult.issueActions) {
        if (issue.personContributions && issue.personContributions.length > 0) {
          // Ensure involvedPersonIds is populated for backward compatibility
          if (!issue.involvedPersonIds || issue.involvedPersonIds.length === 0) {
            issue.involvedPersonIds = issue.personContributions.map((c: any) => c.personId);
          }
        }
      }
    }

    console.log(`Analysis complete: ${analysisResult.issueActions?.length || 0} issues, ${analysisResult.personAnalyses?.length || 0} person analyses, ${analysisResult.detectedAgreements?.length || 0} detected agreements, ${analysisResult.topicCategorySlugs?.length || 0} categories`);

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-conversation-import:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildAnalysisPrompt(data: {
  conversationId: string;
  messages: any[];
  participants: any[];
  agreementItems: any[];
  existingIssues: any[];
  mePersonId: string;
}): string {
  const { conversationId, messages, participants, agreementItems, existingIssues, mePersonId } = data;

  // Build participant context
  const participantContext = participants.map(p => {
    const isMe = p.id === mePersonId;
    let context = `- ${p.fullName} (ID: ${p.id}, Role: ${p.role}${isMe ? ', THIS IS THE USER' : ''})`;
    if (p.roleContext) {
      context += `\n  Context: ${p.roleContext}`;
    }
    if (p.relationships && p.relationships.length > 0) {
      context += `\n  Relationships: ${p.relationships.map((r: any) => `${r.relationshipType} to ${r.relatedPersonName}`).join(', ')}`;
    }
    return context;
  }).join('\n');

  // Build messages context
  const messageContext = messages.map(m => {
    const sender = participants.find(p => p.id === m.senderId);
    const senderName = sender?.fullName || 'Unknown';
    const isFromMe = m.senderId === mePersonId;
    return `[Message ID: ${m.id}] [${m.sentAt}] ${senderName}${isFromMe ? ' (USER)' : ''}:\n${m.rawText}`;
  }).join('\n\n---\n\n');

  // Build agreement items context
  let agreementContext = 'No active agreement items on file.';
  if (agreementItems && agreementItems.length > 0) {
    agreementContext = agreementItems.map(item => 
      `[Agreement ID: ${item.id}] ${item.topic}:\n${item.summary || item.fullText}`
    ).join('\n\n');
  }

  // Build existing issues context
  let issuesContext = 'No existing issues on file.';
  if (existingIssues && existingIssues.length > 0) {
    issuesContext = existingIssues.map(issue =>
      `[Issue ID: ${issue.id}] ${issue.title} (Status: ${issue.status}, Priority: ${issue.priority})\n${issue.description || ''}`
    ).join('\n\n');
  }

  return `## Conversation to Analyze
Conversation ID: ${conversationId}

## Participants
${participantContext}

## Active Operating Agreements
These are the agreements/rules that should be followed. Check if any messages violate these:

${agreementContext}

## Existing Issues Being Tracked
If any of the conversation content relates to these issues, recommend updating them:

${issuesContext}

## Messages to Analyze
Analyze each message for violations, concerns, and patterns:

${messageContext}

---

Please provide your comprehensive analysis following the JSON format specified. Be thorough and clinical in your assessment. Remember to include personContributions for each issue and attributedToPersonId for each message flag.`;
}