'use client';
import type React from 'react';
import { kelasInput } from '../bersama/ui';

export const kelasTombol = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50';
export const kelasKecil = `${kelasInput} !py-1.5 !text-[13px]`;

export function Isian({ label, children, className = '', bantuan }: { label: string; children: React.ReactNode; className?: string; bantuan?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{label}</span>
      {children}
      {bantuan && <span className="block text-[11px] text-slate-500 mt-0.5">{bantuan}</span>}
    </label>
  );
}

export function Teks({ label, nilai, onUbah, className, placeholder, bantuan, daftar }: {
  label: string; nilai: string; onUbah: (v: string) => void; className?: string; placeholder?: string; bantuan?: string; daftar?: string;
}) {
  return (
    <Isian label={label} className={className} bantuan={bantuan}>
      <input value={nilai} onChange={e => onUbah(e.target.value)} placeholder={placeholder} list={daftar} className={kelasKecil} />
    </Isian>
  );
}

export function Area({ label, nilai, onUbah, baris = 3, placeholder, bantuan }: {
  label: string; nilai: string; onUbah: (v: string) => void; baris?: number; placeholder?: string; bantuan?: string;
}) {
  return (
    <Isian label={label} bantuan={bantuan}>
      <textarea value={nilai} onChange={e => onUbah(e.target.value)} rows={baris} placeholder={placeholder} className={`${kelasKecil} resize-y`} />
    </Isian>
  );
}

export function Centang({ label, nilai, onUbah }: { label: string; nilai: boolean; onUbah: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-700">
      <input type="checkbox" checked={nilai} onChange={e => onUbah(e.target.checked)} className="w-4 h-4 accent-blue-700" />
      {label}
    </label>
  );
}
