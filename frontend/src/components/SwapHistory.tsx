'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, RefreshCw, ChevronRight, ChevronLeft } from 'lucide-react';
import { getTokenSymbol, SUI_NETWORK, getSwapHistory } from '@/utils/cetus';
import { useSuiClient } from '@mysten/dapp-kit';

interface SwapRecord {
  type: 'swap' | 'send' | 'receive' | 'zap'; // Added 'zap' type
  user: string;
  otherParty?: string;
  fromCoin: string;
  toCoin: string;
  amountIn: string;
  amountOut: string;
  timestamp: number;
  txDigest: string;
  memo?: string;
  zapSteps?: SwapRecord[]; // For grouping zap steps
  gasFee?: string; // Gas fee in SUI
}

interface SwapHistoryProps {
  userAddress: string | null;
  refreshTrigger?: number;
}

import { normalizeSuiAddress } from '@mysten/sui/utils';

// Helper to normalize coin types (handle leading zeros difference)
const normalizeType = (type: string) => {
  if (!type) return '';
  // Extract address part if possible, or just standard normalization
  // Format: 0x...::module::Name
  const parts = type.split('::');
  if (parts.length === 3) {
      return `${normalizeSuiAddress(parts[0])}::${parts[1]}::${parts[2]}`;
  }
  return type;
};

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
      
      // Group Zap Transactions (Swap + Transfer within short time window)
      const groupedHistory: SwapRecord[] = [];
      const usedIndices = new Set<number>();

      for (let i = 0; i < chainHistory.length; i++) {
         if (usedIndices.has(i)) continue;

         const current = chainHistory[i];
         
         // Look ahead for potential Zap partner
         // A Zap is usually a Swap followed immediately by a Transfer
         // Since history is sorted desc by time, the Transfer (later action) appears FIRST or SECOND depending on sort precision
         // Actually, if we sort descending, Transfer (later) comes BEFORE Swap (earlier)
         
         if (current.type === 'send') {
             // Check if the next item is a Swap that "fed" this transfer
             // Criteria:
             // 1. Next item is Swap
             // 2. Swap Output Coin == Transfer Coin
             // 3. Time difference is small (< 1 minute)
             // 4. Swap Output Amount is close to Transfer Amount (optional, but good for accuracy)
             
             const nextIndex = i + 1;
             if (nextIndex < chainHistory.length) {
                 const next = chainHistory[nextIndex];
                 
                 const currentFrom = normalizeType(current.fromCoin);
                 const nextTo = normalizeType(next.toCoin);
                 
                 if (next.type === 'swap' && 
                     nextTo === currentFrom && 
                     Math.abs(current.timestamp - next.timestamp) < 300000 // 5 minute window
                 ) {
                     // Found a Zap!
                     // Combine them into a single 'zap' record
                     groupedHistory.push({
                         type: 'zap',
                         user: current.user,
                         otherParty: current.otherParty,
                         fromCoin: next.fromCoin,  // Original Source
                         toCoin: current.fromCoin, // Intermediate/Final Token
                         amountIn: next.amountIn,
                         amountOut: current.amountIn, // Amount Sent
                         timestamp: current.timestamp,
                         txDigest: current.txDigest, // Use Transfer Digest as main? Or maybe both?
                         memo: current.memo,
                         zapSteps: [next, current] // Store raw steps
                     });
                     usedIndices.add(nextIndex);
                     continue;
                 }
             }
         }
         
         groupedHistory.push(current);
      }
      
      setHistory(groupedHistory);
      console.log(`📊 Loaded ${groupedHistory.length} records (grouped)`);
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

  const getDecimals = (coinType: string) => {
    if (coinType.includes('::usdc::USDC') || coinType.includes('::coin::COIN')) return 6;
    return 9; // Default for SUI, CETUS, MEME, etc.
  };

  const formatAmount = (amount: string, coinType: string) => {
    const decimals = getDecimals(coinType);
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
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-lg px-3 py-1.5 ${
                        swap.type === 'swap' ? 'bg-blue-100' :
                        swap.type === 'send' ? 'bg-orange-100' : 
                        swap.type === 'zap' ? 'bg-purple-100' : 'bg-green-100'
                      }`}>
                        <span className={`text-sm font-bold ${
                           swap.type === 'swap' ? 'text-blue-900' :
                           swap.type === 'send' ? 'text-orange-900' : 
                           swap.type === 'zap' ? 'text-purple-900' : 'text-green-900'
                        }`}>
                          {swap.type === 'swap' ? 'SWAP' : 
                           swap.type === 'send' ? 'SEND' : 
                           swap.type === 'zap' ? 'ZAP (SWAP+SEND)' : 'RECEIVE'}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-gray-500">
                         {getTokenSymbol(swap.fromCoin)}
                      </span>
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

                  {/* Details */}
                  <div className="space-y-2.5 mb-3 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3">
                    {swap.type === 'swap' || swap.type === 'zap' ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">In</span>
                          <span className="text-sm font-bold text-slate-900 font-mono">
                            {formatAmount(swap.amountIn, swap.fromCoin)} {getTokenSymbol(swap.fromCoin)}
                          </span>
                        </div>
                        <div className="h-px bg-gradient-to-r from-slate-200 to-transparent"></div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            {swap.type === 'zap' ? 'Sent' : 'Out'}
                          </span>
                          <span className="text-sm font-bold text-green-600 font-mono">
                            {formatAmount(swap.amountOut, swap.toCoin)} {getTokenSymbol(swap.toCoin)}
                          </span>
                        </div>
                        {swap.type === 'zap' && swap.otherParty && (
                           <>
                             <div className="h-px bg-gradient-to-r from-slate-200 to-transparent"></div>
                             <div className="flex justify-between items-center">
                               <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">To</span>
                               <span className="text-xs font-mono text-gray-700 break-all pl-4 text-right">
                                  {swap.otherParty.slice(0, 6)}...{swap.otherParty.slice(-4)}
                               </span>
                             </div>
                           </>
                        )}
                      </>
                    ) : (
                      <>
                         <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Amount</span>
                          <span className={`text-sm font-bold font-mono ${swap.type === 'send' ? 'text-orange-600' : 'text-green-600'}`}>
                            {swap.type === 'send' ? '-' : '+'}{formatAmount(swap.amountIn, swap.fromCoin)}
                          </span>
                        </div>
                        <div className="h-px bg-gradient-to-r from-slate-200 to-transparent"></div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            {swap.type === 'send' ? 'To' : 'From'}
                          </span>
                          <span className="text-xs font-mono text-gray-700 break-all pl-4 text-right">
                             {swap.otherParty?.slice(0, 6)}...{swap.otherParty?.slice(-4)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Memo */}
                  {swap.memo && (
                    <div className="mb-3 p-2 bg-yellow-50 border border-yellow-100 rounded text-xs text-gray-600 italic break-words">
                      "{swap.memo}"
                    </div>
                  )}

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

