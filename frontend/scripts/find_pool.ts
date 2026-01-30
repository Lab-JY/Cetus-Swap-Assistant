import { initCetusSDK } from "@cetusprotocol/cetus-sui-clmm-sdk";

const SUI_TESTNET = "https://fullnode.testnet.sui.io:443";
const sdk = initCetusSDK({ network: "testnet", fullNodeUrl: SUI_TESTNET });

const SUI = "0x2::sui::SUI";
const NATIVE_USDC = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC"; 
const WORMHOLE_USDC = "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN";

async function findPool(coinA: string, coinB: string, name: string) {
    console.log(`Searching for ${name} Pool...`);
    try {
        const pools: any = await sdk.Pool.getPoolsWithPage([], { limit: 50 });
        
        const matches = pools.filter((p: any) => {
            return (p.coinTypeA === coinA && p.coinTypeB === coinB) || 
                   (p.coinTypeA === coinB && p.coinTypeB === coinA);
        });

        if (matches.length > 0) {
            console.log(`✅ Found ${name} Pool: ${matches[0].poolAddress}`);
            return matches[0].poolAddress;
        } else {
            console.log(`❌ No ${name} pool found in first 50 results.`);
            return null;
        }
    } catch (e) {
        console.error("Error searching pool:", e);
        return null;
    }
}

async function main() {
    await findPool(SUI, NATIVE_USDC, "SUI-NativeUSDC");
    await findPool(SUI, WORMHOLE_USDC, "SUI-WormholeUSDC");
}

main();
