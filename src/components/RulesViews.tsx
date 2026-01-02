import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { parseLegalDocument } from '../services/ai';
import { DocumentProcessingModal } from './DocumentProcessingModal';
import { 
  LegalDocument, Agreement, LegalClause, AgreementItem, 
  LegalDocumentType, AgreementStatus, 
  DocumentExtractionResult, ExtractedAgreement,
  Role, Person, ExtractedPersonWithAction
} from '../types';
import { format } from 'date-fns';
import { Scale, FileText, Handshake, Calendar, Gavel, Loader2, Plus, ArrowRight, X, Save, Upload, Trash2, AlertCircle } from 'lucide-react';

export const RulesDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'legal' | 'agreements'>('legal');
  const [docs, setDocs] = useState<LegalDocument[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [existingPeople, setExistingPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Document Processing State
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [processingFile, setProcessingFile] = useState<File | null>(null);
  const [extractionResult, setExtractionResult] = useState<DocumentExtractionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [d, a, p] = await Promise.all([
        api.getLegalDocuments(), 
        api.getAgreements(),
        api.getPeople()
      ]);
      setDocs(d);
      setAgreements(a);
      setExistingPeople(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      startDocumentProcessing(file);
    }
  };

  const startDocumentProcessing = async (file: File) => {
    setIsUploadModalOpen(false);
    setProcessingFile(file);
    setShowProcessingModal(true);
    setIsProcessing(true);
    setProcessingError(null);
    setExtractionResult(null);

    try {
      const result = await parseLegalDocument(file, { existingPeople });
      setExtractionResult(result);
    } catch (e: any) {
      console.error('Document processing error:', e);
      setProcessingError(e.message || 'Failed to process document');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestMoreAgreements = async (query: string): Promise<ExtractedAgreement[]> => {
    if (!processingFile) return [];
    try {
      const result = await parseLegalDocument(processingFile, { 
        existingPeople, 
        additionalQuery: query 
      });
      return result.operationalAgreements;
    } catch (e) {
      console.error('Re-extraction failed:', e);
      return [];
    }
  };

  const handleProcessingConfirm = async (data: {
    metadata: DocumentExtractionResult['metadata'];
    people: ExtractedPersonWithAction[];
    agreements: ExtractedAgreement[];
  }) => {
    setUploading(true);
    setUploadError(null);

    try {
      // 1. Create the legal document record first
      const legalDoc = await api.createLegalDocument({
        title: data.metadata.suggestedTitle,
        documentType: data.metadata.documentType,
        caseNumber: data.metadata.caseNumber || undefined,
        courtName: data.metadata.courtName || undefined,
        jurisdiction: data.metadata.jurisdiction || undefined,
        effectiveDate: data.metadata.effectiveDate ? new Date(data.metadata.effectiveDate).toISOString() : undefined,
        signedDate: data.metadata.signedDate ? new Date(data.metadata.signedDate).toISOString() : undefined
      });

      // 2. Upload file to storage
      if (processingFile) {
        try {
          const fileUrl = await api.uploadLegalDocumentFile(processingFile, legalDoc.id);
          await api.updateLegalDocument(legalDoc.id, { fileUrl });
        } catch (uploadErr) {
          console.error('File upload error (continuing without file):', uploadErr);
        }
      }

      // 3. Create operational agreements
      if (data.agreements.length > 0) {
        await api.createAgreementWithItemsBulk(
          `${data.metadata.suggestedTitle} - Extracted Agreements`,
          legalDoc.id,
          data.agreements
        );
      }

      // 4. Create new people (only those with action === 'create')
      const peopleToCreate = data.people
        .filter(p => p.action === 'create')
        .map(p => ({
          name: p.name,
          role: p.editedRole || p.suggestedRole,
          context: p.editedContext ?? p.context
        }));
      
      if (peopleToCreate.length > 0) {
        await api.createPeopleBulk(peopleToCreate);
      }

      // Close modal and reload data
      setShowProcessingModal(false);
      setProcessingFile(null);
      setExtractionResult(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      loadData();
    } catch (e: any) {
      console.error('Save error:', e);
      setUploadError(e.message || 'Failed to save document data');
    } finally {
      setUploading(false);
    }
  };

  const handleCloseProcessingModal = () => {
    setShowProcessingModal(false);
    setProcessingFile(null);
    setExtractionResult(null);
    setProcessingError(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Rules & Obligations</h2>
      </div>

      <div className="border-b border-border flex gap-6">
        <button
          onClick={() => setActiveTab('legal')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'legal' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4" />
            Legal Documents
            <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">{docs.length}</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('agreements')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'agreements' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Handshake className="w-4 h-4" />
            Operational Agreements
            <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">{agreements.length}</span>
          </div>
        </button>
      </div>

      {activeTab === 'legal' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {/* Add New Card */}
           <div>
             <input 
               type="file" 
               ref={fileInputRef} 
               onChange={handleFileSelect} 
               className="hidden" 
               accept=".pdf,.doc,.docx,.jpg,.png,.txt"
             />
             <button 
               onClick={() => fileInputRef.current?.click()}
               className="w-full h-full min-h-[180px] border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors bg-muted/20 group"
             >
                <div className="p-3 bg-background rounded-full mb-3 group-hover:shadow-md transition-all">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <span className="font-medium text-sm text-foreground group-hover:text-primary">Upload Legal Document</span>
                <span className="text-xs text-muted-foreground mt-1">PDF, Word, or Image</span>
             </button>
           </div>
           
           {docs.map(doc => (
             <Link key={doc.id} to={`/rules/legal/${doc.id}`} className="block">
               <div className="bg-card p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                     <div className="bg-primary/10 p-3 rounded-lg text-primary">
                        <FileText className="w-6 h-6" />
                     </div>
                     <span className="text-xs font-bold uppercase tracking-wide px-2 py-1 bg-muted text-muted-foreground rounded">{doc.documentType.replace('_', ' ')}</span>
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{doc.title}</h3>
                  <div className="mt-auto space-y-2 text-sm text-muted-foreground">
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
            <button className="flex items-center gap-2 text-sm font-medium text-primary bg-primary/10 px-4 py-2 rounded-lg hover:bg-primary/20">
              <Plus className="w-4 h-4" /> Record New Agreement
            </button>
          </div>
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            {agreements.map(agree => (
              <Link key={agree.id} to={`/rules/agreements/${agree.id}`} className="block p-4 hover:bg-muted/50 transition-colors">
                 <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                       <div className={`p-2 rounded-lg ${
                         agree.status === AgreementStatus.Agreed ? 'bg-emerald-100 text-emerald-600' :
                         agree.status === AgreementStatus.Disputed ? 'bg-red-100 text-red-600' :
                         'bg-muted text-muted-foreground'
                       }`}>
                          <Handshake className="w-5 h-5" />
                       </div>
                       <div>
                          <h4 className="font-bold text-foreground">{agree.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{agree.description || 'No description provided.'}</p>
                          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                             <span className="capitalize">Source: {agree.sourceType.replace('_', ' ')}</span>
                             {agree.agreedDate && <span>Agreed: {format(new Date(agree.agreedDate), 'MMM d, yyyy')}</span>}
                          </div>
                       </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                 </div>
              </Link>
            ))}
            {agreements.length === 0 && (
              <div className="p-8 text-center text-muted-foreground italic">No agreements recorded yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Document Processing Modal */}
      <DocumentProcessingModal
        isOpen={showProcessingModal}
        file={processingFile}
        extractionResult={extractionResult}
        existingPeople={existingPeople}
        isProcessing={isProcessing}
        processingError={processingError}
        onClose={handleCloseProcessingModal}
        onConfirm={handleProcessingConfirm}
        onRequestMoreAgreements={handleRequestMoreAgreements}
      />
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

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!doc) return <div className="p-8 text-center text-muted-foreground">Document not found</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
       <div className="bg-card p-8 rounded-xl border border-border shadow-sm flex justify-between items-start">
          <div>
             <div className="flex items-center gap-3 mb-2">
                <Gavel className="w-6 h-6 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">{doc.title}</h1>
             </div>
             <div className="flex gap-4 text-sm text-muted-foreground mt-4">
                {doc.caseNumber && <span className="bg-muted px-2 py-1 rounded">Case: {doc.caseNumber}</span>}
                {doc.courtName && <span>{doc.courtName}</span>}
                {doc.effectiveDate && <span>Effective: {format(new Date(doc.effectiveDate), 'MMMM d, yyyy')}</span>}
             </div>
             {doc.notes && <p className="mt-4 text-muted-foreground">{doc.notes}</p>}
             {doc.fileUrl && !doc.fileUrl.startsWith('mock://') && (
                 <div className="mt-6">
                     <a 
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-primary border border-primary/20 bg-primary/10 px-3 py-2 rounded-lg hover:bg-primary/20 transition-colors"
                     >
                        <FileText className="w-4 h-4" /> View Original Document
                     </a>
                 </div>
             )}
          </div>
          <button className="text-primary font-medium text-sm hover:underline">Edit Metadata</button>
       </div>

       <div>
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-lg text-foreground">Clauses & Provisions</h3>
             <button className="text-sm bg-card border border-border px-3 py-1.5 rounded-lg hover:bg-muted font-medium text-foreground">
               + Add Clause
             </button>
          </div>
          
          {clauses.length === 0 ? (
            <div className="bg-card p-8 rounded-lg border border-border text-center text-muted-foreground">
              No clauses have been extracted from this document yet.
            </div>
          ) : (
            <div className="grid gap-4">
               {clauses.map(clause => (
                 <div key={clause.id} className={`bg-card p-5 rounded-lg border border-border shadow-sm ${!clause.isActive ? 'opacity-60 bg-muted' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                       <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">{clause.clauseRef}</span>
                          <span className="font-semibold text-primary">{clause.topic}</span>
                       </div>
                       {!clause.isActive && <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded uppercase font-bold">Inactive</span>}
                    </div>
                    {clause.summary && <p className="text-muted-foreground text-sm mb-3">{clause.summary}</p>}
                    <details className="text-sm">
                       <summary className="cursor-pointer text-primary hover:underline font-medium">View full text</summary>
                       <p className="mt-2 p-3 bg-muted rounded text-muted-foreground whitespace-pre-wrap">{clause.fullText}</p>
                    </details>
                 </div>
               ))}
            </div>
          )}
       </div>
    </div>
  );
};

export const AgreementDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [agree, setAgree] = useState<Agreement | null>(null);
  const [items, setItems] = useState<AgreementItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getAgreement(id), api.getAgreementItems(id)])
      .then(([a, i]) => {
        setAgree(a);
        setItems(i);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!agree) return <div className="p-8 text-center text-muted-foreground">Agreement not found</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
       <div className="bg-card p-8 rounded-xl border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
             <div className={`p-3 rounded-lg ${
               agree.status === AgreementStatus.Agreed ? 'bg-emerald-100 text-emerald-600' :
               agree.status === AgreementStatus.Disputed ? 'bg-red-100 text-red-600' :
               'bg-muted text-muted-foreground'
             }`}>
                <Handshake className="w-6 h-6" />
             </div>
             <div>
                <h1 className="text-2xl font-bold text-foreground">{agree.title}</h1>
                <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                  agree.status === AgreementStatus.Agreed ? 'bg-emerald-100 text-emerald-700' :
                  agree.status === AgreementStatus.Disputed ? 'bg-red-100 text-red-700' :
                  'bg-muted text-muted-foreground'
                }`}>{agree.status}</span>
             </div>
          </div>
          {agree.description && <p className="text-muted-foreground">{agree.description}</p>}
       </div>

       <div>
          <h3 className="font-bold text-lg text-foreground mb-4">Agreed Items ({items.length})</h3>
          {items.length === 0 ? (
            <div className="bg-card p-8 rounded-lg border border-border text-center text-muted-foreground">
              No items have been recorded for this agreement.
            </div>
          ) : (
            <div className="grid gap-4">
               {items.map(item => (
                  <div key={item.id} className={`bg-card p-5 rounded-lg border border-border shadow-sm ${!item.isActive ? 'opacity-60 bg-muted' : ''}`}>
                     <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                           {item.itemRef && <span className="font-mono text-sm font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">{item.itemRef}</span>}
                           <span className="font-semibold text-primary">{item.topic}</span>
                        </div>
                        {!item.isActive && <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded uppercase font-bold">Inactive</span>}
                     </div>
                     {item.summary && <p className="text-muted-foreground text-sm mb-3">{item.summary}</p>}
                     <details className="text-sm">
                        <summary className="cursor-pointer text-primary hover:underline font-medium">View full text</summary>
                        <p className="mt-2 p-3 bg-muted rounded text-muted-foreground whitespace-pre-wrap">{item.fullText}</p>
                     </details>
                  </div>
               ))}
            </div>
          )}
       </div>
    </div>
  );
};
