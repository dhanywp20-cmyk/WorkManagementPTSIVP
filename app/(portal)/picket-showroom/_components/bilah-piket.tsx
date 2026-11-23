'use client';
import type { Dispatch, SetStateAction } from 'react';
import { KEGIATAN_COLORS, addDays, getMonday } from './shared';
import { Ikon } from '@/components/shared/Ikon';

export function LapisanMemuatPiket() {
  return (
    <div role="status" aria-busy="true" className="absolute inset-0 z-40 flex items-center justify-center" style={{background: 'var(--latar-halaman)',backgroundSize:'cover'}}>
      <div className="absolute inset-0" style={{background:'rgba(255,255,255,0.15)',backdropFilter:'blur(2px)'}}/>
      <div className="relative flex flex-col items-center gap-4 px-10 py-8 rounded-3xl" style={{background:'rgba(255,255,255,0.92)',backdropFilter:'blur(20px)',boxShadow:'0 8px 40px rgba(0,0,0,0.18)'}}>
        <svg aria-hidden="true" focusable="false" className="w-16 h-16 animate-spin" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="26" stroke="#f1f5f9" strokeWidth="6"/><path d="M32 6 A26 26 0 0 1 58 32" stroke="#dc2626" strokeWidth="6" strokeLinecap="round"/></svg>
        <p className="text-sm font-bold text-slate-700">Loading...</p>
      </div>
    </div>
  );
}

export function NavigasiMinggu({ wLabel, wLabel2, isCurrWeek, setWeekStart }: {
  wLabel: string; wLabel2: string; isCurrWeek: boolean; setWeekStart: Dispatch<SetStateAction<Date>>;
}) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={()=>setWeekStart(d=>addDays(d,-28))} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50">‹‹</button>
      <button aria-label="Sebelumnya" onClick={()=>setWeekStart(d=>addDays(d,-14))} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50">‹</button>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{background:'rgba(220,38,38,0.07)',border:'1px solid rgba(220,38,38,0.2)'}}>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-red-700 leading-tight">{wLabel}</span>
          <span className="text-[11px] text-red-600 leading-tight">{wLabel2}</span>
        </div>
        {!isCurrWeek&&<button onClick={()=>setWeekStart(getMonday(new Date()))} className="text-[10px] font-bold px-2 py-1 rounded-lg text-white shrink-0" style={{background:'#dc2626'}}>Ini</button>}
      </div>
      <button aria-label="Berikutnya" onClick={()=>setWeekStart(d=>addDays(d,14))} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50">›</button>
      <button onClick={()=>setWeekStart(d=>addDays(d,28))} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50">››</button>
    </div>
  );
}

type Pilihan = string[];
type Ubah = (f: (p: Pilihan) => Pilihan) => void;

export function ChipFilterAktif({ filterInstansi, setFilterInstansi, filterKebutuhan, setFilterKebutuhan, filterDivision, setFilterDivision,
  filterKegiatan, setFilterKegiatan }: {
  filterInstansi: Pilihan; setFilterInstansi: Ubah;
  filterKebutuhan: Pilihan; setFilterKebutuhan: Ubah;
  filterDivision: Pilihan; setFilterDivision: Ubah;
  filterKegiatan: Pilihan; setFilterKegiatan: Ubah;
}) {
  const grup = [
    { nilai: filterInstansi, ubah: setFilterInstansi, ikon: '🏢', warna: () => '#0284c7' },
    { nilai: filterKebutuhan, ubah: setFilterKebutuhan, ikon: '🎯', warna: () => '#7c3aed' },
    { nilai: filterDivision, ubah: setFilterDivision, ikon: '🏷', warna: () => '#b45309' },
    { nilai: filterKegiatan, ubah: setFilterKegiatan, ikon: '📋', warna: (v: string) => KEGIATAN_COLORS[v] || '#6366f1' },
  ];
  if (grup.every(g => g.nilai.length === 0)) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {grup.flatMap(g => g.nilai.map(v => (
        <div key={`${g.ikon}-${v}`} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
          style={{ background: `${g.warna(v)}18`, border: `1px solid ${g.warna(v)}50` }}>
          <span className="text-[11px] font-bold" style={{ color: g.warna(v) }}><Ikon nama={g.ikon} ukuran="1em" className="inline-block align-[-0.12em]" /> {v}</span>
          <button aria-label={`Hapus filter ${v}`} onClick={() => g.ubah(p => p.filter(x => x !== v))} className="text-[11px] ml-1" style={{ color: g.warna(v) }}>✕</button>
        </div>
      )))}
    </div>
  );
}
