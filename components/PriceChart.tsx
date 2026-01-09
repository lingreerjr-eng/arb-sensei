
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const data = [
  { time: '2000', value: 100 },
  { time: '2100', value: 150 },
  { time: '2200', value: 80 },
  { time: '2300', value: 200 },
  { time: '0000', value: 120 },
  { time: '0100', value: 160 },
  { time: '0200', value: 240 },
  { time: '0300', value: 100 },
  { time: '0400', value: 180 },
];

const PriceChart: React.FC = () => {
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
