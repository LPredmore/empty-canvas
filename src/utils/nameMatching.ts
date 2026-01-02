/**
 * Fuzzy Name Matching Utilities
 * 
 * Provides functions to match extracted names against existing people
 * using various strategies including exact match, partial match, and 
 * Levenshtein distance.
 */

import { Person } from '../types';

export interface NameMatchResult {
  personId: string;
  personName: string;
  matchScore: number;
  matchType: 'exact' | 'normalized' | 'partial' | 'fuzzy';
}

/**
 * Normalize a name for comparison (lowercase, trim, collapse whitespace)
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Extract first and last name parts from a full name
 */
function getNameParts(fullName: string): { first: string; last: string; all: string[] } {
  const parts = normalizeName(fullName).split(' ').filter(p => p.length > 0);
  return {
    first: parts[0] || '',
    last: parts[parts.length - 1] || '',
    all: parts
  };
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two names (0-1)
 */
function nameSimilarity(name1: string, name2: string): number {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  if (n1 === n2) return 1;
  
  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 0;
  
  const distance = levenshteinDistance(n1, n2);
  return 1 - (distance / maxLen);
}

/**
 * Find the best matching existing person for an extracted name
 * Returns null if no good match found
 */
export function findBestMatch(
  extractedName: string,
  existingPeople: Person[],
  threshold: number = 0.6
): NameMatchResult | null {
  if (!extractedName || existingPeople.length === 0) {
    return null;
  }

  const normalizedExtracted = normalizeName(extractedName);
  const extractedParts = getNameParts(extractedName);
  
  let bestMatch: NameMatchResult | null = null;

  for (const person of existingPeople) {
    const normalizedExisting = normalizeName(person.fullName);
    const existingParts = getNameParts(person.fullName);
    
    // Check for exact match
    if (normalizedExtracted === normalizedExisting) {
      return {
        personId: person.id,
        personName: person.fullName,
        matchScore: 1,
        matchType: 'exact'
      };
    }
    
    // Check if extracted name is contained within existing (e.g., "Allison" matches "Allison Wilson")
    if (normalizedExisting.includes(normalizedExtracted) || normalizedExtracted.includes(normalizedExisting)) {
      const score = Math.min(normalizedExtracted.length, normalizedExisting.length) / 
                    Math.max(normalizedExtracted.length, normalizedExisting.length);
      if (score > 0.5) {
        const match: NameMatchResult = {
          personId: person.id,
          personName: person.fullName,
          matchScore: score * 0.95, // Slight penalty vs exact
          matchType: 'partial'
        };
        if (!bestMatch || match.matchScore > bestMatch.matchScore) {
          bestMatch = match;
        }
      }
    }
    
    // Check if first name or last name matches exactly
    if (extractedParts.first === existingParts.first || extractedParts.last === existingParts.last) {
      // One name part matches - calculate overall similarity
      const similarity = nameSimilarity(extractedName, person.fullName);
      if (similarity > 0.5) {
        const match: NameMatchResult = {
          personId: person.id,
          personName: person.fullName,
          matchScore: similarity * 0.9, // Slight penalty vs exact
          matchType: 'normalized'
        };
        if (!bestMatch || match.matchScore > bestMatch.matchScore) {
          bestMatch = match;
        }
      }
    }
    
    // Fuzzy match using Levenshtein distance
    const similarity = nameSimilarity(extractedName, person.fullName);
    if (similarity >= threshold) {
      const match: NameMatchResult = {
        personId: person.id,
        personName: person.fullName,
        matchScore: similarity,
        matchType: 'fuzzy'
      };
      if (!bestMatch || match.matchScore > bestMatch.matchScore) {
        bestMatch = match;
      }
    }
  }
  
  return bestMatch;
}

/**
 * Find all potential matches for an extracted name above a threshold
 */
export function findAllMatches(
  extractedName: string,
  existingPeople: Person[],
  threshold: number = 0.4
): NameMatchResult[] {
  if (!extractedName || existingPeople.length === 0) {
    return [];
  }

  const matches: NameMatchResult[] = [];
  const normalizedExtracted = normalizeName(extractedName);

  for (const person of existingPeople) {
    const normalizedExisting = normalizeName(person.fullName);
    
    // Exact match
    if (normalizedExtracted === normalizedExisting) {
      matches.push({
        personId: person.id,
        personName: person.fullName,
        matchScore: 1,
        matchType: 'exact'
      });
      continue;
    }
    
    // Partial match (containment)
    if (normalizedExisting.includes(normalizedExtracted) || normalizedExtracted.includes(normalizedExisting)) {
      const score = Math.min(normalizedExtracted.length, normalizedExisting.length) / 
                    Math.max(normalizedExtracted.length, normalizedExisting.length);
      if (score >= threshold) {
        matches.push({
          personId: person.id,
          personName: person.fullName,
          matchScore: score * 0.95,
          matchType: 'partial'
        });
        continue;
      }
    }
    
    // Fuzzy match
    const similarity = nameSimilarity(extractedName, person.fullName);
    if (similarity >= threshold) {
      matches.push({
        personId: person.id,
        personName: person.fullName,
        matchScore: similarity,
        matchType: 'fuzzy'
      });
    }
  }
  
  // Sort by score descending
  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Apply automatic matching to a list of extracted names
 * Returns a map of extracted name index to best match
 */
export function autoMatchPeople(
  extractedNames: string[],
  existingPeople: Person[],
  highConfidenceThreshold: number = 0.8
): Map<number, NameMatchResult> {
  const matches = new Map<number, NameMatchResult>();
  
  for (let i = 0; i < extractedNames.length; i++) {
    const match = findBestMatch(extractedNames[i], existingPeople, highConfidenceThreshold);
    if (match) {
      matches.set(i, match);
    }
  }
  
  return matches;
}
