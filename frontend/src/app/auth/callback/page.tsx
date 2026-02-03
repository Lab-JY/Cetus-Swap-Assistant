'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { RANDOMNESS_SESSION_KEY, MAX_EPOCH_KEY } from '@/utils/zklogin';
import { secureStorage } from '@/utils/storage';
import { jwtToAddress } from '@mysten/zklogin';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Processing login...');

  useEffect(() => {
    const handleLogin = async () => {
      // 1. Get ID Token from URL fragment
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const idToken = hashParams.get('id_token');

      if (!idToken) {
        setStatus('Error: No ID Token found');
        return;
      }

      try {
        // 2. Decode JWT to get 'sub' (Subject ID)
        const decodedJwt = jwtDecode<{ sub: string }>(idToken);

        // 3. Get Ephemeral Data from Secure Session
        const randomness = secureStorage.getItem<string>(RANDOMNESS_SESSION_KEY);
        const maxEpoch = secureStorage.getItem<string>(MAX_EPOCH_KEY);

        if (!randomness || !maxEpoch) {
           setStatus('Error: Session expired. Please login again.');
           setTimeout(() => router.push('/'), 2000);
           return;
        }

        // 4. Generate salt from Google sub (consistent for each user)
        const userSalt = BigInt(
           '0x' + Array.from(decodedJwt.sub)
             .map((c) => c.charCodeAt(0).toString(16))
             .join('')
        ) + BigInt('1234567890');

        // 5. Derive zkLogin Address
        const zkLoginAddress = jwtToAddress(idToken, userSalt);

        // 6. Store everything in Secure Session Storage
        secureStorage.setItem('zklogin_jwt', idToken);
        secureStorage.setItem('zklogin_salt', userSalt.toString());
        secureStorage.setItem('zklogin_address', zkLoginAddress);

        setStatus(`Login Successful! Redirecting to ${zkLoginAddress.slice(0, 6)}...`);
        setTimeout(() => router.push('/'), 1000);

      } catch (e: unknown) {
        console.error(e);
        setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    handleLogin();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center">
        <h2 className="text-xl font-bold mb-4">zkLogin Verification</h2>
        <div className="animate-pulse text-blue-600 mb-4">
           🔐 Verifying Google Credentials...
        </div>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
}
