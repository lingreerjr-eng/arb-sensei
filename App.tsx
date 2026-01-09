
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import MarketCard from './components/MarketCard';
import PriceChart from './components/PriceChart';
import { ArrowRight, Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { MarketData, Position } from './types';
import { getMarketInsight } from './services/geminiService';

const App: React.FC = () => {
  const [tradeAmount, setTradeAmount] = useState('1000');
  const [direction, setDirection] = useState('POLY > OPINION');
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [spread, setSpread] = useState(3.0);

  const polyData: MarketData = {
    platform: 'Polymarket',
    market: 'BTC-USD PRICE',
    odds: { yes: 'YES', no: '0.98x NO' },
    liquidity: '2.5M USD'
  };

  const opinionData: MarketData = {
    platform: 'Opinion.Trade',
    market: 'BTC-USD PRICE',
    odds: { yes: '1.05x YES', no: '0.95x NO' },
    liquidity: '1.8M USD'
  };

  const activePositions: Position[] = [
    { id: '1', market: 'BTC-USD', side: 'BUY', amount: 1000, current: '1.05x', profit: '+2.00%', profitPercent: 2 },
    { id: '2', market: 'ETH-USD', side: 'SELL', amount: 500, current: '0.98x', profit: '-0.50%', profitPercent: -0.5 },
  ];

  const handleExecuteTrade = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert('Arb Trade Executed Successfully!');
    }, 1500);
  };

  const fetchAIInsight = async () => {
    setInsight('Analyzing market data...');
    const result = await getMarketInsight(polyData.platform, opinionData.platform, spread);
    setInsight(result);
  };

  useEffect(() => {
    // Simulated live spread updates
    const interval = setInterval(() => {
      setSpread(prev => Math.max(0.5, prev + (Math.random() - 0.5) * 0.2));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Market Comparison Row */}
          <div className="lg:col-span-12 flex flex-col md:flex-row items-center justify-between gap-8 mb-4">
            <MarketCard data={polyData} type="blue" />
            
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-[#00f2ff] font-bold text-lg glow-text-blue">+{spread.toFixed(1)}% ARB</div>
              <div className="bg-gradient-to-r from-[#00f2ff] to-[#a855f7] p-4 rounded-2xl shadow-xl">
                <ArrowRight className="text-black w-8 h-8" />
              </div>
              <div className="text-[#a855f7] font-bold text-lg">+{ (spread * 0.6).toFixed(1) }% ARB.</div>
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
                disabled={loading}
                className="w-full py-4 rounded-xl font-black tracking-widest uppercase text-black bg-gradient-to-r from-[#00f2ff] to-[#a855f7] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Execute Arb Trade'}
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
                    {insight || "Click 'Regenerate' to get real-time tactical insights from Gemini AI based on current spread and platform liquidity."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Statistics Column */}
          <div className="lg:col-span-7 space-y-8">
            <PriceChart />

            <div className="bg-[#12141a] p-4 rounded-2xl border border-white/5 overflow-x-auto">
              <h4 className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-4 text-center">Active Positions</h4>
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
                      <td className="py-3">{pos.amount}</td>
                      <td className="py-3 text-gray-400">{pos.current}</td>
                      <td className={`py-3 ${pos.profitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ({pos.profit})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
