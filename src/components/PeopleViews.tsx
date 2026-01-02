import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { generatePersonAnalysis, clarifyPerson } from '../services/ai';
import { Person, Role, ProfileNote, Conversation, Issue, Event, ConversationTurn, SuggestedRelationship, PersonRelationship, ConversationStatus } from '../types';
import { Mail, Phone, MapPin, MessageSquare, AlertCircle, FileText, BrainCircuit, Loader2, Plus, X, Save, Link as LinkIcon, Pencil, Trash2, Clock } from 'lucide-react';
import { ClarificationModal } from './ClarificationModal';
import { getContributionLabel, getContributionBadgeStyle, VALENCE_ICONS, ContributionValence } from '../utils/contributionHelpers';

type IssueWithContribution = Issue & {
  contributionType?: string;
  contributionDescription?: string;
  contributionValence?: string;
};

export const PeopleList: React.FC = () => {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New Person Form State
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<Role>(Role.Parent);
  const [newEmail, setNewEmail] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Iterative Clarification State
  const [showClarification, setShowClarification] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | undefined>();
  const [currentUnderstanding, setCurrentUnderstanding] = useState<string | undefined>();
  const [enrichedContext, setEnrichedContext] = useState<string | undefined>();
  const [suggestedRelationships, setSuggestedRelationships] = useState<SuggestedRelationship[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [clarifying, setClarifying] = useState(false);

  useEffect(() => {
    loadPeople();
  }, []);

  const loadPeople = () => {
    setLoading(true);
    api.getPeople().then(setPeople).finally(() => setLoading(false));
  };

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClarifying(true);
    
    try {
      // Call AI to analyze the person (first round)
      const result = await clarifyPerson(newRole, newName, newDescription, people, []);
      
      setCurrentQuestion(result.question);
      setCurrentUnderstanding(result.currentUnderstanding);
      setEnrichedContext(result.enrichedContext);
      setSuggestedRelationships(result.suggestedRelationships);
      setIsComplete(result.complete);
      setConversationHistory([]);
      setShowClarification(true);
    } catch (err) {
      console.error('Clarification error:', err);
      // Fallback: create person directly without AI clarification
      await createPersonDirectly(newDescription);
    } finally {
      setClarifying(false);
    }
  };

  const handleClarificationContinue = async (answer: string) => {
    if (!currentQuestion) return;
    
    setClarifying(true);
    
    try {
      // Add the current Q&A to history
      const newHistory = [...conversationHistory, { question: currentQuestion, answer }];
      setConversationHistory(newHistory);
      
      // Call AI with updated conversation history
      const result = await clarifyPerson(newRole, newName, newDescription, people, newHistory);
      
      setCurrentQuestion(result.question);
      setCurrentUnderstanding(result.currentUnderstanding);
      setEnrichedContext(result.enrichedContext);
      setSuggestedRelationships(result.suggestedRelationships);
      setIsComplete(result.complete);
    } catch (err) {
      console.error('Clarification continue error:', err);
    } finally {
      setClarifying(false);
    }
  };

  const handleClarificationConfirm = async (confirmedRelationships: SuggestedRelationship[]) => {
    setCreating(true);
    
    try {
      const finalContext = enrichedContext || currentUnderstanding || newDescription;
      
      // Create the person
      const createdPerson = await api.createPerson({
        fullName: newName,
        role: newRole,
        email: newEmail || undefined,
        roleContext: finalContext
      });
      
      // Create relationships
      for (const rel of confirmedRelationships) {
        await api.createPersonRelationship({
          personId: createdPerson.id,
          relatedPersonId: rel.relatedPersonId,
          relationshipType: rel.relationshipType,
          description: rel.description
        });
      }
      
      // Reset and close
      resetForm();
      loadPeople();
    } catch (err) {
      console.error('Create person error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleSkipClarification = async () => {
    // Create person with whatever context we have
    await handleClarificationConfirm(suggestedRelationships);
  };

  const createPersonDirectly = async (context: string) => {
    try {
      await api.createPerson({
        fullName: newName,
        role: newRole,
        email: newEmail || undefined,
        roleContext: context
      });
      resetForm();
      loadPeople();
    } catch (err) {
      console.error('Create person error:', err);
    }
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setShowClarification(false);
    setConversationHistory([]);
    setCurrentQuestion(undefined);
    setCurrentUnderstanding(undefined);
    setEnrichedContext(undefined);
    setSuggestedRelationships([]);
    setIsComplete(false);
    setNewName('');
    setNewEmail('');
    setNewDescription('');
    setNewRole(Role.Parent);
  };

  const filteredPeople = filterRole === 'all' 
    ? people 
    : people.filter(p => p.role === filterRole);

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Directory</h2>
        <div className="flex gap-2">
          <select 
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">All Roles</option>
            {Object.values(Role).map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Person
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPeople.map(person => (
          <Link to={`/people/${person.id}`} key={person.id} className="group">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 transition-all group-hover:shadow-md group-hover:border-indigo-200">
              <div className="flex items-start gap-4">
                <img 
                  src={person.avatarUrl || `https://ui-avatars.com/api/?name=${person.fullName}&background=random`} 
                  alt={person.fullName} 
                  className="w-16 h-16 rounded-full object-cover border-2 border-slate-100 group-hover:border-indigo-100"
                />
                <div>
                  <h3 className="font-bold text-slate-900 group-hover:text-indigo-700">{person.fullName}</h3>
                  <span className="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full mt-1 capitalize">
                    {person.role}
                  </span>
                </div>
              </div>
              {person.notes && (
                <p className="mt-4 text-sm text-slate-500 line-clamp-2">{person.notes}</p>
              )}
              <div className="mt-4 pt-4 border-t border-slate-100 flex gap-4 text-slate-400">
                {person.email && <Mail className="w-4 h-4" />}
                {person.phone && <Phone className="w-4 h-4" />}
              </div>
            </div>
          </Link>
        ))}
        {filteredPeople.length === 0 && (
          <div className="col-span-3 text-center py-10 text-slate-500">
            No people found. Add some in Supabase!
          </div>
        )}
      </div>

      {/* Modal for creating person */}
      {isModalOpen && !showClarification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Add New Person</h3>
              <button onClick={resetForm}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <form onSubmit={handleInitialSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Full Name</label>
                <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as Role)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea 
                  value={newDescription} 
                  onChange={e => setNewDescription(e.target.value)} 
                  rows={3}
                  className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  placeholder="Describe who this person is... (e.g., 'Bryce's occupational therapist' or 'My ex-wife's new husband')"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email (Optional)</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <button type="submit" disabled={clarifying} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {clarifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Clarification Modal */}
      {showClarification && (
        <ClarificationModal
          personName={newName}
          conversationHistory={conversationHistory}
          currentQuestion={currentQuestion}
          currentUnderstanding={currentUnderstanding}
          enrichedContext={enrichedContext}
          suggestedRelationships={suggestedRelationships}
          isComplete={isComplete}
          isProcessing={clarifying || creating}
          onContinue={handleClarificationContinue}
          onConfirm={handleClarificationConfirm}
          onCancel={resetForm}
          onSkip={handleSkipClarification}
        />
      )}
    </div>
  );
};

export const PersonDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [person, setPerson] = useState<Person | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pendingConversations, setPendingConversations] = useState<Conversation[]>([]);
  const [notes, setNotes] = useState<ProfileNote[]>([]);
  const [involvedIssues, setInvolvedIssues] = useState<IssueWithContribution[]>([]);
  const [relationships, setRelationships] = useState<(PersonRelationship & { relatedPerson?: Person })[]>([]);
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analysis'>('overview');
  
  // Create Note State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<'observation' | 'strategy' | 'pattern'>('observation');
  const [creatingNote, setCreatingNote] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Add Relationship State
  const [isRelModalOpen, setIsRelModalOpen] = useState(false);
  const [relPersonId, setRelPersonId] = useState('');
  const [relType, setRelType] = useState('');
  const [relDescription, setRelDescription] = useState('');
  const [creatingRel, setCreatingRel] = useState(false);

  // Edit Relationship State
  const [editingRel, setEditingRel] = useState<(PersonRelationship & { relatedPerson?: Person }) | null>(null);
  const [editRelType, setEditRelType] = useState('');
  const [editRelDescription, setEditRelDescription] = useState('');
  const [updatingRel, setUpdatingRel] = useState(false);

  // Delete Relationship State
  const [deletingRel, setDeletingRel] = useState<(PersonRelationship & { relatedPerson?: Person }) | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [p, allConv, n, linkedIssues, peopleList, rels, awaitingConv] = await Promise.all([
        api.getPerson(id),
        api.getConversations(),
        api.getProfileNotes(id),
        api.getIssuesForPersonDirect(id),
        api.getPeople(),
        api.getPersonRelationships(id),
        api.getConversationsAwaitingPerson(id)
      ]);
      setPerson(p);
      setAllPeople(peopleList);
      setConversations(allConv.filter(c => c.participantIds.includes(id)));
      setPendingConversations(awaitingConv);
      setNotes(n);
      setInvolvedIssues(linkedIssues);
      
      // Enrich relationships with person data
      const enrichedRels = rels.map(rel => ({
        ...rel,
        relatedPerson: peopleList.find(person => person.id === rel.relatedPersonId)
      }));
      setRelationships(enrichedRels);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setCreatingNote(true);
    try {
      await api.createProfileNote({
        personId: id,
        type: noteType,
        content: noteContent
      });
      setIsNoteModalOpen(false);
      setNoteContent('');
      loadData(); // refresh
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingNote(false);
    }
  };

  const handleAnalyze = async () => {
     if (!id) return;
     setAnalyzing(true);
     try {
        await generatePersonAnalysis(id);
        await loadData(); // Reload to show new notes and profile summary
        setActiveTab('analysis'); // Switch to analysis tab
     } catch (error) {
        console.error(error);
        alert('Analysis failed. Please try again.');
     } finally {
        setAnalyzing(false);
     }
  };

  const handleCreateRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !relPersonId || !relType) return;
    setCreatingRel(true);
    try {
      await api.createPersonRelationship({
        personId: id,
        relatedPersonId: relPersonId,
        relationshipType: relType,
        description: relDescription || undefined
      });
      setIsRelModalOpen(false);
      setRelPersonId('');
      setRelType('');
      setRelDescription('');
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingRel(false);
    }
  };

  const openEditRelModal = (rel: PersonRelationship & { relatedPerson?: Person }) => {
    setEditingRel(rel);
    setEditRelType(rel.relationshipType);
    setEditRelDescription(rel.description || '');
  };

  const handleUpdateRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRel) return;
    setUpdatingRel(true);
    try {
      await api.updatePersonRelationship(editingRel.id, {
        relationshipType: editRelType,
        description: editRelDescription || undefined
      });
      setEditingRel(null);
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingRel(false);
    }
  };

  const handleDeleteRelationship = async () => {
    if (!deletingRel) return;
    setIsDeleting(true);
    try {
      await api.deletePersonRelationship(deletingRel.id);
      setDeletingRel(null);
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
  if (!person) return <div>Person not found</div>;

  return (
    <div className="space-y-8">
      {/* Header Profile */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col md:flex-row gap-8 items-start">
        <img 
          src={person.avatarUrl || `https://ui-avatars.com/api/?name=${person.fullName}&background=random`} 
          alt={person.fullName} 
          className="w-32 h-32 rounded-full object-cover border-4 border-slate-50"
        />
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{person.fullName}</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-block bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium capitalize border border-indigo-100">
                  {person.role}
                </span>
                {person.roleContext && (
                  <span className="text-sm text-slate-600">{person.roleContext}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex flex-wrap gap-6 text-slate-600">
            {person.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{person.email}</span>
              </div>
            )}
            {person.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{person.phone}</span>
              </div>
            )}
          </div>
          
          <div className="mt-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
             <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Clinical Assessment Summary</h4>
             <p className="text-slate-700 text-sm leading-relaxed">{person.notes || "No assessment available. Run the AI Analysis."}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'overview' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Overview & Activity
          {activeTab === 'overview' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('analysis')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'analysis' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Analysis & Notes
          {activeTab === 'analysis' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600"></div>}
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pending Responses Section */}
            {pendingConversations.length > 0 && (
              <div className="space-y-4 lg:col-span-2">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" /> 
                  Pending Responses from {person.fullName}
                  <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    {pendingConversations.length}
                  </span>
                </h3>
                <div className="bg-amber-50 rounded-lg border border-amber-200 divide-y divide-amber-100">
                  {pendingConversations.map(c => {
                    const daysSince = c.endedAt 
                      ? Math.floor((Date.now() - new Date(c.endedAt).getTime()) / (1000 * 60 * 60 * 24))
                      : null;
                    return (
                      <Link to={`/conversations/${c.id}`} key={c.id} className="block p-4 hover:bg-amber-100/50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-slate-800">{c.title}</div>
                            <div className="text-xs text-slate-500 mt-1">{c.sourceType}</div>
                          </div>
                          {daysSince !== null && (
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              daysSince > 14 
                                ? 'bg-red-100 text-red-700' 
                                : daysSince > 7 
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                            }`}>
                              {daysSince === 0 ? 'Today' : daysSince === 1 ? '1 day ago' : `${daysSince} days ago`}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Recent Conversations
              </h3>
              <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                {conversations.length === 0 ? (
                  <div className="p-4 text-slate-500 text-sm">No conversations found.</div>
                ) : (
                  conversations.map(c => (
                    <Link to={`/conversations/${c.id}`} key={c.id} className="block p-4 hover:bg-slate-50">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span className="uppercase">{c.sourceType}</span>
                        <span>{new Date(c.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="font-medium text-slate-800">{c.title}</div>
                    </Link>
                  ))
                )}
              </div>
            </div>

             <div className="space-y-4">
               <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Involved Issues
              </h3>
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <p className="text-sm text-slate-500 px-4 pt-4 pb-2">
                  Issues where this person is involved (linked via events or analysis notes).
                </p>
                <div className="divide-y divide-slate-100">
                   {involvedIssues.length === 0 ? (
                       <div className="px-4 py-3 text-xs text-slate-400 italic">No issues linked.</div>
                   ) : involvedIssues.map(issue => {
                     const valence = issue.contributionValence as ContributionValence | undefined;
                     const valenceInfo = valence ? VALENCE_ICONS[valence] : null;
                     
                     return (
                       <Link 
                         to={`/issues/${issue.id}`} 
                         key={issue.id} 
                         className="block px-4 py-3 hover:bg-slate-50 transition-colors"
                       >
                         <div className="flex items-center gap-2 flex-wrap mb-1">
                           <span className="font-medium text-slate-800 text-sm">{issue.title}</span>
                           <span className={`text-xs px-2 py-0.5 rounded-full border ${getContributionBadgeStyle(issue.contributionType, issue.contributionValence)}`}>
                             {getContributionLabel(issue.contributionType)}
                           </span>
                           {valenceInfo && (
                             <span className={`text-sm font-bold ${valenceInfo.color}`}>
                               {valenceInfo.icon}
                             </span>
                           )}
                         </div>
                         {issue.contributionDescription && (
                           <p className="text-xs text-slate-600 leading-relaxed">
                             {issue.contributionDescription}
                           </p>
                         )}
                       </Link>
                     );
                   })}
                </div>
              </div>
            </div>

            {/* Relationships Section */}
            <div className="space-y-4 lg:col-span-2">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" /> Relationships
                </h3>
                <button 
                  onClick={() => setIsRelModalOpen(true)}
                  className="flex items-center gap-1 text-xs font-medium bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Relationship
                </button>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                {relationships.length === 0 ? (
                  <div className="p-4 text-slate-500 text-sm">No relationships defined.</div>
                ) : (
                  relationships.map(rel => (
                    <div key={rel.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                      <Link 
                        to={`/people/${rel.relatedPersonId}`} 
                        className="flex-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">
                            {rel.relatedPerson?.fullName || 'Unknown'}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-sm text-indigo-600 capitalize">
                            {rel.relationshipType.replace(/_/g, ' ')}
                          </span>
                          {rel.relatedPerson && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                              {rel.relatedPerson.role}
                            </span>
                          )}
                        </div>
                        {rel.description && (
                          <p className="text-sm text-slate-500 mt-1">{rel.description}</p>
                        )}
                      </Link>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditRelModal(rel)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit relationship"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingRel(rel)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete relationship"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Strategic Notes
              </h3>
              <div className="flex gap-2">
                 <button 
                   onClick={() => setIsNoteModalOpen(true)}
                   className="flex items-center gap-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                 >
                   <Plus className="w-3 h-3" /> Add Note
                 </button>
                 <button 
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="flex items-center gap-2 text-xs font-medium bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                 >
                    {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                    {analyzing ? 'Run Deep Analysis (AI)' : 'Run Deep Analysis (AI)'}
                 </button>
              </div>
            </div>
            
            <div className="grid gap-4">
              {notes.map(note => (
                <div key={note.id} className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                   <div className="flex justify-between items-start mb-2">
                      <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${
                        note.type === 'strategy' ? 'bg-emerald-100 text-emerald-700' : 
                        note.type === 'observation' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {note.type}
                      </span>
                      <div className="flex items-center gap-2">
                         {note.issueId && (
                           <Link to={`/issues/${note.issueId}`} className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Issue Linked
                           </Link>
                         )}
                         <span className="text-xs text-slate-400">{new Date(note.createdAt).toLocaleDateString()}</span>
                      </div>
                   </div>
                   <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">{note.content}</div>
                </div>
              ))}
              {notes.length === 0 && (
                <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-400">
                  No analysis notes yet. Add your first observation or run the AI analysis.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Note Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Add Strategic Note</h3>
              <button onClick={() => setIsNoteModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <form onSubmit={handleCreateNote} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Note Type</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(['observation', 'strategy', 'pattern'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNoteType(t)}
                      className={`py-2 text-xs font-medium uppercase rounded-lg border ${
                        noteType === t ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Content</label>
                <textarea 
                  required 
                  rows={4} 
                  value={noteContent} 
                  onChange={e => setNoteContent(e.target.value)} 
                  className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" 
                  placeholder="Record your observation or strategy..."
                />
              </div>
              <button type="submit" disabled={creatingNote} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {creatingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Note
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Relationship Modal */}
      {isRelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Add Relationship</h3>
              <button onClick={() => setIsRelModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <form onSubmit={handleCreateRelationship} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Person</label>
                <select
                  required
                  value={relPersonId}
                  onChange={e => setRelPersonId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="">Select a person...</option>
                  {allPeople.filter(p => p.id !== id).map(p => (
                    <option key={p.id} value={p.id}>{p.fullName} ({p.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Relationship Type</label>
                <select
                  required
                  value={relType}
                  onChange={e => setRelType(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="">Select relationship...</option>
                  <option value="parent_of">Parent of</option>
                  <option value="child_of">Child of</option>
                  <option value="step_parent_of">Step-parent of</option>
                  <option value="step_child_of">Step-child of</option>
                  <option value="sibling_of">Sibling of</option>
                  <option value="step_sibling_of">Step-sibling of</option>
                  <option value="spouse_of">Spouse of</option>
                  <option value="ex_spouse_of">Ex-spouse of</option>
                  <option value="therapist_for">Therapist for</option>
                  <option value="attorney_for">Attorney for</option>
                  <option value="guardian_ad_litem_for">Guardian ad litem for</option>
                  <option value="grandparent_of">Grandparent of</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                <input 
                  type="text"
                  value={relDescription} 
                  onChange={e => setRelDescription(e.target.value)} 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="e.g., Primary custody parent"
                />
              </div>
              <button type="submit" disabled={creatingRel} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {creatingRel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Add Relationship
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Relationship Modal */}
      {editingRel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Edit Relationship</h3>
              <button onClick={() => setEditingRel(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="mb-4 p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">
                Relationship with <span className="font-medium text-slate-800">{editingRel.relatedPerson?.fullName || 'Unknown'}</span>
              </p>
            </div>
            <form onSubmit={handleUpdateRelationship} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Relationship Type</label>
                <select
                  required
                  value={editRelType}
                  onChange={e => setEditRelType(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="">Select relationship...</option>
                  <option value="parent_of">Parent of</option>
                  <option value="child_of">Child of</option>
                  <option value="step_parent_of">Step-parent of</option>
                  <option value="step_child_of">Step-child of</option>
                  <option value="sibling_of">Sibling of</option>
                  <option value="step_sibling_of">Step-sibling of</option>
                  <option value="spouse_of">Spouse of</option>
                  <option value="ex_spouse_of">Ex-spouse of</option>
                  <option value="therapist_for">Therapist for</option>
                  <option value="attorney_for">Attorney for</option>
                  <option value="guardian_ad_litem_for">Guardian ad litem for</option>
                  <option value="grandparent_of">Grandparent of</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                <input 
                  type="text"
                  value={editRelDescription} 
                  onChange={e => setEditRelDescription(e.target.value)} 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="e.g., Primary custody parent"
                />
              </div>
              <button type="submit" disabled={updatingRel} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {updatingRel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Relationship Confirmation Modal */}
      {deletingRel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Delete Relationship</h3>
              <button onClick={() => setDeletingRel(null)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete the relationship with <span className="font-medium text-slate-800">{deletingRel.relatedPerson?.fullName || 'this person'}</span>?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeletingRel(null)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteRelationship}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
