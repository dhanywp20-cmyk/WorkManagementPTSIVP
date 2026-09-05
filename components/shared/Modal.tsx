'use client';
import React, { useEffect, useId, useRef } from 'react';
import { ModalPortal } from './ModalPortal';
import { Z } from '@/lib/z-index';

/**
 * Modal - satu kerangka untuk seluruh popup platform.
 *
 * KENAPA INI ADA
 *
 * Pengukuran atas 157 berkas menemukan 93 overlay `fixed inset-0` yang dirakit
 * sendiri-sendiri, dengan padding badan dari p-2 sampai p-10. Akibatnya bukan
 * cuma tampilan yang tidak seragam: tiap salinan juga harus mengingat sendiri
 * hal-hal yang mudah terlupa - tutup dengan Esc, kunci gulir halaman, peran
 * ARIA, dan lapisan z-index yang benar. Yang lupa satu, cacatnya baru
 * ketahuan saat dipakai.
 *
 * SUSUNANNYA tetap seperti di master prompt:
 *
 *     Header  -> judul + keterangan + tombol tutup
 *     Content -> children
 *     Footer  -> Batal + aksi utama
 *
 * CATATAN PENERAPAN
 *
 * Komponen ini TIDAK dipakai untuk menulis ulang 93 overlay itu sekaligus.
 * Platform ini dipakai tim setiap hari; mengganti seluruh popup dalam satu
 * langkah adalah cara tercepat memecahkan sesuatu tanpa ketahuan. Yang berlaku:
 * kode baru memakai ini, dan popup lama pindah satu per satu dengan
 * pemeriksaan visual masing-masing.
 */

/**
 * Dua hal di bawah HARUS diurus bersama-sama oleh semua modal, bukan
 * sendiri-sendiri. Keduanya ditemukan lewat pengujian modal bertingkat, dan
 * keduanya adalah cacat yang pasti terulang di tiap salinan overlay buatan
 * sendiri:
 *
 *  1. KUNCI GULIR harus dihitung, bukan disimpan-dan-dikembalikan.
 *     Kalau tiap modal menyimpan nilai overflow sebelumnya lalu
 *     mengembalikannya saat ditutup, modal kedua akan menyimpan 'hidden' -
 *     nilai milik modal pertama. Saat keduanya tertutup dalam commit yang
 *     sama, pengembalian terakhir yang menang, dan halaman TETAP terkunci.
 *     Diuji: sebelum perbaikan, gaya inline overflow masih tertinggal setelah
 *     modal terakhir ditutup.
 *
 *  2. ESC hanya boleh menutup modal PALING ATAS. Tiap modal memasang
 *     pendengar keydown-nya sendiri, jadi satu tekan Esc menutup seluruh
 *     tumpukan sekaligus - termasuk form di belakangnya yang belum selesai
 *     diisi.
 */
let jumlahTerkunci = 0;
let semulaBody = '';
let semulaHtml = '';
const tumpukan: string[] = [];

/**
 * Kunci dipasang di <html> DAN <body>.
 *
 * Memasangnya di <body> saja tidak mengunci apa pun di platform ini.
 * Peramban meneruskan overflow dari <body> ke viewport HANYA bila overflow
 * <html> masih `visible` - sementara app/globals.css memberi
 * `html, body { overflow-x: hidden }`, jadi syarat itu tidak pernah
 * terpenuhi.
 *
 * Diuji langsung di halaman dengan isi setinggi 3000px, memakai roda tetikus
 * sungguhan: dengan body saja, halaman tetap tergulir 600px; dengan html ikut
 * dikunci, tetap 0. (Pengujian WAJIB memakai roda - window.scrollTo() menembus
 * overflow:hidden, jadi ia akan melaporkan 'tidak terkunci' walau kuncinya
 * bekerja.)
 */
function kunciGulir(): () => void {
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

/** Elemen yang bisa menerima fokus keyboard, dipakai jebakan fokus di bawah. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Lebar menurut isi, bukan angka - supaya pilihannya bisa dibaca maksudnya. */
const LEBAR = {
  sm: 'max-w-sm',   // konfirmasi, pesan pendek
  md: 'max-w-lg',   // form satu kolom
  lg: 'max-w-2xl',  // form dua kolom
  xl: 'max-w-4xl',  // detail dengan panel samping
  penuh: 'max-w-7xl',
} as const;

/**
 * Lapisan tumpukan. Modal yang dibuka DARI DALAM modal lain harus naik satu
 * tingkat, kalau tidak ia ter-render tapi tertutup total - dan klik user
 * jatuh ke modal di belakangnya, terasa seperti tombolnya tidak berfungsi.
 */
const LAPISAN = {
  dasar: Z.overlay,
  atas: Z.overlayTop,
  maks: Z.overlayMax,
} as const;

export interface ModalProps {
  buka: boolean;
  onTutup: () => void;
  judul: React.ReactNode;
  /** Kalimat di bawah judul. Menjelaskan apa yang akan terjadi, bukan mengulang judulnya. */
  keterangan?: React.ReactNode;
  /** Ikon/lencana kecil di kiri judul. */
  ikon?: React.ReactNode;
  ukuran?: keyof typeof LEBAR;
  lapisan?: keyof typeof LAPISAN;
  /** Baris tombol di bawah. Urutannya Batal dulu, aksi utama terakhir. */
  footer?: React.ReactNode;
  /** Klik latar gelap menutup modal. Matikan untuk form yang isinya bisa hilang. */
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

  // Daftarkan diri ke tumpukan + kunci gulir, sebagai satu kesatuan: keduanya
  // hidup selama modal terbuka dan harus dilepas bersamaan.
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

  // Esc hanya menutup yang PALING ATAS. Tanpa pemeriksaan ini, satu tekan Esc
  // menutup seluruh tumpukan sekaligus - termasuk form di belakangnya.
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

  // Fokus masuk ke dalam modal saat dibuka, supaya Tab berikutnya berjalan di
  // dalam isinya dan pembaca layar membacakan judulnya.
  useEffect(() => {
    if (buka) badan.current?.focus();
  }, [buka]);

  // Jebakan fokus: Tab tidak boleh lompat ke konten di belakang overlay.
  // Sama seperti Esc, hanya berlaku untuk modal PALING ATAS di tumpukan -
  // modal di bawahnya memang tidak boleh diakses sama sekali selagi ada
  // modal lain di atasnya.
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
          className={`w-full ${LEBAR[ukuran]} bg-white rounded-kartu shadow-modal flex flex-col max-h-[90vh] outline-none`}
        >
          {/* ── Header ── */}
          <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0">
            {ikon && <div className="flex-shrink-0 mt-0.5">{ikon}</div>}
            <div className="flex-1 min-w-0">
              <h2 id={idJudul} className="text-sm font-bold text-slate-800 leading-snug">{judul}</h2>
              {keterangan && (
                <p id={idKeterangan} className="text-xs text-slate-500 mt-0.5 leading-relaxed">{keterangan}</p>
              )}
            </div>
            <button
              type="button" onClick={onTutup} aria-label="Tutup"
              className="w-8 h-8 rounded-kecil flex items-center justify-center flex-shrink-0 text-slate-400 hover:text-rose-600 transition-all"
              style={{ background: 'rgba(0,0,0,0.05)' }}
            >
              <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">{children}</div>

          {/* ── Footer ── */}
          {footer && (
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 flex-shrink-0 bg-slate-50/60">
              {footer}
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}

/**
 * Tombol footer baku.
 *
 * `jenis` menentukan MAKNA, bukan warna: 'utama' memakai warna merek (yang
 * bisa diganti tiap organisasi), 'bahaya' selalu merah karena arti merah
 * tidak boleh ikut berubah, dan 'batal' selalu tenang supaya aksi merusak
 * tidak pernah jadi tombol yang paling mencolok.
 */
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
