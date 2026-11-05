'use client';
import React, { useEffect, useState } from 'react';
import { useMerek } from '@/lib/merek';

export function LogoMerek({
  ukuran = 'md',
  gaya = 'penuh',
  className = '',
}: {
  ukuran?: 'sm' | 'md' | 'lg';
  gaya?: 'penuh' | 'tembus';
  className?: string;
}) {
  const merek = useMerek();
  const [gagal, setGagal] = useState(false);
  useEffect(() => { setGagal(false); }, [merek.logoUrl]);

  const sisi = ukuran === 'sm' ? 36 : ukuran === 'lg' ? 40 : 48;
  const ikon = Math.round(sisi * 0.52);

  const adaLogo = Boolean(merek.logoUrl) && !gagal;
  const latar = gaya === 'tembus'
    ? (adaLogo
        ? { background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)' }
        : { background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' })
    : (adaLogo
        ? { background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)' }
        : { background: `linear-gradient(135deg, ${merek.warnaUtama}, ${merek.warnaUtama2})` });

  return (
    <div
      className={`rounded-xl shadow-md flex items-center justify-center flex-shrink-0 overflow-hidden ${className}`}
      style={{ width: sisi, height: sisi, ...latar }}
    >
      {adaLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={merek.logoUrl} alt={merek.namaPerusahaan} width={sisi} height={sisi}
          decoding="async" onError={() => setGagal(true)}
          className="w-full h-full object-contain p-[11%]" />
      ) : (
        <svg aria-hidden="true" focusable="false" style={{ width: ikon, height: ikon }} className="text-white"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )}
    </div>
  );
}
