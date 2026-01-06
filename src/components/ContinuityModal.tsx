import React from 'react';
import { FirstSentenceMatch } from '../types/continuity';
import { GitMerge, Plus, X, MessageSquare, Calendar, Users, Search } from 'lucide-react';
import { format } from 'date-fns';

interface ContinuityModalProps {
  isOpen: boolean;
  match: FirstSentenceMatch | null;
  newMessageCount: number;
  participantNames: string[];
  onAppendToConversation: () => void;
  onCreateSeparate: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ContinuityModal: React.FC<ContinuityModalProps> = ({
  isOpen,
  match,
  newMessageCount,
  participantNames,
  onAppendToConversation,
  onCreateSeparate,
  onCancel,
  loading = false
}) => {
  if (!isOpen || !match) return null;

  // Truncate matched sentence for display
  const displaySentence = match.matchedSentence.length > 80 
    ? match.matchedSentence.substring(0, 80) + '...'
    : match.matchedSentence;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <GitMerge className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Continuation Detected
              </h2>
              <p className="text-sm text-slate-600">
                Your upload appears to continue an existing conversation
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Matched sentence highlight */}
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2 text-sm">
              <Search className="w-4 h-4" />
              Matched Text
            </h4>
            <p className="text-sm text-amber-900 italic">
              "{displaySentence}"
            </p>
          </div>

          {/* Matched conversation info */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              {match.conversation.title}
            </h3>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {match.conversation.startedAt && 
                    format(new Date(match.conversation.startedAt), 'MMM d')}
                  {match.conversation.endedAt && 
                    ` - ${format(new Date(match.conversation.endedAt), 'MMM d, yyyy')}`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Users className="w-3.5 h-3.5" />
                <span>{participantNames.slice(0, 2).join(', ')}</span>
              </div>
            </div>

            <div className="mt-3 text-sm text-slate-500">
              {match.existingMessageCount} messages currently
            </div>
          </div>

          {/* Analysis */}
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
            <h4 className="font-medium text-indigo-800 mb-2">
              What will happen
            </h4>
            <ul className="space-y-1 text-sm text-indigo-700">
              <li>• Messages up to the matched text will be <strong>skipped</strong> (already exist)</li>
              <li>• <strong>{newMessageCount}</strong> new message{newMessageCount !== 1 ? 's' : ''} will be appended</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={onAppendToConversation}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
            >
              <GitMerge className="w-4 h-4" />
              {loading ? 'Appending...' : `Append ${newMessageCount} Message${newMessageCount !== 1 ? 's' : ''}`}
            </button>
            
            <button
              onClick={onCreateSeparate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Separate Conversation
            </button>
            
            <button
              onClick={onCancel}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-700 transition-colors text-sm"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
