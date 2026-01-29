import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk";
import { Transaction } from "@mysten/sui/transactions";
import BN from "bn.js";

// Configuration for Cetus Aggregator
// Note: Cetus Aggregator mainly runs on Mainnet. For Testnet, we might need to point to specific contracts or mock if not fully available.
// However, the hackathon usually implies Mainnet readiness or Testnet functional demo.
// We will assume Testnet usage for the hackathon context if possible, otherwise we default to Mainnet config but warn user.
// 
// UPDATE: Cetus Aggregator SDK often defaults to Mainnet. 
// We will try to configure it for Testnet if the SDK exports Env.Testnet, otherwise we keep Mainnet structure but use Testnet RPC.

export const SUI_COIN_TYPE = "0x2::sui::SUI";
export const CETUS_COIN_TYPE = "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS"; // Mainnet CETUS
// Testnet USDC (Example)
export const USDC_COIN_TYPE = "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN"; 

const client = new AggregatorClient(
    'https://fullnode.testnet.sui.io:443',
    // 使用有效的 Sui 地址 (例如 0x0)
    '0x0000000000000000000000000000000000000000000000000000000000000000', 
    Env.Testnet
);

export async function getSwapQuote(
    fromCoinType: string,
    toCoinType: string,
    amountIn: number, // Raw amount (e.g. 1000000 for 1 USDC)
    byAmountIn: boolean = true
) {
    const amount = new BN(amountIn);
    
    try {
        const routers = await client.findRouters({
            from: fromCoinType,
            target: toCoinType,
            amount,
            byAmountIn,
        });
        return routers;
    } catch (error) {
        console.error("Error finding routers:", error);
        return null;
    }
}

export async function buildSwapAndPayTx(
    tx: Transaction,
    routers: any, // The result from getSwapQuote
    inputCoin: any, // The coin object to swap
    targetMerchantAddress: string,
    slippage: number = 0.05 // 5%
) {
    if (!routers) throw new Error("No route found");

    // 1. Perform the Swap via Cetus Aggregator
    // routerSwap returns the target coin object
    // Note: The SDK method signature might have changed or I am using a newer version.
    // Based on the error 'Did you mean to write router?', I will use 'router'.
    const targetCoin = await client.routerSwap({
        router: routers,
        txb: tx,
        inputCoin,
        slippage,
    });

    // 2. Transfer the swapped coin to the merchant
    // In a real Pay scenario, we would call suipay::payment::pay_order here.
    // For now, we transfer the coin to the merchant's address.
    tx.transferObjects([targetCoin], tx.pure.address(targetMerchantAddress));
    
    return tx;
}

/**
 * Builds a swap transaction and returns the target coin object.
 * This is useful for PTBs (Programmable Transaction Blocks) where you want to do something 
 * with the swapped coin (e.g. split it and pay multiple people)
 */
export async function buildSwapTx(
    tx: Transaction,
    routers: any,
    inputCoin: any,
    slippage: number = 0.05
) {
    if (!routers) throw new Error("No route found");

    const targetCoin = await client.routerSwap({
        router: routers,
        txb: tx,
        inputCoin,
        slippage,
    });

    return targetCoin;
}
