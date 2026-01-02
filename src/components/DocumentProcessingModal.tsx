import React, { useState, useEffect, useMemo } from 'react';
import { X, FileText, Users, FileCheck, ChevronRight, Loader2, Check, AlertCircle, Info, Image, Search, Link2, UserPlus, SkipForward, Sparkles, ChevronDown } from 'lucide-react';
import { 
  DocumentExtractionResult, 
  ExtractedPerson, 
  ExtractedAgreement,
  Role,
  AgreementCategory,
  PDFProcessingInfo,
  Person,
  PersonExtractionAction,
  ExtractedPersonWithAction
} from '../types';
import { findBestMatch, findAllMatches, NameMatchResult } from '../utils/nameMatching';

interface DocumentProcessingModalProps {
  isOpen: boolean;
  file: File | null;
  extractionResult: DocumentExtractionResult | null;
  existingPeople: Person[];
  isProcessing: boolean;
  processingError: string | null;
  onClose: () => void;
  onConfirm: (data: {
    metadata: DocumentExtractionResult['metadata'];
    people: ExtractedPersonWithAction[];
    agreements: ExtractedAgreement[];
  }) => void;
  onRequestMoreAgreements?: (query: string) => Promise<ExtractedAgreement[]>;
}

type Step = 'processing' | 'people' | 'agreements' | 'confirm';

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
  existingPeople,
  isProcessing,
  processingError,
  onClose,
  onConfirm,
  onRequestMoreAgreements
}: DocumentProcessingModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('processing');
  const [people, setPeople] = useState<ExtractedPersonWithAction[]>([]);
  const [agreements, setAgreements] = useState<ExtractedAgreement[]>([]);
  const [additionalQuery, setAdditionalQuery] = useState('');
  const [isSearchingMore, setIsSearchingMore] = useState(false);

  // Count statistics - must be before early return to maintain hook order
  const peopleToCreate = people.filter(p => p.action === 'create').length;
  const peopleToLink = people.filter(p => p.action === 'link').length;
  const peopleToSkip = people.filter(p => p.action === 'skip').length;
  const selectedAgreementsCount = agreements.filter(a => a.include).length;

  // Group agreements by category for display - must be before early return
  const agreementsByCategory: Record<string, (ExtractedAgreement & { originalIndex: number })[]> = useMemo(() => {
    return agreements.reduce((acc, agreement, index) => {
      const cat = agreement.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push({ ...agreement, originalIndex: index });
      return acc;
    }, {} as Record<string, (ExtractedAgreement & { originalIndex: number })[]>);
  }, [agreements]);

  // Apply automatic matching when extraction result changes
  useEffect(() => {
    if (extractionResult) {
      const matchedPeople: ExtractedPersonWithAction[] = extractionResult.extractedPeople.map(person => {
        // Check if AI already suggested a match
        if (person.suggestedExistingPersonId) {
          const existingPerson = existingPeople.find(p => p.id === person.suggestedExistingPersonId);
          if (existingPerson) {
            return {
              ...person,
              action: 'link' as PersonExtractionAction,
              linkedPersonId: person.suggestedExistingPersonId,
              matchScore: 1,
              suggestedMatchId: person.suggestedExistingPersonId
            };
          }
        }
        
        // Try fuzzy matching
        const match = findBestMatch(person.name, existingPeople, 0.7);
        if (match && match.matchScore >= 0.8) {
          // High confidence match - auto-link
          return {
            ...person,
            action: 'link' as PersonExtractionAction,
            linkedPersonId: match.personId,
            matchScore: match.matchScore,
            suggestedMatchId: match.personId
          };
        } else if (match && match.matchScore >= 0.6) {
          // Suggested match - user should confirm
          return {
            ...person,
            action: 'create' as PersonExtractionAction,
            matchScore: match.matchScore,
            suggestedMatchId: match.personId
          };
        }
        
        // No match found - default to create
        return {
          ...person,
          action: 'create' as PersonExtractionAction
        };
      });
      
      setPeople(matchedPeople);
      setAgreements(extractionResult.operationalAgreements);
      setCurrentStep('people');
    }
  }, [extractionResult, existingPeople]);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen && !extractionResult) {
      setCurrentStep('processing');
      setPeople([]);
      setAgreements([]);
      setAdditionalQuery('');
    }
  }, [isOpen, extractionResult]);

  if (!isOpen) return null;

  const handlePersonActionChange = (index: number, action: PersonExtractionAction) => {
    setPeople(prev => prev.map((p, i) => 
      i === index ? { ...p, action, linkedPersonId: action === 'link' ? p.linkedPersonId || p.suggestedMatchId : undefined } : p
    ));
  };

  const handlePersonLinkChange = (index: number, personId: string) => {
    setPeople(prev => prev.map((p, i) => 
      i === index ? { ...p, linkedPersonId: personId } : p
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

  const handleAgreementToggle = (index: number) => {
    setAgreements(prev => prev.map((a, i) => 
      i === index ? { ...a, include: !a.include } : a
    ));
  };

  const handleSearchMoreAgreements = async () => {
    if (!additionalQuery.trim() || !onRequestMoreAgreements) return;
    
    setIsSearchingMore(true);
    try {
      const newAgreements = await onRequestMoreAgreements(additionalQuery.trim());
      // Add new agreements, avoiding duplicates by topic
      const existingTopics = new Set(agreements.map(a => a.topic.toLowerCase()));
      const uniqueNew = newAgreements.filter(a => !existingTopics.has(a.topic.toLowerCase()));
      setAgreements(prev => [...prev, ...uniqueNew]);
      setAdditionalQuery('');
    } catch (e) {
      console.error('Failed to search for more agreements:', e);
    } finally {
      setIsSearchingMore(false);
    }
  };

  const handleNext = () => {
    switch (currentStep) {
      case 'people':
        setCurrentStep('agreements');
        break;
      case 'agreements':
        setCurrentStep('confirm');
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'agreements':
        setCurrentStep('people');
        break;
      case 'confirm':
        setCurrentStep('agreements');
        break;
    }
  };

  const handleConfirm = () => {
    if (!extractionResult) return;
    onConfirm({
      metadata: extractionResult.metadata,
      people: people.filter(p => p.action !== 'skip'),
      agreements: agreements.filter(a => a.include)
    });
  };

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

        {/* Progress Indicator - Updated to remove Clauses step */}
        {currentStep !== 'processing' && (
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border">
            <StepIndicator 
              icon={<Users className="w-4 h-4" />} 
              label="People" 
              active={currentStep === 'people'} 
              complete={currentStep !== 'people'} 
              count={peopleToCreate + peopleToLink}
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
                    Extracting people and operational agreements
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
                <div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <UserPlus className="w-3 h-3" /> {peopleToCreate} new
                  </span>
                  <span className="flex items-center gap-1 text-blue-600">
                    <Link2 className="w-3 h-3" /> {peopleToLink} linked
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <SkipForward className="w-3 h-3" /> {peopleToSkip} skipped
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                For each person, choose whether to create a new entry, link to an existing person, or skip.
              </p>
              
              {people.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No people were found in this document.
                </p>
              ) : (
                <div className="space-y-3">
                  {people.map((person, index) => (
                    <PersonCard
                      key={index}
                      person={person}
                      index={index}
                      existingPeople={existingPeople}
                      onActionChange={handlePersonActionChange}
                      onLinkChange={handlePersonLinkChange}
                      onRoleChange={handlePersonRoleChange}
                      onContextChange={handlePersonContextChange}
                    />
                  ))}
                </div>
              )}
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
              
              {/* Re-extraction query input */}
              {onRequestMoreAgreements && (
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Missing something?</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={additionalQuery}
                      onChange={(e) => setAdditionalQuery(e.target.value)}
                      placeholder="Ask AI to look for more provisions about... (e.g., 'vacation schedules', 'pet custody')"
                      className="flex-1 px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground focus:ring-2 focus:ring-ring"
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchMoreAgreements()}
                    />
                    <button
                      onClick={handleSearchMoreAgreements}
                      disabled={isSearchingMore || !additionalQuery.trim()}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 text-sm"
                    >
                      {isSearchingMore ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      Search
                    </button>
                  </div>
                </div>
              )}
              
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
                
                {agreements.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No agreements were extracted from this document.
                  </p>
                )}
              </div>
            </div>
          )}

          {currentStep === 'confirm' && extractionResult && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-foreground">Confirm Import</h3>
              <p className="text-sm text-muted-foreground">
                Review what will be created and click "Save All" to complete the import.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="flex gap-4">
                    <div>
                      <p className="text-2xl font-bold text-emerald-600">{peopleToCreate}</p>
                      <p className="text-xs text-muted-foreground">new</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{peopleToLink}</p>
                      <p className="text-xs text-muted-foreground">linked</p>
                    </div>
                  </div>
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
                {selectedAgreementsCount > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(agreementsByCategory)
                      .filter(([_, items]) => items.some(i => i.include))
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

// Person Card Component with Create/Link/Skip options
interface PersonCardProps {
  person: ExtractedPersonWithAction;
  index: number;
  existingPeople: Person[];
  onActionChange: (index: number, action: PersonExtractionAction) => void;
  onLinkChange: (index: number, personId: string) => void;
  onRoleChange: (index: number, role: Role) => void;
  onContextChange: (index: number, context: string) => void;
}

const PersonCard: React.FC<PersonCardProps> = ({
  person,
  index,
  existingPeople,
  onActionChange,
  onLinkChange,
  onRoleChange,
  onContextChange
}) => {
  const [showLinkDropdown, setShowLinkDropdown] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  
  // Get suggested match details
  const suggestedMatch = person.suggestedMatchId 
    ? existingPeople.find(p => p.id === person.suggestedMatchId)
    : null;
  
  // Filter existing people for dropdown
  const filteredPeople = existingPeople.filter(p => 
    p.fullName.toLowerCase().includes(linkSearch.toLowerCase())
  );
  
  // Get linked person details
  const linkedPerson = person.linkedPersonId 
    ? existingPeople.find(p => p.id === person.linkedPersonId)
    : null;

  const actionStyles = {
    create: 'border-emerald-500/50 bg-emerald-500/5',
    link: 'border-blue-500/50 bg-blue-500/5',
    skip: 'border-border bg-muted/30 opacity-60'
  };

  return (
    <div className={`p-4 rounded-lg border ${actionStyles[person.action]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-foreground">{person.name}</span>
            {person.matchScore && person.matchScore >= 0.8 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Match found
              </span>
            )}
            {person.matchScore && person.matchScore >= 0.6 && person.matchScore < 0.8 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Possible match
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">{person.context}</p>
          
          {/* Action Radio Buttons */}
          <div className="flex flex-wrap gap-4 mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`person-action-${index}`}
                checked={person.action === 'create'}
                onChange={() => onActionChange(index, 'create')}
                className="text-emerald-600 focus:ring-emerald-500"
              />
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-foreground">Create New</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`person-action-${index}`}
                checked={person.action === 'link'}
                onChange={() => onActionChange(index, 'link')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <Link2 className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-foreground">Link to Existing</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`person-action-${index}`}
                checked={person.action === 'skip'}
                onChange={() => onActionChange(index, 'skip')}
                className="text-muted-foreground focus:ring-muted"
              />
              <SkipForward className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Skip</span>
            </label>
          </div>
          
          {/* Link to Existing - Dropdown */}
          {person.action === 'link' && (
            <div className="space-y-2">
              <div className="relative">
                <button
                  onClick={() => setShowLinkDropdown(!showLinkDropdown)}
                  className="w-full px-3 py-2 text-left rounded-md border border-input bg-background text-foreground flex items-center justify-between"
                >
                  {linkedPerson ? (
                    <span>{linkedPerson.fullName} <span className="text-muted-foreground">({linkedPerson.role})</span></span>
                  ) : (
                    <span className="text-muted-foreground">Select existing person...</span>
                  )}
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                
                {showLinkDropdown && (
                  <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                    <div className="p-2 border-b border-border sticky top-0 bg-popover">
                      <input
                        type="text"
                        value={linkSearch}
                        onChange={(e) => setLinkSearch(e.target.value)}
                        placeholder="Search people..."
                        className="w-full px-2 py-1 text-sm rounded border border-input bg-background"
                        autoFocus
                      />
                    </div>
                    <div className="p-1">
                      {filteredPeople.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-2 text-center">No matching people</p>
                      ) : (
                        filteredPeople.map(p => (
                          <button
                            key={p.id}
                            onClick={() => {
                              onLinkChange(index, p.id);
                              setShowLinkDropdown(false);
                              setLinkSearch('');
                            }}
                            className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-muted flex items-center justify-between ${
                              p.id === person.linkedPersonId ? 'bg-primary/10 text-primary' : ''
                            }`}
                          >
                            <span>{p.fullName}</span>
                            <span className="text-xs text-muted-foreground">{p.role}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Suggested match hint */}
              {suggestedMatch && person.linkedPersonId !== suggestedMatch.id && (
                <button
                  onClick={() => onLinkChange(index, suggestedMatch.id)}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Suggested: {suggestedMatch.fullName} ({Math.round((person.matchScore || 0) * 100)}% match)
                </button>
              )}
            </div>
          )}
          
          {/* Create New - Role & Context fields */}
          {person.action === 'create' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Role
                </label>
                <select
                  value={person.editedRole || person.suggestedRole}
                  onChange={(e) => onRoleChange(index, e.target.value as Role)}
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
                  onChange={(e) => onContextChange(index, e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground focus:ring-2 focus:ring-ring"
                  placeholder="e.g., Biological mother of Bryant, Brylee, Bryce"
                />
              </div>
            </div>
          )}
        </div>
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
