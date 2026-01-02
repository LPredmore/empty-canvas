import { supabase } from '../lib/supabase';
import { api } from './api';
import { 
  AssistantSenderType, 
  MessageDirection, 
  Role, 
  Person, 
  ClarificationResult, 
  ConversationTurn,
  DocumentExtractionResult,
  PDFProcessingInfo
} from '../types';
import { 
  extractTextFromPDF, 
  convertPDFPagesToImages, 
  PDFExtractionResult 
} from '../utils/pdfExtractor';
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
  let fileData: { base64?: string; text?: string } = {};

  if (file.type.startsWith('image/')) {
    fileData.base64 = await fileToBase64(file);
  } else {
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
 * Chat with the AI assistant - returns a streaming response
 */
export async function chatWithAssistant(
  sessionId: string,
  userContent: string,
  file?: File
): Promise<{ stream: ReadableStream | null; error?: string }> {
  // Save the user message first
  await api.saveAssistantMessage(sessionId, AssistantSenderType.User, userContent);

  // Prepare file data if provided
  let fileData: { base64?: string; text?: string } | undefined;
  if (file) {
    if (file.type.startsWith('image/')) {
      fileData = { base64: await fileToBase64(file) };
    } else {
      fileData = { text: await file.text() };
    }
  }

  // Get conversation history for context
  const messages = await api.getAssistantMessages(sessionId);
  const chatMessages = messages.map((m: any) => ({
    role: m.senderType === AssistantSenderType.User ? 'user' : 'assistant',
    content: m.content
  }));

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

  // Make streaming request directly to edge function
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
        messages: chatMessages
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
export async function parseLegalDocument(file: File): Promise<DocumentExtractionResult> {
  const mimeType = file.type;
  const fileName = file.name;

  console.log(`Parsing legal document: ${fileName}, type: ${mimeType}`);

  let requestBody: any;
  let processingPath: 'text' | 'vision' = 'text';
  let pdfInfo: PDFExtractionResult | null = null;

  // Handle different file types
  if (mimeType === 'application/pdf') {
    // Extract text from PDF using PDF.js
    console.log('Extracting text from PDF...');
    pdfInfo = await extractTextFromPDF(file);
    
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

  // Mark all clauses and agreements as included by default
  const normalizedClauses = (data.legalClauses || []).map((clause: any) => ({
    ...clause,
    include: true
  }));

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
    processingInfo
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
