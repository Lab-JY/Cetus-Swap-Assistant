import { Wallet } from 'lucide-react';
import { TokenInfo } from '@/hooks/useTokens';

type TokenInputProps = {
  label: string;
  amount: string;
  setAmount?: (val: string) => void;
  token: TokenInfo | null;
  setToken: (token: TokenInfo) => void;
  tokensList: TokenInfo[];
  balance?: string;
  readOnly?: boolean;
  loading?: boolean;
  onMax?: () => void;
  showBestPriceBadge?: boolean;
};

export default function TokenInput({
  label,
  amount,
  setAmount,
  token,
  setToken,
  tokensList,
  balance,
  readOnly = false,
  loading = false,
  onMax,
  showBestPriceBadge = false,
}: TokenInputProps) {
  return (
    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        {showBestPriceBadge && <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded">Best Price</span>}
        {balance && (
          <div className="text-sm text-gray-500 flex gap-2 items-center">
            <Wallet className="w-3 h-3" />
            <span>{balance}</span>
            {onMax && (
              <button
                onClick={onMax}
                className="text-blue-600 font-bold hover:text-blue-700 text-xs bg-blue-50 px-2 py-0.5 rounded ml-1 transition-colors"
              >
                MAX
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-3 items-center">
        {readOnly ? (
          <div className={`text-3xl font-bold w-full ${loading ? 'text-gray-300' : 'text-gray-800'}`}>
            {loading ? 'Searching...' : amount}
          </div>
        ) : (
          <input
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount && setAmount(e.target.value)}
            className="bg-transparent text-3xl font-bold text-gray-800 w-full outline-none placeholder-gray-300"
          />
        )}
        <div className="relative">
          {token && (
            <select
              value={token.symbol}
              onChange={(e) => setToken(tokensList.find(t => t.symbol === e.target.value) || tokensList[0])}
              className="appearance-none bg-white pl-3 pr-8 py-2 rounded-xl font-bold shadow-sm border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors focus:outline-none focus:border-blue-500"
            >
              {tokensList.map(t => <option key={t.symbol} value={t.symbol}>{t.icon} {t.symbol}</option>)}
            </select>
          )}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>
      </div>
    </div>
  );
}
