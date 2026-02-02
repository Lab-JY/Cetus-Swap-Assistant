
// 🛠️ Global Configuration for Cetus Swap
// Centralized constants to avoid duplication and ensure consistency across the app.

// 🟢 Smart Contract Deployment Details
export const CETUS_SWAP_PACKAGE_ID = process.env.NEXT_PUBLIC_CETUS_SWAP_PACKAGE_ID || '0x39ef07af8dd8da1ecf5a6156807250c0d36ddeeed77cdd6147cf2a3e8873b6f9';

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
    wUSDC: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
    MEME: '0x5bab1e6852a537a8b07edd10ed9bc2e41d9c75b2ada472bc9bd6bed14000563b::meme_token::MEME_TOKEN',
    IDOL_APPLE: '0xb8adb26867c2dfecdbd7c309754b1e6cc15a0bbe767d28fc28bece56ad991d4c::idol_apple_1767616383788::IDOL_APPLE_1767616383788',
    IDOL_DGRAN: '0xbe4c4cc55d3aaa1a9c01f17b88199b06b96c032fc698184ea71235260f1d6d4c::idol_dgran_1767614261042::IDOL_DGRAN_1767614261042'
};

export const TOKENS = SUI_NETWORK === 'mainnet' ? MAINNET_TOKENS : TESTNET_TOKENS;

// 🏊 Pool Configuration
export const POOL_IDS = {
    mainnet: {
        SUI_USDC: '0xcf994611fd4c48e277ce3ffd4d4364c914af2c3cbb05f7bf6facd371de688630',
        SUI_CETUS: '0x2e98f676770defc69df186d02e74d5bfc9604606e8ccff6ffee471d8a050be3e',
        USDC_CETUS: '0x238f7e4648e3731d5a0860f8ad9b1f7ab0d28ff3397e4829f13ecf3428919233'
    },
    testnet: {
        SUI_MEME: '0xf0063e22499ea84c19a956a0eadf73b009f531121b6b38d28375a4a437dabc10', // SUI-MEME_TOKEN
        SUI_IDOL_APPLE: '0x2d925ce19a9d61e1c40671e039e6b5cbe39173e715748d5483bdb9e35c37d848', // SUI-IDOL_APPLE
        SUI_IDOL_DGRAN: '0x81d7139b1ddce0fbd4166360de442f45519dee3a1ba860ba8c62b4d7ecd4f593'  // SUI-IDOL_DGRAN
    }
};
