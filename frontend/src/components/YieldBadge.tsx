import { TrendingUp } from "lucide-react";

export default function YieldBadge() {
  return (
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
          <TrendingUp size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">StableLayer Yield</h3>
          <p className="text-xs text-slate-500">Auto-compounding treasury</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-black text-emerald-600">~12.4%</p>
        <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">APY</p>
      </div>
    </div>
  );
}
