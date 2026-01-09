
import React from 'react';
import { MarketData } from '../types';

interface MarketCardProps {
  data: MarketData;
  type: 'blue' | 'purple';
}

const MarketCard: React.FC<MarketCardProps> = ({ data, type }) => {
  const glowClass = type === 'blue' ? 'glow-blue' : 'glow-purple';
  const titleColor = type === 'blue' ? 'text-[#00f2ff]' : 'text-[#a855f7]';

  return (
    <div className={`p-6 rounded-3xl bg-[#1a1c23] ${glowClass} flex-1 min-w-[300px]`}>
      <h3 className={`text-center font-bold text-xl mb-6 tracking-widest ${titleColor}`}>
        {data.platform.toUpperCase()}
      </h3>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-black/20">
          <span className="text-[10px] text-gray-500 font-bold tracking-tighter">MARKET:</span>
          <span className="text-sm font-mono font-semibold">{data.market}</span>
        </div>
        
        <div className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-black/20">
          <span className="text-[10px] text-gray-500 font-bold tracking-tighter">ODDS:</span>
          <span className="text-sm font-mono font-semibold">{data.odds.yes} / {data.odds.no}</span>
        </div>
        
        <div className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-black/20">
          <span className="text-[10px] text-gray-500 font-bold tracking-tighter">LIQUIDITY:</span>
          <span className="text-sm font-mono font-semibold text-gray-300">{data.liquidity}</span>
        </div>
      </div>
    </div>
  );
};

export default MarketCard;
