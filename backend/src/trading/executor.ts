import { EventEmitter } from 'events';
import { OpinionTrader } from './opinionTrader';
import { PolymarketTrader } from './polymarketTrader';
import { ArbitrageOpportunityModel } from '../database/models/arbitrageOpportunity';
import { TradeModel, CreateTradeInput } from '../database/models/trade';
import { ArbitrageOpportunity } from '../arbitrage/types';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { TradingError } from '../utils/errors';

export interface ExecutionResult {
  success: boolean;
  opportunityId: string;
  opinionOrderId?: string;
  polymarketOrderId?: string;
  error?: string;
  trades: Array<{ id: string; platform: string; orderId: string }>;
}

export class TradeExecutor extends EventEmitter {
  private opinionTrader: OpinionTrader;
  private polymarketTrader: PolymarketTrader;
  private opportunityModel: ArbitrageOpportunityModel;
  private tradeModel: TradeModel;
  private executingOpportunities: Set<string> = new Set();

  constructor(opinionTrader: OpinionTrader, polymarketTrader: PolymarketTrader) {
    super();
    this.opinionTrader = opinionTrader;
    this.polymarketTrader = polymarketTrader;
    this.opportunityModel = new ArbitrageOpportunityModel();
    this.tradeModel = new TradeModel();
  }

  async executeArbitrage(opportunity: ArbitrageOpportunity & { id: string }): Promise<ExecutionResult> {
    // Prevent duplicate executions
    if (this.executingOpportunities.has(opportunity.id)) {
      throw new TradingError('Opportunity is already being executed', 'DUPLICATE_EXECUTION');
    }

    this.executingOpportunities.add(opportunity.id);

    try {
      // Update opportunity status to executing
      await this.opportunityModel.updateStatus(opportunity.id, 'executing');

      logger.info('Executing arbitrage opportunity', {
        opportunityId: opportunity.id,
        canonicalMarketId: opportunity.canonicalMarketId,
        combinedCost: opportunity.combinedCost,
        recommendedSize: opportunity.recommendedSize,
      });

      // Determine which sides to trade
      const opinionSide = opportunity.combinedCost < 0.98 ? 'yes' : 'no';
      const polymarketSide = opportunity.combinedCost < 0.98 ? 'no' : 'yes';

      // Calculate prices (use best available prices)
      const opinionPrice = opinionSide === 'yes' ? opportunity.opinionYesPrice : opportunity.opinionNoPrice;
      const polymarketPrice = polymarketSide === 'yes' ? opportunity.polymarketYesPrice : opportunity.polymarketNoPrice;

      // Validate sizes and prices
      if (opportunity.recommendedSize > config.arbitrage.maxPositionSize) {
        throw new TradingError('Recommended size exceeds maximum position size', 'SIZE_LIMIT_EXCEEDED');
      }

      // Place orders simultaneously
      const [opinionOrder, polymarketOrder] = await Promise.allSettled([
        this.opinionTrader.placeOrder({
          marketId: opportunity.opinionMarketId,
          side: 'buy',
          outcome: opinionSide,
          amount: opportunity.recommendedSize,
          price: opinionPrice,
        }),
        this.polymarketTrader.placeOrder({
          marketId: opportunity.polymarketMarketId,
          side: 'buy',
          outcome: polymarketSide,
          amount: opportunity.recommendedSize,
          price: polymarketPrice,
        }),
      ]);

      // Check results
      const opinionResult = opinionOrder.status === 'fulfilled' ? opinionOrder.value : null;
      const polymarketResult = polymarketOrder.status === 'fulfilled' ? polymarketOrder.value : null;

      // If both orders succeeded, create trade records
      if (opinionResult && polymarketResult) {
        const opinionTrade = await this.tradeModel.create({
          arbitrage_opportunity_id: opportunity.id,
          platform: 'opinion',
          market_id: opportunity.opinionMarketId,
          side: opinionSide,
          amount: opportunity.recommendedSize,
          price: opinionPrice,
          order_id: opinionResult.id,
        });

        const polymarketTrade = await this.tradeModel.create({
          arbitrage_opportunity_id: opportunity.id,
          platform: 'polymarket',
          market_id: opportunity.polymarketMarketId,
          side: polymarketSide,
          amount: opportunity.recommendedSize,
          price: polymarketPrice,
          order_id: polymarketResult.id,
        });

        // Update opportunity status to executed
        await this.opportunityModel.updateStatus(opportunity.id, 'executed');

        const result: ExecutionResult = {
          success: true,
          opportunityId: opportunity.id,
          opinionOrderId: opinionResult.id,
          polymarketOrderId: polymarketResult.id,
          trades: [
            { id: opinionTrade.id, platform: 'opinion', orderId: opinionResult.id },
            { id: polymarketTrade.id, platform: 'polymarket', orderId: polymarketResult.id },
          ],
        };

        this.emit('execution_success', result);
        logger.info('Arbitrage execution successful', result);
        return result;
      } else {
        // One or both orders failed - cancel any successful orders
        const errors: string[] = [];

        if (opinionOrder.status === 'rejected') {
          errors.push(`Opinion order failed: ${opinionOrder.reason}`);
        } else if (opinionResult) {
          // Cancel Opinion order
          try {
            await this.opinionTrader.cancelOrder({ orderId: opinionResult.id });
          } catch (error) {
            logger.error('Failed to cancel Opinion order', { error, orderId: opinionResult.id });
          }
        }

        if (polymarketOrder.status === 'rejected') {
          errors.push(`Polymarket order failed: ${polymarketOrder.reason}`);
        } else if (polymarketResult) {
          // Cancel Polymarket order
          try {
            await this.polymarketTrader.cancelOrder({ orderId: polymarketResult.id });
          } catch (error) {
            logger.error('Failed to cancel Polymarket order', { error, orderId: polymarketResult.id });
          }
        }

        // Update opportunity status to expired
        await this.opportunityModel.updateStatus(opportunity.id, 'expired');

        const result: ExecutionResult = {
          success: false,
          opportunityId: opportunity.id,
          error: errors.join('; '),
          trades: [],
        };

        this.emit('execution_failed', result);
        logger.error('Arbitrage execution failed', result);
        throw new TradingError(`Execution failed: ${result.error}`, 'EXECUTION_FAILED');
      }
    } catch (error: any) {
      logger.error('Arbitrage execution error', { error, opportunityId: opportunity.id });
      
      // Update opportunity status
      try {
        await this.opportunityModel.updateStatus(opportunity.id, 'expired');
      } catch (updateError) {
        logger.error('Failed to update opportunity status', { error: updateError });
      }

      throw error;
    } finally {
      this.executingOpportunities.delete(opportunity.id);
    }
  }

  async cancelExecution(opportunityId: string): Promise<void> {
    try {
      // Find trades for this opportunity
      const trades = await this.tradeModel.getByOpportunityId(opportunityId);

      // Cancel all pending orders
      for (const trade of trades) {
        if (trade.status === 'pending' && trade.order_id) {
          try {
            if (trade.platform === 'opinion') {
              await this.opinionTrader.cancelOrder({ orderId: trade.order_id });
            } else {
              await this.polymarketTrader.cancelOrder({ orderId: trade.order_id });
            }
            await this.tradeModel.updateStatus(trade.id, 'cancelled');
          } catch (error) {
            logger.error('Failed to cancel order', { error, trade });
          }
        }
      }

      // Update opportunity status
      await this.opportunityModel.updateStatus(opportunityId, 'expired');
      logger.info('Execution cancelled', { opportunityId });
    } catch (error) {
      logger.error('Failed to cancel execution', { error, opportunityId });
      throw error;
    }
  }

  async checkOrderStatuses(opportunityId: string): Promise<void> {
    try {
      const trades = await this.tradeModel.getByOpportunityId(opportunityId);

      for (const trade of trades) {
        if (trade.status === 'pending' && trade.order_id) {
          try {
            let orderStatus;
            if (trade.platform === 'opinion') {
              orderStatus = await this.opinionTrader.getOrderStatus(trade.order_id);
            } else {
              orderStatus = await this.polymarketTrader.getOrderStatus(trade.order_id);
            }

            // Update trade status
            if (orderStatus.status === 'filled') {
              await this.tradeModel.updateStatus(trade.id, 'filled', orderStatus.id);
            } else if (orderStatus.status === 'cancelled' || orderStatus.status === 'failed') {
              await this.tradeModel.updateStatus(trade.id, orderStatus.status, orderStatus.id);
            }
          } catch (error) {
            logger.error('Failed to check order status', { error, trade });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to check order statuses', { error, opportunityId });
    }
  }
}

