'use client';

import { ConnectButton, useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { Wallet, CreditCard, Users, ArrowUpRight, BarChart3, ShieldCheck, LogIn, TrendingUp, Power, Chrome, Apple } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { generateNonce, generateRandomness } from '@mysten/zklogin';

const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const REDIRECT_URL = 'http://localhost:3000/auth/callback';

export default function Home() {
  const account = useCurrentAccount();
  const { mutateAsync: signMessage } = useSignPersonalMessage();
  const [token, setToken] = useState<string | null>(null);
  const [summary, setSummary] = useState({ total_revenue: 0, order_count: 0, employee_count: 0 });
  const [isYieldActive, setIsYieldActive] = useState(false);
  const [isZkLoading, setIsZkLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('suipay_token');
    if (stored) {
      setToken(stored);
      fetchSummary(stored);
    }
  }, [account]);

  const fetchSummary = async (jwt: string) => {
    try {
      const res = await fetch('http://localhost:3001/merchant/summary', {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (e) { console.error(e); }
  };

  const handleLogin = async () => {
    if (!account) return;
    try {
      const message = new TextEncoder().encode(`Login to SuiPay at ${Date.now()}`);
      const { signature } = await signMessage({ message });
      const messageB64 = btoa(String.fromCharCode(...message));

      const res = await fetch('http://localhost:3001/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: account.address, signature: signature, message: messageB64 }),
      });
      const data = await res.json();
      setToken(data.token);
      localStorage.setItem('suipay_token', data.token);
      fetchSummary(data.token);
    } catch (e) { alert('Auth failed'); }
  };

  // 🚀 zkLogin 进阶版：支持临时密钥
  const handleZkLogin = async (provider: 'google' | 'apple') => {
    setIsZkLoading(true);
    
    // 1. 生成临时密钥对
    const { Ed25519Keypair } = await import('@mysten/sui/keypairs/ed25519');
    const ephemeralKeypair = new Ed25519Keypair();
    sessionStorage.setItem('zklogin_ephemeral_priv', ephemeralKeypair.export().privateKey);

    // 2. 生成参数
    const randomness = generateRandomness();
    const maxEpoch = 2000; 
    const nonce = generateNonce(ephemeralKeypair.getPublicKey(), maxEpoch, randomness);

    localStorage.setItem('zklogin_randomness', randomness);
    localStorage.setItem('zklogin_max_epoch', maxEpoch.toString());

    // 3. 跳转授权
    let loginUrl = '';
    if (provider === 'google') {
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URL,
        response_type: 'id_token',
        scope: 'openid email',
        nonce: nonce,
      });
      loginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } else {
      // Apple 登录逻辑占位
      alert('Apple login will redirect to appleid.apple.com');
      return;
    }
    
    window.location.href = loginUrl;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg">
              <CreditCard size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">SuiPay</span>
          </div>
          <ConnectButton />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!token ? (
           <div className="flex flex-col items-center justify-center py-20">
              <div className="p-10 bg-white rounded-[2.5rem] shadow-xl text-center max-w-md w-full border border-slate-100">
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-8">
                  <LogIn size={40} />
                </div>
                <h2 className="text-3xl font-bold mb-3">Welcome to SuiPay</h2>
                <p className="text-slate-500 mb-10 text-lg font-medium">Global payments & payroll.</p>
                
                <div className="space-y-4">
                  <button onClick={handleLogin} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-3">
                    <Wallet size={20} /> Connect & Sign In
                  </button>
                  
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                    <div className="relative flex justify-center text-xs uppercase tracking-widest text-slate-400 font-bold"><span className="px-4 bg-white">Zero Barrier</span></div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleZkLogin('google')} className="py-4 bg-white border border-slate-200 rounded-2xl font-bold hover:border-blue-400 transition-all flex items-center justify-center gap-2 text-sm">
                      <Chrome size={18} className="text-blue-500" /> Google
                    </button>
                    <button onClick={() => handleZkLogin('apple')} className="py-4 bg-white border border-slate-200 rounded-2xl font-bold hover:border-slate-900 transition-all flex items-center justify-center gap-2 text-sm">
                      <Apple size={18} /> Apple
                    </button>
                  </div>
                </div>
              </div>
           </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">Merchant Dashboard</h2>
                <p className="text-slate-500 text-sm">Real-time settlement & payroll analytics.</p>
              </div>
              <Link href="/invoice/create" className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition-transform">
                + New Invoice
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100">
                <p className="text-slate-500 text-sm font-medium">Total Revenue</p>
                <p className="text-3xl font-black mt-1">${(summary.total_revenue / 1_000_000).toFixed(2)}</p>
                <div className="mt-4 flex items-center text-xs text-green-600 font-bold bg-green-50 w-fit px-2 py-1 rounded-lg">
                  <TrendingUp size={14} className="mr-1" /> LIVE
                </div>
              </div>
              <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100">
                <p className="text-slate-500 text-sm font-medium">Paid Orders</p>
                <p className="text-3xl font-black mt-1">{summary.order_count}</p>
                <p className="text-xs text-slate-400 mt-4 font-medium italic">Confirmed by Indexer</p>
              </div>
              <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100">
                <p className="text-slate-500 text-sm font-medium">Active Employees</p>
                <p className="text-3xl font-black mt-1">{summary.employee_count}</p>
                <p className="text-xs text-slate-400 mt-4 font-medium italic">Managed via Sui Pay</p>
              </div>
            </div>

            <div className={`p-8 rounded-[2rem] border-2 transition-all duration-500 flex flex-col md:flex-row items-center justify-between gap-6 ${isYieldActive ? 'bg-gradient-to-r from-blue-600 to-blue-700 border-blue-400 text-white shadow-2xl shadow-blue-200' : 'bg-white border-slate-100 text-slate-800 shadow-sm'}`}>
              <div className="flex items-center gap-6">
                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-colors ${isYieldActive ? 'bg-white/20' : 'bg-blue-50 text-blue-600'}`}>
                  <TrendingUp size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-1">StableLayer Auto-Yield</h3>
                  <p className={isYieldActive ? 'text-blue-100' : 'text-slate-500'}>
                    Earn up to 12% APY on idle USDC while waiting for settlement.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsYieldActive(!isYieldActive)} className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all shadow-lg ${isYieldActive ? 'bg-white text-blue-600 hover:bg-slate-50' : 'bg-slate-900 text-white hover:bg-black'}`}>
                <Power size={20} />
                {isYieldActive ? 'Yielding Active' : 'Enable Yield'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Link href="/invoice/create" className="group p-10 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <CreditCard size={28} />
                </div>
                <h3 className="text-2xl font-bold mb-2">Merchant Terminal</h3>
                <p className="text-slate-500">Generate professional payment links and QR codes.</p>
              </Link>
              <Link href="/payroll" className="group p-10 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <Users size={28} />
                </div>
                <h3 className="text-2xl font-bold mb-2">Bulk Payroll</h3>
                <p className="text-slate-500">Atomic salary distribution using Sui PTB.</p>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}