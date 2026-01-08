/**
 * Post-parse message deduplication utility
 * Detects when the AI parser incorrectly splits a single message into multiple messages
 * by checking for content overlap between adjacent messages with identical timestamps
 */

import type { ParsedMessage } from './parsers';

export interface DeduplicationResult {
  messages: ParsedMessage[];
  mergedCount: number;
  warnings: string[];
}

/**
 * Normalize text for comparison by removing extra whitespace and punctuation variations
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Check if two timestamps are effectively the same (within a few seconds or identical)
 */
function isSameTimestamp(a: Date, b: Date): boolean {
  const diffMs = Math.abs(a.getTime() - b.getTime());
  return diffMs < 5000; // Within 5 seconds = same message timestamp
}

/**
 * Deduplicate parsed messages by detecting content overlap
 * 
 * This catches cases where the AI parser incorrectly splits a single email/message
 * into multiple messages (e.g., treating "Thank you for asking that." as a new message start)
 * 
 * Logic:
 * 1. Sort messages by timestamp, then by text length (longest first)
 * 2. For adjacent messages with same sender and same timestamp:
 *    - Check if the shorter message's text is contained in the longer message
 *    - If so, discard the shorter message (it's a false split)
 */
export function deduplicateParsedMessages(
  messages: ParsedMessage[]
): DeduplicationResult {
  if (messages.length <= 1) {
    return { messages, mergedCount: 0, warnings: [] };
  }

  const warnings: string[] = [];
  let mergedCount = 0;

  // Sort by timestamp first, then by body length descending
  const sorted = [...messages].sort((a, b) => {
    const timeDiff = a.sentAt.getTime() - b.sentAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    // Same timestamp: put longer messages first
    return b.body.length - a.body.length;
  });

  const deduplicated: ParsedMessage[] = [];
  const discardedIndices = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (discardedIndices.has(i)) continue;

    const current = sorted[i];
    const currentNormalized = normalizeText(current.body);

    // Check subsequent messages for overlap
    for (let j = i + 1; j < sorted.length; j++) {
      if (discardedIndices.has(j)) continue;

      const candidate = sorted[j];

      // Only check messages with same sender and same timestamp
      if (current.senderName.toLowerCase() !== candidate.senderName.toLowerCase()) continue;
      if (!isSameTimestamp(current.sentAt, candidate.sentAt)) continue;

      const candidateNormalized = normalizeText(candidate.body);

      // Check if candidate's text is a subset of current's text
      if (currentNormalized.includes(candidateNormalized)) {
        // The candidate is a subset - discard it
        discardedIndices.add(j);
        mergedCount++;
        warnings.push(
          `Discarded duplicate fragment from ${candidate.senderName} at ${candidate.sentAt.toISOString()}: "${candidate.body.substring(0, 50)}..."`
        );
      }
    }

    deduplicated.push(current);
  }

  // Re-sort by timestamp to restore chronological order
  deduplicated.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());

  return {
    messages: deduplicated,
    mergedCount,
    warnings
  };
}
