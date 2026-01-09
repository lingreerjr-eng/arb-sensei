
import React from 'react';
import { User, ShieldCheck } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between px-8 py-6 bg-[#0b0c10]/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/5">
      <div className="flex items-center gap-2">
        <div className="bg-gradient-to-br from-[#00f2ff] to-[#a855f7] p-2 rounded-lg">
          <ShieldCheck className="text-black w-6 h-6" />
        </div>
        <span className="text-2xl font-black tracking-tighter arb-gradient-text">AS</span>
      </div>
      
      <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
        <a href="#" className="text-white hover:text-[#00f2ff] transition-colors">Dashboard</a>
        <a href="#" className="hover:text-[#00f2ff] transition-colors">History</a>
        <a href="#" className="hover:text-[#00f2ff] transition-colors">Settings</a>
        <a href="#" className="hover:text-[#00f2ff] transition-colors">Documentation</a>
      </nav>

      <div className="flex items-center gap-4">
        <button className="p-2 rounded-full border border-white/10 hover:bg-white/5 transition-all">
          <User className="w-5 h-5 text-gray-400" />
        </button>
      </div>
    </header>
  );
};

export default Header;
