'use client';
import { useMemo } from 'react';
import { WATERMARK_BAWAAN } from '@/lib/sld/lembar-umum';
import { isiLembar2 } from '@/lib/sld/lembar2';
import { HALAMAN } from '@/lib/sld/tipe';
import type { KeadaanSLD } from './useKeadaanSLD';

export function Sheet2({ a }: { a: KeadaanSLD }) {
  const logo = a.logo ?? WATERMARK_BAWAAN;
  const h = useMemo(() => isiLembar2(a.dok, { watermark: logo }), [a.dok, logo]);
  return (
    <div className="space-y-2">
      {h.info.halaman > 1 && (
        <p className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-[12.5px] text-sky-900">
          Isi Sheet 2 tidak muat satu lembar A3, jadi otomatis berlanjut ke {h.info.halaman} lembar (ikut di PDF, PNG &amp; Visio).
        </p>
      )}
      {(h.info.terpotongKoneksi > 0 || h.info.terpotongPerangkat > 0) && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-900">
          Masih ada {h.info.terpotongKoneksi} baris koneksi dan {h.info.terpotongPerangkat} baris perangkat yang tidak tercetak (batas lembar lanjutan). Persingkat isi kolom.
        </p>
      )}
      <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 max-h-[78vh] space-y-3" style={{ colorScheme: 'light' }}>
        {h.svgs.map((s, i) => (
          <svg key={i} viewBox={`0 0 ${HALAMAN.w} ${HALAMAN.h}`} style={{ width: '100%', minWidth: 640, display: 'block', background: '#fff', userSelect: 'none' }} role="img"
            aria-label={`Pratinjau sheet 2${h.svgs.length > 1 ? ` lembar ${i + 1}` : ''}`} dangerouslySetInnerHTML={{ __html: s }} />
        ))}
      </div>
    </div>
  );
}
