'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, RefreshCw, ChevronRight, ChevronLeft } from 'lucide-react';
import { getTokenSymbol, SUI_NETWORK, getSwapHistory } from '@/utils/cetus';
import { useSuiClient } from '@mysten/dapp-kit';

interface SwapRecord {
  user: string;
  fromCoin: string;
  toCoin: string;
  amountIn: string;
  amountOut: string;
  timestamp: number;
  txDigest: string;
}

interface SwapHistoryProps {
  userAddress: string | null;
  refreshTrigger?: number;
}

export default function SwapHistory({ userAddress, refreshTrigger }: SwapHistoryProps) {
  const suiClient = useSuiClient();
  const [history, setHistory] = useState<SwapRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const explorerUrl = SUI_NETWORK === 'mainnet'
    ? 'https://suiscan.xyz/mainnet'
    : 'https://suiscan.xyz/testnet';

  const fetchHistory = useCallback(async () => {
    if (!userAddress) return;

    setLoading(true);
    try {
      // 1️⃣ Try to get data from Chain (Source of Truth)
      const chainHistory = await getSwapHistory(suiClient, userAddress, '');
      
      setHistory(chainHistory);
      console.log(`📊 Loaded ${chainHistory.length} swaps from Chain`);
    } catch (error) {
      console.error('Error fetching swap history:', error);
    } finally {
      setLoading(false);
    }
  }, [userAddress, suiClient]);

  useEffect(() => {
    fetchHistory();
  }, [userAddress, refreshTrigger, fetchHistory]);

  const formatTime = (timestamp: number) => {
    // Determine if timestamp is in seconds (contract fallback) or milliseconds (system timestampMs)
    // If it's less than 10^12, it's likely epoch/seconds. If it's > 10^12, it's ms.
    // 2020-01-01 in ms is ~1.5e12
    const isMilliseconds = timestamp > 1000000000000;
    
    // If it's the bugged "Epoch ID" (e.g. 100), this will show 1970. 
    // But since we switched to timestampMs, we should get proper ms.
    
    const date = new Date(isMilliseconds ? timestamp : timestamp * 1000);
    return date.toLocaleTimeString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: string, decimals: number = 6) => {
    try {
      const num = Number(amount) / Math.pow(10, decimals);
      return num.toFixed(4);
    } catch {
      return '0';
    }
  };

  if (!userAddress) {
    return null;
  }

  return (
    <>
      {/* Drawer Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 z-40 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all"
        title={isOpen ? 'Close history' : 'Open history'}
      >
        {isOpen ? <ChevronRight size={24} /> : <ChevronLeft size={24} />}
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer Panel */}
      <div
        className={`fixed right-0 top-0 h-screen w-96 bg-gradient-to-b from-slate-50 to-slate-100 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-sm">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">Swap History</h2>
          <div className="flex gap-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* History List */}
        <div className="overflow-y-auto h-[calc(100vh-80px)] p-4 space-y-3">
          {history.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm font-medium">
              {loading ? 'Loading...' : 'No swap history yet'}
            </div>
          ) : (
            <>
              {history.map((swap, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-4 border border-slate-100"
                >
                  {/* Swap Pair Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg px-3 py-1.5">
                        <span className="text-sm font-bold text-blue-900">
                          {getTokenSymbol(swap.fromCoin)} → {getTokenSymbol(swap.toCoin)}
                        </span>
                      </div>
                    </div>
                    <a
                      href={`${explorerUrl}/tx/${swap.txDigest}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-1 rounded transition-colors"
                      title="View on Suiscan"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>

                  {/* Amounts */}
                  <div className="space-y-2.5 mb-3 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Amount In</span>
                      <span className="text-sm font-bold text-slate-900 font-mono">
                        {formatAmount(swap.amountIn, 9)}
                      </span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-slate-200 to-transparent"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Amount Out</span>
                      <span className="text-sm font-bold text-green-600 font-mono">
                        {formatAmount(swap.amountOut, 6)}
                      </span>
                    </div>
                  </div>

                  {/* Time */}
                  <div className="text-xs text-slate-500 text-right font-medium">
                    {formatTime(swap.timestamp)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}

