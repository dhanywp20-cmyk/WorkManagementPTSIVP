'use client';
import type React from 'react';
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export const kelasIkon = 'inline-flex items-center justify-center gap-1.5 h-8 min-w-8 px-1.5 rounded-lg text-[12.5px] font-semibold text-slate-700 '
  + 'hover:bg-slate-100 hover:text-slate-900 transition-colors duration-150 disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed';
export const kelasIkonAktif = '!bg-blue-50 !text-blue-700';

const TutupMenu = createContext<() => void>(() => {});
export const useTutupMenu = () => useContext(TutupMenu);

export function Pemisah() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-slate-200" />;
}

function Lencana({ isi }: { isi?: number | string }) {
  if (isi === undefined) return null;
  return <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-slate-200/80 text-[10.5px] font-bold text-slate-600 grid place-items-center tabular-nums">{isi}</span>;
}

export function TombolIkon({ ikon: Ikon, label, onClick, disabled, aktif, teks, className = '', lencana, teksKelas = '' }: {
  ikon: React.ElementType; label: string; onClick: () => void; disabled?: boolean; aktif?: boolean; teks?: string; className?: string; lencana?: number | string; teksKelas?: string;
}) {
  return (
    <button type="button" className={`${kelasIkon} ${aktif ? kelasIkonAktif : ''} ${className}`} onClick={onClick} disabled={disabled}
      aria-label={label} title={label} aria-pressed={aktif === undefined ? undefined : aktif}>
      <Ikon size={16} strokeWidth={2} />{teks && <span className={teksKelas}>{teks}</span>}<Lencana isi={lencana} />
    </button>
  );
}

export function Menu({ label, ikon: Ikon, teks, children, kanan, utama, lebar = 'w-60', disabled, buka: bukaLuar, onBuka, aktif, lencana, teksKelas = '', tetapPasang, peran = 'menu' }: {
  label: string; ikon?: React.ElementType; teks?: string; children: React.ReactNode; kanan?: boolean; utama?: boolean; lebar?: string; disabled?: boolean;
  buka?: boolean; onBuka?: (v: boolean) => void; aktif?: boolean; lencana?: number | string; teksKelas?: string; tetapPasang?: boolean; peran?: 'menu' | 'dialog';
}) {
  const [bukaDalam, setBukaDalam] = useState(false);
  const buka = bukaLuar ?? bukaDalam;
  const setBuka = (v: boolean | ((x: boolean) => boolean)) => { const n = typeof v === 'function' ? v(buka) : v; setBukaDalam(n); onBuka?.(n); };
  const setBukaRef = useRef(setBuka);
  useEffect(() => { setBukaRef.current = setBuka; });
  const akar = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!buka) return;
    const luar = (e: PointerEvent) => { if (!akar.current?.contains(e.target as Node)) setBukaRef.current(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setBukaRef.current(false); };
    document.addEventListener('pointerdown', luar);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', luar); document.removeEventListener('keydown', esc); };
  }, [buka]);
  const gaya = utama ? 'h-8 px-2.5 rounded-lg bg-blue-700 text-white text-[12.5px] font-bold hover:bg-blue-800 inline-flex items-center gap-1.5 disabled:opacity-50'
    : `${kelasIkon} ${aktif ? kelasIkonAktif : buka ? '!bg-slate-100' : ''}`;
  return (
    <div ref={akar} className="relative">
      <button type="button" className={gaya} onClick={() => setBuka(v => !v)} aria-haspopup={peran} aria-expanded={buka} aria-controls={id}
        title={label} aria-label={teks ? undefined : label} disabled={disabled}>
        {Ikon && <Ikon size={16} />}{teks && <span className={teksKelas}>{teks}</span>}<Lencana isi={lencana} /><ChevronDown size={13} className={`opacity-70 transition-transform duration-150 ${buka ? 'rotate-180' : ''}`} />
      </button>
      {(buka || tetapPasang) && (
        <div id={id} role={peran} aria-label={label}
          className={`${buka ? '' : 'hidden'} absolute top-full mt-1.5 z-50 ${lebar} max-w-[calc(100vw-24px)] max-h-[min(75vh,600px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl ${kanan ? 'right-0' : 'left-0'}`}>
          <TutupMenu.Provider value={() => setBuka(false)}>{children}</TutupMenu.Provider>
        </div>
      )}
    </div>
  );
}

export function ItemMenu({ ikon: Ikon, label, pintas, onClick, disabled, bahaya, tetapBuka, judul }: {
  ikon?: React.ElementType; label: string; pintas?: string; onClick: () => void; disabled?: boolean; bahaya?: boolean; tetapBuka?: boolean; judul?: string;
}) {
  const tutup = useContext(TutupMenu);
  return (
    <button type="button" role="menuitem" disabled={disabled} title={judul} onClick={() => { onClick(); if (!tetapBuka) tutup(); }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
        bahaya ? 'text-rose-700 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'}`}>
      {Ikon ? <Ikon size={15} className="shrink-0 opacity-80" /> : <span className="w-[15px]" />}
      <span className="flex-1 min-w-0">{label}</span>
      {pintas && <kbd className="font-sans text-[11px] text-slate-400">{pintas}</kbd>}
    </button>
  );
}

export function JudulMenu({ children }: { children: React.ReactNode }) {
  return <p className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500">{children}</p>;
}

export function GarisMenu() {
  return <div role="separator" className="my-1 h-px bg-slate-100" />;
}

export function Segmen<T extends string | number | boolean>({ nilai, opsi, onPilih, label }: {
  nilai: T; opsi: readonly (readonly [T, string, string?])[]; onPilih: (v: T) => void; label: string;
}) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-0.5" role="radiogroup" aria-label={label}>
      {opsi.map(([v, l, t]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={nilai === v} title={t} onClick={() => onPilih(v)}
          className={`flex-1 whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-bold transition-colors duration-150 ${
            nilai === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{l}</button>
      ))}
    </div>
  );
}

export function Sakelar({ label, nilai, onUbah, judul }: { label: string; nilai: boolean; onUbah: (v: boolean) => void; judul?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none text-[13px] font-medium text-slate-700" title={judul}>
      {label}
      <button type="button" role="switch" aria-checked={nilai} aria-label={label} onClick={() => onUbah(!nilai)}
        className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${nilai ? 'bg-blue-700' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${nilai ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  );
}
