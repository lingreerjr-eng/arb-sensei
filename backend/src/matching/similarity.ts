import levenshtein from 'fast-levenshtein';
import { NormalizedMarket } from './types';

export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

export function extractDates(text: string): Date[] {
  const dates: Date[] = [];
  // Common date patterns
  const patterns = [
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, // MM/DD/YYYY
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, // YYYY-MM-DD
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/gi, // Month DD, YYYY
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      try {
        const date = new Date(match[0]);
        if (!isNaN(date.getTime())) {
          dates.push(date);
        }
      } catch (e) {
        // Invalid date, skip
      }
    }
  }

  return dates;
}

export function tokenize(text: string): string[] {
  const normalized = normalizeString(text);
  return normalized
    .split(/\s+/)
    .filter((token) => token.length > 2) // Filter out very short tokens
    .filter((token) => !/^\d+$/.test(token)); // Filter out pure numbers
}

export function calculateLevenshteinSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshtein.get(str1, str2);
  return 1 - distance / maxLen;
}

export function calculateJaroWinklerSimilarity(str1: string, str2: string): number {
  // Simplified Jaro-Winkler implementation
  // For production, consider using a proper library like 'jaro-winkler' or 'string-similarity'
  const jaro = calculateJaroSimilarity(str1, str2);
  const prefixLength = getCommonPrefixLength(str1, str2, 4);
  return jaro + (0.1 * prefixLength * (1 - jaro));
}

function calculateJaroSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
  const str1Matches = new Array(str1.length).fill(false);
  const str2Matches = new Array(str2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, str2.length);

    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) continue;
      str1Matches[i] = true;
      str2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Find transpositions
  let k = 0;
  for (let i = 0; i < str1.length; i++) {
    if (!str1Matches[i]) continue;
    while (!str2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }

  return (
    (matches / str1.length +
      matches / str2.length +
      (matches - transpositions / 2) / matches) /
    3.0
  );
}

function getCommonPrefixLength(str1: string, str2: string, maxLength: number): number {
  let prefixLength = 0;
  const minLength = Math.min(str1.length, str2.length, maxLength);
  for (let i = 0; i < minLength; i++) {
    if (str1[i] === str2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }
  return prefixLength;
}

export function calculateTokenOverlap(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

export function calculateDateSimilarity(dates1: Date[], dates2: Date[]): number {
  if (dates1.length === 0 && dates2.length === 0) return 1.0;
  if (dates1.length === 0 || dates2.length === 0) return 0.5; // Partial match

  // Check if any dates are close (within 1 day)
  for (const date1 of dates1) {
    for (const date2 of dates2) {
      const diff = Math.abs(date1.getTime() - date2.getTime());
      const daysDiff = diff / (1000 * 60 * 60 * 24);
      if (daysDiff <= 1) {
        return 1.0; // Exact or very close match
      }
    }
  }

  return 0.0; // No matching dates
}

export function calculateSimilarity(
  market1: NormalizedMarket,
  market2: NormalizedMarket
): number {
  // Weighted combination of different similarity metrics
  const weights = {
    titleLevenshtein: 0.2,
    titleJaroWinkler: 0.3,
    tokenOverlap: 0.3,
    dateSimilarity: 0.2,
  };

  const title1 = market1.normalizedTitle;
  const title2 = market2.normalizedTitle;

  const levenshteinScore = calculateLevenshteinSimilarity(title1, title2);
  const jaroWinklerScore = calculateJaroWinklerSimilarity(title1, title2);
  const tokenOverlapScore = calculateTokenOverlap(market1.tokens, market2.tokens);
  const dateSimilarityScore = calculateDateSimilarity(market1.dates, market2.dates);

  const totalScore =
    levenshteinScore * weights.titleLevenshtein +
    jaroWinklerScore * weights.titleJaroWinkler +
    tokenOverlapScore * weights.tokenOverlap +
    dateSimilarityScore * weights.dateSimilarity;

  return Math.min(1.0, Math.max(0.0, totalScore));
}

export function normalizeMarket(market: { id: string; title: string; outcomes: string[]; platform: 'opinion' | 'polymarket'; description?: string }): NormalizedMarket {
  const normalizedTitle = normalizeString(market.title);
  const fullText = `${market.title} ${market.description || ''}`;
  const tokens = tokenize(fullText);
  const dates = extractDates(fullText);

  return {
    id: market.id,
    normalizedTitle,
    tokens,
    dates,
    outcomes: market.outcomes.map((o) => normalizeString(o)),
    platform: market.platform,
    original: market as any,
  };
}

