import { initCetusSDK } from "@cetusprotocol/cetus-sui-clmm-sdk";

const SUI_TESTNET = "https://fullnode.testnet.sui.io:443";
const sdk = initCetusSDK({ network: "testnet", fullNodeUrl: SUI_TESTNET });

const SUI = "0x2::sui::SUI";
const NATIVE_USDC = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";
const WORMHOLE_USDC = "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN";

interface Pool {
  poolAddress: string;
  coinTypeA: string;
  coinTypeB: string;
}

async function findPool(coinA: string, coinB: string, name: string) {
    console.log(`Searching for ${name} Pool...`);
    try {
        const pools: Pool[] = await sdk.Pool.getPoolsWithPage([], { limit: 500 });

        const matches = pools.filter((p: Pool) => {
            return (p.coinTypeA === coinA && p.coinTypeB === coinB) ||
                   (p.coinTypeA === coinB && p.coinTypeB === coinA);
        });

        if (matches.length > 0) {
            console.log(`✅ Found ${name} Pool: ${matches[0].poolAddress}`);
            return matches[0].poolAddress;
        } else {
            console.log(`❌ No ${name} pool found.`);
            return null;
        }
    } catch (e) {
        console.error("Error searching pool:", e);
        return null;
    }
}

async function listAllPools() {
    console.log("\n📋 Listing all available pools on Testnet...\n");
    try {
        const pools: Pool[] = await sdk.Pool.getPoolsWithPage([], { limit: 100 });
        console.log(`Total pools found: ${pools.length}\n`);

        pools.slice(0, 20).forEach((p: Pool, idx: number) => {
            console.log(`${idx + 1}. Pool ID: ${p.poolAddress}`);
            console.log(`   Coin A: ${p.coinTypeA}`);
            console.log(`   Coin B: ${p.coinTypeB}\n`);
        });
    } catch (e) {
        console.error("Error listing pools:", e);
    }
}

async function main() {
    await findPool(SUI, NATIVE_USDC, "SUI-NativeUSDC");
    await findPool(SUI, WORMHOLE_USDC, "SUI-WormholeUSDC");
    await listAllPools();
}

main();
