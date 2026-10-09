'use client';
/**
 * Keterangan tambahan seluruh platform: BUKAN paragraf di layar (owner: jangan banyak kalimat
 * penjelasan - terasa "buatan AI"), cukup ikon ⓘ kecil. Isinya muncul saat kursor di atasnya, saat
 * disentuh (HP), atau saat difokus keyboard. Tidak ikut tercetak.
 */
import type React from 'react';

export function Keterangan({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`group relative inline-flex align-middle print:hidden ${className}`}>
      <button type="button" aria-label="Keterangan"
        className="w-[18px] h-[18px] grid place-items-center rounded-full border border-current/30 bg-white/80 text-[10.5px] font-bold opacity-60 hover:opacity-100">i</button>
      <span role="tooltip"
        className="pointer-events-none absolute left-0 top-6 z-[1100] hidden group-hover:block group-focus-within:block w-[min(20rem,80vw)] rounded-lg bg-slate-900/95 px-3 py-2 text-[11.5px] font-normal normal-case tracking-normal leading-relaxed text-white shadow-xl text-left">
        {children}
      </span>
    </span>
  );
}
