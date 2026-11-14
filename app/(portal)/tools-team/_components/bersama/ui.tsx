'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ikon } from '@/components/shared/Ikon';
import type { Lembar } from '@/lib/lembar-cetak';
import { SimpanKeProyek } from './SimpanKeProyek';

export const kelasInput = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 tabular-nums focus:outline-hidden focus:ring-2 focus:ring-blue-200 focus:border-blue-400';

export const angkaIsian = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : '');

export function Angka({ label, nilai, onUbah, satuan, min = 0, step = 'any', bantuan, placeholder, onKosong }: {
  label: string; nilai: number; onUbah: (v: number) => void; satuan?: string; min?: number; step?: number | 'any'; bantuan?: string;
   placeholder?: string;
   onKosong?: () => void;
}) {
  const [teks, setTeks] = useState<string | null>(null);
  const terkirim = useRef<number | null>(null);
  useEffect(() => {
    if (terkirim.current === null || nilai !== terkirim.current) setTeks(null);
    terkirim.current = null;
  }, [nilai]);
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1" title={bantuan}>
        {label}{bantuan && <span className="ml-1 normal-case font-semibold text-slate-500 cursor-help" aria-hidden="true">ⓘ</span>}
      </span>
      <span className="relative block">
        <input type="number" inputMode="decimal" min={min} step={step} title={bantuan} placeholder={placeholder}
          value={teks ?? angkaIsian(nilai)}
          onChange={e => {
            setTeks(e.target.value);
            const v = parseFloat(e.target.value.replace(',', '.'));
            if (Number.isFinite(v)) { terkirim.current = v; onUbah(v); } else if (!e.target.value.trim()) onKosong?.();
          }}
          onBlur={() => setTeks(null)}
          className={`${kelasInput} ${satuan ? (satuan.length <= 2 ? 'pr-7' : 'pr-12') : ''}`} />
        {satuan && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 pointer-events-none">{satuan}</span>}
      </span>
    </label>
  );
}

export function Pilih<T extends string | number>({ label, nilai, onUbah, opsi }: {
  label: string; nilai: T; onUbah: (v: T) => void; opsi: { v: T; l: string }[];
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{label}</span>
      <select value={String(nilai)} onChange={e => {
        const o = opsi.find(x => String(x.v) === e.target.value); if (o) onUbah(o.v);
      }} className={kelasInput}>
        {opsi.map(o => <option key={String(o.v)} value={String(o.v)}>{o.l}</option>)}
      </select>
    </label>
  );
}

export function Segmen<T extends string>({ nilai, onUbah, opsi, label }: { nilai: T; onUbah: (v: T) => void; opsi: { v: T; l: string }[]; label?: string }) {
  return (
    <div>
      {label && <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{label}</span>}
      <div role="radiogroup" className="flex gap-1 p-1 rounded-xl bg-slate-100">
        {opsi.map(o => (
          <button key={o.v} type="button" role="radio" aria-checked={nilai === o.v} onClick={() => onUbah(o.v)}
            className={`flex-1 px-2 py-1.5 rounded-lg text-[12.5px] font-semibold ${nilai === o.v ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Kartu({ judul, children, aksi }: { judul: string; children: React.ReactNode; aksi?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">{judul}</h2>
        {aksi && <div className="max-w-full">{aksi}</div>}
      </div>
      {children}
    </section>
  );
}

export function Nilai({ label, nilai, satuan, ket, nada }: { label: string; nilai: React.ReactNode; satuan?: string; ket?: React.ReactNode; nada?: 'baik' | 'awas' | 'buruk' }) {
  const warna = nada === 'baik' ? 'text-emerald-700' : nada === 'awas' ? 'text-amber-700' : nada === 'buruk' ? 'text-rose-700' : 'text-slate-900';
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 min-w-0">
      <p className="text-[11px] font-semibold text-slate-600 truncate">{label}</p>
      <p className={`text-lg sm:text-xl sm:leading-7 font-extrabold leading-tight tabular-nums mt-0.5 ${warna}`}>
        {nilai}{satuan && <span className="text-xs font-semibold text-slate-500 ml-1">{satuan}</span>}
      </p>
      {ket && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{ket}</p>}
    </div>
  );
}

export const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toLocaleString('id-ID', { maximumFractionDigits: d }) : '-');
export const fTetap = (n: number, d = 3) => (Number.isFinite(n) ? n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-');

const KELAS_MENU_EKSPOR = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60';

export function TombolSalin({ teks, onCetak, onPng, simpan }: {
  teks: () => string;
   onCetak?: () => void;
   onPng?: () => Promise<void> | void;
   simpan?: { judul: string; lembar: () => Lembar };
}) {
  const [ok, setOk] = useState(false);
  const [buka, setBuka] = useState(false);
  const [simpanBuka, setSimpanBuka] = useState(false);
  const [png, setPng] = useState<'siap' | 'proses' | 'gagal'>('siap');
  const akar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!buka) return;
    const luar = (e: MouseEvent) => { if (!akar.current?.contains(e.target as Node)) setBuka(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setBuka(false); };
    document.addEventListener('mousedown', luar);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', luar); document.removeEventListener('keydown', esc); };
  }, [buka]);
  const salin = async () => {
    try { await navigator.clipboard.writeText(teks()); setOk(true); setTimeout(() => setOk(false), 1800); } catch {  }
    setBuka(false);
  };
  if (!onCetak && !onPng && !simpan) {
    return (
      <button type="button" onClick={salin} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 print:hidden">
        <Ikon nama={ok ? '✅' : '📋'} ukuran={14} /> {ok ? 'Tersalin' : 'Salin hasil'}
      </button>
    );
  }
  return (
    <div ref={akar} className="relative print:hidden">
      <button type="button" aria-haspopup="menu" aria-expanded={buka} onClick={() => setBuka(b => !b)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">
        <Ikon nama={ok ? '✅' : png === 'gagal' ? '⚠' : '⬇'} ukuran={14} />
        {ok ? 'Tersalin' : png === 'proses' ? 'Membuat PNG...' : png === 'gagal' ? 'PNG gagal' : 'Ekspor'}
        <span aria-hidden="true" className={`text-[9px] transition-transform ${buka ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {buka && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-dropdown">
          <button type="button" role="menuitem" onClick={salin} className={KELAS_MENU_EKSPOR}><Ikon nama="📋" ukuran={15} /> Salin hasil</button>
          {onCetak && <button type="button" role="menuitem" onClick={() => { setBuka(false); onCetak(); }} className={KELAS_MENU_EKSPOR}><Ikon nama="🖨" ukuran={15} /> Cetak</button>}
          {onPng && (
            <button type="button" role="menuitem" disabled={png === 'proses'} className={KELAS_MENU_EKSPOR}
              onClick={async () => {
                setBuka(false); setPng('proses');
                try { await onPng(); setPng('siap'); } catch { setPng('gagal'); setTimeout(() => setPng('siap'), 2500); }
              }}>
              <Ikon nama="🖼" ukuran={15} /> Unduh PNG
            </button>
          )}
          {simpan && <button type="button" role="menuitem" onClick={() => { setBuka(false); setSimpanBuka(true); }} className={`${KELAS_MENU_EKSPOR} text-blue-700`}><Ikon nama="📁" ukuran={15} /> Simpan ke proyek</button>}
        </div>
      )}
      {simpan && simpanBuka && <SimpanKeProyek judulAwal={simpan.judul} ringkasan={teks} lembar={simpan.lembar} onTutup={() => setSimpanBuka(false)} />}
    </div>
  );
}

export function Catatan({ children }: { children: React.ReactNode }) {
  const tombol = useRef<HTMLButtonElement>(null);
  const [posisi, setPosisi] = useState<React.CSSProperties | null>(null);
  const buka = () => {
    const r = tombol.current?.getBoundingClientRect();
    if (!r) return;
    const lebar = Math.min(288, window.innerWidth * 0.8);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - lebar - 8));
    setPosisi(r.bottom > window.innerHeight * 0.6 ? { left, bottom: window.innerHeight - r.top + 6, width: lebar } : { left, top: r.bottom + 6, width: lebar });
  };
  const tutup = () => setPosisi(null);
  useEffect(() => {
    if (!posisi) return;
    window.addEventListener('scroll', tutup, true);
    window.addEventListener('resize', tutup);
    return () => { window.removeEventListener('scroll', tutup, true); window.removeEventListener('resize', tutup); };
  }, [posisi]);
  return (
    <span className="relative inline-flex align-middle mt-2 print:hidden" onMouseEnter={buka} onMouseLeave={tutup}>
      <button ref={tombol} type="button" aria-label="Keterangan" aria-expanded={!!posisi} onFocus={buka} onBlur={tutup} onClick={buka}
        className="w-5 h-5 grid place-items-center rounded-full border border-slate-300 bg-white text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:border-slate-400">i</button>
      {posisi && createPortal(
        <span role="tooltip" style={{ position: 'fixed', ...posisi }}
          className="pointer-events-none z-[100] rounded-lg bg-slate-900/95 px-3 py-2 text-[11.5px] leading-relaxed text-white shadow-xl">
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}
