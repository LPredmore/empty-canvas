import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { LegalDocument, Agreement, LegalClause, AgreementItem, LegalDocumentType, AgreementStatus } from '../types';
import { format } from 'date-fns';
import { Scale, FileText, Handshake, Calendar, Gavel, Loader2, Plus, ArrowRight, X, Save, Upload, Trash2, AlertCircle } from 'lucide-react';

export const RulesDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'legal' | 'agreements'>('legal');
  const [docs, setDocs] = useState<LegalDocument[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState<LegalDocumentType>(LegalDocumentType.CourtOrder);
  const [newCaseNumber, setNewCaseNumber] = useState('');
  const [newEffectiveDate, setNewEffectiveDate] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [d, a] = await Promise.all([api.getLegalDocuments(), api.getAgreements()]);
      setDocs(d);
      setAgreements(a);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setUploadError(null);
    
    try {
      // Simulate file upload delay if a file is present
      if (selectedFile) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      await api.createLegalDocument({
        title: newDocTitle,
        documentType: newDocType,
        caseNumber: newCaseNumber,
        effectiveDate: newEffectiveDate ? new Date(newEffectiveDate).toISOString() : undefined,
        // In a real app, this would be the URL returned from the storage bucket
        fileUrl: selectedFile ? `mock://storage/${selectedFile.name.replace(/\s+/g, '_')}` : undefined
      });

      setIsUploadModalOpen(false);
      // Reset form
      setNewDocTitle('');
      setNewCaseNumber('');
      setNewEffectiveDate('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      loadData();
    } catch (e: any) {
      console.error(e);
      setUploadError(e.message || "Failed to save document. Please check your connection.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Rules & Obligations</h2>
      </div>

      <div className="border-b border-slate-200 flex gap-6">
        <button
          onClick={() => setActiveTab('legal')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'legal' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4" />
            Legal Documents
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{docs.length}</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('agreements')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'agreements' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Handshake className="w-4 h-4" />
            Operational Agreements
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{agreements.length}</span>
          </div>
        </button>
      </div>

      {activeTab === 'legal' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {/* Add New Card */}
           <button 
             onClick={() => setIsUploadModalOpen(true)}
             className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors bg-slate-50 group"
           >
              <div className="p-3 bg-white rounded-full mb-3 group-hover:shadow-md transition-all">
                <Plus className="w-6 h-6 text-indigo-500" />
              </div>
              <span className="font-medium text-sm text-slate-600 group-hover:text-indigo-600">Upload Legal Document</span>
           </button>
           
           {docs.map(doc => (
             <Link key={doc.id} to={`/rules/legal/${doc.id}`} className="block">
               <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                     <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600">
                        <FileText className="w-6 h-6" />
                     </div>
                     <span className="text-xs font-bold uppercase tracking-wide px-2 py-1 bg-slate-100 text-slate-600 rounded">{doc.documentType.replace('_', ' ')}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{doc.title}</h3>
                  <div className="mt-auto space-y-2 text-sm text-slate-500">
                     {doc.caseNumber && (
                       <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4" /> {doc.caseNumber}
                       </div>
                     )}
                     {doc.effectiveDate && (
                       <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" /> Eff: {format(new Date(doc.effectiveDate), 'MMM d, yyyy')}
                       </div>
                     )}
                  </div>
               </div>
             </Link>
           ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="flex items-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100">
              <Plus className="w-4 h-4" /> Record New Agreement
            </button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {agreements.map(agree => (
              <Link key={agree.id} to={`/rules/agreements/${agree.id}`} className="block p-4 hover:bg-slate-50 transition-colors">
                 <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                       <div className={`p-2 rounded-lg ${
                         agree.status === AgreementStatus.Agreed ? 'bg-emerald-100 text-emerald-600' :
                         agree.status === AgreementStatus.Disputed ? 'bg-red-100 text-red-600' :
                         'bg-slate-100 text-slate-600'
                       }`}>
                          <Handshake className="w-5 h-5" />
                       </div>
                       <div>
                          <h4 className="font-bold text-slate-900">{agree.title}</h4>
                          <p className="text-sm text-slate-500 mt-1">{agree.description || 'No description provided.'}</p>
                          <div className="flex gap-4 mt-2 text-xs text-slate-400">
                             <span className="capitalize">Source: {agree.sourceType.replace('_', ' ')}</span>
                             {agree.agreedDate && <span>Agreed: {format(new Date(agree.agreedDate), 'MMM d, yyyy')}</span>}
                          </div>
                       </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                 </div>
              </Link>
            ))}
            {agreements.length === 0 && (
              <div className="p-8 text-center text-slate-500 italic">No agreements recorded yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Upload Legal Document</h3>
              <button onClick={() => setIsUploadModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            
            {uploadError && (
               <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                     <span className="font-bold">Error:</span> {uploadError}
                  </div>
               </div>
            )}

            <form onSubmit={handleCreateDoc} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Document Title</label>
                <input required type="text" value={newDocTitle} onChange={e => setNewDocTitle(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Final Parenting Plan" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Document Type</label>
                <select value={newDocType} onChange={e => setNewDocType(e.target.value as LegalDocumentType)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  {Object.values(LegalDocumentType).map(t => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-slate-700">Case Number</label>
                   <input type="text" value={newCaseNumber} onChange={e => setNewCaseNumber(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700">Effective Date</label>
                   <input type="date" value={newEffectiveDate} onChange={e => setNewEffectiveDate(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              
              {/* File Selection Area */}
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Document File</label>
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    className="hidden" 
                    accept=".pdf,.doc,.docx,.jpg,.png"
                 />
                 <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        selectedFile ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                    }`}
                 >
                    {selectedFile ? (
                        <div className="text-center w-full">
                            <FileText className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                            <div className="text-sm font-medium text-slate-900 truncate px-4">{selectedFile.name}</div>
                            <div className="text-xs text-slate-500 mt-1">{(selectedFile.size / 1024).toFixed(0)} KB</div>
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedFile(null);
                                    if(fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="mt-3 inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                            >
                                <Trash2 className="w-3 h-3" /> Remove File
                            </button>
                        </div>
                    ) : (
                        <div className="text-center">
                            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <div className="text-sm text-slate-600 font-medium">Click to select file</div>
                            <div className="text-xs text-slate-400 mt-1">PDF, Word, or Image</div>
                        </div>
                    )}
                 </div>
              </div>

              <button type="submit" disabled={uploading} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {uploading ? 'Uploading...' : 'Save Document'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const LegalDocDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [clauses, setClauses] = useState<LegalClause[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getLegalDocument(id), api.getLegalClauses(id)])
      .then(([d, c]) => {
        setDoc(d);
        setClauses(c);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
  if (!doc) return <div>Document not found</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
       <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex justify-between items-start">
          <div>
             <div className="flex items-center gap-3 mb-2">
                <Gavel className="w-6 h-6 text-indigo-600" />
                <h1 className="text-2xl font-bold text-slate-900">{doc.title}</h1>
             </div>
             <div className="flex gap-4 text-sm text-slate-500 mt-4">
                {doc.caseNumber && <span className="bg-slate-100 px-2 py-1 rounded">Case: {doc.caseNumber}</span>}
                {doc.courtName && <span>{doc.courtName}</span>}
                {doc.effectiveDate && <span>Effective: {format(new Date(doc.effectiveDate), 'MMMM d, yyyy')}</span>}
             </div>
             {doc.notes && <p className="mt-4 text-slate-600">{doc.notes}</p>}
             {doc.fileUrl && (
                 <div className="mt-6">
                     <button className="flex items-center gap-2 text-sm font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 px-3 py-2 rounded-lg hover:bg-indigo-100 transition-colors">
                        <FileText className="w-4 h-4" /> View Original Document
                     </button>
                 </div>
             )}
          </div>
          <button className="text-indigo-600 font-medium text-sm hover:underline">Edit Metadata</button>
       </div>

       <div>
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-lg text-slate-800">Clauses & Provisions</h3>
             <button className="text-sm bg-white border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-medium text-slate-700">
               + Add Clause
             </button>
          </div>
          
          <div className="grid gap-4">
             {clauses.map(clause => (
               <div key={clause.id} className={`bg-white p-5 rounded-lg border border-slate-200 shadow-sm ${!clause.isActive ? 'opacity-60 bg-slate-50' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                     <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{clause.clauseRef}</span>
                        <span className="font-semibold text-indigo-700">{clause.topic}</span>
                     </div>
                     {!clause.isActive && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded uppercase font-bold">Inactive</span>}
                  </div>
                  <p className="text-slate-800 text-sm leading-relaxed mb-3 font-serif">{clause.fullText}</p>
                  {clause.summary && (
                    <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 border border-blue-100">
                       <span className="font-bold mr-2">Summary:</span> {clause.summary}
                    </div>
                  )}
               </div>
             ))}
             {clauses.length === 0 && <div className="text-slate-500 italic">No clauses extracted yet.</div>}
          </div>
       </div>
    </div>
  );
};

export const AgreementDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [items, setItems] = useState<AgreementItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getAgreement(id), api.getAgreementItems(id)])
      .then(([a, i]) => {
        setAgreement(a);
        setItems(i);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
  if (!agreement) return <div>Agreement not found</div>;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
       <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
             <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <Handshake className="w-6 h-6" />
             </div>
             <div>
                <h1 className="text-2xl font-bold text-slate-900">{agreement.title}</h1>
                <span className={`text-xs uppercase font-bold tracking-wide px-2 py-0.5 rounded ${
                   agreement.status === AgreementStatus.Agreed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>{agreement.status}</span>
             </div>
          </div>
          <p className="text-slate-600 mb-4">{agreement.description}</p>
          <div className="flex gap-6 text-sm text-slate-500 border-t border-slate-100 pt-4">
             <span>Source: <span className="font-medium text-slate-700 capitalize">{agreement.sourceType.replace('_', ' ')}</span></span>
             {agreement.agreedDate && <span>Date: <span className="font-medium text-slate-700">{format(new Date(agreement.agreedDate), 'MMM d, yyyy')}</span></span>}
          </div>
       </div>

       <div>
          <h3 className="font-bold text-lg text-slate-800 mb-4">Agreed Items</h3>
          <div className="space-y-3">
             {items.map((item, idx) => (
               <div key={item.id} className="bg-white p-4 rounded-lg border border-slate-200 flex gap-4">
                  <div className="font-bold text-slate-400 w-6 pt-0.5">{item.itemRef || idx + 1}.</div>
                  <div className="flex-1">
                     <h4 className="font-bold text-slate-800 text-sm mb-1">{item.topic}</h4>
                     <p className="text-slate-600 text-sm">{item.fullText}</p>
                  </div>
               </div>
             ))}
             {items.length === 0 && <div className="text-slate-500 italic">No items recorded.</div>}
          </div>
       </div>
    </div>
  );
};