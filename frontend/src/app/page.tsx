'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_COIN_TYPE, USDC_COIN_TYPE, CETUS_COIN_TYPE, WUSDC_COIN_TYPE, getSwapQuote, buildSimpleSwapTx, SUI_NETWORK } from '@/utils/cetus';
import Image from 'next/image';
import { RefreshCcw, ArrowDownUp, Wallet, LogOut, Copy, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { getGoogleLoginUrl, clearZkLoginSession } from '@/utils/zklogin';
import confetti from 'canvas-confetti';

const ALL_TOKENS = [
  { symbol: 'SUI', name: 'Sui', type: SUI_COIN_TYPE, decimals: 9, icon: '💧' },
  { symbol: 'USDC', name: 'USD Coin', type: USDC_COIN_TYPE, decimals: 6, icon: '💵' },
  { symbol: 'CETUS', name: 'Cetus Token', type: CETUS_COIN_TYPE, decimals: 9, icon: '🌊' },
  { symbol: 'wUSDC', name: 'Wormhole USDC', type: WUSDC_COIN_TYPE, decimals: 6, icon: '🌉' },
];

const TOKENS_LIST = SUI_NETWORK === 'testnet' 
  ? ALL_TOKENS.filter(t => ['SUI', 'USDC'].includes(t.symbol)) 
  : ALL_TOKENS;

export default function SwapPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // zkLogin State
  const [zkLoginAddress, setZkLoginAddress] = useState<string | null>(null);

  useEffect(() => {
    // Check for zkLogin session
    const addr = window.sessionStorage.getItem('zklogin_address');
    if (addr) setZkLoginAddress(addr);
  }, []);

  const handleGoogleLogin = () => {
    // Current Epoch is roughly needed for nonce, we can fetch it or just use a safe future one.
    // For MVP, we'll fetch current epoch from network.
    suiClient.getLatestSuiSystemState().then(state => {
        const epoch = Number(state.epoch);
        window.location.href = getGoogleLoginUrl(epoch);
    });
  };

  const handleLogout = () => {
    clearZkLoginSession();
    setZkLoginAddress(null);
  };

  // ⚠️ Priority: zkLogin > Wallet
  // If user logs in with Google, we show that account even if wallet is connected.
  const currentAddress = zkLoginAddress || account?.address;

  const [fromToken, setFromToken] = useState(TOKENS_LIST[0]); // Default SUI
  const [toToken, setToToken] = useState(TOKENS_LIST[1]);   // Default USDC
  const [amountIn, setAmountIn] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [swapStatus, setSwapStatus] = useState<'idle' | 'swapping' | 'success' | 'error'>('idle');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTxDigest, setLastTxDigest] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 💰 Fetch Balance
  const { data: balanceData, refetch: refetchBalance } = useSuiClientQuery(
    'getBalance',
    {
      owner: currentAddress || '',
      coinType: fromToken.type,
    },
    {
      enabled: !!currentAddress,
      refetchInterval: 10000,
    }
  );

  const balance = balanceData 
    ? (parseInt(balanceData.totalBalance) / Math.pow(10, fromToken.decimals))
    : 0;

  const formattedBalance = balanceData ? balance.toFixed(4) : '---';

  // Debounce Quote Fetching
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amountIn || parseFloat(amountIn) <= 0) {
        setQuote(null);
        return;
      }

      setLoading(true);
      try {
        console.log("Fetching quote for:", amountIn, fromToken.symbol, "->", toToken.symbol);
        const rawAmount = Math.floor(parseFloat(amountIn) * Math.pow(10, fromToken.decimals));
        const routes = await getSwapQuote(fromToken.type, toToken.type, rawAmount);
        console.log("Quote received:", routes);
        setQuote(routes);
      } catch (err) {
        console.error("Quote Error:", err);
        setQuote(null);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [amountIn, fromToken, toToken]);

  const handleSwap = async () => {
    if (!currentAddress || !quote) return;

    setSwapStatus('swapping');
    setErrorMessage('');

    try {
      const tx = new Transaction();
      
      // We need to get the Coin object for the input amount.
      // For simplicity in this MVP, we assume the user has one coin with enough balance or we merge them.
      // In a real app, we should select coins intelligently.
      // Here, we'll try to split the gas coin (if SUI) or find a coin object.
      
      let inputCoin;
      const amountInRaw = BigInt(Math.floor(parseFloat(amountIn) * Math.pow(10, fromToken.decimals)));

      // ⚠️ CLMM SDK (Fallback) builds its own transaction with its own coin selection logic.
      // We only need to manually split coins if we are using the Aggregator (which appends to our tx).
      if (quote.source !== 'clmm') {
          if (fromToken.symbol === 'SUI') {
            inputCoin = tx.splitCoins(tx.gas, [tx.pure.u64(amountInRaw)]);
          } else {
            // Fetch coins for other tokens
            const { data: coins } = await suiClient.getCoins({
              owner: currentAddress,
              coinType: fromToken.type
            });
            
            if (coins.length === 0) throw new Error(`No ${fromToken.symbol} balance found.`);
            
            // Simple strategy: take the first coin that has enough balance, or merge (not implemented for simplicity)
            // ideally we merge coins here.
            // For Hackathon MVP: Just pick the first one with enough balance or fail.
            const validCoin = coins.find(c => BigInt(c.balance) >= amountInRaw);
            if (validCoin) {
                // Split it to exact amount
                const primaryCoin = tx.object(validCoin.coinObjectId);
                inputCoin = tx.splitCoins(primaryCoin, [tx.pure.u64(amountInRaw)]);
            } else {
                // If no single coin is enough, we need to merge. 
                // Implementing merge logic is complex for MVP 1-file.
                // We'll throw specific error.
                throw new Error(`Insufficient single-coin balance for ${fromToken.symbol}. Please merge coins.`);
            }
          }
      }

      const finalTx = await buildSimpleSwapTx(tx, quote, inputCoin, currentAddress, toToken.type);

      // Ensure gas budget is set if needed (especially for SUI swaps)
      if (fromToken.symbol === 'SUI') {
          finalTx.setGasBudget(100000000);
      }

      if (account) {
          // 🟢 Wallet Adapter Mode
          signAndExecuteTransaction(
            { transaction: finalTx },
            {
              onSuccess: (result) => {
                console.log('Swap Success:', result);
                setSwapStatus('success');
                setLastTxDigest(result.digest);
                setAmountIn('');
                setQuote(null);
                refetchBalance(); // Refresh balance after swap
                setShowSuccessModal(true);
                
                // 🎉 Confetti Effect
                const duration = 3000;
                const end = Date.now() + duration;

                const frame = () => {
                  confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#3b82f6', '#10b981', '#6366f1']
                  });
                  confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#3b82f6', '#10b981', '#6366f1']
                  });

                  if (Date.now() < end) {
                    requestAnimationFrame(frame);
                  }
                };
                frame();
              },
              onError: (error) => {
                console.error('Swap Failed:', error);
                setSwapStatus('error');
                setErrorMessage(error.message);
              },
            }
          );
      } else if (zkLoginAddress) {
          // 🔵 zkLogin Mode (Not fully implemented signing in this demo)
          setErrorMessage("zkLogin Signing is pending integration with Proving Service. Please use Sui Wallet for now.");
          setSwapStatus('error');
      }

    } catch (e: unknown) {
      console.error(e);
      setSwapStatus('error');
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const outputAmount = quote 
    ? (Number(quote.amountOut) / Math.pow(10, toToken.decimals)).toFixed(4) 
    : '---';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <RefreshCcw className="h-6 w-6 animate-spin-slow" />
              <h1 className="text-2xl font-bold">Cetus Swap</h1>
            </div>
            <p className="text-sm opacity-80 mt-1">Best Price Aggregator</p>
          </div>
          
          {/* Wallet / zkLogin */}
          <div className="flex gap-2">
            {currentAddress && (
               <div className="flex gap-2 items-center">
                  {zkLoginAddress ? (
                      <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 relative group">
                          <Image src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="G" width={16} height={16} />
                          <div className="flex flex-col text-left">
                              <span className="text-[10px] text-blue-200 leading-none">Demo Wallet</span>
                              <span className="text-sm font-mono">{zkLoginAddress.slice(0, 4)}...{zkLoginAddress.slice(-4)}</span>
                          </div>
                          <button 
                            onClick={() => navigator.clipboard.writeText(zkLoginAddress)}
                            className="ml-2 text-white/50 hover:text-white transition-colors"
                            title="Copy Full Address"
                          >
                              <Copy size={14}/>
                          </button>
                          <button onClick={handleLogout} className="ml-1 text-white/50 hover:text-red-300 transition-colors"><LogOut size={14}/></button>
                      </div>
                  ) : (
                      <ConnectButton />
                  )}
               </div>
            )}
          </div>
        </div>

        {/* Swap Card */}
        <div className="p-6 space-y-6">
          
          {/* From Token */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">You Pay</span>
              <div className="text-sm text-gray-500 flex gap-2 items-center">
                 <Wallet className="w-3 h-3" />
                 <span>{formattedBalance}</span>
                 {account && (
                   <button 
                     onClick={() => setAmountIn((balance - 0.01 > 0 ? balance - 0.01 : 0).toString())} 
                     className="text-blue-600 font-bold hover:text-blue-700 text-xs bg-blue-50 px-2 py-0.5 rounded ml-1 transition-colors"
                   >
                     MAX
                   </button>
                 )}
              </div>
            </div>
            <div className="flex gap-3 items-center">
              <input 
                type="number" 
                placeholder="0.0" 
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                className="bg-transparent text-3xl font-bold text-gray-800 w-full outline-none placeholder-gray-300"
              />
              <div className="relative">
                <select 
                  value={fromToken.symbol}
                  onChange={(e) => setFromToken(TOKENS_LIST.find(t => t.symbol === e.target.value) || TOKENS_LIST[0])}
                  className="appearance-none bg-white pl-3 pr-8 py-2 rounded-xl font-bold shadow-sm border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors focus:outline-none focus:border-blue-500"
                >
                  {TOKENS_LIST.map(t => <option key={t.symbol} value={t.symbol}>{t.icon} {t.symbol}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Swap Icon */}
          <div className="flex justify-center -my-5 relative z-10">
             <button 
               className="bg-white p-2 rounded-full shadow-lg border border-gray-100 cursor-pointer hover:bg-gray-50 hover:scale-110 transition-transform duration-200 group"
               onClick={() => {
                 const temp = fromToken;
                 setFromToken(toToken);
                 setToToken(temp);
               }}
             >
                <ArrowDownUp className="h-5 w-5 text-blue-500 group-hover:rotate-180 transition-transform duration-300" />
             </button>
          </div>

          {/* To Token */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">You Receive</span>
              {quote && <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded">Best Price</span>}
            </div>
            <div className="flex gap-3 items-center">
              <div className={`text-3xl font-bold w-full ${loading ? 'text-gray-300' : 'text-gray-800'}`}>
                {loading ? 'Searching...' : outputAmount}
              </div>
              <div className="relative">
                <select 
                  value={toToken.symbol}
                  onChange={(e) => setToToken(TOKENS_LIST.find(t => t.symbol === e.target.value) || TOKENS_LIST[1])}
                  className="appearance-none bg-white pl-3 pr-8 py-2 rounded-xl font-bold shadow-sm border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors focus:outline-none focus:border-blue-500"
                >
                  {TOKENS_LIST.map(t => <option key={t.symbol} value={t.symbol}>{t.icon} {t.symbol}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Route Info */}
          {quote && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-800">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold">Best Route Found</span>
                <span className="bg-blue-200 px-2 py-0.5 rounded text-xs text-blue-900">Aggregator</span>
              </div>
              <div className="flex items-center gap-2 text-xs opacity-80 flex-wrap">
                 {/* Simple visualization of providers */}
                 {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                 {quote.paths[0]?.steps?.map((step: any, idx: number) => (
                    <span key={idx} className="flex items-center">
                        {idx > 0 && <span className="mx-1">→</span>}
                        <span>Pool via {quote.paths[0].label || 'Cetus'}</span>
                    </span>
                 ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          {currentAddress ? (
             <button 
                onClick={handleSwap}
                disabled={!quote || loading || swapStatus === 'swapping'}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all
                  ${!quote || loading ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30'}
                `}
             >
                {swapStatus === 'swapping' ? 'Swapping...' : 'Swap Now'}
             </button>
          ) : (
             <div className="w-full flex gap-3">
               <button onClick={handleGoogleLogin} className="flex-1 py-4 rounded-xl font-bold text-lg bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 flex justify-center items-center gap-2 transition-all">
                  <Image src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="G" width={24} height={24} />
                  Google Login
               </button>
               <div className="flex-1">
                  <ConnectButton className="w-full !justify-center !py-4 !rounded-xl !text-lg !font-bold" />
               </div>
             </div>
          )}
          
          {/* Status Messages */}
          {swapStatus === 'error' && (
              <div className="p-3 bg-red-100 text-red-700 rounded-lg text-center text-sm break-all flex items-center gap-2 justify-center">
                  <XCircle size={18} />
                  <span>{errorMessage}</span>
              </div>
          )}

        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center transform transition-all scale-100 animate-in zoom-in-95 duration-200">
             <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
             </div>
             <h3 className="text-2xl font-bold text-gray-900 mb-2">Swap Successful!</h3>
             <p className="text-gray-500 mb-6">Your transaction has been processed successfully on the Sui Network.</p>
             
             {lastTxDigest && (
               <div className="bg-gray-50 rounded-lg p-3 mb-6 text-xs text-gray-500 break-all font-mono">
                 Tx: {lastTxDigest}
               </div>
             )}

             <button 
               onClick={() => setShowSuccessModal(false)}
               className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-500/30"
             >
               Close
             </button>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="mt-8 text-center text-gray-400 text-sm">
        <p>Powered by Cetus Aggregator SDK on Sui {SUI_NETWORK === 'testnet' ? 'Testnet' : 'Mainnet'}</p>
        {SUI_NETWORK === 'testnet' && (
          <div className="flex items-center justify-center gap-2 mt-2 text-yellow-600 bg-yellow-50 py-1 px-3 rounded-full inline-flex">
             <AlertTriangle size={14} />
             <span className="text-xs font-medium">Testnet Mode: Only SUI-USDC supported</span>
          </div>
        )}
      </div>
    </div>
  );
}
