import { NextResponse } from 'next/server';
import { getHealthySuiClient } from '@/utils/rpc';

type CacheEntry = {
  ts: number;
  data: unknown;
};

const CACHE_TTL_MS = 5_000;
const cache = new Map<string, CacheEntry>();

const clampLimit = (value: string | null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(200, Math.trunc(parsed)));
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventType = (searchParams.get('eventType') || '').trim();
  const limit = clampLimit(searchParams.get('limit'));

  if (!eventType) {
    return NextResponse.json({ error: 'eventType is required' }, { status: 400 });
  }

  const cacheKey = `${eventType}:${limit}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const { client, url } = await getHealthySuiClient();
    const data = await client.queryEvents({
      query: { MoveEventType: eventType },
      limit,
      order: 'descending'
    });
    const payload = { ...data, _source: url };
    cache.set(cacheKey, { ts: now, data: payload });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to query events';
    if (cached) {
      return NextResponse.json({ ...(cached.data as object), stale: true, error: message });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
