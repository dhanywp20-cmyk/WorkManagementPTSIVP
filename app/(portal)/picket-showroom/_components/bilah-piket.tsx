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
        {!isCurrWeek&&<button onClick={()=>setWeekStart(getMonday(new Date()))} className="text-[10px] font-bold px-2 py-1 rounded-lg text-white flex-shrink-0" style={{background:'#dc2626'}}>Ini</button>}
      </div>
      <button aria-label="Berikutnya" onClick={()=>setWeekStart(d=>addDays(d,14))} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50">›</button>
      <button onClick={()=>setWeekStart(d=>addDays(d,28))} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50">››</button>
    </div>
  );
}

export function ChipFilterAktif({ filterInstansi, setFilterInstansi, filterKebutuhan, setFilterKebutuhan, filterDivision, setFilterDivision,
  filterKegiatan, setFilterKegiatan }: {
  filterInstansi: string | null; setFilterInstansi: (v: null) => void;
  filterKebutuhan: string | null; setFilterKebutuhan: (v: null) => void;
  filterDivision: string | null; setFilterDivision: (v: null) => void;
  filterKegiatan: string | null; setFilterKegiatan: (v: null) => void;
}) {
  if (!(filterInstansi||filterKebutuhan||filterDivision||filterKegiatan)) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {filterInstansi&&(<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{background:'rgba(14,165,233,0.1)',border:'1px solid rgba(14,165,233,0.35)'}}>
        <span className="text-[11px] font-bold text-sky-700"><Ikon nama="🏢" ukuran="1em" className="inline-block align-[-0.12em]" /> {filterInstansi}</span>
        <button aria-label="Tutup" onClick={()=>setFilterInstansi(null)} className="text-sky-400 text-[11px] ml-1">✕</button>
      </div>)}
      {filterKebutuhan&&(<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{background:'rgba(124,58,237,0.1)',border:'1px solid rgba(124,58,237,0.35)'}}>
        <span className="text-[11px] font-bold text-violet-600"><Ikon nama="🎯" ukuran="1em" className="inline-block align-[-0.12em]" /> {filterKebutuhan}</span>
        <button aria-label="Tutup" onClick={()=>setFilterKebutuhan(null)} className="text-violet-400 text-[11px] ml-1">✕</button>
      </div>)}
      {filterDivision&&(<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.35)'}}>
        <span className="text-[11px] font-bold text-amber-700"><Ikon nama="🏷" ukuran="1em" className="inline-block align-[-0.12em]" /> {filterDivision}</span>
        <button aria-label="Tutup" onClick={()=>setFilterDivision(null)} className="text-amber-400 text-[11px] ml-1">✕</button>
      </div>)}
      {filterKegiatan&&(<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{background:`${KEGIATAN_COLORS[filterKegiatan]||'#6366f1'}18`,border:`1px solid ${KEGIATAN_COLORS[filterKegiatan]||'#6366f1'}50`}}>
        <span className="text-[11px] font-bold" style={{color:KEGIATAN_COLORS[filterKegiatan]||'#6366f1'}}><Ikon nama="📋" ukuran="1em" className="inline-block align-[-0.12em]" /> {filterKegiatan}</span>
        <button aria-label="Tutup" onClick={()=>setFilterKegiatan(null)} className="text-[11px] ml-1" style={{color:KEGIATAN_COLORS[filterKegiatan]||'#6366f1'}}>✕</button>
      </div>)}
    </div>
  );
}
