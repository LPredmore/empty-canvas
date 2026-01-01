import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { chatWithAssistant } from '../services/ai';
import { AssistantSession, AssistantMessage, AssistantSenderType } from '../types';
import { Plus, Send, Paperclip, Bot, User, FileText, ArrowRight, Loader2, Trash2, Settings, X, Save, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        return <span key={i} className="whitespace-pre-wrap">{part}</span>;
      })}
    </span>
  );
};

export const AssistantView: React.FC = () => {
  const [sessions, setSessions] = useState<AssistantSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('openrouter_api_key') || '');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
    } else if (sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputText]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await api.getAssistantSessions();
      setSessions(data);
      if (!activeSessionId && data.length > 0) {
        setActiveSessionId(data[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (sessionId: string) => {
    const msgs = await api.getAssistantMessages(sessionId);
    setMessages(msgs);
  };

  const handleNewSession = async () => {
    const newSession = await api.createAssistantSession();
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveSettings = () => {
    if (apiKeyInput.startsWith('sk-or-')) {
      localStorage.setItem('openrouter_api_key', apiKeyInput);
      setIsSettingsOpen(false);
      alert("API Key saved to browser storage.");
    } else {
      alert("Please enter a valid OpenRouter API Key starting with 'sk-or-'.");
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && !uploadingFile) || sending) return;

    setSending(true);
    let targetSessionId = activeSessionId;

    try {
      if (!targetSessionId) {
         try {
             const newSession = await api.createAssistantSession();
             setSessions(prev => [newSession, ...prev]);
             setActiveSessionId(newSession.id);
             targetSessionId = newSession.id;
         } catch (err) {
             console.error("Failed to create new session", err);
             setSending(false);
             return;
         }
      }

      const tempId = Math.random().toString();
      const contentToSend = inputText || (uploadingFile ? `Uploaded file: ${uploadingFile.name}` : '');
      
      const userMsg: AssistantMessage = {
        id: tempId,
        sessionId: targetSessionId,
        senderType: AssistantSenderType.User,
        content: contentToSend,
        createdAt: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, userMsg]);
      setInputText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      await chatWithAssistant(targetSessionId, contentToSend, uploadingFile || undefined);
      const freshMessages = await api.getAssistantMessages(targetSessionId);
      setMessages(freshMessages);
      setUploadingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err: any) {
      console.error(err);
      let errorMsg = "Failed to process message.";
      if (err.message?.includes("MISSING_API_KEY") || err.message?.includes("AUTH_FAILED") || err.message?.includes("AUTH_INTERCEPTED")) {
        errorMsg = `**Authentication Error:** ${err.message.split(': ')[1] || 'OpenRouter Key missing or invalid.'}`;
        setIsSettingsOpen(true);
      }
      
      setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sessionId: targetSessionId || '',
          senderType: AssistantSenderType.System,
          content: errorMsg,
          createdAt: new Date().toISOString()
      } as AssistantMessage]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadingFile(e.target.files[0]);
    }
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-6">
      {/* Sidebar Sessions */}
      <div className="w-64 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-700 text-sm">History</h3>
          <div className="flex gap-1">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={handleNewSession}
              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="New Session"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={`w-full text-left p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                activeSessionId === session.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'
              }`}
            >
              <div className="font-medium text-slate-800 text-sm truncate">{session.title}</div>
              <div className="text-xs text-slate-400 mt-1">{format(new Date(session.lastActivityAt), 'MMM d, h:mm a')}</div>
            </button>
          ))}
          {sessions.length === 0 && !loading && (
             <div className="p-8 text-center text-slate-400 text-sm">No sessions yet.</div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-slate-800">CoParent Assistant</h2>
           </div>
           <div className="flex items-center gap-2 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Model: GPT-4o
           </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
          {messages.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                <Bot className="w-16 h-16 mb-4" />
                <p>Start a new conversation or upload a document.</p>
             </div>
          ) : (
            messages.map((msg) => {
               const isUser = msg.senderType === AssistantSenderType.User;
               const isSystem = msg.senderType === AssistantSenderType.System;
               return (
                 <div key={msg.id} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isUser ? 'bg-slate-200 text-slate-600' : 
                      isSystem ? 'bg-red-100 text-red-600' : 
                      'bg-indigo-100 text-indigo-600'
                    }`}>
                       {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                       <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 
                          isSystem ? 'bg-red-50 border border-red-200 text-red-800 rounded-tl-none' :
                          'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                       }`}>
                          <FormattedText text={msg.content} />
                       </div>
                       
                       {msg.linkedTargetType && msg.linkedTargetId && (
                         <div className="mt-2">
                            <Link 
                               to={`/${msg.linkedTargetType}s/${msg.linkedTargetId}`}
                               className="inline-flex items-center gap-2 bg-white border border-indigo-200 text-indigo-700 px-3 py-2 rounded-lg text-xs font-medium hover:bg-indigo-50 transition-colors shadow-sm"
                            >
                               View Related {msg.linkedTargetType === 'legal_document' ? 'Document' : msg.linkedTargetType.charAt(0).toUpperCase() + msg.linkedTargetType.slice(1)} <ArrowRight className="w-3 h-3" />
                            </Link>
                         </div>
                       )}
                       <span className="text-[10px] text-slate-400 mt-1">{format(new Date(msg.createdAt), 'h:mm a')}</span>
                    </div>
                 </div>
               );
            })
          )}
          {sending && (
             <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                   <Bot className="w-5 h-5 text-indigo-600 animate-pulse" />
                </div>
                <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
                   <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                   <span className="text-xs text-slate-400 ml-2">Analyzing...</span>
                </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200">
           {uploadingFile && (
              <div className="flex items-center gap-2 mb-2 bg-slate-100 px-3 py-2 rounded-lg text-sm text-slate-700 w-fit border border-slate-200 shadow-sm">
                 <FileText className="w-4 h-4 text-indigo-600" />
                 <span className="truncate max-w-xs font-medium">{uploadingFile.name}</span>
                 <button onClick={() => { setUploadingFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="hover:text-red-500 ml-2 p-1">
                    <Trash2 className="w-4 h-4" />
                 </button>
              </div>
           )}
           <div className="flex gap-2 items-end">
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
              <button 
                 type="button"
                 onClick={() => fileInputRef.current?.click()}
                 className={`p-3 rounded-lg transition-colors mb-0.5 ${uploadingFile ? 'text-indigo-600 bg-indigo-50 border border-indigo-100' : 'text-slate-400 hover:bg-slate-100 border border-transparent'}`}
              >
                 <Paperclip className="w-5 h-5" />
              </button>
              <textarea 
                 ref={textareaRef}
                 value={inputText}
                 onChange={e => setInputText(e.target.value)}
                 onKeyDown={handleKeyDown}
                 placeholder="Type a message or instruction..."
                 className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none min-h-[46px] max-h-48"
                 disabled={sending}
                 rows={1}
              />
              <button 
                 onClick={() => handleSendMessage()} 
                 disabled={(!inputText.trim() && !uploadingFile) || sending}
                 className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm mb-0.5"
              >
                 <Send className="w-5 h-5" />
              </button>
           </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Settings className="w-4 h-4" /> AI Settings</h3>
                <button onClick={() => setIsSettingsOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
             </div>
             <div className="p-6 space-y-4">
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3">
                   <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                   <p className="text-xs text-amber-800 leading-relaxed">
                      If you're seeing auth errors, it's likely a conflict with your browser environment. 
                      Paste your <strong>OpenRouter API Key</strong> here to override system settings.
                   </p>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">OpenRouter API Key</label>
                   <input 
                      type="password" 
                      value={apiKeyInput} 
                      onChange={e => setApiKeyInput(e.target.value)} 
                      placeholder="sk-or-v1-..."
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                   />
                </div>
                <div className="pt-2">
                   <button 
                      onClick={handleSaveSettings}
                      className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                   >
                      <Save className="w-4 h-4" /> Save Key to Browser
                   </button>
                   <p className="text-[10px] text-slate-400 text-center mt-3">
                      Your key is saved locally in your browser and is never stored on our database.
                   </p>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
