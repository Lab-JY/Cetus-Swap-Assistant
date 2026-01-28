'use client';

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Users, UserPlus, Send, ArrowLeft, Search, Download, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function PayrollPage() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const token = localStorage.getItem('suipay_token');
        if (!token) {
           setIsLoading(false);
           return;
        }

        const response = await fetch('http://localhost:3001/employees', {
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
    fetchEmployees();
  }, []);

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

  const handleRunPayroll = async () => {
    if (selected.length === 0 || !account) return;
    setIsProcessing(true);
    
    try {
      const tx = new Transaction();
      
      const selectedEmployees = employees.filter(e => selected.includes(e.id));
      
      selectedEmployees.forEach(emp => {
        // ✨ 直接使用后端返回的最小单位金额
        const amountInt = BigInt(emp.salary_amount);
        
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInt)]);
        tx.transferObjects([coin], tx.pure.address(emp.wallet_address));
      });

      const response = await signAndExecute({
        transaction: tx,
      });

      console.log('Payroll PTB Digest:', response.digest);
      setIsSuccess(true);
      setSelected([]);
    } catch (err) {
      console.error('Payroll failed:', err);
      alert('Payroll execution failed. Make sure you have enough SUI.');
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
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 shadow-md transition-all">
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
                    <span className="font-bold text-blue-600">SUI (Testnet)</span>
                  </div>
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
    </div>
  );
}