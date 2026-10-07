'use client';
/** Tombol bulat kontrol kamera di atas kanvas. */
import type { ReactNode } from 'react';

/** Tombol bulat kontrol kamera di atas kanvas. */
export function TombolNav({ judul, onClick, aktif, children }: { judul: string; onClick: () => void; aktif?: boolean; children: ReactNode }) {
  return (
    <button type="button" title={judul} aria-label={judul} aria-pressed={aktif} onClick={onClick}
      className={`w-9 h-9 grid place-items-center ${aktif ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'}`}>
      {children}
    </button>
  );
}
