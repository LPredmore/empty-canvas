// Types for conversation analysis results

// NEW: Claims Ledger for evidence mapping
export interface ClaimEntry {
  claimText: string;
  speakerPersonId: string;
  category: 'professional_guidance' | 'agreement' | 'factual' | 'accusation' | 'commitment' | 'process';
  evidence: string;
  verificationStatus: 'supported' | 'contradicted' | 'ambiguous';
  notes: string;
}

// NEW: Alternative interpretations section
export interface AlternativeInterpretation {
  findingDescription: string;
  alternativeExplanation: string;
}

// NEW: Missing context section
export interface MissingContext {
  description: string;
  howItCouldChangeConclusions: string;
}

export interface ConversationStateResult {
  status: 'open' | 'resolved';
  pendingResponderName: string | null;
  reasoning: string;
  pendingActionSummary?: string;
}

export interface ConversationAnalysisResult {
  conversationAnalysis: {
    summary: string;
    overallTone: 'cooperative' | 'neutral' | 'tense' | 'contentious' | 'hostile';
    keyTopics: string[];
  };
  claimsLedger?: ClaimEntry[];
  alternativeInterpretations?: AlternativeInterpretation[];
  missingContext?: MissingContext[];
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

// Person contribution to an issue with role attribution
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

// NEW: Behavioral assessment (replaces clinicalAssessment)
export interface BehavioralAssessment {
  summary: string;
  cooperationLevel: 'high' | 'moderate' | 'low' | 'obstructive';
  flexibilityLevel: 'high' | 'moderate' | 'low' | 'rigid';
  responsivenessLevel: 'high' | 'moderate' | 'low' | 'avoidant';
  accountabilityLevel: 'high' | 'moderate' | 'low' | 'deflecting';
  boundaryRespect: 'appropriate' | 'moderate' | 'poor';
}

// NEW: Notable patterns structure
export interface NotablePatterns {
  positive: string[];
  concerning: string[];
}

export interface PersonAnalysisResult {
  personId: string;
  // NEW structure (preferred)
  behavioralAssessment?: BehavioralAssessment;
  notablePatterns?: NotablePatterns;
  interactionRecommendations?: string[];
  // OLD structure (kept for backward compatibility)
  clinicalAssessment?: {
    summary: string;
    communicationStyle: string;
    emotionalRegulation: string;
    boundaryRespect: string;
    coparentingCooperation: string;
  };
  strategicNotes?: {
    observations: string[];
    patterns: string[];
    strategies: string[];
  };
  concerns: PersonConcern[];
  monitoringPriorities?: string[];
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
  // Tier 1 - Resolution-blocking / High-signal
  | 'misrepresenting_guidance'
  | 'guidance_downshift'
  | 'professional_recommendation_ignored'
  | 'agreement_violation'
  | 'safety_concern'
  // Tier 2 - Significant
  | 'process_gating'
  | 'channel_shift_request'
  | 'communication_stonewalling'
  | 'selective_response'
  | 'deflection_tactic'
  | 'accountability_avoidance'
  | 'unilateral_decision'
  | 'documentation_resistance'
  | 'parental_alienation_indicator'
  // Tier 3 - Pattern tracking
  | 'concerning_language'
  | 'boundary_violation'
  | 'false_equivalence'
  | 'context_shifting'
  | 'manipulation_tactic'
  | 'gaslighting_indicator'
  | 'scheduling_obstruction'
  | 'financial_non_compliance'
  // Tier 4 - Positive behaviors
  | 'positive_cooperation'
  | 'constructive_problem_solving'
  | 'repair_attempt'
  | 'appropriate_flexibility';

export interface MessageAnnotation {
  messageId: string;
  flags: Array<{
    type: MessageFlagType | string; // string fallback for old data
    description: string;
    attributedToPersonId: string; // Required
    severity: 'low' | 'medium' | 'high';
    evidence: string;
    impact?: string; // How it affects resolution
    verificationStatus?: 'supported' | 'contradicted' | 'ambiguous';
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
