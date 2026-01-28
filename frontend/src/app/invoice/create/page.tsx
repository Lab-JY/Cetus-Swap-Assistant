'use client';

import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { CreditCard, ArrowLeft, Loader2, CheckCircle2, QrCode, Link as LinkIcon, Share2 } from 'lucide-react';
import Link from 'next/link';

export default function CreateInvoice() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  const [amount, setAmount] = useState('');
  const [refId, setRefId] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!amount || !account) return;
    
    setIsPending(true);
    
    try {
      const token = localStorage.getItem('suipay_token');
      if (!token) throw new Error('Not authenticated');

      // ✨ 金融级转换：将用户输入的 1.00 转换为 1,000,000 (USDC 6位小数)
      const rawAmount = Math.floor(parseFloat(amount) * 1_000_000);

      const response = await fetch('http://localhost:3001/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: rawAmount,
          currency: 'USDC',
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to create order');
      }

      const data = await response.json();
      setOrderId(data.id);
      setIsSuccess(true);
    } catch (error: any) {
      console.error('Failed to create order:', error);
      alert(error.message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-8 transition-colors">
          <ArrowLeft size={20} />
          Back to Dashboard
        </Link>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
          <div className="bg-blue-600 p-8 text-white text-center">
            <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
              <CreditCard size={32} />
            </div>
            <h1 className="text-2xl font-bold">Create Payment Request</h1>
            <p className="text-blue-100 text-sm">Funds will be sent to your connected wallet</p>
          </div>

          <div className="p-8">
            {!isSuccess ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Amount (USDC)</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-xl font-bold"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                      USDC
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Reference / Order ID</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2024-001"
                    value={refId}
                    onChange={(e) => setRefId(e.target.value)}
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <button
                  onClick={handleCreate}
                  disabled={!amount || isPending || !account}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Broadcasting to Sui...
                    </>
                  ) : (
                    'Generate Payment Link'
                  )}
                </button>
                
                {!account && (
                  <p className="text-center text-xs text-red-500 font-medium">
                    Please connect your wallet first
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center space-y-6 animate-in zoom-in-95 duration-500">
                <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 size={48} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Payment Link Ready!</h2>
                  <p className="text-slate-500 text-sm">Order ID: {orderId}</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <div className="aspect-square bg-white flex items-center justify-center rounded-xl mb-4">
                    <QrCode size={180} className="text-slate-800" />
                  </div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Scan to Pay</p>
                </div>

                <div className="flex gap-3">
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all">
                    <LinkIcon size={18} />
                    Copy Link
                  </button>
                  <button className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all">
                    <Share2 size={18} />
                  </button>
                </div>

                <button 
                  onClick={() => setIsSuccess(false)}
                  className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Create Another Invoice
                </button>
              </div>
            )}
          </div>
        </div>
        
        <p className="mt-8 text-center text-slate-400 text-xs">
          Securely processed via Sui Network & StableLayer SDK
        </p>
      </div>
    </div>
  );
}
