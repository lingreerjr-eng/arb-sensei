import { Pool } from 'pg';
import { getPool } from '../connection';
import { logger } from '../../utils/logger';
import { DatabaseError } from '../../utils/errors';

export interface MarketMapping {
  id: string;
  canonical_market_id: string;
  opinion_market_id: string | null;
  polymarket_market_id: string | null;
  market_title: string;
  similarity_score: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMarketMappingInput {
  canonical_market_id: string;
  opinion_market_id?: string;
  polymarket_market_id?: string;
  market_title: string;
  similarity_score?: number;
}

export class MarketMappingModel {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  async create(input: CreateMarketMappingInput): Promise<MarketMapping> {
    try {
      const result = await this.pool.query(
        `INSERT INTO market_mappings 
         (canonical_market_id, opinion_market_id, polymarket_market_id, market_title, similarity_score)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          input.canonical_market_id,
          input.opinion_market_id || null,
          input.polymarket_market_id || null,
          input.market_title,
          input.similarity_score || null,
        ]
      );
      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to create market mapping', { error, input });
      throw new DatabaseError('Failed to create market mapping', 'CREATE_ERROR');
    }
  }

  async findByCanonicalId(canonicalId: string): Promise<MarketMapping | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM market_mappings WHERE canonical_market_id = $1',
        [canonicalId]
      );
      return result.rows[0] || null;
    } catch (error: any) {
      logger.error('Failed to find market mapping', { error, canonicalId });
      throw new DatabaseError('Failed to find market mapping', 'QUERY_ERROR');
    }
  }

  async findByOpinionId(opinionId: string): Promise<MarketMapping | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM market_mappings WHERE opinion_market_id = $1',
        [opinionId]
      );
      return result.rows[0] || null;
    } catch (error: any) {
      logger.error('Failed to find market mapping by Opinion ID', { error, opinionId });
      throw new DatabaseError('Failed to find market mapping', 'QUERY_ERROR');
    }
  }

  async findByPolymarketId(polymarketId: string): Promise<MarketMapping | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM market_mappings WHERE polymarket_market_id = $1',
        [polymarketId]
      );
      return result.rows[0] || null;
    } catch (error: any) {
      logger.error('Failed to find market mapping by Polymarket ID', { error, polymarketId });
      throw new DatabaseError('Failed to find market mapping', 'QUERY_ERROR');
    }
  }

  async update(
    canonicalId: string,
    updates: Partial<CreateMarketMappingInput>
  ): Promise<MarketMapping> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.opinion_market_id !== undefined) {
        fields.push(`opinion_market_id = $${paramIndex++}`);
        values.push(updates.opinion_market_id);
      }
      if (updates.polymarket_market_id !== undefined) {
        fields.push(`polymarket_market_id = $${paramIndex++}`);
        values.push(updates.polymarket_market_id);
      }
      if (updates.market_title !== undefined) {
        fields.push(`market_title = $${paramIndex++}`);
        values.push(updates.market_title);
      }
      if (updates.similarity_score !== undefined) {
        fields.push(`similarity_score = $${paramIndex++}`);
        values.push(updates.similarity_score);
      }

      if (fields.length === 0) {
        return await this.findByCanonicalId(canonicalId) as MarketMapping;
      }

      values.push(canonicalId);
      const result = await this.pool.query(
        `UPDATE market_mappings 
         SET ${fields.join(', ')}
         WHERE canonical_market_id = $${paramIndex}
         RETURNING *`,
        values
      );
      return result.rows[0];
    } catch (error: any) {
      logger.error('Failed to update market mapping', { error, canonicalId, updates });
      throw new DatabaseError('Failed to update market mapping', 'UPDATE_ERROR');
    }
  }

  async getAll(): Promise<MarketMapping[]> {
    try {
      const result = await this.pool.query('SELECT * FROM market_mappings ORDER BY created_at DESC');
      return result.rows;
    } catch (error: any) {
      logger.error('Failed to get all market mappings', { error });
      throw new DatabaseError('Failed to get market mappings', 'QUERY_ERROR');
    }
  }
}

