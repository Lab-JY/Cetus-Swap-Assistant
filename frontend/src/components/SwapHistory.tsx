'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, RefreshCw, ChevronRight, ChevronLeft, ArrowRight, Zap, Send, ArrowDownLeft } from 'lucide-react';
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
      const chainHistory = await getSwapHistory(suiClient, userAddress, '', 50);
      
      // Group Zap Transactions (Optimized O(n))
      const groupedHistory: SwapRecord[] = [];
      const usedIndices = new Set<number>();
      
      const swapTxMap = new Map<string, number>(); // txDigest -> Swap Index
      const swapTimeMap = new Map<string, number[]>(); // coin-time -> Swap Indices

      // Build Swap Maps
      chainHistory.forEach((record, idx) => {
          if (record.type === 'swap') {
              swapTxMap.set(record.txDigest, idx);

              const outCoin = normalizeType(record.toCoin);
              const timeBucket = Math.floor(record.timestamp / 300000); 
              const key = `${outCoin}-${timeBucket}`;
              
              if (!swapTimeMap.has(key)) swapTimeMap.set(key, []);
              swapTimeMap.get(key)?.push(idx);

              // Adjacent buckets
              [-1, 1].forEach(offset => {
                 const adjKey = `${outCoin}-${timeBucket + offset}`;
                 if (!swapTimeMap.has(adjKey)) swapTimeMap.set(adjKey, []);
                 swapTimeMap.get(adjKey)?.push(idx);
              });
          }
      });

      // Identify Zaps
      chainHistory.forEach((current, i) => {
         if (current.type === 'send') {
             let validSwapIndex: number | undefined;

             // 🅰️ Priority 1: Atomic Zap (Same TxDigest)
             if (swapTxMap.has(current.txDigest)) {
                 const idx = swapTxMap.get(current.txDigest);
                 // Relaxed check: Allow matching even if index order is different, as long as it's the same transaction
                 if (idx !== undefined && idx !== i && !usedIndices.has(idx)) {
                     // Verify coin flow: Swap Output (toCoin) must match Transfer Input (fromCoin)
                     // But normalized types might differ slightly (e.g. leading zeros), so we rely on txDigest strong binding first.
                     // Optionally, we can log mismatch if debugging needed.
                     validSwapIndex = idx;
                 }
             }

             // 🅱️ Priority 2: Legacy Zap (Fuzzy Time Match)
             if (validSwapIndex === undefined) {
                 const currentFrom = normalizeType(current.fromCoin);
                 const timeBucket = Math.floor(current.timestamp / 300000);
                 const key = `${currentFrom}-${timeBucket}`;
                 
                 const potentialSwapIndices = swapTimeMap.get(key) || [];
                 validSwapIndex = potentialSwapIndices.find(idx => {
                     if (idx === i) return false; // Not self
                     if (usedIndices.has(idx)) return false; // Already used
                     
                     const swap = chainHistory[idx];
                     const timeDiff = Math.abs(current.timestamp - swap.timestamp);
                     return timeDiff < 300000;
                 });
             }

             if (validSwapIndex !== undefined) {
                 const next = chainHistory[validSwapIndex];
                 
                 // Create Zap Record
                 const zapRecord: SwapRecord = {
                     type: 'zap',
                     user: current.user,
                     otherParty: current.otherParty,
                     fromCoin: next.fromCoin,
                     toCoin: current.fromCoin,
                     amountIn: next.amountIn,
                     amountOut: current.amountIn,
                     timestamp: current.timestamp,
                     txDigest: current.txDigest, 
                     memo: current.memo,
                     zapSteps: [next, current] 
                 };

                 groupedHistory.push(zapRecord);
                 usedIndices.add(validSwapIndex); // Mark Swap as used
                 usedIndices.add(i); // Mark Send as used
             }
         }
      });

      // Pass 2: Build final list (Append remaining non-zap records)
      chainHistory.forEach((record, i) => {
          if (!usedIndices.has(i)) {
              groupedHistory.push(record);
          }
      });
      
      // Sort by timestamp desc
      groupedHistory.sort((a, b) => b.timestamp - a.timestamp);

      setHistory(groupedHistory);
      // console.log(`📊 Loaded ${groupedHistory.length} records (grouped)`);
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
        className={`fixed right-0 top-0 h-screen w-96 bg-gray-50 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 z-10 text-white">
          <h2 className="text-xl font-bold">Transaction History</h2>
          <div className="flex gap-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 text-white"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* History List */}
        <div className="overflow-y-auto h-[calc(100vh-80px)] p-4 space-y-3">
          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm font-medium">
              {loading ? 'Loading...' : 'No swap history yet'}
            </div>
          ) : (
            <>
              {history.map((swap, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-4 border border-gray-100"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-xl p-2.5 shadow-sm ${
                        swap.type === 'swap' ? 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600' :
                        swap.type === 'send' ? 'bg-gradient-to-br from-orange-50 to-orange-100 text-orange-600' : 
                        swap.type === 'zap' ? 'bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600 ring-1 ring-purple-200' : 
                        'bg-gradient-to-br from-green-50 to-green-100 text-green-600'
                      }`}>
                        {swap.type === 'swap' ? <RefreshCw size={18} /> :
                         swap.type === 'send' ? <Send size={18} /> :
                         swap.type === 'zap' ? <Zap size={18} className="fill-current" /> : <ArrowDownLeft size={18} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-bold text-gray-900 leading-none">
                            {swap.type === 'swap' ? 'Token Swap' : 
                             swap.type === 'send' ? 'Send Token' : 
                             swap.type === 'zap' ? 'Zap Transfer' : 'Receive Token'}
                          </div>
                          {swap.type === 'zap' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 uppercase tracking-wider">
                              Atomic
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 font-medium mt-1.5 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                          {formatTime(swap.timestamp)}
                        </div>
                      </div>
                    </div>
                    <a
                      href={`${explorerUrl}/tx/${swap.txDigest}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-600 p-2 hover:bg-gray-50 rounded-lg transition-all"
                      title="View on Suiscan"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>

                  {/* Details */}
                  <div className="space-y-3">
                    {swap.type === 'zap' ? (
                        <div className="relative pl-5 border-l-2 border-purple-100 space-y-5 my-2">
                           {/* Step 1: Swap */}
                           <div className="relative group">
                              <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-white border-2 border-purple-300 flex items-center justify-center z-10">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                              </div>
                              <div className="flex items-center justify-between mb-1.5">
                                 <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Step 1: Swap</span>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 group-hover:border-purple-200 transition-colors">
                                <div className="flex items-center justify-between text-sm">
                                   <div className="flex items-center gap-2">
                                     <span className="font-mono font-medium text-gray-700">{formatAmount(swap.amountIn, swap.fromCoin)}</span>
                                     <span className="text-xs font-bold text-gray-500">{getTokenSymbol(swap.fromCoin)}</span>
                                   </div>
                                   <ArrowRight size={14} className="text-purple-400" />
                                   <div className="flex items-center gap-2">
                                     <span className="font-mono font-bold text-gray-900">{formatAmount(swap.zapSteps?.[0]?.amountOut || '0', swap.toCoin)}</span>
                                     <span className="text-xs font-bold text-purple-600">{getTokenSymbol(swap.toCoin)}</span>
                                   </div>
                                </div>
                              </div>
                           </div>
                           
                           {/* Step 2: Send */}
                           <div className="relative group">
                              <div className="absolute -left-[27px] top-1 w-4 h-4 rounded-full bg-purple-500 border-2 border-purple-100 flex items-center justify-center z-10 shadow-sm">
                                <Send size={8} className="text-white ml-0.5" />
                              </div>
                              <div className="flex items-center justify-between mb-1.5">
                                 <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Step 2: Send</span>
                              </div>
                              <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-white p-3 rounded-lg border border-purple-100 group-hover:border-purple-300 transition-colors shadow-sm">
                                 <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Recipient</span>
                                    <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-purple-100">
                                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-[8px] font-bold text-white">
                                         {swap.otherParty?.slice(2, 4).toUpperCase()}
                                      </div>
                                      <span className="text-xs font-mono font-medium text-gray-700">
                                         {swap.otherParty?.slice(0, 6)}...{swap.otherParty?.slice(-4)}
                                      </span>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <span className="block text-sm font-bold text-purple-700 font-mono">
                                       {formatAmount(swap.amountOut, swap.toCoin)} {getTokenSymbol(swap.toCoin)}
                                    </span>
                                    <span className="text-[10px] text-purple-400 font-medium">Sent Successfully</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                    ) : swap.type === 'swap' ? (
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-gray-500">You Pay</span>
                          <span className="text-sm font-mono font-medium text-gray-900">
                            {formatAmount(swap.amountIn, swap.fromCoin)} {getTokenSymbol(swap.fromCoin)}
                          </span>
                        </div>
                        <div className="flex justify-center -my-2 relative z-10">
                           <div className="bg-white border border-gray-200 rounded-full p-1">
                              <ArrowRight size={12} className="text-gray-400" />
                           </div>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs font-medium text-gray-500">You Receive</span>
                          <span className="text-sm font-mono font-bold text-green-600">
                            {formatAmount(swap.amountOut, swap.toCoin)} {getTokenSymbol(swap.toCoin)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                         <div className="flex justify-between items-center mb-3">
                           <span className="text-xs font-medium text-gray-500">Amount</span>
                           <span className={`text-lg font-mono font-bold ${swap.type === 'send' ? 'text-gray-900' : 'text-green-600'}`}>
                             {swap.type === 'send' ? '-' : '+'}{formatAmount(swap.amountIn, swap.fromCoin)} {getTokenSymbol(swap.fromCoin)}
                           </span>
                         </div>
                         <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                           <span className="text-xs font-medium text-gray-500">
                             {swap.type === 'send' ? 'To' : 'From'}
                           </span>
                           <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                 {swap.otherParty?.slice(2, 4).toUpperCase()}
                              </div>
                              <span className="text-xs font-mono text-gray-700">
                                {swap.otherParty?.slice(0, 6)}...{swap.otherParty?.slice(-4)}
                              </span>
                           </div>
                         </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Memo */}
                  {swap.memo && (
                    <div className="mt-3 text-xs text-gray-500 bg-yellow-50 border border-yellow-100 rounded-lg p-2.5 italic">
                      &quot;{swap.memo}&quot;
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}

