import axios from 'axios';
import { ethers } from 'ethers';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { TradingError } from '../utils/errors';
import { Order, PlaceOrderParams, CancelOrderParams, Position } from './types';

export class OpinionTrader {
  private apiUrl: string;
  private apiKey: string;
  private privateKey: string;
  private wallet: ethers.Wallet | null = null;

  constructor() {
    this.apiUrl = config.opinion.apiUrl;
    this.apiKey = config.opinion.apiKey;
    this.privateKey = config.opinion.privateKey;
    this.initializeWallet();
  }

  private initializeWallet(): void {
    try {
      // Initialize wallet from private key for signing transactions
      // Adjust based on actual Opinion CLOB SDK requirements
      this.wallet = new ethers.Wallet(this.privateKey);
      logger.info('Opinion trader wallet initialized');
    } catch (error) {
      logger.error('Failed to initialize Opinion wallet', { error });
      throw new TradingError('Failed to initialize wallet', 'WALLET_ERROR');
    }
  }

  async placeOrder(params: PlaceOrderParams): Promise<Order> {
    try {
      logger.info('Placing Opinion order', { params });

      // Adjust API call based on actual Opinion CLOB API
      const response = await axios.post(
        `${this.apiUrl}/orders`,
        {
          market_id: params.marketId,
          side: params.side,
          outcome: params.outcome,
          amount: params.amount.toString(),
          price: params.price.toString(),
          type: params.type || 'limit',
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const orderData = response.data;
      const order: Order = {
        id: orderData.id || orderData.order_id,
        marketId: params.marketId,
        side: params.side,
        outcome: params.outcome,
        amount: params.amount,
        price: params.price,
        type: params.type || 'limit',
        status: 'pending',
        createdAt: new Date(),
      };

      logger.info('Opinion order placed successfully', { orderId: order.id });
      return order;
    } catch (error: any) {
      logger.error('Failed to place Opinion order', { error, params });
      throw new TradingError(
        `Failed to place order: ${error.message}`,
        'ORDER_PLACE_ERROR'
      );
    }
  }

  async cancelOrder(params: CancelOrderParams): Promise<void> {
    try {
      logger.info('Cancelling Opinion order', { params });

      await axios.delete(`${this.apiUrl}/orders/${params.orderId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      logger.info('Opinion order cancelled successfully', { orderId: params.orderId });
    } catch (error: any) {
      logger.error('Failed to cancel Opinion order', { error, params });
      throw new TradingError(
        `Failed to cancel order: ${error.message}`,
        'ORDER_CANCEL_ERROR'
      );
    }
  }

  async getOrderStatus(orderId: string): Promise<Order> {
    try {
      const response = await axios.get(`${this.apiUrl}/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      const orderData = response.data;
      return {
        id: orderData.id || orderData.order_id,
        marketId: orderData.market_id,
        side: orderData.side,
        outcome: orderData.outcome,
        amount: parseFloat(orderData.amount),
        price: parseFloat(orderData.price),
        type: orderData.type || 'limit',
        status: this.mapOrderStatus(orderData.status),
        filledAmount: orderData.filled_amount ? parseFloat(orderData.filled_amount) : undefined,
        createdAt: new Date(orderData.created_at),
        updatedAt: orderData.updated_at ? new Date(orderData.updated_at) : undefined,
      };
    } catch (error: any) {
      logger.error('Failed to get Opinion order status', { error, orderId });
      throw new TradingError(
        `Failed to get order status: ${error.message}`,
        'ORDER_STATUS_ERROR'
      );
    }
  }

  async getPositions(marketId?: string): Promise<Position[]> {
    try {
      const url = marketId
        ? `${this.apiUrl}/positions?market_id=${marketId}`
        : `${this.apiUrl}/positions`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return response.data.map((pos: any) => ({
        marketId: pos.market_id,
        outcome: pos.outcome,
        size: parseFloat(pos.size),
        averagePrice: parseFloat(pos.average_price),
      }));
    } catch (error: any) {
      logger.error('Failed to get Opinion positions', { error, marketId });
      throw new TradingError(
        `Failed to get positions: ${error.message}`,
        'POSITIONS_ERROR'
      );
    }
  }

  async getOrderbook(marketId: string): Promise<{ bids: Array<{ price: number; size: number }>; asks: Array<{ price: number; size: number }> }> {
    try {
      const response = await axios.get(`${this.apiUrl}/markets/${marketId}/orderbook`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return {
        bids: (response.data.bids || []).map((b: any) => ({
          price: parseFloat(b.price),
          size: parseFloat(b.size),
        })),
        asks: (response.data.asks || []).map((a: any) => ({
          price: parseFloat(a.price),
          size: parseFloat(a.size),
        })),
      };
    } catch (error: any) {
      logger.error('Failed to get Opinion orderbook', { error, marketId });
      throw new TradingError(
        `Failed to get orderbook: ${error.message}`,
        'ORDERBOOK_ERROR'
      );
    }
  }

  private mapOrderStatus(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      pending: 'pending',
      open: 'open',
      filled: 'filled',
      cancelled: 'cancelled',
      failed: 'failed',
    };
    return statusMap[status.toLowerCase()] || 'pending';
  }
}

