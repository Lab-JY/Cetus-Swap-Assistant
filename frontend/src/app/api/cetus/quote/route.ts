import { NextResponse } from 'next/server';
import { AggregatorClient, Env } from '@cetusprotocol/aggregator-sdk';
import BN from 'bn.js';

const SUI_NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK === 'testnet' ? 'testnet' : 'mainnet';

const aggregator = new AggregatorClient({
  endpoint: SUI_NETWORK === 'mainnet' ? 'https://api-sui.cetus.zone/router_v3' : undefined,
  env: SUI_NETWORK === 'mainnet' ? Env.Mainnet : Env.Testnet,
  pythUrls: ['https://hermes.pyth.network', 'https://hermes-beta.pyth.network'],
});

type CacheEntry = {
  ts: number;
  data: unknown;
};

const CACHE_TTL_MS = 3_000;
const cache = new Map<string, CacheEntry>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = (searchParams.get('from') || '').trim();
  const target = (searchParams.get('target') || '').trim();
  const amountRaw = (searchParams.get('amount') || '').trim();
  const byAmountIn = (searchParams.get('byAmountIn') || 'true').toLowerCase() !== 'false';

  if (!from || !target || !amountRaw) {
    return NextResponse.json({ error: 'from, target, amount are required' }, { status: 400 });
  }

  const cacheKey = `${from}:${target}:${amountRaw}:${byAmountIn}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const amount = new BN(amountRaw);
    const data = await aggregator.findRouters({
      from,
      target,
      amount,
      byAmountIn,
    });
    const payload = { data };
    cache.set(cacheKey, { ts: now, data: payload });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch aggregator routes';
    if (cached) {
      return NextResponse.json({ ...(cached.data as object), stale: true, error: message });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
