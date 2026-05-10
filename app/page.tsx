'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center" 
         style={{ backgroundImage: 'url(/IVP_Background.png)' }}>
      <div className="bg-white/90 p-8 rounded-2xl shadow-2xl">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto"></div>
        <p className="mt-4 font-bold text-center">Redirecting...</p>
      </div>
    </div>
  );
}
