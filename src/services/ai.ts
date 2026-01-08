import { supabase } from '../lib/supabase';
import { api } from './api';
import { processAnalysisResults, updateConversationState, buildAnalysisSummary } from './analysisProcessor';
import { buildAnalysisRequest } from './analysisRequestBuilder';
import { FEATURES } from '../config/features';
import { runPipelineAnalysis } from '../utils/sseAnalysisClient';
import { validateAndSanitizeAnalysisResult } from '../utils/analysisValidator';
import { 
  AssistantSenderType, 
  MessageDirection, 
  Role, 
  Person, 
  ClarificationResult, 
  ConversationTurn,
  DocumentExtractionResult,
  PDFProcessingInfo,
  SourceType,
  Conversation,
  Message,
  Issue,
  AgreementItem,
  ProfileNote,
  PersonRelationship
} from '../types';
import { 
  extractTextFromPDF, 
  convertPDFPagesToImages, 
  PDFExtractionResult 
} from '../utils/pdfExtractor';
import { isPdfWorkerReady, getPdfWorkerDiagnostics } from '../utils/pdfjsInit';
import type { ParsedConversation, ParsedMessage } from '../utils/parsers';

// Re-export the parser types for external use
export type { ParsedConversation, ParsedMessage };

// Types for person analysis
export interface PersonAnalysis {
  assessment: string;
  patterns: string[];
  concerns: string[];
  strategies: string[];
  monitoringPriorities: string[];
}

// Types for entity extraction
interface ExtractedEntities {
  mentionedPeopleIds: string[];
  topicKeywords: string[];
  needsRules: boolean;
  needsConversations: boolean;
  reasoning: string;
}

// Types for targeted context
interface AssistantContext {
  people: Person[];
  relationships: PersonRelationship[];
  profileNotes: ProfileNote[];
  issues: Issue[];
  conversations: Conversation[];
  messages: Message[];
  rules: AgreementItem[];
  conversationAnalyses: any[];
}

/**
 * Convert a File to base64 data URL
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Parse a file (image or text) using AI to extract conversation data
 */
export async function parseFileWithAI(file: File): Promise<ParsedConversation> {
  let fileData: { base64?: string; text?: string; images?: string[] } = {};

  if (file.type.startsWith('image/')) {
    // Images: send as base64 for Vision API
    fileData.base64 = await fileToBase64(file);
  } else if (file.type === 'application/pdf') {
    // PDFs: use existing extraction infrastructure
    if (!isPdfWorkerReady()) {
      const diagnostics = getPdfWorkerDiagnostics();
      throw new Error(
        'PDF processing engine failed to start. Please refresh the page and try again. ' +
        `(Worker diagnostics: ${JSON.stringify(diagnostics)})`
      );
    }
    
    const pdfInfo = await extractTextFromPDF(file);
    
    if (pdfInfo.isLikelyScanned) {
      // Scanned PDF: convert to images for Vision API (max 10 pages)
      const { images } = await convertPDFPagesToImages(file, 10);
      fileData.images = images;
    } else {
      // Regular PDF: use extracted text (already token-limited to 80k)
      fileData.text = pdfInfo.totalText;
    }
  } else {
    // Text files: read as text
    fileData.text = await file.text();
  }

  const { data, error } = await supabase.functions.invoke('chat-assistant', {
    body: {
      operation: 'parse-file',
      fileData
    }
  });

  if (error) {
    console.error('Error parsing file:', error);
    throw new Error('Failed to parse file with AI');
  }

  // Validate the response structure
  if (!data || !data.messages || !Array.isArray(data.messages)) {
    console.error('Invalid response structure:', data);
    throw new Error('AI returned invalid conversation data');
  }

  // Convert AI response to ParsedConversation format matching parsers.ts
  const messages: ParsedMessage[] = data.messages.map((m: any) => ({
    senderName: m.sender || 'Unknown',
    receiverName: 'Unknown',
    sentAt: new Date(m.timestamp || Date.now()),
    subject: data.title || 'Imported Conversation',
    body: m.text || '',
    direction: MessageDirection.Inbound
  }));

  const participants = new Set<string>(data.participants || []);
  const lastDate = messages.length > 0 
    ? messages[messages.length - 1].sentAt 
    : new Date();

  return {
    title: data.title || 'Imported Conversation',
    participants,
    messages,
    lastDate
  };
}

/**
 * Generate AI analysis for a person based on their communication history
 */
export async function generatePersonAnalysis(personId: string): Promise<PersonAnalysis> {
  // Fetch person data and related communications
  const [person, conversations, messages, issues] = await Promise.all([
    api.getPerson(personId),
    api.getConversations(),
    api.getRecentMessages(200),
    api.getIssues()
  ]);

  if (!person) {
    throw new Error('Person not found');
  }

  // Filter messages involving this person
  const relevantMessages = messages.filter(
    (m: any) => m.senderId === personId
  );

  // Filter conversations involving this person
  const relevantConversations = conversations.filter(
    (c: any) => c.participantIds?.includes(personId)
  );

  const personData = {
    person: {
      fullName: person.fullName,
      role: person.role,
      notes: person.notes
    },
    messageCount: relevantMessages.length,
    recentMessages: relevantMessages.slice(0, 50).map((m: any) => ({
      text: m.rawText,
      date: m.sentAt,
      direction: m.direction
    })),
    conversationCount: relevantConversations.length,
    issues: issues.slice(0, 20).map((i: any) => ({
      title: i.title,
      status: i.status,
      priority: i.priority
    }))
  };

  const { data, error } = await supabase.functions.invoke('chat-assistant', {
    body: {
      operation: 'analyze-person',
      personData
    }
  });

  if (error) {
    console.error('Error analyzing person:', error);
    throw new Error('Failed to generate person analysis');
  }

  // Update the person's notes with the analysis
  const analysisNote = `
## AI Analysis (${new Date().toLocaleDateString()})

**Assessment:** ${data.assessment}

**Patterns:** ${data.patterns?.join(', ') || 'None identified'}

**Concerns:** ${data.concerns?.join(', ') || 'None identified'}

**Strategies:** ${data.strategies?.join('; ') || 'None recommended'}
`.trim();

  await api.updatePerson(personId, {
    notes: analysisNote
  });

  return {
    assessment: data.assessment || '',
    patterns: data.patterns || [],
    concerns: data.concerns || [],
    strategies: data.strategies || [],
    monitoringPriorities: data.monitoringPriorities || []
  };
}

/**
 * Extract relevant entities from user message (Phase 1)
 */
async function extractRelevantEntities(
  userMessage: string,
  chatHistory: Array<{ role: string; content: string }>,
  allPeople: Person[]
): Promise<ExtractedEntities> {
  try {
    const { data, error } = await supabase.functions.invoke('chat-assistant', {
      body: {
        operation: 'extract-entities',
        messages: [
          ...chatHistory.slice(-4), // Include recent context
          { role: 'user', content: userMessage }
        ],
        peopleList: allPeople.map(p => ({
          id: p.id,
          fullName: p.fullName,
          role: p.role,
          roleContext: p.roleContext
        }))
      }
    });

    if (error) throw error;
    
    // Validate response
    if (!data || !Array.isArray(data.mentionedPeopleIds)) {
      throw new Error('Invalid entity extraction response');
    }
    
    return {
      mentionedPeopleIds: data.mentionedPeopleIds || [],
      topicKeywords: data.topicKeywords || [],
      needsRules: data.needsRules ?? true,
      needsConversations: data.needsConversations ?? true,
      reasoning: data.reasoning || ''
    };
  } catch (err) {
    console.warn('Entity extraction failed, falling back to full context:', err);
    // Fallback: include everyone with "Me" role + all parents
    const mePerson = allPeople.find(p => p.role === Role.Me);
    const parentPeople = allPeople.filter(p => p.role === Role.Parent);
    const fallbackIds = [
      ...(mePerson ? [mePerson.id] : []),
      ...parentPeople.map(p => p.id)
    ];
    
    return {
      mentionedPeopleIds: fallbackIds,
      topicKeywords: [],
      needsRules: true,
      needsConversations: true,
      reasoning: 'Fallback due to extraction error'
    };
  }
}

/**
 * Load targeted context based on extracted entities (Phase 2)
 */
async function loadTargetedContext(
  mentionedPeopleIds: string[],
  options: { needsRules: boolean; needsConversations: boolean }
): Promise<AssistantContext> {
  // 1. Load mentioned people with full details
  const peopleResults = await Promise.all(
    mentionedPeopleIds.map(id => api.getPerson(id))
  );
  const people = peopleResults.filter((p): p is Person => p !== null);

  // 2. Load relationships for mentioned people
  const relationshipsArrays = await Promise.all(
    mentionedPeopleIds.map(id => api.getPersonRelationships(id))
  );
  const relationships = relationshipsArrays.flat();

  // 3. Load profile notes for mentioned people
  const profileNotesArrays = await Promise.all(
    mentionedPeopleIds.map(id => api.getProfileNotes(id))
  );
  const profileNotes = profileNotesArrays.flat();

  // 4. Load issues linked to mentioned people
  const issuesArrays = await Promise.all(
    mentionedPeopleIds.map(id => api.getIssuesForPersonDirect(id))
  );
  const issuesMap = new Map<string, Issue>();
  for (const issueList of issuesArrays) {
    for (const issue of issueList) {
      issuesMap.set(issue.id, issue);
    }
  }
  const issues = Array.from(issuesMap.values());

  // 5. Load conversations and messages if needed
  let conversations: Conversation[] = [];
  let messages: Message[] = [];
  let conversationAnalyses: any[] = [];

  if (options.needsConversations && mentionedPeopleIds.length > 0) {
    // Get all conversations
    const allConversations = await api.getConversations();
    
    // For each conversation, check if any mentioned person participated
    const conversationCheckPromises = allConversations.slice(0, 20).map(async (conv) => {
      const convMessages = await api.getMessages(conv.id);
      const involvedPeopleIds = new Set<string>();
      
      for (const msg of convMessages) {
        if (msg.senderId) involvedPeopleIds.add(msg.senderId);
        if (msg.receiverId) involvedPeopleIds.add(msg.receiverId);
      }
      
      const hasRelevantPerson = mentionedPeopleIds.some(id => involvedPeopleIds.has(id));
      if (hasRelevantPerson) {
        return { conv, messages: convMessages.slice(-20) }; // Last 20 messages per conversation
      }
      return null;
    });

    const results = await Promise.all(conversationCheckPromises);
    const validResults = results.filter((r): r is { conv: Conversation; messages: Message[] } => r !== null);
    
    conversations = validResults.map(r => r.conv);
    messages = validResults.flatMap(r => r.messages);

    // Load analyses for relevant conversations
    const analysisResults = await Promise.all(
      conversations.slice(0, 10).map(c => api.getConversationAnalysis(c.id))
    );
    conversationAnalyses = analysisResults.filter(a => a !== null);
  }

  // 6. Load rules if needed
  let rules: AgreementItem[] = [];
  if (options.needsRules) {
    rules = await api.getAllActiveAgreementItems();
  }

  return {
    people,
    relationships,
    profileNotes,
    issues,
    conversations,
    messages,
    rules,
    conversationAnalyses
  };
}

/**
 * Create a simple text stream for non-streaming responses
 */
function createTextStream(text: string): { stream: ReadableStream; error?: string } {
  return {
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      }
    })
  };
}

// processAnalysisResultsFromChat has been removed - use shared processAnalysisResults from analysisProcessor.ts

/**
 * Handle file import within chat (uses full analysis pipeline)
 */
async function handleFileImportInChat(
  sessionId: string,
  file: File,
  userContent: string
): Promise<{ stream: ReadableStream | null; error?: string }> {
  try {
    // Step 1: Parse the file (same as ImportWizard)
    const parsed = await parseFileWithAI(file);
    
    // Step 2: Match participants to existing people
    const existingPeople = await api.getPeople();
    const participantMappings: Array<{ originalName: string; personId: string | null; person: Person | null }> = [];
    
    for (const name of parsed.participants) {
      // Fuzzy match logic
      const nameLower = name.toLowerCase();
      const match = existingPeople.find(p => {
        const pNameLower = p.fullName.toLowerCase();
        return pNameLower === nameLower ||
               pNameLower.includes(nameLower) ||
               nameLower.includes(pNameLower);
      });
      participantMappings.push({
        originalName: name,
        personId: match?.id || null,
        person: match || null
      });
    }
    
    const unmatchedCount = participantMappings.filter(m => !m.personId).length;
    
    if (unmatchedCount > 0) {
      // Cannot auto-import without full participant matching
      const unmatchedNames = participantMappings.filter(m => !m.personId).map(m => m.originalName);
      const warningMessage = `I found a conversation with ${parsed.messages.length} messages, but I couldn't match ${unmatchedCount} participant(s): ${unmatchedNames.join(', ')}. Please use the Import wizard from the Conversations page to manually map these participants.`;
      
      await api.saveAssistantMessage(sessionId, AssistantSenderType.Assistant, warningMessage);
      return createTextStream(warningMessage);
    }
    
    // Step 3: Build message data
    const participantIds = participantMappings.map(m => m.personId!);
    const messagesForImport = parsed.messages.map(m => {
      const senderMatch = participantMappings.find(pm => 
        pm.originalName.toLowerCase() === m.senderName.toLowerCase()
      );
      return {
        senderId: senderMatch?.personId,
        rawText: m.body,
        sentAt: m.sentAt.toISOString(),
        direction: m.direction
      };
    });
    
    // Step 4: Import conversation
    const conversation = await api.importConversation(
      {
        title: parsed.title || `Imported ${new Date().toLocaleDateString()}`,
        sourceType: SourceType.Manual,
        startedAt: parsed.messages[0]?.sentAt?.toISOString(),
        endedAt: parsed.lastDate?.toISOString()
      },
      participantIds,
      messagesForImport
    );
    
    // Step 5: Run FULL analysis pipeline (same as ImportWizard)
    const savedMessages = await api.getMessages(conversation.id);
    const formattedMessages = savedMessages.map(m => ({
      id: m.id,
      senderId: m.senderId || '',
      receiverId: m.receiverId,
      rawText: m.rawText || '',
      sentAt: m.sentAt || ''
    }));
    
    // Use shared builder for consistent request format
    const requestBody = await buildAnalysisRequest(
      conversation.id,
      formattedMessages,
      participantIds,
      existingPeople,
      { isReanalysis: false }
    );
    
    // Step 5: Run analysis pipeline
    let analysisSummary = '';
    
    if (FEATURES.USE_ANALYSIS_PIPELINE) {
      // Use SSE pipeline for consistency with ImportWizard
      const runInfo = await api.createAnalysisRun(conversation.id);
      console.log(`Chat import: Analysis run ${runInfo.id}, isResume: ${runInfo.isResume}`);
      
      const pipelineRequest = {
        ...requestBody,
        runId: runInfo.id,
        resumeFromStage: runInfo.resumeFromStage,
        priorOutputs: runInfo.priorOutputs
      };
      
      await new Promise<void>((resolve) => {
        runPipelineAnalysis(pipelineRequest, {
          onProgress: async (progress) => {
            console.log(`Chat import analysis: Stage ${progress.stageNumber}/${progress.totalStages} - ${progress.stageName}`);
            await api.setAnalysisRunCurrentStage(runInfo.id, progress.stage);
          },
          onStageComplete: async (stage, _stageNumber, output) => {
            await api.updateAnalysisRunStage(runInfo.id, stage, output);
          },
          onComplete: async (rawResult) => {
            await api.completeAnalysisRun(runInfo.id);
            
            const { sanitized, warnings } = validateAndSanitizeAnalysisResult(rawResult);
            if (warnings.length > 0) {
              console.warn('Chat import analysis validation warnings:', warnings);
            }
            
            await processAnalysisResults(conversation.id, sanitized, formattedMessages);
            
            if (sanitized.conversationState) {
              await updateConversationState(conversation.id, sanitized.conversationState);
            }
            
            const stats = buildAnalysisSummary(sanitized);
            analysisSummary = `\n\nAnalysis complete:\n- Tone: ${sanitized.conversationAnalysis?.overallTone || 'neutral'}\n- Issues created: ${stats.issuesCreated}\n- Issues updated: ${stats.issuesUpdated}\n- Violations detected: ${stats.violationsDetected}`;
            resolve();
          },
          onError: async (error, stage, partialOutputs) => {
            console.error(`Chat import analysis failed at ${stage || 'unknown'}:`, error);
            await api.failAnalysisRun(runInfo.id, error, stage);
            
            if (partialOutputs && Object.keys(partialOutputs).length > 0) {
              for (const [stageName, output] of Object.entries(partialOutputs)) {
                await api.updateAnalysisRunStage(runInfo.id, stageName, output);
              }
            }
            
            analysisSummary = `\n\nAnalysis partially complete (failed at ${stage || 'unknown'})`;
            resolve();
          }
        });
      });
    } else {
      // Legacy single-call path
      const { data: analysisResult, error: analysisError } = await supabase.functions.invoke('analyze-conversation-import', {
        body: requestBody
      });
      
      if (!analysisError && analysisResult) {
        await processAnalysisResults(conversation.id, analysisResult, formattedMessages);
        
        if (analysisResult.conversationState) {
          await updateConversationState(conversation.id, analysisResult.conversationState);
        }
        
        const created = analysisResult.issueActions?.filter((a: any) => a.action === 'create').length || 0;
        const updated = analysisResult.issueActions?.filter((a: any) => a.action === 'update').length || 0;
        const violations = analysisResult.agreementViolations?.length || 0;
        
        analysisSummary = `\n\nAnalysis complete:\n- Tone: ${analysisResult.conversationAnalysis?.overallTone || 'neutral'}\n- Issues created: ${created}\n- Issues updated: ${updated}\n- Violations detected: ${violations}`;
      }
    }
    
    const successMessage = `Successfully imported "${conversation.title}" with ${parsed.messages.length} messages from ${participantMappings.map(m => m.person?.fullName).join(', ')}.${analysisSummary}`;
    
    await api.saveAssistantMessage(sessionId, AssistantSenderType.Assistant, successMessage);
    return createTextStream(successMessage);
    
  } catch (error: any) {
    const errorMessage = `Import failed: ${error.message}`;
    await api.saveAssistantMessage(sessionId, AssistantSenderType.Assistant, errorMessage);
    return { stream: null, error: errorMessage };
  }
}

/**
 * Chat with the AI assistant - returns a streaming response
 * Uses three-phase approach: entity extraction → targeted loading → contextual chat
 */
export async function chatWithAssistant(
  sessionId: string,
  userContent: string,
  file?: File,
  onContextLoading?: (loading: boolean) => void
): Promise<{ stream: ReadableStream | null; error?: string }> {
  // Save the user message first
  await api.saveAssistantMessage(sessionId, AssistantSenderType.User, userContent);

  // Check for file import intent
  if (file) {
    const importKeywords = ['import', 'add this', 'save this', 'log this', 'upload this conversation'];
    const wantsImport = importKeywords.some(kw => userContent.toLowerCase().includes(kw));
    
    if (wantsImport) {
      return await handleFileImportInChat(sessionId, file, userContent);
    }
  }

  // Prepare file data if provided (for context, not import)
  let fileData: { base64?: string; text?: string; images?: string[] } | undefined;
  if (file) {
    if (file.type.startsWith('image/')) {
      fileData = { base64: await fileToBase64(file) };
    } else if (file.type === 'application/pdf') {
      if (!isPdfWorkerReady()) {
        return { stream: null, error: 'PDF processor not ready. Please refresh and try again.' };
      }
      try {
        const pdfInfo = await extractTextFromPDF(file);
        if (pdfInfo.isLikelyScanned) {
          const { images } = await convertPDFPagesToImages(file, 5);
          fileData = { images };
        } else {
          fileData = { text: pdfInfo.totalText };
        }
      } catch (pdfError) {
        console.error('PDF extraction failed:', pdfError);
        return { stream: null, error: 'Failed to read PDF. The file may be corrupted or encrypted.' };
      }
    } else {
      fileData = { text: await file.text() };
    }
  }

  // Get conversation history for context
  const historyMessages = await api.getAssistantMessages(sessionId);
  const chatMessages = historyMessages.map((m: any) => ({
    role: m.senderType === AssistantSenderType.User ? 'user' : 'assistant',
    content: m.content
  }));

  // PHASE 1: Extract relevant entities
  onContextLoading?.(true);
  const allPeople = await api.getPeople();
  
  const entities = await extractRelevantEntities(userContent, chatMessages, allPeople);
  console.log('Entity extraction result:', entities);

  // PHASE 2: Load targeted context
  let context: AssistantContext | null = null;
  
  if (entities.mentionedPeopleIds.length > 0 || entities.needsRules) {
    context = await loadTargetedContext(entities.mentionedPeopleIds, {
      needsRules: entities.needsRules,
      needsConversations: entities.needsConversations
    });
    console.log(`Loaded context: ${context.people.length} people, ${context.issues.length} issues, ${context.messages.length} messages, ${context.rules.length} rules`);
  }
  
  onContextLoading?.(false);

  // Add file context to the latest message if provided
  if (fileData && chatMessages.length > 0) {
    const lastIdx = chatMessages.length - 1;
    if (fileData.base64) {
      chatMessages[lastIdx] = {
        role: 'user',
        content: [
          { type: 'text', text: userContent },
          { type: 'image_url', image_url: { url: fileData.base64 } }
        ]
      };
    } else if (fileData.images && fileData.images.length > 0) {
      chatMessages[lastIdx] = {
        role: 'user',
        content: [
          { type: 'text', text: userContent },
          ...fileData.images.map(img => ({ type: 'image_url', image_url: { url: img } }))
        ]
      };
    } else if (fileData.text) {
      chatMessages[lastIdx] = {
        role: 'user',
        content: `${userContent}\n\nAttached file content:\n${fileData.text}`
      };
    }
  }

  // Get the session access token for authenticated request
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    return { stream: null, error: 'Not authenticated' };
  }

  // PHASE 3: Make contextual chat request
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        operation: 'chat',
        messages: chatMessages,
        context: context // Pass targeted context to edge function
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return { stream: null, error: errorData.error || 'Failed to connect to assistant' };
  }

  return { stream: response.body };
}

/**
 * Process a streaming response and accumulate the full text
 */
export async function processStream(
  stream: ReadableStream,
  onChunk: (text: string) => void
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch {
          // Incomplete JSON, will be completed in next chunk
          buffer = line + '\n' + buffer;
          break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}

/**
 * Clarify a person's role and relationships using AI (iterative free-text mode)
 */
export async function clarifyPerson(
  role: Role,
  fullName: string,
  description: string,
  existingPeople: Person[],
  conversationHistory: ConversationTurn[] = []
): Promise<ClarificationResult> {
  const { data, error } = await supabase.functions.invoke('clarify-person', {
    body: {
      role,
      fullName,
      description,
      existingPeople: existingPeople.map(p => ({
        id: p.id,
        fullName: p.fullName,
        role: p.role,
        roleContext: p.roleContext
      })),
      conversationHistory
    }
  });

  if (error) {
    console.error('Clarify person error:', error);
    throw error;
  }

  return {
    complete: data.complete ?? false,
    question: data.question,
    currentUnderstanding: data.currentUnderstanding,
    enrichedContext: data.enrichedContext,
    suggestedRelationships: data.suggestedRelationships || []
  };
}

/**
 * Parse a legal document (parenting plan, court order, etc.) and extract all relevant information
 * Uses two-path approach: text extraction for regular PDFs, Vision API for scanned documents
 */
/**
 * Options for parsing legal documents
 */
export interface ParseLegalDocumentOptions {
  existingPeople?: Person[];  // Existing people to match against
  additionalQuery?: string;   // Optional query for targeted re-extraction
}

/**
 * Parse a legal document using AI
 * Accepts optional existing people for matching and additional query for re-extraction
 */
export async function parseLegalDocument(
  file: File,
  options: ParseLegalDocumentOptions = {}
): Promise<DocumentExtractionResult> {
  const { existingPeople, additionalQuery } = options;
  const mimeType = file.type;
  const fileName = file.name;

  console.log(`Parsing legal document: ${fileName}, type: ${mimeType}`);
  if (existingPeople?.length) {
    console.log(`Passing ${existingPeople.length} existing people for matching`);
  }

  let requestBody: any;
  let processingPath: 'text' | 'vision' = 'text';
  let pdfInfo: PDFExtractionResult | null = null;

  // Handle different file types
  if (mimeType === 'application/pdf') {
    // Verify PDF worker is ready before attempting extraction
    if (!isPdfWorkerReady()) {
      const diagnostics = getPdfWorkerDiagnostics();
      console.error('PDF worker not initialized:', diagnostics);
      throw new Error(
        'PDF processing engine failed to start. Please refresh the page and try again. ' +
        `(Worker diagnostics: ${JSON.stringify(diagnostics)})`
      );
    }
    
    // Extract text from PDF using PDF.js
    console.log('Extracting text from PDF...');
    try {
      pdfInfo = await extractTextFromPDF(file);
    } catch (pdfError) {
      const diagnostics = getPdfWorkerDiagnostics();
      console.error('PDF extraction failed:', pdfError, diagnostics);
      throw new Error(
        `Failed to read PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}. ` +
        'The file may be encrypted, corrupted, or in an unsupported format.'
      );
    }
    
    console.log(`PDF extraction complete: ${pdfInfo.extractedPages}/${pdfInfo.totalPages} pages, ` +
      `${pdfInfo.estimatedTokens} estimated tokens, scanned: ${pdfInfo.isLikelyScanned}`);

    if (pdfInfo.isLikelyScanned) {
      // Use Vision API for scanned documents
      console.log('Detected scanned PDF, converting to images for Vision API...');
      processingPath = 'vision';
      const { images, pageCount } = await convertPDFPagesToImages(file, 10);
      
      requestBody = {
        images,
        fileName,
        mimeType,
        totalPages: pageCount,
        isScanned: true
      };
    } else {
      // Use text content for regular PDFs
      processingPath = 'text';
      requestBody = {
        documentContent: pdfInfo.totalText,
        fileName,
        mimeType,
        totalPages: pdfInfo.totalPages,
        extractedPages: pdfInfo.extractedPages,
        wasTruncated: pdfInfo.extractedPages < pdfInfo.totalPages || 
                      pdfInfo.estimatedTokens > 80000
      };
    }
  } else if (mimeType.startsWith('image/')) {
    // For images, use Vision API directly
    processingPath = 'vision';
    const base64 = await fileToBase64(file);
    requestBody = {
      images: [base64],
      fileName,
      mimeType,
      totalPages: 1,
      isScanned: true
    };
  } else {
    // For text files, read as text
    processingPath = 'text';
    const textContent = await file.text();
    requestBody = {
      documentContent: textContent,
      fileName,
      mimeType,
      totalPages: 1,
      extractedPages: 1,
      wasTruncated: false
    };
  }

  // Add existing people for matching if provided
  if (existingPeople && existingPeople.length > 0) {
    requestBody.existingPeople = existingPeople.map(p => ({
      id: p.id,
      name: p.fullName,
      role: p.role,
      roleContext: p.roleContext
    }));
  }

  // Add additional query for targeted re-extraction
  if (additionalQuery) {
    requestBody.additionalQuery = additionalQuery;
  }

  console.log(`Using ${processingPath} path for document processing`);

  const { data, error } = await supabase.functions.invoke('parse-legal-document', {
    body: requestBody
  });

  if (error) {
    console.error('Parse legal document error:', error);
    throw new Error(error.message || 'Failed to parse legal document');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  // Normalize the extracted people roles to match our Role enum
  const normalizedPeople = (data.extractedPeople || []).map((person: any) => ({
    ...person,
    suggestedRole: normalizeRole(person.suggestedRole),
    includeInCreation: true
  }));

  // Clauses are deprecated - always return empty array
  const normalizedClauses: any[] = [];

  const normalizedAgreements = (data.operationalAgreements || []).map((agreement: any) => ({
    ...agreement,
    include: true
  }));

  // Build processing info
  const processingInfo: PDFProcessingInfo = {
    processingPath,
    totalPages: pdfInfo?.totalPages || 1,
    extractedPages: pdfInfo?.extractedPages || 1,
    wasTruncated: pdfInfo ? (pdfInfo.extractedPages < pdfInfo.totalPages) : false,
    estimatedTokens: pdfInfo?.estimatedTokens
  };

  return {
    metadata: data.metadata,
    extractedPeople: normalizedPeople,
    legalClauses: normalizedClauses,
    operationalAgreements: normalizedAgreements,
    processingInfo,
    partyNameMap: data.partyNameMap || {}
  };
}

/**
 * Normalize role strings from AI to our Role enum
 */
function normalizeRole(roleStr: string): Role {
  const normalized = roleStr?.toLowerCase().replace(/[-_\s]/g, '');
  
  switch (normalized) {
    case 'parent':
    case 'mother':
    case 'father':
      return Role.Parent;
    case 'child':
    case 'minorchild':
      return Role.Child;
    case 'stepparent':
    case 'stepmother':
    case 'stepfather':
      return Role.StepParent;
    case 'clinician':
    case 'therapist':
    case 'counselor':
    case 'psychologist':
    case 'psychiatrist':
      return Role.Clinician;
    case 'legal':
    case 'attorney':
    case 'lawyer':
    case 'judge':
    case 'magistrate':
    case 'guardian':
    case 'gal':
    case 'guardianadlitem':
      return Role.Legal;
    default:
      return Role.Other;
  }
}
