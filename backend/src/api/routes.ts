import { Router, Request, Response } from 'express';
import { MarketService } from '../services/marketService';
import { TradeService } from '../services/tradeService';
import { ArbitrageDetector } from '../arbitrage/detector';
import { TradeExecutor } from '../trading/executor';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export function createRoutes(
  marketService: MarketService,
  tradeService: TradeService,
  detector: ArbitrageDetector,
  executor: TradeExecutor
): Router {
  const router = Router();

  // Health check
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'arb-sensei-backend',
    });
  });

  // Get recent arbitrage opportunities
  router.get('/opportunities', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const opportunities = await marketService.getRecentOpportunities(limit);
      res.json(opportunities);
    } catch (error: any) {
      logger.error('Failed to get opportunities', { error });
      res.status(500).json({ error: 'Failed to fetch opportunities' });
    }
  });

  // Get active arbitrage opportunities
  router.get('/opportunities/active', async (req: Request, res: Response) => {
    try {
      const opportunities = await marketService.getActiveOpportunities();
      res.json(opportunities);
    } catch (error: any) {
      logger.error('Failed to get active opportunities', { error });
      res.status(500).json({ error: 'Failed to fetch active opportunities' });
    }
  });

  // Get matched markets
  router.get('/markets', async (req: Request, res: Response) => {
    try {
      const markets = await marketService.getMatchedMarkets();
      res.json(markets);
    } catch (error: any) {
      logger.error('Failed to get markets', { error });
      res.status(500).json({ error: 'Failed to fetch markets' });
    }
  });

  // Sync markets
  router.post('/markets/sync', async (req: Request, res: Response) => {
    try {
      await marketService.syncMarkets();
      res.json({ message: 'Markets synced successfully' });
    } catch (error: any) {
      logger.error('Failed to sync markets', { error });
      res.status(500).json({ error: 'Failed to sync markets' });
    }
  });

  // Get trade history
  router.get('/trades', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const trades = await tradeService.getRecentTrades(limit);
      res.json(trades);
    } catch (error: any) {
      logger.error('Failed to get trades', { error });
      res.status(500).json({ error: 'Failed to fetch trades' });
    }
  });

  // Get trades for a specific opportunity
  router.get('/trades/opportunity/:opportunityId', async (req: Request, res: Response) => {
    try {
      const trades = await tradeService.getTradesByOpportunity(req.params.opportunityId);
      res.json(trades);
    } catch (error: any) {
      logger.error('Failed to get trades for opportunity', { error });
      res.status(500).json({ error: 'Failed to fetch trades' });
    }
  });

  // Execute arbitrage opportunity
  router.post('/execute/:opportunityId', async (req: Request, res: Response) => {
    try {
      if (!config.arbitrage.autoExecute) {
        return res.status(403).json({ error: 'Auto-execution is disabled' });
      }

      const opportunityId = req.params.opportunityId;
      const opportunity = await marketService.getActiveOpportunities();
      const targetOpportunity = opportunity.find((o) => o.id === opportunityId);

      if (!targetOpportunity) {
        return res.status(404).json({ error: 'Opportunity not found or not active' });
      }

      // Convert database model to arbitrage opportunity format
      const arbOpportunity = {
        id: targetOpportunity.id,
        canonicalMarketId: targetOpportunity.canonical_market_id,
        opinionMarketId: '', // Will need to fetch from mapping
        polymarketMarketId: '', // Will need to fetch from mapping
        combinedCost: parseFloat(targetOpportunity.combined_cost.toString()),
        profitPotential: parseFloat(targetOpportunity.profit_potential.toString()),
        opinionYesPrice: targetOpportunity.opinion_price_yes
          ? parseFloat(targetOpportunity.opinion_price_yes.toString())
          : 0,
        opinionNoPrice: targetOpportunity.opinion_price_no
          ? parseFloat(targetOpportunity.opinion_price_no.toString())
          : 0,
        polymarketYesPrice: targetOpportunity.polymarket_price_yes
          ? parseFloat(targetOpportunity.polymarket_price_yes.toString())
          : 0,
        polymarketNoPrice: targetOpportunity.polymarket_price_no
          ? parseFloat(targetOpportunity.polymarket_price_no.toString())
          : 0,
        opinionLiquidity: targetOpportunity.liquidity_opinion
          ? parseFloat(targetOpportunity.liquidity_opinion.toString())
          : 0,
        polymarketLiquidity: targetOpportunity.liquidity_polymarket
          ? parseFloat(targetOpportunity.liquidity_polymarket.toString())
          : 0,
        recommendedSize: Math.min(
          targetOpportunity.liquidity_opinion
            ? parseFloat(targetOpportunity.liquidity_opinion.toString())
            : 0,
          targetOpportunity.liquidity_polymarket
            ? parseFloat(targetOpportunity.liquidity_polymarket.toString())
            : 0,
          config.arbitrage.maxPositionSize
        ),
        detectedAt: targetOpportunity.detected_at,
      };

      const result = await executor.executeArbitrage(arbOpportunity);
      res.json(result);
    } catch (error: any) {
      logger.error('Failed to execute arbitrage', { error });
      res.status(500).json({ error: error.message || 'Failed to execute arbitrage' });
    }
  });

  // Cancel execution
  router.post('/execute/:opportunityId/cancel', async (req: Request, res: Response) => {
    try {
      await executor.cancelExecution(req.params.opportunityId);
      res.json({ message: 'Execution cancelled' });
    } catch (error: any) {
      logger.error('Failed to cancel execution', { error });
      res.status(500).json({ error: 'Failed to cancel execution' });
    }
  });

  // Get configuration
  router.get('/config', (req: Request, res: Response) => {
    res.json({
      arbThreshold: config.arbitrage.threshold,
      minLiquidity: config.arbitrage.minLiquidity,
      autoExecute: config.arbitrage.autoExecute,
      maxPositionSize: config.arbitrage.maxPositionSize,
    });
  });

  // Update configuration (limited fields for safety)
  router.post('/config', (req: Request, res: Response) => {
    // Only allow updating auto-execute flag
    if (req.body.autoExecute !== undefined) {
      config.arbitrage.autoExecute = Boolean(req.body.autoExecute);
      logger.info('Configuration updated', { autoExecute: config.arbitrage.autoExecute });
      res.json({ message: 'Configuration updated', config: config.arbitrage });
    } else {
      res.status(400).json({ error: 'Invalid configuration update' });
    }
  });

  return router;
}

