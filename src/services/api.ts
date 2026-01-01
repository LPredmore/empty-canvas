import { supabase } from '../lib/supabase';
import { 
  Person, Conversation, Message, Issue, Event, ProfileNote, 
  LegalDocument, LegalClause, Agreement, AgreementItem,
  AssistantSession, AssistantMessage, AssistantSenderType,
  PersonRelationship, ExtractedClause, ExtractedAgreement,
  AgreementSourceType, AgreementStatus, Role
} from '../types';

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
      participantIds: c.conversation_participants?.map((cp: any) => cp.person_id) || []
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
      participantIds: data.conversation_participants?.map((cp: any) => cp.person_id) || []
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
      participantIds: participantIds
    };
  },

  importConversation: async (
    conversation: Partial<Conversation>,
    participantIds: string[],
    messages: Partial<Message>[]
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
      sent_at: m.sentAt
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
      participantIds: participantIds
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
  }

};
