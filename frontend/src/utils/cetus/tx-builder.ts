/* eslint-disable @typescript-eslint/no-explicit-any */
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { normalizeSuiAddress, isValidSuiAddress } from "@mysten/sui/utils";
import BN from "bn.js";
import { TOKENS, SUI_NETWORK, POOL_IDS, CETUS_SWAP_PACKAGE_ID, CETUS_PARTNER_ID, ENABLE_RECEIPTS } from "../config";
import { cetusClmm, aggregator } from "./sdk";

export { SUI_NETWORK, CETUS_PARTNER_ID, ENABLE_RECEIPTS }; // Re-export for frontend use

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

export type RouteStep = {
    from: string;
    to: string;
    fromSymbol: string;
    toSymbol: string;
    provider: string;
    feeRate?: string | number;
};

export type RouteDetails = {
    type: 'aggregator' | 'clmm';
    hops: number;
    providers: string[];
    steps: RouteStep[];
    pathText: string;
};

export type QuoteComparison = {
    directOut: string;
    aggregatorOut: string;
    savingsAbs: string;
    savingsPct: number;
    better: 'aggregator' | 'clmm' | 'equal';
};

export type QuoteMeta = {
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

const isCetusProvider = (provider: unknown) => String(provider || '').toLowerCase().includes('cetus');

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
const normalizeType = (type: string) => {
    if (!type) return '';
    const parts = type.split('::');
    if (parts.length < 3) return type.toLowerCase();
    const [addr, ...rest] = parts;
    let normalized = addr;
    try {
        normalized = normalizeSuiAddress(addr);
    } catch {
        // keep original if not a valid address
    }
    return `${normalized}::${rest.join('::')}`.toLowerCase();
};

const getPathEndpoints = (path: any) => {
    if (!path) return { from: '', to: '' };
    if (path.from && (path.target || path.to)) {
        return { from: path.from, to: path.target || path.to };
    }
    if (Array.isArray(path.path) && path.path.length > 0) {
        const first = path.path[0] || {};
        const last = path.path[path.path.length - 1] || {};
        return {
            from: first.from || first.coinIn || '',
            to: last.target || last.to || last.coinOut || '',
        };
    }
    if (Array.isArray(path.steps) && path.steps.length > 0) {
        const first = path.steps[0] || {};
        const last = path.steps[path.steps.length - 1] || {};
        return {
            from: first.from || first.coinIn || '',
            to: last.to || last.target || last.coinOut || '',
        };
    }
    return {
        from: path.from || path.coinIn || '',
        to: path.target || path.to || path.coinOut || '',
    };
};

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

const AGGREGATOR_V3_PACKAGE_ID = {
    mainnet: "0xde5d696a79714ca5cb910b9aed99d41f67353abb00715ceaeb0663d57ee39640",
    testnet: "0x61da681cf2af95cb214a71596b49e662290065536984ed7e06b47e701ef547e3"
};

const getPoolAddressForPair = async (fromCoinType: string, toCoinType: string): Promise<string> => {
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

    const cachedAddress = POOL_MAP[pairKey] || POOL_MAP[reversePairKey];
    if (cachedAddress) return cachedAddress;

    // 🔍 Dynamic Discovery Fallback
    try {
        // console.log(`🔍 Searching pool for ${fromCoinType} <-> ${toCoinType}...`);
        // Note: SDK types might vary, checking available methods at runtime is safer or use strict types if known.
        // Assuming getPoolByCoins or getPoolsWithPage based on documentation.
        // Using getPoolByCoins as it is the most direct method mentioned in docs.
        const pools = await (cetusClmm.Pool as any).getPoolByCoins([fromCoinType, toCoinType]);
        if (pools && pools.length > 0) {
            // console.log(`✅ Pool found dynamically: ${pools[0].poolAddress}`);
            return pools[0].poolAddress;
        }
    } catch (e) {
        console.warn(`⚠️ Dynamic pool search failed for ${fromCoinType}-${toCoinType}`, e);
    }

    return '';
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
    const poolAddress = await getPoolAddressForPair(fromCoinType, toCoinType);
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

    // 🛑 Pre-check for known testnet limitations or invalid inputs
    if (SUI_NETWORK === 'testnet') {
        // On Testnet, aggregator endpoints might be unstable or limited.
        // We might want to prioritize direct pool or mock data if critical pairs are missing.
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

        const normalizedFrom = normalizeType(fromCoinType);
        const normalizedTo = normalizeType(toCoinType);
        const validPaths = routerData?.paths?.filter((path: any) => {
            const endpoints = getPathEndpoints(path);
            return normalizeType(endpoints.from) === normalizedFrom
                && normalizeType(endpoints.to) === normalizedTo;
        }) || [];

        if (routerData && validPaths.length > 0) {
            const sortedPaths = validPaths.sort((a: any, b: any) => toBn(b.amountOut).cmp(toBn(a.amountOut)));
            const routes = sortedPaths.map((path: any, idx: number) => {
                const endpoints = getPathEndpoints(path);
                const pathFrom = endpoints.from || path.from;
                const pathTo = endpoints.to || path.target || path.to;
                const pathSteps = [{
                    from: pathFrom,
                    to: pathTo,
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

            const bestPath: any = sortedPaths[0];
            const bestEndpoints = getPathEndpoints(bestPath);
            const bestFrom = bestEndpoints.from || bestPath.from;
            const bestTo = bestEndpoints.to || bestPath.target || bestPath.to;
            const routeSteps: RouteStep[] = [{
                from: bestFrom,
                to: bestTo,
                fromSymbol: getTokenSymbol(bestFrom),
                toSymbol: getTokenSymbol(bestTo),
                provider: bestPath.provider || 'Cetus Aggregator',
                feeRate: bestPath.feeRate,
            }];

            const paths = sortedPaths.map((path: any, idx: number) => {
                const endpoints = getPathEndpoints(path);
                const pathFrom = endpoints.from || path.from;
                const pathTo = endpoints.to || path.target || path.to;
                return {
                    label: `${getTokenSymbol(pathFrom)}→${getTokenSymbol(pathTo)} (${path.provider || 'Cetus'})`,
                    steps: [path],
                    id: idx,
                };
            });

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

        // 🧠 Phase 3: Transform Direct CLMM Quote to Synthetic Aggregator Quote
        // This allows us to use the unified aggregator.routerSwap execution path,
        // enabling Atomic Zap (Swap + Transfer in one PTB) even for direct pools.
        
        const syntheticPath = {
            id: directQuote.poolAddress, // Use real pool address as ID (must be valid Sui address)
            direction: directQuote.a2b,
            provider: 'CETUS',
            from: fromCoinType,
            target: toCoinType,
            feeRate: 0, // Fee is handled internally by pool
            amountIn: amount.toString(),
            amountOut: directQuote.amountOut.toString(),
            publishedAt: CETUS_SWAP_PACKAGE_ID, // 🏭 Required by Aggregator SDK
            extendedDetails: {
                poolAddress: directQuote.poolAddress,
                coinTypeA: directQuote.rawSwapResult.pool.coinTypeA,
                coinTypeB: directQuote.rawSwapResult.pool.coinTypeB,
            }
        };

        const packages = new Map();
        packages.set("aggregator_v3", AGGREGATOR_V3_PACKAGE_ID[SUI_NETWORK === 'mainnet' ? 'mainnet' : 'testnet']);

        const syntheticRouterData = {
            quoteID: 'synthetic-clmm-quote', // 🆔 Required by Aggregator SDK
            amountIn: amount,
            amountOut: directQuote.amountOut,
            byAmountIn: byAmountIn,
            paths: [syntheticPath],
            // 🩹 Polyfill: buildSimpleSwapTx expects 'path' in some logic branches, 'paths' in others.
            // We provide both to ensure compatibility with the unified flow.
            path: [syntheticPath], 
            insufficientLiquidity: false,
            deviationRatio: 0,
            packages, // 📦 Required by Aggregator SDK (must be a Map with aggregator_v3 key)
        };

        return {
            amountOut: directQuote.amountOut.toString(),
            estimatedFee: directQuote.estimatedFee,
            router: syntheticRouterData, // Pass as Aggregator Router Data
            source: 'aggregator', // 🎭 Masquerade as Aggregator to trigger unified flow
            poolAddress: directQuote.poolAddress,
            a2b: directQuote.a2b,
            paths: [{ label: 'Direct Pool (Atomic)', steps: [syntheticPath] }],
            rawSwapResult: directQuote.rawSwapResult,
            routeDetails: directQuote.routeDetails,
            comparison: null,
            meta,
            isSynthetic: true // Flag for debugging
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
        
        // ... (existing route check code)

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
        // ⚠️ Legacy Branch (Should not be reached with Synthetic Router)
        // If we reach here, it means quote.source is NOT aggregator, which implies
        // the synthetic transformation failed or was bypassed.
        // We throw an error to enforce the unified flow.
        throw new Error("Unified Router Execution Error: Non-aggregator quote source encountered.");
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
    const normalized = normalizeType(coinType);
    if (coinType.includes('::sui::SUI')) return 'SUI';
    if (coinType.includes('::usdc::USDC')) return 'USDC';
    if (coinType.includes('::cetus::CETUS')) return 'CETUS';
    if (normalizeType(TOKENS.wUSDC) === normalized) return 'wUSDC';
    if (coinType.includes('::meme_token::MEME_TOKEN')) return 'MEME';
    if (coinType.includes('::idol_apple')) return 'IDOL_APPLE';
    if (coinType.includes('::idol_dgran')) return 'IDOL_DGRAN';
    return 'UNKNOWN';
}
