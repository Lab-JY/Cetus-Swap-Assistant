
// 🛠️ Global Configuration for Cetus Swap
// Centralized constants to avoid duplication and ensure consistency across the app.

// 🟢 Smart Contract Deployment Details
export const CETUS_SWAP_PACKAGE_ID = process.env.NEXT_PUBLIC_CETUS_SWAP_PACKAGE_ID || '0x0';

// 🌐 Network Configuration
// Default to Mainnet unless NEXT_PUBLIC_SUI_NETWORK is set to 'testnet'
export const SUI_NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK === 'testnet') ? 'testnet' : 'mainnet';

export const SUI_EXPLORER_URL = SUI_NETWORK === 'mainnet' 
    ? 'https://suiscan.xyz/mainnet' 
    : 'https://suiscan.xyz/testnet';

// 💰 Token Configuration
const MAINNET_TOKENS = {
    SUI: '0x2::sui::SUI',
    USDC: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC', // Native USDC
    CETUS: '0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS',
    wUSDC: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN' // Wormhole USDC
};

const TESTNET_TOKENS = {
    SUI: '0x2::sui::SUI',
    USDC: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
    CETUS: '0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS',
    wUSDC: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN'
};

export const TOKENS = SUI_NETWORK === 'mainnet' ? MAINNET_TOKENS : TESTNET_TOKENS;

// 🏊 Pool Configuration
export const POOL_IDS = {
    mainnet: {
        SUI_USDC: '' // Leave empty to force dynamic discovery
    },
    testnet: {
        SUI_USDC: '' // Leave empty to force dynamic discovery via SDK
    }
};
