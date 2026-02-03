/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { SUI_NETWORK } from '@/utils/config';

type ReceiptData = {
  id: string;
  type: string;
  user: string;
  recipient?: string;
  fromCoin: string;
  toCoin: string;
  amountIn: string;
  amountOut: string;
  route: string;
  epoch: string;
  txDigest?: string;
};

const getTokenSymbol = (coinType: string) => {
  if (coinType.includes('::sui::SUI')) return 'SUI';
  if (coinType.includes('::usdc::USDC')) return 'USDC';
  if (coinType.includes('::cetus::CETUS')) return 'CETUS';
  if (coinType.includes('::coin::COIN')) return 'wUSDC';
  if (coinType.includes('::meme_token::MEME_TOKEN')) return 'MEME';
  if (coinType.includes('::idol_apple')) return 'IDOL_APPLE';
  if (coinType.includes('::idol_dgran')) return 'IDOL_DGRAN';
  return 'UNKNOWN';
};

const getCoinDecimals = (coinType: string) => {
  if (coinType.includes('::usdc::USDC') || coinType.includes('::coin::COIN')) return 6;
  return 9;
};

const formatAmount = (coinType: string, amount: string, precision: number = 6) => {
  const decimals = getCoinDecimals(coinType);
  const whole = amount.length > decimals ? amount.slice(0, -decimals) : '0';
  const frac = amount.length > decimals ? amount.slice(-decimals) : amount.padStart(decimals, '0');
  const trimmed = frac.slice(0, precision).replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
};

export default function ReceiptPage({ params }: { params: { id: string } }) {
  const receiptId = decodeURIComponent(params.id || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const explorerBase = SUI_NETWORK === 'mainnet'
    ? 'https://suiscan.xyz/mainnet'
    : 'https://suiscan.xyz/testnet';

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        setLoading(true);
        setError('');
        const client = new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) });
        const res = await client.getObject({
          id: receiptId,
          options: { showContent: true, showType: true, showOwner: true, showPreviousTransaction: true },
        });

        if (res.error) {
          throw new Error(res.error.code || 'Receipt not found');
        }

        const data = res.data;
        const content: any = data?.content;
        if (!content || content.dataType !== 'moveObject') {
          throw new Error('Invalid receipt object');
        }

        const fields: any = content.fields || {};
        const type = String(content.type || '');
        setReceipt({
          id: receiptId,
          type,
          user: String(fields.user || ''),
          recipient: fields.recipient ? String(fields.recipient) : undefined,
          fromCoin: String(fields.from_coin || ''),
          toCoin: String(fields.to_coin || ''),
          amountIn: String(fields.amount_in || '0'),
          amountOut: String(fields.amount_out || '0'),
          route: String(fields.route || ''),
          epoch: String(fields.timestamp || ''),
          txDigest: data?.previousTransaction || undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };

    if (receiptId) {
      fetchReceipt();
    } else {
      setLoading(false);
      setError('Missing receipt id');
    }
  }, [receiptId]);

  const shareLink = typeof window !== 'undefined' ? window.location.href : '';

  const downloadPng = async () => {
    if (!cardRef.current) return;
    try {
      setDownloading(true);
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `receipt-${receiptId.slice(0, 8)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export receipt', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div ref={cardRef} className="w-full max-w-xl bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Receipt Card</h1>
            <p className="text-xs text-gray-500">
              {SUI_NETWORK.toUpperCase()} · Cetus RoutePay
            </p>
          </div>
          <div className="text-xs font-mono text-gray-400">{receiptId.slice(0, 6)}…{receiptId.slice(-4)}</div>
        </div>

        {loading && (
          <div className="mt-6 text-sm text-gray-500">Loading receipt…</div>
        )}

        {!loading && error && (
          <div className="mt-6 text-sm text-red-600">{error}</div>
        )}

        {!loading && receipt && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="text-sm text-gray-500">Type</div>
              <div className="text-sm font-semibold text-gray-800">
                {receipt.type.includes('ZapReceipt') ? 'ZapReceipt' : 'SwapReceipt'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">From</div>
                <div className="text-sm font-semibold text-gray-900">
                  {formatAmount(receipt.fromCoin, receipt.amountIn)} {getTokenSymbol(receipt.fromCoin)}
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">To</div>
                <div className="text-sm font-semibold text-gray-900">
                  {formatAmount(receipt.toCoin, receipt.amountOut)} {getTokenSymbol(receipt.toCoin)}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">Route</div>
              <div className="text-sm font-semibold text-gray-800 break-words">{receipt.route || '—'}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">User</div>
                <div className="text-xs font-mono text-gray-700 break-all">{receipt.user}</div>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">Recipient</div>
                <div className="text-xs font-mono text-gray-700 break-all">{receipt.recipient || '—'}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">Epoch</div>
                <div className="text-sm font-semibold text-gray-900">{receipt.epoch || '—'}</div>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <div className="text-xs text-gray-500">Tx Digest</div>
                <div className="text-xs font-mono text-gray-700 break-all">{receipt.txDigest || '—'}</div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 p-4">
              <div className="text-xs text-gray-500">Receipt ID</div>
              <div className="text-xs font-mono text-gray-700 break-all">{receipt.id}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(shareLink)}
                className="w-full rounded-xl border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Copy Share Link
              </button>
              <a
                href={`${explorerBase}/object/${receipt.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-xl border border-gray-200 bg-white py-2 text-center text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Open in Explorer
              </a>
            </div>
            <button
              onClick={downloadPng}
              disabled={downloading}
              className="w-full rounded-xl border border-gray-200 bg-emerald-50 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              {downloading ? 'Exporting...' : 'Download PNG'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
