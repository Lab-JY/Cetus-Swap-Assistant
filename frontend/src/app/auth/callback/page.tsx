'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Verifying your identity...');

  useEffect(() => {
    const handleCallback = async () => {
      // 1. 从 URL Hash 中解析 id_token (Google OAuth 2.0 返回方式)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const idToken = params.get('id_token');

      if (!idToken) {
        setStatus('Error: No ID token found.');
        return;
      }

      try {
        // 2. 将 JWT 发给后端进行验证并派生 Sui 地址
        const res = await fetch('http://localhost:3001/auth/zklogin/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jwt: idToken }),
        });

        if (!res.ok) throw new Error('Backend verification failed');
        
        const data = await res.json();
        
        // 3. 存储返回的正式 JWT 和 Sui 地址
        localStorage.setItem('suipay_token', data.token);
        localStorage.setItem('suipay_address', data.sui_address);
        
        setStatus('Login Successful! Redirecting...');
        
        // 4. 跳转回控制台
        setTimeout(() => router.push('/'), 1500);
      } catch (err: any) {
        console.error(err);
        setStatus('Authentication Error: ' + err.message);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center">
        {status.includes('Error') ? (
          <div className="text-red-500 font-bold">{status}</div>
        ) : status.includes('Successful') ? (
          <div className="flex flex-col items-center gap-4 text-green-600">
            <CheckCircle2 size={48} className="animate-bounce" />
            <p className="font-bold text-lg">{status}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-blue-600">
            <Loader2 size={48} className="animate-spin" />
            <p className="font-medium text-slate-500">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
