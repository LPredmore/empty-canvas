import { 
  Person, Role, Conversation, SourceType, 
  Message, MessageDirection, Issue, IssueStatus, 
  IssuePriority, Event, ProfileNote 
} from '../types';

// --- People ---
export const PEOPLE: Person[] = [
  {
    id: 'p1',
    fullName: 'You',
    role: Role.Me,
    avatarUrl: 'https://picsum.photos/200/200?random=1'
  },
  {
    id: 'p2',
    fullName: 'Allison (Ex)',
    role: Role.Parent,
    email: 'allison@example.com',
    notes: 'Primary co-parent. Communication tends to be high-conflict.',
    avatarUrl: 'https://picsum.photos/200/200?random=2'
  },
  {
    id: 'p3',
    fullName: 'Bryce',
    role: Role.Child,
    notes: 'Age 10. Struggling with transitions.',
    avatarUrl: 'https://picsum.photos/200/200?random=3'
  },
  {
    id: 'p4',
    fullName: 'Dr. Sarah Jenks',
    role: Role.Therapist,
    email: 'drjenks@clinic.com',
    notes: 'Bryce’s therapist.',
    avatarUrl: 'https://picsum.photos/200/200?random=4'
  },
  {
    id: 'p5',
    fullName: 'James (Step-Dad)',
    role: Role.StepParent,
    notes: 'Allison’s partner.',
    avatarUrl: 'https://picsum.photos/200/200?random=5'
  }
];

// --- Issues ---
export const ISSUES: Issue[] = [
  {
    id: 'i1',
    title: 'Electronics Limits',
    description: 'Ongoing disagreement about screen time rules at mom’s house vs dad’s house.',
    status: IssueStatus.Open,
    priority: IssuePriority.High,
    updatedAt: '2023-10-25T10:00:00Z'
  },
  {
    id: 'i2',
    title: 'Medical Coordination',
    description: 'Ensuring both parents attend appointments and share notes.',
    status: IssueStatus.Monitoring,
    priority: IssuePriority.Medium,
    updatedAt: '2023-10-20T14:30:00Z'
  },
  {
    id: 'i3',
    title: 'Homework Consistency',
    description: 'Bryce is missing assignments on transition days.',
    status: IssueStatus.Resolved,
    priority: IssuePriority.Low,
    updatedAt: '2023-09-15T09:00:00Z'
  }
];

// --- Conversations ---
export const CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    title: 'OFW - Electronics Oct 2023',
    sourceType: SourceType.OFW,
    startedAt: '2023-10-22T08:30:00Z',
    updatedAt: '2023-10-24T18:45:00Z',
    participantIds: ['p1', 'p2'],
    previewText: 'I am not agreeing to the new iPad rule...'
  },
  {
    id: 'c2',
    title: 'Therapy Update - Oct',
    sourceType: SourceType.Email,
    startedAt: '2023-10-15T10:00:00Z',
    updatedAt: '2023-10-16T09:00:00Z',
    participantIds: ['p1', 'p2', 'p4'],
    previewText: 'Please see attached notes from this week...'
  },
  {
    id: 'c3',
    title: 'Schedule Change Request',
    sourceType: SourceType.SMS,
    startedAt: '2023-10-01T12:00:00Z',
    updatedAt: '2023-10-01T13:30:00Z',
    participantIds: ['p1', 'p2'],
    previewText: 'Can we swap next Tuesday for Wednesday?'
  }
];

// --- Messages ---
export const MESSAGES: Message[] = [
  // C1 Messages
  {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'p2',
    sentAt: '2023-10-22T08:30:00Z',
    rawText: 'I am not agreeing to the new iPad rule. It is too restrictive.',
    direction: MessageDirection.Inbound,
    issueIds: ['i1']
  },
  {
    id: 'm2',
    conversationId: 'c1',
    senderId: 'p1',
    sentAt: '2023-10-22T09:15:00Z',
    rawText: 'We discussed this in mediation. The recommendation was 1 hour on school nights.',
    direction: MessageDirection.Outbound,
    issueIds: ['i1']
  },
  {
    id: 'm3',
    conversationId: 'c1',
    senderId: 'p2',
    sentAt: '2023-10-23T14:20:00Z',
    rawText: 'That was a suggestion, not an order. I will do what I think is best in my home.',
    direction: MessageDirection.Inbound,
    issueIds: ['i1']
  },
  {
    id: 'm4',
    conversationId: 'c1',
    senderId: 'p1',
    sentAt: '2023-10-23T14:25:00Z',
    rawText: 'Internal note: Consult lawyer about whether mediation agreement is binding here.',
    direction: MessageDirection.Internal,
    issueIds: ['i1']
  },
  // C2 Messages
  {
    id: 'm5',
    conversationId: 'c2',
    senderId: 'p4',
    sentAt: '2023-10-15T10:00:00Z',
    rawText: 'Dear parents, Bryce expressed anxiety about the upcoming schedule change.',
    direction: MessageDirection.Inbound,
    issueIds: ['i2']
  }
];

// --- Events ---
export const EVENTS: Event[] = [
  {
    id: 'e1',
    title: 'Mediation Session',
    description: 'Agreed to 1hr screen time limit on school nights.',
    date: '2023-09-20T14:00:00Z',
    relatedIssueIds: ['i1'],
    relatedPersonIds: ['p1', 'p2']
  },
  {
    id: 'e2',
    title: 'Bryce missed homework',
    description: 'Math worksheet not returned in folder.',
    date: '2023-10-05T15:30:00Z',
    relatedIssueIds: ['i3'],
    relatedPersonIds: ['p3']
  },
  {
    id: 'e3',
    title: 'Therapist Recommendation',
    description: 'Dr. Jenks advises keeping transition rituals consistent.',
    date: '2023-10-15T10:00:00Z',
    relatedIssueIds: ['i2'],
    relatedPersonIds: ['p4']
  }
];

// --- Profile Notes ---
export const PROFILE_NOTES: ProfileNote[] = [
  {
    id: 'pn1',
    personId: 'p2',
    type: 'pattern',
    content: 'Tends to reject agreements made in person once communicated via email.',
    createdAt: '2023-09-01T12:00:00Z'
  },
  {
    id: 'pn2',
    personId: 'p2',
    type: 'strategy',
    content: 'Keep emails strictly factual. BIFF method (Brief, Informative, Friendly, Firm).',
    createdAt: '2023-08-15T09:00:00Z'
  }
];
