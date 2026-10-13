'use client';

import { useEffect } from 'react';
import { laporGalat } from '@/lib/lapor-galat';

/**
 * Tangkap galat skrip & promise yang tidak tertangani di seluruh platform dan laporkan ke
 * Admin Panel -> Kesehatan Sistem. Galat render ditangani batas galat (LayarGalat) sendiri.
 * Dipasang sekali di app/layout.tsx; tidak merender apa pun.
 */
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
