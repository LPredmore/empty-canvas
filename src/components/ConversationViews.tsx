import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { processAnalysisResults, updateConversationState, buildAnalysisSummary } from '../services/analysisProcessor';
import { ConversationAnalysisResult } from '../types/analysisTypes';
import { Conversation, Message, Person, MessageDirection, Issue, ConversationStatus, ConversationAnalysis } from '../types';
import { format, isSameDay, isSameMonth, isSameYear, differenceInDays } from 'date-fns';
import { Search, Filter, Paperclip, Send, Loader2, Tag, AlertCircle, Clock, CheckCircle2, User, RefreshCw } from 'lucide-react';
import { ConversationAnalysisPanel } from './ConversationAnalysisPanel';

const formatDateRange = (startedAt?: string, endedAt?: string): string => {
  if (!startedAt) return '';
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : start;
  
  if (isSameDay(start, end)) {
    return format(start, 'MMM d');
  }
  
  if (isSameMonth(start, end) && isSameYear(start, end)) {
    return `${format(start, 'MMM d')} – ${format(end, 'd')}`;
  }
  
  if (isSameYear(start, end)) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
  }
  
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
};

type StatusFilter = 'all' | 'open' | 'resolved';

export const ConversationList: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    Promise.all([api.getConversations(), api.getPeople()])
      .then(([c, p]) => {
        setConversations(c);
        setPeople(p);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  const openCount = conversations.filter(c => c.status === ConversationStatus.Open).length;
  const resolvedCount = conversations.filter(c => c.status === ConversationStatus.Resolved).length;

  const filteredConversations = conversations.filter(conv => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'open') return conv.status === ConversationStatus.Open;
    if (statusFilter === 'resolved') return conv.status === ConversationStatus.Resolved;
    return true;
  });

  const getDaysSinceLastMessage = (conv: Conversation): number => {
    const lastDate = conv.endedAt ? new Date(conv.endedAt) : (conv.startedAt ? new Date(conv.startedAt) : new Date());
    return differenceInDays(new Date(), lastDate);
  };

  const getPendingResponderName = (conv: Conversation): string | null => {
    if (!conv.pendingResponderId) return null;
    const person = people.find(p => p.id === conv.pendingResponderId);
    return person?.fullName || null;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Conversations</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
            />
          </div>
          <button className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50">
            <Filter className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === 'all' 
              ? 'bg-indigo-100 text-indigo-700' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All ({conversations.length})
        </button>
        <button
          onClick={() => setStatusFilter('open')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            statusFilter === 'open' 
              ? 'bg-amber-100 text-amber-700' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          Open ({openCount})
        </button>
        <button
          onClick={() => setStatusFilter('resolved')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            statusFilter === 'resolved' 
              ? 'bg-emerald-100 text-emerald-700' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Resolved ({resolvedCount})
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
        {filteredConversations.map(conv => {
           const participants = people.filter(p => conv.participantIds.includes(p.id));
           const daysSince = getDaysSinceLastMessage(conv);
           const isStale = conv.status === ConversationStatus.Open && daysSince > 14;
           const pendingName = getPendingResponderName(conv);
           
           return (
            <Link 
              to={`/conversations/${conv.id}`} 
              key={conv.id} 
              className={`block p-5 hover:bg-slate-50 transition-colors ${isStale ? 'border-l-4 border-l-red-400' : ''}`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{conv.title}</h3>
                  {conv.status === ConversationStatus.Open ? (
                    <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                      Open
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                      Resolved
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500">{formatDateRange(conv.startedAt, conv.endedAt)}</span>
              </div>
              
              <p className="text-sm text-slate-500 line-clamp-1 mb-2">{conv.previewText}</p>
              
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase tracking-wide">
                  {conv.sourceType}
                </span>
                <div className="flex -space-x-2">
                  {participants.map(p => (
                    <img 
                      key={p.id} 
                      src={p.avatarUrl || `https://ui-avatars.com/api/?name=${p.fullName}&background=random`} 
                      className="w-6 h-6 rounded-full border border-white" 
                      alt={p.fullName} 
                    />
                  ))}
                </div>
                <span className="text-xs text-slate-400 ml-1">
                  with {participants.map(p => p.fullName).join(', ')}
                </span>
                
                {conv.status === ConversationStatus.Open && pendingName && (
                  <span className="text-xs text-amber-600 flex items-center gap-1 ml-auto">
                    <User className="w-3 h-3" />
                    Awaiting {pendingName}
                  </span>
                )}
                
                {isStale && (
                  <span className="text-xs text-red-600 font-medium ml-auto">
                    No response for {daysSince} days
                  </span>
                )}
              </div>
            </Link>
           );
        })}
        {filteredConversations.length === 0 && (
          <div className="p-6 text-center text-slate-500">No conversations found.</div>
        )}
      </div>
    </div>
  );
};

export const ConversationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [analysis, setAnalysis] = useState<ConversationAnalysis | null>(null);
  const [linkedIssues, setLinkedIssues] = useState<Array<{ issueId: string; reason?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [refreshingAnalysis, setRefreshingAnalysis] = useState(false);
  
  // Tagging State
  const [taggingMsgId, setTaggingMsgId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [c, m, p, i, a, links] = await Promise.all([
        api.getConversation(id!),
        api.getMessages(id!),
        api.getPeople(),
        api.getIssues(),
        api.getConversationAnalysis(id!),
        api.getConversationIssueLinks(id!)
      ]);
      setConversation(c);
      setMessages(m.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()));
      setPeople(p);
      setIssues(i);
      setAnalysis(a);
      setLinkedIssues(links);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAnalysis = async () => {
    if (!conversation || !id) return;
    setRefreshingAnalysis(true);
    
    try {
      // Get messages for analysis
      const msgs = await api.getMessages(id);
      const agreements = await api.getAllActiveAgreementItems();
      const existingIssuesList = await api.getIssues();
      
      // Find "Me" person for context
      const mePerson = people.find(p => p.role === 'me');
      
      // Call the analysis edge function
      const { data, error } = await (await import('../lib/supabase')).supabase.functions.invoke('analyze-conversation-import', {
        body: {
          conversationId: id,
          messages: msgs.map(m => ({
            id: m.id,
            senderId: m.senderId,
            receiverId: m.receiverId,
            rawText: m.rawText,
            sentAt: m.sentAt,
            direction: m.direction
          })),
          participants: people.filter(p => conversation.participantIds.includes(p.id)).map(p => ({
            id: p.id,
            name: p.fullName,
            role: p.role
          })),
          agreementItems: agreements.map(a => ({
            id: a.id,
            topic: a.topic,
            fullText: a.fullText,
            summary: a.summary || a.fullText.slice(0, 100)
          })),
          existingIssues: existingIssuesList.map(i => ({
            id: i.id,
            title: i.title,
            description: i.description,
            status: i.status,
            priority: i.priority
          })),
          mePersonId: mePerson?.id,
          isReanalysis: true
        }
      });
      
      if (error) throw error;
      
      if (data) {
        const analysisResult = data as ConversationAnalysisResult;
        
        // Use shared processor for full processing (issues, contributions, profile notes)
        await processAnalysisResults(id, analysisResult, msgs.map(m => ({
          id: m.id,
          senderId: m.senderId || '',
          receiverId: m.receiverId,
          rawText: m.rawText || '',
          sentAt: m.sentAt || ''
        })));
        
        // Update conversation state (resolution status)
        if (analysisResult.conversationState) {
          await updateConversationState(id, analysisResult.conversationState);
        }
        
        // Build summary for feedback
        const stats = buildAnalysisSummary(analysisResult);
        console.log('Refresh analysis complete:', stats);
        
        // Reload the analysis and data
        const newAnalysis = await api.getConversationAnalysis(id);
        setAnalysis(newAnalysis);
        
        // Reload conversation to get updated status
        loadData();
      }
    } catch (e) {
      console.error('Failed to refresh analysis:', e);
    } finally {
      setRefreshingAnalysis(false);
    }
  };

  const handleTagIssue = async (issueId: string) => {
    if (!taggingMsgId) return;
    try {
      await api.linkMessageToIssue(taggingMsgId, issueId);
      setTaggingMsgId(null);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkResolved = async () => {
    if (!conversation) return;
    setUpdatingStatus(true);
    try {
      await api.updateConversationStatus(conversation.id, 'resolved', null);
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleReopen = async () => {
    if (!conversation) return;
    setUpdatingStatus(true);
    try {
      await api.updateConversationStatus(conversation.id, 'open', null);
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
  if (!conversation) return <div>Conversation not found</div>;

  const pendingResponder = conversation.pendingResponderId 
    ? people.find(p => p.id === conversation.pendingResponderId) 
    : null;

  const daysSinceLastMessage = conversation.endedAt 
    ? differenceInDays(new Date(), new Date(conversation.endedAt))
    : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-800">{conversation.title}</h2>
            {conversation.status === ConversationStatus.Open ? (
              <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Open
              </span>
            ) : (
              <span className="text-xs font-medium px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Resolved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-xs font-medium px-2 py-0.5 bg-slate-200 text-slate-600 rounded uppercase">{conversation.sourceType}</span>
             <span className="text-xs text-slate-400">{messages.length} messages</span>
             {conversation.status === ConversationStatus.Open && pendingResponder && (
               <span className="text-xs text-amber-600 flex items-center gap-1">
                 <User className="w-3 h-3" />
                 Waiting on {pendingResponder.fullName} ({daysSinceLastMessage} days)
               </span>
             )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conversation.status === ConversationStatus.Open ? (
            <button
              onClick={handleMarkResolved}
              disabled={updatingStatus}
              className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Mark as Resolved
            </button>
          ) : (
            <button
              onClick={handleReopen}
              disabled={updatingStatus}
              className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
              Reopen Conversation
            </button>
          )}
        </div>
      </div>

      {/* Unified Scroll Container for Analysis + Messages */}
      <div className="flex-1 overflow-y-auto">
        {/* Analysis Panel */}
        <div className="px-4 pt-4 bg-white">
          <ConversationAnalysisPanel
            conversationId={id!}
            conversation={conversation}
            analysis={analysis}
            linkedIssues={linkedIssues}
            issues={issues}
            onRefreshAnalysis={handleRefreshAnalysis}
            isRefreshing={refreshingAnalysis}
            onIssueLinked={async () => {
              const links = await api.getConversationIssueLinks(id!);
              setLinkedIssues(links);
            }}
          />
        </div>

        {/* Messages Area */}
        <div className="p-6 space-y-6 bg-slate-50 min-h-[200px]">
          {messages.map(msg => {
            const isMe = msg.direction === MessageDirection.Outbound;
            const isInternal = msg.direction === MessageDirection.Internal;
            const sender = people.find(p => p.id === msg.senderId);
            const linkedIssues = issues.filter(i => msg.issueIds?.includes(i.id));

            if (isInternal) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-2 rounded-lg max-w-lg text-center shadow-sm">
                    <span className="font-bold block text-xs uppercase tracking-wide text-amber-700/70 mb-1">Internal Note</span>
                    {msg.rawText}
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                 <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {!isMe && sender && (
                        <span className="text-xs font-medium text-slate-500">{sender.fullName}</span>
                      )}
                      <span className="text-[10px] text-slate-400">{format(new Date(msg.sentAt), 'h:mm a')}</span>
                    </div>
                    
                    <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed relative group ${
                      isMe 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                    }`}>
                      {msg.rawText}
                      
                      {/* Hover Action to Tag */}
                      <button 
                        onClick={() => setTaggingMsgId(msg.id)}
                        className={`absolute -right-8 top-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-100 transition-opacity ${isMe ? 'text-white/50 hover:text-white' : 'text-slate-400 hover:text-indigo-600'}`}
                        title="Tag Issue"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Display Linked Issues */}
                    {linkedIssues.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {linkedIssues.map(issue => (
                          <span key={issue.id} className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {issue.title}
                          </span>
                        ))}
                      </div>
                    )}
                 </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <div className="text-center text-slate-400 py-10">No messages in this conversation yet.</div>
          )}
        </div>
      </div>

      {/* Input Area (Mock) */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
            <Paperclip className="w-5 h-5" />
          </button>
          <input 
            type="text" 
            placeholder="Draft a new message or note..." 
            className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tagging Popover/Modal */}
      {taggingMsgId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4" onClick={() => setTaggingMsgId(null)}>
          <div className="bg-white rounded-lg shadow-xl w-64 p-2 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-2 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tag Issue</div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {issues.map(issue => (
                <button 
                  key={issue.id} 
                  onClick={() => handleTagIssue(issue.id)}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 truncate"
                >
                  {issue.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};