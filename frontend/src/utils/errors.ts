
export const ERROR_MAPPING: Record<string, string> = {
    'Rejected by user': '用户取消了交易',
    'User rejected the request': '用户拒绝了请求',
    'Insufficient balance': '余额不足',
    'No valid route found': '未找到有效的交换路径',
    'Slippage tolerance exceeded': '超过滑点容差',
    'Transaction timed out': '交易超时',
    'MoveAbort': '合约执行中止 (MoveAbort)',
    'Execution failed': '执行失败',
    'Network error': '网络错误，请检查连接',
    'Failed to fetch quote': '获取报价失败',
    'JWT not found': '未找到登录凭证 (JWT)',
    'Transfer Failed': '转账失败',
    'zkLogin transaction failed': 'zkLogin 交易失败',
};

export function getFriendlyErrorMessage(errorMsg: string): string {
    if (!errorMsg) return '未知错误';
    
    // Exact match
    if (ERROR_MAPPING[errorMsg]) return ERROR_MAPPING[errorMsg];
    
    // Partial match
    for (const key in ERROR_MAPPING) {
        if (errorMsg.includes(key)) {
            return ERROR_MAPPING[key];
        }
    }
    
    return errorMsg;
}
