import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { Issue, Event, Message, IssueStatus, IssuePriority, LegalClause, AgreementItem } from '../types';
import { CheckCircle2, Clock, AlertTriangle, Archive, ArrowUpCircle, Loader2, Plus, X, Scale, Handshake } from 'lucide-react';
import { format } from 'date-fns';

export const IssueList: React.FC = () => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Create Form State
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<IssuePriority>(IssuePriority.Medium);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadIssues();
  }, []);

  const loadIssues = () => {
    setLoading(true);
    api.getIssues().then(setIssues).finally(() => setLoading(false));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createIssue({ 
        title, 
        description: desc, 
        priority, 
        status: IssueStatus.Open 
      });
      setIsModalOpen(false);
      setTitle('');
      setDesc('');
      loadIssues();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Issues Tracker</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Issue
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {issues.map(issue => (
          <Link to={`/issues/${issue.id}`} key={issue.id} className="group block h-full">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-full flex flex-col transition-all group-hover:shadow-md group-hover:border-indigo-200">
              <div className="flex justify-between items-start mb-4">
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                  issue.status === IssueStatus.Open ? 'bg-red-100 text-red-700' :
                  issue.status === IssueStatus.Monitoring ? 'bg-amber-100 text-amber-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {issue.status}
                </span>
                {issue.priority === IssuePriority.High && (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2 group-hover:text-indigo-700">{issue.title}</h3>
              <p className="text-slate-500 text-sm mb-6 flex-1">{issue.description}</p>
              <div className="pt-4 border-t border-slate-100 text-xs text-slate-400 flex justify-between items-center">
                <span>Updated {issue.updatedAt ? format(new Date(issue.updatedAt), 'MMM d, yyyy') : 'N/A'}</span>
                <span className="font-medium text-slate-500">View Details &rarr;</span>
              </div>
            </div>
          </Link>
        ))}
        {issues.length === 0 && (
          <div className="col-span-3 text-center py-10 text-slate-500">
            No issues found. Create one to get started.
          </div>
        )}
      </div>

       {/* Create Modal */}
       {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Track New Issue</h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Issue Title</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Screen Time Disagreements" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="Describe the pattern or conflict..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value as IssuePriority)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  {Object.values(IssuePriority).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <button type="submit" disabled={creating} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {creating ? 'Saving...' : 'Create Issue'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const IssueDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [relatedRules, setRelatedRules] = useState<{clauses: LegalClause[], items: AgreementItem[]}>({clauses: [], items: []});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getIssue(id),
      api.getEvents(id),
      api.getMessages(), // filtering client side for prototype
      api.getRulesForIssue(id)
    ]).then(([i, e, m, rules]) => {
      setIssue(i);
      setEvents(e);
      setMessages(m.filter(msg => msg.issueIds?.includes(id)));
      setRelatedRules(rules);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
  if (!issue) return <div>Issue not found</div>;

  // Combine and sort for timeline
  const timelineItems = [
    ...events.map(e => ({ type: 'event', data: e, date: e.date })),
    ...messages.map(m => ({ type: 'message', data: m, date: m.sentAt }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
         <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                 <h1 className="text-3xl font-bold text-slate-900">{issue.title}</h1>
                 <span className={`px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide ${
                  issue.status === IssueStatus.Open ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                }`}>{issue.status}</span>
              </div>
              <p className="text-slate-600 text-lg">{issue.description}</p>
            </div>
            {/* Actions */}
            <div className="flex gap-2">
               <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500">
                  <Archive className="w-5 h-5" />
               </button>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Main Content: Timeline */}
        <div className="xl:col-span-2 space-y-6">
           <h3 className="font-bold text-slate-800 text-lg">Timeline of Evidence</h3>
           <div className="relative border-l-2 border-slate-200 ml-3 space-y-8 pb-8">
              {timelineItems.length === 0 ? (
                <div className="pl-8 text-slate-500 italic">No events or messages linked to this issue.</div>
              ) : timelineItems.map((item, idx) => (
                <div key={idx} className="relative pl-8">
                   <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${
                     item.type === 'event' ? 'bg-emerald-500' : 'bg-indigo-500'
                   }`}></div>
                   
                   <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                         <span className={`text-xs font-bold uppercase tracking-wider ${
                            item.type === 'event' ? 'text-emerald-600' : 'text-indigo-600'
                         }`}>
                           {item.type === 'event' ? 'Event' : 'Message'}
                         </span>
                         <span className="text-xs text-slate-400">{format(new Date(item.date), 'MMM d, yyyy - h:mm a')}</span>
                      </div>
                      
                      {item.type === 'event' ? (
                        <>
                          <h4 className="font-bold text-slate-900 mb-1">{(item.data as any).title}</h4>
                          <p className="text-slate-600 text-sm">{(item.data as any).description}</p>
                        </>
                      ) : (
                        <p className="text-slate-600 text-sm italic">"{(item.data as any).rawText}"</p>
                      )}
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Sidebar: Goals & Rules */}
        <div className="space-y-6">
           {/* Relevant Rules Section */}
           <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 p-4 border-b border-slate-200">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <Scale className="w-4 h-4" /> Relevant Rules & Obligations
                 </h3>
              </div>
              <div className="p-4 space-y-4">
                 {relatedRules.clauses.map(clause => (
                   <div key={clause.id} className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                         <span className="bg-indigo-50 text-indigo-700 text-xs px-1.5 py-0.5 rounded font-bold border border-indigo-100">Legal: {clause.clauseRef}</span>
                         <span className="font-medium text-slate-800">{clause.topic}</span>
                      </div>
                      <p className="text-slate-600 leading-snug">{clause.summary || clause.fullText.substring(0, 100) + '...'}</p>
                   </div>
                 ))}
                 
                 {relatedRules.items.map(item => (
                   <div key={item.id} className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                         <span className="bg-emerald-50 text-emerald-700 text-xs px-1.5 py-0.5 rounded font-bold border border-emerald-100">Agreed: {item.itemRef || 'Item'}</span>
                         <span className="font-medium text-slate-800">{item.topic}</span>
                      </div>
                      <p className="text-slate-600 leading-snug">{item.fullText}</p>
                   </div>
                 ))}

                 {relatedRules.clauses.length === 0 && relatedRules.items.length === 0 && (
                   <div className="text-slate-400 text-sm italic text-center py-2">No rules linked yet.</div>
                 )}
                 
                 <div className="pt-2 border-t border-slate-100 mt-2">
                    <Link to="/rules" className="text-xs text-indigo-600 font-medium hover:underline flex items-center justify-center gap-1">
                       <Plus className="w-3 h-3" /> Link Rule
                    </Link>
                 </div>
              </div>
           </div>

           <div className="bg-indigo-900 text-indigo-100 p-6 rounded-xl">
              <h3 className="font-bold text-white mb-4">Strategic Goals</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5" />
                  <span>Document all inconsistencies regarding this topic.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5" />
                  <span>Keep responses under 40 words.</span>
                </li>
              </ul>
           </div>
        </div>
      </div>
    </div>
  );
};
