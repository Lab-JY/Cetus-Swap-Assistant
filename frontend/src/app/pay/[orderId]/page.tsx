'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { ShieldCheck, CreditCard, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ConnectButton } from '@mysten/dapp-kit';

import { SUI_COIN_TYPE, USDC_COIN_TYPE, getSwapQuote, buildSwapAndPayTx } from '@/utils/cetus';
import { ArrowDownCircle, TrendingUp } from 'lucide-react';
import YieldBadge from '@/components/YieldBadge';

// 🔴 TODO: Replace with your actual deployed package ID
const SUIPAY_PACKAGE_ID = '0x123...456'; 

export default function CheckoutPage({ params }: { params: { orderId: string } }) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Payment Method State
  const [payWithToken, setPayWithToken] = useState<string>(SUI_COIN_TYPE);
  const [estimatedCost, setEstimatedCost] = useState<string | null>(null);
  const [swapRoute, setSwapRoute] = useState<any>(null);
  
  const [orderData, setOrderData] = useState<{
    id: string; // UUID from DB
    merchantAddress: string;
    amount: number;
    currency: string;
    status: string;
    refId?: string;
    onChainOrderId?: string; 
  } | null>(null);

  // ... (keep useEffect for fetching order) ...
  // Mock Fetching for demo if DB is not running
  useEffect(() => {
    // 模拟数据 (真实场景请取消注释下方 fetch)
    setTimeout(() => {
        setOrderData({
            id: params.orderId,
            merchantAddress: "0x7d20dcdb2bca4f508ea9613994683eb4e76e9c4ed2766deaa212ce1e742f5142",
            amount: 10.00,
            currency: "USDC",
            status: "PENDING",
            refId: "INV-2026-001"
        });
        setIsLoading(false);
    }, 1000);
  }, [params.orderId]);

  // Quote Effect
  useEffect(() => {
    async function fetchQuote() {
        if (!orderData || payWithToken === USDC_COIN_TYPE) {
            setEstimatedCost(null);
            setSwapRoute(null);
            return;
        }

        // Target: USDC, Amount: orderData.amount
        // We need to fix Output Amount
        const amountOut = Math.floor(orderData.amount * 1_000_000); // 6 decimals for USDC
        
        // SUI -> USDC (Fix Output)
        // Note: Cetus Aggregator 'byAmountIn' = false means Fix Output
        const route = await getSwapQuote(payWithToken, USDC_COIN_TYPE, amountOut, false);
        
        if (route) {
            setSwapRoute(route);
            // route.amountIn is the required input amount (e.g. SUI)
            // Convert back to human readable (SUI has 9 decimals)
            const requiredSui = Number(route.amountIn) / 1_000_000_000;
            setEstimatedCost(requiredSui.toFixed(4));
        }
    }
    
    fetchQuote();
  }, [orderData, payWithToken]);

  const handlePay = async () => {
    if (!account || !orderData) return;
    setIsProcessing(true);

    try {
      const tx = new Transaction();
      
      if (swapRoute) {
        // Case A: Swap required (e.g. SUI -> USDC)
        console.log('Executing Cetus Swap...');
        
        // 1. Get required input amount from route
        const amountInInt = BigInt(swapRoute.amountIn.toString());
        
        // 2. Split SUI coin from gas
        const [inputCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInInt)]);
        
        // 3. Build PTB with Cetus SDK
        // This performs swap and transfers output coin to merchant
        await buildSwapAndPayTx(tx, swapRoute, inputCoin, orderData.merchantAddress);
        
      } else if (payWithToken === SUI_COIN_TYPE && orderData.currency !== 'SUI') {
         // Fallback safety check
         throw new Error("Unable to fetch swap route. Please try refreshing.");
      } else {
        // Case B: Direct Payment (e.g. SUI -> SUI)
        // Only supports SUI direct payment for now as we use tx.gas
        if (payWithToken !== SUI_COIN_TYPE) {
             throw new Error("Direct token payment (non-SUI) is not supported in this demo. Please use SUI.");
        }
        
        console.log('Executing Direct Payment...');
        const amountInt = BigInt(orderData.amount);
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInt)]);
        tx.transferObjects([coin], tx.pure.address(orderData.merchantAddress));
      }

      // 4. Execute transaction
      const response = await signAndExecute({ transaction: tx });
      console.log('Transaction Digest:', response.digest);

      // 2. 强依赖交互：轮询后端直到状态变为 PAID
      // 这是证明 Indexer 工作的唯一方式
      let isVerified = false;
      let attempts = 0;
      
      while (!isVerified && attempts < 10) {
        attempts++;
        await new Promise(r => setTimeout(r, 2000)); // 每 2 秒查一次
        
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const checkRes = await fetch(`${apiUrl}/orders/${params.orderId}`);
        const statusData = await checkRes.json();
        
        if (statusData.status === 'PAID') {
          isVerified = true;
          setIsSuccess(true);
        }
      }

      if (!isVerified) {
        throw new Error('Payment sent but backend indexer is slow. Please check dashboard later.');
      }

    } catch (err: any) {
      console.error(err);
      alert('Payment Error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-slate-500 font-medium">Securing payment gateway...</p>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h1 className="text-xl font-bold mb-2">Order Not Found</h1>
          <p className="text-slate-500 text-sm mb-6">{error || 'This payment link is invalid or has expired.'}</p>
          <button onClick={() => window.location.reload()} className="text-blue-600 font-bold">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Trust Badge */}
        <div className="flex items-center justify-center gap-2 mb-8 text-slate-400">
          <ShieldCheck size={18} />
          <span className="text-xs uppercase tracking-widest font-bold">Secure SuiPay Checkout</span>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-100 border border-slate-100 overflow-hidden">
          {/* Top Section */}
          <div className="p-8 text-center border-b border-slate-50">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CreditCard size={32} />
            </div>
            <h1 className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-tighter">Pay to Address</h1>
            <p className="text-sm font-mono text-slate-600 mb-4 break-all px-4">{orderData.merchantAddress}</p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-4xl font-black text-slate-900">
                ${(orderData.amount / 1_000_000).toFixed(2)}
              </span>
              <span className="text-xl font-bold text-slate-400 mt-2">{orderData.currency}</span>
            </div>
          </div>

          <div className="p-8">
            {!isSuccess ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Reference</span>
                    <span className="font-bold text-slate-700">{orderData.refId}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Network</span>
                    <span className="font-bold text-slate-700">Sui Testnet</span>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 items-start">
                  <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">
                    You are paying with <strong>StableLayer USDC</strong>. Please ensure you have enough SUI for gas fees.
                  </p>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700">Pay with</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setPayWithToken(SUI_COIN_TYPE)}
                            className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                                payWithToken === SUI_COIN_TYPE 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                            }`}
                        >
                            <span className="font-bold">SUI</span>
                            {payWithToken === SUI_COIN_TYPE && <CheckCircle2 size={16} />}
                        </button>
                        <button
                            onClick={() => setPayWithToken(USDC_COIN_TYPE)}
                            className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                                payWithToken === USDC_COIN_TYPE 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                            }`}
                        >
                            <span className="font-bold">USDC</span>
                            {payWithToken === USDC_COIN_TYPE && <CheckCircle2 size={16} />}
                        </button>
                    </div>
                </div>

                {/* Quote Display */}
                {payWithToken === SUI_COIN_TYPE && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-slate-500 font-medium">Estimated Cost</span>
                            {estimatedCost ? (
                                <span className="text-lg font-bold text-slate-900">{estimatedCost} SUI</span>
                            ) : (
                                <Loader2 className="animate-spin text-slate-400" size={16} />
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <ArrowDownCircle size={12} />
                            <span>Powered by <strong>Cetus Aggregator</strong></span>
                        </div>
                    </div>
                )}

                {!account ? (
                  <div className="text-center pt-2">
                    <p className="text-sm text-slate-500 mb-4">Connect your wallet to complete payment</p>
                    <div className="flex justify-center">
                      <ConnectButton />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                        onClick={handlePay}
                        disabled={isProcessing}
                        className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3"
                    >
                        {isProcessing ? (
                        <>
                            <Loader2 className="animate-spin" />
                            Confirming on Sui...
                        </>
                        ) : (
                        'Pay Now'
                        )}
                    </button>
                    
                    {/* ✨ 仅开发环境可见的模拟支付按钮 */}
                    {process.env.NODE_ENV === 'development' && (
                        <button
                            onClick={async () => {
                                if(!confirm("Simulate successful payment? (Dev only)")) return;
                                setIsProcessing(true);
                                try {
                                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                                    await fetch(`${apiUrl}/orders/${params.orderId}/mock-pay`, { method: 'POST' });
                                } catch(e) { console.error(e); }
                            }}
                            className="w-full py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                        >
                            🛠️ Simulate Payment (Dev Only)
                        </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-center space-y-6 animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={48} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Payment Successful!</h2>
                  <p className="text-slate-500 text-sm">The merchant has been notified.</p>
                </div>
                
                <div className="mx-4">
                    <YieldBadge />
                    <p className="text-[10px] text-slate-400 mt-2 text-center">
                        Funds are automatically routed to StableLayer for yield generation.
                    </p>
                </div>

                <div className="pt-4">
                  <button className="text-blue-600 font-bold hover:underline">View on Sui Explorer</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-400 text-xs">
            Powered by <strong>SuiPay</strong> • Infrastructure by <strong>StableLayer</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
