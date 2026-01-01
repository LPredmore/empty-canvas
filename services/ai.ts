import { ParsedConversation, parseOFWExport, parseGmailExport, parseGenericText } from "../utils/parsers";
import { MessageDirection, IssuePriority, AssistantSenderType, Role, AgreementStatus, AgreementSourceType, SourceType } from "../types";
import { api, COPARENTING_ASSISTANT_INSTRUCTIONS } from "./api";

// Helper to robustly get env vars in different build environments
const getEnvVar = (key: string): string | undefined => {
  // Check process.env (Standard/Create-React-App/Next.js)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  // Check import.meta.env (Vite)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  return undefined;
};

/**
 * Robustly gets the OpenRouter API Key.
 * 1. Checks localStorage for a manually set key (bypasses env issues)
 * 2. Checks env vars
 * 3. Filters out Supabase keys (starting with eyJ) which cause 401 errors
 */
const getOpenRouterKey = () => {
  const manualKey = localStorage.getItem('openrouter_api_key');
  if (manualKey && manualKey.startsWith('sk-or-')) return manualKey;

  const keys = [
    getEnvVar('OPENROUTER_API_KEY'),
    getEnvVar('VITE_OPENROUTER_API_KEY'),
    getEnvVar('REACT_APP_OPENROUTER_API_KEY'),
    getEnvVar('API_KEY'),
    getEnvVar('VITE_API_KEY')
  ];

  for (const k of keys) {
    if (k && !k.startsWith('eyJ') && k.length > 20) {
      return k;
    }
  }
  return undefined;
};

const SITE_URL = window.location.origin; 
const SITE_NAME = 'CoParent Intel';

// --- Schemas (JSON Schema format for Prompting) ---

const IMPORT_SCHEMA_DESC = `
{
  "title": "string (Short descriptive title)",
  "sourceType": "string (OFW, Email, SMS, or Manual)",
  "participants": ["string (list of names)"],
  "messages": [
    {
      "senderName": "string",
      "sentAt": "string (ISO 8601 Date)",
      "body": "string",
      "direction": "string (inbound or outbound)"
    }
  ]
}
`;

const ANALYSIS_SCHEMA_DESC = `
{
  "clinical_assessment": "string (Professional assessment of style/patterns)",
  "new_issues": [
    {
      "title": "string",
      "description": "string (Detailed description with evidence)",
      "priority": "string (low, medium, high)",
      "recommendation": "string"
    }
  ],
  "patterns": [
    {
      "title": "string",
      "description": "string",
      "related_issue_id": "string (UUID or null)"
    }
  ],
  "strategies": [
    {
      "title": "string",
      "description": "string"
    }
  ]
}
`;

const ASSISTANT_RESPONSE_SCHEMA_DESC = `
{
  "response_text": "string (Direct response to user, formatted with markdown)",
  "identified_actions": {
    "conversation_update": {
      "existing_conversation_id": "string (UUID or null)",
      "create_new": "boolean",
      "title": "string",
      "sourceType": "string"
    },
    "updated_issues": [
      {
        "id": "string (UUID)",
        "status_change": "string (open, monitoring, resolved, archived, no_change)",
        "add_evidence_note": "string (Note to append)"
      }
    ],
    "new_agreements": [
      {
        "title": "string",
        "description": "string"
      }
    ]
  }
}
`;

// --- Helper Functions ---

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = error => reject(error);
  });
};

const callOpenRouter = async (messages: any[], jsonSchemaDesc?: string): Promise<any> => {
    const key = getOpenRouterKey();
    if (!key) {
        throw new Error("MISSING_API_KEY: Please set your OpenRouter API Key in the Assistant Settings.");
    }

    try {
        const payload: any = {
            model: "openai/gpt-4o",
            messages: messages
        };

        if (jsonSchemaDesc) {
            payload.response_format = { type: "json_object" };
            const systemMsgIndex = payload.messages.findIndex((m: any) => m.role === 'system');
            const instruction = `\n\nIMPORTANT: Output strictly valid JSON matching this schema:\n${jsonSchemaDesc}`;
            
            if (systemMsgIndex >= 0) {
                payload.messages[systemMsgIndex].content += instruction;
            } else {
                payload.messages.unshift({ role: 'system', content: instruction });
            }
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${key}`,
                "HTTP-Referer": SITE_URL,
                "X-Title": SITE_NAME,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorDetails = "";
            try {
                const errorJson = await response.json();
                errorDetails = JSON.stringify(errorJson);
                if (errorJson.error?.message?.includes("No cookie auth")) {
                    throw new Error("AUTH_INTERCEPTED: The request was intercepted by a Supabase auth layer. Please ensure your API Key starts with 'sk-or-'.");
                }
            } catch (e) {
                errorDetails = await response.text();
            }
            
            if (response.status === 401) {
                throw new Error("AUTH_FAILED: Authentication with OpenRouter failed. Check your API Key.");
            }
            throw new Error(`AI Provider Error (${response.status}): ${errorDetails}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content;

        if (jsonSchemaDesc) {
            try {
                return JSON.parse(content);
            } catch (e) {
                console.error("Failed to parse JSON response", content);
                throw new Error("AI returned invalid JSON format.");
            }
        }

        return content;
    } catch (error) {
        console.error("AI Service Error:", error);
        throw error;
    }
};

// --- Core AI Functions ---

export const parseFileWithAI = async (file: File): Promise<ParsedConversation> => {
  try {
    const dataUrl = await fileToBase64(file);
    
    if (file.type.includes('pdf')) {
        throw new Error("PDF parsing is not supported with the current AI model. Please upload an image (screenshot) or paste the text.");
    }

    const messages = [
        {
            role: "system",
            content: "You are a data extraction specialist. Extract conversation history from the provided image into the required JSON format."
        },
        {
            role: "user",
            content: [
                { type: "text", text: "Analyze this image and extract the conversation history." },
                { type: "image_url", image_url: { url: dataUrl } }
            ]
        }
    ];

    const result = await callOpenRouter(messages, IMPORT_SCHEMA_DESC);

    return {
      title: result.title,
      participants: new Set(result.participants),
      lastDate: new Date(),
      messages: result.messages.map((m: any) => ({
        senderName: m.senderName,
        receiverName: "Unknown", 
        sentAt: new Date(m.sentAt),
        subject: result.title,
        body: m.body,
        direction: m.direction === "outbound" ? MessageDirection.Outbound : MessageDirection.Inbound
      })).sort((a: any, b: any) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
    };

  } catch (error: any) {
    console.error("AI Parsing Error:", error);
    throw new Error(error.message || "Failed to parse document.");
  }
};

export const generatePersonAnalysis = async (personId: string): Promise<void> => {
    try {
        const person = await api.getPerson(personId);
        if (!person) throw new Error("Person not found");

        const allConversations = await api.getConversations();
        const involvedConversations = allConversations.filter(c => c.participantIds.includes(personId));
        
        const messagesPromises = involvedConversations.map(c => api.getMessages(c.id));
        const allMessagesArrays = await Promise.all(messagesPromises);
        const allMessages = allMessagesArrays.flat().sort((a,b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()).slice(-500);

        const agreements = await api.getAgreements();
        const involvedAgreements = agreements.filter(a => a.partyIds.includes(personId));

        const issues = await api.getIssues();

        const prompt = `
            You are a senior forensic psychologist and Guardian ad Litem (GAL) evaluator.
            Your task is to analyze the communication history of: ${person.fullName} (${person.role}).

            **Data for Analysis:**
            - **Recent Communications:**
              ${allMessages.map(m => `[${m.sentAt}] ${m.senderId === personId ? person.fullName : 'Other'}: ${m.rawText}`).join('\n')}
            - **Agreements:**
              ${involvedAgreements.map(a => `- ${a.title}: ${a.description} (${a.status})`).join('\n')}
            - **Known Issues:**
              ${issues.map(i => `- Issue ID ${i.id}: ${i.title} (${i.status})`).join('\n')}

            **Analysis Objectives:**
            1. **Clinical Assessment:** Professional assessment using forensic psychology standards.
            2. **Identify Unresolved Conflicts:** Flag violations not yet tracked.
            3. **Behavioral Patterns:** Identify specific high-conflict traits.
            4. **Strategic Recommendations:** Concrete action plan for the user.
        `;

        const result = await callOpenRouter([
            { role: "system", content: "You are a forensic psychology expert specialized in high-conflict custody cases." },
            { role: "user", content: prompt }
        ], ANALYSIS_SCHEMA_DESC);
        
        if (result.clinical_assessment) {
            await api.updatePerson(personId, { notes: result.clinical_assessment });
        }

        if (result.new_issues && Array.isArray(result.new_issues)) {
           for (const issue of result.new_issues) {
              const createdIssue = await api.createIssue({
                 title: issue.title,
                 description: issue.description,
                 priority: issue.priority as IssuePriority,
                 status: 'open' as any
              });

              await api.createProfileNote({
                 personId: personId,
                 issueId: createdIssue.id,
                 type: 'observation',
                 content: `**AI Detected Issue:** ${issue.description}\n\n**Recommendation:** ${issue.recommendation}`
              });
           }
        }

        for (const pattern of result.patterns) {
            await api.createProfileNote({
                personId: personId,
                type: 'pattern',
                content: `**${pattern.title}**\n${pattern.description}`,
                issueId: pattern.related_issue_id || undefined
            });
        }

        for (const strategy of result.strategies) {
             await api.createProfileNote({
                personId: personId,
                type: 'strategy',
                content: `**${strategy.title}**\n${strategy.description}`
            });
        }

    } catch (error) {
        console.error("Analysis Error:", error);
        throw new Error("Failed to generate analysis.");
    }
};

/**
 * Main Assistant Logic
 */
export const chatWithAssistant = async (
    sessionId: string, 
    userContent: string, 
    file?: File
): Promise<any> => {
    
    await api.saveAssistantMessage(sessionId, AssistantSenderType.User, userContent);

    let parsedConversation: ParsedConversation | null = null;
    let fileContext = "";
    
    if (file) {
        try {
            const text = await file.text();
            if (file.type.includes('image')) {
                 try {
                    parsedConversation = await parseFileWithAI(file);
                    fileContext = JSON.stringify(parsedConversation, null, 2);
                 } catch (err) {
                    fileContext = `[Error parsing image: ${(err as Error).message}]`;
                 }
            } else if (file.type.includes('pdf')) {
                 fileContext = "[Attached File: PDF. Note: AI cannot read PDF content directly via current API. Please upload images/screenshots instead.]";
            } else {
                 if (text.includes('OurFamilyWizard')) {
                     parsedConversation = parseOFWExport(text);
                 } else if (text.includes('Gmail')) {
                     parsedConversation = parseGmailExport(text);
                 } else {
                     parsedConversation = parseGenericText(text);
                 }
                 fileContext = JSON.stringify(parsedConversation, null, 2);
            }
        } catch (e) {
            console.error("Error parsing file for context", e);
            fileContext = "Error reading file content.";
        }
    }

    const issues = await api.getIssues();
    const agreements = await api.getAgreements();
    const people = await api.getPeople();
    const recentMessages = await api.getRecentMessages(100);
    const activeClauses = await api.getAllActiveLegalClauses();
    const activeItems = await api.getAllActiveAgreementItems();

    const personMap = new Map(people.map(p => [p.id, p.fullName]));

    const readableMessages = recentMessages.map(m => {
        const sender = personMap.get(m.senderId) || 'Unknown';
        return `[${m.sentAt}] ${sender}: ${m.rawText}`;
    }).join('\n');

    const readableClauses = activeClauses.map(c => 
        `- Legal Rule (${c.clauseRef}): ${c.fullText.substring(0, 150)}...`
    ).join('\n');

    const readableItems = activeItems.map(i => 
        `- Agreement Item: ${i.fullText}`
    ).join('\n');

    const systemPrompt = COPARENTING_ASSISTANT_INSTRUCTIONS;
    
    const contextPrompt = `
        **DEEP CONTEXT:**
        
        [EXISTING ISSUES]
        ${issues.map(i => `- ${i.title} (${i.status}): ${i.description}`).join('\n')}

        [ACTIVE AGREEMENTS & RULES]
        ${readableItems}
        ${readableClauses}
        
        [COMMUNICATION HISTORY]
        ${readableMessages || "No recent messages found."}
        
        **USER INPUT:** "${userContent}"
        
        ${fileContext ? `**ATTACHED FILE CONTENT:**\n${fileContext}` : ''}
    `;

    const result = await callOpenRouter([
        { role: "system", content: systemPrompt },
        { role: "user", content: contextPrompt }
    ], ASSISTANT_RESPONSE_SCHEMA_DESC);

    let linkedType = 'none';
    let linkedId: string | undefined = undefined;

    const actions = result.identified_actions;

    if (parsedConversation) {
        if (actions.conversation_update?.existing_conversation_id) {
            const convId = actions.conversation_update.existing_conversation_id;
            const messagesToSave = mapParsedMessagesToDB(parsedConversation.messages, people);
            await api.appendMessagesToConversation(convId, messagesToSave);
            linkedType = 'conversation';
            linkedId = convId;
        } else if (actions.conversation_update?.create_new) {
            const participantIds = mapParticipantsToIds(parsedConversation.participants, people);
            const messagesToSave = mapParsedMessagesToDB(parsedConversation.messages, people);
            
            const newConv = await api.importConversation({
                title: parsedConversation.title,
                sourceType: parsedConversation.title.includes('OFW') ? SourceType.OFW : SourceType.Email,
                startedAt: parsedConversation.messages[0]?.sentAt.toISOString(),
                previewText: parsedConversation.messages[0]?.body.substring(0, 100)
            }, participantIds, messagesToSave);
            
            linkedType = 'conversation';
            linkedId = newConv.id;
        }
    }

    if (actions.updated_issues && Array.isArray(actions.updated_issues)) {
        for (const update of actions.updated_issues) {
            if (update.status_change && update.status_change !== 'no_change') {
                const issue = await api.getIssue(update.id);
                if (issue) {
                    await api.updateIssue(update.id, { status: update.status_change as any });
                }
            }
            if (update.add_evidence_note) {
                await api.createEvent({
                    title: "Issue Update via Assistant",
                    description: update.add_evidence_note,
                    date: new Date().toISOString(),
                    relatedIssueIds: [update.id]
                });
                if (linkedType === 'none') {
                    linkedType = 'issue';
                    linkedId = update.id;
                }
            }
        }
    }

    if (actions.new_agreements && Array.isArray(actions.new_agreements)) {
        for (const ag of actions.new_agreements) {
            const newAg = await api.createAgreement({
                title: ag.title,
                description: ag.description,
                status: AgreementStatus.Agreed,
                sourceType: AgreementSourceType.Other,
                agreedDate: new Date().toISOString()
            });
            if (linkedType === 'none') {
                linkedType = 'agreement';
                linkedId = newAg.id;
            }
        }
    }

    return await api.saveAssistantMessage(
        sessionId, 
        AssistantSenderType.Assistant, 
        result.response_text, 
        linkedType === 'none' ? undefined : linkedType, 
        linkedId
    );
};

const mapParticipantsToIds = (participants: Set<string>, existingPeople: any[]): string[] => {
    const ids: string[] = [];
    participants.forEach(name => {
        const match = existingPeople.find((p: any) => 
            p.fullName.toLowerCase().includes(name.toLowerCase()) || 
            name.toLowerCase().includes(p.fullName.toLowerCase())
        );
        if (match) ids.push(match.id);
    });
    return ids;
};

const mapParsedMessagesToDB = (messages: any[], existingPeople: any[]): any[] => {
    return messages.map(m => {
        const match = existingPeople.find((p: any) => 
            p.fullName.toLowerCase().includes(m.senderName.toLowerCase()) || 
            m.senderName.toLowerCase().includes(p.fullName.toLowerCase())
        );
        
        let direction = MessageDirection.Inbound;
        if (match?.role === Role.Me) direction = MessageDirection.Outbound;

        return {
            senderId: match?.id, 
            rawText: m.body,
            sentAt: m.sentAt.toISOString(),
            direction: direction
        };
    }).filter(m => m.senderId);
};
