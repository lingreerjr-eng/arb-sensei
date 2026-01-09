import express, { Express } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { FrontendWebSocketServer } from './websocket';
import { createRoutes } from './routes';
import { OpinionWebSocketClient } from '../websocket/opinionClient';
import { PolymarketWebSocketClient } from '../websocket/polymarketClient';
import { MarketMatcher } from '../matching/marketMatcher';
import { ArbitrageDetector } from '../arbitrage/detector';
import { OpinionTrader } from '../trading/opinionTrader';
import { PolymarketTrader } from '../trading/polymarketTrader';
import { TradeExecutor } from '../trading/executor';
import { MarketService } from '../services/marketService';
import { TradeService } from '../services/tradeService';
import { testConnection } from '../database/connection';

export class APIServer {
  private app: Express;
  private server: ReturnType<typeof createServer>;
  private wsServer: FrontendWebSocketServer;
  private opinionClient: OpinionWebSocketClient;
  private polymarketClient: PolymarketWebSocketClient;
  private marketMatcher: MarketMatcher;
  private detector: ArbitrageDetector;
  private executor: TradeExecutor;
  private marketService: MarketService;
  private tradeService: TradeService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wsServer = new FrontendWebSocketServer(this.server);

    // Initialize clients
    this.opinionClient = new OpinionWebSocketClient();
    this.polymarketClient = new PolymarketWebSocketClient();
    this.marketMatcher = new MarketMatcher();

    // Initialize trading
    const opinionTrader = new OpinionTrader();
    const polymarketTrader = new PolymarketTrader();
    this.executor = new TradeExecutor(opinionTrader, polymarketTrader);

    // Initialize detector
    this.detector = new ArbitrageDetector(
      this.opinionClient,
      this.polymarketClient,
      this.marketMatcher
    );

    // Initialize services
    this.marketService = new MarketService(this.marketMatcher);
    this.tradeService = new TradeService();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug('HTTP request', { method: req.method, path: req.path });
      next();
    });
  }

  private setupRoutes(): void {
    this.app.use('/api', createRoutes(this.marketService, this.tradeService, this.detector, this.executor));
    
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Arbitrage Sensei Backend',
        version: '1.0.0',
        endpoints: {
          health: '/api/health',
          opportunities: '/api/opportunities',
          markets: '/api/markets',
          trades: '/api/trades',
          websocket: '/ws',
        },
      });
    });
  }

  private setupEventHandlers(): void {
    // Handle arbitrage opportunities
    this.detector.on('opportunity', (opportunity) => {
      logger.info('Arbitrage opportunity detected, broadcasting to frontend', {
        opportunityId: opportunity.id,
      });
      this.wsServer.broadcastOpportunity(opportunity);

      // Auto-execute if enabled
      if (config.arbitrage.autoExecute) {
        this.executor
          .executeArbitrage(opportunity)
          .then((result) => {
            logger.info('Auto-execution completed', result);
          })
          .catch((error) => {
            logger.error('Auto-execution failed', { error });
          });
      }
    });

    // Handle execution results
    this.executor.on('execution_success', (result) => {
      this.wsServer.broadcast({
        type: 'execution_success',
        data: result,
      });
    });

    this.executor.on('execution_failed', (result) => {
      this.wsServer.broadcast({
        type: 'execution_failed',
        data: result,
      });
    });
  }

  async start(): Promise<void> {
    try {
      // Test database connection
      await testConnection();

      // Connect WebSocket clients
      logger.info('Connecting to Opinion WebSocket...');
      await this.opinionClient.connect();

      logger.info('Connecting to Polymarket WebSocket...');
      await this.polymarketClient.connect();

      // Start arbitrage detection
      logger.info('Starting arbitrage detection...');
      await this.detector.startMonitoring();

      // Start HTTP server
      const port = config.server.port;
      this.server.listen(port, () => {
        logger.info(`API server started on port ${port}`);
        logger.info(`WebSocket server available at ws://localhost:${port}/ws`);
      });
    } catch (error) {
      logger.error('Failed to start server', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping server...');

    // Stop detector
    this.detector.stopMonitoring();

    // Disconnect WebSocket clients
    await this.opinionClient.disconnect();
    await this.polymarketClient.disconnect();

    // Close HTTP server
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Server stopped');
        resolve();
      });
    });
  }
}

