import {
  extractBestPrice,
  calculateLiquidity,
  extractMarketPrices,
  calculateArbitrage,
} from '../src/arbitrage/calculator';
import { Orderbook, MarketPrices } from '../src/arbitrage/types';

describe('Arbitrage Detection', () => {
  describe('extractBestPrice', () => {
    it('should extract best bid price', () => {
      const orderbook: Orderbook = {
        marketId: 'test',
        bids: [
          { price: 0.45, size: 100 },
          { price: 0.50, size: 200 },
          { price: 0.40, size: 150 },
        ],
        asks: [
          { price: 0.55, size: 100 },
          { price: 0.60, size: 200 },
        ],
        timestamp: Date.now(),
      };

      const bestBid = extractBestPrice(orderbook, 'bid');
      expect(bestBid).toBe(0.50);
    });

    it('should extract best ask price', () => {
      const orderbook: Orderbook = {
        marketId: 'test',
        bids: [
          { price: 0.45, size: 100 },
          { price: 0.50, size: 200 },
        ],
        asks: [
          { price: 0.55, size: 100 },
          { price: 0.60, size: 200 },
          { price: 0.52, size: 150 },
        ],
        timestamp: Date.now(),
      };

      const bestAsk = extractBestPrice(orderbook, 'ask');
      expect(bestAsk).toBe(0.52);
    });
  });

  describe('calculateLiquidity', () => {
    it('should calculate total liquidity', () => {
      const orderbook: Orderbook = {
        marketId: 'test',
        bids: [
          { price: 0.45, size: 100 },
          { price: 0.50, size: 200 },
        ],
        asks: [
          { price: 0.55, size: 150 },
          { price: 0.60, size: 250 },
        ],
        timestamp: Date.now(),
      };

      const bidLiquidity = calculateLiquidity(orderbook, 'bid');
      expect(bidLiquidity).toBe(300);

      const askLiquidity = calculateLiquidity(orderbook, 'ask');
      expect(askLiquidity).toBe(400);
    });
  });

  describe('extractMarketPrices', () => {
    it('should extract prices and liquidity', () => {
      const orderbook: Orderbook = {
        marketId: 'test',
        bids: [
          { price: 0.48, size: 100 },
          { price: 0.47, size: 200 },
        ],
        asks: [
          { price: 0.52, size: 150 },
          { price: 0.53, size: 250 },
        ],
        timestamp: Date.now(),
      };

      const result = extractMarketPrices(orderbook, 'yes');
      expect(result).not.toBeNull();
      expect(result!.price).toBeCloseTo(0.50, 2); // Mid-price
      expect(result!.liquidity).toBeGreaterThan(0);
    });
  });

  describe('calculateArbitrage', () => {
    it('should detect arbitrage opportunity', () => {
      const opinionPrices: MarketPrices = {
        marketId: 'opinion-1',
        yesPrice: 0.45,
        noPrice: 0.55,
        yesLiquidity: 1000,
        noLiquidity: 1000,
        timestamp: Date.now(),
      };

      const polymarketPrices: MarketPrices = {
        marketId: 'poly-1',
        yesPrice: 0.50,
        noPrice: 0.50,
        yesLiquidity: 1000,
        noLiquidity: 1000,
        timestamp: Date.now(),
      };

      // Combined cost: 0.45 + 0.50 = 0.95 < 0.98 (threshold)
      const result = calculateArbitrage(opinionPrices, polymarketPrices);
      expect(result).not.toBeNull();
      expect(result!.combinedCost).toBeLessThan(0.98);
      expect(result!.profitPotential).toBeGreaterThan(0);
    });

    it('should return null when no arbitrage exists', () => {
      const opinionPrices: MarketPrices = {
        marketId: 'opinion-1',
        yesPrice: 0.50,
        noPrice: 0.50,
        yesLiquidity: 1000,
        noLiquidity: 1000,
        timestamp: Date.now(),
      };

      const polymarketPrices: MarketPrices = {
        marketId: 'poly-1',
        yesPrice: 0.50,
        noPrice: 0.50,
        yesLiquidity: 1000,
        noLiquidity: 1000,
        timestamp: Date.now(),
      };

      // Combined cost: 0.50 + 0.50 = 1.0 >= 0.98 (threshold)
      const result = calculateArbitrage(opinionPrices, polymarketPrices);
      expect(result).toBeNull();
    });

    it('should return null when liquidity is insufficient', () => {
      const opinionPrices: MarketPrices = {
        marketId: 'opinion-1',
        yesPrice: 0.45,
        noPrice: 0.55,
        yesLiquidity: 50, // Below minimum
        noLiquidity: 50,
        timestamp: Date.now(),
      };

      const polymarketPrices: MarketPrices = {
        marketId: 'poly-1',
        yesPrice: 0.50,
        noPrice: 0.50,
        yesLiquidity: 50,
        noLiquidity: 50,
        timestamp: Date.now(),
      };

      const result = calculateArbitrage(opinionPrices, polymarketPrices);
      expect(result).toBeNull(); // Insufficient liquidity
    });
  });
});

