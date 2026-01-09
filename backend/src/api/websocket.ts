import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface WebSocketMessage {
  type: string;
  data?: any;
  error?: string;
}

export class FrontendWebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(server: HTTPServer) {
    super();
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    logger.info('Frontend WebSocket server initialized');
  }

  private handleConnection(ws: WebSocket): void {
    this.clients.add(ws);
    logger.info('Frontend WebSocket client connected', { clients: this.clients.size });

    // Send welcome message
    this.send(ws, {
      type: 'connected',
      data: { message: 'Connected to Arbitrage Sensei backend' },
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        this.handleMessage(ws, message);
      } catch (error) {
        logger.error('Failed to parse WebSocket message', { error, data });
        this.send(ws, {
          type: 'error',
          error: 'Invalid message format',
        });
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      logger.info('Frontend WebSocket client disconnected', { clients: this.clients.size });
    });

    ws.on('error', (error) => {
      logger.error('Frontend WebSocket error', { error });
      this.clients.delete(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: WebSocketMessage): void {
    logger.debug('Received WebSocket message', { type: message.type });

    switch (message.type) {
      case 'subscribe':
        // Handle subscription requests
        this.emit('subscribe', { ws, topics: message.data?.topics || [] });
        break;
      case 'unsubscribe':
        // Handle unsubscription requests
        this.emit('unsubscribe', { ws, topics: message.data?.topics || [] });
        break;
      default:
        logger.warn('Unknown WebSocket message type', { type: message.type });
    }
  }

  broadcast(message: WebSocketMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  send(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcastOpportunity(opportunity: any): void {
    this.broadcast({
      type: 'arbitrage_opportunity',
      data: opportunity,
    });
  }

  broadcastMarketUpdate(update: any): void {
    this.broadcast({
      type: 'market_update',
      data: update,
    });
  }
}

