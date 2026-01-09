
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import MarketCard from './components/MarketCard';
import PriceChart from './components/PriceChart';
import { ArrowRight, Zap, RefreshCw, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { MarketData, Position } from './types';
import { getMarketInsight } from './services/geminiService';
import { useWebSocket } from './hooks/useWebSocket';
import { apiService, ArbitrageOpportunity, Trade } from './services/apiService';

const App: React.FC = () => {
  const [tradeAmount, setTradeAmount] = useState('1000');
  const [direction, setDirection] = useState('POLY > OPINION');
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [spread, setSpread] = useState(0);
  const [activePositions, setActivePositions] = useState<Position[]>([]);
  const [currentOpportunity, setCurrentOpportunity] = useState<ArbitrageOpportunity | null>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [polyData, setPolyData] = useState<MarketData>({
    platform: 'Polymarket',
    market: 'Loading...',
    odds: { yes: '--', no: '--' },
    liquidity: '--'
  });
  const [opinionData, setOpinionData] = useState<MarketData>({
    platform: 'Opinion.Trade',
    market: 'Loading...',
    odds: { yes: '--', no: '--' },
    liquidity: '--'
  });

  // WebSocket connection
  const { isConnected, latestOpportunity, opportunities } = useWebSocket();

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch active opportunities
        const opps = await apiService.getActiveOpportunities();
        if (opps.length > 0) {
          setCurrentOpportunity(opps[0]);
          updateMarketData(opps[0]);
        }

        // Fetch markets
        const marketData = await apiService.getMarkets();
        setMarkets(marketData);

        // Fetch trades (positions)
        const trades = await apiService.getTrades(10);
        setActivePositions(convertTradesToPositions(trades));
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Update when new opportunity arrives via WebSocket
  useEffect(() => {
    if (latestOpportunity) {
      const opp: ArbitrageOpportunity = {
        id: latestOpportunity.id,
        canonical_market_id: latestOpportunity.canonicalMarketId,
        combined_cost: latestOpportunity.combinedCost,
        profit_potential: latestOpportunity.profitPotential,
        opinion_price_yes: latestOpportunity.opinionYesPrice,
        opinion_price_no: latestOpportunity.opinionNoPrice,
        polymarket_price_yes: latestOpportunity.polymarketYesPrice,
        polymarket_price_no: latestOpportunity.polymarketNoPrice,
        liquidity_opinion: latestOpportunity.opinionLiquidity,
        liquidity_polymarket: latestOpportunity.polymarketLiquidity,
        detected_at: latestOpportunity.detectedAt,
        status: 'detected',
      };
      setCurrentOpportunity(opp);
      updateMarketData(opp);
      setSpread(opp.profit_potential * 100);
    }
  }, [latestOpportunity]);

  const updateMarketData = (opp: ArbitrageOpportunity) => {
    // Find market title
    const marketTitle = markets.find(m => m.canonical_market_id === opp.canonical_market_id)?.market_title || 'Market';

    setPolyData({
      platform: 'Polymarket',
      market: marketTitle,
      odds: {
        yes: opp.polymarket_price_yes ? `${opp.polymarket_price_yes.toFixed(3)}x YES` : '--',
        no: opp.polymarket_price_no ? `${opp.polymarket_price_no.toFixed(3)}x NO` : '--'
      },
      liquidity: opp.liquidity_polymarket ? `$${(opp.liquidity_polymarket / 1000).toFixed(1)}K` : '--'
    });

    setOpinionData({
      platform: 'Opinion.Trade',
      market: marketTitle,
      odds: {
        yes: opp.opinion_price_yes ? `${opp.opinion_price_yes.toFixed(3)}x YES` : '--',
        no: opp.opinion_price_no ? `${opp.opinion_price_no.toFixed(3)}x NO` : '--'
      },
      liquidity: opp.liquidity_opinion ? `$${(opp.liquidity_opinion / 1000).toFixed(1)}K` : '--'
    });
  };

  const convertTradesToPositions = (trades: Trade[]): Position[] => {
    return trades
      .filter(t => t.status === 'filled' || t.status === 'pending')
      .map(t => ({
        id: t.id,
        market: t.market_id.substring(0, 10) + '...',
        side: t.side === 'yes' ? 'BUY' : 'SELL',
        amount: t.amount,
        current: `${t.price.toFixed(3)}x`,
        profit: t.status === 'filled' ? '+0.00%' : 'Pending',
        profitPercent: 0
      }));
  };

  const handleExecuteTrade = async () => {
    if (!currentOpportunity) {
      alert('No arbitrage opportunity available');
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.executeOpportunity(currentOpportunity.id);
      alert(`Arb Trade Executed Successfully! Order IDs: ${result.trades?.map((t: any) => t.orderId).join(', ')}`);
      
      // Refresh positions
      const trades = await apiService.getTrades(10);
      setActivePositions(convertTradesToPositions(trades));
    } catch (error: any) {
      alert(`Trade execution failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIInsight = async () => {
    setInsight('Analyzing market data...');
    const result = await getMarketInsight(polyData.platform, opinionData.platform, spread);
    setInsight(result);
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] bg-grid relative flex flex-col overflow-x-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#00f2ff]/5 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#a855f7]/5 blur-[150px] rounded-full pointer-events-none"></div>

      <Header />

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-8 py-10 relative z-10">
        
        {/* Title Section */}
        <div className="text-center mb-16">
          <div className="flex justify-center gap-1 mb-4">
            {[1,2,3,4,5].map(i => <div key={i} className="w-1 h-1 rounded-full bg-[#00f2ff]/40" />)}
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-2">
            <span className="arb-gradient-text uppercase">Arbitarage Sensei</span>
          </h1>
          <p className="text-gray-500 font-medium tracking-[0.2em] text-sm uppercase">Elite Market Monitoring Interface</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            {isConnected ? (
              <div className="flex items-center gap-2 text-green-400">
                <Wifi className="w-4 h-4" />
                <span className="text-xs">Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-400">
                <WifiOff className="w-4 h-4" />
                <span className="text-xs">Disconnected</span>
              </div>
            )}
            {currentOpportunity && (
              <span className="text-xs text-gray-500">
                • Latest: {new Date(currentOpportunity.detected_at).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Market Comparison Row */}
          <div className="lg:col-span-12 flex flex-col md:flex-row items-center justify-between gap-8 mb-4">
            <MarketCard data={polyData} type="blue" />
            
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-[#00f2ff] font-bold text-lg glow-text-blue">
                {currentOpportunity ? `+${(currentOpportunity.profit_potential * 100).toFixed(2)}% ARB` : '+0.00% ARB'}
              </div>
              <div className="bg-gradient-to-r from-[#00f2ff] to-[#a855f7] p-4 rounded-2xl shadow-xl">
                <ArrowRight className="text-black w-8 h-8" />
              </div>
              <div className="text-[#a855f7] font-bold text-lg">
                {currentOpportunity ? `Cost: ${(currentOpportunity.combined_cost * 100).toFixed(2)}¢` : 'No Opportunity'}
              </div>
            </div>

            <MarketCard data={opinionData} type="purple" />
          </div>

          {/* Trade Execution Panel */}
          <div className="lg:col-span-5 bg-[#1a1c23] p-8 rounded-3xl border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
              <Zap className="w-24 h-24 text-[#00f2ff]" />
            </div>
            
            <h3 className="text-center font-bold text-xl mb-10 tracking-widest text-white">TRADE EXECUTION</h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Amount (USD)</label>
                  <input 
                    type="number" 
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 font-mono focus:border-[#00f2ff] outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Direction</label>
                  <button 
                    onClick={() => setDirection(prev => prev.includes('POLY') ? 'OPINION > POLY' : 'POLY > OPINION')}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 font-mono text-xs hover:bg-white/5 transition-colors"
                  >
                    {direction}
                  </button>
                </div>
              </div>

              <button 
                onClick={handleExecuteTrade}
                disabled={loading || !currentOpportunity || !isConnected}
                className="w-full py-4 rounded-xl font-black tracking-widest uppercase text-black bg-gradient-to-r from-[#00f2ff] to-[#a855f7] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : !currentOpportunity ? (
                  'No Opportunity Available'
                ) : !isConnected ? (
                  'Not Connected'
                ) : (
                  'Execute Arb Trade'
                )}
              </button>

              {/* AI Insight Section */}
              <div className="pt-6 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                   <h4 className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">AI Strategy Recommendation</h4>
                   <button 
                    onClick={fetchAIInsight}
                    className="text-[#00f2ff] hover:underline text-[10px] font-bold uppercase"
                   >
                     Regenerate
                   </button>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 min-h-[80px] flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[#00f2ff] shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-400 leading-relaxed italic">
                    {insight || (currentOpportunity 
                      ? `Current opportunity: ${(currentOpportunity.profit_potential * 100).toFixed(2)}% profit potential. Combined cost: ${(currentOpportunity.combined_cost * 100).toFixed(2)}¢. Recommended size: $${currentOpportunity.liquidity_opinion ? (Math.min(currentOpportunity.liquidity_opinion, currentOpportunity.liquidity_polymarket || 0) / 1000).toFixed(1) + 'K' : 'N/A'}.`
                      : "Waiting for arbitrage opportunities. The system will detect opportunities when combined cost < 98¢.")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Statistics Column */}
          <div className="lg:col-span-7 space-y-8">
            <PriceChart opportunities={opportunities.map(opp => ({
              detected_at: opp.detectedAt,
              profit_potential: opp.profitPotential
            }))} />

            <div className="bg-[#12141a] p-4 rounded-2xl border border-white/5 overflow-x-auto">
              <h4 className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-4 text-center">Active Positions</h4>
              {activePositions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  No active positions
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="pb-3 text-gray-500 font-bold uppercase tracking-tighter">Market</th>
                      <th className="pb-3 text-gray-500 font-bold uppercase tracking-tighter">Side</th>
                      <th className="pb-3 text-gray-500 font-bold uppercase tracking-tighter">Amount</th>
                      <th className="pb-3 text-gray-500 font-bold uppercase tracking-tighter">Current</th>
                      <th className="pb-3 text-gray-500 font-bold uppercase tracking-tighter">Profit/Loss</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {activePositions.map((pos) => (
                      <tr key={pos.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 font-bold">{pos.market}</td>
                        <td className="py-3"><span className={pos.side === 'BUY' ? 'text-green-400' : 'text-red-400'}>{pos.side}</span></td>
                        <td className="py-3">${pos.amount.toFixed(2)}</td>
                        <td className="py-3 text-gray-400">{pos.current}</td>
                        <td className={`py-3 ${pos.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ({pos.profit})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </main>

      <Footer />
      
      {/* Decorative Corner Element */}
      <div className="fixed bottom-8 right-8 pointer-events-none opacity-20">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 0L24.4903 15.5097L40 20L24.4903 24.4903L20 40L15.5097 24.4903L0 20L15.5097 15.5097L20 0Z" fill="white"/>
        </svg>
      </div>
    </div>
  );
};

export default App;
