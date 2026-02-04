/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrowDownUp } from 'lucide-react';
import { TokenInfo } from '@/hooks/useTokens';

type ReviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pendingAction: 'swap' | 'transfer' | null;
  amountIn: string;
  fromToken: TokenInfo | null;
  toToken: TokenInfo | null;
  quote: any;
  recipientAddress: string;
  gasEstimate: string;
  slippage: number;
};

export default function ReviewModal({
  isOpen,
  onClose,
  onConfirm,
  pendingAction,
  amountIn,
  fromToken,
  toToken,
  quote,
  recipientAddress,
  gasEstimate,
  slippage,
}: ReviewModalProps) {
  if (!isOpen) return null;

  const mode = pendingAction;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm m-4 transform transition-all scale-100">
        <h3 className="text-xl font-bold mb-4 text-gray-800">Review Transaction</h3>

        <div className="space-y-4">
          {/* From */}
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500 text-sm">You Pay</span>
            <div className="text-right">
              <div className="font-bold text-lg">{amountIn} {fromToken?.symbol}</div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center text-gray-400">
            <ArrowDownUp className="w-5 h-5" />
          </div>

          {/* To */}
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500 text-sm">You Receive</span>
            <div className="text-right">
              <div className="font-bold text-lg text-green-600">
                {quote ? (Number(quote.amountOut) / Math.pow(10, toToken?.decimals || 9)).toFixed(4) : '---'} {toToken?.symbol}
              </div>
              {mode === 'transfer' && fromToken && toToken && fromToken.symbol !== toToken.symbol && (
                <div className="text-xs text-purple-600 font-bold mt-1">Zap Mode Active ⚡</div>
              )}
            </div>
          </div>

          {/* Recipient (Only for Transfer) */}
          {mode === 'transfer' && (
            <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg">
              <div className="text-xs text-purple-800 font-bold mb-1">Send to Recipient</div>
              <div className="font-mono text-xs break-all text-gray-700">
                {recipientAddress}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="pt-4 border-t border-gray-100 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Network Cost</span>
              <span className="font-medium text-gray-800">{gasEstimate} SUI</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Max Slippage</span>
              <span className="font-medium text-gray-800">{slippage}%</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 ${
                mode === 'swap'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-blue-500/30'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-purple-500/30'
              }`}
            >
              Confirm {mode === 'swap' ? 'Swap' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
