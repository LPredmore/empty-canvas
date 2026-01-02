// Contribution type display helpers for issue-person attribution

export type ContributionType = 
  | 'primary_contributor'
  | 'affected_party'
  | 'secondary_contributor'
  | 'resolver'
  | 'enabler'
  | 'witness'
  | 'involved';

export type ContributionValence = 'positive' | 'negative' | 'neutral' | 'mixed';

export const CONTRIBUTION_TYPE_LABELS: Record<string, string> = {
  primary_contributor: 'Primary Contributor',
  affected_party: 'Affected Party',
  secondary_contributor: 'Secondary Contributor',
  resolver: 'Resolver',
  enabler: 'Enabler',
  witness: 'Witness',
  involved: 'Involved'
};

export const CONTRIBUTION_TYPE_COLORS: Record<string, string> = {
  primary_contributor: 'bg-red-100 text-red-800 border-red-200',
  affected_party: 'bg-blue-100 text-blue-800 border-blue-200',
  secondary_contributor: 'bg-orange-100 text-orange-800 border-orange-200',
  resolver: 'bg-green-100 text-green-800 border-green-200',
  enabler: 'bg-amber-100 text-amber-800 border-amber-200',
  witness: 'bg-slate-100 text-slate-700 border-slate-200',
  involved: 'bg-slate-100 text-slate-600 border-slate-200'
};

export const VALENCE_ICONS: Record<ContributionValence, { icon: string; color: string }> = {
  positive: { icon: '↑', color: 'text-green-600' },
  negative: { icon: '↓', color: 'text-red-600' },
  neutral: { icon: '—', color: 'text-slate-400' },
  mixed: { icon: '↕', color: 'text-amber-600' }
};

export const FLAG_TYPE_LABELS: Record<string, string> = {
  // Existing types
  agreement_violation: 'Agreement Violation',
  concerning_language: 'Concerning Language',
  manipulation_tactic: 'Manipulation Tactic',
  positive_cooperation: 'Positive Cooperation',
  // Expanded types
  misrepresenting_guidance: 'Misrepresenting Guidance',
  selective_response: 'Selective Response',
  deflection_tactic: 'Deflection',
  accountability_avoidance: 'Avoiding Accountability',
  documentation_resistance: 'Documentation Resistance',
  gaslighting_indicator: 'Gaslighting Indicator',
  unilateral_decision: 'Unilateral Decision',
  boundary_violation: 'Boundary Violation',
  parental_alienation_indicator: 'Alienation Indicator',
  scheduling_obstruction: 'Scheduling Obstruction',
  financial_non_compliance: 'Financial Non-Compliance',
  communication_stonewalling: 'Stonewalling',
  false_equivalence: 'False Equivalence',
  context_shifting: 'Context Shifting',
  professional_recommendation_ignored: 'Ignoring Professional Advice'
};

export const FLAG_SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200'
};

export function getContributionLabel(type?: string): string {
  if (!type) return 'Involved';
  return CONTRIBUTION_TYPE_LABELS[type] || 'Involved';
}

export function getContributionBadgeStyle(type?: string, valence?: string): string {
  if (!type) return CONTRIBUTION_TYPE_COLORS.involved;
  
  // For primary contributors with negative valence, add emphasis
  if (valence === 'negative' && type === 'primary_contributor') {
    return 'bg-red-100 text-red-800 border border-red-300 font-semibold';
  }
  
  return CONTRIBUTION_TYPE_COLORS[type] || CONTRIBUTION_TYPE_COLORS.involved;
}

export function getFlagLabel(type?: string): string {
  if (!type) return 'Flag';
  return FLAG_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function getFlagSeverityStyle(severity?: string): string {
  if (!severity) return FLAG_SEVERITY_COLORS.low;
  return FLAG_SEVERITY_COLORS[severity] || FLAG_SEVERITY_COLORS.low;
}
