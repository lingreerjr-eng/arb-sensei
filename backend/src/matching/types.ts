export interface Market {
  id: string;
  title: string;
  description?: string;
  outcomes: string[];
  platform: 'opinion' | 'polymarket';
  metadata?: Record<string, any>;
}

export interface MarketMatch {
  canonicalId: string;
  opinionMarket: Market | null;
  polymarketMarket: Market | null;
  similarityScore: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface NormalizedMarket {
  id: string;
  normalizedTitle: string;
  tokens: string[];
  dates: Date[];
  outcomes: string[];
  platform: 'opinion' | 'polymarket';
  original: Market;
}

