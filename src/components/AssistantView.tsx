import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { chatWithAssistant, processStream } from '../services/ai';
import { AssistantSession, AssistantMessage, AssistantSenderType } from '../types';
import { Plus, Send, Paperclip, Bot, User, FileText, ArrowRight, Loader2, Trash2, Database } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
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
  const [streamingContent, setStreamingContent] = useState('');
  const [loadingContext, setLoadingContext] = useState(false);
  
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
  }, [messages, sending, streamingContent]);

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
    setStreamingContent('');
  };

  const handleNewSession = async () => {
    const newSession = await api.createAssistantSession();
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    setStreamingContent('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && !uploadingFile) || sending) return;

    setSending(true);
    setStreamingContent('');
    let targetSessionId = activeSessionId;

    try {
      if (!targetSessionId) {
        const newSession = await api.createAssistantSession();
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        targetSessionId = newSession.id;
      }

      const contentToSend = inputText || (uploadingFile ? `Uploaded file: ${uploadingFile.name}` : '');
      
      // Optimistically add user message to UI
      const tempUserMsg: AssistantMessage = {
        id: `temp-${Date.now()}`,
        sessionId: targetSessionId,
        senderType: AssistantSenderType.User,
        content: contentToSend,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempUserMsg]);
      setInputText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      // Call the AI service with context loading callback
      const result = await chatWithAssistant(targetSessionId, contentToSend, uploadingFile || undefined, setLoadingContext);
      
      if (result.error) {
        throw new Error(result.error);
      }

      if (result.stream) {
        // Process the streaming response
        const fullText = await processStream(result.stream, (chunk) => {
          setStreamingContent(prev => prev + chunk);
        });

        // Save the assistant's response
        await api.saveAssistantMessage(targetSessionId, AssistantSenderType.Assistant, fullText);
      }

      // Refresh messages from DB
      const freshMessages = await api.getAssistantMessages(targetSessionId);
      setMessages(freshMessages);
      setStreamingContent('');
      setUploadingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err: any) {
      console.error('Assistant error:', err);
      const errorMsg: AssistantMessage = {
        id: `error-${Date.now()}`,
        sessionId: targetSessionId || '',
        senderType: AssistantSenderType.System,
        content: `**Error:** ${err.message || 'Failed to process message.'}`,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
      setStreamingContent('');
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
      <div className="w-64 flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden shrink-0">
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
          <h3 className="font-bold text-muted-foreground text-sm">History</h3>
          <button 
            onClick={handleNewSession}
            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="New Session"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={`w-full text-left p-4 border-b border-border/50 hover:bg-muted/50 transition-colors ${
                activeSessionId === session.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'
              }`}
            >
              <div className="font-medium text-foreground text-sm truncate">{session.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{format(new Date(session.lastActivityAt), 'MMM d, h:mm a')}</div>
            </button>
          ))}
          {sessions.length === 0 && !loading && (
            <div className="p-8 text-center text-muted-foreground text-sm">No sessions yet.</div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">CoParent Assistant</h2>
          </div>
          <div className="flex items-center gap-2 px-2 py-1 bg-background border border-border rounded-lg text-[10px] font-bold text-muted-foreground uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            GPT-4.1
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/20">
          {messages.length === 0 && !streamingContent ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
              <Bot className="w-16 h-16 mb-4" />
              <p>Start a new conversation or upload a document.</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isUser = msg.senderType === AssistantSenderType.User;
                const isSystem = msg.senderType === AssistantSenderType.System;
                return (
                  <div key={msg.id} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isUser ? 'bg-secondary text-secondary-foreground' : 
                      isSystem ? 'bg-destructive/10 text-destructive' : 
                      'bg-primary/10 text-primary'
                    }`}>
                      {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        isUser ? 'bg-primary text-primary-foreground rounded-tr-none' : 
                        isSystem ? 'bg-destructive/10 border border-destructive/20 text-destructive rounded-tl-none' :
                        'bg-background border border-border text-foreground rounded-tl-none shadow-sm'
                      }`}>
                        <FormattedText text={msg.content} />
                      </div>
                      
                      {msg.linkedTargetType && msg.linkedTargetId && (
                        <div className="mt-2">
                          <Link 
                            to={`/${msg.linkedTargetType}s/${msg.linkedTargetId}`}
                            className="inline-flex items-center gap-2 bg-background border border-primary/20 text-primary px-3 py-2 rounded-lg text-xs font-medium hover:bg-primary/5 transition-colors shadow-sm"
                          >
                            View Related {msg.linkedTargetType === 'legal_document' ? 'Document' : msg.linkedTargetType.charAt(0).toUpperCase() + msg.linkedTargetType.slice(1)} <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      )}
                      <span className="text-[10px] text-muted-foreground mt-1">{format(new Date(msg.createdAt), 'h:mm a')}</span>
                    </div>
                  </div>
                );
              })}
              
              {/* Streaming response */}
              {streamingContent && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex flex-col items-start max-w-[80%]">
                    <div className="bg-background border border-border px-4 py-3 rounded-2xl rounded-tl-none shadow-sm text-sm leading-relaxed">
                      <FormattedText text={streamingContent} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          
          {sending && !streamingContent && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <div className="bg-background border border-border px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                {loadingContext ? (
                  <>
                    <Database className="w-4 h-4 animate-pulse text-primary" />
                    <span className="text-xs text-muted-foreground">Loading relevant case data...</span>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Thinking...</span>
                  </>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-background border-t border-border">
          {uploadingFile && (
            <div className="flex items-center gap-2 mb-2 bg-muted px-3 py-2 rounded-lg text-sm text-foreground w-fit border border-border shadow-sm">
              <FileText className="w-4 h-4 text-primary" />
              <span className="truncate max-w-xs font-medium">{uploadingFile.name}</span>
              <button onClick={() => { setUploadingFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="hover:text-destructive ml-2 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`p-3 rounded-lg transition-colors mb-0.5 ${uploadingFile ? 'text-primary bg-primary/10 border border-primary/20' : 'text-muted-foreground hover:bg-muted border border-transparent'}`}
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <textarea 
              ref={textareaRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message or instruction..."
              className="flex-1 bg-muted border border-border rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-sm resize-none min-h-[46px] max-h-48"
              disabled={sending}
              rows={1}
            />
            <button 
              onClick={() => handleSendMessage()} 
              disabled={(!inputText.trim() && !uploadingFile) || sending}
              className="p-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm mb-0.5"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
