import { supabase } from '../lib/supabase';
import { 
  Person, Conversation, Message, Issue, Event, ProfileNote, 
  LegalDocument, LegalClause, Agreement, AgreementItem,
  AssistantSession, AssistantMessage, AssistantSenderType,
  PersonRelationship, ExtractedClause, ExtractedAgreement,
  AgreementSourceType, AgreementStatus, Role, ConversationStatus,
  TopicCategory, ConversationAnalysis, RelatedConversationDiscovery
} from '../types';
import { IssuePersonContribution } from '../types/analysisTypes';

// --- SYSTEM INSTRUCTIONS ---
export const COPARENTING_ASSISTANT_INSTRUCTIONS = `
Role & Mandate
You are a high-level Co-Parenting Strategist and Forensic Analyst. You are NOT a passive listener or a generic support bot.
Your value comes from specific, actionable insights based on the provided data.

**CRITICAL INSTRUCTION: NO GENERIC PLATITUDES.**
- NEVER say "It is productive that you recognize..."
- NEVER say "It is important to communicate clearly..." without explaining exactly HOW based on the specific text provided.
- NEVER say "Seek clarification" without drafting the exact question to ask.

**Analysis Mode**
When the user asks for an assessment (e.g., "How am I doing?", "What should I do?"):
1. **CITE EVIDENCE:** You must reference specific dates, message quotes, or clauses from the provided context.
   - Example: "In your message from Oct 14, you violated the 'Brief and Informative' rule by adding paragraph 3."
   - Example: "The Co-Parent's email on Nov 2 direct conflicts with Agreement #4 regarding medical updates."
2. **IDENTIFY PATTERNS:** Connect current events to the "Existing Issues" list.
3. **BE DIRECT:** If the user is making a mistake, tell them. If the co-parent is baiting them, identify the bait.

**Drafting Mode**
When drafting responses for the user:
1. **Court Ready:** Write as if a Judge will read it.
2. **B.I.F.F.:** Brief, Informative, Friendly (Professional), Firm.
3. **Remove Emotion:** Strip out JADE (Justify, Argue, Defend, Explain).

**Data Interpretation**
- You have access to the user's "Communication History", "Legal Documents", and "Agreements". 
- USE THEM. If a user asks a question, scan the 'Legal Clauses' provided in the context to see if a rule already exists.

**Tone**
- Strategic, Clinical, Objective, Forensic.
- Do not use "Therapy Speak". Use "Legal/Strategic Speak".
`;

const handleResponse = async (query: any) => {
  const { data, error } = await query;
  if (error) {
    console.error('Supabase Error:', error);
    return [];
  }
  return data;
};

export const api = {
  // --- Auth ---
  signOut: async () => {
    await supabase.auth.signOut();
  },

  // --- People ---
  getPeople: async (): Promise<Person[]> => {
    const data = await handleResponse(supabase.from('people').select('*'));
    return Array.isArray(data) ? data.map((p: any) => ({
      id: p.id,
      fullName: p.full_name,
      role: p.role,
      email: p.email,
      phone: p.phone,
      avatarUrl: p.avatar_url,
      notes: p.notes,
      roleContext: p.role_context
    })) : [];
  },

  getPerson: async (id: string): Promise<Person | null> => {
    const { data, error } = await supabase.from('people').select('*').eq('id', id).single();
    if (error || !data) return null;
    return {
      id: data.id,
      fullName: data.full_name,
      role: data.role,
      email: data.email,
      phone: data.phone,
      avatarUrl: data.avatar_url,
      notes: data.notes,
      roleContext: data.role_context
    };
  },

  createPerson: async (person: Partial<Person>): Promise<Person> => {
    const { data, error } = await supabase.from('people').insert({
      full_name: person.fullName,
      role: person.role,
      email: person.email,
      phone: person.phone,
      avatar_url: person.avatarUrl,
      notes: person.notes,
      role_context: person.roleContext
    }).select().single();
    
    if (error) throw error;
    return {
      id: data.id,
      fullName: data.full_name,
      role: data.role,
      email: data.email,
      phone: data.phone,
      avatarUrl: data.avatar_url,
      notes: data.notes,
      roleContext: data.role_context
    };
  },

  updatePerson: async (id: string, updates: Partial<Person>): Promise<Person> => {
    const dbUpdates: any = {};
    if (updates.fullName) dbUpdates.full_name = updates.fullName;
    if (updates.role) dbUpdates.role = updates.role;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.phone) dbUpdates.phone = updates.phone;
    if (updates.avatarUrl) dbUpdates.avatar_url = updates.avatarUrl;
    if (updates.notes) dbUpdates.notes = updates.notes;
    if (updates.roleContext !== undefined) dbUpdates.role_context = updates.roleContext;

    const { data, error } = await supabase.from('people').update(dbUpdates).eq('id', id).select().single();
    
    if (error) throw error;
    return {
      id: data.id,
      fullName: data.full_name,
      role: data.role,
      email: data.email,
      phone: data.phone,
      avatarUrl: data.avatar_url,
      notes: data.notes,
      roleContext: data.role_context
    };
  },

  // --- Person Relationships ---
  createPersonRelationship: async (relationship: Omit<PersonRelationship, 'id'>): Promise<PersonRelationship> => {
    const { data, error } = await supabase.from('person_relationships').insert({
      person_id: relationship.personId,
      related_person_id: relationship.relatedPersonId,
      relationship_type: relationship.relationshipType,
      description: relationship.description
    }).select().single();
    
    if (error) throw error;
    return {
      id: data.id,
      personId: data.person_id,
      relatedPersonId: data.related_person_id,
      relationshipType: data.relationship_type,
      description: data.description
    };
  },

  updatePersonRelationship: async (id: string, updates: Partial<PersonRelationship>): Promise<PersonRelationship> => {
    const dbUpdates: any = {};
    if (updates.relationshipType) dbUpdates.relationship_type = updates.relationshipType;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    
    const { data, error } = await supabase.from('person_relationships')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return {
      id: data.id,
      personId: data.person_id,
      relatedPersonId: data.related_person_id,
      relationshipType: data.relationship_type,
      description: data.description
    };
  },

  getPersonRelationships: async (personId: string): Promise<PersonRelationship[]> => {
    const data = await handleResponse(
      supabase.from('person_relationships')
        .select('*')
        .or(`person_id.eq.${personId},related_person_id.eq.${personId}`)
    );
    return Array.isArray(data) ? data.map((r: any) => ({
      id: r.id,
      personId: r.person_id,
      relatedPersonId: r.related_person_id,
      relationshipType: r.relationship_type,
      description: r.description
    })) : [];
  },

  deletePersonRelationship: async (id: string): Promise<void> => {
    const { error } = await supabase.from('person_relationships').delete().eq('id', id);
    if (error) throw error;
  },

  // --- Issues ---
  getIssues: async (): Promise<Issue[]> => {
    const data = await handleResponse(supabase.from('issues').select('*').order('updated_at', { ascending: false }));
    return Array.isArray(data) ? data.map((i: any) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      status: i.status,
      priority: i.priority,
      updatedAt: i.updated_at
    })) : [];
  },

  getIssue: async (id: string): Promise<Issue | null> => {
    const { data, error } = await supabase.from('issues').select('*').eq('id', id).single();
    if (error || !data) return null;
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      updatedAt: data.updated_at
    };
  },

  createIssue: async (issue: Partial<Issue>): Promise<Issue> => {
    const { data, error } = await supabase.from('issues').insert({
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority
    }).select().single();

    if (error) throw error;
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      updatedAt: data.updated_at
    };
  },
  
  updateIssue: async (id: string, updates: Partial<Issue>): Promise<void> => {
    await supabase.from('issues').update({
        title: updates.title,
        description: updates.description,
        status: updates.status,
        priority: updates.priority
    }).eq('id', id);
  },

  // --- Issue-People Links ---
  linkPeopleToIssue: async (issueId: string, personIds: string[]): Promise<void> => {
    if (!personIds || personIds.length === 0) return;
    
    const inserts = personIds.map(personId => ({
      issue_id: issueId,
      person_id: personId,
      contribution_type: 'involved'
    }));
    
    const { error } = await supabase
      .from('issue_people')
      .upsert(inserts, { onConflict: 'issue_id,person_id', ignoreDuplicates: true });
    
    if (error) {
      console.error('Error linking people to issue:', error);
    }
  },

  // NEW: Link people with contribution details
  linkPeopleToIssueWithContributions: async (
    issueId: string, 
    contributions: IssuePersonContribution[]
  ): Promise<void> => {
    if (!contributions || contributions.length === 0) return;
    
    const inserts = contributions.map(c => ({
      issue_id: issueId,
      person_id: c.personId,
      contribution_type: c.contributionType || 'involved',
      contribution_description: c.contributionDescription,
      contribution_valence: c.contributionValence
    }));
    
    const { error } = await supabase
      .from('issue_people')
      .upsert(inserts, { 
        onConflict: 'issue_id,person_id',
        ignoreDuplicates: false // Update existing with new contribution details
      });
    
    if (error) {
      console.error('Error linking people with contributions:', error);
    }
  },

  getPeopleForIssue: async (issueId: string): Promise<(Person & { 
    contributionType?: string; 
    contributionDescription?: string; 
    contributionValence?: string;
  })[]> => {
    const { data: links, error } = await supabase
      .from('issue_people')
      .select('person_id, contribution_type, contribution_description, contribution_valence')
      .eq('issue_id', issueId);
    
    if (error || !links || links.length === 0) return [];
    
    const personIds = links.map(l => l.person_id);
    
    const { data: people, error: peopleError } = await supabase
      .from('people')
      .select('*')
      .in('id', personIds);
    
    if (peopleError || !people) return [];
    
    // Merge people with their contribution data
    return people.map(p => {
      const link = links.find(l => l.person_id === p.id);
      return {
        id: p.id,
        fullName: p.full_name,
        role: p.role as Role,
        roleContext: p.role_context,
        email: p.email,
        phone: p.phone,
        avatarUrl: p.avatar_url,
        notes: p.notes,
        contributionType: link?.contribution_type,
        contributionDescription: link?.contribution_description,
        contributionValence: link?.contribution_valence
      };
    });
  },

  getIssuesForPersonDirect: async (personId: string): Promise<(Issue & {
    contributionType?: string;
    contributionDescription?: string;
    contributionValence?: string;
  })[]> => {
    const { data: links, error } = await supabase
      .from('issue_people')
      .select('issue_id, contribution_type, contribution_description, contribution_valence')
      .eq('person_id', personId);
    
    if (error || !links || links.length === 0) return [];
    
    const issueIds = [...new Set(links.map(l => l.issue_id))];
    
    const { data: issues, error: issueError } = await supabase
      .from('issues')
      .select('*')
      .in('id', issueIds);
    
    if (issueError || !issues) return [];
    
    // Merge issues with their contribution data
    return issues.map(i => {
      const link = links.find(l => l.issue_id === i.id);
      return {
        id: i.id,
        title: i.title,
        description: i.description,
        status: i.status,
        priority: i.priority,
        updatedAt: i.updated_at,
        contributionType: link?.contribution_type,
        contributionDescription: link?.contribution_description,
        contributionValence: link?.contribution_valence
      };
    });
  },

  // --- Conversations ---
  getConversations: async (): Promise<Conversation[]> => {
    const data = await handleResponse(
      supabase.from('conversations').select('*, conversation_participants(person_id)').order('started_at', { ascending: false })
    );

    return Array.isArray(data) ? data.map((c: any) => ({
      id: c.id,
      title: c.title,
      sourceType: c.source_type,
      startedAt: c.started_at,
      endedAt: c.ended_at,
      updatedAt: c.updated_at,
      previewText: c.preview_text || '',
      participantIds: c.conversation_participants?.map((cp: any) => cp.person_id) || [],
      status: c.status || ConversationStatus.Open,
      pendingResponderId: c.pending_responder_id
    })) : [];
  },

  getConversation: async (id: string): Promise<Conversation | null> => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*, conversation_participants(person_id)')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return {
      id: data.id,
      title: data.title,
      sourceType: data.source_type,
      startedAt: data.started_at,
      endedAt: data.ended_at,
      updatedAt: data.updated_at,
      previewText: data.preview_text || '',
      participantIds: data.conversation_participants?.map((cp: any) => cp.person_id) || [],
      status: data.status || ConversationStatus.Open,
      pendingResponderId: data.pending_responder_id
    };
  },

  createConversation: async (
    conversation: Partial<Conversation>, 
    participantIds: string[], 
    initialMessageText?: string
  ): Promise<Conversation> => {
    const { data: convData, error: convError } = await supabase.from('conversations').insert({
      title: conversation.title,
      source_type: conversation.sourceType,
      started_at: conversation.startedAt,
      preview_text: conversation.previewText
    }).select().single();

    if (convError) throw convError;

    if (participantIds.length > 0) {
      const participantsPayload = participantIds.map(pid => ({
        conversation_id: convData.id,
        person_id: pid
      }));
      const { error: partError } = await supabase.from('conversation_participants').insert(participantsPayload);
      if (partError) console.error("Error adding participants", partError);
    }

    if (initialMessageText) {
      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: convData.id,
        raw_text: initialMessageText,
        direction: 'inbound',
        sent_at: new Date().toISOString()
      });
      if (msgError) console.error("Error adding initial message", msgError);
    }

    return {
      id: convData.id,
      title: convData.title,
      sourceType: convData.source_type,
      startedAt: convData.started_at,
      updatedAt: convData.updated_at,
      previewText: convData.preview_text || '',
      participantIds: participantIds,
      status: convData.status || ConversationStatus.Open,
      pendingResponderId: convData.pending_responder_id
    };
  },

  importConversation: async (
    conversation: Partial<Conversation>,
    participantIds: string[],
    messages: Array<Partial<Message> & { contentHash?: string }>
  ): Promise<Conversation> => {
     const { data: convData, error: convError } = await supabase.from('conversations').insert({
      title: conversation.title,
      source_type: conversation.sourceType,
      started_at: conversation.startedAt,
      ended_at: conversation.endedAt,
      preview_text: conversation.previewText
    }).select().single();

    if (convError) throw convError;

    if (participantIds.length > 0) {
      const participantsPayload = participantIds.map(pid => ({
        conversation_id: convData.id,
        person_id: pid
      }));
      await supabase.from('conversation_participants').insert(participantsPayload);
    }

    const messagesPayload = messages.map(m => ({
      conversation_id: convData.id,
      sender_id: m.senderId,
      receiver_id: m.receiverId,
      raw_text: m.rawText,
      direction: m.direction,
      sent_at: m.sentAt,
      content_hash: m.contentHash || null
    }));
    
    if (messagesPayload.length > 0) {
      await supabase.from('messages').insert(messagesPayload);
    }

    return {
      id: convData.id,
      title: convData.title,
      sourceType: convData.source_type,
      startedAt: convData.started_at,
      endedAt: convData.ended_at,
      updatedAt: convData.updated_at,
      previewText: convData.preview_text || '',
      participantIds: participantIds,
      status: convData.status || ConversationStatus.Open,
      pendingResponderId: convData.pending_responder_id
    };
  },
  
  appendMessagesToConversation: async (
      conversationId: string, 
      messages: Partial<Message>[]
  ): Promise<void> => {
      const messagesPayload = messages.map(m => ({
        conversation_id: conversationId,
        sender_id: m.senderId,
        receiver_id: m.receiverId,
        raw_text: m.rawText,
        direction: m.direction,
        sent_at: m.sentAt
      }));
      
      if (messagesPayload.length > 0) {
        await supabase.from('messages').insert(messagesPayload);
      }
      
      // Find the latest message date from the batch being added
      const latestDate = messages.reduce((max, m) => {
        if (!m.sentAt) return max;
        const d = new Date(m.sentAt);
        return d > max ? d : max;
      }, new Date(0));
      
      await supabase.from('conversations').update({ 
        updated_at: new Date().toISOString(),
        ended_at: latestDate.toISOString()
      }).eq('id', conversationId);
  },

  // --- Messages ---
  getMessages: async (conversationId?: string): Promise<Message[]> => {
    let query = supabase.from('messages').select('*, message_issues(issue_id)').order('sent_at', { ascending: true });
    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }
    const data = await handleResponse(query);

    return Array.isArray(data) ? data.map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      receiverId: m.receiver_id,
      sentAt: m.sent_at,
      rawText: m.raw_text,
      direction: m.direction,
      issueIds: m.message_issues?.map((mi: any) => mi.issue_id) || []
    })) : [];
  },

  getRecentMessages: async (limit = 100): Promise<Message[]> => {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(limit);
        
    if (error) return [];
    
    return data.reverse().map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      sentAt: m.sent_at,
      rawText: m.raw_text,
      direction: m.direction
    }));
  },

  createMessage: async (message: Partial<Message>): Promise<Message> => {
    const { data, error } = await supabase.from('messages').insert({
      conversation_id: message.conversationId,
      sender_id: message.senderId,
      raw_text: message.rawText,
      direction: message.direction,
      sent_at: message.sentAt
    }).select().single();

    if (error) throw error;
    return {
      id: data.id,
      conversationId: data.conversation_id,
      senderId: data.sender_id,
      sentAt: data.sent_at,
      rawText: data.raw_text,
      direction: data.direction
    };
  },

  linkMessageToIssue: async (messageId: string, issueId: string) => {
    const { error } = await supabase.from('message_issues').insert({
      message_id: messageId,
      issue_id: issueId
    });
    if (error) throw error;
  },

  // --- Events ---
  getEvents: async (issueId?: string): Promise<Event[]> => {
    let query = supabase.from('events').select('*, event_issues(issue_id)').order('date', { ascending: false });
    const data = await handleResponse(query);

    let mapped = Array.isArray(data) ? data.map((e: any) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      date: e.date,
      sourceMessageId: e.source_message_id,
      relatedIssueIds: e.event_issues?.map((ei: any) => ei.issue_id) || []
    })) : [];

    if (issueId) {
      mapped = mapped.filter((e: Event) => e.relatedIssueIds?.includes(issueId));
    }
    return mapped;
  },

  createEvent: async (event: Partial<Event>): Promise<Event> => {
    const { data, error } = await supabase.from('events').insert({
      title: event.title,
      description: event.description,
      date: event.date
    }).select().single();

    if (error) throw error;
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      date: data.date
    };
  },

  // --- Profile Notes ---
  getProfileNotes: async (personId: string): Promise<ProfileNote[]> => {
    const data = await handleResponse(
      supabase.from('profile_notes').select('*').eq('person_id', personId).order('created_at', { ascending: false })
    );
    return Array.isArray(data) ? data.map((n: any) => ({
      id: n.id,
      personId: n.person_id,
      type: n.type,
      content: n.content,
      createdAt: n.created_at
    })) : [];
  },

  createProfileNote: async (note: Partial<ProfileNote>): Promise<ProfileNote> => {
    const { data, error } = await supabase.from('profile_notes').insert({
      person_id: note.personId,
      issue_id: note.issueId,
      type: note.type,
      content: note.content
    }).select().single();

    if (error) throw error;

    return {
      id: data.id,
      personId: data.person_id,
      issueId: data.issue_id,
      type: data.type,
      content: data.content,
      createdAt: data.created_at
    };
  },

  // --- Legal Documents ---
  getLegalDocuments: async (): Promise<LegalDocument[]> => {
    const data = await handleResponse(supabase.from('legal_documents').select('*').order('created_at', { ascending: false }));
    return Array.isArray(data) ? data.map((d: any) => ({
      id: d.id,
      title: d.title,
      documentType: d.document_type,
      courtName: d.court_name,
      caseNumber: d.case_number,
      signedDate: d.signed_date,
      effectiveDate: d.effective_date,
      endDate: d.end_date,
      jurisdiction: d.jurisdiction,
      notes: d.notes,
      fileUrl: d.file_url,
      createdAt: d.created_at
    })) : [];
  },

  getLegalDocument: async (id: string): Promise<LegalDocument | null> => {
    const { data, error } = await supabase.from('legal_documents').select('*').eq('id', id).single();
    if (error || !data) return null;
    return {
      id: data.id,
      title: data.title,
      documentType: data.document_type,
      courtName: data.court_name,
      caseNumber: data.case_number,
      signedDate: data.signed_date,
      effectiveDate: data.effective_date,
      endDate: data.end_date,
      jurisdiction: data.jurisdiction,
      notes: data.notes,
      fileUrl: data.file_url,
      createdAt: data.created_at
    };
  },

  createLegalDocument: async (doc: Partial<LegalDocument>): Promise<LegalDocument> => {
    const { data, error } = await supabase.from('legal_documents').insert({
      title: doc.title,
      document_type: doc.documentType,
      court_name: doc.courtName,
      case_number: doc.caseNumber,
      signed_date: doc.signedDate,
      effective_date: doc.effectiveDate,
      end_date: doc.endDate,
      jurisdiction: doc.jurisdiction,
      notes: doc.notes,
      file_url: doc.fileUrl
    }).select().single();
    
    if(error) throw error;
    return {
      id: data.id,
      title: data.title,
      documentType: data.document_type,
      courtName: data.court_name,
      caseNumber: data.case_number,
      signedDate: data.signed_date,
      effectiveDate: data.effective_date,
      endDate: data.end_date,
      jurisdiction: data.jurisdiction,
      notes: data.notes,
      fileUrl: data.file_url,
      createdAt: data.created_at
    };
  },

  updateLegalDocument: async (id: string, updates: Partial<LegalDocument>): Promise<void> => {
    const updateData: any = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.documentType !== undefined) updateData.document_type = updates.documentType;
    if (updates.courtName !== undefined) updateData.court_name = updates.courtName;
    if (updates.caseNumber !== undefined) updateData.case_number = updates.caseNumber;
    if (updates.signedDate !== undefined) updateData.signed_date = updates.signedDate;
    if (updates.effectiveDate !== undefined) updateData.effective_date = updates.effectiveDate;
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
    if (updates.jurisdiction !== undefined) updateData.jurisdiction = updates.jurisdiction;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.fileUrl !== undefined) updateData.file_url = updates.fileUrl;
    
    const { error } = await supabase.from('legal_documents').update(updateData).eq('id', id);
    if (error) throw error;
  },

  // --- Legal Clauses ---
  getLegalClauses: async (docId?: string): Promise<LegalClause[]> => {
    let query = supabase.from('legal_clauses').select('*, legal_clause_links(target_id)');
    if (docId) {
        query = query.eq('legal_document_id', docId);
    }
    const data = await handleResponse(query);
    return Array.isArray(data) ? data.map((c: any) => ({
      id: c.id,
      legalDocumentId: c.legal_document_id,
      clauseRef: c.clause_ref,
      topic: c.topic,
      fullText: c.full_text,
      summary: c.summary,
      isActive: c.is_active,
      relatedIssueIds: c.legal_clause_links?.map((l: any) => l.target_id) || []
    })) : [];
  },
  
  getAllActiveLegalClauses: async (): Promise<LegalClause[]> => {
     const { data, error } = await supabase.from('legal_clauses').select('*').eq('is_active', true);
     if (error || !data) return [];
     return data.map((c: any) => ({
       id: c.id,
       legalDocumentId: c.legal_document_id,
       clauseRef: c.clause_ref,
       topic: c.topic,
       fullText: c.full_text,
       summary: c.summary,
       isActive: c.is_active
     }));
  },

  // --- Agreements ---
  getAgreements: async (): Promise<Agreement[]> => {
    const data = await handleResponse(
      supabase.from('agreements').select('*, agreement_parties(person_id)').order('created_at', { ascending: false })
    );
    return Array.isArray(data) ? data.map((a: any) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      sourceType: a.source_type,
      sourceReference: a.source_reference,
      agreedDate: a.agreed_date,
      status: a.status,
      createdAt: a.created_at,
      partyIds: a.agreement_parties?.map((ap: any) => ap.person_id) || []
    })) : [];
  },

  getAgreement: async (id: string): Promise<Agreement | null> => {
    const { data, error } = await supabase.from('agreements').select('*, agreement_parties(person_id)').eq('id', id).single();
    if (error || !data) return null;
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      sourceType: data.source_type,
      sourceReference: data.source_reference,
      agreedDate: data.agreed_date,
      status: data.status,
      createdAt: data.created_at,
      partyIds: data.agreement_parties?.map((ap: any) => ap.person_id) || []
    };
  },

  createAgreement: async (agreement: Partial<Agreement>): Promise<Agreement> => {
    const { data, error } = await supabase.from('agreements').insert({
      title: agreement.title,
      description: agreement.description,
      source_type: agreement.sourceType,
      source_reference: agreement.sourceReference,
      agreed_date: agreement.agreedDate,
      status: agreement.status
    }).select().single();

    if (error) throw error;
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      sourceType: data.source_type,
      sourceReference: data.source_reference,
      agreedDate: data.agreed_date,
      status: data.status,
      createdAt: data.created_at,
      partyIds: []
    };
  },

  // --- Agreement Items ---
  getAgreementItems: async (agreementId?: string): Promise<AgreementItem[]> => {
    let query = supabase.from('agreement_items').select('*, agreement_item_links(target_id)');
    if (agreementId) {
        query = query.eq('agreement_id', agreementId);
    }
    const data = await handleResponse(query);
    return Array.isArray(data) ? data.map((i: any) => ({
      id: i.id,
      agreementId: i.agreement_id,
      itemRef: i.item_ref,
      topic: i.topic,
      fullText: i.full_text,
      summary: i.summary,
      isActive: i.is_active,
      relatedIssueIds: i.agreement_item_links?.map((l: any) => l.target_id) || []
    })) : [];
  },
  
  getAllActiveAgreementItems: async (): Promise<AgreementItem[]> => {
      const { data, error } = await supabase.from('agreement_items').select('*').eq('is_active', true);
      if (error || !data) return [];
      return data.map((i: any) => ({
        id: i.id,
        agreementId: i.agreement_id,
        itemRef: i.item_ref,
        topic: i.topic,
        fullText: i.full_text,
        summary: i.summary,
        isActive: i.is_active
      }));
  },

  // --- Cross-Referencing ---
  getRulesForIssue: async (issueId: string): Promise<{ clauses: LegalClause[], items: AgreementItem[] }> => {
    try {
      const [clauseLinks, itemLinks] = await Promise.all([
        supabase.from('legal_clause_links').select('legal_clause_id, legal_clauses(*)').eq('target_id', issueId).eq('target_type', 'issue'),
        supabase.from('agreement_item_links').select('agreement_item_id, agreement_items(*)').eq('target_id', issueId).eq('target_type', 'issue')
      ]);

      const clauses = (clauseLinks.data || []).map((l: any) => ({
        id: l.legal_clauses.id,
        legalDocumentId: l.legal_clauses.legal_document_id,
        clauseRef: l.legal_clauses.clause_ref,
        topic: l.legal_clauses.topic,
        fullText: l.legal_clauses.full_text,
        summary: l.legal_clauses.summary,
        isActive: l.legal_clauses.is_active
      }));

      const items = (itemLinks.data || []).map((l: any) => ({
        id: l.agreement_items.id,
        agreementId: l.agreement_items.agreement_id,
        itemRef: l.agreement_items.item_ref,
        topic: l.agreement_items.topic,
        fullText: l.agreement_items.full_text,
        summary: l.agreement_items.summary,
        isActive: l.agreement_items.is_active
      }));

      return { clauses, items };
    } catch (e) {
      console.error('Error fetching rules for issue', e);
      return { clauses: [], items: [] };
    }
  },

  // --- Assistant Module ---
  
  getAssistantSessions: async (): Promise<AssistantSession[]> => {
     const data = await handleResponse(supabase.from('assistant_sessions').select('*').order('last_activity_at', { ascending: false }));
     return Array.isArray(data) ? data.map((s: any) => ({
       id: s.id,
       title: s.title,
       lastActivityAt: s.last_activity_at,
       createdAt: s.created_at
     })) : [];
  },

  createAssistantSession: async (title?: string): Promise<AssistantSession> => {
     const { data, error } = await supabase.from('assistant_sessions').insert({
       title: title || 'New Session',
       last_activity_at: new Date().toISOString()
     }).select().single();
     
     if (error) throw error;
     return {
       id: data.id,
       title: data.title,
       lastActivityAt: data.last_activity_at,
       createdAt: data.created_at
     };
  },

  getAssistantMessages: async (sessionId: string): Promise<AssistantMessage[]> => {
     const data = await handleResponse(
       supabase.from('assistant_messages').select('*').eq('assistant_session_id', sessionId).order('created_at', { ascending: true })
     );
     return Array.isArray(data) ? data.map((m: any) => ({
       id: m.id,
       sessionId: m.assistant_session_id,
       senderType: m.sender_type,
       content: m.content,
       createdAt: m.created_at,
       linkedTargetType: m.linked_target_type,
       linkedTargetId: m.linked_target_id
     })) : [];
  },

  saveAssistantMessage: async (
      sessionId: string, 
      senderType: AssistantSenderType, 
      content: string, 
      linkedType?: string, 
      linkedId?: string
  ): Promise<AssistantMessage> => {
      const { data: msg, error } = await supabase.from('assistant_messages').insert({
        assistant_session_id: sessionId,
        sender_type: senderType,
        content: content,
        linked_target_type: linkedType,
        linked_target_id: linkedId
      }).select().single();
      
      if (error) throw error;

      await supabase.from('assistant_sessions').update({ last_activity_at: new Date().toISOString() }).eq('id', sessionId);

      return {
        id: msg.id,
        sessionId: msg.assistant_session_id,
        senderType: msg.sender_type,
        content: msg.content,
        createdAt: msg.created_at,
        linkedTargetType: msg.linked_target_type,
        linkedTargetId: msg.linked_target_id
      };
  },

  // --- Bulk Creation for Document Import ---
  
  uploadLegalDocumentFile: async (file: File, docId: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const filePath = `${user.id}/${docId}/${file.name.replace(/\s+/g, '_')}`;
    
    const { error: uploadError } = await supabase.storage
      .from('legal-documents')
      .upload(filePath, file);
    
    if (uploadError) throw uploadError;
    
    const { data: { publicUrl } } = supabase.storage
      .from('legal-documents')
      .getPublicUrl(filePath);
    
    return publicUrl;
  },

  createLegalClausesBulk: async (docId: string, clauses: ExtractedClause[]): Promise<LegalClause[]> => {
    if (clauses.length === 0) return [];
    
    const inserts = clauses.map(c => ({
      legal_document_id: docId,
      clause_ref: c.clauseRef,
      topic: c.topic,
      full_text: c.fullText,
      summary: c.summary,
      is_active: true
    }));
    
    const { data, error } = await supabase.from('legal_clauses').insert(inserts).select();
    if (error) throw error;
    
    return (data || []).map((c: any) => ({
      id: c.id,
      legalDocumentId: c.legal_document_id,
      clauseRef: c.clause_ref,
      topic: c.topic,
      fullText: c.full_text,
      summary: c.summary,
      isActive: c.is_active
    }));
  },

  createAgreementWithItemsBulk: async (
    title: string,
    sourceRef: string,
    items: ExtractedAgreement[]
  ): Promise<{ agreement: Agreement; items: AgreementItem[] }> => {
    // Create parent agreement
    const { data: agreementData, error: agreementError } = await supabase
      .from('agreements')
      .insert({
        title,
        description: `Extracted from: ${sourceRef}`,
        source_type: AgreementSourceType.Other,
        source_reference: sourceRef,
        status: AgreementStatus.Agreed,
        agreed_date: new Date().toISOString()
      })
      .select()
      .single();
    
    if (agreementError) throw agreementError;
    
    const agreement: Agreement = {
      id: agreementData.id,
      title: agreementData.title,
      description: agreementData.description,
      sourceType: agreementData.source_type,
      sourceReference: agreementData.source_reference,
      agreedDate: agreementData.agreed_date,
      status: agreementData.status,
      createdAt: agreementData.created_at,
      partyIds: []
    };
    
    // Create agreement items
    if (items.length === 0) {
      return { agreement, items: [] };
    }
    
    const itemInserts = items.map((item, idx) => ({
      agreement_id: agreement.id,
      item_ref: `${item.category}-${idx + 1}`,
      topic: item.topic,
      full_text: item.fullText,
      summary: item.summary,
      is_active: true
    }));
    
    const { data: itemsData, error: itemsError } = await supabase
      .from('agreement_items')
      .insert(itemInserts)
      .select();
    
    if (itemsError) throw itemsError;
    
    const agreementItems: AgreementItem[] = (itemsData || []).map((i: any) => ({
      id: i.id,
      agreementId: i.agreement_id,
      itemRef: i.item_ref,
      topic: i.topic,
      fullText: i.full_text,
      summary: i.summary,
      isActive: i.is_active
    }));
    
    return { agreement, items: agreementItems };
  },

  createManualAgreement: async (
    agreementData: {
      title: string;
      description?: string;
      sourceType: AgreementSourceType;
      sourceReference?: string;
      status: AgreementStatus;
      agreedDate?: string;
    },
    items: Array<{
      topic: string;
      fullText: string;
      summary?: string;
      overridesItemId?: string;
      contingencyCondition?: string;
    }>
  ): Promise<{ agreement: Agreement; items: AgreementItem[] }> => {
    // Create parent agreement
    const { data: agreeResult, error: agreementError } = await supabase
      .from('agreements')
      .insert({
        title: agreementData.title,
        description: agreementData.description,
        source_type: agreementData.sourceType,
        source_reference: agreementData.sourceReference,
        status: agreementData.status,
        agreed_date: agreementData.agreedDate ? new Date(agreementData.agreedDate).toISOString() : null
      })
      .select()
      .single();
    
    if (agreementError) throw agreementError;
    
    const agreement: Agreement = {
      id: agreeResult.id,
      title: agreeResult.title,
      description: agreeResult.description,
      sourceType: agreeResult.source_type,
      sourceReference: agreeResult.source_reference,
      agreedDate: agreeResult.agreed_date,
      status: agreeResult.status,
      createdAt: agreeResult.created_at,
      partyIds: []
    };
    
    // Create agreement items
    if (items.length === 0) {
      return { agreement, items: [] };
    }
    
    const itemInserts = items.map((item, idx) => ({
      agreement_id: agreement.id,
      item_ref: `manual-${idx + 1}`,
      topic: item.topic,
      full_text: item.fullText,
      summary: item.summary,
      is_active: true,
      overrides_item_id: item.overridesItemId || null,
      override_status: item.overridesItemId ? 'active' : null,
      contingency_condition: item.contingencyCondition || null,
      detected_at: new Date().toISOString()
    }));
    
    const { data: itemsResult, error: itemsError } = await supabase
      .from('agreement_items')
      .insert(itemInserts)
      .select();
    
    if (itemsError) throw itemsError;
    
    const agreementItems: AgreementItem[] = (itemsResult || []).map((i: any) => ({
      id: i.id,
      agreementId: i.agreement_id,
      itemRef: i.item_ref,
      topic: i.topic,
      fullText: i.full_text,
      summary: i.summary,
      isActive: i.is_active,
      overridesItemId: i.overrides_item_id,
      overrideStatus: i.override_status,
      contingencyCondition: i.contingency_condition,
      detectedAt: i.detected_at
    }));
    
    return { agreement, items: agreementItems };
  },

  createPeopleBulk: async (people: Array<{ name: string; role: Role; context: string }>): Promise<Person[]> => {
    if (people.length === 0) return [];
    
    const inserts = people.map(p => ({
      full_name: p.name,
      role: p.role,
      role_context: p.context
    }));
    
    const { data, error } = await supabase.from('people').insert(inserts).select();
    if (error) throw error;
    
    return (data || []).map((p: any) => ({
      id: p.id,
      fullName: p.full_name,
      role: p.role,
      email: p.email,
      phone: p.phone,
      avatarUrl: p.avatar_url,
      notes: p.notes,
      roleContext: p.role_context
    }));
  },

  // --- Conversation Analysis ---
  
  // --- Topic Categories ---
  
  getTopicCategories: async (): Promise<TopicCategory[]> => {
    const { data, error } = await supabase
      .from('topic_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error || !data) return [];
    return data.map((c: any) => ({
      id: c.id,
      slug: c.slug,
      displayName: c.display_name,
      description: c.description,
      sortOrder: c.sort_order
    }));
  },

  getTopicCategoryBySlug: async (slug: string): Promise<TopicCategory | null> => {
    const { data, error } = await supabase
      .from('topic_categories')
      .select('*')
      .eq('slug', slug)
      .single();
    
    if (error || !data) return null;
    return {
      id: data.id,
      slug: data.slug,
      displayName: data.display_name,
      description: data.description,
      sortOrder: data.sort_order
    };
  },

  // --- Conversation Analysis ---
  
  saveConversationAnalysis: async (analysis: {
    conversationId: string;
    summary: string;
    overallTone: string;
    keyTopics: string[];
    topicCategorySlugs?: string[];
    agreementViolations: any[];
    messageAnnotations: any[];
  }): Promise<void> => {
    const { error } = await supabase.from('conversation_analyses').upsert({
      conversation_id: analysis.conversationId,
      summary: analysis.summary,
      overall_tone: analysis.overallTone,
      key_topics: analysis.keyTopics,
      topic_category_slugs: analysis.topicCategorySlugs || [],
      agreement_violations: analysis.agreementViolations,
      message_annotations: analysis.messageAnnotations
    }, { onConflict: 'conversation_id,user_id' });
    
    if (error) throw error;
  },

  updateAnalysisSummary: async (conversationId: string, summary: string): Promise<void> => {
    const { error } = await supabase
      .from('conversation_analyses')
      .update({ summary })
      .eq('conversation_id', conversationId);
    
    if (error) throw error;
  },

  getConversationAnalysis: async (conversationId: string): Promise<ConversationAnalysis | null> => {
    const { data, error } = await supabase
      .from('conversation_analyses')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();
    
    if (error || !data) return null;
    return {
      id: data.id,
      conversationId: data.conversation_id,
      summary: data.summary,
      overallTone: data.overall_tone,
      keyTopics: data.key_topics || [],
      topicCategorySlugs: data.topic_category_slugs || [],
      agreementViolations: data.agreement_violations || [],
      messageAnnotations: data.message_annotations || [],
      createdAt: data.created_at
    };
  },

  // --- Discovery Functions for Related Conversations ---
  
  getConversationsWithSharedIssues: async (conversationId: string): Promise<RelatedConversationDiscovery[]> => {
    // Get issues linked to this conversation
    const myLinks = await api.getConversationIssueLinks(conversationId);
    const myIssueIds = myLinks.map(l => l.issueId);
    if (myIssueIds.length === 0) return [];
    
    // Get current conversation for temporal filter
    const current = await api.getConversation(conversationId);
    if (!current) return [];
    const cutoff = current.endedAt || current.startedAt;
    
    // Find other conversations linked to same issues
    const { data, error } = await supabase
      .from('conversation_issue_links')
      .select('conversation_id, issue_id')
      .in('issue_id', myIssueIds)
      .neq('conversation_id', conversationId);
    
    if (error || !data) return [];
    
    // Group by conversation ID
    const convMap = new Map<string, string[]>();
    for (const link of data) {
      const existing = convMap.get(link.conversation_id) || [];
      existing.push(link.issue_id);
      convMap.set(link.conversation_id, existing);
    }
    
    // Fetch conversation details and filter by temporal constraint
    const results: RelatedConversationDiscovery[] = [];
    for (const [convId, issueIds] of convMap) {
      const conv = await api.getConversation(convId);
      if (!conv) continue;
      
      // Temporal filter: only conversations that ended before or at same time
      const convEnd = conv.endedAt || conv.startedAt;
      if (cutoff && convEnd && new Date(convEnd) > new Date(cutoff)) continue;
      
      results.push({
        conversationId: convId,
        title: conv.title,
        dateRange: { start: conv.startedAt, end: conv.endedAt },
        relationshipTypes: ['shared_issue'],
        sharedIssueIds: [...new Set(issueIds)]
      });
    }
    
    return results;
  },

  getConversationsWithSharedCategories: async (
    conversationId: string, 
    mySlugs: string[]
  ): Promise<RelatedConversationDiscovery[]> => {
    if (mySlugs.length === 0) return [];
    
    const current = await api.getConversation(conversationId);
    if (!current) return [];
    const cutoff = current.endedAt || current.startedAt;
    
    // Find analyses with overlapping categories
    const { data, error } = await supabase
      .from('conversation_analyses')
      .select('conversation_id, topic_category_slugs, summary, overall_tone')
      .neq('conversation_id', conversationId);
    
    if (error || !data) return [];
    
    const results: RelatedConversationDiscovery[] = [];
    for (const analysis of data) {
      const slugs = analysis.topic_category_slugs || [];
      const sharedSlugs = slugs.filter((s: string) => mySlugs.includes(s));
      if (sharedSlugs.length === 0) continue;
      
      const conv = await api.getConversation(analysis.conversation_id);
      if (!conv) continue;
      
      // Temporal filter
      const convEnd = conv.endedAt || conv.startedAt;
      if (cutoff && convEnd && new Date(convEnd) > new Date(cutoff)) continue;
      
      results.push({
        conversationId: analysis.conversation_id,
        title: conv.title,
        dateRange: { start: conv.startedAt, end: conv.endedAt },
        relationshipTypes: ['shared_category'],
        sharedCategorySlugs: sharedSlugs,
        summary: analysis.summary,
        tone: analysis.overall_tone
      });
    }
    
    return results;
  },

  getConversationsFromAgreementSources: async (conversationId: string): Promise<RelatedConversationDiscovery[]> => {
    // Find agreement items that reference this conversation as source
    const { data: itemsFromThis, error: err1 } = await supabase
      .from('agreement_items')
      .select('id, topic, source_conversation_id, overrides_item_id')
      .eq('source_conversation_id', conversationId);
    
    if (err1) return [];
    
    // Find items that this conversation's items override (trace back)
    const overriddenIds = (itemsFromThis || [])
      .map(i => i.overrides_item_id)
      .filter(Boolean);
    
    if (overriddenIds.length === 0) return [];
    
    const { data: overriddenItems, error: err2 } = await supabase
      .from('agreement_items')
      .select('source_conversation_id')
      .in('id', overriddenIds);
    
    if (err2 || !overriddenItems) return [];
    
    const sourceConvIds = [...new Set(
      overriddenItems
        .map(i => i.source_conversation_id)
        .filter(Boolean)
        .filter(id => id !== conversationId)
    )];
    
    const results: RelatedConversationDiscovery[] = [];
    for (const convId of sourceConvIds) {
      const conv = await api.getConversation(convId);
      if (!conv) continue;
      
      results.push({
        conversationId: convId,
        title: conv.title,
        dateRange: { start: conv.startedAt, end: conv.endedAt },
        relationshipTypes: ['agreement_source']
      });
    }
    
    return results;
  },

  discoverRelatedConversations: async (conversationId: string): Promise<RelatedConversationDiscovery[]> => {
    // Get current analysis for categories
    const myAnalysis = await api.getConversationAnalysis(conversationId);
    const mySlugs = myAnalysis?.topicCategorySlugs || [];
    
    // Run all discovery methods in parallel
    const [sharedIssues, agreementSources, sharedCategories] = await Promise.all([
      api.getConversationsWithSharedIssues(conversationId),
      api.getConversationsFromAgreementSources(conversationId),
      api.getConversationsWithSharedCategories(conversationId, mySlugs)
    ]);
    
    // Merge and deduplicate by conversation ID
    const merged = new Map<string, RelatedConversationDiscovery>();
    
    const addToMerged = (discoveries: RelatedConversationDiscovery[]) => {
      for (const d of discoveries) {
        const existing = merged.get(d.conversationId);
        if (existing) {
          // Merge relationship types
          const types = new Set([...existing.relationshipTypes, ...d.relationshipTypes]);
          existing.relationshipTypes = [...types] as any;
          if (d.sharedIssueIds) {
            existing.sharedIssueIds = [...new Set([...(existing.sharedIssueIds || []), ...d.sharedIssueIds])];
          }
          if (d.sharedCategorySlugs) {
            existing.sharedCategorySlugs = [...new Set([...(existing.sharedCategorySlugs || []), ...d.sharedCategorySlugs])];
          }
          if (d.summary && !existing.summary) existing.summary = d.summary;
          if (d.tone && !existing.tone) existing.tone = d.tone;
        } else {
          merged.set(d.conversationId, { ...d });
        }
      }
    };
    
    addToMerged(sharedIssues);
    addToMerged(agreementSources);
    addToMerged(sharedCategories);
    
    // Sort by relevance: shared_issue > agreement_source > shared_category
    const results = [...merged.values()];
    results.sort((a, b) => {
      const scoreA = a.relationshipTypes.includes('shared_issue') ? 3 : 
                     a.relationshipTypes.includes('agreement_source') ? 2 : 1;
      const scoreB = b.relationshipTypes.includes('shared_issue') ? 3 : 
                     b.relationshipTypes.includes('agreement_source') ? 2 : 1;
      return scoreB - scoreA;
    });
    
    return results.slice(0, 10); // Limit to 10 related conversations
  },

  linkConversationToIssue: async (conversationId: string, issueId: string, reason?: string): Promise<void> => {
    const { error } = await supabase.from('conversation_issue_links').upsert({
      conversation_id: conversationId,
      issue_id: issueId,
      link_reason: reason
    }, { onConflict: 'conversation_id,issue_id,user_id' });
    
    if (error) throw error;
  },

  getConversationIssueLinks: async (conversationId: string): Promise<Array<{ issueId: string; reason?: string }>> => {
    const { data, error } = await supabase
      .from('conversation_issue_links')
      .select('issue_id, link_reason')
      .eq('conversation_id', conversationId);
    
    if (error || !data) return [];
    return data.map((link: any) => ({
      issueId: link.issue_id,
      reason: link.link_reason
    }));
  },

  getIssuesForPerson: async (personId: string): Promise<Issue[]> => {
    // Get all messages where this person is sender or receiver
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id')
      .or(`sender_id.eq.${personId},receiver_id.eq.${personId}`);
    
    if (msgError || !messages || messages.length === 0) return [];
    
    const messageIds = messages.map((m: any) => m.id);
    
    // Get issue links for those messages
    const { data: links, error: linkError } = await supabase
      .from('message_issues')
      .select('issue_id')
      .in('message_id', messageIds);
    
    if (linkError || !links || links.length === 0) return [];
    
    const issueIds = [...new Set(links.map((l: any) => l.issue_id))];
    
    // Get the issues
    const { data: issues, error: issueError } = await supabase
      .from('issues')
      .select('*')
      .in('id', issueIds);
    
    if (issueError || !issues) return [];
    
    return issues.map((i: any) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      status: i.status,
      priority: i.priority,
      updatedAt: i.updated_at
    }));
  },

  createProfileNotesBulk: async (notes: Array<{
    personId: string;
    type: 'observation' | 'strategy' | 'pattern';
    content: string;
  }>): Promise<void> => {
    if (notes.length === 0) return;
    
    const inserts = notes.map(n => ({
      person_id: n.personId,
      type: n.type,
      content: n.content
    }));
    
    const { error } = await supabase.from('profile_notes').insert(inserts);
    if (error) throw error;
  },

  linkMessagesToIssue: async (messageIds: string[], issueId: string): Promise<void> => {
    if (messageIds.length === 0) return;
    
    const inserts = messageIds.map(msgId => ({
      message_id: msgId,
      issue_id: issueId
    }));
    
    // Use upsert to avoid duplicate errors
    const { error } = await supabase.from('message_issues').upsert(inserts, {
      onConflict: 'message_id,issue_id',
      ignoreDuplicates: true
    });
    
    if (error) console.error('Error linking messages to issue:', error);
  },

  // --- Agreement Item Override Management ---

  createAgreementItemFromConversation: async (
    agreementId: string,
    item: {
      topic: string;
      summary: string;
      fullText: string;
      overridesItemId?: string;
      contingencyCondition?: string;
      sourceConversationId: string;
      sourceMessageId?: string;
    }
  ): Promise<AgreementItem> => {
    const { data, error } = await supabase.from('agreement_items').insert({
      agreement_id: agreementId,
      topic: item.topic,
      summary: item.summary,
      full_text: item.fullText,
      overrides_item_id: item.overridesItemId,
      override_status: item.overridesItemId ? 'active' : null,
      contingency_condition: item.contingencyCondition,
      source_conversation_id: item.sourceConversationId,
      source_message_id: item.sourceMessageId,
      detected_at: new Date().toISOString(),
      is_active: true
    }).select().single();

    if (error) throw error;
    return {
      id: data.id,
      agreementId: data.agreement_id,
      topic: data.topic,
      fullText: data.full_text,
      summary: data.summary,
      isActive: data.is_active,
      overridesItemId: data.overrides_item_id,
      overrideStatus: data.override_status,
      contingencyCondition: data.contingency_condition,
      sourceConversationId: data.source_conversation_id,
      sourceMessageId: data.source_message_id,
      detectedAt: data.detected_at
    };
  },

  getAgreementItemWithOverrides: async (itemId: string): Promise<AgreementItem[]> => {
    const { data, error } = await supabase.rpc('get_agreement_item_override_chain', { p_item_id: itemId });
    
    if (error || !data) return [];
    return data.map((i: any) => ({
      id: i.id,
      agreementId: i.agreement_id,
      itemRef: i.item_ref,
      topic: i.topic,
      fullText: i.full_text,
      summary: i.summary,
      isActive: i.is_active,
      overridesItemId: i.overrides_item_id,
      overrideStatus: i.override_status,
      contingencyCondition: i.contingency_condition,
      sourceConversationId: i.source_conversation_id,
      sourceMessageId: i.source_message_id,
      detectedAt: i.detected_at
    }));
  },

  getEffectiveAgreementItem: async (topic: string): Promise<AgreementItem | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data, error } = await supabase.rpc('get_effective_agreement_item', { 
      p_user_id: user.id, 
      p_topic: topic 
    });
    
    if (error || !data || data.length === 0) return null;
    const i = data[0];
    return {
      id: i.id,
      agreementId: i.agreement_id,
      itemRef: i.item_ref,
      topic: i.topic,
      fullText: i.full_text,
      summary: i.summary,
      isActive: i.is_active,
      overridesItemId: i.overrides_item_id,
      overrideStatus: i.override_status,
      contingencyCondition: i.contingency_condition,
      sourceConversationId: i.source_conversation_id,
      sourceMessageId: i.source_message_id,
      detectedAt: i.detected_at
    };
  },

  updateAgreementItemOverrideStatus: async (
    itemId: string, 
    status: 'active' | 'disputed' | 'withdrawn'
  ): Promise<void> => {
    const { error } = await supabase
      .from('agreement_items')
      .update({ override_status: status })
      .eq('id', itemId);
    
    if (error) throw error;
  },

  getAgreementItemsWithOverrideInfo: async (agreementId?: string): Promise<AgreementItem[]> => {
    let query = supabase.from('agreement_items').select('*');
    if (agreementId) {
      query = query.eq('agreement_id', agreementId);
    }
    const { data, error } = await query;
    
    if (error || !data) return [];
    return data.map((i: any) => ({
      id: i.id,
      agreementId: i.agreement_id,
      itemRef: i.item_ref,
      topic: i.topic,
      fullText: i.full_text,
      summary: i.summary,
      isActive: i.is_active,
      overridesItemId: i.overrides_item_id,
      overrideStatus: i.override_status,
      contingencyCondition: i.contingency_condition,
      sourceConversationId: i.source_conversation_id,
      sourceMessageId: i.source_message_id,
      detectedAt: i.detected_at
    }));
  },

  // Get or create a "Conversation Agreements" agreement for informal agreements
  getOrCreateConversationAgreement: async (): Promise<Agreement> => {
    const title = 'Conversation Agreements';
    
    // Check if it exists
    const { data: existing } = await supabase
      .from('agreements')
      .select('*')
      .eq('title', title)
      .eq('source_type', 'other')
      .single();
    
    if (existing) {
      return {
        id: existing.id,
        title: existing.title,
        description: existing.description,
        sourceType: existing.source_type,
        sourceReference: existing.source_reference,
        agreedDate: existing.agreed_date,
        status: existing.status,
        createdAt: existing.created_at,
        partyIds: []
      };
    }
    
    // Create it
    const { data, error } = await supabase.from('agreements').insert({
      title,
      description: 'Informal agreements detected from conversation analysis',
      source_type: 'other',
      status: 'agreed'
    }).select().single();
    
    if (error) throw error;
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      sourceType: data.source_type,
      sourceReference: data.source_reference,
      agreedDate: data.agreed_date,
      status: data.status,
      createdAt: data.created_at,
      partyIds: []
    };
  },

  // --- Idempotent Profile Notes for Re-Analysis ---
  createProfileNotesForConversation: async (
    conversationId: string,
    notes: Array<{
      personId: string;
      type: 'observation' | 'strategy' | 'pattern';
      content: string;
    }>
  ): Promise<void> => {
    if (notes.length === 0) return;
    
    const inserts = notes.map(n => ({
      person_id: n.personId,
      type: n.type,
      content: n.content,
      source_conversation_id: conversationId
    }));
    
    // Use upsert with unique constraint to prevent duplicates during re-analysis
    const { error } = await supabase
      .from('profile_notes')
      .upsert(inserts, { 
        onConflict: 'user_id,person_id,source_conversation_id,type',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error('Error upserting profile notes:', error);
      // Fall back to regular insert if upsert fails (e.g., constraint doesn't exist yet)
      await supabase.from('profile_notes').insert(inserts);
    }
  },

  // --- Conversation Continuity Detection (First-Sentence Matching) ---
  
  /**
   * Find a conversation that contains a message starting with the given first sentence.
   * Used to detect when an uploaded conversation continues an existing one.
   */
  findConversationByFirstSentence: async (
    firstSentence: string
  ): Promise<{
    conversation: Conversation;
    matchingMessageId: string;
    existingMessageCount: number;
  } | null> => {
    if (!firstSentence || firstSentence.length < 20) return null;
    
    // Search for messages where raw_text starts with this sentence (case-insensitive)
    const searchPattern = firstSentence.replace(/[%_]/g, '\\$&') + '%';
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, conversation_id, raw_text')
      .ilike('raw_text', searchPattern)
      .limit(1);
    
    if (error || !messages || messages.length === 0) return null;
    
    const matchedMessage = messages[0];
    
    // Get the conversation details
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('*, conversation_participants(person_id)')
      .eq('id', matchedMessage.conversation_id)
      .single();
    
    if (convError || !conv) return null;
    
    // Get message count for this conversation
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conv.id);
    
    return {
      conversation: {
        id: conv.id,
        title: conv.title,
        sourceType: conv.source_type,
        startedAt: conv.started_at,
        endedAt: conv.ended_at,
        updatedAt: conv.updated_at,
        previewText: conv.preview_text || '',
        participantIds: conv.conversation_participants?.map((cp: any) => cp.person_id) || [],
        status: conv.status || ConversationStatus.Open,
        pendingResponderId: conv.pending_responder_id
      },
      matchingMessageId: matchedMessage.id,
      existingMessageCount: count || 0
    };
  },

  /**
   * Get the most recent message from a conversation.
   */
  getLastMessageOfConversation: async (
    conversationId: string
  ): Promise<{ id: string; rawText: string; sentAt: string } | null> => {
    const { data, error } = await supabase
      .from('messages')
      .select('id, raw_text, sent_at')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) return null;
    
    return {
      id: data.id,
      rawText: data.raw_text || '',
      sentAt: data.sent_at || ''
    };
  },

  /**
   * Append messages to a conversation, skipping everything up to and including the splice point.
   * The splice point is identified by the first sentence of the last existing message.
   */
  appendMessagesAfterSplicePoint: async (
    conversationId: string,
    allUploadedMessages: Array<{
      rawText: string;
      sentAt: string;
      senderId?: string;
      receiverId?: string;
      direction: string;
    }>,
    splicePointSentence: string
  ): Promise<{ addedCount: number; skippedCount: number }> => {
    // Find where in the uploaded messages the splice point occurs
    let spliceIndex = -1;
    
    for (let i = 0; i < allUploadedMessages.length; i++) {
      const msgText = (allUploadedMessages[i].rawText || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (msgText.startsWith(splicePointSentence)) {
        spliceIndex = i;
        break;
      }
    }
    
    // Take everything AFTER the splice point
    const messagesToInsert = spliceIndex >= 0 
      ? allUploadedMessages.slice(spliceIndex + 1)
      : allUploadedMessages; // If no splice point found, insert all (fallback)
    
    const skippedCount = allUploadedMessages.length - messagesToInsert.length;
    
    if (messagesToInsert.length === 0) {
      return { addedCount: 0, skippedCount };
    }
    
    // Insert new messages
    const messagesPayload = messagesToInsert.map(m => ({
      conversation_id: conversationId,
      sender_id: m.senderId,
      receiver_id: m.receiverId,
      raw_text: m.rawText,
      direction: m.direction,
      sent_at: m.sentAt
    }));
    
    const { error } = await supabase.from('messages').insert(messagesPayload);
    if (error) throw error;
    
    // Update conversation metadata
    const latestDate = messagesToInsert.reduce((max, m) => {
      const d = new Date(m.sentAt);
      return d > max ? d : max;
    }, new Date(0));
    
    const latestMessage = messagesToInsert[messagesToInsert.length - 1];
    
    // Get current conversation to update
    const { data: conv } = await supabase
      .from('conversations')
      .select('ended_at, amendment_history')
      .eq('id', conversationId)
      .single();
    
    const currentEndedAt = conv?.ended_at ? new Date(conv.ended_at) : new Date(0);
    const amendmentHistory = conv?.amendment_history || [];
    
    // Record amendment
    amendmentHistory.push({
      date: new Date().toISOString(),
      messagesAdded: messagesToInsert.length,
      method: 'first_sentence_splice'
    });
    
    await supabase.from('conversations').update({ 
      updated_at: new Date().toISOString(),
      ended_at: latestDate > currentEndedAt ? latestDate.toISOString() : conv?.ended_at,
      preview_text: latestMessage.rawText.substring(0, 100) + '...',
      amendment_history: amendmentHistory
    }).eq('id', conversationId);
    
    return { addedCount: messagesToInsert.length, skippedCount };
  },

  // --- Conversation Resolution ---
  updateConversationStatus: async (
    conversationId: string,
    status: 'open' | 'resolved',
    pendingResponderId?: string | null
  ): Promise<void> => {
    const updates: any = { status };
    if (pendingResponderId !== undefined) {
      updates.pending_responder_id = pendingResponderId;
    }
    const { error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationId);
    if (error) throw error;
  },

  getOpenConversations: async (): Promise<Conversation[]> => {
    const data = await handleResponse(
      supabase
        .from('conversations')
        .select('*, conversation_participants(person_id)')
        .eq('status', 'open')
        .order('ended_at', { ascending: true, nullsFirst: false })
    );

    return Array.isArray(data) ? data.map((c: any) => ({
      id: c.id,
      title: c.title,
      sourceType: c.source_type,
      startedAt: c.started_at,
      endedAt: c.ended_at,
      updatedAt: c.updated_at,
      previewText: c.preview_text || '',
      participantIds: c.conversation_participants?.map((cp: any) => cp.person_id) || [],
      status: c.status || ConversationStatus.Open,
      pendingResponderId: c.pending_responder_id
    })) : [];
  },

  getStaleConversations: async (daysThreshold: number = 14): Promise<Array<Conversation & { daysSinceLastMessage: number; pendingResponderName?: string }>> => {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    const { data, error } = await supabase
      .from('conversations')
      .select('*, conversation_participants(person_id), people!conversations_pending_responder_id_fkey(full_name)')
      .eq('status', 'open')
      .lt('ended_at', thresholdDate.toISOString())
      .order('ended_at', { ascending: true });

    if (error) {
      console.error('Error fetching stale conversations:', error);
      return [];
    }

    return (data || []).map((c: any) => {
      const endedAt = c.ended_at ? new Date(c.ended_at) : (c.started_at ? new Date(c.started_at) : new Date());
      const daysSinceLastMessage = Math.floor((Date.now() - endedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        id: c.id,
        title: c.title,
        sourceType: c.source_type,
        startedAt: c.started_at,
        endedAt: c.ended_at,
        updatedAt: c.updated_at,
        previewText: c.preview_text || '',
        participantIds: c.conversation_participants?.map((cp: any) => cp.person_id) || [],
        status: c.status || ConversationStatus.Open,
        pendingResponderId: c.pending_responder_id,
        daysSinceLastMessage,
        pendingResponderName: c.people?.full_name
      };
    });
  },

  getConversationsAwaitingPerson: async (personId: string): Promise<Conversation[]> => {
    const data = await handleResponse(
      supabase
        .from('conversations')
        .select('*, conversation_participants(person_id)')
        .eq('status', 'open')
        .eq('pending_responder_id', personId)
        .order('ended_at', { ascending: true })
    );

    return Array.isArray(data) ? data.map((c: any) => ({
      id: c.id,
      title: c.title,
      sourceType: c.source_type,
      startedAt: c.started_at,
      endedAt: c.ended_at,
      updatedAt: c.updated_at,
      previewText: c.preview_text || '',
      participantIds: c.conversation_participants?.map((cp: any) => cp.person_id) || [],
      status: c.status || ConversationStatus.Open,
      pendingResponderId: c.pending_responder_id
    })) : [];
  }

};
