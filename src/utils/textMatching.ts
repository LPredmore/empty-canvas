/**
 * Extracts and normalizes the first sentence from message text for continuity matching.
 * Returns empty string if the result is too short for reliable matching.
 */
export function extractFirstSentence(text: string): string {
  // Normalize whitespace and trim
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  
  if (!normalized) return '';
  
  // Find first sentence boundary (., !, ?, or take first 150 chars if no punctuation)
  const match = normalized.match(/^[^.!?]+[.!?]?/);
  const sentence = match ? match[0].trim() : normalized.substring(0, 150);
  
  // Return lowercase for case-insensitive matching
  // Minimum 20 chars for reliability - short sentences are too likely to match by accident
  return sentence.length >= 20 ? sentence.toLowerCase() : '';
}
