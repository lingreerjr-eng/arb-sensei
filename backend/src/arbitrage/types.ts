export interface Orderbook {
  marketId: string;
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  timestamp: number;
}

export interface MarketPrices {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  yesLiquidity: number;
  noLiquidity: number;
  timestamp: number;
}

export interface ArbitrageOpportunity {
  canonicalMarketId: string;
  opinionMarketId: string;
  polymarketMarketId: string;
  combinedCost: number;
  profitPotential: number;
  opinionYesPrice: number;
  opinionNoPrice: number;
  polymarketYesPrice: number;
  polymarketNoPrice: number;
  opinionLiquidity: number;
  polymarketLiquidity: number;
  recommendedSize: number;
  detectedAt: Date;
}

export interface ArbitrageCalculation {
  combinedCost: number;
  profitPotential: number;
  opinionSide: 'yes' | 'no';
  polymarketSide: 'yes' | 'no';
  recommendedSize: number;
  estimatedFees: number;
  netProfit: number;
}

