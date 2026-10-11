'use client';
/**
 * Geser tepat: benda terpilih (dan yang ikut terpilih) bergeser persis N mm sepanjang sumbu X (kiri-kanan) atau
 * Z (depan-belakang). Dibuka tombol "Geser tepat" atau langsung mengetik angka saat benda terpilih; sumbu bawaan =
 * sumbu terakhir yang diseret di gizmo. Enter = jalankan, Tab = ganti sumbu, Esc = batal.
 */
import { useState } from 'react';
import { geserTepat } from '../inti';
import type { AlatDesain } from './alat';

export function GeserTepat({ a, awal, onTutup }: { a: AlatDesain; awal: string; onTutup: () => void }) {
  const { batas, pilihLain, setBenda, sumbuGeserRef, terpilih } = a.K;
  const [teks, setTeks] = useState(awal);
  const [sumbu, setSumbu] = useState<'x' | 'z'>(sumbuGeserRef.current);
  if (!terpilih) return null;
  const jalankan = () => {
    const v = Number(teks.replace(',', '.'));
    if (Number.isFinite(v) && v !== 0) setBenda(bs => geserTepat(bs, [terpilih.id, ...pilihLain], sumbu, v / 1000, batas));
    onTutup();
  };
  const pilihan = (s: 'x' | 'z') => `px-2 py-1 rounded-md text-[12px] font-bold border ${sumbu === s ? 'bg-blue-700 border-blue-700 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`;
  return (
    <div className="flex items-center gap-1.5 rounded-xl bg-white border border-blue-300 shadow-lg px-2 py-1.5" role="group" aria-label="Geser tepat">
      <span className="text-[12px] font-bold text-slate-700">Geser</span>
      <input autoFocus inputMode="decimal" value={teks} onChange={e => setTeks(e.target.value)} aria-label="Jarak geser (mm)"
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); jalankan(); }
          else if (e.key === 'Escape') { e.preventDefault(); onTutup(); }
          else if (e.key === 'Tab') { e.preventDefault(); setSumbu(s => (s === 'x' ? 'z' : 'x')); }
        }}
        className="w-20 rounded-md border border-slate-200 px-2 py-1 text-base sm:text-[13px] tabular-nums" />
      <span className="text-[12px] text-slate-500">mm</span>
      <button type="button" onClick={() => setSumbu('x')} className={pilihan('x')} title="Kiri-kanan (+ = ke kanan)">X</button>
      <button type="button" onClick={() => setSumbu('z')} className={pilihan('z')} title="Depan-belakang (+ = menjauhi dinding depan)">Z</button>
      <button type="button" onClick={jalankan} className="px-2 py-1 rounded-md text-[12px] font-bold text-white bg-blue-700 hover:bg-blue-800">OK</button>
    </div>
  );
}
