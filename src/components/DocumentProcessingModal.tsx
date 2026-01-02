import React, { useState, useEffect } from 'react';
import { X, FileText, Users, Scale, FileCheck, ChevronRight, Loader2, Check, AlertCircle, Info, Eye, Image } from 'lucide-react';
import { 
  DocumentExtractionResult, 
  ExtractedPerson, 
  ExtractedClause, 
  ExtractedAgreement,
  Role,
  LegalDocumentType,
  AgreementCategory,
  PDFProcessingInfo
} from '../types';

interface DocumentProcessingModalProps {
  isOpen: boolean;
  file: File | null;
  extractionResult: DocumentExtractionResult | null;
  isProcessing: boolean;
  processingError: string | null;
  onClose: () => void;
  onConfirm: (data: {
    metadata: DocumentExtractionResult['metadata'];
    people: ExtractedPerson[];
    clauses: ExtractedClause[];
    agreements: ExtractedAgreement[];
  }) => void;
}

type Step = 'processing' | 'people' | 'clauses' | 'agreements' | 'confirm';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: Role.Me, label: 'Me' },
  { value: Role.Parent, label: 'Parent' },
  { value: Role.Child, label: 'Child' },
  { value: Role.StepParent, label: 'Step-Parent' },
  { value: Role.Clinician, label: 'Clinician' },
  { value: Role.Legal, label: 'Legal' },
  { value: Role.Other, label: 'Other' }
];

const CATEGORY_LABELS: Record<AgreementCategory, string> = {
  decision_making: 'Decision Making',
  parenting_time: 'Parenting Time',
  holiday_schedule: 'Holiday Schedule',
  school: 'School',
  communication: 'Communication',
  financial: 'Financial',
  travel: 'Travel',
  right_of_first_refusal: 'Right of First Refusal',
  exchange: 'Exchange',
  medical: 'Medical',
  extracurricular: 'Extracurricular',
  technology: 'Technology',
  third_party: 'Third Party',
  dispute_resolution: 'Dispute Resolution',
  modification: 'Modification',
  other: 'Other'
};

export function DocumentProcessingModal({
  isOpen,
  file,
  extractionResult,
  isProcessing,
  processingError,
  onClose,
  onConfirm
}: DocumentProcessingModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('processing');
  const [people, setPeople] = useState<ExtractedPerson[]>([]);
  const [clauses, setClauses] = useState<ExtractedClause[]>([]);
  const [agreements, setAgreements] = useState<ExtractedAgreement[]>([]);

  // Update state when extraction result changes
  useEffect(() => {
    if (extractionResult) {
      setPeople(extractionResult.extractedPeople);
      setClauses(extractionResult.legalClauses);
      setAgreements(extractionResult.operationalAgreements);
      setCurrentStep('people');
    }
  }, [extractionResult]);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen && !extractionResult) {
      setCurrentStep('processing');
      setPeople([]);
      setClauses([]);
      setAgreements([]);
    }
  }, [isOpen, extractionResult]);

  if (!isOpen) return null;

  const handlePersonToggle = (index: number) => {
    setPeople(prev => prev.map((p, i) => 
      i === index ? { ...p, includeInCreation: !p.includeInCreation } : p
    ));
  };

  const handlePersonRoleChange = (index: number, role: Role) => {
    setPeople(prev => prev.map((p, i) => 
      i === index ? { ...p, editedRole: role } : p
    ));
  };

  const handlePersonContextChange = (index: number, context: string) => {
    setPeople(prev => prev.map((p, i) => 
      i === index ? { ...p, editedContext: context } : p
    ));
  };

  const handleClauseToggle = (index: number) => {
    setClauses(prev => prev.map((c, i) => 
      i === index ? { ...c, include: !c.include } : c
    ));
  };

  const handleAgreementToggle = (index: number) => {
    setAgreements(prev => prev.map((a, i) => 
      i === index ? { ...a, include: !a.include } : a
    ));
  };

  const handleNext = () => {
    switch (currentStep) {
      case 'people':
        if (clauses.length > 0) {
          setCurrentStep('clauses');
        } else if (agreements.length > 0) {
          setCurrentStep('agreements');
        } else {
          setCurrentStep('confirm');
        }
        break;
      case 'clauses':
        if (agreements.length > 0) {
          setCurrentStep('agreements');
        } else {
          setCurrentStep('confirm');
        }
        break;
      case 'agreements':
        setCurrentStep('confirm');
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'clauses':
        setCurrentStep('people');
        break;
      case 'agreements':
        if (clauses.length > 0) {
          setCurrentStep('clauses');
        } else {
          setCurrentStep('people');
        }
        break;
      case 'confirm':
        if (agreements.length > 0) {
          setCurrentStep('agreements');
        } else if (clauses.length > 0) {
          setCurrentStep('clauses');
        } else {
          setCurrentStep('people');
        }
        break;
    }
  };

  const handleConfirm = () => {
    if (!extractionResult) return;
    onConfirm({
      metadata: extractionResult.metadata,
      people: people.filter(p => p.includeInCreation),
      clauses: clauses.filter(c => c.include),
      agreements: agreements.filter(a => a.include)
    });
  };

  const selectedPeopleCount = people.filter(p => p.includeInCreation).length;
  const selectedClausesCount = clauses.filter(c => c.include).length;
  const selectedAgreementsCount = agreements.filter(a => a.include).length;

  // Group agreements by category for display
  const agreementsByCategory: Record<string, (ExtractedAgreement & { originalIndex: number })[]> = agreements.reduce((acc, agreement, index) => {
    const cat = agreement.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push({ ...agreement, originalIndex: index });
    return acc;
  }, {} as Record<string, (ExtractedAgreement & { originalIndex: number })[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Process Legal Document</h2>
              {file && (
                <p className="text-sm text-muted-foreground">{file.name}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Processing Info Banner */}
        {currentStep !== 'processing' && extractionResult?.processingInfo && (
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-2 text-sm">
              {extractionResult.processingInfo.processingPath === 'vision' ? (
                <Image className="w-4 h-4 text-amber-500" />
              ) : (
                <FileText className="w-4 h-4 text-blue-500" />
              )}
              <span className="text-muted-foreground">
                Processed as: <span className="font-medium text-foreground">
                  {extractionResult.processingInfo.processingPath === 'vision' ? 'Scanned Document (Vision)' : 'Text Document'}
                </span>
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">
                {extractionResult.processingInfo.extractedPages} of {extractionResult.processingInfo.totalPages} pages
              </span>
              {extractionResult.processingInfo.wasTruncated && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="flex items-center gap-1 text-amber-600">
                    <Info className="w-3 h-3" />
                    Truncated for processing
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        {currentStep !== 'processing' && (
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border">
            <StepIndicator 
              icon={<Users className="w-4 h-4" />} 
              label="People" 
              active={currentStep === 'people'} 
              complete={currentStep !== 'people'} 
              count={selectedPeopleCount}
            />
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <StepIndicator 
              icon={<Scale className="w-4 h-4" />} 
              label="Clauses" 
              active={currentStep === 'clauses'} 
              complete={['agreements', 'confirm'].includes(currentStep)}
              count={selectedClausesCount}
              disabled={clauses.length === 0}
            />
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <StepIndicator 
              icon={<FileCheck className="w-4 h-4" />} 
              label="Agreements" 
              active={currentStep === 'agreements'} 
              complete={currentStep === 'confirm'}
              count={selectedAgreementsCount}
              disabled={agreements.length === 0}
            />
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <StepIndicator 
              icon={<Check className="w-4 h-4" />} 
              label="Confirm" 
              active={currentStep === 'confirm'} 
              complete={false}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {currentStep === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              {isProcessing ? (
                <>
                  <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                  <p className="text-lg font-medium text-foreground">Analyzing Document...</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Extracting people, legal clauses, and operational agreements
                  </p>
                </>
              ) : processingError ? (
                <>
                  <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                  <p className="text-lg font-medium text-foreground">Processing Failed</p>
                  <p className="text-sm text-destructive mt-2">{processingError}</p>
                  <button 
                    onClick={onClose}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    Close
                  </button>
                </>
              ) : null}
            </div>
          )}

          {currentStep === 'people' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-foreground">
                  Review Extracted People ({people.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPeople(prev => prev.map(p => ({ ...p, includeInCreation: true })))}
                    className="text-sm text-primary hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-muted-foreground">|</span>
                  <button
                    onClick={() => setPeople(prev => prev.map(p => ({ ...p, includeInCreation: false })))}
                    className="text-sm text-primary hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Select which people to add to your system. You can adjust their role and description.
              </p>
              
              {people.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No people were found in this document.
                </p>
              ) : (
                <div className="space-y-3">
                  {people.map((person, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-lg border ${
                        person.includeInCreation 
                          ? 'border-primary/50 bg-primary/5' 
                          : 'border-border bg-muted/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={person.includeInCreation}
                          onChange={() => handlePersonToggle(index)}
                          className="mt-1 w-4 h-4 text-primary rounded focus:ring-primary"
                        />
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-foreground">{person.name}</span>
                          </div>
                          
                          {person.includeInCreation && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">
                                  Role
                                </label>
                                <select
                                  value={person.editedRole || person.suggestedRole}
                                  onChange={(e) => handlePersonRoleChange(index, e.target.value as Role)}
                                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground focus:ring-2 focus:ring-ring"
                                >
                                  {ROLE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">
                                  Description
                                </label>
                                <input
                                  type="text"
                                  value={person.editedContext ?? person.context}
                                  onChange={(e) => handlePersonContextChange(index, e.target.value)}
                                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground focus:ring-2 focus:ring-ring"
                                  placeholder="e.g., Biological mother, Petitioner"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 'clauses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-foreground">
                  Review Legal Clauses ({clauses.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setClauses(prev => prev.map(c => ({ ...c, include: true })))}
                    className="text-sm text-primary hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-muted-foreground">|</span>
                  <button
                    onClick={() => setClauses(prev => prev.map(c => ({ ...c, include: false })))}
                    className="text-sm text-primary hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                These are the legal provisions extracted from the document.
              </p>
              
              <div className="space-y-3">
                {clauses.map((clause, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border ${
                      clause.include 
                        ? 'border-primary/50 bg-primary/5' 
                        : 'border-border bg-muted/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={clause.include}
                        onChange={() => handleClauseToggle(index)}
                        className="mt-1 w-4 h-4 text-primary rounded focus:ring-primary"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                            {clause.clauseRef}
                          </span>
                          <span className="font-medium text-foreground">{clause.topic}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{clause.summary}</p>
                        {clause.include && (
                          <details className="mt-2">
                            <summary className="text-xs text-primary cursor-pointer hover:underline">
                              View full text
                            </summary>
                            <p className="mt-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded whitespace-pre-wrap">
                              {clause.fullText}
                            </p>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 'agreements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-foreground">
                  Review Operational Agreements ({agreements.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAgreements(prev => prev.map(a => ({ ...a, include: true })))}
                    className="text-sm text-primary hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-muted-foreground">|</span>
                  <button
                    onClick={() => setAgreements(prev => prev.map(a => ({ ...a, include: false })))}
                    className="text-sm text-primary hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                These are the operational rules and agreements extracted from the document.
              </p>
              
              <div className="space-y-6">
                {Object.entries(agreementsByCategory).map(([category, items]) => (
                  <div key={category}>
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-primary rounded-full"></span>
                      {CATEGORY_LABELS[category as AgreementCategory] || category}
                      <span className="text-muted-foreground font-normal">({items.length})</span>
                    </h4>
                    <div className="space-y-2 ml-4">
                      {items.map((agreement) => (
                        <div 
                          key={agreement.originalIndex} 
                          className={`p-3 rounded-lg border ${
                            agreement.include 
                              ? 'border-primary/50 bg-primary/5' 
                              : 'border-border bg-muted/20'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={agreement.include}
                              onChange={() => handleAgreementToggle(agreement.originalIndex)}
                              className="mt-0.5 w-4 h-4 text-primary rounded focus:ring-primary"
                            />
                            <div className="flex-1">
                              <span className="font-medium text-foreground text-sm">{agreement.topic}</span>
                              <p className="text-sm text-muted-foreground mt-1">{agreement.summary}</p>
                              {agreement.include && (
                                <details className="mt-2">
                                  <summary className="text-xs text-primary cursor-pointer hover:underline">
                                    View full text
                                  </summary>
                                  <p className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded whitespace-pre-wrap">
                                    {agreement.fullText}
                                  </p>
                                </details>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 'confirm' && extractionResult && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-foreground">Confirm Import</h3>
              <p className="text-sm text-muted-foreground">
                Review what will be created and click "Save All" to complete the import.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-medium text-foreground">Document</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {extractionResult.metadata.suggestedTitle}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                    Type: {extractionResult.metadata.documentType.replace('_', ' ')}
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-primary" />
                    <span className="font-medium text-foreground">People</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{selectedPeopleCount}</p>
                  <p className="text-xs text-muted-foreground">
                    of {people.length} will be added
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="w-5 h-5 text-primary" />
                    <span className="font-medium text-foreground">Clauses</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{selectedClausesCount}</p>
                  <p className="text-xs text-muted-foreground">
                    of {clauses.length} will be saved
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-muted/20">
                <div className="flex items-center gap-2 mb-2">
                  <FileCheck className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground">Operational Agreements</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{selectedAgreementsCount}</p>
                <p className="text-xs text-muted-foreground">
                  of {agreements.length} will be saved
                </p>
                {selectedAgreementsCount > 0 && agreements.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(agreementsByCategory)
                      .filter(([_, items]) => (items as (ExtractedAgreement & { originalIndex: number })[]).some(i => i.include))
                      .map(([category]) => (
                        <span 
                          key={category}
                          className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                        >
                          {CATEGORY_LABELS[category as AgreementCategory]}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {currentStep !== 'processing' && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <button
              onClick={currentStep === 'people' ? onClose : handleBack}
              className="px-4 py-2 text-muted-foreground hover:text-foreground"
            >
              {currentStep === 'people' ? 'Cancel' : 'Back'}
            </button>
            
            {currentStep === 'confirm' ? (
              <button
                onClick={handleConfirm}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
              >
                Save All
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ 
  icon, 
  label, 
  active, 
  complete, 
  count,
  disabled 
}: { 
  icon: React.ReactNode; 
  label: string; 
  active: boolean; 
  complete: boolean;
  count?: number;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${
      disabled ? 'opacity-40' :
      active ? 'bg-primary/10 text-primary' : 
      complete ? 'text-primary' : 
      'text-muted-foreground'
    }`}>
      {icon}
      <span className="text-sm font-medium">{label}</span>
      {typeof count === 'number' && !disabled && (
        <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full ml-1">
          {count}
        </span>
      )}
    </div>
  );
}
