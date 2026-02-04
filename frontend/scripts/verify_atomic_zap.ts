
import { Transaction } from "@mysten/sui/transactions";
import { initCetusSDK } from "@cetusprotocol/cetus-sui-clmm-sdk";
import { buildSimpleSwapTx } from "../src/utils/cetus/tx-builder";
import BN from "bn.js";

// Initialize SDK (needed for internal references)
const sdk = initCetusSDK({
  network: "testnet",
  fullNodeUrl: "https://fullnode.testnet.sui.io:443"
});

async function main() {
  console.log("🧪 Starting Atomic Zap Verification...");

  // 1. Mock Data
  const userAddress = "0x1234567890123456789012345678901234567890123456789012345678901234";
  const fromCoin = "0x2::sui::SUI";
  const toCoin = "0x5bab1e6852a537a8b07edd10ed9bc2e41d9c75b2ada472bc9bd6bed14000563b::meme_token::MEME_TOKEN"; // MEME on Testnet
  const amountIn = "1000000000"; // 1 SUI
  const amountOut = "5000000000"; // Mock output

  // 2. Construct Synthetic Router Quote
  // This matches the structure we create in getSwapQuote when falling back to CLMM
  const syntheticPath = {
      id: "0xf0063e22499ea84c19a956a0eadf73b009f531121b6b38d28375a4a437dabc10", // Use real pool address as ID
      direction: true, // a2b
      provider: 'CETUS',
      from: fromCoin,
      target: toCoin,
      feeRate: 0,
      amountIn: amountIn,
      amountOut: amountOut,
      publishedAt: "0x622bf94c8095556221e3798242e7939c9ec6a5cdc59f90ee148dd0cc72e13480", // Testnet/Mainnet package ID
      extendedDetails: {
          poolAddress: "0xf0063e22499ea84c19a956a0eadf73b009f531121b6b38d28375a4a437dabc10", // Real SUI-MEME pool
          coinTypeA: fromCoin,
          coinTypeB: toCoin,
      }
  };

  const packages = new Map();
  packages.set("aggregator_v3", "0x61da681cf2af95cb214a71596b49e662290065536984ed7e06b47e701ef547e3");

  const syntheticRouterData = {
      quoteID: 'mock-synthetic-quote', // Fixed: Added quoteID
      amountIn: new BN(amountIn),
      amountOut: new BN(amountOut),
      byAmountIn: true,
      paths: [syntheticPath],
      path: [syntheticPath], // Fixed: Added path alias
      insufficientLiquidity: false,
      deviationRatio: 0,
      packages, // Fixed: Added aggregator_v3 package ID
  };

  const mockQuote = {
      source: 'aggregator', // 🎭 The masquerade
      isSynthetic: true,
      amountOut: amountOut,
      estimatedFee: 0,
      router: syntheticRouterData,
      selectedRoute: {
          router: syntheticRouterData,
          amountOut: amountOut
      },
      poolAddress: syntheticPath.extendedDetails.poolAddress,
      a2b: true
  };

  console.log("📋 Mock Synthetic Quote Created:", JSON.stringify(mockQuote, null, 2));

  // 3. Build Transaction
  const tx = new Transaction();
  // Mock input coin (split from gas)
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountIn)]);

  try {
      console.log("🚀 Attempting to build transaction with Synthetic Quote...");
      
      const finalTx = await buildSimpleSwapTx(
          tx,
          mockQuote,
          coin,
          userAddress,
          fromCoin,
          toCoin,
          0.05, // slippage
          true, // isZap
          "0x9999999999999999999999999999999999999999999999999999999999999999" // recipient
      );

      console.log("✅ Transaction Built Successfully!");
      console.log("   - Commands Count:", finalTx.getData().commands.length);
      
      // We expect commands for:
      // 1. SplitCoins (Mock setup)
      // 2. Aggregator Router Swap (which internally does transfers/moveCalls)
      // 3. Zap Transfer (our custom moveCall)
      // 4. Record Swap Event
      // 5. Mint Receipt (if enabled)
      
      const commands = finalTx.getData().commands;
      console.log("   - Commands:", commands.map(c => c.$kind));

  } catch (error) {
      console.error("❌ Transaction Build Failed:", error);
      process.exit(1);
  }
}

main().catch(console.error);
