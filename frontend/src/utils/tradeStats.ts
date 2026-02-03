import { secureStorage } from './storage';

const STORAGE_KEY = 'cetus_trade_stats';
const STATS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type TradeStats = {
  totalTrades: number;
  successTrades: number;
  failedTrades: number;
  aggregatorTrades: number;
  clmmTrades: number;
  totalSavingsAbs: string; // atomic units
  totalSavingsPct: number; // sum of pct values
  savingsSamples: number;
  routeProviders: Record<string, number>;
  lastUpdated: number;
};

const defaultStats = (): TradeStats => ({
  totalTrades: 0,
  successTrades: 0,
  failedTrades: 0,
  aggregatorTrades: 0,
  clmmTrades: 0,
  totalSavingsAbs: '0',
  totalSavingsPct: 0,
  savingsSamples: 0,
  routeProviders: {},
  lastUpdated: Date.now(),
});

export const getTradeStats = (): TradeStats => {
  const stored = secureStorage.getItem<TradeStats>(STORAGE_KEY);
  return stored || defaultStats();
};

export const recordTrade = (input: {
  success: boolean;
  source: 'aggregator' | 'clmm';
  savingsAbs?: string;
  savingsPct?: number;
  providers?: string[];
}) => {
  const stats = getTradeStats();
  stats.totalTrades += 1;
  stats.lastUpdated = Date.now();

  if (input.success) {
    stats.successTrades += 1;
  } else {
    stats.failedTrades += 1;
  }

  if (input.source === 'aggregator') stats.aggregatorTrades += 1;
  if (input.source === 'clmm') stats.clmmTrades += 1;

  if (input.savingsAbs) {
    try {
      const current = BigInt(stats.totalSavingsAbs || '0');
      const add = BigInt(input.savingsAbs);
      stats.totalSavingsAbs = (current + add).toString();
    } catch {
      // ignore parse errors
    }
  }

  if (typeof input.savingsPct === 'number') {
    stats.totalSavingsPct += input.savingsPct;
    stats.savingsSamples += 1;
  }

  if (input.providers && input.providers.length > 0) {
    input.providers.forEach((provider) => {
      stats.routeProviders[provider] = (stats.routeProviders[provider] || 0) + 1;
    });
  }

  secureStorage.setItem(STORAGE_KEY, stats, STATS_TTL_MS);
  return stats;
};

export const getDerivedStats = () => {
  const stats = getTradeStats();
  const avgSavingsPct = stats.savingsSamples > 0 ? stats.totalSavingsPct / stats.savingsSamples : 0;
  return {
    ...stats,
    avgSavingsPct,
  };
};
