import { api } from './api';
import { ConversationAnalysisResult } from '../types/analysisTypes';

export interface ProcessingResult {
  success: boolean;
  sectionsProcessed: string[];
  errors: string[];
}

/**
 * Shared analysis processor - handles all post-analysis processing
 * Used by both ImportWizard (initial import) and ConversationViews (refresh analysis)
 * Supports partial results for graceful degradation when pipeline stages fail.
 */
export async function processAnalysisResults(
  conversationId: string,
  analysis: Partial<ConversationAnalysisResult>,
  savedMessages: Array<{ id: string; senderId: string; receiverId?: string; rawText: string; sentAt: string }>,
  options: { skipSections?: Array<'issues' | 'people' | 'analysis' | 'notes'> } = {}
): Promise<ProcessingResult> {
  const sectionsProcessed: string[] = [];
  const errors: string[] = [];
  const skip = options.skipSections || [];

  // 1. Save conversation analysis
  if (!skip.includes('analysis') && analysis.conversationAnalysis) {
    try {
      await api.saveConversationAnalysis({
        conversationId,
        summary: analysis.conversationAnalysis.summary,
        overallTone: analysis.conversationAnalysis.overallTone,
        keyTopics: analysis.conversationAnalysis.keyTopics || [],
        agreementViolations: analysis.agreementViolations || [],
        messageAnnotations: analysis.messageAnnotations || []
      });
      sectionsProcessed.push('analysis');
    } catch (e) {
      errors.push(`Failed to save analysis: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // 2. Process issue actions
  if (!skip.includes('issues') && analysis.issueActions && analysis.issueActions.length > 0) {
    try {
      for (const issueAction of analysis.issueActions) {
        try {
          if (issueAction.action === 'create') {
            // Use findOrCreate to prevent duplicates
            const { issue: newIssue, isNew, matchType } = await api.findOrCreateIssue({
              title: issueAction.title,
              description: issueAction.description,
              priority: issueAction.priority as any,
              status: issueAction.status as any
            });
            
            if (!isNew) {
              console.log(`Issue "${issueAction.title}" already exists (${matchType} match), linking instead of creating`);
            }
            
            // Always link people (upsert handles duplicates)
            if (issueAction.personContributions && issueAction.personContributions.length > 0) {
              await api.linkPeopleToIssueWithContributions(newIssue.id, issueAction.personContributions);
            } else if (issueAction.involvedPersonIds && issueAction.involvedPersonIds.length > 0) {
              await api.linkPeopleToIssue(newIssue.id, issueAction.involvedPersonIds);
            }
            
            // Always link messages (idempotent)
            if (issueAction.linkedMessageIds?.length > 0) {
              await api.linkMessagesToIssue(issueAction.linkedMessageIds, newIssue.id);
            }
            
            // Always link conversation (idempotent)
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
      sectionsProcessed.push('issues');
    } catch (e) {
      errors.push(`Failed to process issues: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // 3. Create profile notes from person analyses
  if (!skip.includes('people') && analysis.personAnalyses && analysis.personAnalyses.length > 0) {
    try {
      const notesToCreate: Array<{ personId: string; type: 'observation' | 'strategy' | 'pattern'; content: string }> = [];
      
      for (const personAnalysis of analysis.personAnalyses) {
        // Handle NEW behavioral assessment format (preferred)
        if (personAnalysis.behavioralAssessment?.summary) {
          const ba = personAnalysis.behavioralAssessment;
          notesToCreate.push({
            personId: personAnalysis.personId,
            type: 'observation',
            content: `## Behavioral Assessment (${new Date().toLocaleDateString()})\n\n${ba.summary}\n\n**Interaction Quality:**\n- Cooperation: ${ba.cooperationLevel}\n- Flexibility: ${ba.flexibilityLevel}\n- Responsiveness: ${ba.responsivenessLevel}\n- Accountability: ${ba.accountabilityLevel}\n- Boundary Respect: ${ba.boundaryRespect}`
          });
        }
        // Handle OLD clinical assessment format (backward compatibility)
        else if (personAnalysis.clinicalAssessment?.summary) {
          notesToCreate.push({
            personId: personAnalysis.personId,
            type: 'observation',
            content: `## Clinical Assessment (${new Date().toLocaleDateString()})\n\n${personAnalysis.clinicalAssessment.summary}\n\n**Communication Style:** ${personAnalysis.clinicalAssessment.communicationStyle}\n\n**Emotional Regulation:** ${personAnalysis.clinicalAssessment.emotionalRegulation}\n\n**Boundary Respect:** ${personAnalysis.clinicalAssessment.boundaryRespect}\n\n**Co-parenting Cooperation:** ${personAnalysis.clinicalAssessment.coparentingCooperation}`
          });
        }

        // Handle NEW notable patterns format
        if (personAnalysis.notablePatterns) {
          if (personAnalysis.notablePatterns.positive?.length > 0) {
            notesToCreate.push({
              personId: personAnalysis.personId,
              type: 'observation',
              content: `**Positive Behaviors:**\n${personAnalysis.notablePatterns.positive.map(p => `- ${p}`).join('\n')}`
            });
          }
          if (personAnalysis.notablePatterns.concerning?.length > 0) {
            notesToCreate.push({
              personId: personAnalysis.personId,
              type: 'pattern',
              content: `**Concerning Behaviors:**\n${personAnalysis.notablePatterns.concerning.map(p => `- ${p}`).join('\n')}`
            });
          }
        }

        // Handle NEW interaction recommendations format
        if (personAnalysis.interactionRecommendations?.length > 0) {
          notesToCreate.push({
            personId: personAnalysis.personId,
            type: 'strategy',
            content: `**Communication Strategies:**\n${personAnalysis.interactionRecommendations.map(r => `- ${r}`).join('\n')}`
          });
        }

        // Handle OLD strategic notes format (backward compatibility)
        if (personAnalysis.strategicNotes) {
          for (const observation of (personAnalysis.strategicNotes.observations || [])) {
            notesToCreate.push({
              personId: personAnalysis.personId,
              type: 'observation',
              content: observation
            });
          }

          for (const pattern of (personAnalysis.strategicNotes.patterns || [])) {
            notesToCreate.push({
              personId: personAnalysis.personId,
              type: 'pattern',
              content: pattern
            });
          }

          for (const strategy of (personAnalysis.strategicNotes.strategies || [])) {
            notesToCreate.push({
              personId: personAnalysis.personId,
              type: 'strategy',
              content: strategy
            });
          }
        }

        // Save concerns as observations (works for both old and new formats)
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
      sectionsProcessed.push('people');
    } catch (e) {
      errors.push(`Failed to create profile notes: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  return {
    success: errors.length === 0,
    sectionsProcessed,
    errors
  };
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
