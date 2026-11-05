'use client';

import { useEffect, useState } from 'react';

export function GambarSoal({ url, tinggi = 'max-h-64', className = '' }: { url: string | null | undefined; tinggi?: string; className?: string }) {
  const [besar, setBesar] = useState(false);
  useEffect(() => {
    if (!besar) return;
    const tutup = (e: KeyboardEvent) => { if (e.key === 'Escape') setBesar(false); };
    window.addEventListener('keydown', tutup);
    return () => window.removeEventListener('keydown', tutup);
  }, [besar]);
  if (!url) return null;
  return (
    <>
      <button type="button" onClick={() => setBesar(true)} aria-label="Perbesar gambar soal" title="Perbesar"
        className={`block mx-auto max-w-full rounded-xl overflow-hidden bg-white/90 ${className}`}>
        <img src={url} alt="Gambar soal" loading="lazy" className={`${tinggi} w-auto max-w-full object-contain`} />
      </button>
      {besar && (
        <div role="dialog" aria-modal="true" aria-label="Gambar soal" onClick={() => setBesar(false)}
          className="fixed inset-0 z-[1100] bg-black/85 flex items-center justify-center p-4 cursor-zoom-out">
          <img src={url} alt="Gambar soal" className="max-h-full max-w-full object-contain rounded-lg" />
        </div>
      )}
    </>
  );
}
