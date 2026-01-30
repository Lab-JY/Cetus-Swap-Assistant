/* eslint-disable @typescript-eslint/no-explicit-any */
import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk";
import { initCetusSDK, TickMath } from "@cetusprotocol/cetus-sui-clmm-sdk";
import { Transaction } from "@mysten/sui/transactions";
import BN from "bn.js";
import { TOKENS, SUI_NETWORK, POOL_IDS } from "./config";

export { SUI_NETWORK }; // Re-export for frontend use

// 🌟 Initialize Cetus Aggregator SDK
const aggregator = new AggregatorClient({
    endpoint: SUI_NETWORK === 'mainnet' ? 'https://api-sui.cetus.zone/router_v3/find_routes' : undefined,
    env: SUI_NETWORK === 'mainnet' ? Env.Mainnet : Env.Testnet
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
    byAmountIn: boolean = true
) {
    console.log(`🔍 Quote: ${amountIn} ${fromCoinType} -> ${toCoinType}`);
    const amount = new BN(amountIn);

    try {
        // 1️⃣ Try Aggregator First (Only on Mainnet)
        // The Aggregator SDK v1.4.3 currently throws "CetusRouter only supported on mainnet" 
        // when executing routerSwap on Testnet. So we skip it on Testnet.
        if (SUI_NETWORK === 'mainnet') {
            console.log("Trying Aggregator...");
            const router = await aggregator.findRouters({
                from: fromCoinType,
                target: toCoinType,
                amount: amount,
                byAmountIn: byAmountIn,
            });

            if (router) {
                console.log("✅ Aggregator Route Found:", {
                    amountOut: router.amountOut.toString(),
                    splitPaths: router.paths?.length
                });
                return {
                    amountOut: router.amountOut,
                    estimatedFee: 0,
                    router: router, 
                    source: 'aggregator',
                    paths: router.paths ? router.paths.map((r: any) => ({ label: `Path`, steps: [] })) : [],
                    rawSwapResult: router
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
        // Identify Pool ID based on token pair (Simplified for SUI-USDC demo)
        let poolAddress = '';
        if ((fromCoinType === TOKENS.SUI && toCoinType === TOKENS.USDC) || 
            (fromCoinType === TOKENS.USDC && toCoinType === TOKENS.SUI)) {
            poolAddress = POOL_IDS[SUI_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'].SUI_USDC;
        }

        if (!poolAddress) {
            console.error("❌ No direct pool configured for this pair.");
            return null;
        }

        const pool = await cetusClmm.Pool.getPool(poolAddress);
        // Use preswap which handles tick fetching or simple estimation
        const res = await cetusClmm.Swap.preswap({
            pool: pool,
            currentSqrtPrice: pool.current_sqrt_price,
            decimalsA: 9,
            decimalsB: 6,
            a2b: fromCoinType === TOKENS.SUI,
            byAmountIn: byAmountIn,
            amount: amount.toString(),
            coinTypeA: pool.coinTypeA,
            coinTypeB: pool.coinTypeB
        });

        if (!res) {
            console.error("❌ Direct Pool Quote returned null");
            return null;
        }

        console.log("✅ Direct Pool Quote Found:", res.estimatedAmountOut.toString());

        return {
            amountOut: new BN(res.estimatedAmountOut),
            estimatedFee: res.estimatedFeeAmount,
            router: null,
            source: 'clmm',
            poolAddress: poolAddress,
            a2b: fromCoinType === TOKENS.SUI,
            paths: [{ label: 'Direct Pool', steps: [] }],
            rawSwapResult: res
        };

    } catch (error) {
        console.error("❌ Error finding direct quote:", error);
        return null;
    }
}

export async function buildSimpleSwapTx(
    tx: Transaction,
    quote: any,
    inputCoin: any,
    userAddress: string,
    toCoinType: string,
    slippage: number = 0.05
): Promise<Transaction> {
    if (!quote) throw new Error("Invalid Quote Object");

    console.log(`🏗️ Building Swap Transaction via ${quote.source === 'aggregator' ? 'Aggregator' : 'CLMM'}...`);

    if (quote.source === 'aggregator') {
        const { router } = quote;
        await aggregator.routerSwap({
            router: router,
            txb: tx as any,
            inputCoin: inputCoin,
            slippage: slippage,
        });
        return tx;
    } else {
        // CLMM Direct Swap
        const pool = await cetusClmm.Pool.getPool(quote.poolAddress);
        const toAmount = new BN(quote.amountOut);
        const amountLimit = adjustForSlippage(toAmount, slippage, !quote.a2b);

        // createSwapTransactionPayload creates a NEW transaction
        const newTx = await cetusClmm.Swap.createSwapTransactionPayload({
            pool_id: pool.poolAddress,
            a2b: quote.a2b,
            by_amount_in: quote.rawSwapResult.byAmountIn,
            amount: quote.rawSwapResult.amount,
            amount_limit: amountLimit.toString(), 
            coinTypeA: pool.coinTypeA,
            coinTypeB: pool.coinTypeB,
        });
        return newTx;
    }
}

function adjustForSlippage(amount: BN, slippage: number, isMax: boolean): BN {
    const slippageBN = new BN(Math.floor(slippage * 10000));
    const base = new BN(10000);
    if (isMax) {
        return amount.mul(base.add(slippageBN)).div(base);
    } else {
        return amount.mul(base.sub(slippageBN)).div(base);
    }
}
