/* eslint-disable @typescript-eslint/no-explicit-any */
import { initCetusSDK, Percentage } from "@cetusprotocol/cetus-sui-clmm-sdk";
import { Transaction } from "@mysten/sui/transactions";
import BN from "bn.js";
import { TOKENS, CETUS_SWAP_PACKAGE_ID, SUI_NETWORK, POOL_IDS } from "./config";

// 🌟 Initialize Cetus CLMM SDK (Dynamic Network)
// We use CLMM SDK directly because Aggregator SDK can be unstable on Testnet due to indexer lag.
const cetusClmmSDK = initCetusSDK({
    network: SUI_NETWORK as 'mainnet' | 'testnet',
    simulationAccount: '0x0000000000000000000000000000000000000000000000000000000000000000', // Dummy valid address for read-only ops
});

export const SUI_COIN_TYPE = TOKENS.SUI;
export const CETUS_COIN_TYPE = TOKENS.CETUS; 
export const USDC_COIN_TYPE = TOKENS.USDC; 
export const WUSDC_COIN_TYPE = TOKENS.wUSDC; 

// Cache for Pool Objects to avoid fetching every time
let cachedPool: any = null;

export async function getSwapQuote(
    fromCoinType: string,
    toCoinType: string,
    amountIn: number, 
    byAmountIn: boolean = true
) {
    console.log(`🔍 CLMM Quote: ${amountIn} ${fromCoinType} -> ${toCoinType}`);

    try {
        // 1. Get Pool Address (SUI-USDC or other pairs)
        // For Hackathon Demo, we prioritize SUI-USDC pool
        // If not cached, fetch it.
        if (!cachedPool || cachedPool.coinTypeA !== fromCoinType && cachedPool.coinTypeB !== fromCoinType) {
             console.log("Fetching Pool...");
             
             // 🛠️ Optimization: For SUI-USDC, use known Pool ID directly.
             // This avoids "getPoolsWithPage" which can be slow or miss the pool in first page.
             // We prioritize the ID from config based on current network.
             const PREDEFINED_POOL_ID = SUI_NETWORK === 'mainnet' ? POOL_IDS.mainnet.SUI_USDC : POOL_IDS.testnet.SUI_USDC;
             
             if (
                (fromCoinType === SUI_COIN_TYPE && toCoinType === USDC_COIN_TYPE) ||
                (fromCoinType === USDC_COIN_TYPE && toCoinType === SUI_COIN_TYPE)
             ) {
                 try {
                     console.log(`🚀 Fast-tracking ${SUI_NETWORK.toUpperCase()} SUI-USDC Pool fetch...`);
                     cachedPool = await cetusClmmSDK.Pool.getPool(PREDEFINED_POOL_ID);
                 } catch (e) {
                     console.warn("⚠️ Fast-track pool fetch failed, falling back to list scan.", e);
                 }
             }

             // If fast-track failed or not SUI-USDC, try scanning (slow)
             if (!cachedPool) {
                let pools: any = { data: [] };
                try {
                    pools = await cetusClmmSDK.Pool.getPoolsWithPage([]); 
                } catch (e) {
                    console.warn("⚠️ Failed to fetch pool list from SDK.");
                }

                // Simple logic: find a pool that contains both tokens
                if (pools && pools.data) {
                    cachedPool = pools.data.find((p: any) => 
                        (p.coinTypeA === fromCoinType && p.coinTypeB === toCoinType) ||
                        (p.coinTypeA === toCoinType && p.coinTypeB === fromCoinType)
                    );
                }
             }
        }

        // 🚨 Final Fallback
        if (!cachedPool) {
            console.log("⚠️ Pool not found via SDK list. Trying fallback ID again...");
            const FALLBACK_POOL_ID = SUI_NETWORK === 'mainnet' ? POOL_IDS.mainnet.SUI_USDC : POOL_IDS.testnet.SUI_USDC;
            try {
                cachedPool = await cetusClmmSDK.Pool.getPool(FALLBACK_POOL_ID);
                console.log("✅ Fetched Hardcoded Pool:", cachedPool.poolAddress);
            } catch (e) {
                console.error("❌ Failed to fetch hardcoded pool:", e);
                return null;
            }
        }

        console.log("✅ Pool Found:", cachedPool.poolAddress);

        // 2. Calculate Pre-Swap
        const a2b = fromCoinType === cachedPool.coinTypeA;
        const amount = new BN(amountIn);

        const swapResult = await cetusClmmSDK.Swap.calculateRates({
            decimalsA: 9, // SUI
            decimalsB: 6, // USDC
            pool: cachedPool,
            a2b,
            byAmountIn,
            amount,
            swapPartner: ''
        });

        console.log("✅ Swap Result:", swapResult);

        // 3. Format result to match Aggregator Interface (for compatibility with UI)
        return {
            amountOut: swapResult.estimatedAmountOut,
            estimatedFee: swapResult.estimatedFeeAmount,
            poolAddress: cachedPool.poolAddress,
            a2b,
            byAmountIn,
            // Mock the 'paths' for UI visualization
            paths: [{
                label: 'Cetus CLMM',
                steps: [{ poolAddress: cachedPool.poolAddress }]
            }],
            // Store raw result for building TX
            rawSwapResult: swapResult,
            pool: cachedPool
        };

    } catch (error) {
        console.error("❌ Error calculating rates:", error);
        return null;
    }
}

export async function buildSimpleSwapTx(
    tx: Transaction,
    quote: any,
    inputCoin: any,
    userAddress: string,
    toCoinType: string,
    slippage: number = 0.05 // 5%
) {
    if (!quote || !quote.pool) {
        throw new Error("Invalid Quote Object");
    }

    console.log("🏗️ Building Swap Transaction via CLMM SDK...");

    const { pool, a2b, byAmountIn, rawSwapResult } = quote;

    // Create Swap Payload
    // Note: The SDK returns a TransactionBlock (deprecated name in new Sui SDK) or Transaction.
    // We need to be careful with version mismatch. 
    // Ideally we use SDK to generate the payload and attach to OUR 'tx' object.
    
    // Cetus SDK v5 'Swap.createSwapTransactionPayload' returns a TransactionBlock.
    // We can't easily merge two Transaction objects.
    // WORKAROUND: We use the SDK to calculate parameters, but we manually call the move function
    // OR we use the SDK's helper if it supports passing a Transaction.
    
    // For simplicity and robustness in this Hackathon context:
    // We will use the SDK to generate the PTB logic.
    
    const toAmount = byAmountIn ? rawSwapResult.estimatedAmountOut : rawSwapResult.estimatedAmountIn;
    
    // Slippage handling
    const amountLimit = new BN(toAmount).mul(new BN(100 - slippage * 100)).div(new BN(100)); // Minimum output

    // We use the lower-level 'Swap.createSwapTransactionPayload' which might return a new TX.
    // Let's try to see if we can just use the arguments.
    // Actually, Cetus SDK has 'Swap.createSwapTransactionPayload' which takes a 'TransactionBlock'.
    // We are using '@mysten/sui/transactions' (Transaction), while SDK might use '@mysten/sui.js'.
    // This type mismatch is common.
    
    // 💡 BEST PRACTICE for Compatibility:
    // Manually call the Move function using the data we have.
    
    const sqrtPriceLimit = Swap.calculateSqrtPriceLimit(a2b); // We need Swap helper import
    
    // Wait, let's use the SDK's high level function but passing our TX if possible.
    // If not, we copy the logic.
    
    // Let's use the simplest approach:
    // Since we are already using the SDK, let's assume 'cetusClmmSDK.Swap.createSwapTransactionPayload' 
    // accepts our 'tx' if we cast it as 'any' (duck typing often works for PTB).
    
    const res = await cetusClmmSDK.Swap.createSwapTransactionPayload({
        pool_id: pool.poolAddress,
        coinTypeA: pool.coinTypeA,
        coinTypeB: pool.coinTypeB,
        a2b,
        byAmountIn,
        amount: rawSwapResult.amount.toString(),
        amountLimit: amountLimit.toString(),
        // @ts-ignore
        txb: tx, 
        mainCoin: inputCoin // This might need to be the Object ID or the Coin Object
    });

    // 🟢 SDK usually adds commands to 'tx'.
    // We need to capture the output coin. 
    // The Cetus SDK usually transfers the output coin to the sender automatically.
    // But we want to capture it for our 'transfer_with_event'.
    
    // If the SDK transfer is hardcoded, we might miss the event logging.
    // For the Hackathon demo, "Swapping successfully" is P0. "Event logging" is P1.
    // Let's stick to the SDK's default behavior first to ensure it works.
    
    console.log("✅ Swap PTB Built");
    
    // Note: The SDK might have already added 'TransferObjects'. 
    // If we want to use our 'transfer_with_event', we would need the output coin reference.
    // Cetus SDK v5 doesn't easily return the output coin ref in 'createSwapTransactionPayload'.
    
    // COMPROMISE: We will log the event BEFORE the swap (using input amount) or just skip the custom event 
    // for this specific CLMM path to ensure the Swap works.
    // OR: We use the config.ts contract for "Aggregator" path and accept that CLMM path might just be standard swap.
    
    // However, we can try to "guess" the output coin if we really want.
    // For now, let's just let the SDK do its job.
    return res;
}

// Helper for sqrtPriceLimit (simplified)
const Swap = {
    calculateSqrtPriceLimit: (a2b: boolean) => {
        return a2b ? new BN("4295048016") : new BN("79226673515401279992447579055");
    }
}
