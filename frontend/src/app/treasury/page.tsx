'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Wallet, TrendingUp, ArrowRightLeft, Sparkles, PieChart, ArrowUpRight, ShieldCheck, Zap } from 'lucide-react';
import Link from 'next/link';

export default function TreasuryPage() {
  const account = useCurrentAccount();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [efficiencyScore, setEfficiencyScore] = useState(82);
  const [summary, setSummary] = useState<{
    total_revenue: number;
    order_count: number;
    employee_count: number;
  } | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const token = localStorage.getItem('suipay_token');
        if (!token) return;

        const res = await fetch('http://localhost:3001/merchant/summary', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setSummary(data);
        }
      } catch (e) {
        console.error("Failed to fetch summary", e);
      }
    };

    fetchSummary();
  }, []);

  const handleOptimize = () => {
    setIsOptimizing(true);
    // Simulate complex PTB interaction:
    // 1. Withdraw low-yield assets
    // 2. Swap via Cetus
    // 3. Deposit to StableLayer
    setTimeout(() => {
      setEfficiencyScore(98);
      setIsOptimizing(false);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-slate-800 font-bold text-xl">
              <Wallet className="text-blue-600" />
              <span>Treasury OS</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              StableLayer Connected
            </div>
            <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1">
              <Zap size={12} fill="currentColor" />
              Cetus Active
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* AI Insight Hero */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl shadow-slate-200 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-32 bg-blue-600/20 blur-3xl rounded-full pointer-events-none"></div>
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                <div className="lg:col-span-2 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-blue-300">
                        <Sparkles size={14} />
                        AI Treasury Agent
                    </div>
                    <h1 className="text-3xl font-bold">Capital Efficiency: {efficiencyScore}%</h1>
                    <p className="text-slate-300 max-w-xl">
                        I've analyzed your cash flow. You have <strong className="text-white">${summary ? summary.total_revenue.toLocaleString() : '12,450'} USDC</strong> sitting idle. 
                        Moving this to <strong className="text-white">StableLayer Strategy B</strong> via <strong className="text-white">Cetus</strong> will increase your APY by <strong className="text-green-400">4.2%</strong>.
                    </p>
                    
                    <button 
                        onClick={handleOptimize}
                        disabled={isOptimizing || efficiencyScore > 90}
                        className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isOptimizing ? (
                            <>
                                <Zap className="animate-spin" size={18} />
                                Optimizing Portfolio...
                            </>
                        ) : efficiencyScore > 90 ? (
                            <>
                                <ShieldCheck size={18} />
                                Fully Optimized
                            </>
                        ) : (
                            <>
                                <Sparkles size={18} />
                                Auto-Optimize Treasury
                            </>
                        )}
                    </button>
                    {efficiencyScore > 90 && (
                        <p className="text-xs text-green-400 animate-in fade-in slide-in-from-bottom-2">
                            Strategy executed via Sui PTB: Swap(Cetus) → Deposit(StableLayer)
                        </p>
                    )}
                </div>
                
                {/* Stats Card */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-slate-300">Projected Yield</span>
                        <TrendingUp className="text-green-400" size={20} />
                    </div>
                    <div className="text-4xl font-bold mb-2">$1,240<span className="text-lg text-slate-400 font-normal">/mo</span></div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 w-[75%]"></div>
                    </div>
                    <div className="mt-4 flex gap-2 text-xs text-slate-400">
                        <span>Powered by</span>
                        <span className="text-white font-bold">StableLayer</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Integration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cetus Integration */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <ArrowRightLeft size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Liquidity Engine</h3>
                        <p className="text-xs text-slate-500">Powered by Cetus Aggregator</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Auto-Swap Volume</span>
                        <span className="font-bold text-slate-800">$45,200</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Slippage Saved</span>
                        <span className="font-bold text-green-600">$124.50</span>
                    </div>
                </div>
            </div>

            {/* StableLayer Integration */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                        <PieChart size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Yield Strategy</h3>
                        <p className="text-xs text-slate-500">Powered by StableLayer</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Active Principal</span>
                        <span className="font-bold text-slate-800">${summary ? summary.total_revenue.toLocaleString() : '12,450'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Current APY</span>
                        <span className="font-bold text-green-600">12.4%</span>
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}
