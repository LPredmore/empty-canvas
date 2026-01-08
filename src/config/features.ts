/**
 * Feature flags for gradual rollout of new functionality.
 * Use environment variables to enable/disable features without code changes.
 */
export const FEATURES = {
  /**
   * Enable the multi-stage SSE analysis pipeline.
   * When false, uses the legacy single-call analyze-conversation-import function.
   */
  USE_ANALYSIS_PIPELINE: import.meta.env.VITE_USE_ANALYSIS_PIPELINE === 'true'
};
