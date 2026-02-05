import React from 'react';
import { AlertCircle, TrendingUp, TrendingDown, Minus, Shield } from 'lucide-react';
import type { AIInsight } from '@/utils/aiInsights';

interface AIInsightCardProps {
  insight: AIInsight;
  fromToken: string;
  toToken: string;
}

export default function AIInsightCard({ insight, fromToken, toToken }: AIInsightCardProps) {
  const getActionIcon = () => {
    switch (insight.action) {
      case 'swap_now':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'wait':
        return <TrendingDown className="w-5 h-5 text-yellow-500" />;
      case 'caution':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Minus className="w-5 h-5 text-gray-500" />;
    }
  };

  const getActionText = () => {
    switch (insight.action) {
      case 'swap_now':
        return '建议立即交换';
      case 'wait':
        return '建议等待';
      case 'caution':
        return '谨慎操作';
      default:
        return '中性';
    }
  };

  const getActionColor = () => {
    switch (insight.action) {
      case 'swap_now':
        return 'bg-green-50 border-green-200';
      case 'wait':
        return 'bg-yellow-50 border-yellow-200';
      case 'caution':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getRiskColor = () => {
    switch (insight.riskLevel) {
      case 'low':
        return 'text-green-600 bg-green-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'high':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className={`rounded-lg border-2 p-4 ${getActionColor()}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getActionIcon()}
          <span className="font-semibold text-lg">{getActionText()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">置信度</span>
          <span className="font-bold text-lg">{insight.confidence}%</span>
        </div>
      </div>

      {/* AI Reasoning */}
      <div className="mb-3">
        <p className="text-sm text-gray-700">{insight.reasoning}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Risk Score */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600">风险评分</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">{insight.riskScore}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${getRiskColor()}`}>
              {insight.riskLevel === 'low' ? '低风险' : insight.riskLevel === 'medium' ? '中风险' : '高风险'}
            </span>
          </div>
        </div>

        {/* Price Target */}
        {insight.priceTarget && (
          <div className="bg-white rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">目标价格</div>
            <div className="text-xl font-bold">${insight.priceTarget.toFixed(2)}</div>
          </div>
        )}

        {/* Historical Accuracy */}
        {insight.historicalAccuracy && (
          <div className="bg-white rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">历史准确率</div>
            <div className="text-xl font-bold">{insight.historicalAccuracy}%</div>
          </div>
        )}
      </div>

      {/* AI Badge */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-600">AI 智能分析</span>
        </div>
        <span className="text-xs text-gray-500">
          {fromToken} → {toToken}
        </span>
      </div>
    </div>
  );
}
