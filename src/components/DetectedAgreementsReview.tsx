import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AgreementItem } from '../types';
import { DetectedAgreement } from '../types/analysisTypes';
import { 
  Handshake, ChevronDown, ChevronUp, Check, X, 
  AlertTriangle, Link2, Clock, MessageSquare, Loader2
} from 'lucide-react';

interface DetectedAgreementWithAction extends DetectedAgreement {
  action: 'confirm_new' | 'confirm_override' | 'dismiss';
  selectedOverrideItemId?: string;
  userContingencyCondition?: string;
}

interface DetectedAgreementsReviewProps {
  isOpen: boolean;
  detectedAgreements: DetectedAgreement[];
  conversationId: string;
  onComplete: (savedCount: number) => void;
  onSkip: () => void;
}

export const DetectedAgreementsReview: React.FC<DetectedAgreementsReviewProps> = ({
  isOpen,
  detectedAgreements,
  conversationId,
  onComplete,
  onSkip
}) => {
  const [agreements, setAgreements] = useState<DetectedAgreementWithAction[]>([]);
  const [existingItems, setExistingItems] = useState<AgreementItem[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);

  useEffect(() => {
    if (isOpen && detectedAgreements.length > 0) {
      // Initialize with default action based on confidence
      const initialized = detectedAgreements.map(a => ({
        ...a,
        action: a.confidence === 'high' ? 'confirm_new' : 'dismiss',
        selectedOverrideItemId: undefined,
        userContingencyCondition: a.conditionText || undefined
      } as DetectedAgreementWithAction));
      setAgreements(initialized);
      
      // Load existing agreement items to allow override selection
      loadExistingItems();
    }
  }, [isOpen, detectedAgreements]);

  const loadExistingItems = async () => {
    setLoadingItems(true);
    try {
      const items = await api.getAgreementItemsWithOverrideInfo();
      setExistingItems(items.filter(i => i.isActive));
    } catch (e) {
      console.error('Failed to load existing items:', e);
    } finally {
      setLoadingItems(false);
    }
  };

  const updateAgreement = (index: number, updates: Partial<DetectedAgreementWithAction>) => {
    setAgreements(prev => prev.map((a, i) => i === index ? { ...a, ...updates } : a));
  };

  const handleSave = async () => {
    setSaving(true);
    let savedCount = 0;

    try {
      // Get or create the "Conversation Agreements" agreement
      const parentAgreement = await api.getOrCreateConversationAgreement();

      for (const agreement of agreements) {
        if (agreement.action === 'dismiss') continue;

        try {
          await api.createAgreementItemFromConversation(parentAgreement.id, {
            topic: agreement.topic,
            summary: agreement.summary,
            fullText: agreement.fullText,
            overridesItemId: agreement.action === 'confirm_override' ? agreement.selectedOverrideItemId : undefined,
            contingencyCondition: agreement.userContingencyCondition,
            sourceConversationId: conversationId,
            sourceMessageId: agreement.messageIds[0]
          });
          savedCount++;
        } catch (e) {
          console.error('Failed to save agreement:', e);
        }
      }

      onComplete(savedCount);
    } catch (e) {
      console.error('Failed to save agreements:', e);
      onComplete(savedCount);
    } finally {
      setSaving(false);
    }
  };

  const getMatchingItems = (topics: string[]): AgreementItem[] => {
    if (topics.length === 0) return existingItems;
    return existingItems.filter(item => 
      topics.some(topic => 
        item.topic.toLowerCase().includes(topic.toLowerCase()) ||
        topic.toLowerCase().includes(item.topic.toLowerCase())
      )
    );
  };

  const confirmedCount = agreements.filter(a => a.action !== 'dismiss').length;

  if (!isOpen || detectedAgreements.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <Handshake className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">New Agreements Detected</h2>
              <p className="text-sm text-muted-foreground">
                Review {detectedAgreements.length} potential agreement{detectedAgreements.length > 1 ? 's' : ''} found in this conversation
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loadingItems ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            agreements.map((agreement, index) => (
              <div 
                key={index} 
                className={`border rounded-lg overflow-hidden transition-all ${
                  agreement.action === 'dismiss' 
                    ? 'border-border bg-muted/30 opacity-60' 
                    : 'border-primary/30 bg-card'
                }`}
              >
                {/* Agreement Header */}
                <div 
                  className="p-4 cursor-pointer flex items-start justify-between gap-4"
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        agreement.confidence === 'high' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                          : agreement.confidence === 'medium'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {agreement.confidence} confidence
                      </span>
                      {agreement.isTemporary && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" /> Temporary
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-foreground">{agreement.topic}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">{agreement.summary}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {agreement.action !== 'dismiss' && (
                      <Check className="w-5 h-5 text-emerald-500" />
                    )}
                    {expandedIndex === index ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedIndex === index && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                    {/* Full Text Quote */}
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <MessageSquare className="w-3 h-3" />
                        Quoted from conversation
                      </div>
                      <p className="text-sm italic text-foreground">"{agreement.fullText}"</p>
                    </div>

                    {/* AI Reasoning */}
                    <div className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Reasoning:</strong> {agreement.reasoning}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); updateAgreement(index, { action: 'confirm_new' }); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                          agreement.action === 'confirm_new'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        Confirm as New
                      </button>
                      
                      <button
                        onClick={(e) => { e.stopPropagation(); updateAgreement(index, { action: 'confirm_override' }); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                          agreement.action === 'confirm_override'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        <Link2 className="w-4 h-4" />
                        Overrides Existing
                      </button>
                      
                      <button
                        onClick={(e) => { e.stopPropagation(); updateAgreement(index, { action: 'dismiss' }); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                          agreement.action === 'dismiss'
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        <X className="w-4 h-4" />
                        Not an Agreement
                      </button>
                    </div>

                    {/* Override Selection */}
                    {agreement.action === 'confirm_override' && (
                      <div className="space-y-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <label className="block text-sm font-medium text-foreground">
                          Select which existing agreement this overrides:
                        </label>
                        <select
                          value={agreement.selectedOverrideItemId || ''}
                          onChange={(e) => updateAgreement(index, { selectedOverrideItemId: e.target.value || undefined })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary outline-none"
                        >
                          <option value="">Select an existing agreement...</option>
                          {getMatchingItems(agreement.potentialOverrideTopics).map(item => (
                            <option key={item.id} value={item.id}>
                              {item.topic}: {item.summary?.substring(0, 60) || item.fullText.substring(0, 60)}...
                            </option>
                          ))}
                        </select>
                        
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            Contingency condition (optional):
                          </label>
                          <input
                            type="text"
                            value={agreement.userContingencyCondition || ''}
                            onChange={(e) => updateAgreement(index, { userContingencyCondition: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="e.g., 'Valid until court modifies parenting plan'"
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary outline-none"
                          />
                        </div>

                        {!agreement.selectedOverrideItemId && (
                          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                            <AlertTriangle className="w-4 h-4" />
                            Please select an agreement to override
                          </div>
                        )}
                      </div>
                    )}

                    {/* Condition for non-override */}
                    {agreement.action === 'confirm_new' && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Condition or notes (optional):
                        </label>
                        <input
                          type="text"
                          value={agreement.userContingencyCondition || ''}
                          onChange={(e) => updateAgreement(index, { userContingencyCondition: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="e.g., 'For summer 2024 only'"
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 flex justify-between items-center">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Skip All
          </button>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {confirmedCount} of {agreements.length} will be saved
            </span>
            <button
              onClick={handleSave}
              disabled={saving || (confirmedCount > 0 && agreements.some(a => 
                a.action === 'confirm_override' && !a.selectedOverrideItemId
              ))}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save {confirmedCount > 0 ? `${confirmedCount} Agreement${confirmedCount > 1 ? 's' : ''}` : 'Changes'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
