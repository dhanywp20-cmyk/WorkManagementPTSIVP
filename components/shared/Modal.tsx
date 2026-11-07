'use client';
import React, { useEffect, useId, useRef } from 'react';
import { ModalPortal } from './ModalPortal';
import { Z } from '@/lib/z-index';
import { Ikon } from '@/components/shared/Ikon';

let jumlahTerkunci = 0;
let semulaBody = '';
let semulaHtml = '';
export const tumpukan: string[] = [];

export function kunciGulir(): () => void {
  if (jumlahTerkunci === 0) {
    semulaBody = document.body.style.overflow;
    semulaHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
  jumlahTerkunci += 1;
  return () => {
    jumlahTerkunci = Math.max(0, jumlahTerkunci - 1);
    if (jumlahTerkunci === 0) {
      document.body.style.overflow = semulaBody;
      document.documentElement.style.overflow = semulaHtml;
    }
  };
}

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const LEBAR = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  penuh: 'max-w-7xl',
} as const;

const LAPISAN = {
  dasar: Z.overlay,
  atas: Z.overlayTop,
  maks: Z.overlayMax,
} as const;

export interface ModalProps {
  buka: boolean;
  onTutup: () => void;
  judul: React.ReactNode;
  keterangan?: React.ReactNode;
  ikon?: React.ReactNode;
  ukuran?: keyof typeof LEBAR;
  lapisan?: keyof typeof LAPISAN;
  footer?: React.ReactNode;
  tutupDiLuar?: boolean;
  children: React.ReactNode;
}

export function Modal({
  buka, onTutup, judul, keterangan, ikon,
  ukuran = 'md', lapisan = 'dasar', footer,
  tutupDiLuar = true, children,
}: ModalProps) {
  const idJudul = useId();
  const idKeterangan = useId();
  const badan = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!buka) return;
    tumpukan.push(idJudul);
    const lepasKunci = kunciGulir();
    return () => {
      const i = tumpukan.lastIndexOf(idJudul);
      if (i !== -1) tumpukan.splice(i, 1);
      lepasKunci();
    };
  }, [buka, idJudul]);

  useEffect(() => {
    if (!buka) return;
    const tekan = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (tumpukan[tumpukan.length - 1] !== idJudul) return;
      e.stopPropagation();
      onTutup();
    };
    document.addEventListener('keydown', tekan);
    return () => document.removeEventListener('keydown', tekan);
  }, [buka, onTutup, idJudul]);

  useEffect(() => {
    if (buka) badan.current?.focus();
  }, [buka]);

  useEffect(() => {
    if (!buka) return;
    const tekan = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (tumpukan[tumpukan.length - 1] !== idJudul) return;
      const kontainer = badan.current;
      if (!kontainer) return;
      const focusable = Array.from(
        kontainer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(el => el.offsetParent !== null);
      if (focusable.length === 0) {
        e.preventDefault();
        kontainer.focus();
        return;
      }
      const pertama = focusable[0];
      const terakhir = focusable[focusable.length - 1];
      const aktif = document.activeElement;
      if (e.shiftKey) {
        if (aktif === pertama || aktif === kontainer) {
          e.preventDefault();
          terakhir.focus();
        }
      } else if (aktif === terakhir) {
        e.preventDefault();
        pertama.focus();
      }
    };
    document.addEventListener('keydown', tekan);
    return () => document.removeEventListener('keydown', tekan);
  }, [buka, idJudul]);

  if (!buka) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: LAPISAN[lapisan], background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={tutupDiLuar ? onTutup : undefined}
      >
        <div
          ref={badan}
          role="dialog"
          aria-modal="true"
          aria-labelledby={idJudul}
          aria-describedby={keterangan ? idKeterangan : undefined}
          tabIndex={-1}
          onClick={e => e.stopPropagation()}
          className={`w-full ${LEBAR[ukuran]} bg-white rounded-kartu shadow-modal flex flex-col max-h-[90vh] outline-hidden`}
        >
          <KepalaModal judul={judul} keterangan={keterangan} ikon={ikon} onTutup={onTutup} idJudul={idJudul} idKeterangan={idKeterangan} />

          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">{children}</div>

          {footer && (
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 shrink-0 bg-slate-50/60">
              {footer}
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}

export function KepalaModal({ judul, keterangan, ikon, onTutup, idJudul, idKeterangan, kiri, aksi }: {
  judul: React.ReactNode; keterangan?: React.ReactNode; ikon?: React.ReactNode; onTutup: () => void;
  idJudul?: string; idKeterangan?: string; kiri?: React.ReactNode; aksi?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 shrink-0 bg-white">
      {kiri}
      {ikon && <div className="shrink-0 mt-0.5"><Ikon nama={ikon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></div>}
      <div className="flex-1 min-w-0">
        <h2 id={idJudul} className="text-sm font-bold text-slate-800 leading-snug">{judul}</h2>
        {keterangan && (
          <div id={idKeterangan} className="text-xs text-slate-500 mt-0.5 leading-relaxed">{keterangan}</div>
        )}
      </div>
      {aksi}
      <button
        type="button" onClick={onTutup} aria-label="Tutup"
        className="w-8 h-8 rounded-kecil flex items-center justify-center shrink-0 text-slate-500 hover:text-rose-600 transition-all"
        style={{ background: 'rgba(0,0,0,0.05)' }}
      >
        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export const LATAR_MODAL: React.CSSProperties = { background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' };
export const KARTU_MODAL = 'bg-white rounded-kartu shadow-modal';

export function TombolModal({
  jenis = 'batal', children, ...sisa
}: { jenis?: 'batal' | 'utama' | 'bahaya' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const gaya: React.CSSProperties =
    jenis === 'utama' ? { background: 'linear-gradient(135deg, var(--merek-utama), var(--merek-utama-2))', color: '#fff' }
    : jenis === 'bahaya' ? { background: '#dc2626', color: '#fff' }
    : { background: '#fff', color: '#64748b', border: '1px solid #e2e8f0' };
  return (
    <button
      type="button"
      {...sisa}
      style={{ ...gaya, ...sisa.style }}
      className={`px-4 py-2 rounded-kontrol text-xs font-bold transition-all disabled:opacity-50 hover:opacity-90 ${sisa.className ?? ''}`}
    >
      {children}
    </button>
  );
}
