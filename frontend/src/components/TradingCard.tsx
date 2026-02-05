import React from 'react';
import { Share2, TrendingUp, Award, Users } from 'lucide-react';

export interface TradingCardData {
  trader: {
    address: string;
    nickname?: string;
    rank?: number;
    winRate?: number;
  };
  trade: {
    from: string;
    to: string;
    amount: string;
    value: string;
    valueChangePercent?: number;
    valueLabel?: string;
    route: string[];
    timestamp: number;
  };
  stats?: {
    totalTrades?: number;
    totalVolume?: string;
    followers?: number;
  };
}

interface TradingCardProps {
  data: TradingCardData;
  onShare?: () => void;
}

export default function TradingCard({ data, onShare }: TradingCardProps) {
  const { trader, trade, stats } = data;
  const changePercent = trade.valueChangePercent;
  const hasChange = typeof changePercent === 'number';
  const isPositive = hasChange ? changePercent >= 0 : true;

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200 p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {trader.nickname?.[0] || trader.address[2]}
          </div>
          <div>
            <div className="font-semibold text-gray-900">
              {trader.nickname || formatAddress(trader.address)}
            </div>
            {trader.rank && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Award className="w-4 h-4 text-yellow-500" />
                <span>#{trader.rank} 交易者</span>
              </div>
            )}
          </div>
        </div>
        {onShare && (
          <button
            onClick={onShare}
            className="p-2 hover:bg-white rounded-lg transition-colors"
            title="分享交易"
          >
            <Share2 className="w-5 h-5 text-gray-600" />
          </button>
        )}
      </div>

      {/* Trade Info */}
      <div className="bg-white rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-600">交易</div>
          <div className="text-xs text-gray-500">{formatDate(trade.timestamp)}</div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg font-semibold max-w-[160px] truncate" title={trade.from}>{trade.from}</span>
          <span className="text-gray-400">→</span>
          <span className="text-lg font-semibold max-w-[160px] truncate" title={trade.to}>{trade.to}</span>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-gray-600">数量</div>
            <div className="font-semibold">{trade.amount}</div>
          </div>
          <div className="text-right">
          <div className="text-sm text-gray-600">{trade.valueLabel || '成交额'}</div>
          <div className={`font-bold text-lg ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trade.value}{hasChange ? ` (${isPositive ? '+' : ''}${changePercent!.toFixed(2)}%)` : ''}
          </div>
        </div>
      </div>

        {/* Route */}
        {trade.route.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-600 mb-1">路由</div>
            <div className="flex items-center gap-1 flex-wrap">
              {trade.route.map((dex, index) => (
                <React.Fragment key={index}>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded max-w-[140px] truncate" title={dex}>
                    {dex}
                  </span>
                  {index < trade.route.length - 1 && (
                    <span className="text-gray-400">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {stats.totalTrades !== undefined && (
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-xs text-gray-600 mb-1">总交易</div>
              <div className="font-bold text-lg">{stats.totalTrades}</div>
            </div>
          )}
          {trader.winRate !== undefined && (
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-xs text-gray-600 mb-1">成功率</div>
              <div className="font-bold text-lg text-green-600">{trader.winRate}%</div>
            </div>
          )}
          {stats.followers !== undefined && (
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-xs text-gray-600 mb-1">最近事件</div>
              <div className="font-bold text-lg flex items-center justify-center gap-1">
                <Users className="w-4 h-4" />
                {stats.followers}
              </div>
            </div>
          )}
          {stats.totalVolume !== undefined && (
            <div className="bg-white rounded-lg p-3 text-center">
              <div className="text-xs text-gray-600 mb-1">总成交量</div>
              <div className="font-bold text-lg">{stats.totalVolume}</div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-blue-200 flex items-center justify-between">
        <div className="text-xs text-gray-600">
          🤖 Cetus Swap Assistant
        </div>
        <div className="flex items-center gap-1 text-xs text-green-600">
          <TrendingUp className="w-3 h-3" />
          <span>成功交易</span>
        </div>
      </div>
    </div>
  );
}
