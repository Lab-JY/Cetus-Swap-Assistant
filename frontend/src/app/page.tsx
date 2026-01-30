'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_COIN_TYPE, USDC_COIN_TYPE, CETUS_COIN_TYPE, WUSDC_COIN_TYPE, getSwapQuote, buildSimpleSwapTx, SUI_NETWORK } from '@/utils/cetus';
import Image from 'next/image';
import { RefreshCcw, ArrowDownUp, Wallet, LogOut, Copy, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { getGoogleLoginUrl, clearZkLoginSession, signTransactionWithZkLogin } from '@/utils/zklogin';
import confetti from 'canvas-confetti';
import SwapHistory from '@/components/SwapHistory';

const MAINNET_TOKENS = [
  { symbol: 'SUI', name: 'Sui', type: SUI_COIN_TYPE, decimals: 9, icon: '💧' },
  { symbol: 'USDC', name: 'USD Coin', type: USDC_COIN_TYPE, decimals: 6, icon: '💵' },
  { symbol: 'CETUS', name: 'Cetus Token', type: CETUS_COIN_TYPE, decimals: 9, icon: '🌊' },
  { symbol: 'wUSDC', name: 'Wormhole USDC', type: WUSDC_COIN_TYPE, decimals: 6, icon: '🌉' },
];

const TESTNET_TOKENS = [
  { symbol: 'SUI', name: 'Sui', type: '0x2::sui::SUI', decimals: 9, icon: '💧' },
  { symbol: 'MEME', name: 'Meme Token', type: '0x5bab1e6852a537a8b07edd10ed9bc2e41d9c75b2ada472bc9bd6bed14000563b::meme_token::MEME_TOKEN', decimals: 9, icon: '🎭' },
  { symbol: 'IDOL_APPLE', name: 'Idol Apple', type: '0xb8adb26867c2dfecdbd7c309754b1e6cc15a0bbe767d28fc28bece56ad991d4c::idol_apple_1767616383788::IDOL_APPLE_1767616383788', decimals: 9, icon: '🍎' },
  { symbol: 'IDOL_DGRAN', name: 'Idol Dgran', type: '0xbe4c4cc55d3aaa1a9c01f17b88199b06b96c032fc698184ea71235260f1d6d4c::idol_dgran_1767614261042::IDOL_DGRAN_1767614261042', decimals: 9, icon: '🎪' },
];

const TOKENS_LIST = SUI_NETWORK === 'testnet' ? TESTNET_TOKENS : MAINNET_TOKENS;

export default function SwapPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // zkLogin State
  const [zkLoginAddress, setZkLoginAddress] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<'wallet' | 'zklogin' | null>(null);

  useEffect(() => {
    // Check for zkLogin session
    const addr = window.sessionStorage.getItem('zklogin_address');
    if (addr) {
      setZkLoginAddress(addr);
      setLoginMethod('zklogin');
    }

    // Check for wallet connection
    if (account?.address) {
      setWalletAddress(account.address);
      setLoginMethod('wallet');
    }
  }, [account?.address]);

  const handleGoogleLogin = () => {
    suiClient.getLatestSuiSystemState().then(state => {
        const epoch = Number(state.epoch);
        window.location.href = getGoogleLoginUrl(epoch);
    });
  };

  const handleLogout = () => {
    clearZkLoginSession();
    setZkLoginAddress(null);
    setWalletAddress(null);
    setLoginMethod(null);
  };

  // Determine current address based on login method
  const currentAddress = loginMethod === 'wallet' ? walletAddress : loginMethod === 'zklogin' ? zkLoginAddress : null;

  const [fromToken, setFromToken] = useState(TOKENS_LIST[0]); // Default SUI
  const [toToken, setToToken] = useState(TOKENS_LIST[1]);   // Default USDC
  const [amountIn, setAmountIn] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quote, setQuote] = useState<any>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [swapStatus, setSwapStatus] = useState<'idle' | 'swapping' | 'confirming' | 'success' | 'error'>('idle');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTxDigest, setLastTxDigest] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [txWaitMessage, setTxWaitMessage] = useState('');
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);

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
        setErrorMessage('');
        return;
      }

      if (!currentAddress) {
        setQuote(null);
        setErrorMessage('');
        return;
      }

      setLoading(true);
      setErrorMessage('');
      try {
        console.log("Fetching quote for:", amountIn, fromToken.symbol, "->", toToken.symbol);
        const rawAmount = Math.floor(parseFloat(amountIn) * Math.pow(10, fromToken.decimals));
        const routes = await getSwapQuote(fromToken.type, toToken.type, rawAmount, currentAddress);
        console.log("Quote received:", routes);

        // Check if the response is an error
        if (routes && (routes as any).error) {
          setQuote(null);
          setErrorMessage((routes as any).errorMessage);
        } else {
          setQuote(routes);
        }
      } catch (err) {
        console.error("Quote Error:", err);
        setQuote(null);
        setErrorMessage(err instanceof Error ? err.message : "Failed to fetch quote");
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
      let inputCoin;
      let tx: Transaction | null = null;
      const amountInRaw = BigInt(Math.floor(parseFloat(amountIn) * Math.pow(10, fromToken.decimals)));

      // ⚠️ CLMM SDK (Fallback) builds its own transaction with its own coin selection logic.
      // We only need to manually split coins if we are using the Aggregator (which appends to our tx).
      if (quote.source !== 'clmm') {
          tx = new Transaction();
          if (fromToken.symbol === 'SUI') {
            inputCoin = tx.splitCoins(tx.gas, [tx.pure.u64(amountInRaw)]);
          } else {
            // Fetch coins for other tokens
            const { data: coins } = await suiClient.getCoins({
              owner: currentAddress,
              coinType: fromToken.type
            });

            if (coins.length === 0) throw new Error(`No ${fromToken.symbol} balance found.`);

            // Sort coins by balance descending to find best candidates
            const sortedCoins = coins.sort((a, b) => Number(BigInt(b.balance) - BigInt(a.balance)));

            // Try to find a single coin with enough balance
            const validCoin = sortedCoins.find(c => BigInt(c.balance) >= amountInRaw);
            if (validCoin) {
                // Split it to exact amount
                const primaryCoin = tx.object(validCoin.coinObjectId);
                inputCoin = tx.splitCoins(primaryCoin, [tx.pure.u64(amountInRaw)]);
            } else {
                // Merge multiple coins if needed
                const coinsToMerge = [];
                let totalBalance = BigInt(0);

                for (const coin of sortedCoins) {
                  coinsToMerge.push(tx.object(coin.coinObjectId));
                  totalBalance += BigInt(coin.balance);
                  if (totalBalance >= amountInRaw) break;
                }

                if (totalBalance < amountInRaw) {
                  throw new Error(`Insufficient balance for ${fromToken.symbol}. Need ${(Number(amountInRaw) / Math.pow(10, fromToken.decimals)).toFixed(4)}, have ${(Number(totalBalance) / Math.pow(10, fromToken.decimals)).toFixed(4)}`);
                }

                // Merge all coins into the first one
                if (coinsToMerge.length > 1) {
                  tx.mergeCoins(coinsToMerge[0], coinsToMerge.slice(1));
                }

                // Split the merged coin to exact amount
                inputCoin = tx.splitCoins(coinsToMerge[0], [tx.pure.u64(amountInRaw)]);
            }
          }
      }

      // Pass full quote to buildSimpleSwapTx (selectedRouteId is only for UI display)
      const finalTx = await buildSimpleSwapTx(tx, quote, inputCoin, currentAddress, toToken.type);

      // Ensure gas budget is set if needed (especially for SUI swaps)
      if (fromToken.symbol === 'SUI') {
          finalTx.setGasBudget(100000000);
      }

      if (account) {
          // 🟢 Wallet Adapter Mode
          setTxWaitMessage('Waiting for wallet confirmation...');
          signAndExecuteTransaction(
            { transaction: finalTx },
            {
              onSuccess: (result) => {
                console.log('Swap Success:', result);
                setTxWaitMessage('Confirming transaction on blockchain...');
                setSwapStatus('confirming');
                setLastTxDigest(result.digest);

                // Wait for transaction confirmation
                setTimeout(() => {
                  setSwapStatus('success');
                  setAmountIn('');
                  setQuote(null);
                  setTxWaitMessage('');
                  refetchBalance(); // Refresh balance after swap
                  setHistoryRefreshTrigger(prev => prev + 1); // Trigger history refresh
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
                }, 2000);
              },
              onError: (error) => {
                console.error('Swap Failed:', error);
                setSwapStatus('error');
                setTxWaitMessage('');
                setErrorMessage(error.message);
              },
            }
          );
      } else if (zkLoginAddress) {
          // 🔵 zkLogin Mode - Sign with Proving Service
          try {
            setTxWaitMessage('Generating ZK proof from Proving Service...');

            const jwt = window.sessionStorage.getItem('zklogin_jwt');
            if (!jwt) {
              throw new Error('JWT not found in session');
            }

            // Sign transaction with zkLogin
            const { transactionBlockSerialized, signature } = await signTransactionWithZkLogin(finalTx, jwt);

            setTxWaitMessage('Submitting transaction to Sui network...');

            // Execute transaction with zkLogin signature
            const response = await suiClient.executeTransactionBlock({
              transactionBlock: transactionBlockSerialized,
              signature: signature,
              options: {
                showEffects: true,
              },
            });

            console.log('zkLogin Swap Success:', response);
            setTxWaitMessage('Confirming transaction on blockchain...');
            setSwapStatus('confirming');
            setLastTxDigest(response.digest);

            // Wait for transaction confirmation
            setTimeout(() => {
              setSwapStatus('success');
              setAmountIn('');
              setQuote(null);
              setTxWaitMessage('');
              refetchBalance();
              setHistoryRefreshTrigger(prev => prev + 1); // Trigger history refresh
              setShowSuccessModal(true);

              // Confetti Effect
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
            }, 2000);
          } catch (error) {
            console.error('zkLogin Swap Failed:', error);
            setSwapStatus('error');
            setTxWaitMessage('');
            setErrorMessage(error instanceof Error ? error.message : 'zkLogin transaction failed');
          }
      }

    } catch (e: unknown) {
      console.error(e);
      setSwapStatus('error');
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  };

  // Calculate price impact
  const calculatePriceImpact = () => {
    if (!quote || !amountIn || parseFloat(amountIn) <= 0) return null;

    // Simple price impact: compare actual output to theoretical output at spot price
    // This is a simplified calculation - real implementation would use oracle prices
    const inputAmount = parseFloat(amountIn);
    const outputAmount = Number(quote.amountOut) / Math.pow(10, toToken.decimals);

    // Rough estimate: assume 0.3% fee and minimal slippage for "fair" price
    // In reality, this should compare to spot price from an oracle
    const estimatedFairOutput = inputAmount * 0.997; // Rough estimate
    const impact = ((estimatedFairOutput - outputAmount) / estimatedFairOutput) * 100;

    return Math.max(0, impact); // Don't show negative impact
  };

  const priceImpact = calculatePriceImpact();
  const PRICE_IMPACT_THRESHOLD = 5; // Disable swap if price impact > 5%
  const isHighPriceImpact = priceImpact !== null && priceImpact > PRICE_IMPACT_THRESHOLD;

  // Generate popular pairs based on selected fromToken
  const getPopularPairs = () => {
    const pairs: Array<{ from: string; to: string }> = [];
    const availableTokens = TOKENS_LIST.filter(t => t.symbol !== fromToken.symbol);

    // Show all available pairs with the selected fromToken
    availableTokens.forEach(token => {
      pairs.push({ from: fromToken.symbol, to: token.symbol });
    });

    return pairs;
  };

  const outputAmount = quote
    ? (Number(quote.amountOut) / Math.pow(10, toToken.decimals)).toFixed(4)
    : '---';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Main Swap Card */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
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
                  {loginMethod === 'wallet' ? (
                      <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/20">
                          <Wallet className="w-4 h-4" />
                          <div className="flex flex-col text-left">
                              <span className="text-[10px] text-blue-200 leading-none">Wallet Connected</span>
                              <span className="text-sm font-mono">{walletAddress?.slice(0, 4)}...{walletAddress?.slice(-4)}</span>
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(walletAddress || '')}
                            className="ml-2 text-white/50 hover:text-white transition-colors"
                            title="Copy Full Address"
                          >
                              <Copy size={14}/>
                          </button>
                          <button onClick={handleLogout} className="ml-1 text-white/50 hover:text-red-300 transition-colors"><LogOut size={14}/></button>
                      </div>
                  ) : loginMethod === 'zklogin' ? (
                      <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/20">
                          <Image src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="G" width={16} height={16} />
                          <div className="flex flex-col text-left">
                              <span className="text-[10px] text-blue-200 leading-none">Google Login</span>
                              <span className="text-sm font-mono">{zkLoginAddress?.slice(0, 4)}...{zkLoginAddress?.slice(-4)}</span>
                          </div>
                          <button
                            onClick={() => navigator.clipboard.writeText(zkLoginAddress || '')}
                            className="ml-2 text-white/50 hover:text-white transition-colors"
                            title="Copy Full Address"
                          >
                              <Copy size={14}/>
                          </button>
                          <button onClick={handleLogout} className="ml-1 text-white/50 hover:text-red-300 transition-colors"><LogOut size={14}/></button>
                      </div>
                  ) : null}
               </div>
            )}
          </div>
        </div>

        {/* Swap Card */}
        <div className="p-6 space-y-6">

          {/* Quick Pair Selector */}
          {currentAddress && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200">
              <div className="text-xs font-semibold text-gray-600 mb-2">Popular Pairs with {fromToken.symbol}:</div>
              <div className="flex flex-wrap gap-2">
                {getPopularPairs().map((pair) => (
                  <button
                    key={`${pair.from}-${pair.to}`}
                    onClick={() => {
                      setFromToken(TOKENS_LIST.find(t => t.symbol === pair.from) || TOKENS_LIST[0]);
                      setToToken(TOKENS_LIST.find(t => t.symbol === pair.to) || TOKENS_LIST[1]);
                    }}
                    className="px-3 py-1 bg-white border border-blue-300 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                  >
                    {pair.from} → {pair.to}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* From Token */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">You Pay</span>
              <div className="text-sm text-gray-500 flex gap-2 items-center">
                 <Wallet className="w-3 h-3" />
                 <span>{formattedBalance}</span>
                 {currentAddress && (
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

          {/* Route Info & Price Impact */}
          {quote && (
            <div className="space-y-2">
              <div className={`p-3 rounded-lg border ${quote.source === 'aggregator' ? 'bg-blue-50 border-blue-100' : 'bg-purple-50 border-purple-100'}`}>
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold text-gray-800">Route Details</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${quote.source === 'aggregator' ? 'bg-blue-200 text-blue-900' : 'bg-purple-200 text-purple-900'}`}>
                    {quote.source === 'aggregator' ? '🔀 Aggregator' : '🎯 Direct Pool'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Route Type */}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium text-gray-800">
                      {quote.source === 'aggregator' ? 'Multi-hop via Cetus Aggregator' : `Direct ${fromToken.symbol}-${toToken.symbol} Pool`}
                    </span>
                  </div>

                  {/* Output Amount */}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Output:</span>
                    <span className="font-medium text-gray-800">
                      {(Number(quote.amountOut) / Math.pow(10, toToken.decimals)).toFixed(6)} {toToken.symbol}
                    </span>
                  </div>

                  {/* Fee Information */}
                  {quote.estimatedFee !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Est. Fee:</span>
                      <span className="font-medium text-gray-800">
                        {quote.estimatedFee > 0 ? `${quote.estimatedFee} ${toToken.symbol}` : 'Included'}
                      </span>
                    </div>
                  )}

                  {/* Path Information */}
                  {quote.source === 'aggregator' && quote.paths && (
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <div className="text-gray-600 mb-1">Paths ({quote.paths.length}):</div>
                      <div className="space-y-1">
                        {quote.paths.map((path: any, idx: number) => (
                          <div key={idx} className="text-gray-700 ml-2">
                            • {path.label || `Path ${idx + 1}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pool Address for Direct Swaps */}
                  {quote.source !== 'aggregator' && quote.poolAddress && (
                    <div className="mt-2 pt-2 border-t border-purple-200">
                      <div className="text-gray-600 mb-1">Pool:</div>
                      <div className="text-gray-700 ml-2 font-mono text-[10px] break-all">
                        {quote.poolAddress.slice(0, 10)}...{quote.poolAddress.slice(-8)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Impact Warning */}
              {priceImpact !== null && (
                <div className={`p-3 rounded-lg border text-sm ${
                  priceImpact > 5 ? 'bg-red-50 border-red-100 text-red-700' :
                  priceImpact > 1 ? 'bg-yellow-50 border-yellow-100 text-yellow-700' :
                  'bg-green-50 border-green-100 text-green-700'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Price Impact</span>
                    <span className="font-bold">{priceImpact.toFixed(2)}%</span>
                  </div>
                </div>
              )}

              {/* Multiple Routes Selection */}
              {quote && quote.source === 'aggregator' && quote.routes && quote.routes.length > 1 && (
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                  <div className="text-sm font-semibold text-gray-800 mb-2">
                    Available Routes ({quote.routes.length})
                  </div>
                  <div className="space-y-2">
                    {quote.routes.map((route: any) => (
                      <button
                        key={route.id}
                        onClick={() => setSelectedRouteId(route.id)}
                        className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                          selectedRouteId === route.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-indigo-200 bg-white hover:border-blue-300'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-600">
                              {route.hopCount} hop{route.hopCount > 1 ? 's' : ''}
                            </span>
                            <span className="text-xs text-gray-500">
                              {route.pathSteps.map((s: any) => s.provider).join(' → ')}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-gray-800">
                            {(Number(route.amountOut) / Math.pow(10, toToken.decimals)).toFixed(6)} {toToken.symbol}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          {currentAddress ? (
             <button
                onClick={handleSwap}
                disabled={!quote || loading || swapStatus === 'swapping' || swapStatus === 'confirming' || isHighPriceImpact}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all
                  ${!quote || loading || swapStatus === 'swapping' || swapStatus === 'confirming' || isHighPriceImpact ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30'}
                `}
                title={isHighPriceImpact ? `Price impact too high (${priceImpact?.toFixed(2)}% > ${PRICE_IMPACT_THRESHOLD}%)` : ''}
             >
                {swapStatus === 'swapping' ? '⏳ Swapping...' : swapStatus === 'confirming' ? '⏳ Confirming...' : 'Swap Now'}
             </button>
          ) : (
             <div className="space-y-3">
               <p className="text-center text-sm text-gray-600 font-medium">Choose your login method:</p>
               <div className="w-full flex gap-3 login-button-container">
                 <button
                   onClick={handleGoogleLogin}
                   className="flex-1 h-20"
                 >
                    <Image src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="G" width={24} height={24} />
                    <span>Google Login</span>
                    <span className="text-xs text-gray-500 font-normal">Existing users</span>
                 </button>
                 <div className="flex-1 h-20">
                    <ConnectButton />
                 </div>
               </div>
             </div>
          )}
          
          {/* Status Messages */}
          {txWaitMessage && (
              <div className="p-3 bg-blue-100 text-blue-700 rounded-lg text-center text-sm flex items-center gap-2 justify-center animate-pulse">
                  <div className="w-2 h-2 bg-blue-700 rounded-full animate-bounce"></div>
                  <span>{txWaitMessage}</span>
              </div>
          )}

          {swapStatus === 'error' && (
              <div className="p-3 bg-red-100 text-red-700 rounded-lg text-center text-sm break-all flex items-center gap-2 justify-center">
                  <XCircle size={18} />
                  <span>{errorMessage}</span>
              </div>
          )}

        </div>
      </div>
      </div>

      {/* Swap History Sidebar */}
      {currentAddress && (
        <SwapHistory
          userAddress={currentAddress}
          suiClient={suiClient}
          refreshTrigger={historyRefreshTrigger}
        />
      )}

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
               <a
                 href={`${SUI_NETWORK === 'mainnet' ? 'https://suiscan.xyz/mainnet' : 'https://suiscan.xyz/testnet'}/tx/${lastTxDigest}`}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="block bg-gray-50 hover:bg-blue-50 rounded-lg p-3 mb-6 text-xs text-blue-600 hover:text-blue-700 break-all font-mono transition-colors cursor-pointer"
               >
                 Tx: {lastTxDigest}
               </a>
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

    </div>
  );
}
