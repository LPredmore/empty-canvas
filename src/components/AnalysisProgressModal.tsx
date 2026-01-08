import { X } from 'lucide-react';
import { AnalysisProgress } from '../utils/sseAnalysisClient';

interface AnalysisProgressModalProps {
  isOpen: boolean;
  progress: AnalysisProgress | null;
  onCancel: () => void;
}

const STAGE_DESCRIPTIONS: Record<string, string> = {
  conversation_map: 'Understanding the conversation structure and key topics...',
  claims_verification: 'Verifying claims against documented evidence...',
  issue_linking: 'Connecting to existing behavioral issues...',
  issue_detection: 'Identifying new patterns and issues...',
  agreement_checks: 'Checking for agreement violations...',
  person_analysis: 'Analyzing participant communication patterns...',
  message_annotation: 'Flagging significant messages...',
  synthesis: 'Synthesizing final analysis and recommendations...'
};

export function AnalysisProgressModal({ 
  isOpen, 
  progress, 
  onCancel 
}: AnalysisProgressModalProps) {
  if (!isOpen) return null;

  const percentComplete = progress 
    ? Math.round((progress.stageNumber / progress.totalStages) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border border-border">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Analyzing Conversation
          </h3>
          <button 
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground p-1 transition-colors"
            title="Cancel analysis"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {progress && (
          <>
            <div className="mb-4">
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Stage {progress.stageNumber} of {progress.totalStages}</span>
                <span>{percentComplete}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
            </div>

            <div className="text-center">
              <p className="font-medium text-foreground">{progress.stageName}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {STAGE_DESCRIPTIONS[progress.stage] || 'Processing...'}
              </p>
            </div>
          </>
        )}

        {!progress && (
          <div className="text-center py-4">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-muted-foreground">Initializing analysis...</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-4">
          This may take 1-2 minutes for longer conversations
        </p>
      </div>
    </div>
  );
}
