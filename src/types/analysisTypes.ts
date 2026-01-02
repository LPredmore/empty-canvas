// Types for conversation analysis results

export interface ConversationStateResult {
  status: 'open' | 'resolved';
  pendingResponderName: string | null;
  reasoning: string;
  pendingActionSummary?: string;
}

export interface ConversationAnalysisResult {
  conversationAnalysis: {
    summary: string;
    overallTone: 'cooperative' | 'neutral' | 'contentious' | 'hostile';
    keyTopics: string[];
  };
  conversationState?: ConversationStateResult;
  issueActions: IssueAction[];
  agreementViolations: AgreementViolation[];
  personAnalyses: PersonAnalysisResult[];
  messageAnnotations: MessageAnnotation[];
  detectedAgreements: DetectedAgreement[];
}

export interface DetectedAgreement {
  topic: string;
  summary: string;
  fullText: string;
  messageIds: string[];
  isTemporary: boolean;
  conditionText?: string;
  potentialOverrideTopics: string[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

// NEW: Person contribution to an issue with role attribution
export interface IssuePersonContribution {
  personId: string;
  contributionType: 'primary_contributor' | 'affected_party' | 'secondary_contributor' | 'resolver' | 'enabler' | 'witness' | 'involved';
  contributionDescription: string;
  contributionValence: 'positive' | 'negative' | 'neutral' | 'mixed';
}

export interface IssueAction {
  action: 'create' | 'update';
  issueId?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: string;
  linkedMessageIds: string[];
  // OLD format (kept for backward compatibility)
  involvedPersonIds?: string[];
  // NEW format (preferred when available)
  personContributions?: IssuePersonContribution[];
  reasoning: string;
}

export interface AgreementViolation {
  agreementItemId: string;
  violationType: 'direct' | 'potential' | 'pattern';
  description: string;
  messageIds: string[];
  severity: 'minor' | 'moderate' | 'severe';
}

export interface PersonAnalysisResult {
  personId: string;
  clinicalAssessment: {
    summary: string;
    communicationStyle: string;
    emotionalRegulation: string;
    boundaryRespect: string;
    coparentingCooperation: string;
  };
  strategicNotes: {
    observations: string[];
    patterns: string[];
    strategies: string[];
  };
  concerns: PersonConcern[];
  monitoringPriorities: string[];
  diagnosticIndicators?: string[];
}

export interface PersonConcern {
  type: string;
  description: string;
  evidence: string[];
  severity: 'low' | 'medium' | 'high';
}

// Expanded flag types for behavioral attribution
export type MessageFlagType = 
  // Existing types
  | 'agreement_violation'
  | 'concerning_language' 
  | 'manipulation_tactic'
  | 'positive_cooperation'
  // Expanded behavioral indicators
  | 'misrepresenting_guidance'
  | 'selective_response'
  | 'deflection_tactic'
  | 'accountability_avoidance'
  | 'documentation_resistance'
  | 'gaslighting_indicator'
  | 'unilateral_decision'
  | 'boundary_violation'
  | 'parental_alienation_indicator'
  | 'scheduling_obstruction'
  | 'financial_non_compliance'
  | 'communication_stonewalling'
  | 'false_equivalence'
  | 'context_shifting'
  | 'professional_recommendation_ignored';

export interface MessageAnnotation {
  messageId: string;
  flags: Array<{
    type: MessageFlagType | string; // string fallback for old data
    description: string;
    // NEW optional fields (missing in old data)
    attributedToPersonId?: string;
    severity?: 'low' | 'medium' | 'high';
    evidence?: string;
  }>;
}

// Summary shown to user after import
export interface AnalysisSummary {
  conversationTone: string;
  issuesCreated: number;
  issuesUpdated: number;
  violationsDetected: number;
  peopleAnalyzed: number;
  keyFindings: string[];
  agreementsDetected?: number;
}
