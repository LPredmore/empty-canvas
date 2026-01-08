/**
 * Normalizes text for reliable matching across different sources.
 * Handles smart quotes, dashes, whitespace variations that differ between parsers.
 */
export function normalizeTextForMatching(text: string): string {
  if (!text) return '';
  
  return text
    // Normalize smart quotes to straight quotes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // Smart single quotes → '
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')  // Smart double quotes → "
    // Normalize dashes
    .replace(/[\u2013\u2014\u2015]/g, '-')        // En-dash, em-dash → -
    // Normalize ellipsis
    .replace(/\u2026/g, '...')                     // … → ...
    // Normalize spaces (including non-breaking spaces)
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    // Remove spaces around apostrophes (handles "I ' m" → "I'm")
    .replace(/\s*'\s*/g, "'")
    // Collapse multiple spaces to single
    .replace(/\s+/g, ' ')
    // Trim
    .trim()
    // Lowercase for case-insensitive matching
    .toLowerCase();
}

/**
 * Extracts and normalizes the first sentence from message text for continuity matching.
 * Returns empty string if the result is too short for reliable matching.
 */
export function extractFirstSentence(text: string): string {
  const normalized = normalizeTextForMatching(text);
  
  if (!normalized) return '';
  
  // Find first sentence boundary (., !, ?, or take first 150 chars if no punctuation)
  const match = normalized.match(/^[^.!?]+[.!?]?/);
  const sentence = match ? match[0].trim() : normalized.substring(0, 150);
  
  // Minimum 20 chars for reliability - short sentences are too likely to match by accident
  return sentence.length >= 20 ? sentence : '';
}
