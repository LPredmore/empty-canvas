import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { IssueStatus, Conversation, Issue, Event } from '../types';
import { ArrowRight, Clock, AlertTriangle, MessageSquareText, Calendar, Loader2, Plus, X, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export const Dashboard: React.FC = () => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  // New Event State
  const [evtTitle, setEvtTitle] = useState('');
  const [evtDate, setEvtDate] = useState(new Date().toISOString().split('T')[0]);
  const [evtDesc, setEvtDesc] = useState('');
  const [creatingEvt, setCreatingEvt] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [issuesData, convData, eventsData] = await Promise.all([
        api.getIssues(),
        api.getConversations(),
        api.getEvents()
      ]);
      setIssues(issuesData);
      setConversations(convData);
      setEvents(eventsData);
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingEvt(true);
    try {
      await api.createEvent({
        title: evtTitle,
        date: new Date(evtDate).toISOString(),
        description: evtDesc
      });
      setIsEventModalOpen(false);
      setEvtTitle('');
      setEvtDesc('');
      loadData(); // Reload to show new event
    } catch (error) {
      console.error(error);
    } finally {
      setCreatingEvt(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  const activeIssuesCount = issues.filter(i => i.status === IssueStatus.Open || i.status === IssueStatus.Monitoring).length;
  const recentConversations = [...conversations].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3);
  const recentEvents = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-500 font-medium text-sm">Active Issues</h3>
            <AlertTriangle className="text-amber-500 w-5 h-5" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-slate-900">{activeIssuesCount}</span>
            <p className="text-sm text-slate-400 mt-1">Requires attention</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-500 font-medium text-sm">Recent Activity</h3>
            <MessageSquareText className="text-indigo-500 w-5 h-5" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-slate-900">{conversations.length}</span>
            <p className="text-sm text-slate-400 mt-1">Total threads tracked</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-500 font-medium text-sm">Logged Events</h3>
            <Calendar className="text-emerald-500 w-5 h-5" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-slate-900">{events.length}</span>
            <p className="text-sm text-slate-400 mt-1">Key milestones</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Conversations */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800">Recent Conversations</h2>
            <Link to="/conversations" className="text-indigo-600 text-sm hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentConversations.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 italic">No conversations found.</div>
            ) : (
              recentConversations.map(conv => (
                <Link to={`/conversations/${conv.id}`} key={conv.id} className="block p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {conv.sourceType}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {conv.updatedAt ? format(new Date(conv.updatedAt), 'MMM d, h:mm a') : 'N/A'}
                    </span>
                  </div>
                  <h4 className="font-medium text-slate-900 mt-2">{conv.title}</h4>
                  <p className="text-sm text-slate-500 truncate mt-1">{conv.previewText}</p>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Recent Events / Timeline Snippet */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800">Recent Events</h2>
            <div className="flex gap-4">
               <button 
                  onClick={() => setIsEventModalOpen(true)}
                  className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors flex items-center gap-1"
               >
                  <Plus className="w-3 h-3" /> Log Event
               </button>
               <Link to="/timeline" className="text-indigo-600 text-sm hover:underline flex items-center gap-1">
                  View full timeline <ArrowRight className="w-3 h-3" />
               </Link>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {recentEvents.length === 0 ? (
              <div className="text-sm text-slate-500 italic">No events recorded.</div>
            ) : (
              recentEvents.map(evt => (
                <div key={evt.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2"></div>
                    <div className="w-0.5 bg-slate-200 flex-1 my-1"></div>
                  </div>
                  <div className="pb-4">
                    <p className="text-xs text-slate-400 mb-0.5">{format(new Date(evt.date), 'MMMM d, yyyy')}</p>
                    <h4 className="text-sm font-semibold text-slate-800">{evt.title}</h4>
                    <p className="text-sm text-slate-600 mt-1">{evt.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Log Event Modal */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Log Significant Event</h3>
              <button onClick={() => setIsEventModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Event Title</label>
                <input required type="text" value={evtTitle} onChange={e => setEvtTitle(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Mediation outcome" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Date</label>
                <input required type="date" value={evtDate} onChange={e => setEvtDate(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea rows={3} value={evtDesc} onChange={e => setEvtDesc(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="What happened?" />
              </div>
              <button type="submit" disabled={creatingEvt} className="w-full bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {creatingEvt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Log Event
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};