
import { initCetusSDK } from "@cetusprotocol/cetus-sui-clmm-sdk";

const sdk = initCetusSDK({
  network: "testnet",
  fullNodeUrl: "https://fullnode.testnet.sui.io:443"
});

async function main() {
  console.log("🔍 Searching for ANY SUI-USDC pool on Testnet...");
  
  let hasNext = true;
  let nextCursor = undefined;
  let allPools: any[] = [];

  // Fetch a few pages
  for (let i = 0; i < 5; i++) {
      if (!hasNext) break;
      const res = await sdk.Pool.getPoolsWithPage([], { limit: 100, cursor: nextCursor });
      allPools = [...allPools, ...res];
      hasNext = res.length === 100; // Rough check
      nextCursor = res[res.length - 1]?.poolAddress; // This might not be the correct cursor format for this SDK, usually it returns { data, nextCursor } but SDK type is array?
      // Actually getPoolsWithPage returns just an array in some versions, or data/cursor object in others. 
      // Let's assume array for now based on previous script output.
      if (res.length === 0) break;
  }

  const suiType = "0x2::sui::SUI";
  
  const usdcPools = allPools.filter(p => {
      const typeA = p.coinTypeA.toLowerCase();
      const typeB = p.coinTypeB.toLowerCase();
      const isSui = typeA.includes("::sui::sui") || typeB.includes("::sui::sui");
      const isUsdc = typeA.includes("::usdc::usdc") || typeB.includes("::usdc::usdc");
      return isSui && isUsdc;
  });

  if (usdcPools.length > 0) {
      console.log(`✅ Found ${usdcPools.length} SUI-USDC pools:`);
      usdcPools.forEach(p => {
          console.log(`- Pool: ${p.poolAddress}`);
          console.log(`  Pair: ${p.coinTypeA} <-> ${p.coinTypeB}`);
          console.log(`  Liquidity: ${p.liquidity}`);
      });
  } else {
      console.log("❌ No SUI-USDC pools found in first ~500 pools.");
  }
}

main().catch(console.error);
