'use client';

import { Suspense } from 'react';
import { AnalyticsPlatform } from './_components/AnalyticsPlatform';

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-cover bg-center" style={{ background: 'var(--latar-halaman)' }}>
        <div className="w-10 h-10 rounded-full border-4 border-t-amber-500 border-amber-200 animate-spin" />
      </div>
    }>
      <AnalyticsPlatform />
    </Suspense>
  );
}
