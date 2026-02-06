// AI Trading Insights - 智能交易洞察
// 提供基于历史数据和市场分析的交易建议

export interface AIInsight {
  action: 'swap_now' | 'wait' | 'caution';
  confidence: number; // 0-100
  reasoning: string;
  priceTarget?: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number; // 0-100
  historicalAccuracy?: number; // 过去预测准确率
}

export interface PriceData {
  timestamp: number;
  price: number;
  volume: number;
}

const COINGECKO_IDS: Record<string, string[]> = {
  SUI: ['sui'],
  CETUS: ['cetus-protocol'],
  USDC: ['usdc', 'usd-coin'],
  WUSDC: ['usdc', 'usd-coin'],
  wUSDC: ['usdc', 'usd-coin'],
};

const getCoinGeckoIds = (symbol: string): string[] => {
  const key = symbol.toUpperCase();
  return COINGECKO_IDS[key] || [];
};

export async function fetchPriceHistory(symbol: string): Promise<PriceData[]> {
  const ids = getCoinGeckoIds(symbol);
  if (ids.length === 0) return [];

  const res = await fetch(`/api/market/price-history?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Failed to fetch market chart for ${symbol}`);
  }
  const payload = await res.json();
  const data = payload?.data;
  const prices: Array<[number, number]> = data?.prices || [];
  const volumes: Array<[number, number]> = data?.total_volumes || [];

  return prices.map((item, idx) => {
    const volume = volumes[idx]?.[1] ?? 0;
    return {
      timestamp: item[0],
      price: item[1],
      volume,
    };
  });
}

export async function fetchSpotPrice(symbol: string): Promise<number | null> {
  const ids = getCoinGeckoIds(symbol);
  if (ids.length === 0) return null;

  const res = await fetch(`/api/market/spot?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Failed to fetch spot price for ${symbol}`);
  }
  const payload = await res.json();
  const price = payload?.data;
  return typeof price === 'number' ? price : null;
}

/**
 * 分析价格趋势
 */
function analyzePriceTrend(priceHistory: PriceData[]): {
  trend: 'bullish' | 'bearish' | 'neutral';
  volatility: number;
} {
  if (priceHistory.length < 2) {
    return { trend: 'neutral', volatility: 0 };
  }

  // 计算价格变化
  const priceChanges = priceHistory.slice(1).map((data, i) =>
    (data.price - priceHistory[i].price) / priceHistory[i].price
  );

  // 计算趋势（正值=上涨，负值=下跌）
  const avgChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;

  // 计算波动率（标准差）
  const variance = priceChanges.reduce((sum, change) =>
    sum + Math.pow(change - avgChange, 2), 0
  ) / priceChanges.length;
  const volatility = Math.sqrt(variance);

  const trend = avgChange > 0.02 ? 'bullish' : avgChange < -0.02 ? 'bearish' : 'neutral';

  return { trend, volatility };
}

/**
 * 计算风险评分
 */
function calculateRiskScore(
  volatility: number,
  liquidityDepth: number,
  priceImpact: number
): { score: number; level: 'low' | 'medium' | 'high' } {
  // 风险因素权重
  const volatilityWeight = 0.4;
  const liquidityWeight = 0.3;
  const priceImpactWeight = 0.3;

  // 归一化到 0-100
  const volatilityScore = Math.min(volatility * 1000, 100);
  const liquidityScore = Math.max(0, 100 - liquidityDepth);
  const priceImpactScore = Math.min(priceImpact * 100, 100);

  const score = Math.round(
    volatilityScore * volatilityWeight +
    liquidityScore * liquidityWeight +
    priceImpactScore * priceImpactWeight
  );

  const level = score < 30 ? 'low' : score < 60 ? 'medium' : 'high';

  return { score, level };
}

/**
 * 生成 AI 交易洞察
 */
export async function generateAIInsight(
  fromToken: string,
  toToken: string,
  amount: number,
  priceHistory: PriceData[] = [],
  currentPrice?: number,
  liquidityDepth: number = 50, // 0-100
  estimatedSlippage: number = 0.005 // 0.5%
): Promise<AIInsight> {
  // 分析价格趋势
  const { trend, volatility } = analyzePriceTrend(priceHistory);

  // 计算风险评分
  const { score: riskScore, level: riskLevel } = calculateRiskScore(
    volatility,
    liquidityDepth,
    estimatedSlippage
  );

  // 生成建议
  let action: AIInsight['action'] = 'swap_now';
  let confidence = 70;
  let reasoning = '';
  let priceTarget: number | undefined;

  // 基于趋势和风险的决策逻辑
  if (trend === 'bullish' && riskLevel === 'low') {
    action = 'swap_now';
    confidence = 85;
    reasoning = `${fromToken} 价格呈上涨趋势，当前风险较低，建议立即交换。市场动量积极，流动性充足。`;
    if (currentPrice) {
      priceTarget = currentPrice * 1.1; // 预期上涨 10%
    }
  } else if (trend === 'bearish' && riskLevel === 'low') {
    action = 'wait';
    confidence = 75;
    reasoning = `${fromToken} 价格呈下跌趋势，建议等待更好的入场时机。预计价格可能进一步下跌。`;
    if (currentPrice) {
      priceTarget = currentPrice * 0.95; // 预期下跌 5%
    }
  } else if (riskLevel === 'high') {
    action = 'caution';
    confidence = 60;
    reasoning = `当前市场波动较大，风险评分为 ${riskScore}/100。建议谨慎操作，或减少交换数量。`;
  } else if (trend === 'neutral') {
    action = 'swap_now';
    confidence = 65;
    reasoning = `市场处于横盘状态，价格相对稳定。如果需要交换，当前是合适的时机。`;
  } else {
    action = 'swap_now';
    confidence = 70;
    reasoning = `基于当前市场条件，可以进行交换。建议关注滑点和流动性。`;
  }

  // 调整置信度基于波动率
  if (volatility > 0.05) {
    confidence = Math.max(50, confidence - 15);
  }

  return {
    action,
    confidence: Math.round(confidence),
    reasoning,
    priceTarget,
    riskLevel,
    riskScore,
  };
}
