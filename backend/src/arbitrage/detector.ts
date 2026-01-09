import { EventEmitter } from 'events';
import { OpinionWebSocketClient, OrderbookUpdate as OpinionOrderbookUpdate } from '../websocket/opinionClient';
import { PolymarketWebSocketClient, PolymarketOrderbookUpdate } from '../websocket/polymarketClient';
import { MarketMatcher } from '../matching/marketMatcher';
import { MarketMappingModel } from '../database/models/marketMapping';
import { ArbitrageOpportunityModel, CreateOpportunityInput } from '../database/models/arbitrageOpportunity';
import { ArbitrageOpportunity, MarketPrices } from './types';
import { calculateArbitrage, extractMarketPrices } from './calculator';
import { config } from '../config/config';
import { logger } from '../utils/logger';

interface MarketOrderbooks {
  opinion?: OpinionOrderbookUpdate;
  polymarket?: PolymarketOrderbookUpdate;
}

export class ArbitrageDetector extends EventEmitter {
  private opinionClient: OpinionWebSocketClient;
  private polymarketClient: PolymarketWebSocketClient;
  private marketMatcher: MarketMatcher;
  private mappingModel: MarketMappingModel;
  private opportunityModel: ArbitrageOpportunityModel;
  private orderbooks: Map<string, MarketOrderbooks> = new Map();
  private detectionInterval: NodeJS.Timeout | null = null;
  private readonly detectionIntervalMs = 1000; // Check every second

  constructor(
    opinionClient: OpinionWebSocketClient,
    polymarketClient: PolymarketWebSocketClient,
    marketMatcher: MarketMatcher
  ) {
    super();
    this.opinionClient = opinionClient;
    this.polymarketClient = polymarketClient;
    this.marketMatcher = marketMatcher;
    this.mappingModel = new MarketMappingModel();
    this.opportunityModel = new ArbitrageOpportunityModel();
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    // Handle Opinion orderbook updates
    this.opinionClient.on('orderbook', (update: OpinionOrderbookUpdate) => {
      this.handleOpinionOrderbook(update);
    });

    // Handle Polymarket orderbook updates
    this.polymarketClient.on('orderbook', (update: PolymarketOrderbookUpdate) => {
      this.handlePolymarketOrderbook(update);
    });
  }

  private handleOpinionOrderbook(update: OpinionOrderbookUpdate): void {
    // Find matching canonical market ID
    this.mappingModel
      .findByOpinionId(update.marketId)
      .then((mapping) => {
        if (mapping) {
          const canonicalId = mapping.canonical_market_id;
          if (!this.orderbooks.has(canonicalId)) {
            this.orderbooks.set(canonicalId, {});
          }
          const orderbooks = this.orderbooks.get(canonicalId)!;
          orderbooks.opinion = update;
          this.checkArbitrage(canonicalId);
        }
      })
      .catch((error) => {
        logger.error('Failed to find mapping for Opinion orderbook', { error, marketId: update.marketId });
      });
  }

  private handlePolymarketOrderbook(update: PolymarketOrderbookUpdate): void {
    // Find matching canonical market ID
    this.mappingModel
      .findByPolymarketId(update.marketId)
      .then((mapping) => {
        if (mapping) {
          const canonicalId = mapping.canonical_market_id;
          if (!this.orderbooks.has(canonicalId)) {
            this.orderbooks.set(canonicalId, {});
          }
          const orderbooks = this.orderbooks.get(canonicalId)!;
          orderbooks.polymarket = update;
          this.checkArbitrage(canonicalId);
        }
      })
      .catch((error) => {
        logger.error('Failed to find mapping for Polymarket orderbook', { error, marketId: update.marketId });
      });
  }

  private async checkArbitrage(canonicalId: string): Promise<void> {
    const orderbooks = this.orderbooks.get(canonicalId);
    if (!orderbooks?.opinion || !orderbooks?.polymarket) {
      return; // Need both orderbooks
    }

    try {
      const mapping = await this.mappingModel.findByCanonicalId(canonicalId);
      if (!mapping || !mapping.opinion_market_id || !mapping.polymarket_market_id) {
        return;
      }

      // Extract prices from orderbooks
      const opinionYes = extractMarketPrices(
        {
          marketId: mapping.opinion_market_id,
          bids: orderbooks.opinion.bids,
          asks: orderbooks.opinion.asks,
          timestamp: orderbooks.opinion.timestamp,
        },
        'yes'
      );
      const opinionNo = extractMarketPrices(
        {
          marketId: mapping.opinion_market_id,
          bids: orderbooks.opinion.bids,
          asks: orderbooks.opinion.asks,
          timestamp: orderbooks.opinion.timestamp,
        },
        'no'
      );

      const polymarketYes = extractMarketPrices(
        {
          marketId: mapping.polymarket_market_id,
          bids: orderbooks.polymarket.bids.map((b) => ({ price: parseFloat(b.price), size: parseFloat(b.size) })),
          asks: orderbooks.polymarket.asks.map((a) => ({ price: parseFloat(a.price), size: parseFloat(a.size) })),
          timestamp: orderbooks.polymarket.timestamp,
        },
        'yes'
      );
      const polymarketNo = extractMarketPrices(
        {
          marketId: mapping.polymarket_market_id,
          bids: orderbooks.polymarket.bids.map((b) => ({ price: parseFloat(b.price), size: parseFloat(b.size) })),
          asks: orderbooks.polymarket.asks.map((a) => ({ price: parseFloat(a.price), size: parseFloat(a.size) })),
          timestamp: orderbooks.polymarket.timestamp,
        },
        'no'
      );

      if (!opinionYes || !opinionNo || !polymarketYes || !polymarketNo) {
        return; // Missing price data
      }

      const opinionPrices: MarketPrices = {
        marketId: mapping.opinion_market_id,
        yesPrice: opinionYes.price,
        noPrice: opinionNo.price,
        yesLiquidity: opinionYes.liquidity,
        noLiquidity: opinionNo.liquidity,
        timestamp: Date.now(),
      };

      const polymarketPrices: MarketPrices = {
        marketId: mapping.polymarket_market_id,
        yesPrice: polymarketYes.price,
        noPrice: polymarketNo.price,
        yesLiquidity: polymarketYes.liquidity,
        noLiquidity: polymarketNo.liquidity,
        timestamp: Date.now(),
      };

      // Calculate arbitrage
      const calculation = calculateArbitrage(opinionPrices, polymarketPrices);
      if (!calculation) {
        return; // No arbitrage opportunity
      }

      // Create arbitrage opportunity
      const opportunity: ArbitrageOpportunity = {
        canonicalMarketId: canonicalId,
        opinionMarketId: mapping.opinion_market_id,
        polymarketMarketId: mapping.polymarket_market_id,
        combinedCost: calculation.combinedCost,
        profitPotential: calculation.profitPotential,
        opinionYesPrice: opinionPrices.yesPrice,
        opinionNoPrice: opinionPrices.noPrice,
        polymarketYesPrice: polymarketPrices.yesPrice,
        polymarketNoPrice: polymarketPrices.noPrice,
        opinionLiquidity: Math.min(opinionPrices.yesLiquidity, opinionPrices.noLiquidity),
        polymarketLiquidity: Math.min(polymarketPrices.yesLiquidity, polymarketPrices.noLiquidity),
        recommendedSize: calculation.recommendedSize,
        detectedAt: new Date(),
      };

      // Save to database
      const input: CreateOpportunityInput = {
        canonical_market_id: canonicalId,
        combined_cost: calculation.combinedCost,
        profit_potential: calculation.profitPotential,
        opinion_price_yes: opinionPrices.yesPrice,
        opinion_price_no: opinionPrices.noPrice,
        polymarket_price_yes: polymarketPrices.yesPrice,
        polymarket_price_no: polymarketPrices.noPrice,
        liquidity_opinion: opportunity.opinionLiquidity,
        liquidity_polymarket: opportunity.polymarketLiquidity,
      };

      const savedOpportunity = await this.opportunityModel.create(input);

      // Emit event
      this.emit('opportunity', {
        ...opportunity,
        id: savedOpportunity.id,
      });

      logger.info('Arbitrage opportunity detected', {
        canonicalId,
        combinedCost: calculation.combinedCost,
        profitPotential: calculation.profitPotential,
        recommendedSize: calculation.recommendedSize,
      });
    } catch (error) {
      logger.error('Failed to check arbitrage', { error, canonicalId });
    }
  }

  async startMonitoring(): Promise<void> {
    logger.info('Starting arbitrage detection monitoring');

    // Subscribe to all matched markets
    const mappings = await this.mappingModel.getAll();
    for (const mapping of mappings) {
      if (mapping.opinion_market_id) {
        this.opinionClient.subscribeToMarket(mapping.opinion_market_id);
      }
      if (mapping.polymarket_market_id) {
        this.polymarketClient.subscribeToMarket(mapping.polymarket_market_id);
      }
    }

    // Start periodic detection check
    this.detectionInterval = setInterval(() => {
      // Periodic checks can be added here if needed
    }, this.detectionIntervalMs);

    logger.info('Arbitrage detection monitoring started', { markets: mappings.length });
  }

  stopMonitoring(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    logger.info('Arbitrage detection monitoring stopped');
  }
}

