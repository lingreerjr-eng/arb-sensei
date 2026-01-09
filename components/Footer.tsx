
import React from 'react';
import { Sparkles } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="mt-12 py-8 px-8 border-t border-white/5 bg-black/40">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex gap-8 text-xs font-semibold text-gray-500 uppercase tracking-widest">
          <a href="#" className="hover:text-[#00f2ff] transition-colors border-b-2 border-[#00f2ff] pb-1">Privacy Policy</a>
          <a href="#" className="hover:text-[#00f2ff] transition-colors border-b-2 border-transparent pb-1">Terms of Service</a>
          <a href="#" className="hover:text-[#00f2ff] transition-colors border-b-2 border-transparent pb-1">Contact</a>
        </div>
        
        <div className="flex items-center gap-2 text-gray-600">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm">Powered by Arbitrage Sensei Engine v2.4.0</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
