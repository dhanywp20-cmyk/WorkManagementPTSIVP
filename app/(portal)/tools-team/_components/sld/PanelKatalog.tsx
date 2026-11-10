'use client';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { svgIkon } from '@/lib/sld/ikon';
import { KATALOG } from '@/lib/sld/katalog';
import { kelasInput } from '../bersama/ui';
import type { KeadaanSLD } from './useKeadaanSLD';

export function MiniIkon({ ikon, className = 'w-12 h-8' }: { ikon: string; className?: string }) {
  return <svg viewBox="0 0 100 62.5" className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svgIkon(ikon, 0, 0, 100, 62.5) }} />;
}

export function PanelKatalog({ a }: { a: KeadaanSLD }) {
  const [cari, setCari] = useState('');
  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return q ? KATALOG.filter(t => `${t.nama} ${t.kategori}`.toLowerCase().includes(q)) : KATALOG;
  }, [cari]);
  return (
    <div className="space-y-2">
      <label className="relative block">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari perangkat..." aria-label="Cari perangkat" className={`${kelasInput} pl-9`} />
      </label>
      <p className="text-[11px] text-slate-500">Klik untuk menaruh di diagram, lalu seret ke posisinya.</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-2 gap-1.5 max-h-[52vh] overflow-y-auto pr-0.5">
        {daftar.map(t => (
          <button key={t.k} type="button" onClick={() => a.tambahPerangkat(t.k)} title={`${t.nama} · ${t.kategori}`}
            className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white px-1.5 py-2 hover:border-blue-300 hover:bg-blue-50 text-center">
            <MiniIkon ikon={t.ikon} />
            <span className="text-[11px] font-semibold leading-tight text-slate-700">{t.nama}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={a.kabelBebas}
        className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">
        + Baris koneksi tanpa gambar (mis. catu daya P1)
      </button>
    </div>
  );
}
