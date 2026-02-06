import React from 'react';
import { Trophy, TrendingUp } from 'lucide-react';
import type { TradingCardData } from './TradingCard';

export interface LeaderboardEntry {
  rank: number;
  trader: {
    address: string;
    nickname?: string;
  };
  stats: {
    totalTrades: number;
    totalVolume: string;
    winRate: number;
    followers: number;
  };
  recentTrade?: TradingCardData['trade'];
}

interface TradingLeaderboardProps {
  entries: LeaderboardEntry[];
  onFollowTrader?: (address: string) => void;
}

export default function TradingLeaderboard({ entries, onFollowTrader }: TradingLeaderboardProps) {
  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (rank === 2) return 'bg-gray-100 text-gray-800 border-gray-300';
    if (rank === 3) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-blue-50 text-blue-800 border-blue-200';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <h3 className="text-xl font-bold">交易排行榜</h3>
      </div>

      {/* Leaderboard List */}
      {entries.length === 0 && (
        <div className="text-sm text-gray-500">暂无链上交易数据</div>
      )}
      <div className="space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.trader.address}
            className={`rounded-lg border-2 p-4 ${getRankColor(entry.rank)}`}
          >
            {/* Rank and Trader Info */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold">
                  {getRankBadge(entry.rank)}
                </div>
                <div>
                  <div className="font-semibold">
                    {entry.trader.nickname || `${entry.trader.address.slice(0, 6)}...${entry.trader.address.slice(-4)}`}
                  </div>
                  <div className="text-sm text-gray-600">
                    {entry.trader.address.slice(0, 10)}...
                  </div>
                </div>
              </div>
              {onFollowTrader && (
                <button
                  onClick={() => onFollowTrader(entry.trader.address)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  关注
                </button>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white rounded-lg p-2 text-center">
                <div className="text-xs text-gray-600 mb-1">总交易</div>
                <div className="font-bold">{entry.stats.totalTrades}</div>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <div className="text-xs text-gray-600 mb-1">总成交量</div>
                <div className="font-bold text-green-600">{entry.stats.totalVolume}</div>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <div className="text-xs text-gray-600 mb-1">成功率</div>
                <div className="font-bold">{entry.stats.winRate}%</div>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <div className="text-xs text-gray-600 mb-1">最近事件</div>
                <div className="font-bold">{entry.stats.followers}</div>
              </div>
            </div>

            {/* Recent Trade */}
            {entry.recentTrade && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-600 mb-2">最近交易</div>
                <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                    <span className="font-medium max-w-[140px] truncate" title={entry.recentTrade.from}>{entry.recentTrade.from}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium max-w-[140px] truncate" title={entry.recentTrade.to}>{entry.recentTrade.to}</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600 font-semibold">
                    <TrendingUp className="w-4 h-4" />
                    {entry.recentTrade.value}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200 text-center">
        <p className="text-sm text-gray-600">
          🏆 基于最近事件统计的活跃排名
        </p>
      </div>
    </div>
  );
}
