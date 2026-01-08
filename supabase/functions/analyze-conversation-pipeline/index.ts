import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const MODEL = 'openai/gpt-4o';

const STAGES = [
  { id: 'conversation_map', name: 'Mapping Conversation' },
  { id: 'claims_verification', name: 'Verifying Claims' },
  { id: 'issue_linking', name: 'Linking Issues' },
  { id: 'issue_detection', name: 'Detecting New Issues' },
  { id: 'agreement_checks', name: 'Checking Agreements' },
  { id: 'person_analysis', name: 'Analyzing Participants' },
  { id: 'message_annotation', name: 'Annotating Messages' },
  { id: 'synthesis', name: 'Synthesizing Results' }
];

// Base system prompt for all stages
const BASE_SYSTEM = `You are a Family Conflict Case Documentation Analyst. Your job is to produce objective, evidence-cited documentation of written communications between family members/stakeholders in conflict.

Your analysis must be usable as a professional case record. You do not provide therapy, legal advice, custody recommendations, or diagnoses.

## CRITICAL STANDARD ON OBJECTIVITY
Objectivity means evidence-based attribution, not artificial neutrality.

If the text shows a participant engaging in behavior that blocks resolution (e.g., refusing to answer direct questions, materially contradicting documented guidance, deflecting, stonewalling, violating agreements), you must document it plainly and attribute it to the specific person with evidence.

## EVIDENCE CONTRACT
For any material conclusion, you must provide:
1. **WHO** did it (by name / personId),
2. **WHAT** they did (behavioral description),
3. **EVIDENCE** (brief quote or message reference),
4. **VERIFICATION STATUS** when applicable: Supported / Contradicted / Ambiguous,
5. **FUNCTIONAL IMPACT**: how it affects cooperation and resolution.

Always respond with valid JSON.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch (e) {
          console.error('Failed to send SSE event:', e);
        }
      };

      try {
        const payload = await req.json();
        const {
          conversationId,
          messages,
          participants,
          agreementItems,
          existingIssues,
          mePersonId,
          userGuidance,
          resumeFromStage,
          priorOutputs
        } = payload;

        console.log(`Pipeline analysis for ${conversationId} with ${messages?.length || 0} messages`);

        if (!messages || messages.length === 0) {
          send({ type: 'error', message: 'No messages provided for analysis' });
          controller.close();
          return;
        }

        // Build shared context
        const context = buildContext(conversationId, messages, participants, agreementItems, existingIssues, mePersonId, userGuidance);
        
        // Determine starting point
        const startIndex = resumeFromStage 
          ? STAGES.findIndex(s => s.id === resumeFromStage)
          : 0;
        
        const outputs: Record<string, unknown> = priorOutputs || {};

        for (let i = startIndex; i < STAGES.length; i++) {
          const stage = STAGES[i];
          
          send({ 
            type: 'stage_start', 
            stage: stage.id, 
            stageName: stage.name,
            stageNumber: i + 1, 
            totalStages: STAGES.length 
          });

          const startTime = Date.now();
          
          try {
            const result = await executeStage(stage.id, context, outputs);
            outputs[stage.id] = result;
            
            console.log(`Stage ${stage.id} complete in ${Date.now() - startTime}ms`);
            
            send({ 
              type: 'stage_complete', 
              stage: stage.id, 
              duration: Date.now() - startTime 
            });
            
          } catch (stageError) {
            console.error(`Stage ${stage.id} failed:`, stageError);
            send({ 
              type: 'stage_error', 
              stage: stage.id, 
              message: stageError instanceof Error ? stageError.message : 'Stage failed',
              completedStages: STAGES.slice(0, i).map(s => s.id)
            });
            controller.close();
            return;
          }
        }

        // Combine all outputs into final result
        const finalResult = assembleResult(outputs);
        
        console.log(`Pipeline complete: ${finalResult.issueActions?.length || 0} issues, ${finalResult.personAnalyses?.length || 0} person analyses`);
        
        send({ type: 'complete', result: finalResult });
        controller.close();

      } catch (error) {
        console.error('Pipeline error:', error);
        send({ type: 'error', message: error instanceof Error ? error.message : 'Pipeline failed' });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
});

interface AnalysisContext {
  conversationId: string;
  messages: any[];
  participants: any[];
  agreementItems: any[];
  existingIssues: any[];
  mePersonId: string;
  userGuidance?: string;
  idReference: string;
  participantContext: string;
  messageContext: string;
  agreementContext: string;
  issueContext: string;
}

function buildContext(
  conversationId: string,
  messages: any[],
  participants: any[],
  agreementItems: any[],
  existingIssues: any[],
  mePersonId: string,
  userGuidance?: string
): AnalysisContext {
  const idReference = participants.map(p => `- ${p.fullName} → ${p.id}`).join('\n');

  const participantContext = participants.map(p => {
    const isMe = p.id === mePersonId;
    return `- ${p.fullName} (Role: ${p.role}${isMe ? ' - THIS IS THE USER' : ''})${p.roleContext ? ` - Context: ${p.roleContext}` : ''}`;
  }).join('\n');

  const messageContext = messages.map(m => {
    const sender = participants.find((p: any) => p.id === m.senderId);
    const receiver = participants.find((p: any) => p.id === m.receiverId);
    return `[${m.id}] ${m.sentAt} - ${sender?.fullName || 'Unknown'} → ${receiver?.fullName || 'Unknown'}:\n${m.rawText}`;
  }).join('\n\n');

  let agreementContext = 'No formal agreements on file.';
  if (agreementItems && agreementItems.length > 0) {
    agreementContext = agreementItems.map(a => 
      `- [${a.id}] ${a.topic}: ${a.summary || a.fullText?.substring(0, 200)}...`
    ).join('\n');
  }

  let issueContext = 'No existing issues tracked.';
  if (existingIssues && existingIssues.length > 0) {
    issueContext = existingIssues.map(i =>
      `- [${i.id}] ${i.title} (${i.status}, ${i.priority} priority)\n  Description: ${i.description || 'No description provided'}`
    ).join('\n\n');
  }

  return {
    conversationId,
    messages,
    participants,
    agreementItems,
    existingIssues,
    mePersonId,
    userGuidance,
    idReference,
    participantContext,
    messageContext,
    agreementContext,
    issueContext
  };
}

async function executeStage(
  stageId: string, 
  context: AnalysisContext,
  priorOutputs: Record<string, unknown>
): Promise<unknown> {
  const { systemPrompt, userPrompt } = getStagePrompts(stageId, context, priorOutputs);

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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenRouter error for ${stageId}:`, response.status, errorText);
    throw new Error(`AI call failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in AI response');
  }

  return JSON.parse(content);
}

function getStagePrompts(
  stageId: string, 
  context: AnalysisContext,
  priorOutputs: Record<string, unknown>
): { systemPrompt: string; userPrompt: string } {
  const baseContext = `
### Person ID Reference (for JSON personId fields only):
${context.idReference}

### Participants:
${context.participantContext}

### Messages:
${context.messageContext}
`;

  switch (stageId) {
    case 'conversation_map':
      return {
        systemPrompt: BASE_SYSTEM + `\n\nYour task is to create a conversation map: identify main topics, key asks/questions, decisions made, and overall tone.`,
        userPrompt: `${baseContext}

Analyze this conversation and produce a summary.

Return JSON:
{
  "summary": "2-3 paragraph professional case synopsis covering: core topics, what each party is seeking, key interaction behaviors with attribution, resolution status",
  "overallTone": "cooperative" | "neutral" | "tense" | "contentious" | "hostile",
  "keyTopics": ["array of main topics discussed"],
  "keyAsks": ["array of key questions/requests and who made them"],
  "decisionsOrCommitments": ["array of any decisions or commitments made"]
}`
      };

    case 'claims_verification':
      return {
        systemPrompt: BASE_SYSTEM + `\n\nYour task is to build a Claims Ledger verifying consequential claims about professional guidance, agreements, facts, accusations, and commitments.`,
        userPrompt: `${baseContext}

Build a Claims Ledger for the most consequential claims in this conversation.

For each claim include:
- claimText: the actual claim made
- speakerPersonId: UUID of who made it
- category: professional_guidance | agreement | factual | accusation | commitment | process
- evidence: quote or message reference
- verificationStatus: supported | contradicted | ambiguous
- notes: brief explanation of verification status

Return JSON:
{
  "claimsLedger": [
    {
      "claimText": "string",
      "speakerPersonId": "UUID",
      "category": "string",
      "evidence": "string",
      "verificationStatus": "string",
      "notes": "string"
    }
  ]
}`
      };

    case 'issue_linking':
      return {
        systemPrompt: BASE_SYSTEM + `\n\nYour task is to evaluate EVERY existing issue for relevance to this conversation and create update actions for relevant ones.`,
        userPrompt: `${baseContext}

### Existing Issues to Evaluate:
${context.issueContext}

For EACH existing issue, determine if this conversation is relevant. A conversation is relevant if it:
- Discusses the same topic, even tangentially
- Provides new evidence or context
- Shows behavior patterns related to the issue
- References decisions, agreements, or disputes connected to the issue

Most conversations relate to 2-5 existing issues. Err on the side of linking.

Return JSON:
{
  "issueActions": [
    {
      "action": "update",
      "issueId": "existing issue UUID",
      "title": "issue title",
      "description": "updated description if needed",
      "priority": "low" | "medium" | "high",
      "status": "open" | "monitoring",
      "linkedMessageIds": ["relevant message IDs"],
      "personContributions": [
        {
          "personId": "UUID",
          "contributionType": "primary_contributor" | "affected_party" | "secondary_contributor" | "resolver" | "enabler" | "involved",
          "contributionDescription": "2-3 sentences with evidence",
          "contributionValence": "positive" | "negative" | "neutral" | "mixed"
        }
      ],
      "reasoning": "why this conversation relates to the issue"
    }
  ]
}`
      };

    case 'issue_detection':
      const linkedIssueIds = ((priorOutputs.issue_linking as any)?.issueActions || [])
        .map((a: any) => a.issueId);
      return {
        systemPrompt: BASE_SYSTEM + `\n\nYour task is to identify NEW behavioral issues that should be tracked, distinct from already-linked existing issues.`,
        userPrompt: `${baseContext}

### Already-Linked Existing Issue IDs (do not duplicate these):
${linkedIssueIds.join(', ') || 'None'}

### Conversation Summary:
${(priorOutputs.conversation_map as any)?.summary || 'Not available'}

Identify any NEW issues that should be tracked. Focus on:
- Clear patterns of concerning behavior
- Resolution-blocking behaviors
- Safety concerns
- Agreement/guidance violations

Return JSON:
{
  "issueActions": [
    {
      "action": "create",
      "title": "clear, specific issue title",
      "description": "detailed description grounded in evidence",
      "priority": "low" | "medium" | "high",
      "status": "open",
      "linkedMessageIds": ["message IDs showing this issue"],
      "personContributions": [
        {
          "personId": "UUID",
          "contributionType": "primary_contributor" | "affected_party" | "secondary_contributor" | "resolver",
          "contributionDescription": "2-3 sentences with evidence",
          "contributionValence": "positive" | "negative" | "neutral" | "mixed"
        }
      ],
      "reasoning": "why this issue matters and its impact"
    }
  ]
}`
      };

    case 'agreement_checks':
      return {
        systemPrompt: BASE_SYSTEM + `\n\nYour task is to check for agreement violations and detect new mutual agreements formed in the conversation.`,
        userPrompt: `${baseContext}

### Active Agreements:
${context.agreementContext}

1. Check if any messages conflict with active agreements.
2. Identify if participants reached any NEW mutual agreements (requires clear mutual consent, not just proposals).

Return JSON:
{
  "agreementViolations": [
    {
      "agreementItemId": "UUID of violated agreement",
      "violationType": "direct" | "potential" | "pattern",
      "description": "what was violated and how",
      "messageIds": ["relevant message IDs"],
      "severity": "minor" | "moderate" | "severe"
    }
  ],
  "detectedAgreements": [
    {
      "topic": "category of agreement",
      "summary": "brief description",
      "fullText": "exact quotes showing mutual consent",
      "messageIds": ["message IDs where agreement formed"],
      "isTemporary": true | false,
      "conditionText": "any conditions mentioned or null",
      "potentialOverrideTopics": ["existing agreement topics this might modify"],
      "confidence": "high" | "medium" | "low",
      "reasoning": "why this is considered an agreement"
    }
  ]
}`
      };

    case 'person_analysis':
      return {
        systemPrompt: BASE_SYSTEM + `\n\nYour task is to create behavioral communication profiles for each participant. Do NOT provide diagnoses - only document observable behaviors and their functional impact.`,
        userPrompt: `${baseContext}

### Conversation Summary:
${(priorOutputs.conversation_map as any)?.summary || 'Not available'}

### Claims Ledger:
${JSON.stringify((priorOutputs.claims_verification as any)?.claimsLedger || [], null, 2)}

For EACH participant, provide a behavioral profile.

Return JSON:
{
  "personAnalyses": [
    {
      "personId": "UUID",
      "behavioralAssessment": {
        "summary": "2-3 paragraphs of observed interaction patterns with evidence references",
        "cooperationLevel": "high" | "moderate" | "low" | "obstructive",
        "flexibilityLevel": "high" | "moderate" | "low" | "rigid",
        "responsivenessLevel": "high" | "moderate" | "low" | "avoidant",
        "accountabilityLevel": "high" | "moderate" | "low" | "deflecting",
        "boundaryRespect": "appropriate" | "moderate" | "poor"
      },
      "notablePatterns": {
        "positive": ["constructive behaviors observed with evidence"],
        "concerning": ["problematic behaviors observed with evidence"]
      },
      "interactionRecommendations": ["practical communication strategies"],
      "concerns": [
        {
          "type": "accountability_avoidance | stonewalling | etc",
          "description": "what happened",
          "evidence": ["specific quotes or references"],
          "severity": "low" | "medium" | "high"
        }
      ]
    }
  ]
}`
      };

    case 'message_annotation':
      return {
        systemPrompt: BASE_SYSTEM + `\n\nYour task is to flag specific messages containing noteworthy or problematic behavior. Every flag MUST include attributedToPersonId and evidence.

Flag types (use most precise):
- Tier 1 (must appear in summary): misrepresenting_guidance, guidance_downshift, professional_recommendation_ignored, agreement_violation, safety_concern
- Tier 2 (significant): process_gating, channel_shift_request, communication_stonewalling, selective_response, deflection_tactic, accountability_avoidance, unilateral_decision, documentation_resistance, parental_alienation_indicator
- Tier 3 (pattern tracking): concerning_language, boundary_violation, false_equivalence, context_shifting, manipulation_tactic, gaslighting_indicator, scheduling_obstruction, financial_non_compliance
- Tier 4 (positive): positive_cooperation, constructive_problem_solving, repair_attempt, appropriate_flexibility`,
        userPrompt: `${baseContext}

### Claims Ledger:
${JSON.stringify((priorOutputs.claims_verification as any)?.claimsLedger || [], null, 2)}

Flag messages with noteworthy behaviors. Attribute each flag to the person who exhibited the behavior.

Return JSON:
{
  "messageAnnotations": [
    {
      "messageId": "message UUID",
      "flags": [
        {
          "type": "flag type from list above",
          "description": "what specifically happened",
          "attributedToPersonId": "UUID of person who did this",
          "severity": "low" | "medium" | "high",
          "evidence": "brief quote or reference",
          "impact": "how it affects resolution/cooperation"
        }
      ]
    }
  ]
}`
      };

    case 'synthesis':
      return {
        systemPrompt: BASE_SYSTEM + `\n\nYour task is to synthesize the analysis: determine conversation state, provide alternative interpretations for negative findings, and note missing context.`,
        userPrompt: `${baseContext}

### Analysis So Far:
- Summary: ${(priorOutputs.conversation_map as any)?.summary || 'Not available'}
- Issues Found: ${((priorOutputs.issue_linking as any)?.issueActions?.length || 0) + ((priorOutputs.issue_detection as any)?.issueActions?.length || 0)}
- Violations: ${(priorOutputs.agreement_checks as any)?.agreementViolations?.length || 0}
- Key Concerns: ${JSON.stringify((priorOutputs.person_analysis as any)?.personAnalyses?.flatMap((p: any) => p.concerns?.filter((c: any) => c.severity === 'high') || []) || [])}
${context.userGuidance ? `\n### User-Flagged Areas:\n${context.userGuidance}` : ''}

1. Determine conversation state (open/resolved, who should respond)
2. Provide alternative interpretations for negative Tier 1-2 findings
3. List missing information that could change conclusions
4. Determine topic categories

Return JSON:
{
  "conversationState": {
    "status": "open" | "resolved",
    "pendingResponderName": "Name of person who should respond next, or null",
    "reasoning": "brief explanation",
    "pendingActionSummary": "what response/action is expected, if any"
  },
  "alternativeInterpretations": [
    {
      "findingDescription": "the negative finding",
      "alternativeExplanation": "strongest plausible alternative interpretation"
    }
  ],
  "missingContext": [
    {
      "description": "what information is missing",
      "howItCouldChangeConclusions": "how it could affect the analysis"
    }
  ],
  "topicCategorySlugs": ["1-5 slugs from: decision_making, parenting_time, holiday_schedule, school, communication, financial, travel, right_of_first_refusal, exchange, medical, extracurricular, technology, third_party, dispute_resolution, modification, other"]
}`
      };

    default:
      throw new Error(`Unknown stage: ${stageId}`);
  }
}

function assembleResult(outputs: Record<string, unknown>): any {
  const conversationMap = outputs.conversation_map as any || {};
  const claimsVerification = outputs.claims_verification as any || {};
  const issueLinking = outputs.issue_linking as any || {};
  const issueDetection = outputs.issue_detection as any || {};
  const agreementChecks = outputs.agreement_checks as any || {};
  const personAnalysis = outputs.person_analysis as any || {};
  const messageAnnotation = outputs.message_annotation as any || {};
  const synthesis = outputs.synthesis as any || {};

  // Combine issue actions from linking and detection
  const allIssueActions = [
    ...(issueLinking.issueActions || []),
    ...(issueDetection.issueActions || [])
  ];

  // Ensure backward compatibility: populate involvedPersonIds from personContributions
  for (const issue of allIssueActions) {
    if (issue.personContributions && issue.personContributions.length > 0) {
      if (!issue.involvedPersonIds || issue.involvedPersonIds.length === 0) {
        issue.involvedPersonIds = issue.personContributions.map((c: any) => c.personId);
      }
    }
  }

  return {
    conversationAnalysis: {
      summary: conversationMap.summary || 'Analysis incomplete',
      overallTone: conversationMap.overallTone || 'neutral',
      keyTopics: conversationMap.keyTopics || []
    },
    claimsLedger: claimsVerification.claimsLedger || [],
    conversationState: synthesis.conversationState || { status: 'open', pendingResponderName: null, reasoning: '' },
    alternativeInterpretations: synthesis.alternativeInterpretations || [],
    missingContext: synthesis.missingContext || [],
    topicCategorySlugs: synthesis.topicCategorySlugs || [],
    issueActions: allIssueActions,
    agreementViolations: agreementChecks.agreementViolations || [],
    detectedAgreements: agreementChecks.detectedAgreements || [],
    personAnalyses: personAnalysis.personAnalyses || [],
    messageAnnotations: messageAnnotation.messageAnnotations || []
  };
}
