'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { isValidSuiAddress } from '@mysten/sui/utils';
import { SUI_COIN_TYPE, USDC_COIN_TYPE, CETUS_COIN_TYPE, WUSDC_COIN_TYPE, getSwapQuote, buildSimpleSwapTx, SUI_NETWORK, buildTransferTx, selectAndPrepareCoins } from '@/utils/cetus';
import { executeWithRetry } from '@/utils/retry';
import { getFriendlyErrorMessage } from '@/utils/errors';
import TransactionStepper from '@/components/TransactionStepper';
import Image from 'next/image';
import { RefreshCcw, ArrowDownUp, Wallet, LogOut, Copy, CheckCircle2, XCircle, Settings } from 'lucide-react';
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

import { secureStorage } from '@/utils/storage';

// Helper to safely parse decimal string to BigInt
const parseAmount = (amount: string, decimals: number): bigint => {
  if (!amount) return BigInt(0);
  // Remove any commas if present
  const cleanAmount = amount.replace(/,/g, '');
  const [integer, fraction = ''] = cleanAmount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(integer + paddedFraction);
};

export default function SwapPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // zkLogin State
  const [zkLoginAddress, setZkLoginAddress] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<'wallet' | 'zklogin' | null>(null);

  useEffect(() => {
    // 🔍 Debug Info on Init
    // console.log(`🚀 App Initialized on ${SUI_NETWORK.toUpperCase()}`);
    // console.log(`📦 Cetus Swap Package ID: ${process.env.NEXT_PUBLIC_CETUS_SWAP_PACKAGE_ID}`);

    // Check for zkLogin session
    const addr = secureStorage.getItem<string>('zklogin_address');
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

  // 🛡️ Network Safety Check
  const isWrongNetwork = 
    account?.chains && 
    ((SUI_NETWORK === 'mainnet' && !account.chains.includes('sui:mainnet')) ||
     (SUI_NETWORK === 'testnet' && !account.chains.includes('sui:testnet')));
  const [mode, setMode] = useState<'swap' | 'transfer'>('swap');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [memo, setMemo] = useState('');
  const [gasEstimate, setGasEstimate] = useState<string>('---');

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
  const [slippage, setSlippage] = useState(0.5); // Default 0.5%
  const [showSettings, setShowSettings] = useState(false);
  const [successModalConfig, setSuccessModalConfig] = useState({ 
      title: 'Swap Successful!', 
      desc: 'Your transaction has been processed successfully on the Sui Network.',
      btnText: 'Close'
  });
  
  // 🛡️ Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'swap' | 'transfer' | null>(null);

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

  const handleMax = () => {
    if (!balanceData || !balanceData.totalBalance) return;
    
    const decimals = fromToken.decimals;
    const rawBalance = BigInt(balanceData.totalBalance);
    let maxAmountRaw = rawBalance;

    // If swapping SUI, reserve some for gas (0.05 SUI)
    // 0.05 * 10^9 = 50,000,000
    if (fromToken.symbol === 'SUI') {
        const gasReserve = BigInt(50_000_000); 
        if (maxAmountRaw > gasReserve) {
            maxAmountRaw -= gasReserve;
        } else {
            maxAmountRaw = BigInt(0);
        }
    }

    // Convert to string with decimal point manually to avoid float precision issues
    const divisor = BigInt(10) ** BigInt(decimals);
    const integerPart = maxAmountRaw / divisor;
    const remainder = maxAmountRaw % divisor;
    
    let amountStr = integerPart.toString();
    
    if (remainder > 0) {
        // Pad start with zeros to match decimal places
        const remainderStr = remainder.toString().padStart(decimals, '0');
        // Trim trailing zeros
        const trimmedRemainder = remainderStr.replace(/0+$/, '');
        amountStr += `.${trimmedRemainder}`;
    }

    setAmountIn(amountStr);
  };

  // Debounce Quote Fetching
  useEffect(() => {
    const fetchQuote = async () => {
      // 🛑 Pre-check: Don't fetch if tokens are the same
      if (fromToken.symbol === toToken.symbol) {
          setQuote(null);
          setErrorMessage('');
          setGasEstimate('---');
          return;
      }

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
        // console.log("Fetching quote for:", amountIn, fromToken.symbol, "->", toToken.symbol);
        const rawAmount = parseAmount(amountIn, fromToken.decimals).toString();
        const routes = await getSwapQuote(fromToken.type, toToken.type, rawAmount, currentAddress);
        // console.log("Quote received:", routes);

        // Check if the response is an error
        if (routes && 'error' in routes && routes.error) {
          setQuote(null);
          setErrorMessage('errorMessage' in routes ? String(routes.errorMessage) : 'Unknown error');
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
  }, [amountIn, fromToken, toToken, currentAddress]);

  // 🏗️ Build Swap Transaction Helper
  const buildSwapTransaction = useCallback(async () => {
      if (!currentAddress || !quote) throw new Error("Missing params");

      let inputCoin;
      let tx: Transaction | null = null;
      const amountInRaw = parseAmount(amountIn, fromToken.decimals);

      // ⚠️ CLMM SDK (Fallback) builds its own transaction with its own coin selection logic.
      // We only need to manually split coins if we are using the Aggregator (which appends to our tx).
      // However, if we are in ZAP mode, we might need to manually construct the CLMM transaction 
      // (as fallback manual router construction), so we should initialize tx anyway if isZap is true.
      
      const isZap = mode === 'transfer' && fromToken.symbol !== toToken.symbol;
      const recipient = mode === 'transfer' ? recipientAddress : '';

      if (quote.source !== 'clmm' || isZap) {
          tx = new Transaction();
          // Use extracted coin selection logic
          inputCoin = await selectAndPrepareCoins(
            suiClient, 
            currentAddress, 
            fromToken.type, 
            amountInRaw, 
            tx
          );
      }

      // Use slippage state (convert % to decimal, e.g. 0.5 -> 0.005)
      const finalTx = await buildSimpleSwapTx(
          tx, 
          quote, 
          inputCoin, 
          currentAddress, 
          fromToken.type, 
          toToken.type, 
          slippage / 100,
          isZap,
          recipient
      );

      if (fromToken.symbol === 'SUI') {
          finalTx.setGasBudget(100000000);
      }
      
      return finalTx;
  }, [currentAddress, quote, amountIn, fromToken, mode, recipientAddress, suiClient, slippage, toToken.type, toToken.symbol]);

  // ⛽ Gas Estimation Hook
  useEffect(() => {
    const estimateGas = async () => {
      if (!currentAddress || !amountIn) {
        setGasEstimate('---');
        return;
      }

      try {
        let tx: Transaction | null = null;

        if (mode === 'transfer') {
             // ⚡ Zap Mode Check: If tokens are different, we estimate gas for the SWAP
             if (fromToken.symbol !== toToken.symbol) {
                 if (!quote) {
                     setGasEstimate('---');
                     return;
                 }
                 tx = await buildSwapTransaction();
             } 
             // 💸 Standard Transfer Check
             else {
                 if (!isValidSuiAddress(recipientAddress)) {
                    setGasEstimate('---');
                    return;
                 }
                 tx = new Transaction();
                 const amountRaw = parseAmount(amountIn, fromToken.decimals);
                 tx.setSender(currentAddress);
                 
                 if (fromToken.symbol === 'SUI') {
                      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountRaw)]);
                      tx.transferObjects([coin], tx.pure.address(recipientAddress));
                 } else {
                      // For non-SUI transfer estimation, we skip complex logic for now
                      setGasEstimate('~0.005'); 
                      return;
                 }
             }
        } else {
             // Swap Mode
             if (!quote) {
                 setGasEstimate('---');
                 return;
             }
             tx = await buildSwapTransaction();
        }

        if (tx) {
            const dryRunRes = await suiClient.dryRunTransactionBlock({
                transactionBlock: await tx.build({ client: suiClient })
            });

            if (dryRunRes.effects.status.status === 'success') {
                const gasUsed = dryRunRes.effects.gasUsed;
                const totalGas = BigInt(gasUsed.computationCost) + BigInt(gasUsed.storageCost) - BigInt(gasUsed.storageRebate);
                setGasEstimate((Number(totalGas) / 1e9).toFixed(4));
            } else {
                const errorMsg = dryRunRes.effects.status.error || '';
                if (errorMsg.includes("InsufficientCoinBalance") || errorMsg.includes("Balance")) {
                   setGasEstimate("Low Bal.");
                } else {
                   console.error("❌ Gas Estimate DryRun Failed:", dryRunRes.effects.status);
                   setGasEstimate('Error');
                }
            }
        }
      } catch (e) {
        // console.error("❌ Gas Estimate Exception:", e);
        if (String(e).includes("InsufficientCoinBalance") || String(e).includes("Balance")) {
           setGasEstimate("Low Bal.");
        } else {
           setGasEstimate('---');
        }
      }
    };

    const timer = setTimeout(estimateGas, 800);
    return () => clearTimeout(timer);
  }, [mode, amountIn, recipientAddress, currentAddress, fromToken, suiClient, memo, quote, slippage, buildSwapTransaction, toToken.type, toToken.symbol]);

  const handleTransfer = async () => {
      if (!currentAddress) return;
      setSwapStatus('swapping'); 
      setErrorMessage('');
      
      // Check if it's a Zap Transfer (Swap + Send)
      if (fromToken.symbol !== toToken.symbol) {
          if (!quote) {
             setErrorMessage("Fetching quote...");
             setSwapStatus('error');
             return;
          }
          
          setTxWaitMessage('Zap Mode: Swapping and Sending atomically...');
          
          // Execute Atomic Zap Logic (via handleSwap which now supports Zap)
          await handleSwap();
          return;
      }

      try {
        const tx = new Transaction();
        const amountRaw = parseAmount(amountIn, fromToken.decimals);
        
        // Use extracted coin selection
        const inputCoin = await selectAndPrepareCoins(
             suiClient,
             currentAddress,
             fromToken.type,
             amountRaw,
             tx
        );

        // Transfer Logic
        // tx.transferObjects([inputCoin], tx.pure.address(recipientAddress));
        // Use buildTransferTx to ensure TransferEvent is emitted for history tracking
        await buildTransferTx(tx, inputCoin, recipientAddress, fromToken.type, memo);

        // Execute
        if (loginMethod === 'zklogin') {
             await executeWithRetry(async () => {
                // ... zkLogin logic ...
                setTxWaitMessage('Generating ZK proof...');
                const jwt = secureStorage.getItem<string>('zklogin_jwt');
                if (!jwt) throw new Error('JWT not found');
                
                const { transactionBlockSerialized, signature } = await signTransactionWithZkLogin(tx, jwt);
                const res = await suiClient.executeTransactionBlock({
                    transactionBlock: transactionBlockSerialized,
                    signature: signature,
                    options: { showEffects: true, showEvents: true }
                });
                
                if (res.effects?.status.status === 'success') {
                    setLastTxDigest(res.digest);
                    setSwapStatus('success');
                    setSuccessModalConfig({
                        title: 'Transfer Successful!',
                        desc: `Successfully sent ${fromToken.symbol} to recipient.`,
                        btnText: 'Close'
                    });
                    setShowSuccessModal(true);
                    triggerConfetti();
                    refetchBalance();
                    setHistoryRefreshTrigger(prev => prev + 1);
                } else {
                    throw new Error("Transfer Failed");
                }
             });
        } else {
            // Wallet Adapter
            await executeWithRetry(async () => {
                const result = await signAndExecuteTransaction({ transaction: tx });
                setLastTxDigest(result.digest);
                setSwapStatus('success');
                setSuccessModalConfig({
                    title: 'Transfer Successful!',
                    desc: `Successfully sent ${fromToken.symbol} to recipient.`,
                    btnText: 'Close'
                });
                setShowSuccessModal(true);
                triggerConfetti();
                refetchBalance();
                setHistoryRefreshTrigger(prev => prev + 1);
            });
        }

      } catch (err) {
          console.error("Transfer Error:", err);
          const msg = err instanceof Error ? err.message : "Transfer Failed";
          setErrorMessage(getFriendlyErrorMessage(msg));
          setSwapStatus('error');
      }
  };

  // 🛑 Intercept Actions with Review Modal
  const initiateAction = (action: 'swap' | 'transfer') => {
    if (!currentAddress || !amountIn) return;
    if (action === 'transfer' && !recipientAddress) return;
    
    setPendingAction(action);
    setShowReviewModal(true);
  };

  const handleConfirmAction = async () => {
    setShowReviewModal(false);
    if (pendingAction === 'swap') {
        await handleSwap();
    } else if (pendingAction === 'transfer') {
        await handleTransfer();
    }
  };

  const handleSwap = async () => {
    if (!currentAddress || !quote) return;

    setSwapStatus('swapping');
    setErrorMessage('');

    try {
      const finalTx = await buildSwapTransaction();

      if (account) {
          // 🟢 Wallet Adapter Mode
          setTxWaitMessage('Waiting for wallet confirmation...');
          
          await executeWithRetry(async () => {
              const result = await signAndExecuteTransaction({ transaction: finalTx });
              
              console.log('Swap Success:', result);
              setTxWaitMessage('Confirming transaction on blockchain...');
              setSwapStatus('confirming');
              setLastTxDigest(result.digest);

              // Wait for transaction confirmation
              setTimeout(() => {
                  setSwapStatus('success');
                  
                  // Check for Zap Mode Success
                  if (mode === 'transfer' && fromToken.symbol !== toToken.symbol) {
                      setAmountIn('');
                      setQuote(null);
                      
                      setSuccessModalConfig({
                          title: 'Zap Transfer Successful!',
                          desc: `Successfully swapped ${fromToken.symbol} and sent ${toToken.symbol} to recipient.`,
                          btnText: 'Close'
                      });
                  } else {
                      setAmountIn('');
                      setQuote(null);
                      setSuccessModalConfig({
                          title: 'Swap Successful!',
                          desc: 'Your transaction has been processed successfully.',
                          btnText: 'Close'
                      });
                  }

                  setTxWaitMessage('');
                  refetchBalance(); // Refresh balance after swap
                  setHistoryRefreshTrigger(prev => prev + 1); // Trigger history refresh
                  setShowSuccessModal(true);

                  // 🎉 Confetti Effect
                  triggerConfetti();
              }, 2000);
          });

      } else if (zkLoginAddress) {
          // 🔵 zkLogin Mode - Sign with Proving Service
          await executeWithRetry(async () => {
            setTxWaitMessage('Generating ZK proof from Proving Service...');

            const jwt = secureStorage.getItem<string>('zklogin_jwt');
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
            setTimeout(async () => {
              
              // Check for CLMM Zap Mode (2-Step Process)
              if (mode === 'transfer' && fromToken.symbol !== toToken.symbol && quote.source === 'clmm') {
                  console.log("⚡ CLMM Zap: Initiating Step 2 (Transfer)...");
                  setTxWaitMessage('Step 1 (Swap) Complete. Please sign Step 2 (Transfer)...');
                  
                  try {
                      // Build Transfer Transaction
                      const tx2 = new Transaction();
                      const safeAmount = BigInt(quote.amountOut) * BigInt(990) / BigInt(1000); 
                      
                      const inputCoin2 = await selectAndPrepareCoins(
                           suiClient,
                           zkLoginAddress,
                           toToken.type,
                           safeAmount,
                           tx2
                      );
                      
                      await buildTransferTx(tx2, inputCoin2, recipientAddress, toToken.type, memo);
                      
                      // Execute Step 2
                      const jwt = secureStorage.getItem<string>('zklogin_jwt');
                      if (!jwt) throw new Error('JWT missing for step 2');
                      
                      const { transactionBlockSerialized, signature } = await signTransactionWithZkLogin(tx2, jwt);
                      const res2 = await suiClient.executeTransactionBlock({
                        transactionBlock: transactionBlockSerialized,
                        signature: signature,
                        options: { showEffects: true }
                      });
                      
                      setLastTxDigest(res2.digest);
                      console.log("⚡ CLMM Zap Step 2 Success:", res2.digest);
                      
                      // Final Success Handling
                      setSwapStatus('success');
                      setAmountIn('');
                      setQuote(null);
                      setSuccessModalConfig({
                          title: 'Zap Transfer Successful!',
                          desc: `Successfully swapped ${fromToken.symbol} and sent ${toToken.symbol} to recipient (2 Steps).`,
                          btnText: 'Close'
                      });
                      setTxWaitMessage('');
                      refetchBalance();
                      setHistoryRefreshTrigger(prev => prev + 1);
                      setShowSuccessModal(true);
                      triggerConfetti();
                      return;

                  } catch (err) {
                      console.error("CLMM Zap Step 2 Failed:", err);
                      setErrorMessage("Swap succeeded, but Transfer failed. Please transfer manually.");
                      setSwapStatus('error');
                      return;
                  }
              }

              setSwapStatus('success');
              
              if (mode === 'transfer' && fromToken.symbol !== toToken.symbol) {
                  setAmountIn('');
                  setQuote(null);
                  
                  setSuccessModalConfig({
                      title: 'Zap Transfer Successful!',
                      desc: `Successfully swapped ${fromToken.symbol} and sent ${toToken.symbol} to recipient.`,
                      btnText: 'Close'
                  });
              } else {
                  setAmountIn('');
                  setQuote(null);
                  setSuccessModalConfig({
                      title: 'Swap Successful!',
                      desc: 'Your transaction has been processed successfully.',
                      btnText: 'Close'
                  });
              }

              setTxWaitMessage('');
              refetchBalance();
              setHistoryRefreshTrigger(prev => prev + 1); // Trigger history refresh
              setShowSuccessModal(true);

              // Confetti Effect
              triggerConfetti();
            }, 2000);
          });
      }

    } catch (e: unknown) {
      console.error(e);
      setSwapStatus('error');
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMessage(getFriendlyErrorMessage(msg));
    }
  };
  
  const triggerConfetti = () => {
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
  };

  // Calculate price impact
  const calculatePriceImpact = () => {
    if (!quote || !amountIn || parseFloat(amountIn) <= 0) return null;

    // Price Impact Calculation
    // Compares the theoretical output (based on spot price) vs actual output (based on pool depth)
    const inputAmount = parseFloat(amountIn);
    const outputAmount = Number(quote.amountOut) / Math.pow(10, toToken.decimals);

    // Baseline: Assume 0.3% LP fee is standard for V3 pools
    const estimatedFairOutput = inputAmount * 0.997; 
    const impact = ((estimatedFairOutput - outputAmount) / estimatedFairOutput) * 100;

    return Math.max(0, impact); 
  };

  const priceImpact = calculatePriceImpact();
  const PRICE_IMPACT_THRESHOLD = 5; // Disable swap if price impact > 5%
  const isHighPriceImpact = priceImpact !== null && priceImpact > PRICE_IMPACT_THRESHOLD;

  // Generate popular pairs based on selected fromToken
  const getPopularPairs = () => {
    const pairs: Array<{ from: string; to: string }> = [];
    const availableTokens = TOKENS_LIST.filter(t => t.symbol !== fromToken.symbol);

    availableTokens.forEach(token => {
      // 🛡️ Filter pairs based on available pools
      // On Testnet, mostly SUI pairs exist. 
      // Mainnet has more pairs (SUI-USDC, SUI-CETUS, USDC-CETUS).
      
      let isValidPair = false;

      if (SUI_NETWORK === 'mainnet') {
          // Mainnet Rules: 
          // 1. SUI pairs with everything
          // 2. USDC pairs with CETUS
          const isSuiPair = fromToken.symbol === 'SUI' || token.symbol === 'SUI';
          const isUsdcCetus = (fromToken.symbol === 'USDC' && token.symbol === 'CETUS') || (fromToken.symbol === 'CETUS' && token.symbol === 'USDC');
          isValidPair = isSuiPair || isUsdcCetus;
      } else {
          // Testnet Rules:
          // Only SUI pairs are reliably supported via direct pools
          isValidPair = fromToken.symbol === 'SUI' || token.symbol === 'SUI';
      }

      if (isValidPair) {
         pairs.push({ from: fromToken.symbol, to: token.symbol });
      }
    });

    return pairs;
  };

  const outputAmount = quote
    ? (Number(quote.amountOut) / Math.pow(10, toToken.decimals)).toFixed(4)
    : '---';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Main Swap Card */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
        
        {/* Network Badge */}
        <div className="absolute top-4 right-4 z-50">
          <div className={`px-4 py-2 rounded-full font-mono text-sm font-bold shadow-lg backdrop-blur-md border flex items-center gap-2 ${
            SUI_NETWORK === 'mainnet' 
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
              : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
          }`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              SUI_NETWORK === 'mainnet' ? 'bg-blue-400' : 'bg-yellow-400'
            }`} />
            {SUI_NETWORK.toUpperCase()}
          </div>
        </div>

      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex justify-between items-center relative rounded-t-2xl">
          {/* Tabs */}
          <div className="absolute top-0 left-0 w-full h-10 flex bg-black/10 backdrop-blur-sm rounded-t-2xl">
            <button
              onClick={() => setMode('swap')}
              className={`flex-1 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                mode === 'swap' ? 'bg-white/20 text-white shadow-inner' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              Swap
            </button>
            <button
              onClick={() => setMode('transfer')}
              className={`flex-1 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                mode === 'transfer' ? 'bg-white/20 text-white shadow-inner' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              Transfer
            </button>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2">
              {mode === 'swap' ? <RefreshCcw className="h-6 w-6 animate-spin-slow" /> : <div className="h-6 w-6"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></div>}
              <h1 className="text-2xl font-bold">{mode === 'swap' ? 'Cetus Swap' : 'Transfer'}</h1>
            </div>
            <p className="text-sm opacity-80 mt-1">{mode === 'swap' ? 'Best Price Aggregator' : 'Send tokens with memo'}</p>
          </div>
          
          {/* Wallet / zkLogin */}
          <div className="flex gap-2 mt-6 items-center">
            {/* Settings Button */}
            <div className="relative z-50">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors border border-white/10"
                  title="Slippage Settings"
                >
                   <Settings className="w-4 h-4 text-white" />
                   <span className="text-xs font-bold text-white/90">{slippage}%</span>
                </button>
                
                {showSettings && (
                   <div className="absolute left-0 top-12 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 w-64 text-gray-800 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex justify-between items-center mb-3">
                         <span className="font-bold text-sm">Slippage Tolerance</span>
                         <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                           <XCircle size={16} />
                         </button>
                      </div>
                      <div className="flex gap-2 mb-3">
                         {[0.1, 0.5, 1.0].map((val) => (
                            <button
                               key={val}
                               onClick={() => setSlippage(val)}
                               className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                  slippage === val 
                                  ? 'bg-blue-600 text-white border-blue-600' 
                                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'
                               }`}
                            >
                               {val}%
                            </button>
                         ))}
                      </div>
                      <div className="relative">
                         <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-100">
                            <input
                              type="number"
                              value={slippage}
                              onChange={(e) => setSlippage(parseFloat(e.target.value))}
                              className="w-full px-3 py-1.5 text-sm font-medium outline-none"
                              placeholder="Custom"
                              step="0.1"
                              min="0.1"
                              max="50"
                            />
                            <span className="pr-3 text-gray-400 text-xs">%</span>
                         </div>
                      </div>
                   </div>
                )}
             </div>

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
                     onClick={handleMax}
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

          {/* To Token (Swap Mode) or Recipient (Transfer Mode) */}
          {mode === 'swap' ? (
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
          ) : (
            <div className="space-y-4">
              {/* Recipient Input */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">Send to</span>
                </div>
                <input
                  type="text"
                  placeholder="Enter Recipient Address (0x...)"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className="bg-transparent w-full text-lg font-mono text-gray-800 placeholder-gray-400 focus:outline-none break-all"
                />
              </div>

              {/* Recipient Gets (Cross-Chain Mode) */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 transition-all">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">Recipient Receives</span>
                  {fromToken.symbol !== toToken.symbol && (
                     <span className="text-xs text-purple-600 font-bold bg-purple-100 px-2 py-0.5 rounded animate-pulse">
                        Zap Mode (Swap + Send)
                     </span>
                  )}
                </div>
                <div className="flex gap-3 items-center">
                   {/* If Zap Mode, show estimated amount */}
                   {fromToken.symbol !== toToken.symbol ? (
                       <div className={`text-xl font-bold w-full ${loading ? 'text-gray-300' : 'text-gray-800'}`}>
                         {loading ? 'Estimating...' : `≈ ${outputAmount}`}
                       </div>
                   ) : (
                       <div className="text-xl font-bold w-full text-gray-400">
                          Same as sent
                       </div>
                   )}
                   
                   <div className="relative">
                    <select 
                      value={toToken.symbol}
                      onChange={(e) => setToToken(TOKENS_LIST.find(t => t.symbol === e.target.value) || TOKENS_LIST[1])}
                      className={`appearance-none bg-white pl-3 pr-8 py-2 rounded-xl font-bold shadow-sm border cursor-pointer transition-colors focus:outline-none focus:border-blue-500 ${
                        fromToken.symbol !== toToken.symbol ? 'border-purple-300 text-purple-700' : 'border-gray-200'
                      }`}
                    >
                      {TOKENS_LIST.map(t => <option key={t.symbol} value={t.symbol}>{t.icon} {t.symbol}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Memo Input */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">Memo (Optional)</span>
                </div>
                <input
                  type="text"
                  placeholder="Add a note..."
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="bg-transparent w-full text-lg font-mono text-gray-800 placeholder-gray-400 focus:outline-none"
                />
              </div>
            </div>
          )}

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
                        {quote.paths.map((path: { label?: string }, idx: number) => (
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

              {/* Price Impact & Slippage Info */}
              <div className="flex gap-2 text-xs">
                 {/* Price Impact */}
                 {priceImpact !== null && (
                    <div className={`flex-1 p-2 rounded-lg border flex justify-between items-center ${
                      priceImpact > 5 ? 'bg-red-50 border-red-100 text-red-700' :
                      priceImpact > 1 ? 'bg-yellow-50 border-yellow-100 text-yellow-700' :
                      'bg-green-50 border-green-100 text-green-700'
                    }`}>
                      <span className="font-medium">Price Impact</span>
                      <span className="font-bold">{priceImpact < 0.01 ? '<0.01' : priceImpact.toFixed(2)}%</span>
                    </div>
                  )}
                  
                  {/* Active Slippage Display */}
                  <div className="flex-1 p-2 rounded-lg border bg-gray-50 border-gray-100 text-gray-600 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
                       onClick={() => setShowSettings(true)}
                       title="Click to adjust"
                  >
                      <span className="font-medium">Max Slippage</span>
                      <span className="font-bold text-gray-800">{slippage}%</span>
                  </div>
              </div>

              {/* Multiple Routes Selection */}
              {quote && quote.source === 'aggregator' && quote.routes && quote.routes.length > 1 && (
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                  <div className="text-sm font-semibold text-gray-800 mb-2">
                    Available Routes ({quote.routes.length})
                  </div>
                  <div className="space-y-2">
                    {quote.routes.map((route: { id: number; amountOut: { toString: () => string }; hopCount: number; pathSteps: Array<{ provider: string }> }) => (
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
                              {route.pathSteps.map((s: { provider: string }) => s.provider).join(' → ')}
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

          {/* Network Cost Display */}
          <div className="flex justify-between items-center px-1 text-xs text-gray-500 mt-2">
              <span className="flex items-center gap-1">Network Cost (Gas)</span>
              <span className="font-mono font-medium">
                  {gasEstimate === '---' || gasEstimate === 'Error' ? gasEstimate : `~${gasEstimate} SUI`}
              </span>
          </div>

          {/* Action Button */}
          {!currentAddress ? (
             <div className="space-y-3 mt-6">
               <p className="text-center text-sm text-gray-600 font-medium">Choose your login method:</p>
               <div className="w-full flex gap-3 login-button-container">
                 <button
                   onClick={handleGoogleLogin}
                   className="flex-1 h-14 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                 >
                    <Image src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="G" width={24} height={24} />
                    <span className="font-semibold text-gray-700">Google</span>
                 </button>
                 <div className="flex-1 h-14">
                    <ConnectButton className="!w-full !h-full !rounded-xl !bg-blue-600 !text-white !font-semibold" />
                 </div>
               </div>
             </div>
          ) : (
            <button
              onClick={() => initiateAction(mode)}
              disabled={
                  loading || 
                  !amountIn || 
                  swapStatus === 'swapping' || 
                  parseFloat(amountIn) <= 0 || 
                  isHighPriceImpact ||
                  (mode === 'transfer' && !isValidSuiAddress(recipientAddress))
              }
              className={`w-full py-4 mt-4 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg ${
                isHighPriceImpact
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : loading || swapStatus === 'swapping'
                  ? 'bg-gray-100 text-gray-400 cursor-wait'
                  : mode === 'swap' 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-500/30' 
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-purple-500/30'
              }`}
            >
               {loading ? 'Finding Best Route...' : 
                swapStatus === 'swapping' ? 'Processing Transaction...' :
                isHighPriceImpact ? 'Price Impact Too High' :
                mode === 'swap' ? 'Review Swap' : 'Review Transfer'}
            </button>
          )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm m-4 transform transition-all scale-100">
                <h3 className="text-xl font-bold mb-4 text-gray-800">Review Transaction</h3>
                
                <div className="space-y-4">
                    {/* From */}
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-500 text-sm">You Pay</span>
                        <div className="text-right">
                            <div className="font-bold text-lg">{amountIn} {fromToken.symbol}</div>
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
                                {quote ? (Number(quote.amountOut) / Math.pow(10, toToken.decimals)).toFixed(4) : '---'} {toToken.symbol}
                            </div>
                            {mode === 'transfer' && fromToken.symbol !== toToken.symbol && (
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
                            onClick={() => setShowReviewModal(false)}
                            className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleConfirmAction}
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
      )}
          
          {/* Stepper Indicator */}
          {swapStatus !== 'idle' && (
              <div className="px-2">
                 <TransactionStepper steps={[
                    { 
                        label: 'Sign', 
                        status: swapStatus === 'swapping' ? 'current' : (swapStatus === 'confirming' || swapStatus === 'success') ? 'completed' : swapStatus === 'error' ? 'error' : 'pending' 
                    },
                    { 
                        label: 'Network', 
                        status: swapStatus === 'confirming' ? 'current' : swapStatus === 'success' ? 'completed' : 'pending' 
                    },
                    { 
                        label: 'Done', 
                        status: swapStatus === 'success' ? 'completed' : 'pending' 
                    }
                 ]} />
              </div>
          )}

          {/* Status Messages */}
          {isWrongNetwork && (
              <div className="p-3 bg-red-100 text-red-700 rounded-lg text-center text-sm font-bold flex items-center gap-2 justify-center border border-red-200">
                  <XCircle size={18} />
                  <span>Wrong Network! Switch Wallet to {SUI_NETWORK.toUpperCase()}</span>
              </div>
          )}

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
             <h3 className="text-2xl font-bold text-gray-900 mb-2">{successModalConfig.title}</h3>
             <p className="text-gray-500 mb-6">{successModalConfig.desc}</p>
             
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
               onClick={() => {
                   setShowSuccessModal(false);
                   if (successModalConfig.btnText === 'Proceed to Transfer') {
                       // Logic to open Transfer Review Modal immediately?
                       // Or just let user click Transfer button.
                       // Just closing is enough as state is updated.
                   }
               }}
               className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-500/30"
             >
               {successModalConfig.btnText}
             </button>
          </div>
        </div>
      )}

    </div>
  );
}
