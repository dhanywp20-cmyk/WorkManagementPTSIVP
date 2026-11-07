'use client';

import { useEffect } from 'react';
import { laporGalat } from '@/lib/galat/lapor';

export function PelaporGalat() {
  useEffect(() => {
    const galatSkrip = (e: ErrorEvent) => laporGalat({ pesan: e.message || String(e.error ?? ''), sumber: 'skrip' }, e.filename);
    const galatJanji = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; name?: string } | string | undefined;
      const pesan = typeof r === 'string' ? r : `${r?.name && r.name !== 'Error' ? `${r.name}: ` : ''}${r?.message ?? ''}`;
      laporGalat({ pesan, sumber: 'janji' });
    };
    window.addEventListener('error', galatSkrip);
    window.addEventListener('unhandledrejection', galatJanji);
    return () => { window.removeEventListener('error', galatSkrip); window.removeEventListener('unhandledrejection', galatJanji); };
  }, []);
  return null;
}
