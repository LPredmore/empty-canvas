import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { parseFileWithAI } from '../services/ai';
import { Person, SourceType, MessageDirection, Role, AgreementItem, Issue } from '../types';
import { ConversationAnalysisResult, AnalysisSummary, DetectedAgreement } from '../types/analysisTypes';
import { parseOFWExport, parseGenericText, parseGmailExport, ParsedConversation } from '../utils/parsers';
import { generateMessageHash } from '../utils/messageHash';
import { supabase } from '../lib/supabase';
import { DetectedAgreementsReview } from './DetectedAgreementsReview';
import { ContinuityModal, ConversationMatch } from './ContinuityModal';
import { 
  X, Upload, Calendar, Users, ArrowRight, Save, Loader2, CheckCircle2, 
  FileText, Trash2, FileType, AlertTriangle, Brain, Shield, TrendingUp, Handshake
} from 'lucide-react';
import { format } from 'date-fns';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (conversationId: string) => void;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [existingPeople, setExistingPeople] = useState<Person[]>([]);

  // Form State
  const [sourceType, setSourceType] = useState<SourceType>(SourceType.OFW);
  const [importMode, setImportMode] = useState<'text' | 'file'>('file');
  const [rawContent, setRawContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Parsed Data State
  const [parsedData, setParsedData] = useState<ParsedConversation | null>(null);
  const [conversationTitle, setConversationTitle] = useState('');
  const [nameMapping, setNameMapping] = useState<Record<string, string>>({});
  
  // Analysis State
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null);
  const [showAnalysisSummary, setShowAnalysisSummary] = useState(false);
  const [savedConversationId, setSavedConversationId] = useState<string | null>(null);
  
  // Detected Agreements State
  const [detectedAgreements, setDetectedAgreements] = useState<DetectedAgreement[]>([]);
  const [showAgreementsReview, setShowAgreementsReview] = useState(false);
  const [agreementsSavedCount, setAgreementsSavedCount] = useState(0);
  
  // Continuity Detection State
  const [matchedConversations, setMatchedConversations] = useState<ConversationMatch[]>([]);
  const [showContinuityModal, setShowContinuityModal] = useState(false);
  const [messageHashes, setMessageHashes] = useState<string[]>([]);
  const [appendLoading, setAppendLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      api.getPeople().then(setExistingPeople);
    }
  }, [isOpen]);

  const handleParse = async () => {
    setLoading(true);
    setParsedData(null);
    setMatchedConversations([]);
    setMessageHashes([]);

    try {
        let result: ParsedConversation;

        if (importMode === 'file' && selectedFile) {
            result = await parseFileWithAI(selectedFile);
        } else {
            if (sourceType === SourceType.OFW) {
                result = parseOFWExport(rawContent);
            } else if (sourceType === SourceType.Email) {
                result = parseGmailExport(rawContent);
            } else {
                result = parseGenericText(rawContent);
            }
        }
        
        setParsedData(result);
        setConversationTitle(result.title);
        
        const newMapping: Record<string, string> = {};
        result.participants.forEach(name => {
            const match = existingPeople.find(p => 
                p.fullName.toLowerCase() === name.toLowerCase() || 
                p.fullName.toLowerCase().includes(name.toLowerCase())
            );
            if (match) {
                newMapping[name] = match.id;
            } else {
                newMapping[name] = 'new';
            }
        });
        setNameMapping(newMapping);
        
        // Generate message hashes for deduplication
        const hashes = result.messages.map(msg => {
            const senderPerson = existingPeople.find(p => 
              p.fullName.toLowerCase() === msg.senderName.toLowerCase() ||
              p.fullName.toLowerCase().includes(msg.senderName.toLowerCase())
            );
            return generateMessageHash(
              senderPerson?.id || msg.senderName,
              msg.sentAt,
              msg.body
            );
        });
        setMessageHashes(hashes);
        
        // Check for matching conversations (only if we have resolved participant IDs)
        const resolvedParticipantIds = Object.entries(newMapping)
          .filter(([_, id]) => id !== 'new' && id !== 'ignore')
          .map(([_, id]) => id);
        
        if (resolvedParticipantIds.length > 0 && result.messages.length > 0) {
          const sortedMessages = [...result.messages].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
          const dateRange = {
            start: sortedMessages[0].sentAt,
            end: sortedMessages[sortedMessages.length - 1].sentAt
          };
          
          const matches = await api.findMatchingConversations(
            resolvedParticipantIds,
            dateRange,
            hashes
          );
          
          // Only show continuity modal if there are high-confidence matches (with duplicate messages)
          const highConfidenceMatches = matches.filter(m => m.overlapType === 'has_duplicate_messages');
          if (highConfidenceMatches.length > 0) {
            setMatchedConversations(highConfidenceMatches);
            setShowContinuityModal(true);
            setLoading(false);
            return; // Don't proceed to step 2 yet
          }
        }
        
        setStep(2);

    } catch (error: any) {
        console.error('Parse error:', error);
        const errorMessage = error?.message || 'Unknown error';
        
        if (errorMessage.includes('PDF processing engine')) {
          alert('The PDF processor failed to initialize. Please refresh the page and try again.');
        } else if (errorMessage.includes('exceeds maximum size') || errorMessage.includes('413')) {
          alert('This file is too large to process. Try uploading a shorter document or splitting it into parts.');
        } else if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
          alert('Too many requests. Please wait a moment and try again.');
        } else if (errorMessage.includes('corrupted') || errorMessage.includes('encrypted')) {
          alert('Failed to read the PDF. The file may be corrupted, encrypted, or in an unsupported format.');
        } else {
          alert(`Failed to parse file: ${errorMessage}`);
        }
    } finally {
        setLoading(false);
    }
  };

  // Handle appending to existing conversation
  const handleAppendToConversation = async (targetConversationId: string) => {
    if (!parsedData) return;
    
    setAppendLoading(true);
    
    try {
      // Resolve people first
      const nameToIdMap: Record<string, string> = {};
      const participants = Array.from(parsedData.participants) as string[];
      
      for (const name of participants) {
        const action = nameMapping[name];
        if (action === 'new') {
          const newPerson = await api.createPerson({ fullName: name, role: Role.Parent });
          nameToIdMap[name] = newPerson.id;
        } else if (action && action !== 'ignore') {
          nameToIdMap[name] = action;
        }
      }
      
      // Prepare messages with hashes
      const messagesToAppend = parsedData.messages.map((msg, idx) => {
        const senderId = nameToIdMap[msg.senderName];
        const receiverId = nameToIdMap[msg.receiverName];
        const senderPerson = existingPeople.find(p => p.id === senderId);
        const direction = senderPerson?.role === Role.Me ? MessageDirection.Outbound : MessageDirection.Inbound;
        
        return {
          rawText: msg.body,
          sentAt: msg.sentAt.toISOString(),
          senderId,
          receiverId: receiverId || undefined,
          direction,
          contentHash: messageHashes[idx]
        };
      }).filter(m => m.senderId);
      
      // Append with deduplication
      const { addedCount, skippedCount } = await api.appendMessagesWithDeduplication(
        targetConversationId,
        messagesToAppend
      );
      
      console.log(`Appended ${addedCount} messages, skipped ${skippedCount} duplicates`);
      
      setShowContinuityModal(false);
      setSavedConversationId(targetConversationId);
      
      // Get all messages for re-analysis
      setAnalysisLoading(true);
      const allMessages = await api.getMessages(targetConversationId);
      const messagesForAnalysis = allMessages.map(m => ({
        id: m.id,
        senderId: m.senderId,
        receiverId: m.receiverId,
        rawText: m.rawText,
        sentAt: m.sentAt
      }));
      
      // Get conversation details for participant IDs
      const conv = await api.getConversation(targetConversationId);
      const participantIds = conv?.participantIds || Object.values(nameToIdMap);
      
      // Run re-analysis on complete conversation
      const summary = await runConversationAnalysis(
        targetConversationId,
        messagesForAnalysis,
        participantIds,
        true // isReanalysis flag
      );
      
      setAnalysisLoading(false);
      
      if (summary) {
        setAnalysisSummary(summary);
        if (detectedAgreements.length > 0) {
          setShowAgreementsReview(true);
        } else {
          setShowAnalysisSummary(true);
        }
      } else {
        onSuccess(targetConversationId);
        handleReset();
      }
      
    } catch (error) {
      console.error('Append error:', error);
      alert('Failed to append messages to conversation.');
    } finally {
      setAppendLoading(false);
      setAnalysisLoading(false);
    }
  };

  const handleCreateSeparate = () => {
    setShowContinuityModal(false);
    setStep(2);
  };

  const handleCancelContinuity = () => {
    setShowContinuityModal(false);
    setParsedData(null);
    setMessageHashes([]);
  };

  const runConversationAnalysis = async (
    conversationId: string,
    savedMessages: Array<{ id: string; senderId: string; receiverId?: string; rawText: string; sentAt: string }>,
    participantIds: string[],
    isReanalysis: boolean = false
  ): Promise<AnalysisSummary | null> => {
    try {
      // Fetch all context needed for analysis
      const [agreementItems, existingIssues, relationships] = await Promise.all([
        api.getAllActiveAgreementItems(),
        api.getIssues(),
        Promise.all(participantIds.map(id => api.getPersonRelationships(id)))
      ]);

      // Build participant data with relationships
      const participants = participantIds.map((id, idx) => {
        const person = existingPeople.find(p => p.id === id);
        const personRelationships = relationships[idx] || [];
        return {
          id,
          fullName: person?.fullName || 'Unknown',
          role: person?.role || 'Other',
          roleContext: person?.roleContext,
          relationships: personRelationships.map(r => ({
            relatedPersonId: r.relatedPersonId,
            relatedPersonName: existingPeople.find(p => p.id === r.relatedPersonId)?.fullName || 'Unknown',
            relationshipType: r.relationshipType
          }))
        };
      });

      // Find the "Me" person
      const mePerson = existingPeople.find(p => p.role === Role.Me);
      const mePersonId = mePerson?.id || participantIds[0];

      // Call the analysis edge function
      const { data, error } = await supabase.functions.invoke('analyze-conversation-import', {
        body: {
          conversationId,
          messages: savedMessages,
          participants,
          agreementItems: agreementItems.map(item => ({
            id: item.id,
            topic: item.topic,
            fullText: item.fullText,
            summary: item.summary
          })),
          existingIssues: existingIssues.map(issue => ({
            id: issue.id,
            title: issue.title,
            description: issue.description,
            status: issue.status,
            priority: issue.priority
          })),
          mePersonId,
          isReanalysis
        }
      });

      if (error) {
        console.error('Analysis error:', error);
        return null;
      }

      const analysisResult = data as ConversationAnalysisResult;

      // Process the analysis results (issues, profile notes, etc.)
      await processAnalysisResults(conversationId, analysisResult, savedMessages);

      // Persist conversation state (resolution status)
      if (analysisResult.conversationState) {
        const { status, pendingResponderName } = analysisResult.conversationState;
        
        // Resolve name to ID using participant mapping
        let pendingResponderId: string | null = null;
        if (pendingResponderName) {
          const participants = await api.getPeople();
          const match = participants.find(p => 
            p.fullName.toLowerCase() === pendingResponderName.toLowerCase() ||
            p.fullName.toLowerCase().includes(pendingResponderName.toLowerCase()) ||
            pendingResponderName.toLowerCase().includes(p.fullName.toLowerCase())
          );
          pendingResponderId = match?.id || null;
        }
        
        await api.updateConversationStatus(conversationId, status, pendingResponderId);
      }

      // Store detected agreements for review
      const detectedAgreementsFromAnalysis = analysisResult.detectedAgreements || [];
      if (detectedAgreementsFromAnalysis.length > 0) {
        setDetectedAgreements(detectedAgreementsFromAnalysis);
      }

      // Build summary for user
      const summary: AnalysisSummary = {
        conversationTone: analysisResult.conversationAnalysis?.overallTone || 'neutral',
        issuesCreated: analysisResult.issueActions?.filter(a => a.action === 'create').length || 0,
        issuesUpdated: analysisResult.issueActions?.filter(a => a.action === 'update').length || 0,
        violationsDetected: analysisResult.agreementViolations?.length || 0,
        peopleAnalyzed: analysisResult.personAnalyses?.length || 0,
        keyFindings: extractKeyFindings(analysisResult),
        agreementsDetected: detectedAgreementsFromAnalysis.length
      };

      return summary;

    } catch (error) {
      console.error('Analysis failed:', error);
      return null;
    }
  };

  const processAnalysisResults = async (
    conversationId: string,
    analysis: ConversationAnalysisResult,
    savedMessages: Array<{ id: string; senderId: string; receiverId?: string; rawText: string; sentAt: string }>
  ) => {
    // 1. Save conversation analysis
    if (analysis.conversationAnalysis) {
      await api.saveConversationAnalysis({
        conversationId,
        summary: analysis.conversationAnalysis.summary,
        overallTone: analysis.conversationAnalysis.overallTone,
        keyTopics: analysis.conversationAnalysis.keyTopics || [],
        agreementViolations: analysis.agreementViolations || [],
        messageAnnotations: analysis.messageAnnotations || []
      });
    }

    // 2. Process issue actions
    const createdIssueIds: Record<string, string> = {};
    
    for (const issueAction of (analysis.issueActions || [])) {
      try {
        if (issueAction.action === 'create') {
          const newIssue = await api.createIssue({
            title: issueAction.title,
            description: issueAction.description,
            priority: issueAction.priority as any,
            status: issueAction.status as any
          });
          createdIssueIds[issueAction.title] = newIssue.id;
          
          // Link people to the new issue
          if (issueAction.involvedPersonIds?.length > 0) {
            await api.linkPeopleToIssue(newIssue.id, issueAction.involvedPersonIds);
          }
          
          // Link messages to the new issue
          if (issueAction.linkedMessageIds?.length > 0) {
            await api.linkMessagesToIssue(issueAction.linkedMessageIds, newIssue.id);
          }
          
          // Link conversation to issue
          await api.linkConversationToIssue(conversationId, newIssue.id, issueAction.reasoning);
          
        } else if (issueAction.action === 'update' && issueAction.issueId) {
          await api.updateIssue(issueAction.issueId, {
            description: issueAction.description,
            priority: issueAction.priority as any,
            status: issueAction.status as any
          });
          
          // Link additional people (upsert handles duplicates)
          if (issueAction.involvedPersonIds?.length > 0) {
            await api.linkPeopleToIssue(issueAction.issueId, issueAction.involvedPersonIds);
          }
          
          // Link messages to existing issue
          if (issueAction.linkedMessageIds?.length > 0) {
            await api.linkMessagesToIssue(issueAction.linkedMessageIds, issueAction.issueId);
          }
          
          // Link conversation to issue
          await api.linkConversationToIssue(conversationId, issueAction.issueId, issueAction.reasoning);
        }
      } catch (issueError) {
        console.error('Error processing issue action:', issueError);
      }
    }

    // 3. Create profile notes from person analyses
    const notesToCreate: Array<{ personId: string; type: 'observation' | 'strategy' | 'pattern'; content: string }> = [];
    
    for (const personAnalysis of (analysis.personAnalyses || [])) {
      // Save clinical assessment as observation
      if (personAnalysis.clinicalAssessment?.summary) {
        notesToCreate.push({
          personId: personAnalysis.personId,
          type: 'observation',
          content: `## Clinical Assessment (${new Date().toLocaleDateString()})\n\n${personAnalysis.clinicalAssessment.summary}\n\n**Communication Style:** ${personAnalysis.clinicalAssessment.communicationStyle}\n\n**Emotional Regulation:** ${personAnalysis.clinicalAssessment.emotionalRegulation}\n\n**Boundary Respect:** ${personAnalysis.clinicalAssessment.boundaryRespect}\n\n**Co-parenting Cooperation:** ${personAnalysis.clinicalAssessment.coparentingCooperation}`
        });
      }

      // Save observations
      for (const observation of (personAnalysis.strategicNotes?.observations || [])) {
        notesToCreate.push({
          personId: personAnalysis.personId,
          type: 'observation',
          content: observation
        });
      }

      // Save patterns
      for (const pattern of (personAnalysis.strategicNotes?.patterns || [])) {
        notesToCreate.push({
          personId: personAnalysis.personId,
          type: 'pattern',
          content: pattern
        });
      }

      // Save strategies
      for (const strategy of (personAnalysis.strategicNotes?.strategies || [])) {
        notesToCreate.push({
          personId: personAnalysis.personId,
          type: 'strategy',
          content: strategy
        });
      }

      // Save concerns as observations
      for (const concern of (personAnalysis.concerns || [])) {
        notesToCreate.push({
          personId: personAnalysis.personId,
          type: 'observation',
          content: `⚠️ **${concern.type.toUpperCase()}** (Severity: ${concern.severity})\n\n${concern.description}\n\nEvidence: ${concern.evidence.join('; ')}`
        });
      }
    }

    if (notesToCreate.length > 0) {
      // Use idempotent version that handles re-analysis
      await api.createProfileNotesForConversation(conversationId, notesToCreate);
    }
  };

  const extractKeyFindings = (analysis: ConversationAnalysisResult): string[] => {
    const findings: string[] = [];
    
    // Add tone finding
    if (analysis.conversationAnalysis?.overallTone) {
      const tone = analysis.conversationAnalysis.overallTone;
      if (tone === 'hostile' || tone === 'contentious') {
        findings.push(`Conversation tone detected as ${tone}`);
      }
    }

    // Add violation findings
    const severeViolations = (analysis.agreementViolations || []).filter(v => v.severity === 'severe');
    if (severeViolations.length > 0) {
      findings.push(`${severeViolations.length} severe agreement violation(s) detected`);
    }

    // Add high-severity concerns
    for (const personAnalysis of (analysis.personAnalyses || [])) {
      const highConcerns = (personAnalysis.concerns || []).filter(c => c.severity === 'high');
      if (highConcerns.length > 0) {
        findings.push(`${highConcerns.length} high-priority concern(s) identified`);
        break;
      }
    }

    // Add key topics
    const topics = analysis.conversationAnalysis?.keyTopics || [];
    if (topics.length > 0) {
      findings.push(`Key topics: ${topics.slice(0, 3).join(', ')}`);
    }

    return findings;
  };

  const handleSave = async () => {
    if (!parsedData) return;
    setLoading(true);
    
    try {
        // 1. Resolve People IDs
        const finalPersonIds: string[] = [];
        const nameToIdMap: Record<string, string> = {};

        const participants = Array.from(parsedData.participants) as string[];
        for (const name of participants) {
            const action = nameMapping[name];
            if (action === 'new') {
                const newPerson = await api.createPerson({ fullName: name, role: Role.Parent });
                finalPersonIds.push(newPerson.id);
                nameToIdMap[name] = newPerson.id;
            } else if (action && action !== 'ignore') {
                finalPersonIds.push(action);
                nameToIdMap[name] = action;
            }
        }

        // 2. Prepare Messages with content hashes
        const messagesToSave = parsedData.messages.map((msg, idx) => {
            const senderId = nameToIdMap[msg.senderName];
            const receiverId = nameToIdMap[msg.receiverName];
            const senderPerson = existingPeople.find(p => p.id === senderId);
            const direction = senderPerson?.role === Role.Me ? MessageDirection.Outbound : MessageDirection.Inbound;

            return {
                rawText: msg.body,
                sentAt: msg.sentAt.toISOString(),
                senderId: senderId,
                receiverId: receiverId || undefined,
                direction: direction,
                contentHash: messageHashes[idx] || generateMessageHash(senderId, msg.sentAt, msg.body)
            };
        }).filter(m => m.senderId);

        // 3. Calculate date range
        const sortedMessages = [...parsedData.messages].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
        const firstDate = sortedMessages[0]?.sentAt.toISOString();
        const lastDate = sortedMessages[sortedMessages.length - 1]?.sentAt.toISOString();

        // 4. Create Conversation
        const preview = parsedData.messages[0]?.body.substring(0, 100) + '...' || '';
        
        const newConversation = await api.importConversation(
            {
                title: conversationTitle,
                sourceType: sourceType,
                startedAt: firstDate || new Date().toISOString(),
                endedAt: lastDate || new Date().toISOString(),
                previewText: preview
            },
            finalPersonIds,
            messagesToSave
        );

        // 5. Get the saved messages with their IDs
        const savedMessages = await api.getMessages(newConversation.id);
        const messagesForAnalysis = savedMessages.map(m => ({
          id: m.id,
          senderId: m.senderId,
          receiverId: m.receiverId,
          rawText: m.rawText,
          sentAt: m.sentAt
        }));

        setLoading(false);
        setAnalysisLoading(true);

        // 6. Run AI analysis
        const summary = await runConversationAnalysis(
          newConversation.id,
          messagesForAnalysis,
          finalPersonIds
        );

        setAnalysisLoading(false);
        setSavedConversationId(newConversation.id);

        if (summary) {
          setAnalysisSummary(summary);
          // If agreements were detected, show review first
          if (detectedAgreements.length > 0) {
            setShowAgreementsReview(true);
          } else {
            setShowAnalysisSummary(true);
          }
        } else {
          // If analysis failed, just proceed
          onSuccess(newConversation.id);
          handleReset();
        }
        
    } catch (error) {
        console.error(error);
        alert('Failed to save conversation.');
        setLoading(false);
        setAnalysisLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setRawContent('');
    setSelectedFile(null);
    setParsedData(null);
    setAnalysisSummary(null);
    setShowAnalysisSummary(false);
    setSavedConversationId(null);
    setDetectedAgreements([]);
    setShowAgreementsReview(false);
    setAgreementsSavedCount(0);
    setMatchedConversations([]);
    setShowContinuityModal(false);
    setMessageHashes([]);
  };

  const handleAgreementsComplete = (savedCount: number) => {
    setAgreementsSavedCount(savedCount);
    setShowAgreementsReview(false);
    setShowAnalysisSummary(true);
  };

  const handleAgreementsSkip = () => {
    setShowAgreementsReview(false);
    setShowAnalysisSummary(true);
  };

  const handleAnalysisDismiss = () => {
    if (savedConversationId) {
      onSuccess(savedConversationId);
    }
    onClose();
    handleReset();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  if (!isOpen) return null;

  // Continuity detection modal
  if (showContinuityModal && matchedConversations.length > 0 && parsedData) {
    const primaryMatch = matchedConversations[0];
    const newMessageCount = parsedData.messages.length - primaryMatch.duplicateCount;
    const participantNames = Array.from(parsedData.participants);
    
    return (
      <ContinuityModal
        isOpen={true}
        matches={matchedConversations}
        newMessageCount={newMessageCount}
        participantNames={participantNames}
        onAppendToConversation={handleAppendToConversation}
        onCreateSeparate={handleCreateSeparate}
        onCancel={handleCancelContinuity}
        loading={appendLoading}
      />
    );
  }

  // Detected agreements review modal
  if (showAgreementsReview && savedConversationId) {
    return (
      <DetectedAgreementsReview
        isOpen={true}
        detectedAgreements={detectedAgreements}
        conversationId={savedConversationId}
        onComplete={handleAgreementsComplete}
        onSkip={handleAgreementsSkip}
      />
    );
  }

  // Analysis loading overlay
  if (analysisLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-indigo-600 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Analyzing Conversation</h2>
          <p className="text-slate-600 mb-4">
            Checking for agreement violations, identifying patterns, and generating clinical assessments...
          </p>
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
        </div>
      </div>
    );
  }

  // Analysis summary modal
  if (showAnalysisSummary && analysisSummary) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-emerald-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Import Complete</h2>
                <p className="text-sm text-slate-600">Conversation analyzed and processed</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
                  <TrendingUp className="w-4 h-4" />
                  Tone
                </div>
                <div className={`font-bold capitalize ${
                  analysisSummary.conversationTone === 'hostile' ? 'text-red-600' :
                  analysisSummary.conversationTone === 'contentious' ? 'text-orange-600' :
                  analysisSummary.conversationTone === 'cooperative' ? 'text-emerald-600' :
                  'text-slate-700'
                }`}>
                  {analysisSummary.conversationTone}
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
                  <Users className="w-4 h-4" />
                  People Analyzed
                </div>
                <div className="font-bold text-slate-700">{analysisSummary.peopleAnalyzed}</div>
              </div>

              {analysisSummary.issuesCreated > 0 && (
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-amber-700 text-sm mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    Issues Created
                  </div>
                  <div className="font-bold text-amber-700">{analysisSummary.issuesCreated}</div>
                </div>
              )}

              {analysisSummary.violationsDetected > 0 && (
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-700 text-sm mb-1">
                    <Shield className="w-4 h-4" />
                    Violations
                  </div>
                  <div className="font-bold text-red-700">{analysisSummary.violationsDetected}</div>
                </div>
              )}

              {agreementsSavedCount > 0 && (
                <div className="bg-emerald-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-emerald-700 text-sm mb-1">
                    <Handshake className="w-4 h-4" />
                    Agreements Saved
                  </div>
                  <div className="font-bold text-emerald-700">{agreementsSavedCount}</div>
                </div>
              )}
            </div>

            {/* Key Findings */}
            {analysisSummary.keyFindings.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-bold text-slate-700 mb-2">Key Findings</h3>
                <ul className="space-y-1">
                  {analysisSummary.keyFindings.map((finding, idx) => (
                    <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                      <span className="text-indigo-500 mt-1">•</span>
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
            <button
              onClick={handleAnalysisDismiss}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            Import Conversation
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Steps */}
        <div className="flex border-b border-slate-200">
          <div className={`flex-1 p-3 text-center text-sm font-medium border-b-2 transition-colors ${step === 1 ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400'}`}>
            1. Upload or Paste
          </div>
          <div className={`flex-1 p-3 text-center text-sm font-medium border-b-2 transition-colors ${step === 2 ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400'}`}>
            2. Review & Map
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {step === 1 && (
            <div className="p-6 flex flex-col h-full space-y-6">
               
               {/* Mode Selection */}
               <div className="flex gap-4 border-b border-slate-100 pb-6">
                 <button 
                   onClick={() => setImportMode('file')}
                   className={`flex-1 py-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition-all ${importMode === 'file' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-200' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                 >
                    <FileType className="w-6 h-6" />
                    <span className="font-medium text-sm">Upload File (PDF/Image)</span>
                 </button>
                 <button 
                   onClick={() => setImportMode('text')}
                   className={`flex-1 py-4 border rounded-xl flex flex-col items-center justify-center gap-2 transition-all ${importMode === 'text' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-1 ring-indigo-200' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                 >
                    <FileText className="w-6 h-6" />
                    <span className="font-medium text-sm">Paste Text Manually</span>
                 </button>
               </div>

               {importMode === 'file' ? (
                  <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50 p-8">
                     <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        className="hidden" 
                        accept=".pdf,.png,.jpg,.jpeg,.txt"
                     />
                     
                     {selectedFile ? (
                        <div className="text-center">
                           <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                              <FileText className="w-8 h-8" />
                           </div>
                           <h3 className="font-bold text-slate-800 mb-1">{selectedFile.name}</h3>
                           <p className="text-sm text-slate-500 mb-4">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                           <button 
                             onClick={() => setSelectedFile(null)}
                             className="text-red-500 text-sm font-medium hover:underline flex items-center justify-center gap-1"
                           >
                             <Trash2 className="w-4 h-4" /> Remove
                           </button>
                        </div>
                     ) : (
                        <div className="text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                           <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 group-hover:text-indigo-500">
                              <Upload className="w-8 h-8" />
                           </div>
                           <h3 className="font-bold text-slate-800 mb-1">Click to upload</h3>
                           <p className="text-sm text-slate-500 max-w-xs mx-auto">
                              Support for PDF exports from OFW, Screenshots of SMS, or Email threads.
                           </p>
                        </div>
                     )}
                  </div>
               ) : (
                 /* Manual Text Mode */
                 <div className="flex-1 flex flex-col space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Source Type</label>
                      <div className="flex gap-2">
                        {Object.values(SourceType).map((type) => (
                          <button
                            key={type}
                            onClick={() => setSourceType(type)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              sourceType === type 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={rawContent}
                      onChange={(e) => setRawContent(e.target.value)}
                      placeholder="Paste text content here..."
                      className="flex-1 w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono leading-relaxed resize-none"
                    />
                 </div>
               )}
            </div>
          )}

          {step === 2 && parsedData && (
             <div className="flex flex-col h-full overflow-hidden">
                <div className="p-6 overflow-y-auto space-y-8">
                    
                    {/* Metadata Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Conversation Title</label>
                            <input 
                                type="text" 
                                value={conversationTitle} 
                                onChange={e => setConversationTitle(e.target.value)}
                                className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Date</label>
                            <div className="text-sm font-medium text-slate-700 flex items-center gap-2 h-8">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                {format(parsedData.messages[0]?.sentAt || new Date(), 'MMMM d, yyyy')}
                            </div>
                        </div>
                    </div>

                    {/* Participant Mapping */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4" /> Identify Participants
                        </h3>
                        <div className="space-y-3">
                            {(Array.from(parsedData.participants) as string[]).map(name => (
                                <div key={name} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                            {name.substring(0,2).toUpperCase()}
                                        </div>
                                        <span className="font-medium text-slate-700">{name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ArrowRight className="w-4 h-4 text-slate-300" />
                                        <select
                                            value={nameMapping[name] || 'new'}
                                            onChange={e => setNameMapping({...nameMapping, [name]: e.target.value})}
                                            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="new">+ Create New Person</option>
                                            <option value="ignore">Ignore / Don't Import</option>
                                            <optgroup label="Existing People">
                                                {existingPeople.map(p => (
                                                    <option key={p.id} value={p.id}>{p.fullName} ({p.role})</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Message Preview */}
                    <div>
                         <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 
                            {parsedData.messages.length} Messages Detected
                        </h3>
                        <div className="space-y-4 border-l-2 border-slate-200 pl-4">
                            {parsedData.messages.map((msg, idx) => (
                                <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 text-sm shadow-sm">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-indigo-700">{msg.senderName}</span>
                                        <span className="text-slate-400 text-xs">{format(msg.sentAt, 'MMM d, h:mm a')}</span>
                                    </div>
                                    <div className="text-slate-600 whitespace-pre-wrap">{msg.body}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
             </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between">
          {step === 2 ? (
            <button 
              onClick={() => setStep(1)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
            >
              Back
            </button>
          ) : (
             <button 
               onClick={onClose}
               className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
             >
               Cancel
             </button>
          )}
          
          {step === 1 ? (
             <button 
               onClick={handleParse}
               disabled={(importMode === 'text' && !rawContent) || (importMode === 'file' && !selectedFile)}
               className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze & Extract'} <ArrowRight className="w-4 h-4" />
             </button>
          ) : (
             <button 
               onClick={handleSave}
               disabled={loading}
               className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
               Import & Analyze {parsedData?.messages.length} Messages
             </button>
          )}
        </div>
      </div>
    </div>
  );
};
