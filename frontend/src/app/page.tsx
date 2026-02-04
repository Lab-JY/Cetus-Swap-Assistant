'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { isValidSuiAddress } from '@mysten/sui/utils';
import { buildSimpleSwapTx, SUI_NETWORK, buildTransferTx, selectAndPrepareCoins, applySelectedRoute, ENABLE_RECEIPTS, getCetusPartnerInfo, getPartnerRefFeeAmounts, CETUS_PARTNER_ID, formatCoinAmount, getTokenSymbol } from '@/utils/cetus';
import { getQuoteWithCache } from '@/utils/quoteService';
import { preflightTransaction } from '@/utils/preflight';
import { getDerivedStats, recordTrade } from '@/utils/tradeStats';
import { executeWithRetry } from '@/utils/retry';
import { getFriendlyErrorMessage } from '@/utils/errors';
import TransactionStepper from '@/components/TransactionStepper';
import Image from 'next/image';
import { RefreshCcw, ArrowDownUp, Wallet, LogOut, Copy, XCircle, Settings } from 'lucide-react';
import { getGoogleLoginUrl, clearZkLoginSession, signTransactionWithZkLogin } from '@/utils/zklogin';
import confetti from 'canvas-confetti';
import SwapHistory from '@/components/SwapHistory';
import ReviewModal from '@/components/ReviewModal';
import SuccessModal from '@/components/SuccessModal';
import TokenInput from '@/components/TokenInput';

import { useTokens, TokenInfo } from '@/hooks/useTokens';
import { secureStorage } from '@/utils/storage';

// Removed hardcoded token lists
// const MAINNET_TOKENS = ...
// const TESTNET_TOKENS = ...
// const TOKENS_LIST = ...

type RouteStepDisplay = {
  fromSymbol: string;
  toSymbol: string;
  provider: string;
  from?: string;
  to?: string;
};

type QuoteComparison = {
  better: 'aggregator' | 'clmm' | 'equal';
  savingsAbs?: string;
  savingsPct?: number;
};

type ActiveQuote = {
  source: 'aggregator' | 'clmm';
  comparison?: QuoteComparison;
  routeDetails?: {
    providers?: string[];
    steps?: RouteStepDisplay[];
  };
};

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
    // console.log(`📦 Cetus RoutePay Package ID: ${process.env.NEXT_PUBLIC_CETUS_SWAP_PACKAGE_ID}`);

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

  useEffect(() => {
    setTradeStats(getDerivedStats());
  }, []);

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

  const { tokens: TOKENS_LIST, error: tokenError } = useTokens();

  // Initialize fromToken and toToken when TOKENS_LIST is loaded
  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);

  useEffect(() => {
    if (TOKENS_LIST.length > 0) {
      // Preserve existing selection if still valid, otherwise default
      if (!fromToken) setFromToken(TOKENS_LIST[0]);
      if (!toToken) setToToken(TOKENS_LIST[1] || TOKENS_LIST[0]);
    }
  }, [TOKENS_LIST, fromToken, toToken]);

  // If tokens are loading or failed, show a loader or error state (simplified handling)
  // For now, we rely on default tokens from useTokens hook so TOKENS_LIST is never empty
  const [amountIn, setAmountIn] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quote, setQuote] = useState<any>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [swapStatus, setSwapStatus] = useState<'idle' | 'swapping' | 'confirming' | 'success' | 'error'>('idle');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTxDigest, setLastTxDigest] = useState('');
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState('');
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
  const [tradeStats, setTradeStats] = useState<ReturnType<typeof getDerivedStats> | null>(null);
  const [preflightStatus, setPreflightStatus] = useState<{ ok: boolean; reason?: string; usedUrl?: string; fallback?: boolean } | null>(null);
  const [partnerRebates, setPartnerRebates] = useState<Array<{ coinAddress: string; balance: bigint }>>([]);
  const [partnerRebateLoading, setPartnerRebateLoading] = useState(false);
  const [partnerRebateError, setPartnerRebateError] = useState('');
  
  // 🛡️ Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'swap' | 'transfer' | null>(null);

  // 💰 Fetch Balance
  const { data: balanceData, refetch: refetchBalance } = useSuiClientQuery(
    'getBalance',
    {
      owner: currentAddress || '',
      coinType: fromToken?.type || '',
    },
    {
      enabled: !!currentAddress && !!fromToken,
      refetchInterval: 10000,
    }
  );

  const balance = balanceData && fromToken
    ? (parseInt(balanceData.totalBalance) / Math.pow(10, fromToken.decimals))
    : 0;

  const formattedBalance = balanceData ? balance.toFixed(4) : '---';

  type ReceiptEvent = { type?: string; parsedJson?: Record<string, unknown> };

  const extractReceiptIdFromEvents = useCallback((events?: ReceiptEvent[]) => {
    if (!events) return null;
    for (const evt of events) {
      const type = String(evt?.type || '');
      if (!type.endsWith('::SwapReceiptMinted') && !type.endsWith('::ZapReceiptMinted')) {
        continue;
      }
      const parsed = evt?.parsedJson || {};
      const candidate =
        (parsed as Record<string, unknown>).receipt_id ||
        (parsed as Record<string, unknown>).receiptId ||
        (parsed as Record<string, unknown>).receiptID;
      if (typeof candidate === 'string') return candidate;
      if (candidate && typeof candidate === 'object' && typeof (candidate as { id?: unknown }).id === 'string') {
        return (candidate as { id: string }).id;
      }
    }
    return null;
  }, []);

  const fetchReceiptIdFromDigest = useCallback(async (digest: string) => {
    setReceiptError('');
    try {
      const tx = await suiClient.waitForTransaction({
        digest,
        options: { showEvents: true },
      });
      const receiptId = extractReceiptIdFromEvents(tx.events as ReceiptEvent[] | undefined);
      if (receiptId) {
          setLastReceiptId(receiptId);
      } else {
          setReceiptError('Receipt not found in transaction events.');
      }
    } catch (err) {
      // ignore receipt lookup errors to avoid blocking success flow
      console.warn('Failed to load receipt id', err);
      setReceiptError('Failed to fetch receipt (Timeout or Network Error).');
    }
  }, [suiClient, extractReceiptIdFromEvents]);

  const handleMax = () => {
    if (!balanceData || !balanceData.totalBalance || !fromToken) return;
    
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
      // 🛑 Pre-check: Don't fetch if tokens are the same or null
      if (!fromToken || !toToken || fromToken.symbol === toToken.symbol) {
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
        const routes = await getQuoteWithCache({
          fromCoinType: fromToken.type,
          toCoinType: toToken.type,
          amountIn: rawAmount,
          userAddress: currentAddress,
          byAmountIn: true,
        });
        // console.log("Quote received:", routes);

        // Check if the response is an error
        if (routes && 'error' in routes && routes.error) {
          setQuote(null);
          setErrorMessage('errorMessage' in routes ? String(routes.errorMessage) : 'Unknown error');
        } else {
          setQuote(routes);
          setSelectedRouteId(0);
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

  useEffect(() => {
    if (!CETUS_PARTNER_ID) {
      setPartnerRebates([]);
      setPartnerRebateError('');
      return;
    }

    let active = true;
    const fetchRebates = async () => {
      setPartnerRebateLoading(true);
      setPartnerRebateError('');
      try {
        const res = await getPartnerRefFeeAmounts(CETUS_PARTNER_ID);
        if (!active) return;
        setPartnerRebates(Array.isArray(res) ? res : []);
      } catch (err) {
        if (!active) return;
        setPartnerRebateError(err instanceof Error ? err.message : 'Failed to load rebates');
      } finally {
        if (active) setPartnerRebateLoading(false);
      }
    };

    fetchRebates();
    const interval = setInterval(fetchRebates, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [lastTxDigest]);

  const effectiveQuote = quote ? applySelectedRoute(quote, selectedRouteId) : quote;
  const receiptNote = ENABLE_RECEIPTS ? ' Receipt object minted.' : '';
  const isZapMode = Boolean(mode === 'transfer' && fromToken && toToken && fromToken.symbol !== toToken.symbol);
  const partnerInfo = getCetusPartnerInfo(
    effectiveQuote,
    isZapMode,
    isValidSuiAddress(recipientAddress) ? recipientAddress : ''
  );
  const rebateSummary = partnerRebates
    .filter((asset) => {
      try {
        return BigInt(asset.balance) > BigInt(0);
      } catch {
        return false;
      }
    })
    .map((asset) => `${formatCoinAmount(asset.coinAddress, asset.balance)} ${getTokenSymbol(asset.coinAddress)}`)
    .join(' · ');

  // 🏗️ Build Swap Transaction Helper
  const buildSwapTransaction = useCallback(async () => {
      if (!currentAddress || !effectiveQuote || !fromToken || !toToken) throw new Error("Missing params");

      let inputCoin;
      let tx: Transaction | null = null;
      const amountInRaw = parseAmount(amountIn, fromToken.decimals);

      // ⚠️ CLMM SDK (Fallback) builds its own transaction with its own coin selection logic.
      // We only need to manually split coins if we are using the Aggregator (which appends to our tx).
      // However, if we are in ZAP mode, we might need to manually construct the CLMM transaction 
      // (as fallback manual router construction), so we should initialize tx anyway if isZap is true.
      
      const isZap = mode === 'transfer' && fromToken.symbol !== toToken.symbol;
      const recipient = mode === 'transfer' ? recipientAddress : '';

      if (effectiveQuote.source !== 'clmm' || isZap) {
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
          effectiveQuote, 
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
  }, [currentAddress, effectiveQuote, amountIn, fromToken, mode, recipientAddress, suiClient, slippage, toToken]);

  // ⛽ Gas Estimation Hook
  useEffect(() => {
    const estimateGas = async () => {
      if (!currentAddress || !amountIn || !fromToken || !toToken) {
        setGasEstimate('---');
        return;
      }

      try {
        let tx: Transaction | null = null;

        if (mode === 'transfer') {
             // ⚡ Zap Mode Check: If tokens are different, we estimate gas for the SWAP
             if (fromToken.symbol !== toToken.symbol) {
                 if (!effectiveQuote) {
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
             if (!effectiveQuote) {
                 setGasEstimate('---');
                 return;
             }
             tx = await buildSwapTransaction();
        }

        if (tx) {
            const preflight = await preflightTransaction(tx, suiClient, SUI_NETWORK);
            setPreflightStatus(preflight);

            if (preflight.ok) {
                setGasEstimate(preflight.gasUsed || '---');
            } else {
                const errorMsg = preflight.reason || '';
                if (errorMsg.includes("InsufficientCoinBalance") || errorMsg.includes("Balance")) {
                   setGasEstimate("Low Bal.");
                } else {
                   setGasEstimate('Error');
                }
            }
        } else {
            setPreflightStatus(null);
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
  }, [mode, amountIn, recipientAddress, currentAddress, fromToken, suiClient, memo, effectiveQuote, slippage, buildSwapTransaction, toToken, selectedRouteId]);

  const handleTransfer = async () => {
      if (!currentAddress || !fromToken || !toToken) return;
      setSwapStatus('swapping'); 
      setErrorMessage('');
      setLastReceiptId(null);
      
      // Check if it's a Zap Transfer (Swap + Send)
      if (fromToken.symbol !== toToken.symbol) {
          if (!effectiveQuote) {
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
        if (!fromToken) throw new Error('Source token not selected');

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

        // 🛡️ Preflight & Gas Budget
        const preflight = await preflightTransaction(tx, suiClient, SUI_NETWORK);
        if (!preflight.ok) {
             throw new Error(preflight.reason || "Preflight failed");
        }
        if (preflight.gasEstimate) {
             const budget = preflight.gasEstimate * BigInt(120) / BigInt(100);
             tx.setGasBudget(budget);
        }

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

  const updateTradeStats = (activeQuote: ActiveQuote | null, success: boolean) => {
    if (!activeQuote) return;
    const comparison = activeQuote.comparison;
    const savingsAbs = comparison && comparison.better === 'aggregator' ? comparison.savingsAbs : '0';
    const savingsPct = comparison && comparison.better === 'aggregator' ? comparison.savingsPct : 0;
    const providers = activeQuote.routeDetails?.providers || [];

    recordTrade({
      success,
      source: activeQuote.source === 'aggregator' ? 'aggregator' : 'clmm',
      savingsAbs,
      savingsPct,
      providers,
    });
    setTradeStats(getDerivedStats());
  };

  const handleSwap = async () => {
    if (!currentAddress || !effectiveQuote) return;

    setSwapStatus('swapping');
    setErrorMessage('');
    setLastReceiptId(null);

    try {
      const finalTx = await buildSwapTransaction();
      const preflight = await preflightTransaction(finalTx, suiClient, SUI_NETWORK);
      setPreflightStatus(preflight);
      if (!preflight.ok) {
        const reason = preflight.reason || 'Preflight failed';
        setErrorMessage(getFriendlyErrorMessage(reason));
        setSwapStatus('error');
        return;
      }

      // ⚡ Apply Dynamic Gas Budget (Estimate + 20% Buffer)
      if (preflight.gasEstimate) {
          const budget = preflight.gasEstimate * BigInt(120) / BigInt(100);
          finalTx.setGasBudget(budget);
      }

      if (account) {
          // 🟢 Wallet Adapter Mode
          setTxWaitMessage('Waiting for wallet confirmation...');
          
          await executeWithRetry(async () => {
              const result = await signAndExecuteTransaction({ transaction: finalTx });
              
              console.log('Swap Success:', result);
              setTxWaitMessage('Confirming transaction on blockchain...');
              setSwapStatus('confirming');
              setLastTxDigest(result.digest);
              if (ENABLE_RECEIPTS) {
                fetchReceiptIdFromDigest(result.digest);
              }
              updateTradeStats(effectiveQuote, true);

              // Wait for transaction confirmation
              setTimeout(() => {
                  setSwapStatus('success');
                  
                  // Check for Zap Mode Success
                  if (mode === 'transfer' && fromToken && toToken && fromToken.symbol !== toToken.symbol) {
                      setAmountIn('');
                      setQuote(null);
                      
                      setSuccessModalConfig({
                          title: 'Zap Transfer Successful!',
                          desc: `Successfully swapped ${fromToken.symbol} and sent ${toToken.symbol} to recipient.${receiptNote}`,
                          btnText: 'Close'
                      });
                  } else {
                      setAmountIn('');
                      setQuote(null);
                      setSuccessModalConfig({
                          title: 'Swap Successful!',
                          desc: `Your transaction has been processed successfully.${receiptNote}`,
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
            if (ENABLE_RECEIPTS) {
              fetchReceiptIdFromDigest(response.digest);
            }
            updateTradeStats(effectiveQuote, true);

            // Wait for transaction confirmation
            setTimeout(async () => {
              
              // 🧠 Phase 3: Atomic Zap Enabled - No more Step 2 needed!
              // The transaction is now atomic for both Aggregator and CLMM (via Synthetic Router).
              // We can proceed directly to success handling.

              setSwapStatus('success');
              
              if (mode === 'transfer' && fromToken && toToken && fromToken.symbol !== toToken.symbol) {
                  setAmountIn('');
                  setQuote(null);
                  
                  setSuccessModalConfig({
                      title: 'Zap Transfer Successful!',
                      desc: `Successfully swapped ${fromToken.symbol} and sent ${toToken.symbol} to recipient.${receiptNote}`,
                      btnText: 'Close'
                  });
              } else if (mode === 'transfer') {
                  setAmountIn('');
                  setQuote(null);
                  setSuccessModalConfig({
                      title: 'Transfer Successful!',
                      desc: `Successfully sent ${amountIn} ${fromToken?.symbol} to recipient.${receiptNote}`,
                      btnText: 'Close'
                  });
              } else {
                  setAmountIn('');
                  setQuote(null);
                  setSuccessModalConfig({
                      title: 'Swap Successful!',
                      desc: `Your transaction has been processed successfully.${receiptNote}`,
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
      }

    } catch (e: unknown) {
      console.error(e);
      setSwapStatus('error');
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMessage(getFriendlyErrorMessage(msg));
      updateTradeStats(effectiveQuote, false);
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
    if (!effectiveQuote || !amountIn || parseFloat(amountIn) <= 0 || !toToken) return null;

    // Price Impact Calculation
    // Compares the theoretical output (based on spot price) vs actual output (based on pool depth)
    const inputAmount = parseFloat(amountIn);
    const outputAmount = Number(effectiveQuote.amountOut) / Math.pow(10, toToken.decimals);

    // Baseline: Assume 0.3% LP fee is standard for V3 pools
    const estimatedFairOutput = inputAmount * 0.997; 
    const impact = ((estimatedFairOutput - outputAmount) / estimatedFairOutput) * 100;

    return Math.max(0, impact); 
  };

  const priceImpact = calculatePriceImpact();
  const PRICE_IMPACT_THRESHOLD = 5; // Disable swap if price impact > 5%
  const isHighPriceImpact = priceImpact !== null && priceImpact > PRICE_IMPACT_THRESHOLD;
  const noRoute = Boolean(errorMessage) && !effectiveQuote && !loading;

  // Generate popular pairs based on selected fromToken
  const getPopularPairs = () => {
    // Return empty array if token list is not loaded yet
    if (!TOKENS_LIST.length || !fromToken) return [];

    const pairs: { from: string; to: string }[] = [];
    const targets = ['USDC', 'SUI', 'CETUS'];

    targets.forEach((target) => {
      // Find the target token in the dynamic list
      const token = TOKENS_LIST.find(t => t.symbol === target);
      // Add pair if target exists and is not the same as fromToken
      if (token && token.symbol !== fromToken.symbol) {
         pairs.push({ from: fromToken.symbol, to: token.symbol });
      }
    });

    return pairs;
  };

  const outputAmount = effectiveQuote && toToken
    ? (Number(effectiveQuote.amountOut) / Math.pow(10, toToken.decimals)).toFixed(4)
    : '---';

  const topProvider = tradeStats
    ? Object.entries(tradeStats.routeProviders || {}).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null;
  const successRate = tradeStats && tradeStats.totalTrades > 0
    ? ((tradeStats.successTrades / tradeStats.totalTrades) * 100).toFixed(0)
    : null;
  const aggregatorUsage = tradeStats && tradeStats.totalTrades > 0
    ? ((tradeStats.aggregatorTrades / tradeStats.totalTrades) * 100).toFixed(0)
    : null;

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
              <h1 className="text-2xl font-bold">{mode === 'swap' ? 'Cetus RoutePay' : 'Transfer'}</h1>
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
          {currentAddress && fromToken && (
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
          <TokenInput
            label="You Pay"
            amount={amountIn}
            setAmount={setAmountIn}
            token={fromToken}
            setToken={(t) => setFromToken(t)}
            tokensList={TOKENS_LIST}
            balance={formattedBalance}
            onMax={currentAddress ? handleMax : undefined}
          />

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
            <TokenInput
              label="You Receive"
              amount={outputAmount}
              token={toToken}
              setToken={(t) => setToToken(t)}
              tokensList={TOKENS_LIST}
              readOnly={true}
              loading={loading}
              showBestPriceBadge={!!effectiveQuote}
            />
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
                  {fromToken && toToken && fromToken.symbol !== toToken.symbol && (
                     <span className="text-xs text-purple-600 font-bold bg-purple-100 px-2 py-0.5 rounded animate-pulse">
                        Zap Mode (Swap + Send)
                     </span>
                  )}
                </div>
                <div className="flex gap-3 items-center">
                   {/* If Zap Mode, show estimated amount */}
                   {fromToken && toToken && fromToken.symbol !== toToken.symbol ? (
                       <div className={`text-xl font-bold w-full ${loading ? 'text-gray-300' : 'text-gray-800'}`}>
                         {loading ? 'Estimating...' : `≈ ${outputAmount}`}
                       </div>
                   ) : (
                       <div className="text-xl font-bold w-full text-gray-400">
                          Same as sent
                       </div>
                   )}
                   
                   <div className="relative">
                    {toToken && (
                      <select 
                        value={toToken.symbol}
                        onChange={(e) => setToToken(TOKENS_LIST.find(t => t.symbol === e.target.value) || TOKENS_LIST[1])}
                        className={`appearance-none bg-white pl-3 pr-8 py-2 rounded-xl font-bold shadow-sm border cursor-pointer transition-colors focus:outline-none focus:border-blue-500 ${
                          fromToken && toToken && fromToken.symbol !== toToken.symbol ? 'border-purple-300 text-purple-700' : 'border-gray-200'
                        }`}
                      >
                        {TOKENS_LIST.map(t => <option key={t.symbol} value={t.symbol}>{t.icon} {t.symbol}</option>)}
                      </select>
                    )}
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
          {effectiveQuote && (
            <div className="space-y-2">
              <div className={`p-3 rounded-lg border ${effectiveQuote.source === 'aggregator' ? 'bg-blue-50 border-blue-100' : 'bg-purple-50 border-purple-100'}`}>
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold text-gray-800">Route Details</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${effectiveQuote.source === 'aggregator' ? 'bg-blue-200 text-blue-900' : 'bg-purple-200 text-purple-900'}`}>
                    {effectiveQuote.source === 'aggregator' ? '🔀 Aggregator' : '🎯 Direct Pool'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Route Type */}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium text-gray-800">
                      {effectiveQuote.source === 'aggregator' ? 'Multi-hop via Cetus Aggregator' : `Direct ${fromToken?.symbol}-${toToken?.symbol} Pool`}
                    </span>
                  </div>

                  {/* Output Amount */}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Output:</span>
                    <span className="font-medium text-gray-800">
                      {(Number(effectiveQuote.amountOut) / Math.pow(10, toToken?.decimals || 9)).toFixed(6)} {toToken?.symbol}
                    </span>
                  </div>

                  {/* Fee Information */}
                  {effectiveQuote.estimatedFee !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Est. Fee:</span>
                      <span className="font-medium text-gray-800">
                        {effectiveQuote.estimatedFee > 0 ? `${effectiveQuote.estimatedFee} ${toToken?.symbol}` : 'Included'}
                      </span>
                    </div>
                  )}

                  {/* Path Information */}
                  {effectiveQuote.source === 'aggregator' && effectiveQuote.paths && (
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <div className="text-gray-600 mb-1">Paths ({effectiveQuote.paths.length}):</div>
                      <div className="space-y-1">
                        {effectiveQuote.paths.map((path: { label?: string }, idx: number) => (
                          <div key={idx} className="text-gray-700 ml-2">
                            • {path.label || `Path ${idx + 1}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pool Address for Direct Swaps */}
                  {effectiveQuote.source !== 'aggregator' && effectiveQuote.poolAddress && (
                    <div className="mt-2 pt-2 border-t border-purple-200">
                      <div className="text-gray-600 mb-1">Pool:</div>
                      <div className="text-gray-700 ml-2 font-mono text-[10px] break-all">
                        {effectiveQuote.poolAddress.slice(0, 10)}...{effectiveQuote.poolAddress.slice(-8)}
                      </div>
                    </div>
                  )}

                  {/* Fallback Transparency */}
                  {effectiveQuote.meta?.fallbackReason && (
                    <div className="mt-2 pt-2 border-t border-amber-200">
                      <div className="text-amber-700 font-semibold">Fallback Activated</div>
                      <div className="text-amber-600 text-[11px] mt-1">
                        Aggregator unavailable → Direct Pool used ({effectiveQuote.meta.fallbackReason})
                      </div>
                    </div>
                  )}

                  {/* Route Visualization */}
                  {effectiveQuote.routeDetails?.steps?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-gray-600 mb-1">Route Map:</div>
                      <div className="flex flex-wrap items-center gap-1 text-[11px] text-gray-700">
                        {(effectiveQuote.routeDetails.steps || []).map((step: RouteStepDisplay, idx: number) => (
                          <span key={`${step.from}-${step.to}-${idx}`} className="flex items-center gap-1">
                            <span className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">{step.fromSymbol}</span>
                            <span className="text-gray-400">→</span>
                            <span className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">{step.toSymbol}</span>
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                              {step.provider}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Savings Comparison */}
                  {effectiveQuote.comparison && (
                    <div className={`mt-2 pt-2 border-t ${effectiveQuote.comparison.better === 'aggregator' ? 'border-emerald-200' : 'border-yellow-200'}`}>
                      <div className={`font-semibold ${effectiveQuote.comparison.better === 'aggregator' ? 'text-emerald-700' : 'text-yellow-700'}`}>
                        {effectiveQuote.comparison.better === 'aggregator' ? 'Aggregator Savings' : 'Direct Pool Advantage'}
                      </div>
                      <div className="text-[11px] mt-1">
                        {effectiveQuote.comparison.better === 'aggregator'
                          ? `+${(Number(effectiveQuote.comparison.savingsAbs) / Math.pow(10, toToken?.decimals || 9)).toFixed(6)} ${toToken?.symbol} (~${effectiveQuote.comparison.savingsPct.toFixed(2)}%)`
                          : `-${(Number(effectiveQuote.comparison.savingsAbs) / Math.pow(10, toToken?.decimals || 9)).toFixed(6)} ${toToken?.symbol} (~${effectiveQuote.comparison.savingsPct.toFixed(2)}%)`
                        }
                      </div>
                    </div>
                  )}

                  {/* Service Layer Status */}
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="text-gray-600 mb-1">Service Layer:</div>
                    <div className="space-y-1">
                      {effectiveQuote.meta?.cache && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Quote Cache</span>
                          <span className={`font-semibold ${effectiveQuote.meta.cache.hit ? 'text-green-600' : 'text-gray-600'}`}>
                            {effectiveQuote.meta.cache.hit ? 'HIT' : 'MISS'}
                          </span>
                        </div>
                      )}
                      {typeof effectiveQuote.meta?.aggregatorLatencyMs === 'number' && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Aggregator Latency</span>
                          <span className="font-semibold">{effectiveQuote.meta.aggregatorLatencyMs}ms</span>
                        </div>
                      )}
                      {typeof effectiveQuote.meta?.clmmLatencyMs === 'number' && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">CLMM Latency</span>
                          <span className="font-semibold">{effectiveQuote.meta.clmmLatencyMs}ms</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">Receipt Objects</span>
                        <span className={`font-semibold ${ENABLE_RECEIPTS ? 'text-emerald-700' : 'text-gray-500'}`}>
                          {ENABLE_RECEIPTS ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      {isZapMode && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Cetus Referral (Zap)</span>
                            <span className={`font-semibold ${partnerInfo.enabled ? 'text-emerald-700' : 'text-gray-500'}`}>
                              {partnerInfo.enabled ? 'Enabled' : 'Off'}
                            </span>
                          </div>
                          {!partnerInfo.enabled && partnerInfo.reason && (
                            <div className="text-[11px] text-gray-500">
                              Rebate unavailable: {partnerInfo.reason}
                            </div>
                          )}
                        </>
                      )}
                      {CETUS_PARTNER_ID && (
                        <div className="text-[11px] text-gray-500">
                          {partnerRebateLoading
                            ? 'Loading partner rebate...'
                            : partnerRebateError
                              ? `Rebate check failed`
                              : rebateSummary
                                ? `Claimable rebate: ${rebateSummary}`
                                : 'No rebate yet'}
                        </div>
                      )}
                    </div>
                  </div>
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

              {/* Cetus Impact Snapshot */}
              {tradeStats && (
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-xs">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-emerald-800">Cetus Impact</span>
                    <span className="text-emerald-600">Local Stats</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-emerald-900">
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Success Rate</span>
                      <span className="font-bold">{successRate || '0'}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Aggregator Usage</span>
                      <span className="font-bold">{aggregatorUsage || '0'}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Avg Savings</span>
                      <span className="font-bold">{tradeStats.avgSavingsPct.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Top Provider</span>
                      <span className="font-bold">{topProvider || '—'}</span>
                    </div>
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
                            {(Number(route.amountOut) / Math.pow(10, toToken?.decimals || 9)).toFixed(6)} {toToken?.symbol}
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
          {preflightStatus && (
            <div className="flex justify-between items-center px-1 text-xs text-gray-500 mt-1">
              <span className="flex items-center gap-1">Preflight</span>
              <span className={`font-mono font-medium ${preflightStatus.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                {preflightStatus.ok ? 'OK' : 'Blocked'}
                {preflightStatus.fallback ? ' (RPC fallback)' : ''}
              </span>
            </div>
          )}
          {preflightStatus && !preflightStatus.ok && preflightStatus.reason && (
            <div
              className="px-1 text-[11px] text-red-500 mt-1 truncate"
              title={preflightStatus.reason}
            >
              {preflightStatus.reason}
            </div>
          )}

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
                  (mode === 'swap' && !effectiveQuote) ||
                  (mode === 'transfer' && fromToken && toToken && fromToken.symbol !== toToken.symbol && !effectiveQuote) ||
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
               {noRoute ? 'No Available Route' :
                loading ? 'Finding Best Route...' : 
                swapStatus === 'swapping' ? 'Processing Transaction...' :
                isHighPriceImpact ? 'Price Impact Too High' :
                mode === 'swap' ? 'Review Swap' : 'Review Transfer'}
            </button>
          )}

      {/* Review Modal */}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onConfirm={handleConfirmAction}
        pendingAction={pendingAction}
        amountIn={amountIn}
        fromToken={fromToken}
        toToken={toToken}
        quote={effectiveQuote}
        recipientAddress={recipientAddress}
        gasEstimate={gasEstimate}
        slippage={slippage}
      />
          
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

          {errorMessage && (
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
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successModalConfig.title}
        desc={successModalConfig.desc}
        btnText={successModalConfig.btnText}
        lastTxDigest={lastTxDigest}
        lastReceiptId={lastReceiptId}
        receiptError={receiptError}
      />

    </div>
  );
}
