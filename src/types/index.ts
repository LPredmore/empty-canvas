export enum Role {
  Me = 'Me',
  Parent = 'Parent',
  Child = 'Child',
  StepParent = 'Step-Parent',
  Clinician = 'Clinician',
  Legal = 'Legal',
  Other = 'Other'
}

export enum SourceType {
  OFW = 'OFW',
  Email = 'Email',
  SMS = 'SMS',
  Manual = 'Manual Note'
}

export enum MessageDirection {
  Inbound = 'inbound',
  Outbound = 'outbound',
  Internal = 'internal_note'
}

export enum IssueStatus {
  Open = 'open',
  Monitoring = 'monitoring',
  Resolved = 'resolved',
  Archived = 'archived'
}

export enum IssuePriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high'
}

export interface Person {
  id: string;
  fullName: string;
  role: Role;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  notes?: string;
  roleContext?: string;
}

// --- Person Relationships Types ---

export interface PersonRelationship {
  id: string;
  personId: string;
  relatedPersonId: string;
  relationshipType: string;
  description?: string;
}

// --- Clarification Types (Iterative Free-Text) ---

export interface ConversationTurn {
  question: string;
  answer: string;
}

export interface SuggestedRelationship {
  relatedPersonId: string;
  relatedPersonName: string;
  relationshipType: string;
  description?: string;
}

export interface ClarificationResult {
  complete: boolean;
  question?: string;
  currentUnderstanding?: string;
  enrichedContext?: string;
  suggestedRelationships: SuggestedRelationship[];
}

export interface Conversation {
  id: string;
  title: string;
  sourceType: SourceType;
  startedAt: string;
  endedAt?: string;
  updatedAt: string;
  participantIds: string[];
  previewText: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId?: string;
  sentAt: string;
  rawText: string;
  direction: MessageDirection;
  issueIds?: string[];
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  updatedAt: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  sourceMessageId?: string;
  relatedIssueIds?: string[];
  relatedPersonIds?: string[];
}

export interface ProfileNote {
  id: string;
  personId?: string;
  issueId?: string;
  type: 'observation' | 'strategy' | 'pattern';
  content: string;
  createdAt: string;
}

// --- Rules & Obligations Types ---

export enum LegalDocumentType {
  ParentingPlan = 'parenting_plan',
  CourtOrder = 'court_order',
  Stipulation = 'stipulation',
  Agreement = 'agreement',
  Other = 'other'
}

export interface LegalDocument {
  id: string;
  title: string;
  documentType: LegalDocumentType;
  courtName?: string;
  caseNumber?: string;
  signedDate?: string;
  effectiveDate?: string;
  endDate?: string;
  jurisdiction?: string;
  notes?: string;
  fileUrl?: string;
  createdAt: string;
}

export interface LegalClause {
  id: string;
  legalDocumentId: string;
  clauseRef: string;
  topic: string;
  fullText: string;
  summary?: string;
  isActive: boolean;
  relatedIssueIds?: string[];
}

// --- Document Extraction Types ---

export type AgreementCategory = 
  | 'decision_making'
  | 'parenting_time'
  | 'holiday_schedule'
  | 'school'
  | 'communication'
  | 'financial'
  | 'travel'
  | 'right_of_first_refusal'
  | 'exchange'
  | 'medical'
  | 'extracurricular'
  | 'technology'
  | 'third_party'
  | 'dispute_resolution'
  | 'modification'
  | 'other';

export interface ExtractedPerson {
  name: string;
  suggestedRole: Role;
  context: string;
  includeInCreation?: boolean;
  editedRole?: Role;
  editedContext?: string;
}

export interface ExtractedClause {
  clauseRef: string;
  topic: string;
  fullText: string;
  summary: string;
  include?: boolean;
}

export interface ExtractedAgreement {
  topic: string;
  category: AgreementCategory;
  fullText: string;
  summary: string;
  include?: boolean;
}

export interface DocumentExtractionMetadata {
  suggestedTitle: string;
  documentType: LegalDocumentType;
  courtName?: string;
  caseNumber?: string;
  jurisdiction?: string;
  effectiveDate?: string;
  signedDate?: string;
}

export interface PDFProcessingInfo {
  processingPath: 'text' | 'vision';
  totalPages: number;
  extractedPages: number;
  wasTruncated: boolean;
  estimatedTokens?: number;
}

export interface DocumentExtractionResult {
  metadata: DocumentExtractionMetadata;
  extractedPeople: ExtractedPerson[];
  legalClauses: ExtractedClause[];
  operationalAgreements: ExtractedAgreement[];
  processingInfo?: PDFProcessingInfo;
}

export enum AgreementStatus {
  Proposed = 'proposed',
  Agreed = 'agreed',
  Disputed = 'disputed',
  Superseded = 'superseded',
  Withdrawn = 'withdrawn'
}

export enum AgreementSourceType {
  TherapySession = 'therapy_session',
  Email = 'email',
  OFW = 'ofw',
  Meeting = 'meeting',
  Other = 'other'
}

export interface Agreement {
  id: string;
  title: string;
  description?: string;
  sourceType: AgreementSourceType;
  sourceReference?: string;
  agreedDate?: string;
  status: AgreementStatus;
  createdAt: string;
  partyIds: string[];
}

export interface AgreementItem {
  id: string;
  agreementId: string;
  itemRef?: string;
  topic: string;
  fullText: string;
  summary?: string;
  isActive: boolean;
  relatedIssueIds?: string[];
}

// --- Assistant Types ---

export enum AssistantSenderType {
  User = 'user',
  Assistant = 'assistant',
  System = 'system'
}

export interface AssistantSession {
  id: string;
  title: string;
  lastActivityAt: string;
  createdAt: string;
}

export interface AssistantMessage {
  id: string;
  sessionId: string;
  senderType: AssistantSenderType;
  content: string;
  createdAt: string;
  linkedTargetType?: 'conversation' | 'issue' | 'event' | 'person' | 'legal_document' | 'agreement' | 'none';
  linkedTargetId?: string;
  fileId?: string;
}

export interface AssistantFile {
  id: string;
  sessionId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  detectedSourceType: SourceType | 'unknown';
  uploadedAt: string;
}
