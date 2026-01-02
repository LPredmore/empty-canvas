// Types for conversation analysis results

export interface ConversationAnalysisResult {
  conversationAnalysis: {
    summary: string;
    overallTone: 'cooperative' | 'neutral' | 'contentious' | 'hostile';
    keyTopics: string[];
  };
  issueActions: IssueAction[];
  agreementViolations: AgreementViolation[];
  personAnalyses: PersonAnalysisResult[];
  messageAnnotations: MessageAnnotation[];
}

export interface IssueAction {
  action: 'create' | 'update';
  issueId?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: string;
  linkedMessageIds: string[];
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

export interface MessageAnnotation {
  messageId: string;
  flags: Array<{
    type: 'agreement_violation' | 'concerning_language' | 'manipulation_tactic' | 'positive_cooperation';
    description: string;
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
}
