import { MarketMappingModel } from '../database/models/marketMapping';
import { ArbitrageOpportunityModel } from '../database/models/arbitrageOpportunity';
import { MarketMatcher } from '../matching/marketMatcher';
import { logger } from '../utils/logger';

export class MarketService {
  private mappingModel: MarketMappingModel;
  private opportunityModel: ArbitrageOpportunityModel;
  private marketMatcher: MarketMatcher;

  constructor(marketMatcher: MarketMatcher) {
    this.mappingModel = new MarketMappingModel();
    this.opportunityModel = new ArbitrageOpportunityModel();
    this.marketMatcher = marketMatcher;
  }

  async syncMarkets(): Promise<void> {
    logger.info('Syncing markets from both platforms');
    await this.marketMatcher.syncMarkets();
  }

  async getMatchedMarkets() {
    return await this.marketMatcher.getMatchedMarkets();
  }

  async getRecentOpportunities(limit: number = 100) {
    return await this.opportunityModel.getRecent(limit);
  }

  async getActiveOpportunities() {
    return await this.opportunityModel.getActive();
  }
}

