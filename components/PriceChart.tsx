
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ChartPoint } from '../types';

interface PriceChartProps {
  opportunities?: Array<{ detected_at: string; profit_potential: number }>;
}

const PriceChart: React.FC<PriceChartProps> = ({ opportunities = [] }) => {
  // Generate chart data from opportunities or use default
  const data: ChartPoint[] = opportunities.length > 0
    ? opportunities.slice(0, 20).reverse().map((opp, index) => ({
        time: new Date(opp.detected_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        value: opp.profit_potential * 100, // Convert to percentage
      }))
    : [
        { time: '20:00', value: 0 },
        { time: '21:00', value: 0 },
        { time: '22:00', value: 0 },
        { time: '23:00', value: 0 },
        { time: '00:00', value: 0 },
        { time: '01:00', value: 0 },
        { time: '02:00', value: 0 },
        { time: '03:00', value: 0 },
        { time: '04:00', value: 0 },
      ];
  return (
    <div className="bg-[#12141a] p-4 rounded-2xl border border-white/5 h-full">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Price Differential (24h)</h4>
      </div>
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#666', fontSize: 10}}
            />
            <YAxis hide />
            <Tooltip 
              contentStyle={{backgroundColor: '#1a1c23', border: 'none', borderRadius: '8px', fontSize: '10px'}}
              itemStyle={{color: '#00f2ff'}}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#00f2ff" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorValue)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PriceChart;
