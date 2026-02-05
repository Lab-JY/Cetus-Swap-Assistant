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
const CACHE_MAX = Number(process.env.NEXT_PUBLIC_QUOTE_CACHE_MAX || 200);
const quoteCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<QuoteResponse>>();

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

const touchCacheEntry = (key: string, entry: CacheEntry) => {
  quoteCache.delete(key);
  quoteCache.set(key, entry);
};

const pruneCache = () => {
  if (CACHE_MAX <= 0) return;
  while (quoteCache.size > CACHE_MAX) {
    const oldestKey = quoteCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    quoteCache.delete(oldestKey);
  }
};

export async function getQuoteWithCache(params: QuoteParams) {
  const now = Date.now();
  const key = makeKey(params);
  const cached = quoteCache.get(key);

  if (cached && now - cached.ts < CACHE_TTL_MS) {
    touchCacheEntry(key, cached);
    return {
      ...cached.value,
      meta: {
        ...(cached.value?.meta || {}),
        cache: { hit: true, ageMs: now - cached.ts, ttlMs: CACHE_TTL_MS },
      },
    };
  }

  const existing = inFlight.get(key);
  if (existing) {
    const value = await existing;
    return {
      ...value,
      meta: {
        ...(value?.meta || {}),
        cache: { hit: false, shared: true, ageMs: 0, ttlMs: CACHE_TTL_MS },
      },
    };
  }

  const request = (async () => {
    const value: QuoteResponse = await getSwapQuote(
      params.fromCoinType,
      params.toCoinType,
      params.amountIn,
      params.userAddress,
      params.byAmountIn !== false
    );

    if (value && !value.error) {
      quoteCache.set(key, { value, ts: Date.now() });
      pruneCache();
    }

    return value;
  })();

  inFlight.set(key, request);
  let value: QuoteResponse;
  try {
    value = await request;
  } finally {
    inFlight.delete(key);
  }

  return {
    ...value,
    meta: {
      ...(value?.meta || {}),
      cache: { hit: false, shared: false, ageMs: 0, ttlMs: CACHE_TTL_MS },
    },
  };
}

export function clearQuoteCache() {
  quoteCache.clear();
}
