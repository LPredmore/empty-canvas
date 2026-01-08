import { ConversationAnalysisResult } from '../types/analysisTypes';
import { supabase } from '../lib/supabase';
import { MutableRefObject } from 'react';

export interface AnalysisProgress {
  stage: string;
  stageName: string;
  stageNumber: number;
  totalStages: number;
  isComplete: boolean;
  error?: string;
}

export interface PipelineOptions {
  onProgress: (progress: AnalysisProgress) => void;
  onComplete: (result: ConversationAnalysisResult) => void;
  onError: (error: string, stage?: string) => void;
  signal?: AbortSignal;
  isMountedRef?: MutableRefObject<boolean>;
}

const SUPABASE_URL = 'https://nukdhsxnaonzsskmchov.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51a2Roc3huYW9uenNza21jaG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzOTMxODMsImV4cCI6MjA4MDk2OTE4M30.VutXcj1hr5qFv11sfgClStxfgS0KtLL4mI7v0bHvLcY';

/**
 * Runs the multi-stage analysis pipeline with SSE progress streaming.
 * Handles connection, parsing SSE events, and invoking callbacks.
 */
export async function runPipelineAnalysis(
  requestBody: Record<string, unknown>,
  options: PipelineOptions
): Promise<void> {
  const { onProgress, onComplete, onError, signal, isMountedRef } = options;
  
  // Helper to check if component is still mounted
  const shouldContinue = () => !isMountedRef || isMountedRef.current;

  try {
    // Ensure fresh token before long-running operation
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/analyze-conversation-pipeline`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify(requestBody),
        signal
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pipeline request failed: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Check if aborted or unmounted
      if (signal?.aborted || !shouldContinue()) {
        reader.cancel();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        
        try {
          const event = JSON.parse(line.slice(6));
          
          if (!shouldContinue()) return;

          switch (event.type) {
            case 'stage_start':
              onProgress({
                stage: event.stage,
                stageName: event.stageName || event.stage,
                stageNumber: event.stageNumber || 0,
                totalStages: event.totalStages || 8,
                isComplete: false
              });
              break;
              
            case 'stage_complete':
              // Could update progress to show completion, but we'll get stage_start for next
              break;
              
            case 'complete':
              onComplete(event.result);
              return;
              
            case 'error':
            case 'stage_error':
              onError(event.message, event.stage);
              return;
          }
        } catch (parseError) {
          console.warn('Failed to parse SSE event:', line, parseError);
        }
      }
    }
  } catch (error: unknown) {
    // Don't report abort as error
    if (signal?.aborted) return;
    
    if (shouldContinue()) {
      onError(error instanceof Error ? error.message : 'Analysis failed');
    }
  }
}
