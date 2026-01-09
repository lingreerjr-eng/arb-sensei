import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { WebSocketError } from '../utils/errors';
import { ReconnectHandler } from './reconnectHandler';

export interface PolymarketOrderbookUpdate {
  marketId: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
  timestamp: number;
}

export interface PolymarketMarket {
  condition_id: string;
  question: string;
  description?: string;
  outcomes: Array<{ outcome: string; outcome_id: string }>;
}

export class PolymarketWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectHandler: ReconnectHandler;
  private subscribedMarkets: Set<string> = new Set();
  private isConnected: boolean = false;
  private isAuthenticated: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs = 30000; // 30 seconds

  constructor() {
    super();
    this.reconnectHandler = new ReconnectHandler({
      maxRetries: 10,
      initialDelay: 1000,
      maxDelay: 30000,
    });

    this.reconnectHandler.on('maxRetriesReached', () => {
      this.emit('error', new WebSocketError('Max reconnection attempts reached'));
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      logger.debug('Already connected to Polymarket WebSocket');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        logger.info('Connecting to Polymarket WebSocket', { url: config.polymarket.wsUrl });
        this.ws = new WebSocket(config.polymarket.wsUrl);

        this.ws.on('open', async () => {
          logger.info('Connected to Polymarket WebSocket');
          this.isConnected = true;
          this.reconnectHandler.reset();
          this.startHeartbeat();
          
          // Authenticate after connection
          try {
            await this.authenticate();
            this.resubscribe();
            this.emit('connected');
            resolve();
          } catch (error) {
            logger.error('Failed to authenticate with Polymarket', { error });
            reject(error);
          }
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            logger.error('Failed to parse WebSocket message', { error, data });
          }
        });

        this.ws.on('error', (error) => {
          logger.error('Polymarket WebSocket error', { error });
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          logger.warn('Polymarket WebSocket closed', { code, reason: reason.toString() });
          this.isConnected = false;
          this.isAuthenticated = false;
          this.stopHeartbeat();
          this.emit('disconnected', { code, reason });
          this.reconnectHandler.scheduleReconnect(() => this.connect());
        });

        this.ws.on('pong', () => {
          logger.debug('Received pong from Polymarket WebSocket');
        });
      } catch (error) {
        logger.error('Failed to create Polymarket WebSocket connection', { error });
        reject(error);
      }
    });
  }

  private async authenticate(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new WebSocketError('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      // Polymarket authentication typically uses API key in headers or initial message
      // Adjust based on actual Polymarket WebSocket API requirements
      const authMessage = {
        type: 'auth',
        api_key: config.polymarket.apiKey,
      };

      const timeout = setTimeout(() => {
        reject(new WebSocketError('Authentication timeout'));
      }, 5000);

      const messageHandler = (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth_success' || message.type === 'authenticated') {
            clearTimeout(timeout);
            this.ws?.off('message', messageHandler);
            this.isAuthenticated = true;
            logger.info('Authenticated with Polymarket WebSocket');
            resolve();
          } else if (message.type === 'auth_error' || message.type === 'error') {
            clearTimeout(timeout);
            this.ws?.off('message', messageHandler);
            reject(new WebSocketError(message.error || 'Authentication failed'));
          }
        } catch (error) {
          // Not an auth response, continue waiting
        }
      };

      this.ws.on('message', messageHandler);
      this.ws.send(JSON.stringify(authMessage));
    });
  }

  private handleMessage(message: any): void {
    // Handle different message types from Polymarket WebSocket
    if (message.channel === 'orderbook' || message.type === 'orderbook') {
      this.handleOrderbookUpdate(message);
    } else if (message.channel === 'market' || message.type === 'market') {
      this.handleMarketUpdate(message);
    } else if (message.type === 'subscription_success') {
      logger.debug('Subscription confirmed', { market: message.market });
    } else if (message.type === 'error' || message.error) {
      logger.error('Polymarket WebSocket error message', { message });
      this.emit('error', new WebSocketError(message.error || 'Unknown error'));
    }
  }

  private handleOrderbookUpdate(message: any): void {
    try {
      const marketId = message.condition_id || message.market_id || message.marketId;
      const update: PolymarketOrderbookUpdate = {
        marketId,
        bids: this.normalizeOrderbookSide(message.bids || []),
        asks: this.normalizeOrderbookSide(message.asks || []),
        timestamp: message.timestamp || Date.now(),
      };
      this.emit('orderbook', update);
    } catch (error) {
      logger.error('Failed to handle orderbook update', { error, message });
    }
  }

  private handleMarketUpdate(message: any): void {
    try {
      this.emit('market', {
        conditionId: message.condition_id || message.market_id,
        data: message,
        timestamp: message.timestamp || Date.now(),
      });
    } catch (error) {
      logger.error('Failed to handle market update', { error, message });
    }
  }

  private normalizeOrderbookSide(side: any[]): Array<{ price: string; size: string }> {
    return side.map((entry) => {
      if (Array.isArray(entry)) {
        return {
          price: entry[0]?.toString() || '0',
          size: entry[1]?.toString() || '0',
        };
      }
      return {
        price: (entry.price || entry.priceInEth || '0').toString(),
        size: (entry.size || entry.sizeInEth || '0').toString(),
      };
    });
  }

  subscribeToMarket(marketId: string): void {
    if (!this.isConnected || !this.isAuthenticated || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot subscribe: WebSocket not connected/authenticated', { marketId });
      return;
    }

    if (this.subscribedMarkets.has(marketId)) {
      logger.debug('Already subscribed to market', { marketId });
      return;
    }

    try {
      // Polymarket subscription format - adjust based on actual API
      const subscribeMessage = {
        type: 'subscribe',
        channel: 'orderbook',
        condition_id: marketId,
      };

      this.ws.send(JSON.stringify(subscribeMessage));
      this.subscribedMarkets.add(marketId);
      logger.info('Subscribed to Polymarket market', { marketId });
    } catch (error) {
      logger.error('Failed to subscribe to market', { error, marketId });
      throw new WebSocketError('Failed to subscribe to market');
    }
  }

  unsubscribeFromMarket(marketId: string): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!this.subscribedMarkets.has(marketId)) {
      return;
    }

    try {
      const unsubscribeMessage = {
        type: 'unsubscribe',
        channel: 'orderbook',
        condition_id: marketId,
      };

      this.ws.send(JSON.stringify(unsubscribeMessage));
      this.subscribedMarkets.delete(marketId);
      logger.info('Unsubscribed from Polymarket market', { marketId });
    } catch (error) {
      logger.error('Failed to unsubscribe from market', { error, marketId });
    }
  }

  private resubscribe(): void {
    for (const marketId of this.subscribedMarkets) {
      this.subscribeToMarket(marketId);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async disconnect(): Promise<void> {
    this.reconnectHandler.cancel();
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.isAuthenticated = false;
    this.subscribedMarkets.clear();
    logger.info('Disconnected from Polymarket WebSocket');
  }

  isConnectedToServer(): boolean {
    return this.isConnected && this.isAuthenticated && this.ws?.readyState === WebSocket.OPEN;
  }
}

