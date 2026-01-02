import { api } from './api';
import { ConversationAnalysisResult } from '../types/analysisTypes';

/**
 * Shared analysis processor - handles all post-analysis processing
 * Used by both ImportWizard (initial import) and ConversationViews (refresh analysis)
 */
export async function processAnalysisResults(
  conversationId: string,
  analysis: ConversationAnalysisResult,
  savedMessages: Array<{ id: string; senderId: string; receiverId?: string; rawText: string; sentAt: string }>
): Promise<void> {
  // 1. Save conversation analysis
  if (analysis.conversationAnalysis) {
    await api.saveConversationAnalysis({
      conversationId,
      summary: analysis.conversationAnalysis.summary,
      overallTone: analysis.conversationAnalysis.overallTone,
      keyTopics: analysis.conversationAnalysis.keyTopics || [],
      agreementViolations: analysis.agreementViolations || [],
      messageAnnotations: analysis.messageAnnotations || []
    });
  }

  // 2. Process issue actions
  const createdIssueIds: Record<string, string> = {};
  
  for (const issueAction of (analysis.issueActions || [])) {
    try {
      if (issueAction.action === 'create') {
        const newIssue = await api.createIssue({
          title: issueAction.title,
          description: issueAction.description,
          priority: issueAction.priority as any,
          status: issueAction.status as any
        });
        createdIssueIds[issueAction.title] = newIssue.id;
        
        // Link people to the new issue - prefer personContributions, fallback to involvedPersonIds
        if (issueAction.personContributions && issueAction.personContributions.length > 0) {
          await api.linkPeopleToIssueWithContributions(newIssue.id, issueAction.personContributions);
        } else if (issueAction.involvedPersonIds && issueAction.involvedPersonIds.length > 0) {
          await api.linkPeopleToIssue(newIssue.id, issueAction.involvedPersonIds);
        }
        
        // Link messages to the new issue
        if (issueAction.linkedMessageIds?.length > 0) {
          await api.linkMessagesToIssue(issueAction.linkedMessageIds, newIssue.id);
        }
        
        // Link conversation to issue
        await api.linkConversationToIssue(conversationId, newIssue.id, issueAction.reasoning);
        
      } else if (issueAction.action === 'update' && issueAction.issueId) {
        await api.updateIssue(issueAction.issueId, {
          description: issueAction.description,
          priority: issueAction.priority as any,
          status: issueAction.status as any
        });
        
        // Link additional people - prefer personContributions, fallback to involvedPersonIds
        if (issueAction.personContributions && issueAction.personContributions.length > 0) {
          await api.linkPeopleToIssueWithContributions(issueAction.issueId, issueAction.personContributions);
        } else if (issueAction.involvedPersonIds && issueAction.involvedPersonIds.length > 0) {
          await api.linkPeopleToIssue(issueAction.issueId, issueAction.involvedPersonIds);
        }
        
        // Link messages to existing issue
        if (issueAction.linkedMessageIds?.length > 0) {
          await api.linkMessagesToIssue(issueAction.linkedMessageIds, issueAction.issueId);
        }
        
        // Link conversation to issue
        await api.linkConversationToIssue(conversationId, issueAction.issueId, issueAction.reasoning);
      }
    } catch (issueError) {
      console.error('Error processing issue action:', issueError);
    }
  }

  // 3. Create profile notes from person analyses
  const notesToCreate: Array<{ personId: string; type: 'observation' | 'strategy' | 'pattern'; content: string }> = [];
  
  for (const personAnalysis of (analysis.personAnalyses || [])) {
    // Save clinical assessment as observation
    if (personAnalysis.clinicalAssessment?.summary) {
      notesToCreate.push({
        personId: personAnalysis.personId,
        type: 'observation',
        content: `## Clinical Assessment (${new Date().toLocaleDateString()})\n\n${personAnalysis.clinicalAssessment.summary}\n\n**Communication Style:** ${personAnalysis.clinicalAssessment.communicationStyle}\n\n**Emotional Regulation:** ${personAnalysis.clinicalAssessment.emotionalRegulation}\n\n**Boundary Respect:** ${personAnalysis.clinicalAssessment.boundaryRespect}\n\n**Co-parenting Cooperation:** ${personAnalysis.clinicalAssessment.coparentingCooperation}`
      });
    }

    // Save observations
    for (const observation of (personAnalysis.strategicNotes?.observations || [])) {
      notesToCreate.push({
        personId: personAnalysis.personId,
        type: 'observation',
        content: observation
      });
    }

    // Save patterns
    for (const pattern of (personAnalysis.strategicNotes?.patterns || [])) {
      notesToCreate.push({
        personId: personAnalysis.personId,
        type: 'pattern',
        content: pattern
      });
    }

    // Save strategies
    for (const strategy of (personAnalysis.strategicNotes?.strategies || [])) {
      notesToCreate.push({
        personId: personAnalysis.personId,
        type: 'strategy',
        content: strategy
      });
    }

    // Save concerns as observations
    for (const concern of (personAnalysis.concerns || [])) {
      notesToCreate.push({
        personId: personAnalysis.personId,
        type: 'observation',
        content: `⚠️ **${concern.type.toUpperCase()}** (Severity: ${concern.severity})\n\n${concern.description}\n\nEvidence: ${concern.evidence.join('; ')}`
      });
    }
  }

  if (notesToCreate.length > 0) {
    // Use idempotent version that handles re-analysis
    await api.createProfileNotesForConversation(conversationId, notesToCreate);
  }
}

/**
 * Updates conversation status based on AI-detected conversation state
 */
export async function updateConversationState(
  conversationId: string,
  conversationState: { status: 'open' | 'resolved'; pendingResponderName: string | null }
): Promise<void> {
  const { status, pendingResponderName } = conversationState;
  
  // Resolve name to ID
  let pendingResponderId: string | null = null;
  if (pendingResponderName) {
    const participants = await api.getPeople();
    const match = participants.find(p => 
      p.fullName.toLowerCase() === pendingResponderName.toLowerCase() ||
      p.fullName.toLowerCase().includes(pendingResponderName.toLowerCase()) ||
      pendingResponderName.toLowerCase().includes(p.fullName.toLowerCase())
    );
    pendingResponderId = match?.id || null;
  }
  
  await api.updateConversationStatus(conversationId, status, pendingResponderId);
}

/**
 * Extracts key findings from analysis results for summary display
 */
export function extractKeyFindings(analysis: ConversationAnalysisResult): string[] {
  const findings: string[] = [];
  
  // Add tone finding
  if (analysis.conversationAnalysis?.overallTone) {
    const tone = analysis.conversationAnalysis.overallTone;
    if (tone === 'hostile' || tone === 'contentious') {
      findings.push(`Conversation tone detected as ${tone}`);
    }
  }

  // Add violation findings
  const severeViolations = (analysis.agreementViolations || []).filter(v => v.severity === 'severe');
  if (severeViolations.length > 0) {
    findings.push(`${severeViolations.length} severe agreement violation(s) detected`);
  }

  // Add high-severity concerns
  for (const personAnalysis of (analysis.personAnalyses || [])) {
    const highConcerns = (personAnalysis.concerns || []).filter(c => c.severity === 'high');
    if (highConcerns.length > 0) {
      findings.push(`${highConcerns.length} high-priority concern(s) identified`);
      break;
    }
  }

  // Add key topics
  const topics = analysis.conversationAnalysis?.keyTopics || [];
  if (topics.length > 0) {
    findings.push(`Key topics: ${topics.slice(0, 3).join(', ')}`);
  }

  return findings;
}

/**
 * Builds analysis summary for user feedback
 */
export function buildAnalysisSummary(analysis: ConversationAnalysisResult): {
  issuesCreated: number;
  issuesUpdated: number;
  violationsDetected: number;
  peopleAnalyzed: number;
  agreementsDetected: number;
} {
  return {
    issuesCreated: analysis.issueActions?.filter(a => a.action === 'create').length || 0,
    issuesUpdated: analysis.issueActions?.filter(a => a.action === 'update').length || 0,
    violationsDetected: analysis.agreementViolations?.length || 0,
    peopleAnalyzed: analysis.personAnalyses?.length || 0,
    agreementsDetected: analysis.detectedAgreements?.length || 0
  };
}
