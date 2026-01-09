
export interface MarketData {
  platform: string;
  market: string;
  odds: {
    yes: string;
    no: string;
  };
  liquidity: string;
}

export interface ChartPoint {
  time: string;
  value: number;
}

export interface Position {
  id: string;
  market: string;
  side: 'BUY' | 'SELL';
  amount: number;
  current: string;
  profit: string;
  profitPercent: number;
}
