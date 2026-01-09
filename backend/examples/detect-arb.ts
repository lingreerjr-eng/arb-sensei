/**
 * Example script demonstrating arbitrage detection
 * 
 * This script shows how to:
 * 1. Connect to both platforms
 * 2. Match markets
 * 3. Monitor prices
 * 4. Detect arbitrage opportunities
 */

import { OpinionWebSocketClient } from '../src/websocket/opinionClient';
import { PolymarketWebSocketClient } from '../src/websocket/polymarketClient';
import { MarketMatcher } from '../src/matching/marketMatcher';
import { ArbitrageDetector } from '../src/arbitrage/detector';
import { logger } from '../src/utils/logger';
import { testConnection } from '../src/database/connection';

async function detectArbitrage() {
  try {
    logger.info('Starting arbitrage detection example...');

    // 1. Test database connection
    logger.info('Testing database connection...');
    await testConnection();

    // 2. Initialize WebSocket clients
    logger.info('Initializing WebSocket clients...');
    const opinionClient = new OpinionWebSocketClient();
    const polymarketClient = new PolymarketWebSocketClient();

    // 3. Connect to both platforms
    logger.info('Connecting to Opinion.trade...');
    await opinionClient.connect();

    logger.info('Connecting to Polymarket...');
    await polymarketClient.connect();

    // 4. Initialize market matcher
    logger.info('Initializing market matcher...');
    const marketMatcher = new MarketMatcher();

    // 5. Sync markets (match markets across platforms)
    logger.info('Syncing markets from both platforms...');
    await marketMatcher.syncMarkets();

    // 6. Initialize arbitrage detector
    logger.info('Initializing arbitrage detector...');
    const detector = new ArbitrageDetector(opinionClient, polymarketClient, marketMatcher);

    // 7. Set up opportunity handler
    detector.on('opportunity', (opportunity) => {
      logger.info('═══════════════════════════════════════════════════════');
      logger.info('ARBITRAGE OPPORTUNITY DETECTED!');
      logger.info('═══════════════════════════════════════════════════════');
      logger.info(`Canonical Market ID: ${opportunity.canonicalMarketId}`);
      logger.info(`Combined Cost: ${opportunity.combinedCost.toFixed(4)}`);
      logger.info(`Profit Potential: ${(opportunity.profitPotential * 100).toFixed(2)}%`);
      logger.info(`Recommended Size: $${opportunity.recommendedSize.toFixed(2)}`);
      logger.info(`Opinion YES: ${opportunity.opinionYesPrice.toFixed(4)}`);
      logger.info(`Opinion NO: ${opportunity.opinionNoPrice.toFixed(4)}`);
      logger.info(`Polymarket YES: ${opportunity.polymarketYesPrice.toFixed(4)}`);
      logger.info(`Polymarket NO: ${opportunity.polymarketNoPrice.toFixed(4)}`);
      logger.info(`Opinion Liquidity: $${opportunity.opinionLiquidity.toFixed(2)}`);
      logger.info(`Polymarket Liquidity: $${opportunity.polymarketLiquidity.toFixed(2)}`);
      logger.info(`Detected At: ${opportunity.detectedAt.toISOString()}`);
      logger.info('═══════════════════════════════════════════════════════');
    });

    // 8. Start monitoring
    logger.info('Starting arbitrage detection monitoring...');
    await detector.startMonitoring();

    logger.info('Arbitrage detection is now running. Waiting for opportunities...');
    logger.info('Press Ctrl+C to stop.');

    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('Stopping arbitrage detection...');
      detector.stopMonitoring();
      await opinionClient.disconnect();
      await polymarketClient.disconnect();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Error in arbitrage detection example', { error });
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  detectArbitrage();
}

export { detectArbitrage };

