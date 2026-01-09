import axios from 'axios';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { MarketMappingModel, CreateMarketMappingInput } from '../database/models/marketMapping';
import { Market, MarketMatch, NormalizedMarket } from './types';
import { normalizeMarket, calculateSimilarity } from './similarity';
import { MarketMatchingError } from '../utils/errors';

export class MarketMatcher {
  private mappingModel: MarketMappingModel;
  private normalizedMarkets: Map<string, NormalizedMarket> = new Map();
  private readonly similarityThreshold = 0.85;

  constructor() {
    this.mappingModel = new MarketMappingModel();
  }

  async fetchOpinionMarkets(): Promise<Market[]> {
    try {
      // Fetch markets from Opinion API
      // Adjust endpoint based on actual Opinion API
      const response = await axios.get(`${config.opinion.apiUrl}/markets`, {
        headers: {
          'Authorization': `Bearer ${config.opinion.apiKey}`,
        },
      });

      return response.data.map((market: any) => ({
        id: market.id || market.market_id,
        title: market.title || market.question,
        description: market.description,
        outcomes: market.outcomes || ['yes', 'no'],
        platform: 'opinion' as const,
        metadata: market,
      }));
    } catch (error: any) {
      logger.error('Failed to fetch Opinion markets', { error });
      throw new MarketMatchingError('Failed to fetch Opinion markets', 'FETCH_ERROR');
    }
  }

  async fetchPolymarketMarkets(): Promise<Market[]> {
    try {
      // Fetch markets from Polymarket API
      // Adjust endpoint based on actual Polymarket API
      const response = await axios.get(`${config.polymarket.apiUrl}/markets`, {
        headers: {
          'Authorization': `Bearer ${config.polymarket.apiKey}`,
        },
      });

      return response.data.map((market: any) => ({
        id: market.condition_id || market.id,
        title: market.question || market.title,
        description: market.description,
        outcomes: market.outcomes?.map((o: any) => o.outcome || o) || ['yes', 'no'],
        platform: 'polymarket' as const,
        metadata: market,
      }));
    } catch (error: any) {
      logger.error('Failed to fetch Polymarket markets', { error });
      throw new MarketMatchingError('Failed to fetch Polymarket markets', 'FETCH_ERROR');
    }
  }

  async matchMarkets(): Promise<MarketMatch[]> {
    logger.info('Starting market matching process');
    
    const [opinionMarkets, polymarketMarkets] = await Promise.all([
      this.fetchOpinionMarkets(),
      this.fetchPolymarketMarkets(),
    ]);

    logger.info('Fetched markets', {
      opinion: opinionMarkets.length,
      polymarket: polymarketMarkets.length,
    });

    // Normalize all markets
    const normalizedOpinion = opinionMarkets.map((m) => normalizeMarket(m));
    const normalizedPolymarket = polymarketMarkets.map((m) => normalizeMarket(m));

    // Store normalized markets
    normalizedOpinion.forEach((nm) => this.normalizedMarkets.set(`opinion:${nm.id}`, nm));
    normalizedPolymarket.forEach((nm) => this.normalizedMarkets.set(`polymarket:${nm.id}`, nm));

    // Find matches
    const matches: MarketMatch[] = [];
    const matchedPolymarketIds = new Set<string>();

    for (const opinionMarket of normalizedOpinion) {
      let bestMatch: { market: NormalizedMarket; score: number } | null = null;

      for (const polymarketMarket of normalizedPolymarket) {
        if (matchedPolymarketIds.has(polymarketMarket.id)) {
          continue; // Already matched
        }

        const similarity = calculateSimilarity(opinionMarket, polymarketMarket);
        if (similarity >= this.similarityThreshold) {
          if (!bestMatch || similarity > bestMatch.score) {
            bestMatch = { market: polymarketMarket, score: similarity };
          }
        }
      }

      if (bestMatch) {
        matchedPolymarketIds.add(bestMatch.market.id);
        const canonicalId = this.generateCanonicalId(opinionMarket, bestMatch.market);
        
        matches.push({
          canonicalId,
          opinionMarket: opinionMarket.original,
          polymarketMarket: bestMatch.market.original,
          similarityScore: bestMatch.score,
          confidence: this.getConfidence(bestMatch.score),
        });
      }
    }

    logger.info('Market matching completed', { matches: matches.length });
    return matches;
  }

  private generateCanonicalId(market1: NormalizedMarket, market2: NormalizedMarket): string {
    // Generate a canonical ID based on normalized title
    const baseTitle = market1.normalizedTitle.length < market2.normalizedTitle.length
      ? market1.normalizedTitle
      : market2.normalizedTitle;
    
    // Create a hash-like ID from the title
    const hash = baseTitle
      .replace(/\s+/g, '-')
      .substring(0, 50)
      .toLowerCase();
    
    return `market-${hash}-${Date.now()}`;
  }

  private getConfidence(score: number): 'high' | 'medium' | 'low' {
    if (score >= 0.95) return 'high';
    if (score >= 0.85) return 'medium';
    return 'low';
  }

  async saveMatches(matches: MarketMatch[]): Promise<void> {
    logger.info('Saving market matches to database', { count: matches.length });

    for (const match of matches) {
      try {
        // Check if mapping already exists
        const existing = await this.mappingModel.findByCanonicalId(match.canonicalId);
        
        if (existing) {
          // Update existing mapping
          await this.mappingModel.update(match.canonicalId, {
            opinion_market_id: match.opinionMarket?.id,
            polymarket_market_id: match.polymarketMarket?.id,
            similarity_score: match.similarityScore,
          });
        } else {
          // Create new mapping
          const input: CreateMarketMappingInput = {
            canonical_market_id: match.canonicalId,
            opinion_market_id: match.opinionMarket?.id,
            polymarket_market_id: match.polymarketMarket?.id,
            market_title: match.opinionMarket?.title || match.polymarketMarket?.title || '',
            similarity_score: match.similarityScore,
          };
          await this.mappingModel.create(input);
        }
      } catch (error) {
        logger.error('Failed to save market match', { error, match });
      }
    }

    logger.info('Market matches saved successfully');
  }

  async syncMarkets(): Promise<void> {
    try {
      const matches = await this.matchMarkets();
      await this.saveMatches(matches);
    } catch (error) {
      logger.error('Failed to sync markets', { error });
      throw error;
    }
  }

  async getMatchedMarkets(): Promise<MarketMatch[]> {
    const mappings = await this.mappingModel.getAll();
    return mappings.map((mapping) => ({
      canonicalId: mapping.canonical_market_id,
      opinionMarket: mapping.opinion_market_id
        ? { id: mapping.opinion_market_id, title: mapping.market_title, outcomes: ['yes', 'no'], platform: 'opinion' as const }
        : null,
      polymarketMarket: mapping.polymarket_market_id
        ? { id: mapping.polymarket_market_id, title: mapping.market_title, outcomes: ['yes', 'no'], platform: 'polymarket' as const }
        : null,
      similarityScore: mapping.similarity_score || 0,
      confidence: (mapping.similarity_score || 0) >= 0.95 ? 'high' : (mapping.similarity_score || 0) >= 0.85 ? 'medium' : 'low',
    }));
  }

  getNormalizedMarket(platform: 'opinion' | 'polymarket', marketId: string): NormalizedMarket | null {
    return this.normalizedMarkets.get(`${platform}:${marketId}`) || null;
  }
}

