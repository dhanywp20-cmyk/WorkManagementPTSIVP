'use client';
import { useMemo, useState } from 'react';
import { Replace, Search } from 'lucide-react';
import { cariObjek } from '@/lib/sld/cari';
import { kelasKecil } from './isian';
import { GarisMenu, JudulMenu, Menu } from './MenuBilah';
import type { KeadaanSLD } from './useKeadaanSLD';

const LABEL_JENIS = { p: 'Perangkat', k: 'Kabel', t: 'Teks', z: 'Area' } as const;

export function CariGanti({ a, buka, onBuka, onPilih }: { a: KeadaanSLD; buka: boolean; onBuka: (v: boolean) => void; onPilih: () => void }) {
  const [q, setQ] = useState('');
  const [ganti, setGanti] = useState('');
  const [hasil, setHasil] = useState('');
  const temuan = useMemo(() => cariObjek(a.dok, q), [a.dok, q]);
  return (
    <Menu label="Cari & ganti (Ctrl+F)" ikon={Search} lebar="w-80" buka={buka} onBuka={v => { onBuka(v); if (!v) setHasil(''); }}>
      <div className="p-1.5">
        <label className="relative block">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input autoFocus value={q} onChange={e => { setQ(e.target.value); setHasil(''); }} placeholder="Cari perangkat, model, kabel, teks..." aria-label="Cari di diagram"
            className={`${kelasKecil} pl-8`} />
        </label>
      </div>
      {q.trim() && (
        <div className="max-h-60 overflow-y-auto px-1" role="listbox" aria-label="Hasil pencarian">
          {!temuan.length && <p className="px-2.5 py-2 text-[12.5px] text-slate-500">Tidak ada yang cocok di ruangan ini.</p>}
          {temuan.map(t => (
            <button key={`${t.jenis}${t.id}`} type="button" role="option" aria-selected={a.pilih?.id === t.id}
              onClick={() => { a.setPilih({ jenis: t.jenis, id: t.id }); onPilih(); }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-100 ${a.pilih?.id === t.id ? 'bg-blue-50' : ''}`}>
              <span className="w-[62px] shrink-0 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{LABEL_JENIS[t.jenis]}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-slate-800">{t.judul}</span>
                {t.ket && <span className="block truncate text-[11.5px] text-slate-500">{t.ket}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      <GarisMenu />
      <JudulMenu>Ganti teks di ruangan ini</JudulMenu>
      <div className="flex gap-1.5 px-1.5 pb-1.5">
        <input value={ganti} onChange={e => setGanti(e.target.value)} placeholder="Ganti dengan..." aria-label="Ganti dengan" className={`${kelasKecil} flex-1`} />
        <button type="button" disabled={!q.trim()} onClick={() => { const n = a.gantiSemua(q, ganti); setHasil(n ? `${n} teks diganti (bisa Ctrl+Z).` : 'Tidak ada yang diganti.'); }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-700 px-2.5 text-[12.5px] font-bold text-white hover:bg-blue-800 disabled:opacity-40">
          <Replace size={14} /> Ganti semua
        </button>
      </div>
      {hasil && <p role="status" className="px-2.5 pb-1.5 text-[12px] text-emerald-700">{hasil}</p>}
    </Menu>
  );
}
