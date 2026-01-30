'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, RefreshCw, ChevronRight, ChevronLeft } from 'lucide-react';
import { getSwapHistory, getTokenSymbol, SUI_NETWORK } from '@/utils/cetus';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  suiClient: any;
  refreshTrigger?: number;
}

export default function SwapHistory({ userAddress, suiClient, refreshTrigger }: SwapHistoryProps) {
  const [history, setHistory] = useState<SwapRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const explorerUrl = SUI_NETWORK === 'mainnet'
    ? 'https://suiscan.xyz/mainnet'
    : 'https://suiscan.xyz/testnet';

  const fetchHistory = useCallback(async () => {
    if (!userAddress || !suiClient) return;

    setLoading(true);
    try {
      const swaps = await getSwapHistory(suiClient, userAddress, '', 10);
      setHistory(swaps);
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
    const date = new Date(timestamp * 1000);
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
        className={`fixed right-0 top-0 h-screen w-80 bg-white shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Swap History</h2>
          <div className="flex gap-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* History List */}
        <div className="overflow-y-auto h-[calc(100vh-70px)]">
          {history.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {loading ? 'Loading...' : 'No swap history yet'}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {history.map((swap, idx) => (
                <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                  {/* Swap Pair */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {getTokenSymbol(swap.fromCoin)} → {getTokenSymbol(swap.toCoin)}
                      </span>
                    </div>
                    <a
                      href={`${explorerUrl}/txblock/${swap.txDigest}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>

                  {/* Amounts */}
                  <div className="text-xs text-gray-600 space-y-1 mb-2">
                    <div className="flex justify-between">
                      <span>In:</span>
                      <span>{formatAmount(swap.amountIn, 9)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Out:</span>
                      <span>{formatAmount(swap.amountOut, 6)}</span>
                    </div>
                  </div>

                  {/* Time */}
                  <div className="text-xs text-gray-400">
                    {formatTime(swap.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

