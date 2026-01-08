import { Person, Role } from '../types';
import { api } from './api';

// Standardized participant format for analysis requests
export interface AnalysisParticipant {
  id: string;
  fullName: string;
  role: string;
  roleContext?: string;
  relationships: Array<{
    relatedPersonId: string;
    relatedPersonName: string;
    relationshipType: string;
  }>;
}

// Standardized message format for analysis requests
export interface AnalysisMessage {
  id: string;
  senderId: string;
  receiverId?: string;
  rawText: string;
  sentAt: string;
}

// Complete request body for analyze-conversation-import
export interface AnalysisRequestBody {
  conversationId: string;
  messages: AnalysisMessage[];
  participants: AnalysisParticipant[];
  agreementItems: Array<{
    id: string;
    topic: string;
    fullText: string;
    summary: string;
  }>;
  existingIssues: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
  }>;
  mePersonId: string;
  isReanalysis: boolean;
  userGuidance?: string;
}

/**
 * Builds a standardized request body for the analyze-conversation-import edge function.
 * This ensures consistent field names and structure across all callers.
 */
export async function buildAnalysisRequest(
  conversationId: string,
  messages: AnalysisMessage[],
  participantIds: string[],
  allPeople: Person[],
  options: {
    isReanalysis?: boolean;
    userGuidance?: string;
  } = {}
): Promise<AnalysisRequestBody> {
  // Fetch context data in parallel
  const [agreementItems, existingIssues, relationships] = await Promise.all([
    api.getAllActiveAgreementItems(),
    api.getIssues(),
    Promise.all(participantIds.map(id => api.getPersonRelationships(id)))
  ]);

  // Build participants with consistent structure (always use fullName, never name)
  const participants: AnalysisParticipant[] = participantIds.map((id, idx) => {
    const person = allPeople.find(p => p.id === id);
    const personRelationships = relationships[idx] || [];
    return {
      id,
      fullName: person?.fullName || 'Unknown',
      role: person?.role || 'Other',
      roleContext: person?.roleContext,
      relationships: personRelationships.map(r => ({
        relatedPersonId: r.relatedPersonId,
        relatedPersonName: allPeople.find(p => p.id === r.relatedPersonId)?.fullName || 'Unknown',
        relationshipType: r.relationshipType
      }))
    };
  });

  // Find "Me" person
  const mePerson = allPeople.find(p => p.role === Role.Me);
  const mePersonId = mePerson?.id || participantIds[0] || '';

  return {
    conversationId,
    messages,
    participants,
    agreementItems: agreementItems.map(item => ({
      id: item.id,
      topic: item.topic,
      fullText: item.fullText,
      summary: item.summary || item.fullText?.slice(0, 100) || ''
    })),
    existingIssues: existingIssues.map(issue => ({
      id: issue.id,
      title: issue.title,
      description: issue.description || '',
      status: issue.status,
      priority: issue.priority
    })),
    mePersonId,
    isReanalysis: options.isReanalysis ?? false,
    userGuidance: options.userGuidance
  };
}
