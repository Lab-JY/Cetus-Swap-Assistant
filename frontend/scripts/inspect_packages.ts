
import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk";
import BN from "bn.js";

const aggregator = new AggregatorClient({
    endpoint: 'https://api-sui.cetus.zone/router_v3/find_routes',
    env: Env.Mainnet // Use Mainnet to ensure we find routes
});

async function main() {
  console.log("🔍 Fetching real route for structure inspection...");
  
  const SUI = "0x2::sui::SUI";
  const USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

  const routerData = await aggregator.findRouters({
      from: SUI,
      target: USDC,
      amount: new BN(1000000000),
      byAmountIn: true,
  });

  if (routerData) {
      console.log("✅ Router Data Found!");
      console.log("Packages:", JSON.stringify(routerData.packages, null, 2));
  } else {
      console.log("❌ No router data found.");
  }
}

main().catch(console.error);
