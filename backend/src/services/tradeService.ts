import { TradeModel } from '../database/models/trade';
import { logger } from '../utils/logger';

export class TradeService {
  private tradeModel: TradeModel;

  constructor() {
    this.tradeModel = new TradeModel();
  }

  async getRecentTrades(limit: number = 100) {
    return await this.tradeModel.getRecent(limit);
  }

  async getTradesByOpportunity(opportunityId: string) {
    return await this.tradeModel.getByOpportunityId(opportunityId);
  }

  async getTradeById(tradeId: string) {
    return await this.tradeModel.findById(tradeId);
  }
}

