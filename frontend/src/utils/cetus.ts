/* eslint-disable @typescript-eslint/no-explicit-any */
import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk";
import { initCetusSDK } from "@cetusprotocol/cetus-sui-clmm-sdk";
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { normalizeSuiAddress } from "@mysten/sui/utils";
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
    amountIn: number | string,
    userAddress: string,
    byAmountIn: boolean = true
) {
    const amount = new BN(amountIn);

    // Set sender address for CLMM SDK
    if (userAddress) {
        cetusClmm.senderAddress = userAddress;
    }

    try {
        // 1️⃣ Try Aggregator First (Mainnet & Testnet)
        // Note: Testnet only supports limited providers (Cetus, DeepBook)
        
        const routerData = await aggregator.findRouters({
            from: fromCoinType,
            target: toCoinType,
            amount: amount,
            byAmountIn: byAmountIn,
        });

        if (routerData && routerData.paths && routerData.paths.length > 0) {
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
    } catch (error) {
        console.warn("⚠️ Aggregator failed, trying direct pool fallback...", error);
    }

    // 2️⃣ Fallback to Direct Pool (CLMM)
    try {
        // Identify Pool ID based on token pair
        let poolAddress = '';
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
             // Testnet
             POOL_MAP = {
                [`${TOKENS.SUI}-${(TOKENS as any).MEME}`]: pools.SUI_MEME,
                [`${TOKENS.SUI}-${(TOKENS as any).IDOL_APPLE}`]: pools.SUI_IDOL_APPLE,
                [`${TOKENS.SUI}-${(TOKENS as any).IDOL_DGRAN}`]: pools.SUI_IDOL_DGRAN,
             };
        }

        // Check both directions
        poolAddress = POOL_MAP[pairKey] || POOL_MAP[reversePairKey] || '';

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
            return {
                error: true,
                errorMessage: errorMsg,
                source: 'error'
            };
        }

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
    slippage: number = 0.05,
    isZap: boolean = false, // Add isZap flag
    recipient: string = '' // Add recipient for Zap
): Promise<Transaction> {
    if (!quote) throw new Error("Invalid Quote Object");

    let finalTx: Transaction;

    if (quote.source === 'aggregator') {
        if (!tx) throw new Error("Transaction object required for Aggregator mode");
        const { router } = quote;
        // Set sender address on transaction for Aggregator SDK
        tx.setSender(userAddress);
        
        // Use routerSwap which appends commands to tx.
        const targetCoin = await aggregator.routerSwap({
            router: router,
            txb: tx as any,
            inputCoin: inputCoin,
            slippage: slippage,
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
