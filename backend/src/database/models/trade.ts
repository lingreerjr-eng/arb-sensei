import { Pool } from 'pg';
import { getPool } from '../connection';
import { logger } from '../../utils/logger';
import { DatabaseError } from '../../utils/errors';

export type Platform = 'opinion' | 'polymarket';
export type TradeSide = 'yes' | 'no';
export type TradeStatus = 'pending' | 'filled' | 'cancelled' | 'failed';

export interface Trade {
  id: string;
  arbitrage_opportunity_id: string | null;
  platform: Platform;
  market_id: string;
  side: TradeSide;
  amount: number;
  price: number;
  order_id: string | null;
  status: TradeStatus;
  executed_at: Date | null;
  created_at: Date;
  error_message: string | null;
}

export interface CreateTradeInput {
  arbitrage_opportunity_id?: string;
  platform: Platform;
  market_id: string;
  side: TradeSide;
  amount: number;
  price: number;
  order_id?: string;
}

export class TradeModel {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  async create(input: CreateTradeInput): Promise<Trade> {
    try {
      const result = await this.pool.query(
        `INSERT INTO trades 
         (arbitrage_opportunity_id, platform, market_id, side, amount, price, order_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          input.arbitrage_opportunity_id || null,
          input.platform,
          input.market_id,
          input.side,
          input.amount,
          input.price,
          input.order_id || null,
        ]
      );
      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to create trade', { error, input });
      throw new DatabaseError('Failed to create trade', 'CREATE_ERROR');
    }
  }

  async findById(id: string): Promise<Trade | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM trades WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error: any) {
      logger.error('Failed to find trade', { error, id });
      throw new DatabaseError('Failed to find trade', 'QUERY_ERROR');
    }
  }

  async updateStatus(
    id: string,
    status: TradeStatus,
    orderId?: string,
    errorMessage?: string
  ): Promise<Trade> {
    try {
      const updates: string[] = ['status = $1'];
      const values: any[] = [status];
      let paramIndex = 2;

      if (orderId !== undefined) {
        updates.push(`order_id = $${paramIndex++}`);
        values.push(orderId);
      }

      if (status === 'filled') {
        updates.push(`executed_at = CURRENT_TIMESTAMP`);
      }

      if (errorMessage !== undefined) {
        updates.push(`error_message = $${paramIndex++}`);
        values.push(errorMessage);
      }

      values.push(id);
      const result = await this.pool.query(
        `UPDATE trades 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );
      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to update trade status', { error, id, status });
      throw new DatabaseError('Failed to update trade status', 'UPDATE_ERROR');
    }
  }

  async getByOpportunityId(opportunityId: string): Promise<Trade[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM trades WHERE arbitrage_opportunity_id = $1 ORDER BY created_at DESC',
        [opportunityId]
      );
      return result.rows;
    } catch (error: any) {
      logger.error('Failed to get trades by opportunity', { error, opportunityId });
      throw new DatabaseError('Failed to get trades', 'QUERY_ERROR');
    }
  }

  async getRecent(limit: number = 100): Promise<Trade[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM trades 
         ORDER BY created_at DESC 
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    } catch (error: any) {
      logger.error('Failed to get recent trades', { error });
      throw new DatabaseError('Failed to get trades', 'QUERY_ERROR');
    }
  }
}

