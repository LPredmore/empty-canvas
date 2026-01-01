import React, { useState } from 'react';
import { X, Loader2, CheckCircle, Link as LinkIcon, MessageSquare, Send, User } from 'lucide-react';
import { ConversationTurn, SuggestedRelationship } from '../types';

interface ClarificationModalProps {
  personName: string;
  conversationHistory: ConversationTurn[];
  currentQuestion?: string;
  currentUnderstanding?: string;
  enrichedContext?: string;
  suggestedRelationships: SuggestedRelationship[];
  isComplete: boolean;
  isProcessing: boolean;
  onContinue: (answer: string) => void;
  onConfirm: (confirmedRelationships: SuggestedRelationship[]) => void;
  onCancel: () => void;
  onSkip: () => void;
}

export const ClarificationModal: React.FC<ClarificationModalProps> = ({
  personName,
  conversationHistory,
  currentQuestion,
  currentUnderstanding,
  enrichedContext,
  suggestedRelationships,
  isComplete,
  isProcessing,
  onContinue,
  onConfirm,
  onCancel,
  onSkip
}) => {
  const [answer, setAnswer] = useState('');
  const [confirmedRelationships, setConfirmedRelationships] = useState<SuggestedRelationship[]>(suggestedRelationships);

  // Update confirmed relationships when props change
  React.useEffect(() => {
    setConfirmedRelationships(suggestedRelationships);
  }, [suggestedRelationships]);

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

  const handleSubmitAnswer = () => {
    if (answer.trim()) {
      onContinue(answer.trim());
      setAnswer('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  const formatRelationshipType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Understanding: {personName}</h3>
            <p className="text-sm text-slate-500 mt-1">
              {isComplete ? 'Ready to create this person' : 'Help us understand their role'}
            </p>
          </div>
          <button onClick={onCancel} disabled={isProcessing}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Current Understanding */}
          {(currentUnderstanding || enrichedContext) && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-indigo-800">
                    {isComplete ? 'Final Understanding:' : 'Current Understanding:'}
                  </p>
                  <p className="text-sm text-indigo-700 mt-1">
                    {enrichedContext || currentUnderstanding}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Conversation History */}
          {conversationHistory.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-slate-800 flex items-center gap-2 text-sm">
                <MessageSquare className="w-4 h-4 text-slate-400" />
                Conversation
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {conversationHistory.map((turn, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="bg-slate-100 rounded-lg p-3 text-sm text-slate-700">
                      <span className="font-medium">Q:</span> {turn.question}
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 text-sm text-emerald-800 ml-4">
                      <span className="font-medium">A:</span> {turn.answer}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Question (if not complete) */}
          {!isComplete && currentQuestion && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-800">{currentQuestion}</p>
              </div>
              <div className="flex gap-2">
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isProcessing}
                  rows={2}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  placeholder="Type your answer..."
                />
                <button
                  onClick={handleSubmitAnswer}
                  disabled={isProcessing || !answer.trim()}
                  className="px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Suggested Relationships (show when complete or when there are suggestions) */}
          {suggestedRelationships.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-slate-800 flex items-center gap-2 text-sm">
                <LinkIcon className="w-4 h-4 text-slate-400" />
                Detected Relationships
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
                        <span className="font-medium">{formatRelationshipType(rel.relationshipType)}</span>
                        <span className="text-sm"> → </span>
                        <span className="font-medium">{rel.relatedPersonName}</span>
                        {rel.description && (
                          <p className="text-xs text-slate-500 mt-1">{rel.description}</p>
                        )}
                      </div>
                      {isRelationshipConfirmed(rel) && (
                        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">Click to toggle relationship confirmation</p>
            </div>
          )}

          {/* Ready to create message */}
          {isComplete && suggestedRelationships.length === 0 && (
            <div className="text-center py-4 text-slate-500">
              <User className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p>Ready to create this person!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 space-y-3">
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 py-2 px-4 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {isComplete ? (
              <button
                onClick={() => onConfirm(confirmedRelationships)}
                disabled={isProcessing}
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
            ) : (
              <button
                onClick={onSkip}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 rounded-lg bg-slate-600 text-white font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Skip & Create Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};