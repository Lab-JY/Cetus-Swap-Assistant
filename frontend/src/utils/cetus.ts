/* eslint-disable @typescript-eslint/no-explicit-any */
import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk";
import { initCetusSDK } from "@cetusprotocol/cetus-sui-clmm-sdk";
import { Transaction } from "@mysten/sui/transactions";
import BN from "bn.js";
import { TOKENS, SUI_NETWORK, POOL_IDS, CETUS_SWAP_PACKAGE_ID } from "./config";

export { SUI_NETWORK }; // Re-export for frontend use

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

export async function getSwapQuote(
    fromCoinType: string,
    toCoinType: string,
    amountIn: number,
    userAddress: string,
    byAmountIn: boolean = true
) {
    console.log(`🔍 Quote: ${amountIn} ${fromCoinType} -> ${toCoinType}`);
    const amount = new BN(amountIn);

    // Set sender address for CLMM SDK
    if (userAddress) {
        cetusClmm.senderAddress = userAddress;
    }

    try {
        // 1️⃣ Try Aggregator First (Only on Mainnet)
        // The Aggregator SDK v1.4.3 currently throws "CetusRouter only supported on mainnet"
        // when executing routerSwap on Testnet. So we skip it on Testnet.
        if (SUI_NETWORK === 'mainnet') {
            console.log("Trying Aggregator...");
            const routerData = await aggregator.findRouters({
                from: fromCoinType,
                target: toCoinType,
                amount: amount,
                byAmountIn: byAmountIn,
            });

            if (routerData && routerData.paths && routerData.paths.length > 0) {
                console.log("✅ Aggregator Routes Found:", {
                    totalPaths: routerData.paths.length,
                    bestAmountOut: routerData.amountOut.toString()
                });

                // RouterDataV3 returns paths as a flat array, we need to group them into routes
                // For now, treat each path as a separate route option
                const routes = routerData.paths.map((path: any, idx: number) => {
                    return {
                        id: idx,
                        amountOut: new BN(path.amountOut),
                        estimatedFee: 0,
                        router: { path: [path] },
                        source: 'aggregator',
                        pathSteps: [{
                            from: path.from,
                            to: path.target,
                            provider: path.provider,
                            feeRate: path.feeRate,
                            amountIn: path.amountIn,
                            amountOut: path.amountOut
                        }],
                        hopCount: 1,
                        rawSwapResult: { path: [path] }
                    };
                });

                return {
                    amountOut: routerData.amountOut,
                    estimatedFee: 0,
                    router: routerData,
                    source: 'aggregator',
                    routes: routes,
                    selectedRouteId: 0, // Default to best route
                    rawSwapResult: routerData,
                    fullRouterData: routerData // Store full routerData for SDK
                };
            }
        } else {
            console.log("ℹ️ Skipping Aggregator on Testnet (Direct Pool Mode)");
        }
    } catch (error) {
        console.warn("⚠️ Aggregator failed, trying direct pool fallback...", error);
    }

    // 2️⃣ Fallback to Direct Pool (CLMM)
    try {
        console.log("Trying Direct Pool Fallback...");
        // Identify Pool ID based on token pair
        let poolAddress = '';
        const network = SUI_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
        const pools = POOL_IDS[network];

        // Check for SUI-USDC pair (Mainnet)
        if ((fromCoinType === TOKENS.SUI && toCoinType === TOKENS.USDC) ||
            (fromCoinType === TOKENS.USDC && toCoinType === TOKENS.SUI)) {
            poolAddress = (pools as any).SUI_USDC;
        }
        // Check for SUI-CETUS pair (Mainnet)
        else if ((fromCoinType === TOKENS.SUI && toCoinType === TOKENS.CETUS) ||
                 (fromCoinType === TOKENS.CETUS && toCoinType === TOKENS.SUI)) {
            poolAddress = (pools as any).SUI_CETUS;
        }
        // Check for USDC-CETUS pair (Mainnet)
        else if ((fromCoinType === TOKENS.USDC && toCoinType === TOKENS.CETUS) ||
                 (fromCoinType === TOKENS.CETUS && toCoinType === TOKENS.USDC)) {
            poolAddress = (pools as any).USDC_CETUS;
        }
        // Check for SUI-MEME pair (Testnet)
        else if ((fromCoinType === TOKENS.SUI && toCoinType === (TOKENS as any).MEME) ||
                 (fromCoinType === (TOKENS as any).MEME && toCoinType === TOKENS.SUI)) {
            poolAddress = (pools as any).SUI_MEME;
        }
        // Check for SUI-IDOL_APPLE pair (Testnet)
        else if ((fromCoinType === TOKENS.SUI && toCoinType === (TOKENS as any).IDOL_APPLE) ||
                 (fromCoinType === (TOKENS as any).IDOL_APPLE && toCoinType === TOKENS.SUI)) {
            poolAddress = (pools as any).SUI_IDOL_APPLE;
        }
        // Check for SUI-IDOL_DGRAN pair (Testnet)
        else if ((fromCoinType === TOKENS.SUI && toCoinType === (TOKENS as any).IDOL_DGRAN) ||
                 (fromCoinType === (TOKENS as any).IDOL_DGRAN && toCoinType === TOKENS.SUI)) {
            poolAddress = (pools as any).SUI_IDOL_DGRAN;
        }

        if (!poolAddress) {
            const errorMsg = "This token pair is not supported. Please select a different pair.";
            console.error("❌ No direct pool configured for this pair.");
            return {
                error: true,
                errorMessage: errorMsg,
                source: 'error'
            };
        }

        const pool = await cetusClmm.Pool.getPool(poolAddress);
        // Determine a2b based on actual pool structure
        const a2b = fromCoinType === pool.coinTypeA;

        // Use preswap which handles tick fetching or simple estimation
        const res = await cetusClmm.Swap.preswap({
            pool: pool,
            currentSqrtPrice: pool.current_sqrt_price,
            decimalsA: 9,
            decimalsB: 6,
            a2b: a2b,
            byAmountIn: byAmountIn,
            amount: amount.toString(),
            coinTypeA: pool.coinTypeA,
            coinTypeB: pool.coinTypeB
        });

        if (!res) {
            const errorMsg = "Failed to get quote for this pair. Please try again.";
            console.error("❌ Direct Pool Quote returned null");
            return {
                error: true,
                errorMessage: errorMsg,
                source: 'error'
            };
        }

        console.log("✅ Direct Pool Quote Found:", res.estimatedAmountOut.toString());

        return {
            amountOut: new BN(res.estimatedAmountOut),
            estimatedFee: res.estimatedFeeAmount,
            router: null,
            source: 'clmm',
            poolAddress: poolAddress,
            a2b: a2b,
            paths: [{ label: 'Direct Pool', steps: [] }],
            rawSwapResult: res
        };

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Failed to get quote. Please try again.";
        console.error("❌ Error finding direct quote:", error);
        return {
            error: true,
            errorMessage: errorMsg,
            source: 'error'
        };
    }
}

export async function buildSimpleSwapTx(
    tx: Transaction | null,
    quote: any,
    inputCoin: any,
    userAddress: string,
    fromCoinType: string,
    toCoinType: string,
    slippage: number = 0.05
): Promise<Transaction> {
    if (!quote) throw new Error("Invalid Quote Object");

    console.log(`🏗️ Building Swap Transaction via ${quote.source === 'aggregator' ? 'Aggregator' : 'CLMM'}...`);
    
    let finalTx: Transaction;

    if (quote.source === 'aggregator') {
        if (!tx) throw new Error("Transaction object required for Aggregator mode");
        const { router } = quote;
        // Set sender address on transaction for Aggregator SDK
        tx.setSender(userAddress);
        await aggregator.routerSwap({
            router: router,
            txb: tx as any,
            inputCoin: inputCoin,
            slippage: slippage,
        });
        finalTx = tx;
    } else {
        // CLMM Direct Swap - creates its own transaction
        const pool = await cetusClmm.Pool.getPool(quote.poolAddress);
        const toAmount = new BN(quote.amountOut);
        const amountLimit = adjustForSlippage(toAmount, slippage, !quote.a2b);

        // createSwapTransactionPayload creates a NEW transaction
        finalTx = await cetusClmm.Swap.createSwapTransactionPayload({
            pool_id: pool.poolAddress,
            a2b: quote.a2b,
            by_amount_in: quote.rawSwapResult.byAmountIn,
            amount: quote.rawSwapResult.amount,
            amount_limit: amountLimit.toString(),
            coinTypeA: pool.coinTypeA,
            coinTypeB: pool.coinTypeB,
        });
    }

    // 🔗 Append On-Chain Analytics Event
    try {
        console.log("📝 Appending SwapEvent to transaction...");
        
        // Extract amountIn/amountOut from quote
        // Handle BN or string or number
        const amountIn = quote.rawSwapResult.amount ? quote.rawSwapResult.amount.toString() : (quote.source === 'aggregator' ? quote.router.amountIn.toString() : '0');
        const amountOut = quote.amountOut ? quote.amountOut.toString() : (quote.source === 'aggregator' ? quote.router.amountOut.toString() : '0');

        finalTx.moveCall({
            target: `${CETUS_SWAP_PACKAGE_ID}::swap_helper::record_swap_event`,
            arguments: [
                finalTx.pure.string(fromCoinType),
                finalTx.pure.string(toCoinType),
                finalTx.pure.u64(amountIn),
                finalTx.pure.u64(amountOut)
            ]
        });
        console.log("✅ SwapEvent appended successfully");
    } catch (e) {
        console.error("❌ Failed to append SwapEvent:", e);
        // Don't fail the swap if analytics fails
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

// 📊 Query Swap History from SwapRegistry
export async function getSwapHistory(
    suiClient: any,
    userAddress: string,
    registryObjectId: string,
    limit: number = 10
) {
    try {
        console.log(`📊 Fetching swap history for ${userAddress}...`);

        // Query SwapEvent for the user
        const events = await suiClient.queryEvents({
            query: {
                MoveEventType: `${CETUS_SWAP_PACKAGE_ID}::swap_helper::SwapEvent`
            }
        });

        if (!events || !events.data) {
            return [];
        }

        // Filter events for current user and sort by timestamp
        const userEvents = events.data
            .filter((event: any) => {
                const parsedJson = event.parsedJson as any;
                return parsedJson && parsedJson.user === userAddress;
            })
            .sort((a: any, b: any) => {
                // Use system timestampMs if available, fallback to contract timestamp
                const aTime = Number(a.timestampMs || (a.parsedJson as any).timestamp || 0);
                const bTime = Number(b.timestampMs || (b.parsedJson as any).timestamp || 0);
                return bTime - aTime; // Most recent first
            })
            .slice(0, limit);

        return userEvents.map((event: any) => {
            const data = event.parsedJson as any;
            // Use system timestampMs (milliseconds) instead of contract timestamp (epoch)
            const timestamp = event.timestampMs ? Number(event.timestampMs) : Number(data.timestamp);
            
            return {
                user: data.user,
                fromCoin: data.from_coin,
                toCoin: data.to_coin,
                amountIn: data.amount_in,
                amountOut: data.amount_out,
                timestamp: timestamp,
                txDigest: event.id?.txDigest || ''
            };
        });
    } catch (error) {
        console.error("❌ Error fetching swap history:", error);
        return [];
    }
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
