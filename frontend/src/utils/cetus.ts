/* eslint-disable @typescript-eslint/no-explicit-any */
import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk";
import { initCetusSDK } from "@cetusprotocol/cetus-sui-clmm-sdk";
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { normalizeSuiAddress, isValidSuiAddress } from "@mysten/sui/utils";
import BN from "bn.js";
import { TOKENS, SUI_NETWORK, POOL_IDS, CETUS_SWAP_PACKAGE_ID, CETUS_PARTNER_ID, ENABLE_RECEIPTS } from "./config";

export { SUI_NETWORK, CETUS_PARTNER_ID, ENABLE_RECEIPTS }; // Re-export for frontend use

// 🌟 Initialize Cetus Aggregator SDK
const aggregator = new AggregatorClient({
    endpoint: SUI_NETWORK === 'mainnet' ? 'https://api-sui.cetus.zone/router_v3/find_routes' : undefined,
    env: SUI_NETWORK === 'mainnet' ? Env.Mainnet : Env.Testnet,
    pythUrls: [
        'https://hermes.pyth.network',
        'https://hermes-beta.pyth.network'
    ]
});

// 🌟 Initialize Cetus CLMM SDK (Fallback)
const cetusClmm = initCetusSDK({
    network: SUI_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
});

export const SUI_COIN_TYPE = TOKENS.SUI;
export const CETUS_COIN_TYPE = TOKENS.CETUS; 
export const USDC_COIN_TYPE = TOKENS.USDC; 
export const WUSDC_COIN_TYPE = TOKENS.wUSDC; 

const COIN_DECIMALS: Record<string, number> = {
    [TOKENS.SUI]: 9,
    [TOKENS.USDC]: 6,
    [TOKENS.CETUS]: 9,
    [TOKENS.wUSDC]: 6,
    ...(TOKENS as any).MEME ? { [(TOKENS as any).MEME]: 9 } : {},
    ...(TOKENS as any).IDOL_APPLE ? { [(TOKENS as any).IDOL_APPLE]: 9 } : {},
    ...(TOKENS as any).IDOL_DGRAN ? { [(TOKENS as any).IDOL_DGRAN]: 9 } : {},
};

export const getCoinDecimals = (coinType: string) => {
    if (COIN_DECIMALS[coinType]) return COIN_DECIMALS[coinType];
    if (coinType.includes('::usdc::USDC') || coinType.includes('::coin::COIN')) return 6;
    return 9;
};

export const formatCoinAmount = (coinType: string, amount: bigint | string | number, precision: number = 6) => {
    const decimals = getCoinDecimals(coinType);
    const base = new BN(10).pow(new BN(decimals));
    const bn = new BN(amount.toString());
    const whole = bn.div(base).toString();
    const fracRaw = bn.mod(base).toString().padStart(decimals, '0');
    const frac = fracRaw.slice(0, precision).replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole;
};

type RouteStep = {
    from: string;
    to: string;
    fromSymbol: string;
    toSymbol: string;
    provider: string;
    feeRate?: string | number;
};

type RouteDetails = {
    type: 'aggregator' | 'clmm';
    hops: number;
    providers: string[];
    steps: RouteStep[];
    pathText: string;
};

type QuoteComparison = {
    directOut: string;
    aggregatorOut: string;
    savingsAbs: string;
    savingsPct: number;
    better: 'aggregator' | 'clmm' | 'equal';
};

type QuoteMeta = {
    aggregatorLatencyMs?: number;
    clmmLatencyMs?: number;
    fallbackFrom?: 'aggregator' | 'clmm';
    fallbackReason?: string;
};

export type PartnerInfo = {
    enabled: boolean;
    reason?: string;
    partnerId?: string;
};

const isCetusProvider = (provider: string) => provider.toLowerCase().includes('cetus');

export const getCetusPartnerInfo = (
    quote: any | null,
    isZap: boolean,
    recipient: string
): PartnerInfo => {
    if (!isZap) return { enabled: false, reason: 'Swap mode' };
    if (!recipient || !isValidSuiAddress(recipient)) return { enabled: false, reason: 'Recipient not set' };
    if (!CETUS_PARTNER_ID) return { enabled: false, reason: 'Partner not configured' };
    if (!quote) return { enabled: false, reason: 'No quote' };
    if (quote.source !== 'aggregator') return { enabled: false, reason: 'CLMM fallback' };

    const steps = quote.selectedRoute?.pathSteps || quote.routeDetails?.steps || [];
    if (!steps.length) return { enabled: false, reason: 'Route unavailable' };

    const providers = Array.from(
        new Set(steps.map((s: any) => String(s.provider || '')).filter(Boolean))
    );
    const hasNonCetus = providers.some((p) => !isCetusProvider(p));
    if (hasNonCetus) return { enabled: false, reason: 'External route' };

    return { enabled: true, partnerId: CETUS_PARTNER_ID };
};

export const getPartnerRefFeeAmounts = async (partnerId: string = CETUS_PARTNER_ID) => {
    if (!partnerId) return [];
    return cetusClmm.Pool.getPartnerRefFeeAmount(partnerId, true);
};

const toBn = (value: string | number | BN) => value instanceof BN ? value : new BN(value);

const buildRouteDetails = (source: 'aggregator' | 'clmm', steps: RouteStep[]): RouteDetails => {
    const providers = Array.from(new Set(steps.map((s) => s.provider)));
    const pathText = steps.map((s) => `${s.fromSymbol}→${s.toSymbol}`).join(' | ');
    return {
        type: source,
        hops: steps.length,
        providers,
        steps,
        pathText,
    };
};

const computeComparison = (aggregatorOut?: BN | null, directOut?: BN | null): QuoteComparison | null => {
    if (!aggregatorOut || !directOut) return null;
    if (directOut.isZero()) return null;

    const diff = aggregatorOut.sub(directOut);
    const savingsPct = diff.mul(new BN(10000)).div(directOut).toNumber() / 100;
    let better: QuoteComparison['better'] = 'equal';
    if (diff.gt(new BN(0))) better = 'aggregator';
    if (diff.lt(new BN(0))) better = 'clmm';

    return {
        directOut: directOut.toString(),
        aggregatorOut: aggregatorOut.toString(),
        savingsAbs: diff.abs().toString(),
        savingsPct: Math.abs(savingsPct),
        better,
    };
};

const toAsciiLabel = (value: string) => {
    const replaced = value.replace(/→/g, '->');
    return replaced.replace(/[^\x20-\x7E]/g, '');
};

const getPoolAddressForPair = (fromCoinType: string, toCoinType: string): string => {
    const network = SUI_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
    const pools = POOL_IDS[network] as any;

    const pairKey = `${fromCoinType}-${toCoinType}`;
    const reversePairKey = `${toCoinType}-${fromCoinType}`;

    let POOL_MAP: Record<string, string> = {};

    if (network === 'mainnet') {
        POOL_MAP = {
            [`${TOKENS.SUI}-${TOKENS.USDC}`]: pools.SUI_USDC,
            [`${TOKENS.SUI}-${TOKENS.CETUS}`]: pools.SUI_CETUS,
            [`${TOKENS.USDC}-${TOKENS.CETUS}`]: pools.USDC_CETUS,
        };
    } else {
        POOL_MAP = {
            [`${TOKENS.SUI}-${(TOKENS as any).MEME}`]: pools.SUI_MEME,
            [`${TOKENS.SUI}-${(TOKENS as any).IDOL_APPLE}`]: pools.SUI_IDOL_APPLE,
            [`${TOKENS.SUI}-${(TOKENS as any).IDOL_DGRAN}`]: pools.SUI_IDOL_DGRAN,
        };
    }

    return POOL_MAP[pairKey] || POOL_MAP[reversePairKey] || '';
};

const getDirectPoolQuote = async (
    fromCoinType: string,
    toCoinType: string,
    amount: BN,
    byAmountIn: boolean,
): Promise<{
    amountOut: BN;
    estimatedFee: number;
    poolAddress: string;
    a2b: boolean;
    rawSwapResult: any;
    routeDetails: RouteDetails;
} | null> => {
    const poolAddress = getPoolAddressForPair(fromCoinType, toCoinType);
    if (!poolAddress) return null;

    const pool = await cetusClmm.Pool.getPool(poolAddress);
    const a2b = fromCoinType === pool.coinTypeA;

    const res = await cetusClmm.Swap.preswap({
        pool: pool,
        currentSqrtPrice: pool.current_sqrt_price,
        decimalsA: getCoinDecimals(pool.coinTypeA),
        decimalsB: getCoinDecimals(pool.coinTypeB),
        a2b: a2b,
        byAmountIn: byAmountIn,
        amount: amount.toString(),
        coinTypeA: pool.coinTypeA,
        coinTypeB: pool.coinTypeB
    });

    if (!res) return null;

    const steps: RouteStep[] = [{
        from: fromCoinType,
        to: toCoinType,
        fromSymbol: getTokenSymbol(fromCoinType),
        toSymbol: getTokenSymbol(toCoinType),
        provider: 'Cetus CLMM',
    }];

    return {
        amountOut: new BN(res.estimatedAmountOut),
        estimatedFee: res.estimatedFeeAmount,
        poolAddress,
        a2b,
        rawSwapResult: res,
        routeDetails: buildRouteDetails('clmm', steps),
    };
};

export async function getSwapQuote(
    fromCoinType: string,
    toCoinType: string,
    amountIn: number | string,
    userAddress: string,
    byAmountIn: boolean = true
) {
    const amount = new BN(amountIn);
    const meta: QuoteMeta = {};

    // Set sender address for CLMM SDK
    if (userAddress) {
        cetusClmm.senderAddress = userAddress;
    }

    let aggregatorError: string | undefined;
    let aggregatorQuote: any | null = null;
    let directQuote: Awaited<ReturnType<typeof getDirectPoolQuote>> | null = null;

    const aggStart = Date.now();
    try {
        const routerData = await aggregator.findRouters({
            from: fromCoinType,
            target: toCoinType,
            amount: amount,
            byAmountIn: byAmountIn,
        });
        meta.aggregatorLatencyMs = Date.now() - aggStart;

        const normalizeType = (value: string) => (value || '').toLowerCase();
        const validPaths = routerData?.paths?.filter((path: any) => {
            return normalizeType(path.from) === normalizeType(fromCoinType)
                && normalizeType(path.target) === normalizeType(toCoinType);
        }) || [];

        if (routerData && validPaths.length > 0) {
            const sortedPaths = validPaths.sort((a: any, b: any) => toBn(b.amountOut).cmp(toBn(a.amountOut)));
            const routes = sortedPaths.map((path: any, idx: number) => {
                const pathSteps = [{
                    from: path.from,
                    to: path.target,
                    provider: path.provider,
                    feeRate: path.feeRate,
                    amountIn: path.amountIn,
                    amountOut: path.amountOut
                }];

                return {
                    id: idx,
                    amountOut: new BN(path.amountOut),
                    estimatedFee: 0,
                    router: { path: [path] },
                    source: 'aggregator',
                    pathSteps,
                    hopCount: pathSteps.length,
                    rawSwapResult: { path: [path] }
                };
            });

            const bestPath = sortedPaths[0];
            const routeSteps: RouteStep[] = [{
                from: bestPath.from,
                to: bestPath.target,
                fromSymbol: getTokenSymbol(bestPath.from),
                toSymbol: getTokenSymbol(bestPath.target),
                provider: bestPath.provider || 'Cetus Aggregator',
                feeRate: bestPath.feeRate,
            }];

            const paths = sortedPaths.map((path: any, idx: number) => ({
                label: `${getTokenSymbol(path.from)}→${getTokenSymbol(path.target)} (${path.provider || 'Cetus'})`,
                steps: [path],
                id: idx,
            }));

            const normalizedAmountOut = typeof bestPath.amountOut?.toString === 'function'
                ? bestPath.amountOut.toString()
                : bestPath.amountOut;

            aggregatorQuote = {
                amountOut: normalizedAmountOut,
                estimatedFee: 0,
                router: { ...routerData, paths: sortedPaths },
                source: 'aggregator',
                routes: routes,
                paths,
                selectedRouteId: 0, // Best route is first after sorting
                rawSwapResult: { ...routerData, paths: sortedPaths },
                fullRouterData: routerData,
                routeDetails: buildRouteDetails('aggregator', routeSteps),
            };
        } else {
            aggregatorError = 'No valid routes for requested target';
        }
    } catch (error) {
        meta.aggregatorLatencyMs = Date.now() - aggStart;
        aggregatorError = error instanceof Error ? error.message : String(error);
        console.warn("⚠️ Aggregator failed, trying direct pool fallback...", error);
    }

    const clmmStart = Date.now();
    try {
        directQuote = await getDirectPoolQuote(fromCoinType, toCoinType, amount, byAmountIn);
        meta.clmmLatencyMs = Date.now() - clmmStart;
    } catch (error) {
        meta.clmmLatencyMs = Date.now() - clmmStart;
        console.warn("⚠️ Direct pool quote failed...", error);
    }

    if (aggregatorQuote) {
        const comparison = computeComparison(toBn(aggregatorQuote.amountOut), directQuote?.amountOut);
        return {
            ...aggregatorQuote,
            comparison,
            meta,
        };
    }

    if (directQuote) {
        meta.fallbackFrom = 'aggregator';
        meta.fallbackReason = aggregatorError || 'Aggregator unavailable';
        return {
            amountOut: directQuote.amountOut.toString(),
            estimatedFee: directQuote.estimatedFee,
            router: null,
            source: 'clmm',
            poolAddress: directQuote.poolAddress,
            a2b: directQuote.a2b,
            paths: [{ label: 'Direct Pool', steps: [] }],
            rawSwapResult: directQuote.rawSwapResult,
            routeDetails: directQuote.routeDetails,
            comparison: null,
            meta,
        };
    }

    const aggregatorReason = aggregatorError || 'Unavailable';
    const errorMsg = `No available route (Aggregator: ${aggregatorReason}; Direct pool: not configured).`;
    console.error("❌ Error finding quote:", errorMsg);
    return {
        error: true,
        errorMessage: errorMsg,
        source: 'error',
        meta,
    };
}

export async function buildSimpleSwapTx(
    tx: Transaction | null,
    quote: any,
    inputCoin: any,
    userAddress: string,
    fromCoinType: string,
    toCoinType: string,
    slippage: number = 0.05,
    isZap: boolean = false, // Add isZap flag
    recipient: string = '' // Add recipient for Zap
): Promise<Transaction> {
    if (!quote) throw new Error("Invalid Quote Object");

    let finalTx: Transaction;

    if (quote.source === 'aggregator') {
        if (!tx) throw new Error("Transaction object required for Aggregator mode");
        const router = quote.selectedRoute?.router
            ? { ...quote.router, paths: quote.selectedRoute.router.path }
            : quote.router;
        const routePaths = quote.selectedRoute?.router?.path || quote.router?.paths || quote.router?.path || [];
        const invalidTarget = routePaths.find((path: any) => (path?.target || '').toLowerCase() !== toCoinType.toLowerCase());
        if (invalidTarget) {
            throw new Error(`Route target mismatch. Expected ${getTokenSymbol(toCoinType)}, got ${getTokenSymbol(invalidTarget.target)}.`);
        }
        // Set sender address on transaction for Aggregator SDK
        tx.setSender(userAddress);
        
        // Use routerSwap which appends commands to tx.
        const partnerInfo = getCetusPartnerInfo(quote, isZap, recipient);
        const targetCoin = await aggregator.routerSwap({
            router: router,
            txb: tx as any,
            inputCoin: inputCoin,
            slippage: slippage,
            partner: partnerInfo.enabled ? partnerInfo.partnerId : undefined,
        });

        if (isZap && recipient) {
            // We MUST use the custom buildTransferTx to trigger the TransferEvent
            await buildTransferTx(tx, targetCoin, recipient, toCoinType, "Zap Transfer");
        } else {
            // Standard Swap: Transfer output to user
            // We use transferOrDestroyCoin from SDK if available, or manual transfer
            // Using manual transfer to ensure compatibility with our PTB structure
            tx.transferObjects([targetCoin], tx.pure.address(userAddress));
        }

        finalTx = tx;
        
    } else {
        // CLMM Direct Swap - creates its own transaction
        const pool = await cetusClmm.Pool.getPool(quote.poolAddress);
        const toAmount = new BN(quote.amountOut);
        const amountLimit = adjustForSlippage(toAmount, slippage, !quote.a2b);

        // Create payload using SDK
        finalTx = await cetusClmm.Swap.createSwapTransactionPayload({
            pool_id: pool.poolAddress,
            a2b: quote.a2b,
            by_amount_in: quote.rawSwapResult.byAmountIn,
            amount: quote.rawSwapResult.amount,
            amount_limit: amountLimit.toString(),
            coinTypeA: pool.coinTypeA,
            coinTypeB: pool.coinTypeB,
        });

        // Note: CLMM SDK auto-transfers output to sender.
        // For Zap (swap + transfer to recipient), we use 2-step flow:
        // Step 1: Swap (output goes to sender)
        // Step 2: User clicks transfer again to send to recipient
        // This is because CLMM entry functions hardcode the recipient to tx sender.
    }

    // 🔗 Append On-Chain Analytics Event
    try {
        // Ensure sender is set for all transaction types (Crucial for DryRun)
        finalTx.setSender(userAddress);

        // Extract amountIn/amountOut from quote
        const amountIn = quote.rawSwapResult?.amount
            ? quote.rawSwapResult.amount.toString()
            : (quote.source === 'aggregator' ? quote.router.amountIn.toString() : '0');
        const selectedAmountOut = quote.selectedRoute?.amountOut || quote.amountOut;
        const amountOut = selectedAmountOut ? selectedAmountOut.toString() : (quote.source === 'aggregator' ? quote.router.amountOut.toString() : '0');

        finalTx.moveCall({
            target: `${CETUS_SWAP_PACKAGE_ID}::swap_helper::record_swap_event`,
            arguments: [
                finalTx.pure.string(fromCoinType),
                finalTx.pure.string(toCoinType),
                finalTx.pure.u64(amountIn),
                finalTx.pure.u64(amountOut)
            ]
        });

        if (ENABLE_RECEIPTS) {
            const routeLabelRaw = quote.selectedRoute?.pathSteps?.map((s: any) => `${getTokenSymbol(s.from)}->${getTokenSymbol(s.to)}`).join(' | ')
                || quote.routeDetails?.pathText
                || (quote.source === 'aggregator' ? 'Cetus Aggregator' : 'Cetus CLMM');
            const routeLabel = toAsciiLabel(routeLabelRaw);

            const isAtomicZap = isZap && recipient && quote.source === 'aggregator';
            if (isAtomicZap) {
                const [zapReceipt] = finalTx.moveCall({
                    target: `${CETUS_SWAP_PACKAGE_ID}::swap_helper::mint_zap_receipt`,
                    arguments: [
                        finalTx.pure.string(fromCoinType),
                        finalTx.pure.string(toCoinType),
                        finalTx.pure.u64(amountIn),
                        finalTx.pure.u64(amountOut),
                        finalTx.pure.string(routeLabel),
                        finalTx.pure.address(recipient)
                    ]
                });
                finalTx.transferObjects([zapReceipt], finalTx.pure.address(userAddress));
            } else {
                const [swapReceipt] = finalTx.moveCall({
                    target: `${CETUS_SWAP_PACKAGE_ID}::swap_helper::mint_swap_receipt`,
                    arguments: [
                        finalTx.pure.string(fromCoinType),
                        finalTx.pure.string(toCoinType),
                        finalTx.pure.u64(amountIn),
                        finalTx.pure.u64(amountOut),
                        finalTx.pure.string(routeLabel),
                    ]
                });
                finalTx.transferObjects([swapReceipt], finalTx.pure.address(userAddress));
            }
        }
    } catch (e) {
        console.error("❌ Failed to append SwapEvent:", e);
    }

    return finalTx;
}

function adjustForSlippage(amount: BN, slippage: number, isMax: boolean): BN {
    const slippageBN = new BN(Math.floor(slippage * 10000));
    const base = new BN(10000);
    // isMax=true: minimum output (reduce by slippage for safety)
    // isMax=false: maximum input (increase by slippage for safety)
    if (isMax) {
        return amount.mul(base.sub(slippageBN)).div(base);
    } else {
        return amount.mul(base.add(slippageBN)).div(base);
    }
}

// 📊 Query History (Swap + Transfer)
export async function getSwapHistory(
    suiClient: any,
    userAddress: string,
    registryObjectId: string,
    limit: number = 50
) {
    try {
        const normalizedUserAddress = normalizeSuiAddress(userAddress);
        // console.log(`📊 Fetching history for ${normalizedUserAddress} using Package ID: ${CETUS_SWAP_PACKAGE_ID}`);

        // 1. Fetch Swap Events
        const swapEventsPromise = suiClient.queryEvents({
            query: { MoveEventType: `${CETUS_SWAP_PACKAGE_ID}::swap_helper::SwapEvent` },
            limit: limit
        });

        // 2. Fetch Transfer Events
        const transferEventsPromise = suiClient.queryEvents({
            query: { MoveEventType: `${CETUS_SWAP_PACKAGE_ID}::swap_helper::TransferEvent` },
            limit: limit
        });

        const [swapEvents, transferEvents] = await Promise.all([swapEventsPromise, transferEventsPromise]);
        
        // console.log(`🔍 Raw Events Found - Swap: ${swapEvents?.data?.length || 0}, Transfer: ${transferEvents?.data?.length || 0}`);

        if (transferEvents?.data?.length > 0) {
             // DEBUG: Log all transfer events to see if we are missing any
            //  console.log("🔍 === ALL RAW TRANSFER EVENTS ===");
            //  transferEvents.data.forEach((e: any, i: number) => {
            //      const d = e.parsedJson as any;
            //      const sender = d.sender;
            //      const recipient = d.recipient;
            //      console.log(`[Transfer ${i}] Tx: ${e.id?.txDigest} | Sender: ${sender} | Recipient: ${recipient}`);
            //  });
            //  console.log("🔍 ================================");
        } else {
            //  console.log("⚠️ No Transfer Events found. Check if package ID is correct or if event emission is working.");
        }

        const combinedEvents: any[] = [];

        // Process Swaps
        if (swapEvents && swapEvents.data) {
            combinedEvents.push(...swapEvents.data.map((event: any) => ({
                ...event,
                type: 'swap'
            })));
        }

        // Process Transfers
        if (transferEvents && transferEvents.data) {
            combinedEvents.push(...transferEvents.data.map((event: any) => ({
                ...event,
                type: 'transfer'
            })));
        }

        // Filter and Sort
        const userEvents = combinedEvents
            .filter((event: any) => {
                const data = event.parsedJson as any;
                
                // Normalize addresses for comparison
                // For swaps: user is 'user'. For transfers: user could be 'sender' or 'recipient'
                if (event.type === 'swap') {
                    // Check both data.user (Move event field) AND event.sender (Tx signer)
                    // Zap transactions might be signed by user but event.user refers to Router
                    const isUserMatch = data.user && normalizeSuiAddress(data.user) === normalizedUserAddress;
                    const isSenderMatch = event.sender && normalizeSuiAddress(event.sender) === normalizedUserAddress;
                    return isUserMatch || isSenderMatch;
                }
                if (event.type === 'transfer') {
                    const isSender = data.sender && normalizeSuiAddress(data.sender) === normalizedUserAddress;
                    const isRecipient = data.recipient && normalizeSuiAddress(data.recipient) === normalizedUserAddress;
                    return isSender || isRecipient;
                }
                return false;
            })
            .sort((a: any, b: any) => {
                const aTime = Number(a.timestampMs || (a.parsedJson as any).timestamp || 0);
                const bTime = Number(b.timestampMs || (b.parsedJson as any).timestamp || 0);
                return bTime - aTime;
            })
            .slice(0, limit);

        return userEvents.map((event: any) => {
            const data = event.parsedJson as any;
            const timestamp = event.timestampMs ? Number(event.timestampMs) : Number(data.timestamp);
            
            if (event.type === 'swap') {
                return {
                    type: 'swap' as const,
                    user: data.user,
                    fromCoin: data.from_coin,
                    toCoin: data.to_coin,
                    amountIn: data.amount_in,
                    amountOut: data.amount_out,
                    timestamp: timestamp,
                    txDigest: event.id?.txDigest || '',
                    memo: ''
                };
            } else {
                // Transfer
                // Ensure addresses are normalized for comparison to avoid case-sensitivity or 0x prefix issues
                const isSender = normalizeSuiAddress(data.sender) === normalizeSuiAddress(userAddress);
                const transferRecord = {
                    type: (isSender ? 'send' : 'receive') as 'send' | 'receive',
                    user: isSender ? data.sender : data.recipient,
                    otherParty: isSender ? data.recipient : data.sender, // The other person
                    fromCoin: data.coin_type,
                    toCoin: data.coin_type,
                    amountIn: data.amount,
                    amountOut: data.amount,
                    timestamp: timestamp,
                    txDigest: event.id?.txDigest || '',
                    memo: data.memo || ''
                };

                return transferRecord;
            }
        });
    } catch (error) {
        console.error("❌ Error fetching history:", error);
        return [];
    }
}

// 🪙 Helper: Select and Prepare Coins for Transaction
export async function selectAndPrepareCoins(
    suiClient: SuiClient,
    userAddress: string,
    coinType: string,
    amountRaw: bigint,
    tx: Transaction
) {
    // If SUI, split from gas
    if (coinType === SUI_COIN_TYPE) {
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountRaw)]);
        return coin;
    }

    // Fetch coins for other tokens
    const { data: coins } = await suiClient.getCoins({
        owner: userAddress,
        coinType: coinType
    });

    if (coins.length === 0) throw new Error(`No balance found for coin ${coinType}`);

    // Sort coins by balance descending
    const sortedCoins = coins.sort((a: any, b: any) => Number(BigInt(b.balance) - BigInt(a.balance)));

    // Try to find a single coin with enough balance
    const validCoin = sortedCoins.find((c: any) => BigInt(c.balance) >= amountRaw);
    if (validCoin) {
        const primaryCoin = tx.object(validCoin.coinObjectId);
        const [coin] = tx.splitCoins(primaryCoin, [tx.pure.u64(amountRaw)]);
        return coin;
    }

    // Merge multiple coins if needed
    const coinsToMerge = [];
    let totalBalance = BigInt(0);

    for (const coin of sortedCoins) {
        coinsToMerge.push(tx.object(coin.coinObjectId));
        totalBalance += BigInt(coin.balance);
        if (totalBalance >= amountRaw) break;
    }

    if (totalBalance < amountRaw) {
        throw new Error(`Insufficient balance for coin ${coinType}`);
    }

    if (coinsToMerge.length > 1) {
        tx.mergeCoins(coinsToMerge[0], coinsToMerge.slice(1));
    }
    const [coin] = tx.splitCoins(coinsToMerge[0], [tx.pure.u64(amountRaw)]);
    return coin;
}

export async function buildTransferTx(
    tx: Transaction,
    inputCoin: any,
    recipient: string,
    coinType: string,
    memo: string
) {
    tx.moveCall({
        target: `${CETUS_SWAP_PACKAGE_ID}::swap_helper::transfer_coin_with_memo`,
        typeArguments: [coinType],
        arguments: [
            inputCoin,
            tx.pure.address(recipient),
            tx.pure.string(memo)
        ]
    });
}

// Apply a selected route to the quote (aggregator only)
export function applySelectedRoute(quote: any, selectedRouteId: number) {
    if (!quote || quote.source !== 'aggregator' || !quote.routes || quote.routes.length === 0) {
        return quote;
    }
    const selectedRoute = quote.routes.find((route: any) => route.id === selectedRouteId) || quote.routes[0];
    return {
        ...quote,
        selectedRoute,
        amountOut: selectedRoute.amountOut ? selectedRoute.amountOut.toString() : quote.amountOut,
    };
}

// Helper to get token symbol from coin type
export function getTokenSymbol(coinType: string): string {
    if (coinType.includes('::sui::SUI')) return 'SUI';
    if (coinType.includes('::usdc::USDC')) return 'USDC';
    if (coinType.includes('::cetus::CETUS')) return 'CETUS';
    if (coinType.includes('::coin::COIN')) return 'wUSDC';
    if (coinType.includes('::meme_token::MEME_TOKEN')) return 'MEME';
    if (coinType.includes('::idol_apple')) return 'IDOL_APPLE';
    if (coinType.includes('::idol_dgran')) return 'IDOL_DGRAN';
    return 'UNKNOWN';
}
