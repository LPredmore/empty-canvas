import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { 
  ConversationAnalysis, 
  TopicCategory, 
  Issue, 
  RelatedConversationDiscovery,
  Conversation
} from '../types';
import { 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2,
  Clock,
  MessageSquare,
  Link as LinkIcon,
  FileText,
  Users,
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ConversationAnalysisPanelProps {
  conversationId: string;
  conversation: Conversation;
  analysis: ConversationAnalysis | null;
  linkedIssues: Array<{ issueId: string; reason?: string }>;
  issues: Issue[];
  onRefreshAnalysis?: () => Promise<void>;
  isRefreshing?: boolean;
}

const TONE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  cooperative: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/30' },
  neutral: { bg: 'bg-slate-500/10', text: 'text-slate-600', border: 'border-slate-500/30' },
  contentious: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/30' },
  hostile: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/30' }
};

export const ConversationAnalysisPanel: React.FC<ConversationAnalysisPanelProps> = ({
  conversationId,
  conversation,
  analysis,
  linkedIssues,
  issues,
  onRefreshAnalysis,
  isRefreshing = false
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [topicCategories, setTopicCategories] = useState<TopicCategory[]>([]);
  const [relatedConversations, setRelatedConversations] = useState<RelatedConversationDiscovery[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  useEffect(() => {
    api.getTopicCategories().then(setTopicCategories);
  }, []);

  useEffect(() => {
    if (analysis && conversationId) {
      setLoadingRelated(true);
      api.discoverRelatedConversations(conversationId)
        .then(setRelatedConversations)
        .finally(() => setLoadingRelated(false));
    }
  }, [conversationId, analysis?.id]);

  const getCategoryDisplayName = (slug: string): string => {
    const category = topicCategories.find(c => c.slug === slug);
    return category?.displayName || slug.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const linkedIssueDetails = linkedIssues
    .map(link => issues.find(i => i.id === link.issueId))
    .filter(Boolean) as Issue[];

  const isStale = analysis && conversation.updatedAt && 
    new Date(analysis.createdAt) < new Date(conversation.updatedAt);

  const toneStyle = analysis ? TONE_COLORS[analysis.overallTone] || TONE_COLORS.neutral : TONE_COLORS.neutral;

  // No analysis available state
  if (!analysis) {
    return (
      <div className="bg-muted/30 border border-border rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">AI Analysis</span>
            <span className="text-sm">— Not yet analyzed</span>
          </div>
          {onRefreshAnalysis && (
            <button
              onClick={onRefreshAnalysis}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Analyze Conversation
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg mb-4 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">AI Analysis</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${toneStyle.bg} ${toneStyle.text} ${toneStyle.border}`}>
            {analysis.overallTone}
          </span>
          {isStale && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              May be outdated
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Summary */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Summary</h4>
            <p className="text-sm text-foreground leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Topic Categories */}
          {analysis.topicCategorySlugs.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.topicCategorySlugs.map(slug => (
                  <span 
                    key={slug}
                    className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium"
                  >
                    {getCategoryDisplayName(slug)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key Topics */}
          {analysis.keyTopics.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Key Topics</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.keyTopics.map((topic, i) => (
                  <span 
                    key={i}
                    className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Linked Issues */}
          {linkedIssueDetails.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Linked Issues ({linkedIssueDetails.length})
              </h4>
              <div className="space-y-1">
                {linkedIssueDetails.map(issue => (
                  <Link
                    key={issue.id}
                    to={`/issues/${issue.id}`}
                    className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      issue.priority === 'high' ? 'bg-red-500' :
                      issue.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-400'
                    }`} />
                    {issue.title}
                    <span className="text-xs text-muted-foreground">({issue.status})</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Agreement Violations */}
          {analysis.agreementViolations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                Agreement Violations ({analysis.agreementViolations.length})
              </h4>
              <div className="space-y-2">
                {analysis.agreementViolations.map((v: any, i: number) => (
                  <div key={i} className="text-sm p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <span className="font-medium text-amber-700">{v.violationType}</span>
                    <p className="text-amber-900/80 mt-0.5">{v.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Conversations */}
          {loadingRelated ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Finding related conversations...
            </div>
          ) : relatedConversations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <LinkIcon className="w-3 h-3" />
                Related Conversations ({relatedConversations.length})
              </h4>
              <div className="space-y-2">
                {relatedConversations.map(related => (
                  <Link
                    key={related.conversationId}
                    to={`/conversations/${related.conversationId}`}
                    className="block p-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{related.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {related.dateRange.start && format(new Date(related.dateRange.start), 'MMM d')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {related.relationshipTypes.map(type => (
                        <span 
                          key={type}
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            type === 'shared_issue' ? 'bg-red-500/10 text-red-600' :
                            type === 'agreement_source' ? 'bg-blue-500/10 text-blue-600' :
                            'bg-slate-500/10 text-slate-600'
                          }`}
                        >
                          {type === 'shared_issue' ? 'Shared Issue' :
                           type === 'agreement_source' ? 'Agreement Link' :
                           type === 'shared_category' ? 'Same Topic' : type}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Analyzed {format(new Date(analysis.createdAt), 'MMM d, yyyy h:mm a')}
            </span>
            {onRefreshAnalysis && (
              <button
                onClick={onRefreshAnalysis}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium disabled:opacity-50"
              >
                {isRefreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh Analysis
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
