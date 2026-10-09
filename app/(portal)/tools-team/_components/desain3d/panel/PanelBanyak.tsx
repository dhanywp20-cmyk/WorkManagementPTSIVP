'use client';
/**
 * Panel "Atur N benda" (pilih banyak): skala ukuran, samakan ukuran dengan benda utama, isi
 * lebar / tinggi / tebal / tinggi dari lantai sekaligus, putar 90°, rata tepi, duplikat & hapus.
 * Geser / putar bersama lewat gizmo benda utama (mesin/useMesin.ts). Aturan: inti/banyak.ts.
 */
import { useState } from 'react';
import { AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, Copy, RotateCw, Trash2 } from 'lucide-react';
import { Ikon } from '@/components/shared/Ikon';
import { type Benda, duplikatBanyak, ikutUtama, rataBanyak, type Rata, skalaBanyak, ukuranBanyak } from '../inti';
import type { AlatDesain } from './alat';

const mm = (m: number) => Math.round(m * 1000);
/** Nilai bersama bila semua sama, selain itu kosong (campuran). */
const bersama = (v: number[]) => (v.every(x => Math.abs(x - v[0]) < 0.0005) ? String(mm(v[0])) : '');

export function PanelBanyak({ a }: { a: AlatDesain }) {
  const { batas, benda, pilih, pilihLain, setBenda, setPanel, setPilih, setPilihan } = a.K;
  const ids = [pilih, ...pilihLain].filter((x): x is string => !!x);
  const dipilih = benda.filter(b => ids.includes(b.id));
  const utama = dipilih.find(b => b.id === pilih) ?? dipilih[0];
  const [skala, setSkala] = useState(100);
  if (!utama) return null;
  const ubah = (f: (bs: Benda[]) => Benda[]) => setBenda(f);
  const tombol = 'inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50';
  const kolom = ([['w', 'Lebar'], ['h', 'Tinggi'], ['d', 'Tebal'], ['elev', 'Dari lantai']] as const);
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100">
        <p className="text-[13px] font-bold text-slate-900" title={dipilih.map(b => b.nama).join('\n')}>{dipilih.length} benda</p>
        <button type="button" onClick={() => setPanel(false)} aria-label="Tutup panel" className="w-8 h-8 grid place-items-center rounded-lg text-slate-600 hover:bg-slate-100">
          <Ikon nama="❌" ukuran={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/*  Ukuran sama (mm): kosong = campuran, diketik = berlaku untuk semua. */}
        <div className="grid grid-cols-2 gap-2">
          {kolom.map(([k, l]) => (
            <label key={k} className="block">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{l} (mm)</span>
              <input type="number" inputMode="numeric" defaultValue={bersama(dipilih.map(b => b[k]))} key={`${k}-${bersama(dipilih.map(b => b[k]))}`} placeholder="campuran"
                onBlur={e => { const v = Number(e.target.value); if (e.target.value !== '' && v >= 0) ubah(bs => ukuranBanyak(bs, ids, { [k]: v / 1000 })); }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm tabular-nums" />
            </label>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="block flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Skala</span>
            <div className="flex items-center gap-1.5">
              <input type="number" value={skala} min={10} max={1000} step={5} onChange={e => setSkala(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm tabular-nums" aria-label="Skala persen" />
              <span className="text-[13px] text-slate-600">%</span>
            </div>
          </label>
          <button type="button" className={tombol} disabled={!skala || skala === 100} onClick={() => { ubah(bs => skalaBanyak(bs, ids, skala / 100)); setSkala(100); }}>Terapkan</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={tombol} title={`Samakan ukuran semua dengan ${utama.nama}`}
            onClick={() => ubah(bs => ukuranBanyak(bs, ids, { w: utama.w, h: utama.h, d: utama.d }))}>= {utama.nama.length > 14 ? `${utama.nama.slice(0, 13)}…` : utama.nama}</button>
          <button type="button" className={tombol} title="Putar 90° bersama (mengelilingi benda utama)" aria-label="Putar 90 derajat"
            onClick={() => ubah(bs => ikutUtama(bs.map(b => (b.id === utama.id ? { ...b, rot: (b.rot + 90) % 360 } : b)), ids, utama, { ...utama, rot: utama.rot + 90 }))}><RotateCw size={15} /></button>
        </div>
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Rata</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rata tepi">
            {([['kiri', AlignStartVertical, 'Rata kiri'], ['tengah-x', null, 'Tengah (kiri-kanan)'], ['kanan', AlignEndVertical, 'Rata kanan'],
              ['depan', AlignStartHorizontal, 'Rata depan'], ['tengah-z', null, 'Tengah (depan-belakang)'], ['belakang', AlignEndHorizontal, 'Rata belakang']] as const).map(([r, I, t]) => (
              <button key={r} type="button" className={`${tombol} w-9 px-0`} title={t} aria-label={t} onClick={() => ubah(bs => rataBanyak(bs, ids, r as Rata))}>
                {I ? <I size={15} /> : <span className="text-[13px]">{r === 'tengah-x' ? '↔' : '↕'}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5 pt-1 border-t border-slate-100">
          <button type="button" className={tombol} title="Duplikat semua" onClick={() => {
            const h = duplikatBanyak(benda, ids, batas.x); setBenda(h.benda);
            setPilihan(h.baru[0]?.id ?? null, h.baru.slice(1).map(b => b.id));
          }}><Copy size={15} /> Duplikat</button>
          <button type="button" className={`${tombol} text-rose-700 hover:bg-rose-50`} title="Hapus semua" onClick={() => {
            setBenda(bs => bs.filter(b => !ids.includes(b.id))); setPilih(null); setPanel(false);
          }}><Trash2 size={15} /> Hapus</button>
        </div>
      </div>
    </div>
  );
}
