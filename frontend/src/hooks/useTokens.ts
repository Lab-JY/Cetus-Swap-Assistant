import { useState, useEffect } from 'react';
import { SUI_NETWORK } from '@/utils/config';

export type TokenInfo = {
  symbol: string;
  name: string;
  type: string;
  decimals: number;
  icon: string;
  verified?: boolean;
};

// Default tokens to show while loading or as fallback
const DEFAULT_TOKENS: TokenInfo[] = SUI_NETWORK === 'mainnet' 
  ? [
      { symbol: 'SUI', name: 'Sui', type: '0x2::sui::SUI', decimals: 9, icon: '💧' },
      { symbol: 'USDC', name: 'USD Coin', type: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC', decimals: 6, icon: '💵' },
      { symbol: 'CETUS', name: 'Cetus Token', type: '0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS', decimals: 9, icon: '🌊' },
    ]
  : [
      { symbol: 'SUI', name: 'Sui', type: '0x2::sui::SUI', decimals: 9, icon: '💧' },
      { symbol: 'MEME', name: 'Meme Token', type: '0x5bab1e6852a537a8b07edd10ed9bc2e41d9c75b2ada472bc9bd6bed14000563b::meme_token::MEME_TOKEN', decimals: 9, icon: '🐸' },
      { symbol: 'USDC', name: 'USD Coin', type: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC', decimals: 6, icon: '💵' },
      { symbol: 'CETUS', name: 'Cetus Token', type: '0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS', decimals: 9, icon: '🌊' },
    ];

// GitHub Raw URL for SUI Token List (Community Maintained)
// This is a more reliable source than the API endpoint which may change
const TOKEN_LIST_URL = 'https://raw.githubusercontent.com/suiet/sui-coin-list/main/src/coins.json';

export function useTokens() {
  const [tokens, setTokens] = useState<TokenInfo[]>(DEFAULT_TOKENS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setLoading(true);
        // Use a simple timeout wrapper to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(TOKEN_LIST_URL, { signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (!response.ok) throw new Error(`Failed to fetch token list: ${response.statusText}`);
          
          const data = await response.json();
          // GitHub JSON format is an array directly
          const list = Array.isArray(data) ? data : (data.data?.list || []);
          
          if (Array.isArray(list) && list.length > 0) {
            // Map API response to our TokenInfo format
            const apiTokens = list.map((t: { symbol: string; name: string; coin_type: string; decimals: number; icon_url?: string }) => ({
              symbol: t.symbol,
              name: t.name,
              type: t.coin_type, // GitHub list uses 'coin_type'
              decimals: t.decimals,
              icon: t.icon_url || '',
              verified: true
            }));

            // Merge with default tokens to ensure core tokens are always present and correct
            // We prioritize API data but keep our reliable defaults if API misses them
            const tokenMap = new Map();
            
            // Add API tokens first
            apiTokens.forEach((t: TokenInfo) => tokenMap.set(t.type, t));
            
            // Ensure defaults exist (override if needed, or keep defaults if API is weird)
            DEFAULT_TOKENS.forEach(t => {
              if (!tokenMap.has(t.type)) {
                tokenMap.set(t.type, t);
              }
            });

            // Convert back to array and sort: SUI first, then verified, then others
            const mergedTokens = Array.from(tokenMap.values()).sort((a: TokenInfo, b: TokenInfo) => {
               if (a.symbol === 'SUI') return -1;
               if (b.symbol === 'SUI') return 1;
               if (a.symbol === 'USDC') return -1;
               if (b.symbol === 'USDC') return 1;
               return a.symbol.localeCompare(b.symbol);
            });

            setTokens(mergedTokens);
          }
        } catch (fetchErr) {
           console.warn("Token list API failed, using defaults.", fetchErr);
           // Silent fail, keep defaults
        }
      } catch (err) {
        console.error('Error in token fetch flow:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fallback to defaults is already set via initial state
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, []);

  return { tokens, loading, error };
}
