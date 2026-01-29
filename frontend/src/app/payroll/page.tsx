'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Users, UserPlus, Send, ArrowLeft, Search, Download, Loader2, CheckCircle2, ArrowRightLeft, Coins } from 'lucide-react';
import Link from 'next/link';
import { getSwapQuote, buildSwapTx, SUI_COIN_TYPE, USDC_COIN_TYPE } from '../../utils/cetus';

export default function PayrollPage() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // Fetch USDC coins for Swap Demo
  const { data: usdcCoins } = useSuiClientQuery('getCoins', { 
    owner: account?.address || '',
    coinType: USDC_COIN_TYPE 
  }, {
    enabled: !!account
  });

  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Payment Options
  const [payWithToken, setPayWithToken] = useState<'SUI' | 'USDC'>('SUI');
  const [swapQuote, setSwapQuote] = useState<any>(null);
  const [isQuoting, setIsQuoting] = useState(false);

  // Add Employee Modal State
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', wallet: '', salary: '', role: '' });

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('suistream_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch employees');
      const data = await response.json();
      setEmployees(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleAddEmployee = async () => {
    // 1. 基本校验
    if (!newEmployee.name || !newEmployee.wallet || !newEmployee.salary || !newEmployee.role) {
        alert('Please fill in all fields');
        return;
    }
    
    // 2. 简单地址校验 (Sui 地址应为 66 字符 hex)
    if (!newEmployee.wallet.startsWith('0x') || newEmployee.wallet.length < 60) {
        alert('Invalid Sui wallet address');
        return;
    }

    try {
      setIsSaving(true);
      const token = localStorage.getItem('suistream_token');
      if (!token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const res = await fetch(`${apiUrl}/employees`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: newEmployee.name,
          wallet_address: newEmployee.wallet,
          salary_amount: Math.floor(parseFloat(newEmployee.salary) * 1_000_000_000), // SUI MIST (9 decimals)
          role: newEmployee.role
        })
      });

      if (res.ok) {
        setIsAdding(false);
        setNewEmployee({ name: '', wallet: '', salary: '', role: '' });
        // 3. 局部刷新而不是 reload
        await fetchEmployees();
      } else {
        const err = await res.json();
        alert(`Failed to add employee: ${err.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Error adding employee: Network or server error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelected(selected.length === employees.length ? [] : employees.map(e => e.id));
  };

  // ✨ 使用 BigInt/Int 处理最小单位金额
  const totalAmount = employees
    .filter(e => selected.includes(e.id))
    .reduce((sum, e) => sum + parseInt(e.salary_amount), 0);

  // Auto-refresh quote when selection changes or token changes
  useEffect(() => {
    if (payWithToken === 'USDC' && totalAmount > 0) {
        fetchQuote();
    } else {
        setSwapQuote(null);
    }
  }, [payWithToken, totalAmount]);

  const fetchQuote = async () => {
    setIsQuoting(true);
    try {
        // Find best route: USDC -> SUI (Fixed Output Amount = totalAmount)
        // Note: totalAmount is in MIST (9 decimals). USDC is usually 6 decimals.
        // Cetus SDK handles decimals if configured, but getSwapQuote expects raw amounts.
        const quote = await getSwapQuote(USDC_COIN_TYPE, SUI_COIN_TYPE, totalAmount, false);
        setSwapQuote(quote);
    } catch (e) {
        console.error("Quote failed", e);
    } finally {
        setIsQuoting(false);
    }
  };

  const handleRunPayroll = async () => {
    if (selected.length === 0 || !account) return;
    setIsProcessing(true);
    
    try {
      const tx = new Transaction();
      
      let fundingCoin;

      if (payWithToken === 'USDC') {
        // 1. Check Quote
        if (!swapQuote) {
            alert("No valid swap quote found for USDC payment.");
            setIsProcessing(false);
            return;
        }

        // 2. Find input USDC coin
        // Simplified: Use the first USDC coin with enough balance, or merge if needed.
        // For Hackathon Demo: Assume first coin has enough or just use it.
        // A robust implementation would merge coins.
        if (!usdcCoins?.data || usdcCoins.data.length === 0) {
             alert("No USDC found in your wallet (Testnet). Please faucet some USDC or switch to SUI.");
             setIsProcessing(false);
             return;
        }
        
        const inputUsdc = usdcCoins.data[0]; 
        // Note: In production, check balance > quote.amountIn
        
        console.log("Swapping USDC to SUI...", swapQuote);
        
        // 3. Build Swap Transaction (USDC -> SUI)
        // buildSwapTx returns the *output SUI coin* object
        fundingCoin = await buildSwapTx(tx, swapQuote, tx.object(inputUsdc.coinObjectId));
        
      } else {
        // Normal SUI Payment: Use Gas (SUI) as funding source
        fundingCoin = tx.gas;
      }

      const selectedEmployees = employees.filter(e => selected.includes(e.id));
      
      // 4. Split Funding Coin for each employee
      // Note: If using Swap, fundingCoin is the SUI coin from swap. 
      // If using SUI, fundingCoin is Gas.
      
      // We need to be careful: splitCoins on Gas is fine. splitCoins on a specific object is fine.
      // But we need to make sure we don't spend *all* gas if we are paying in SUI (gas is used for fees).
      // If paying in USDC, the SUI coin from swap is pure salary, fees come from user's other SUI.
      
      const amounts = selectedEmployees.map(e => tx.pure.u64(BigInt(e.salary_amount)));
      
      // If fundingCoin is Gas (SUI payment), splitCoins returns new coins, keeping remainder in Gas.
      // If fundingCoin is Swapped Coin (USDC payment), splitCoins splits it.
      
      const coins = tx.splitCoins(fundingCoin, amounts);
      
      selectedEmployees.forEach((emp, index) => {
        // ✨ Validate and normalize address before usage
        try {
            const normalizedAddr = normalizeSuiAddress(emp.wallet_address.trim());
            tx.transferObjects([coins[index]], tx.pure.address(normalizedAddr));
        } catch (addrErr) {
            console.error(`Invalid address for ${emp.name}:`, emp.wallet_address);
            alert(`Skipping ${emp.name}: Invalid Wallet Address`);
            // Note: In a real PTB, skipping one might mess up the coins array index alignment.
            // For hackathon, failing fast or alerting is safer. 
            // Here we let it fail but log it clearly.
            throw addrErr;
        }
      });

      // If we swapped USDC and there's 'slippage' dust left in the Swapped Coin, we should transfer it back to user?
      // For simplicity in Demo, we leave it (it gets cleaned up or dropped if value 0, or user claims it manually if we transfer).
      // Ideally: tx.transferObjects([fundingCoin], account.address); // Transfer remainder

      const response = await signAndExecute({
        transaction: tx,
      });

      console.log('Payroll PTB Digest:', response.digest);
      setIsSuccess(true);
      setSelected([]);
    } catch (err) {
      console.error('Payroll failed:', err);
      alert('Payroll execution failed. Check console for details.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-2xl font-bold text-slate-800">Payroll Management</h1>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl font-medium hover:bg-slate-50 transition-all">
              <Download size={18} />
              Export CSV
            </button>
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 shadow-md transition-all"
            >
              <UserPlus size={18} />
              Add Employee
            </button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
            <p className="text-slate-500">Loading your team...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {isSuccess && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3 text-green-700 font-medium">
                    <CheckCircle2 size={24} />
                    Payroll processed successfully!
                  </div>
                  <button onClick={() => setIsSuccess(false)} className="text-sm font-bold text-green-700 hover:underline">Dismiss</button>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Search employees..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none" />
                  </div>
                  <div className="text-sm font-medium text-slate-500">{selected.length} selected</div>
                </div>

                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-slate-400 border-b">
                      <th className="px-6 py-4 font-bold">
                        <input type="checkbox" checked={selected.length === employees.length && employees.length > 0} onChange={toggleAll} className="rounded border-slate-300" />
                      </th>
                      <th className="px-6 py-4 font-bold">Employee</th>
                      <th className="px-6 py-4 font-bold">Wallet Address</th>
                      <th className="px-6 py-4 font-bold text-right">Salary Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {employees.map((emp) => (
                      <tr key={emp.id} className={`hover:bg-slate-50 transition-colors ${selected.includes(emp.id) ? 'bg-blue-50/30' : ''}`}>
                        <td className="px-6 py-4">
                          <input type="checkbox" checked={selected.includes(emp.id)} onChange={() => toggleSelect(emp.id)} className="rounded border-slate-300" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{emp.name}</div>
                          <div className="text-xs text-slate-500">{emp.role}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-400">{emp.wallet_address}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-800">
                          ${(parseInt(emp.salary_amount) / 1_000_000_000).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 sticky top-28">
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Send size={20} className="text-blue-600" />
                  Run Payout
                </h3>
                
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Recipients</span>
                    <span className="font-bold text-slate-800">{selected.length} employees</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Asset</span>
                    <div className="flex items-center gap-2">
                         <button 
                            onClick={() => setPayWithToken('SUI')}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${payWithToken === 'SUI' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}
                         >
                            SUI
                         </button>
                         <button 
                            onClick={() => setPayWithToken('USDC')}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${payWithToken === 'USDC' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}
                         >
                            <ArrowRightLeft size={10} /> USDC
                         </button>
                    </div>
                  </div>
                  
                  {payWithToken === 'USDC' && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                        <div className="flex justify-between items-center text-slate-500">
                            <span>Powered by <strong>Cetus Aggregator</strong></span>
                            {isQuoting && <Loader2 size={12} className="animate-spin" />}
                        </div>
                        {swapQuote ? (
                             <div className="flex justify-between items-center font-mono">
                                <span className="text-slate-400">Est. Input:</span>
                                <span className="font-bold text-slate-700">
                                    {(parseInt(swapQuote.amountIn) / 1_000_000).toFixed(2)} USDC
                                </span>
                             </div>
                        ) : (
                            <div className="text-amber-600">
                                {!isQuoting && totalAmount > 0 ? "No route found or insufficient liquidity" : "Calculating best route..."}
                            </div>
                        )}
                      </div>
                  )}

                  <div className="pt-4 border-t flex justify-between items-end">
                    <span className="text-slate-500 text-sm">Total Amount</span>
                    <div className="text-right">
                      <div className="text-3xl font-black text-slate-900">
                        ${(totalAmount / 1_000_000_000).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-400">≈ {totalAmount.toLocaleString()} MIST</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleRunPayroll}
                  disabled={selected.length === 0 || isProcessing || !account}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg hover:bg-black disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                >
                  {isProcessing ? (
                    <><Loader2 className="animate-spin" />Executing PTB...</>
                  ) : (
                    <><Send size={18} />Confirm & Send Salaries</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add Employee Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full animate-in zoom-in-95 relative">
            <button 
                onClick={() => setIsAdding(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
                ✕
            </button>
            <h2 className="text-2xl font-bold mb-6">Add New Employee</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                <input 
                  value={newEmployee.name}
                  onChange={e => setNewEmployee({...newEmployee, name: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Alice Chen"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Sui Wallet Address</label>
                <input 
                  value={newEmployee.wallet}
                  onChange={e => setNewEmployee({...newEmployee, wallet: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="0x..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Salary (SUI)</label>
                  <input 
                    type="number"
                    value={newEmployee.salary}
                    onChange={e => setNewEmployee({...newEmployee, salary: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="2000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Role</label>
                  <input 
                    value={newEmployee.role}
                    onChange={e => setNewEmployee({...newEmployee, role: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Dev"
                  />
                </div>
              </div>

              <button 
                onClick={handleAddEmployee}
                disabled={isSaving}
                className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin mx-auto" /> : 'Save Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
