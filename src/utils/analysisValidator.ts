import { ConversationAnalysisResult } from '../types/analysisTypes';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized: ConversationAnalysisResult;
}

/**
 * Validates and sanitizes AI-generated analysis results.
 * Provides safe defaults for missing fields to prevent downstream failures.
 */
export function validateAndSanitizeAnalysisResult(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const result = raw as Partial<ConversationAnalysisResult>;

  // Validate required conversationAnalysis
  if (!result.conversationAnalysis) {
    errors.push('Missing conversationAnalysis');
  } else {
    if (!result.conversationAnalysis.summary) {
      warnings.push('Missing conversationAnalysis.summary - using default');
    }
    if (!result.conversationAnalysis.overallTone) {
      warnings.push('Missing conversationAnalysis.overallTone - using neutral');
    }
  }

  // Validate issueActions have required fields
  const validIssueActions = (result.issueActions || []).filter((action, index) => {
    if (!action.title) {
      warnings.push(`issueActions[${index}] missing title, skipped`);
      return false;
    }
    // Filter out invalid personContributions
    if (action.personContributions) {
      action.personContributions = action.personContributions.filter(pc =>
        pc.personId && pc.contributionType && pc.contributionDescription
      );
    }
    return true;
  });

  // Validate personAnalyses have required personId
  const validPersonAnalyses = (result.personAnalyses || []).filter((pa, index) => {
    if (!pa.personId) {
      warnings.push(`personAnalyses[${index}] missing personId, skipped`);
      return false;
    }
    return true;
  });

  // Validate messageAnnotations have required fields
  const validMessageAnnotations = (result.messageAnnotations || []).filter((ma, index) => {
    if (!ma.messageId) {
      warnings.push(`messageAnnotations[${index}] missing messageId, skipped`);
      return false;
    }
    // Filter out flags without required fields
    if (ma.flags) {
      ma.flags = ma.flags.filter(flag => 
        flag.type && flag.attributedToPersonId && flag.description
      );
    }
    return true;
  });

  // Validate detectedAgreements have required fields
  const validDetectedAgreements = (result.detectedAgreements || []).filter((da, index) => {
    if (!da.topic || !da.summary) {
      warnings.push(`detectedAgreements[${index}] missing required fields, skipped`);
      return false;
    }
    return true;
  });

  // Build sanitized output with safe defaults
  const sanitized: ConversationAnalysisResult = {
    conversationAnalysis: {
      summary: result.conversationAnalysis?.summary || 'Analysis incomplete - some stages may have failed.',
      overallTone: result.conversationAnalysis?.overallTone || 'neutral',
      keyTopics: Array.isArray(result.conversationAnalysis?.keyTopics) 
        ? result.conversationAnalysis.keyTopics 
        : []
    },
    claimsLedger: Array.isArray(result.claimsLedger) ? result.claimsLedger : [],
    alternativeInterpretations: Array.isArray(result.alternativeInterpretations) 
      ? result.alternativeInterpretations 
      : [],
    missingContext: Array.isArray(result.missingContext) ? result.missingContext : [],
    conversationState: result.conversationState || { 
      status: 'open', 
      pendingResponderName: null, 
      reasoning: 'State detection incomplete' 
    },
    issueActions: validIssueActions,
    agreementViolations: Array.isArray(result.agreementViolations) 
      ? result.agreementViolations 
      : [],
    personAnalyses: validPersonAnalyses,
    messageAnnotations: validMessageAnnotations,
    detectedAgreements: validDetectedAgreements
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitized
  };
}
