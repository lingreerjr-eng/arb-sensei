import { Orderbook, MarketPrices, ArbitrageCalculation } from './types';
import { config } from '../config/config';
import { logger } from '../utils/logger';

// Platform-specific fee rates (adjust based on actual fees)
const OPINION_FEE_RATE = 0.02; // 2%
const POLYMARKET_FEE_RATE = 0.02; // 2%

export function extractBestPrice(orderbook: Orderbook, side: 'bid' | 'ask'): number | null {
  if (side === 'bid') {
    // Best bid is the highest price
    if (orderbook.bids.length === 0) return null;
    return Math.max(...orderbook.bids.map((b) => b.price));
  } else {
    // Best ask is the lowest price
    if (orderbook.asks.length === 0) return null;
    return Math.min(...orderbook.asks.map((a) => a.price));
  }
}

export function calculateLiquidity(orderbook: Orderbook, side: 'bid' | 'ask', maxPrice?: number): number {
  if (side === 'bid') {
    const relevantBids = maxPrice
      ? orderbook.bids.filter((b) => b.price >= maxPrice)
      : orderbook.bids;
    return relevantBids.reduce((sum, bid) => sum + bid.size, 0);
  } else {
    const relevantAsks = maxPrice
      ? orderbook.asks.filter((a) => a.price <= maxPrice)
      : orderbook.asks;
    return relevantAsks.reduce((sum, ask) => sum + ask.size, 0);
  }
}

export function extractMarketPrices(
  orderbook: Orderbook,
  outcome: 'yes' | 'no'
): { price: number; liquidity: number } | null {
  // For binary markets, YES and NO prices should sum to 1
  // Extract best bid/ask for the outcome
  const bestBid = extractBestPrice(orderbook, 'bid');
  const bestAsk = extractBestPrice(orderbook, 'ask');

  if (bestBid === null || bestAsk === null) {
    return null;
  }

  // Use mid-price: (bestBid + bestAsk) / 2
  const midPrice = (bestBid + bestAsk) / 2;
  const liquidity = calculateLiquidity(orderbook, 'bid') + calculateLiquidity(orderbook, 'ask');

  return {
    price: midPrice,
    liquidity,
  };
}

export function calculateArbitrage(
  opinionPrices: MarketPrices,
  polymarketPrices: MarketPrices
): ArbitrageCalculation | null {
  // Calculate both possible arbitrage paths:
  // 1. Buy YES on Opinion, Buy NO on Polymarket
  // 2. Buy NO on Opinion, Buy YES on Polymarket

  const path1Cost = opinionPrices.yesPrice + polymarketPrices.noPrice;
  const path2Cost = opinionPrices.noPrice + polymarketPrices.yesPrice;

  // Choose the path with lower combined cost
  const bestPath = path1Cost < path2Cost ? 1 : 2;
  const combinedCost = bestPath === 1 ? path1Cost : path2Cost;

  // Check if arbitrage exists (combined cost < threshold)
  if (combinedCost >= config.arbitrage.threshold) {
    return null; // No arbitrage opportunity
  }

  // Calculate profit potential
  const profitPotential = 1 - combinedCost;

  // Determine sides
  const opinionSide = bestPath === 1 ? 'yes' : 'no';
  const polymarketSide = bestPath === 1 ? 'no' : 'yes';

  // Calculate recommended size based on available liquidity
  const opinionLiquidity = opinionSide === 'yes' ? opinionPrices.yesLiquidity : opinionPrices.noLiquidity;
  const polymarketLiquidity = polymarketSide === 'yes' ? polymarketPrices.yesLiquidity : polymarketPrices.noLiquidity;
  const recommendedSize = Math.min(
    opinionLiquidity,
    polymarketLiquidity,
    config.arbitrage.maxPositionSize
  );

  // Check minimum liquidity requirement
  if (recommendedSize < config.arbitrage.minLiquidity) {
    return null; // Insufficient liquidity
  }

  // Calculate fees
  const opinionFee = recommendedSize * OPINION_FEE_RATE;
  const polymarketFee = recommendedSize * POLYMARKET_FEE_RATE;
  const estimatedFees = opinionFee + polymarketFee;

  // Calculate net profit after fees
  const grossProfit = recommendedSize * profitPotential;
  const netProfit = grossProfit - estimatedFees;

  // Only return opportunity if net profit is positive
  if (netProfit <= 0) {
    return null;
  }

  return {
    combinedCost,
    profitPotential,
    opinionSide,
    polymarketSide,
    recommendedSize,
    estimatedFees,
    netProfit,
  };
}

export function estimateSlippage(
  orderbook: Orderbook,
  size: number,
  side: 'buy' | 'sell'
): number {
  // Estimate average execution price considering slippage
  let remainingSize = size;
  let totalCost = 0;
  let totalSize = 0;

  const orders = side === 'buy' ? orderbook.asks : orderbook.bids;
  const sortedOrders = side === 'buy'
    ? [...orders].sort((a, b) => a.price - b.price) // Buy: lowest first
    : [...orders].sort((a, b) => b.price - a.price); // Sell: highest first

  for (const order of sortedOrders) {
    if (remainingSize <= 0) break;

    const fillSize = Math.min(remainingSize, order.size);
    totalCost += fillSize * order.price;
    totalSize += fillSize;
    remainingSize -= fillSize;
  }

  if (totalSize === 0) return 0;
  return totalCost / totalSize;
}

export function validateLiquidity(
  orderbook: Orderbook,
  requiredSize: number,
  maxPrice?: number
): boolean {
  const bidLiquidity = calculateLiquidity(orderbook, 'bid', maxPrice);
  const askLiquidity = calculateLiquidity(orderbook, 'ask', maxPrice);
  return Math.min(bidLiquidity, askLiquidity) >= requiredSize;
}

