import { getSwapQuote } from './cetus';
import { SUI_NETWORK } from './config';

type QuoteParams = {
  fromCoinType: string;
  toCoinType: string;
  amountIn: string | number;
  userAddress: string;
  byAmountIn?: boolean;
};

type QuoteResponse = {
  error?: boolean;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
};

type CacheEntry = {
  value: QuoteResponse;
  ts: number;
};

const CACHE_TTL_MS = Number(process.env.NEXT_PUBLIC_QUOTE_CACHE_TTL_MS || 5000);
const quoteCache = new Map<string, CacheEntry>();

const makeKey = (params: QuoteParams) => {
  return [
    SUI_NETWORK,
    params.fromCoinType,
    params.toCoinType,
    params.amountIn,
    params.userAddress,
    params.byAmountIn !== false ? 'in' : 'out',
  ].join('|');
};

export async function getQuoteWithCache(params: QuoteParams) {
  const now = Date.now();
  const key = makeKey(params);
  const cached = quoteCache.get(key);

  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return {
      ...cached.value,
      meta: {
        ...(cached.value?.meta || {}),
        cache: { hit: true, ageMs: now - cached.ts, ttlMs: CACHE_TTL_MS },
      },
    };
  }

  const value: QuoteResponse = await getSwapQuote(
    params.fromCoinType,
    params.toCoinType,
    params.amountIn,
    params.userAddress,
    params.byAmountIn !== false
  );

  if (value && !value.error) {
    quoteCache.set(key, { value, ts: now });
  }

  return {
    ...value,
    meta: {
      ...(value?.meta || {}),
      cache: { hit: false, ageMs: 0, ttlMs: CACHE_TTL_MS },
    },
  };
}

export function clearQuoteCache() {
  quoteCache.clear();
}
