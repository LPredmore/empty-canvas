import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../services/api';
import { 
  AgreementSourceType, 
  AgreementStatus, 
  AgreementItem,
  TopicCategory
} from '../types';
import { format } from 'date-fns';

interface AgreementItemForm {
  id: string;
  topic: string;
  fullText: string;
  summary: string;
  overridesExisting: boolean;
  overridesItemId: string;
  contingencyCondition: string;
  expanded: boolean;
}

interface RecordAgreementModalProps {
  isOpen: boolean;
  existingItems: AgreementItem[];
  onClose: () => void;
  onConfirm: () => void;
}

const SOURCE_TYPE_OPTIONS: { value: AgreementSourceType; label: string }[] = [
  { value: AgreementSourceType.TherapySession, label: 'Therapy Session' },
  { value: AgreementSourceType.Email, label: 'Email' },
  { value: AgreementSourceType.OFW, label: 'OFW' },
  { value: AgreementSourceType.Meeting, label: 'Meeting' },
  { value: AgreementSourceType.Other, label: 'Other' },
];

const STATUS_OPTIONS: { value: AgreementStatus; label: string }[] = [
  { value: AgreementStatus.Agreed, label: 'Agreed' },
  { value: AgreementStatus.Proposed, label: 'Proposed' },
  { value: AgreementStatus.Disputed, label: 'Disputed' },
];

const createEmptyItem = (): AgreementItemForm => ({
  id: crypto.randomUUID(),
  topic: '',
  fullText: '',
  summary: '',
  overridesExisting: false,
  overridesItemId: '',
  contingencyCondition: '',
  expanded: true,
});

export const RecordAgreementModal: React.FC<RecordAgreementModalProps> = ({
  isOpen,
  existingItems,
  onClose,
  onConfirm,
}) => {
  // Agreement metadata state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceType, setSourceType] = useState<AgreementSourceType>(AgreementSourceType.Meeting);
  const [sourceReference, setSourceReference] = useState('');
  const [status, setStatus] = useState<AgreementStatus>(AgreementStatus.Agreed);
  const [agreedDate, setAgreedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Agreement items state
  const [items, setItems] = useState<AgreementItemForm[]>([createEmptyItem()]);

  // Topic categories from database
  const [topicCategories, setTopicCategories] = useState<TopicCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch categories on mount
  useEffect(() => {
    setLoadingCategories(true);
    api.getTopicCategories()
      .then(setTopicCategories)
      .finally(() => setLoadingCategories(false));
  }, []);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setSourceType(AgreementSourceType.Meeting);
      setSourceReference('');
      setStatus(AgreementStatus.Agreed);
      setAgreedDate(format(new Date(), 'yyyy-MM-dd'));
      setItems([createEmptyItem()]);
      setError(null);
    }
  }, [isOpen]);

  const updateItem = (id: string, updates: Partial<AgreementItemForm>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const addItem = () => {
    setItems(prev => [...prev.map(i => ({ ...i, expanded: false })), createEmptyItem()]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const toggleItemExpanded = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, expanded: !item.expanded } : item
    ));
  };

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    const validItems = items.filter(i => i.topic.trim() && i.fullText.trim());
    if (validItems.length === 0) {
      setError('At least one item with topic and text is required');
      return;
    }

    // Check override selections
    for (const item of validItems) {
      if (item.overridesExisting && !item.overridesItemId) {
        setError('Please select an existing agreement to override, or uncheck "Overrides Existing"');
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      await api.createManualAgreement(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          sourceType,
          sourceReference: sourceReference.trim() || undefined,
          status,
          agreedDate: agreedDate || undefined,
        },
        validItems.map(item => ({
          topic: item.topic.trim(),
          fullText: item.fullText.trim(),
          summary: item.summary.trim() || undefined,
          overridesItemId: item.overridesExisting ? item.overridesItemId : undefined,
          contingencyCondition: item.contingencyCondition.trim() || undefined,
        }))
      );

      onConfirm();
    } catch (e: any) {
      console.error('Failed to save agreement:', e);
      setError(e.message || 'Failed to save agreement');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const isValid = title.trim() && items.some(i => i.topic.trim() && i.fullText.trim());

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Record New Agreement</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Agreement Metadata */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Agreement Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Title <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Holiday Schedule Modification 2024"
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this agreement..."
                rows={2}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Source Type <span className="text-destructive">*</span>
                </label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as AgreementSourceType)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {SOURCE_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Status <span className="text-destructive">*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AgreementStatus)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Source Reference
                </label>
                <input
                  type="text"
                  value={sourceReference}
                  onChange={(e) => setSourceReference(e.target.value)}
                  placeholder="e.g., Session with Dr. Smith"
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Agreed Date
                </label>
                <input
                  type="date"
                  value={agreedDate}
                  onChange={(e) => setAgreedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Agreement Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Agreement Items</h3>
              <button
                onClick={addItem}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="border border-border rounded-lg bg-muted/30"
                >
                  {/* Item Header */}
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer"
                    onClick={() => toggleItemExpanded(item.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Item {index + 1}
                      </span>
                      {item.topic && (
                        <span className="text-sm text-foreground">— {item.topic}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {items.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {item.expanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Item Content */}
                  {item.expanded && (
                    <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Topic <span className="text-destructive">*</span>
                          </label>
                          <select
                            value={item.topic}
                            onChange={(e) => updateItem(item.id, { topic: e.target.value })}
                            className="w-full px-2 py-1.5 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">Select topic...</option>
                            {loadingCategories ? (
                              <option disabled>Loading...</option>
                            ) : (
                              topicCategories.map(cat => (
                                <option key={cat.slug} value={cat.displayName}>{cat.displayName}</option>
                              ))
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Summary
                          </label>
                          <input
                            type="text"
                            value={item.summary}
                            onChange={(e) => updateItem(item.id, { summary: e.target.value })}
                            placeholder="Brief summary..."
                            className="w-full px-2 py-1.5 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Full Text <span className="text-destructive">*</span>
                        </label>
                        <textarea
                          value={item.fullText}
                          onChange={(e) => updateItem(item.id, { fullText: e.target.value })}
                          placeholder="The complete text of this agreement item..."
                          rows={3}
                          className="w-full px-2 py-1.5 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                      </div>

                      {/* Override Section */}
                      <div className="border-t border-border pt-3 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.overridesExisting}
                            onChange={(e) => updateItem(item.id, { 
                              overridesExisting: e.target.checked,
                              overridesItemId: e.target.checked ? item.overridesItemId : ''
                            })}
                            className="rounded border-input"
                          />
                          <span className="text-sm text-foreground">Overrides an existing agreement</span>
                        </label>

                        {item.overridesExisting && (
                          <div className="ml-6 space-y-2">
                            <select
                              value={item.overridesItemId}
                              onChange={(e) => updateItem(item.id, { overridesItemId: e.target.value })}
                              className="w-full px-2 py-1.5 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              <option value="">Select existing agreement...</option>
                              {existingItems
                                .filter(ei => ei.isActive)
                                .map(ei => (
                                  <option key={ei.id} value={ei.id}>
                                    {ei.topic}: {ei.summary || ei.fullText.slice(0, 50)}...
                                  </option>
                                ))
                              }
                            </select>

                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Contingency Condition
                              </label>
                              <input
                                type="text"
                                value={item.contingencyCondition}
                                onChange={(e) => updateItem(item.id, { contingencyCondition: e.target.value })}
                                placeholder="e.g., Until court order changes, For summer 2024 only..."
                                className="w-full px-2 py-1.5 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isValid}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Agreement'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
