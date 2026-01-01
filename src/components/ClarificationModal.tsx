import React, { useState } from 'react';
import { X, Loader2, CheckCircle, Link as LinkIcon, HelpCircle } from 'lucide-react';
import { ClarificationQuestion, SuggestedRelationship } from '../types';

interface ClarificationModalProps {
  personName: string;
  questions: ClarificationQuestion[];
  suggestedRelationships: SuggestedRelationship[];
  enrichedContext: string;
  onConfirm: (answers: Record<string, string>, confirmedRelationships: SuggestedRelationship[]) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export const ClarificationModal: React.FC<ClarificationModalProps> = ({
  personName,
  questions,
  suggestedRelationships,
  enrichedContext,
  onConfirm,
  onCancel,
  isProcessing
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirmedRelationships, setConfirmedRelationships] = useState<SuggestedRelationship[]>(suggestedRelationships);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const toggleRelationship = (rel: SuggestedRelationship) => {
    setConfirmedRelationships(prev => {
      const exists = prev.some(r => r.relatedPersonId === rel.relatedPersonId && r.relationshipType === rel.relationshipType);
      if (exists) {
        return prev.filter(r => !(r.relatedPersonId === rel.relatedPersonId && r.relationshipType === rel.relationshipType));
      }
      return [...prev, rel];
    });
  };

  const isRelationshipConfirmed = (rel: SuggestedRelationship) => {
    return confirmedRelationships.some(r => r.relatedPersonId === rel.relatedPersonId && r.relationshipType === rel.relationshipType);
  };

  const allQuestionsAnswered = questions.every(q => answers[q.id]?.trim());

  const handleSubmit = () => {
    onConfirm(answers, confirmedRelationships);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Clarify: {personName}</h3>
            <p className="text-sm text-slate-500 mt-1">Help us understand this person's role</p>
          </div>
          <button onClick={onCancel} disabled={isProcessing}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Enriched Context Preview */}
          {enrichedContext && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-indigo-800">Understood as:</p>
                  <p className="text-sm text-indigo-700 mt-1">{enrichedContext}</p>
                </div>
              </div>
            </div>
          )}

          {/* Questions */}
          {questions.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-slate-800 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-slate-400" />
                Please clarify:
              </h4>
              {questions.map(q => (
                <div key={q.id} className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">{q.question}</label>
                  {q.type === 'select' && q.options ? (
                    <select
                      value={answers[q.id] || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">Select an option...</option>
                      {q.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={answers[q.id] || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Type your answer..."
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Suggested Relationships */}
          {suggestedRelationships.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-slate-800 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-slate-400" />
                Detected relationships:
              </h4>
              <div className="space-y-2">
                {suggestedRelationships.map((rel, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleRelationship(rel)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isRelationshipConfirmed(rel)
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{rel.description}</span>
                        <span className="text-sm"> for </span>
                        <span className="font-medium">{rel.relatedPersonName}</span>
                      </div>
                      {isRelationshipConfirmed(rel) && (
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">Click to toggle relationship confirmation</p>
            </div>
          )}

          {/* No questions or relationships */}
          {questions.length === 0 && suggestedRelationships.length === 0 && enrichedContext && (
            <div className="text-center py-4 text-slate-500">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p>Everything looks good! Ready to create this person.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 py-2 px-4 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing || (questions.length > 0 && !allQuestionsAnswered)}
            className="flex-1 py-2 px-4 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Person'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
