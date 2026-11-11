'use client';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { isiIkon, viewBoxIkon } from '@/lib/sld/ikon';
import { KATALOG, LABEL_KELOMPOK, URUTAN_KELOMPOK } from '@/lib/sld/katalog';
import { kelasInput } from '../bersama/ui';
import { ImporBom } from './ImporBom';
import type { KeadaanSLD } from './useKeadaanSLD';

const KELAS_KARTU = 'group flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white px-1.5 pt-1.5 pb-2 min-h-[76px] text-center cursor-pointer '
  + 'transition-colors duration-150 hover:border-blue-300 hover:bg-blue-50/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-300';

export function MiniIkon({ ikon, className = 'w-12 h-8' }: { ikon: string; className?: string }) {
  return <svg viewBox={viewBoxIkon(ikon)} className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: isiIkon(ikon) }} />;
}

export function PanelKatalog({ a }: { a: KeadaanSLD }) {
  const [cari, setCari] = useState('');
  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const cocok = q ? KATALOG.filter(t => `${t.nama} ${t.kategori} ${(t.saran ?? []).join(' ')}`.toLowerCase().includes(q)) : KATALOG;
    return URUTAN_KELOMPOK.map(k => ({ k, isi: cocok.filter(t => t.kelompok === k) })).filter(x => x.isi.length);
  }, [cari]);
  return (
    <div className="space-y-2">
      <ImporBom a={a} />
      <label className="relative block">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari perangkat..." aria-label="Cari perangkat" className={`${kelasInput} pl-9`} />
      </label>
      <p className="text-[11px] text-slate-500">Klik untuk menaruh di diagram, lalu seret ke posisinya.</p>
      <div className="max-h-[56vh] overflow-y-auto pr-0.5 space-y-3">
        {daftar.map(g => (
          <div key={g.k}>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1.5">{LABEL_KELOMPOK[g.k]}</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-2 gap-1.5">
              {g.isi.map(t => (
                <button key={t.k} type="button" onClick={() => a.tambahPerangkat(t.k)} title={`${t.nama} · ${t.kategori}`}
                  className={KELAS_KARTU}>
                  <MiniIkon ikon={t.ikon} className="w-[72px] h-[45px] transition-transform duration-200 group-hover:scale-105" />
                  <span className="text-[11px] font-semibold leading-tight text-slate-700">{t.nama}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {!daftar.length && <p className="text-[12px] text-slate-500">Tidak ada perangkat yang cocok.</p>}
      </div>
      <button type="button" onClick={a.kabelBebas}
        className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">
        + Baris koneksi tanpa gambar (mis. catu daya P1)
      </button>
    </div>
  );
}
