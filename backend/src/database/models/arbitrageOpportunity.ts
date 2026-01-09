import { Pool } from 'pg';
import { getPool } from '../connection';
import { logger } from '../../utils/logger';
import { DatabaseError } from '../../utils/errors';

export type OpportunityStatus = 'detected' | 'executing' | 'executed' | 'expired';

export interface ArbitrageOpportunity {
  id: string;
  canonical_market_id: string;
  combined_cost: number;
  profit_potential: number;
  opinion_price_yes: number | null;
  opinion_price_no: number | null;
  polymarket_price_yes: number | null;
  polymarket_price_no: number | null;
  liquidity_opinion: number | null;
  liquidity_polymarket: number | null;
  detected_at: Date;
  status: OpportunityStatus;
  expires_at: Date | null;
}

export interface CreateOpportunityInput {
  canonical_market_id: string;
  combined_cost: number;
  profit_potential: number;
  opinion_price_yes?: number;
  opinion_price_no?: number;
  polymarket_price_yes?: number;
  polymarket_price_no?: number;
  liquidity_opinion?: number;
  liquidity_polymarket?: number;
  expires_at?: Date;
}

export class ArbitrageOpportunityModel {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  async create(input: CreateOpportunityInput): Promise<ArbitrageOpportunity> {
    try {
      const result = await this.pool.query(
        `INSERT INTO arbitrage_opportunities 
         (canonical_market_id, combined_cost, profit_potential, 
          opinion_price_yes, opinion_price_no, polymarket_price_yes, polymarket_price_no,
          liquidity_opinion, liquidity_polymarket, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          input.canonical_market_id,
          input.combined_cost,
          input.profit_potential,
          input.opinion_price_yes || null,
          input.opinion_price_no || null,
          input.polymarket_price_yes || null,
          input.polymarket_price_no || null,
          input.liquidity_opinion || null,
          input.liquidity_polymarket || null,
          input.expires_at || null,
        ]
      );
      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to create arbitrage opportunity', { error, input });
      throw new DatabaseError('Failed to create arbitrage opportunity', 'CREATE_ERROR');
    }
  }

  async findById(id: string): Promise<ArbitrageOpportunity | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM arbitrage_opportunities WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } catch (error: any) {
      logger.error('Failed to find arbitrage opportunity', { error, id });
      throw new DatabaseError('Failed to find arbitrage opportunity', 'QUERY_ERROR');
    }
  }

  async updateStatus(id: string, status: OpportunityStatus): Promise<ArbitrageOpportunity> {
    try {
      const result = await this.pool.query(
        `UPDATE arbitrage_opportunities 
         SET status = $1
         WHERE id = $2
         RETURNING *`,
        [status, id]
      );
      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to update opportunity status', { error, id, status });
      throw new DatabaseError('Failed to update opportunity status', 'UPDATE_ERROR');
    }
  }

  async getRecent(limit: number = 100): Promise<ArbitrageOpportunity[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM arbitrage_opportunities 
         ORDER BY detected_at DESC 
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    } catch (error: any) {
      logger.error('Failed to get recent opportunities', { error });
      throw new DatabaseError('Failed to get opportunities', 'QUERY_ERROR');
    }
  }

  async getActive(): Promise<ArbitrageOpportunity[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM arbitrage_opportunities 
         WHERE status IN ('detected', 'executing')
         AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY detected_at DESC`
      );
      return result.rows;
    } catch (error: any) {
      logger.error('Failed to get active opportunities', { error });
      throw new DatabaseError('Failed to get active opportunities', 'QUERY_ERROR');
    }
  }
}

