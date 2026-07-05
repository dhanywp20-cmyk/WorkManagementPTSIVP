'use client';

/**
 * analytics-dashboard/page.tsx — thin wrapper.
 * Isi komponen dipindah ke _components/AnalyticsPlatform.tsx supaya bisa
 * dipakai ulang secara native (embedded) di Dashboard tanpa iframe.
 */

import { Suspense } from 'react';
import { AnalyticsPlatform } from './_components/AnalyticsPlatform';

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-cover bg-center" style={{ backgroundImage: 'url(/IVP_Background.png)' }}>
        <div className="w-10 h-10 rounded-full border-4 border-t-amber-500 border-amber-200 animate-spin" />
      </div>
    }>
      <AnalyticsPlatform />
    </Suspense>
  );
}
