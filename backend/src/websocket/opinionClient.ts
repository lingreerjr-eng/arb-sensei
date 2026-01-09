import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { WebSocketError } from '../utils/errors';
import { ReconnectHandler } from './reconnectHandler';

export interface OrderbookUpdate {
  marketId: string;
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  timestamp: number;
}

export interface OpinionMarket {
  id: string;
  title: string;
  description?: string;
  outcomes: string[];
}

export class OpinionWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectHandler: ReconnectHandler;
  private subscribedMarkets: Set<string> = new Set();
  private isConnected: boolean = false;
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
      logger.debug('Already connected to Opinion WebSocket');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        logger.info('Connecting to Opinion WebSocket', { url: config.opinion.wsUrl });
        this.ws = new WebSocket(config.opinion.wsUrl);

        this.ws.on('open', () => {
          logger.info('Connected to Opinion WebSocket');
          this.isConnected = true;
          this.reconnectHandler.reset();
          this.startHeartbeat();
          this.resubscribe();
          this.emit('connected');
          resolve();
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
          logger.error('Opinion WebSocket error', { error });
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          logger.warn('Opinion WebSocket closed', { code, reason: reason.toString() });
          this.isConnected = false;
          this.stopHeartbeat();
          this.emit('disconnected', { code, reason });
          this.reconnectHandler.scheduleReconnect(() => this.connect());
        });

        this.ws.on('pong', () => {
          logger.debug('Received pong from Opinion WebSocket');
        });
      } catch (error) {
        logger.error('Failed to create Opinion WebSocket connection', { error });
        reject(error);
      }
    });
  }

  private handleMessage(message: any): void {
    // Handle different message types from Opinion WebSocket
    if (message.type === 'orderbook') {
      this.handleOrderbookUpdate(message);
    } else if (message.type === 'price') {
      this.handlePriceUpdate(message);
    } else if (message.type === 'subscription_confirmed') {
      logger.debug('Subscription confirmed', { market: message.market });
    } else if (message.type === 'error') {
      logger.error('Opinion WebSocket error message', { message });
      this.emit('error', new WebSocketError(message.error || 'Unknown error'));
    }
  }

  private handleOrderbookUpdate(message: any): void {
    try {
      const update: OrderbookUpdate = {
        marketId: message.market_id || message.marketId,
        bids: this.normalizeOrderbookSide(message.bids || []),
        asks: this.normalizeOrderbookSide(message.asks || []),
        timestamp: message.timestamp || Date.now(),
      };
      this.emit('orderbook', update);
    } catch (error) {
      logger.error('Failed to handle orderbook update', { error, message });
    }
  }

  private handlePriceUpdate(message: any): void {
    try {
      this.emit('price', {
        marketId: message.market_id || message.marketId,
        outcome: message.outcome,
        price: parseFloat(message.price),
        timestamp: message.timestamp || Date.now(),
      });
    } catch (error) {
      logger.error('Failed to handle price update', { error, message });
    }
  }

  private normalizeOrderbookSide(side: any[]): Array<{ price: number; size: number }> {
    return side.map((entry) => ({
      price: parseFloat(entry.price || entry[0] || '0'),
      size: parseFloat(entry.size || entry.amount || entry[1] || '0'),
    }));
  }

  subscribeToMarket(marketId: string): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot subscribe: WebSocket not connected', { marketId });
      return;
    }

    if (this.subscribedMarkets.has(marketId)) {
      logger.debug('Already subscribed to market', { marketId });
      return;
    }

    try {
      const subscribeMessage = {
        type: 'subscribe',
        topic: 'orderbook',
        market_id: marketId,
      };

      this.ws.send(JSON.stringify(subscribeMessage));
      this.subscribedMarkets.add(marketId);
      logger.info('Subscribed to Opinion market', { marketId });
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
        topic: 'orderbook',
        market_id: marketId,
      };

      this.ws.send(JSON.stringify(unsubscribeMessage));
      this.subscribedMarkets.delete(marketId);
      logger.info('Unsubscribed from Opinion market', { marketId });
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
    this.subscribedMarkets.clear();
    logger.info('Disconnected from Opinion WebSocket');
  }

  isConnectedToServer(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

