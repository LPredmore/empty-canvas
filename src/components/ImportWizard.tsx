import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { parseFileWithAI } from '../services/ai';
import { Person, SourceType, MessageDirection, Role } from '../types';
import { parseOFWExport, parseGenericText, parseGmailExport, ParsedConversation } from '../utils/parsers';
import { X, Upload, Calendar, Users, ArrowRight, Save, Loader2, CheckCircle2, FileText, Trash2, FileType } from 'lucide-react';
import { format } from 'date-fns';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (conversationId: string) => void;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [existingPeople, setExistingPeople] = useState<Person[]>([]);

  // Form State
  const [sourceType, setSourceType] = useState<SourceType>(SourceType.OFW);
  const [importMode, setImportMode] = useState<'text' | 'file'>('file');
  const [rawContent, setRawContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Parsed Data State
  const [parsedData, setParsedData] = useState<ParsedConversation | null>(null);
  const [conversationTitle, setConversationTitle] = useState('');
  const [nameMapping, setNameMapping] = useState<Record<string, string>>({}); // "Luke Predmore" -> "person_uuid"
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      api.getPeople().then(setExistingPeople);
    }
  }, [isOpen]);

  const handleParse = async () => {
    setLoading(true);
    setParsedData(null);

    try {
        let result: ParsedConversation;

        if (importMode === 'file' && selectedFile) {
            // Use AI Parsing
            result = await parseFileWithAI(selectedFile);
        } else {
            // Use Manual Regex Parsing
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
        
        // Attempt to auto-map people
        const newMapping: Record<string, string> = {};
        result.participants.forEach(name => {
            // Simple exact match or first name match
            const match = existingPeople.find(p => 
                p.fullName.toLowerCase() === name.toLowerCase() || 
                p.fullName.toLowerCase().includes(name.toLowerCase())
            );
            if (match) {
                newMapping[name] = match.id;
            } else {
                newMapping[name] = 'new'; // Default to create new
            }
        });
        setNameMapping(newMapping);
        setStep(2);

    } catch (error: any) {
        console.error(error);
        alert(error.message || "Failed to parse content.");
    } finally {
        setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!parsedData) return;
    setLoading(true);
    
    try {
        // 1. Resolve People IDs (create new if needed)
        const finalPersonIds: string[] = [];
        const nameToIdMap: Record<string, string> = {};

        // Explicitly cast to string[] to avoid TS unknown type errors
        const participants = Array.from(parsedData.participants) as string[];
        for (const name of participants) {
            const action = nameMapping[name];
            if (action === 'new') {
                const newPerson = await api.createPerson({ fullName: name, role: Role.Parent }); // Default role
                finalPersonIds.push(newPerson.id);
                nameToIdMap[name] = newPerson.id;
            } else if (action && action !== 'ignore') {
                finalPersonIds.push(action);
                nameToIdMap[name] = action;
            }
        }

        // 2. Prepare Messages with resolved sender and receiver IDs
        const messagesToSave = parsedData.messages.map(msg => {
            const senderId = nameToIdMap[msg.senderName];
            const receiverId = nameToIdMap[msg.receiverName];
            
            // Heuristic for Direction if AI didn't catch it perfectly or user changed mapping:
            // If the sender maps to "ME", it's outbound.
            const senderPerson = existingPeople.find(p => p.id === senderId);
            const direction = senderPerson?.role === Role.Me ? MessageDirection.Outbound : MessageDirection.Inbound;

            return {
                rawText: msg.body,
                sentAt: msg.sentAt.toISOString(),
                senderId: senderId,
                receiverId: receiverId || undefined,
                direction: direction
            };
        }).filter(m => m.senderId); // Ensure we have a sender

        // 3. Calculate date range from messages
        const sortedMessages = [...parsedData.messages].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
        const firstDate = sortedMessages[0]?.sentAt.toISOString();
        const lastDate = sortedMessages[sortedMessages.length - 1]?.sentAt.toISOString();

        // 4. Create Conversation via API
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

        onSuccess(newConversation.id);
        onClose();
        
        // Reset
        setStep(1);
        setRawContent('');
        setSelectedFile(null);
        setParsedData(null);
    } catch (error) {
        console.error(error);
        alert('Failed to save conversation.');
    } finally {
        setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  if (!isOpen) return null;

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
               Import {parsedData?.messages.length} Messages
             </button>
          )}
        </div>
      </div>
    </div>
  );
};
