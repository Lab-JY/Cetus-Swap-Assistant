/* eslint-disable @typescript-eslint/no-explicit-any */
import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk";
import { Transaction } from "@mysten/sui/transactions";
import BN from "bn.js";
import { TOKENS, SUI_NETWORK } from "./config";

// 🌟 Initialize Cetus Aggregator SDK
// Aggregator Client handles Path Finding, Multi-hop Routing, and Transaction Building.
// It is the standard way to swap on Cetus now.
const aggregatorURL = SUI_NETWORK === 'mainnet' 
    ? 'https://api-sui.cetus.zone/router_v3/find_routes' 
    : 'https://api-sui.cetus.zone/router_v3/find_routes'; // Using v3 endpoint, assuming it handles testnet or we need specific one.

// Note: For Testnet, Cetus Aggregator support might be limited. 
// If this URL doesn't work for testnet, we might need to fallback to direct client or find the specific testnet API.
// But based on docs, v3 is the way to go.

const aggregator = new AggregatorClient({
    endpoint: aggregatorURL,
    env: SUI_NETWORK === 'mainnet' ? Env.Mainnet : Env.Testnet
});

export const SUI_COIN_TYPE = TOKENS.SUI;
export const CETUS_COIN_TYPE = TOKENS.CETUS; 
export const USDC_COIN_TYPE = TOKENS.USDC; 
export const WUSDC_COIN_TYPE = TOKENS.wUSDC; 

export async function getSwapQuote(
    fromCoinType: string,
    toCoinType: string,
    amountIn: number, 
    byAmountIn: boolean = true
) {
    console.log(`🔍 Aggregator Quote: ${amountIn} ${fromCoinType} -> ${toCoinType}`);

    try {
        // Use Aggregator to find the best route
        // This automatically handles multi-hop (e.g. A -> SUI -> B) and split paths.
        const amount = new BN(amountIn);
        
        const router = await aggregator.findRouters({
            from: fromCoinType,
            target: toCoinType, // 'target' is the correct parameter name in Aggregator SDK
            amount: amount,
            byAmountIn: byAmountIn,
        });

        if (!router) {
            console.error("❌ No route found via Aggregator.");
            return null;
        }

        console.log("✅ Route Found:", {
            amountOut: router.amountOut.toString(),
            splitPaths: router.paths?.length
        });

        // Format result to match our UI expectations
        // We might need to adapt the UI if it expects a single 'pool' object.
        // But for 'buildSimpleSwapTx', we will use the router object directly.
        return {
            amountOut: router.amountOut,
            estimatedFee: 0, // router.totalFee not directly available in V3 type or named differently
            // Aggregator returns 'routes', not a single pool.
            // We pass the whole router object as 'rawSwapResult' or similar.
            router: router, 
            a2b: false, // Not relevant for multi-hop
            byAmountIn,
            // Mock paths for UI visualization (Aggregator routes are complex)
            paths: router.paths ? router.paths.map((r: any) => ({
                label: `Path`,
                steps: [] // Simplify for now to avoid V3 structure mismatch issues
            })) : [],
            rawSwapResult: router // Pass the router response for building TX
        };

    } catch (error) {
        console.error("❌ Error finding routes:", error);
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
    if (!quote || !quote.router) {
        throw new Error("Invalid Quote Object: Missing Router Data");
    }

    console.log("🏗️ Building Swap Transaction via Aggregator SDK...");

    const { router } = quote;

    // Use Aggregator SDK to build the transaction
    // 'routerSwap' builds the PTB for us.
    // We need to pass the 'tx' object.
    
    // Note: aggregator.routerSwap might expect 'inputCoin' to be a list of coins or an object ID.
    // If inputCoin is a Coin object (from Move), we might need to handle it.
    // If it's just an ID or we are expected to let SDK fetch coins, it's different.
    // Usually in frontend we pass the input coin object ID.
    
    // Check if inputCoin is a string (ID) or object
    // For simplicity, let's assume inputCoin is the Coin Object or ID that we want to spend.
    
    await aggregator.routerSwap({
        router: router,
        txb: tx as any, // Cast to match SDK's expected TransactionBlock type
        inputCoin: inputCoin, // This usually needs to be a Coin object or ID. 
        slippage: slippage,
    });
    
    console.log("✅ Aggregator PTB Built");
}
