const API_BASE_URL = 'http://localhost:3001/api';

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
  detected_at: string;
  status: 'detected' | 'executing' | 'executed' | 'expired';
}

export interface MarketMapping {
  id: string;
  canonical_market_id: string;
  opinion_market_id: string | null;
  polymarket_market_id: string | null;
  market_title: string;
  similarity_score: number | null;
}

export interface Trade {
  id: string;
  arbitrage_opportunity_id: string | null;
  platform: 'opinion' | 'polymarket';
  market_id: string;
  side: 'yes' | 'no';
  amount: number;
  price: number;
  order_id: string | null;
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  executed_at: string | null;
}

class ApiService {
  private async fetchJson<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    return response.json();
  }

  private async postJson<T>(endpoint: string, body?: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    return response.json();
  }

  async getHealth() {
    return this.fetchJson<{ status: string; timestamp: string }>('/health');
  }

  async getOpportunities(limit: number = 100): Promise<ArbitrageOpportunity[]> {
    return this.fetchJson<ArbitrageOpportunity[]>(`/opportunities?limit=${limit}`);
  }

  async getActiveOpportunities(): Promise<ArbitrageOpportunity[]> {
    return this.fetchJson<ArbitrageOpportunity[]>('/opportunities/active');
  }

  async getMarkets(): Promise<MarketMapping[]> {
    return this.fetchJson<MarketMapping[]>('/markets');
  }

  async syncMarkets(): Promise<{ message: string }> {
    return this.postJson<{ message: string }>('/markets/sync');
  }

  async getTrades(limit: number = 100): Promise<Trade[]> {
    return this.fetchJson<Trade[]>(`/trades?limit=${limit}`);
  }

  async executeOpportunity(opportunityId: string): Promise<any> {
    return this.postJson(`/execute/${opportunityId}`);
  }

  async getConfig(): Promise<{
    arbThreshold: number;
    minLiquidity: number;
    autoExecute: boolean;
    maxPositionSize: number;
  }> {
    return this.fetchJson('/config');
  }

  async updateConfig(config: { autoExecute?: boolean }): Promise<any> {
    return this.postJson('/config', config);
  }
}

export const apiService = new ApiService();

