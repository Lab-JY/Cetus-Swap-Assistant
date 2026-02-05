import { NextResponse } from 'next/server';

const COINGECKO_IDS: Record<string, string[]> = {
  SUI: ['sui'],
  CETUS: ['cetus-protocol'],
  USDC: ['usdc', 'usd-coin'],
  WUSDC: ['usdc', 'usd-coin'],
  wUSDC: ['usdc', 'usd-coin'],
};

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_DEMO_KEY = process.env.COINGECKO_DEMO_KEY;

type CacheEntry = {
  ts: number;
  data: unknown;
};

const CACHE_TTL_MS = 30 * 1000;
const cache = new Map<string, CacheEntry>();

const getIds = (symbol: string) => {
  const key = symbol.toUpperCase();
  return COINGECKO_IDS[key] || [];
};

const getHeaders = () => {
  const headers: Record<string, string> = {
    accept: 'application/json',
  };
  if (COINGECKO_API_KEY) headers['x-cg-pro-api-key'] = COINGECKO_API_KEY;
  if (COINGECKO_DEMO_KEY) headers['x-cg-demo-api-key'] = COINGECKO_DEMO_KEY;
  return headers;
};

const fetchSpot = async (coinId: string) => {
  const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`;
  const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch spot price for ${coinId} (status ${res.status}): ${body}`);
  }
  return res.json();
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || '';
  const ids = getIds(symbol);
  if (ids.length === 0) {
    return NextResponse.json({ data: null });
  }

  const cacheKey = `spot:${symbol.toUpperCase()}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  let lastError: Error | undefined;
  for (const id of ids) {
    try {
      const data = await fetchSpot(id);
      const price = data?.[id]?.usd;
      if (typeof price === 'number') {
        const payload = { data: price };
        cache.set(cacheKey, { ts: now, data: payload });
        return NextResponse.json(payload);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error');
    }
  }

  if (cached) {
    return NextResponse.json({ ...(cached.data as object), stale: true });
  }

  return NextResponse.json({ error: lastError?.message || 'Failed to fetch spot price' }, { status: 502 });
}
