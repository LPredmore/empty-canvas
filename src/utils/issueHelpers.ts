/**
 * Utility functions for issue title normalization and matching
 */

/**
 * Normalize an issue title for comparison and storage
 * - Trims whitespace
 * - Collapses multiple spaces to single space
 * - Does NOT lowercase (DB index handles that)
 */
export function normalizeIssueTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Check if two issue titles are effectively the same
 * (case-insensitive, whitespace-normalized)
 */
export function titlesMatch(a: string, b: string): boolean {
  return normalizeIssueTitle(a).toLowerCase() === 
         normalizeIssueTitle(b).toLowerCase();
}
