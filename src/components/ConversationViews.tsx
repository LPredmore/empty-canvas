import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { Conversation, Message, Person, MessageDirection, Issue } from '../types';
import { format, isSameDay, isSameMonth, isSameYear } from 'date-fns';
import { Search, Filter, Paperclip, Send, Loader2, Tag, Plus, AlertCircle } from 'lucide-react';

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

export const ConversationList: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getConversations(), api.getPeople()])
      .then(([c, p]) => {
        setConversations(c);
        setPeople(p);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
        {conversations.map(conv => {
           // Basic mapping of participant IDs to Person objects
           const participants = people.filter(p => conv.participantIds.includes(p.id));
           return (
            <Link to={`/conversations/${conv.id}`} key={conv.id} className="block p-5 hover:bg-slate-50 transition-colors">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-semibold text-slate-900">{conv.title}</h3>
                <span className="text-xs text-slate-500">{formatDateRange(conv.startedAt, conv.endedAt)}</span>
              </div>
              <p className="text-sm text-slate-500 line-clamp-1 mb-2">{conv.previewText}</p>
              <div className="flex items-center gap-2">
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
              </div>
            </Link>
           );
        })}
        {conversations.length === 0 && (
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
  const [loading, setLoading] = useState(true);
  
  // Tagging State
  const [taggingMsgId, setTaggingMsgId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = () => {
    Promise.all([
      api.getConversation(id!),
      api.getMessages(id!),
      api.getPeople(),
      api.getIssues()
    ]).then(([c, m, p, i]) => {
      setConversation(c);
      setMessages(m.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()));
      setPeople(p);
      setIssues(i);
    }).finally(() => setLoading(false));
  };

  const handleTagIssue = async (issueId: string) => {
    if (!taggingMsgId) return;
    try {
      await api.linkMessageToIssue(taggingMsgId, issueId);
      setTaggingMsgId(null);
      loadData(); // Reload to show new tag
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
  if (!conversation) return <div>Conversation not found</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h2 className="font-bold text-slate-800">{conversation.title}</h2>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-xs font-medium px-2 py-0.5 bg-slate-200 text-slate-600 rounded uppercase">{conversation.sourceType}</span>
             <span className="text-xs text-slate-400">{messages.length} messages</span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
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