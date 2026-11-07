'use client';
import React, { useEffect, useId, useState } from 'react';
import { Modal, TombolModal } from './Modal';

export const LABEL = {
  setujui: 'Setujui',
  tolak: 'Tolak',
  tugaskan: 'Tugaskan ke',
  setujuiTugaskan: 'Setujui & Tugaskan',
  alasanTolak: 'Alasan penolakan',
} as const;

const IKON_CENTANG = 'M5 13l4 4L19 7';
const IKON_SILANG = 'M6 18L18 6M6 6l12 12';

function Ikon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={d} />
    </svg>
  );
}

const dasarTombol = 'inline-flex items-center justify-center gap-1.5 rounded-kontrol font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed';
const ukuranTombol = { kecil: 'px-2.5 py-1 text-xs', sedang: 'px-4 py-2 text-xs' } as const;

export function TombolSetujui({ children = LABEL.setujui, ukuran = 'sedang', className = '', ...sisa }:
  { ukuran?: keyof typeof ukuranTombol } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...sisa}
      className={`${dasarTombol} ${ukuranTombol[ukuran]} bg-emerald-600 text-white hover:bg-emerald-700 ${className}`}>
      <Ikon d={IKON_CENTANG} />{children}
    </button>
  );
}

export function TombolTolak({ children = LABEL.tolak, ukuran = 'sedang', className = '', ...sisa }:
  { ukuran?: keyof typeof ukuranTombol } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...sisa}
      className={`${dasarTombol} ${ukuranTombol[ukuran]} bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 ${className}`}>
      <Ikon d={IKON_SILANG} />{children}
    </button>
  );
}

export function TombolTugaskan({ children = 'Tugaskan', ukuran = 'sedang', className = '', ...sisa }:
  { ukuran?: keyof typeof ukuranTombol } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...sisa}
      className={`${dasarTombol} ${ukuranTombol[ukuran]} bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 ${className}`}>
      <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      {children}
    </button>
  );
}

const NADA_INFO = {
  info: 'border-slate-200 bg-slate-50 text-slate-700',
  awas: 'border-amber-200 bg-amber-50 text-amber-800',
  bahaya: 'border-rose-200 bg-rose-50 text-rose-800',
  baik: 'border-emerald-200 bg-emerald-50 text-emerald-800',
} as const;

export function KotakInfo({ nada = 'info', judul, children }: { nada?: keyof typeof NADA_INFO; judul?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={`rounded-kontrol border px-3 py-2 text-xs leading-relaxed ${NADA_INFO[nada]}`}>
      {judul && <p className="text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1">{judul}</p>}
      {children}
    </div>
  );
}

export const kelasIsianPersetujuan = 'w-full rounded-kontrol border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-300';
export function LabelIsian({ htmlFor, children, wajib }: { htmlFor: string; children: React.ReactNode; wajib?: boolean }) {
  return <label htmlFor={htmlFor} className="block text-xs font-bold text-slate-700 mb-1.5">{children}{wajib && <span className="text-rose-600"> *</span>}</label>;
}

export interface PilihanPetugas { v: string; l: string; grup?: string; ket?: string }

export function PilihPenugasan({ nilai, onUbah, pilihan, label = LABEL.tugaskan, wajib = true, kosong = '- Pilih petugas -', disabled }: {
  nilai: string; onUbah: (v: string) => void; pilihan: PilihanPetugas[];
  label?: string; wajib?: boolean; kosong?: string; disabled?: boolean;
}) {
  const id = useId();
  const grup = [...new Set(pilihan.map(p => p.grup ?? ''))];
  const opsi = (ps: PilihanPetugas[]) => ps.map(p => <option key={p.v} value={p.v}>{p.l}{p.ket ? ` - ${p.ket}` : ''}</option>);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-700 mb-1.5">
        {label}{wajib && <span className="text-rose-600"> *</span>}
      </label>
      <select id={id} value={nilai} onChange={e => onUbah(e.target.value)} disabled={disabled}
        className="w-full rounded-kontrol border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100">
        <option value="">{kosong}</option>
        {grup.length <= 1 ? opsi(pilihan) : grup.map(g => (
          <optgroup key={g || '-'} label={g || 'Lainnya'}>{opsi(pilihan.filter(p => (p.grup ?? '') === g))}</optgroup>
        ))}
      </select>
    </div>
  );
}

export function ModalSetujui({ buka, onTutup, judul, keterangan, onSetujui, sibuk = false, bisaKirim = true, labelAksi = LABEL.setujui, ukuran = 'md', lapisan, children }: {
  buka: boolean; onTutup: () => void; judul: React.ReactNode; keterangan?: React.ReactNode;
  onSetujui: () => void; sibuk?: boolean; bisaKirim?: boolean; labelAksi?: string;
  ukuran?: 'sm' | 'md' | 'lg' | 'xl'; lapisan?: 'dasar' | 'atas' | 'maks'; children?: React.ReactNode;
}) {
  return (
    <Modal buka={buka} onTutup={onTutup} judul={judul} keterangan={keterangan} ukuran={ukuran} lapisan={lapisan} tutupDiLuar={false}
      footer={<>
        <TombolModal onClick={onTutup} disabled={sibuk}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={onSetujui} disabled={sibuk || !bisaKirim}>{sibuk ? 'Memproses...' : labelAksi}</TombolModal>
      </>}>
      {children}
    </Modal>
  );
}

export function ModalTolak({ buka, onTutup, judul, keterangan, onTolak, sibuk = false, labelAksi = LABEL.tolak, alasanAwal = '', placeholder = 'Tulis alasan supaya pengaju tahu apa yang perlu diperbaiki', lapisan, alasan: alasanLuar, onAlasan, children }: {
  buka: boolean; onTutup: () => void; judul: React.ReactNode; keterangan?: React.ReactNode;
  onTolak: (alasan: string) => void; sibuk?: boolean; labelAksi?: string; alasanAwal?: string; placeholder?: string;
  lapisan?: 'dasar' | 'atas' | 'maks';
  alasan?: string; onAlasan?: (v: string) => void;
  children?: React.ReactNode;
}) {
  const id = useId();
  const [alasanSendiri, setAlasanSendiri] = useState(alasanAwal);
  useEffect(() => { if (buka) setAlasanSendiri(alasanAwal); }, [buka, alasanAwal]);
  const alasan = alasanLuar ?? alasanSendiri;
  const setAlasan = onAlasan ?? setAlasanSendiri;
  const rapi = alasan.trim();
  return (
    <Modal buka={buka} onTutup={onTutup} judul={judul} keterangan={keterangan} ukuran="md" lapisan={lapisan} tutupDiLuar={false}
      footer={<>
        <TombolModal onClick={onTutup} disabled={sibuk}>Batal</TombolModal>
        <TombolModal jenis="bahaya" onClick={() => onTolak(rapi)} disabled={sibuk || !rapi}>{sibuk ? 'Memproses...' : labelAksi}</TombolModal>
      </>}>
      <div className="space-y-3">
        <div>
          <label htmlFor={id} className="block text-xs font-bold text-slate-700 mb-1.5">{LABEL.alasanTolak}<span className="text-rose-600"> *</span></label>
          <textarea id={id} value={alasan} onChange={e => setAlasan(e.target.value)} rows={4} placeholder={placeholder}
            className="w-full rounded-kontrol border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-200 resize-y" />
        </div>
        {children}
      </div>
    </Modal>
  );
}
