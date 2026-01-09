import {
  normalizeString,
  extractDates,
  tokenize,
  calculateLevenshteinSimilarity,
  calculateJaroWinklerSimilarity,
  calculateTokenOverlap,
  calculateDateSimilarity,
  calculateSimilarity,
  normalizeMarket,
} from '../src/matching/similarity';
import { NormalizedMarket } from '../src/matching/types';

describe('Market Matching', () => {
  describe('normalizeString', () => {
    it('should normalize strings correctly', () => {
      expect(normalizeString('BTC-USD Price')).toBe('btc usd price');
      expect(normalizeString('Will BTC hit $100k by 2024?')).toBe('will btc hit 100k by 2024');
      expect(normalizeString('Market:  "Special"  Characters!')).toBe('market special characters');
    });
  });

  describe('extractDates', () => {
    it('should extract dates from text', () => {
      const dates = extractDates('Will BTC hit $100k by 12/31/2024?');
      expect(dates.length).toBeGreaterThan(0);
    });

    it('should handle multiple date formats', () => {
      const dates1 = extractDates('Event on 2024-12-31');
      const dates2 = extractDates('Event on Dec 31, 2024');
      expect(dates1.length).toBeGreaterThan(0);
      expect(dates2.length).toBeGreaterThan(0);
    });
  });

  describe('tokenize', () => {
    it('should tokenize text correctly', () => {
      const tokens = tokenize('Will Bitcoin hit $100k by end of 2024?');
      expect(tokens).toContain('will');
      expect(tokens).toContain('bitcoin');
      expect(tokens).toContain('hit');
      expect(tokens).not.toContain('100k'); // Numbers filtered out
    });
  });

  describe('calculateLevenshteinSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      expect(calculateLevenshteinSimilarity('test', 'test')).toBe(1.0);
    });

    it('should return lower similarity for different strings', () => {
      const similarity = calculateLevenshteinSimilarity('bitcoin', 'ethereum');
      expect(similarity).toBeLessThan(1.0);
      expect(similarity).toBeGreaterThan(0);
    });
  });

  describe('calculateJaroWinklerSimilarity', () => {
    it('should return high similarity for similar strings', () => {
      const similarity = calculateJaroWinklerSimilarity('bitcoin', 'bitcoin price');
      expect(similarity).toBeGreaterThan(0.8);
    });
  });

  describe('calculateTokenOverlap', () => {
    it('should return 1.0 for identical token sets', () => {
      const overlap = calculateTokenOverlap(['a', 'b', 'c'], ['a', 'b', 'c']);
      expect(overlap).toBe(1.0);
    });

    it('should return 0.5 for half overlap', () => {
      const overlap = calculateTokenOverlap(['a', 'b'], ['b', 'c']);
      expect(overlap).toBe(0.5);
    });
  });

  describe('calculateDateSimilarity', () => {
    it('should return 1.0 for identical dates', () => {
      const date = new Date('2024-12-31');
      const similarity = calculateDateSimilarity([date], [date]);
      expect(similarity).toBe(1.0);
    });

    it('should return 1.0 for dates within 1 day', () => {
      const date1 = new Date('2024-12-31');
      const date2 = new Date('2025-01-01');
      const similarity = calculateDateSimilarity([date1], [date2]);
      expect(similarity).toBe(1.0);
    });
  });

  describe('calculateSimilarity', () => {
    it('should calculate similarity between normalized markets', () => {
      const market1: NormalizedMarket = normalizeMarket({
        id: '1',
        title: 'Will Bitcoin hit $100k by 2024?',
        outcomes: ['yes', 'no'],
        platform: 'opinion',
      });

      const market2: NormalizedMarket = normalizeMarket({
        id: '2',
        title: 'Will Bitcoin reach $100k in 2024?',
        outcomes: ['yes', 'no'],
        platform: 'polymarket',
      });

      const similarity = calculateSimilarity(market1, market2);
      expect(similarity).toBeGreaterThan(0.7);
      expect(similarity).toBeLessThanOrEqual(1.0);
    });

    it('should return low similarity for unrelated markets', () => {
      const market1: NormalizedMarket = normalizeMarket({
        id: '1',
        title: 'Will Bitcoin hit $100k?',
        outcomes: ['yes', 'no'],
        platform: 'opinion',
      });

      const market2: NormalizedMarket = normalizeMarket({
        id: '2',
        title: 'Will it rain tomorrow?',
        outcomes: ['yes', 'no'],
        platform: 'polymarket',
      });

      const similarity = calculateSimilarity(market1, market2);
      expect(similarity).toBeLessThan(0.5);
    });
  });

  describe('normalizeMarket', () => {
    it('should normalize market correctly', () => {
      const normalized = normalizeMarket({
        id: '1',
        title: 'Will BTC hit $100k by 12/31/2024?',
        outcomes: ['yes', 'no'],
        platform: 'opinion',
      });

      expect(normalized.normalizedTitle).toBe('will btc hit 100k by 12/31/2024');
      expect(normalized.tokens.length).toBeGreaterThan(0);
      expect(normalized.dates.length).toBeGreaterThan(0);
      expect(normalized.platform).toBe('opinion');
    });
  });
});

