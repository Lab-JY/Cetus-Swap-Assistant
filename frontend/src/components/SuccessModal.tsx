import { CheckCircle2 } from 'lucide-react';
import { SUI_NETWORK } from '@/utils/cetus';

type SuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  desc: string;
  btnText: string;
  lastTxDigest: string;
  lastReceiptId: string | null;
  receiptError?: string;
};

export default function SuccessModal({
  isOpen,
  onClose,
  title,
  desc,
  btnText,
  lastTxDigest,
  lastReceiptId,
  receiptError,
}: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center transform transition-all scale-100 animate-in zoom-in-95 duration-200">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 mb-6">{desc}</p>

        {lastTxDigest && (
          <a
            href={`${SUI_NETWORK === 'mainnet' ? 'https://suiscan.xyz/mainnet' : 'https://suiscan.xyz/testnet'}/tx/${lastTxDigest}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-gray-50 hover:bg-blue-50 rounded-lg p-3 mb-6 text-xs text-blue-600 hover:text-blue-700 break-all font-mono transition-colors cursor-pointer"
          >
            Tx: {lastTxDigest}
          </a>
        )}

        {lastReceiptId ? (
          <div className="mb-6 space-y-2">
            <a
              href={`/receipt/${lastReceiptId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-emerald-50 hover:bg-emerald-100 rounded-lg p-3 text-xs text-emerald-700 break-all font-mono transition-colors cursor-pointer"
            >
              Receipt: {lastReceiptId}
            </a>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const link = `${window.location.origin}/receipt/${lastReceiptId}`;
                  navigator.clipboard.writeText(link).catch(() => {});
                }}
                className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2 rounded-lg transition-colors"
              >
                Copy Receipt Link
              </button>
              <a
                href={`${SUI_NETWORK === 'mainnet' ? 'https://suiscan.xyz/mainnet' : 'https://suiscan.xyz/testnet'}/object/${lastReceiptId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2 rounded-lg text-center transition-colors"
              >
                View on Explorer
              </a>
            </div>
          </div>
        ) : receiptError ? (
          <div className="mb-6 p-3 bg-amber-50 rounded-lg text-xs text-amber-700 border border-amber-100">
             ⚠️ {receiptError}
          </div>
        ) : null}

        <button
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-500/30"
        >
          {btnText}
        </button>
      </div>
    </div>
  );
}
