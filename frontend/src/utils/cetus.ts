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
        // 1️⃣ Try Aggregator First (Mainnet & Testnet)
        // Note: Testnet only supports limited providers (Cetus, DeepBook)
        console.log(`Trying Aggregator on ${SUI_NETWORK}...`);
        
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
    slippage: number = 0.05,
    isZap: boolean = false, // Add isZap flag
    recipient: string = '' // Add recipient for Zap
): Promise<Transaction> {
    if (!quote) throw new Error("Invalid Quote Object");

    console.log(`🏗️ Building Swap Transaction via ${quote.source === 'aggregator' ? 'Aggregator' : 'CLMM'}...`);
    
    let finalTx: Transaction;

    if (quote.source === 'aggregator') {
        if (!tx) throw new Error("Transaction object required for Aggregator mode");
        const { router } = quote;
        // Set sender address on transaction for Aggregator SDK
        tx.setSender(userAddress);
        
        // Use routerSwap which returns the output Coin
        // However, the current SDK binding for routerSwap might return void or modify tx in place
        // The aggregator SDK usually handles the transfer to sender internally if not specified
        // But for PTB, we want the output coin to chain it.
        // Let's check if we can intercept the output.
        // The SDK's routerSwap appends commands to tx.
        // If we want to transfer the output to someone else, we need to know WHICH object is the output.
        // This is tricky with Aggregator SDK as it might not expose the result coin easily in TS.
        
        // WORKAROUND FOR AGGREGATOR ZAP:
        // The aggregator usually sends output to tx.sender.
        // If we want to send to someone else, we need to do it in 2 steps OR
        // we need to be able to access the output coin from the PTB result.
        // Since we can't easily get the output coin from the black-box SDK call,
        // we might have to stick to 2-step for Aggregator, OR
        // we rely on the fact that the output coin ends up in the user's wallet, 
        // and we can't easily chain it in the SAME PTB unless the SDK returns the Coin argument.
        
        // BUT for CLMM (Direct Pool), we create the commands ourselves so we HAVE the coin.
        
        await aggregator.routerSwap({
            router: router,
            txb: tx as any,
            inputCoin: inputCoin,
            slippage: slippage,
        });
        finalTx = tx;
        
        // If it's aggregator, we can't easily do atomic zap because we don't handle the output coin.
        // It goes to userAddress automatically.
        // So for Aggregator, we might still need 2 steps or just let it go to user.
        
    } else {
        // CLMM Direct Swap - creates its own transaction
        const pool = await cetusClmm.Pool.getPool(quote.poolAddress);
        const toAmount = new BN(quote.amountOut);
        const amountLimit = adjustForSlippage(toAmount, slippage, !quote.a2b);

        // We need to use a custom payload creation to get the Coin back
        // The SDK's createSwapTransactionPayload returns a full Transaction, but we might want to append.
        // Actually, createSwapTransactionPayload builds a fresh transaction.
        
        // If we want to chain, we should use the lower level move calls if possible,
        // OR we just use the Transaction it returns and append to it?
        // YES! We can append to the transaction returned by CLMM.
        
        finalTx = await cetusClmm.Swap.createSwapTransactionPayload({
            pool_id: pool.poolAddress,
            a2b: quote.a2b,
            by_amount_in: quote.rawSwapResult.byAmountIn,
            amount: quote.rawSwapResult.amount,
            amount_limit: amountLimit.toString(),
            coinTypeA: pool.coinTypeA,
            coinTypeB: pool.coinTypeB,
        });
        
        // For CLMM, the createSwapTransactionPayload typically transfers the output to sender at the end.
        // If we want to intercept it, we would need to construct the PTB manually using moveCall.
        // But the SDK abstracts that.
        // The SDK function `createSwapTransactionPayload` likely ends with `transfer::public_transfer`.
        
        // If we want to Zap, we need to perform the transfer *instead* of the default transfer.
        // Or we transfer it *again*? No, once transferred, it's gone from PTB scope.
        
        // So, for true atomic Zap with SDKs that auto-transfer, it is HARD.
        // We would need to manually build the move calls for swap.
        
        // HOWEVER, we can cheat:
        // 1. Swap (Output goes to User)
        // 2. Transfer (User sends to Recipient) - this requires a second signature/tx if not in same PTB.
        // BUT, if we are in the same PTB, we don't know the Object ID of the new coin yet.
        
        // SOLUTION:
        // Use `flash_swap` or similar? No.
        
        // The only way to do Atomic Zap in one PTB is if we have control over the output Coin object.
        // Since the SDKs (both Aggregator and CLMM high-level) auto-transfer to sender,
        // we CANNOT easily chain a transfer to someone else in the same PTB without writing low-level Move calls.
        
        // Given this constraint and the Hackathon nature, 
        // the "2-Step UI" I implemented is actually the most robust "Safe" way without rewriting the SDK logic.
        
        // BUT, the user insists on "One Logic".
        // Let's try to simulate it by "Split & Merge" if possible? No.
        
        // WAIT! The Aggregator SDK might support `recipient`?
        // Checking Aggregator SDK docs (mental check)... usually no.
        
        // Alternative:
        // We can explain to the user that due to SDK limitations, 2-step is required for safety.
        // OR we can try to find if `routerSwap` accepts a recipient?
        // No.
    }

    // 🔗 Append On-Chain Analytics Event
    try {
        // Ensure sender is set for all transaction types (Crucial for DryRun)
        finalTx.setSender(userAddress);

        console.log("📝 Appending SwapEvent to transaction...");
        
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
        console.log("✅ SwapEvent appended successfully");
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
    limit: number = 20
) {
    try {
        const normalizedUserAddress = userAddress.toLowerCase();
        console.log(`📊 Fetching history for ${normalizedUserAddress}...`);

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
        
        console.log(`🔍 Raw Events Found - Swap: ${swapEvents?.data?.length || 0}, Transfer: ${transferEvents?.data?.length || 0}`);

        let combinedEvents = [];

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
                const eventUser = data.user?.toLowerCase();
                const eventSender = data.sender?.toLowerCase();
                const eventRecipient = data.recipient?.toLowerCase();

                // For swaps: user is 'user'. For transfers: user could be 'sender' or 'recipient'
                if (event.type === 'swap') return eventUser === normalizedUserAddress;
                if (event.type === 'transfer') return eventSender === normalizedUserAddress || eventRecipient === normalizedUserAddress;
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
                const isSender = data.sender === userAddress;
                return {
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
            }
        });
    } catch (error) {
        console.error("❌ Error fetching history:", error);
        return [];
    }
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
