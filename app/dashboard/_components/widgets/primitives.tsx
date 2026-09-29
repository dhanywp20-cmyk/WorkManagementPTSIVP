'use client';

/**
 * primitives.tsx - kontrak Widget (WidgetProps/WidgetDef) + UI dasar
 * (WidgetCard/EmptyState/Loading/PintasanBuat) yang dipakai widget lama
 * (Widgets.tsx) MAUPUN widget Work Center baru (../workcenter/).
 *
 * Dipisah dari Widgets.tsx supaya tidak muncul circular import: widget Work
 * Center perlu memakai primitif ini, dan Widgets.tsx (lewat WIDGETS registry)
 * perlu memuat widget Work Center - keduanya tidak bisa saling impor
 * langsung. File ini jadi titik yang cuma diimpor SATU ARAH oleh keduanya.
 */

import React from 'react';
import type { User } from '../shared';
import { Ikon } from '@/components/shared/Ikon';

// Kontrak widget

export interface WidgetProps {
  user: User;
  openMenu: (key: string) => void;            // buka menu by key (reuse handleMenuClick di page)
  openUrl: (url: string, title: string) => void; // buka halaman internal full-screen (mis. Analytics)
}

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

export interface WidgetDef {
  id: string;
  permission: (u: User) => boolean;
  priority: number;
  size: WidgetSize;
  Component: React.FC<WidgetProps>;
}

// UI primitives

/**
 * Permukaan SATU-SATUNYA untuk seluruh ubin dashboard - dipakai widget lama
 * (My Action, Team Monitoring, dll) MAUPUN ubin Analytics, lewat KELAS yang
 * sama persis: lihat UBIN & KEPALA_UBIN di bawah.
 *
 * Sebelumnya ada dua bahasa visual di satu layar: widget memakai bayangan
 * tebal (0 4px 20px) dengan chip ikon 32px, sementara kartu Analytics memakai
 * bayangan tipis, border slate, padding dan radius yang lain. Perbedaannya
 * kecil satu per satu, tapi berdampingan terbaca seperti dua aplikasi yang
 * ditempel jadi satu - itulah keluhan "tidak senada".
 */
export const UBIN = 'relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 flex flex-col min-w-0';
export const BAYANG_UBIN = '0 1px 2px rgba(15,23,42,0.04), 0 2px 12px rgba(15,23,42,0.04)';

/**
 * Satu warna aksen untuk seluruh beranda - tautan "Lihat →", tombol utama,
 * tab aktif, dan seri grafik tunggal. Warna modul tidak lagi dipakai sebagai
 * hiasan kartu; warna hanya membawa ARTI (status baik/buruk) di dalam data.
 */
export const AKSEN_UTAMA = '#1d4ed8';

/** Label kepala ubin: kecil, kapital, abu-abu - identitas kartu lewat teks, bukan warna. */
export const LABEL_UBIN = 'text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500';

/**
 * Rel aksen setebal 3px di tepi atas ubin - penanda IDENTITAS modul, bukan
 * sandi data: warnanya menjawab "ubin ini milik modul apa", sementara warna
 * di dalam grafik tetap menjawab "angka ini baik atau buruk". Keduanya tidak
 * pernah bertabrakan karena hidup di tempat berbeda.
 *
 * Ini yang membuat sederet ubin putih berhenti terbaca monoton tanpa harus
 * memberi tiap ubin permukaan, bayangan, atau radius yang berbeda-beda -
 * cara lama yang justru membuat satu layar terlihat seperti dua aplikasi.
 */
/*
  Dinonaktifkan pada gaya beranda "firm": rel berwarna berbeda di tiap ubin
  membuat satu layar terbaca seperti pelangi. Identitas ubin kini dibawa
  label kepalanya. Komponen dipertahankan supaya pemanggil lama tetap
  terkompilasi; cukup hapus pemanggilnya bila sudah tidak diperlukan.
*/
export function RelAksen(_props: { warna: string }) {
  return null;
}

export function WidgetCard({ title, icon, accent, children, onSeeAll, seeAllLabel }: {
  title: string; icon: string; accent: string;
  children: React.ReactNode; onSeeAll?: () => void; seeAllLabel?: string;
}) {
  return (
    <div className={`${UBIN} h-full`} style={{ boxShadow: BAYANG_UBIN }}>
      {/* icon & accent tetap diterima (kontrak widget lama) tapi tidak lagi
          dilukis sebagai chip berwarna - lihat LABEL_UBIN. */}
      <div className="flex items-center gap-2 mb-4" data-ikon={icon} data-aksen={accent}>
        <h3 className={`${LABEL_UBIN} truncate flex-1`}>{title}</h3>
        {onSeeAll && (
          <button onClick={onSeeAll}
            className="text-[12px] font-semibold flex-shrink-0 hover:underline underline-offset-2"
            style={{ color: AKSEN_UTAMA }}>
            {seeAllLabel ?? 'Lihat'} →
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

/**
 * Keadaan kosong. Bingkai putus-putus, bukan sekadar teks melayang di tengah
 * kotak putih: tanpa bingkai, ubin "Mendatang" yang memang tidak ada isinya
 * terbaca seperti ubin yang GAGAL memuat. Tingginya juga diturunkan (60->44)
 * karena tinggi minimum itulah yang membuat ubin kosong ikut setinggi ubin
 * berisi dan menyisakan rongga di kisi.
 */
export function EmptyState({ text, judul, aksi }: {
  text: string;
  /** Kalimat utama tebal di atas keterangan - seperti "Belum ada Pipeline". */
  judul?: string;
  /** Tombol ajakan opsional di bawah keterangan. */
  aksi?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 h-full min-h-[96px] px-4 py-5 text-center">
      {judul && <p className="text-[13px] font-bold text-slate-700">{judul}</p>}
      <p className={`text-[12px] text-slate-500 leading-relaxed max-w-[28ch] ${judul ? 'mt-1' : ''}`}>{text}</p>
      {aksi && (
        <button type="button" onClick={aksi.onClick}
          className="mt-3 text-[12px] font-bold text-white px-3.5 py-2 rounded-lg hover:brightness-110"
          style={{ background: AKSEN_UTAMA }}>
          {aksi.label}
        </button>
      )}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[80px]">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(29,78,216,0.18)', borderTopColor: AKSEN_UTAMA }} />
    </div>
  );
}

/**
 * Chip aksi cepat - PROPORSIONAL: lebar mengikuti isi (bukan flex-1/grid
 * yang dipaksa melebar), satu baris, ikon kecil. Dipakai flex-wrap supaya
 * banyak chip merapat sendiri lalu membungkus wajar di layar sempit - beda
 * dari pendekatan lama (grid tetap + tombol besar) yang membuang banyak
 * ruang kosong dan tidak proporsional di antara tombolnya.
 */
export function QuickActionChip({ label, icon, warna, onClick }: {
  label: string; icon: string; warna: string; onClick: () => void;
}) {
  return (
    /*  Netral, bukan blok warna penuh: enam tombol berwarna berbeda di satu
        baris adalah sumber "ramai" terbesar di beranda. Warna modul tinggal
        di ikon kecilnya saja. */
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-[12px] whitespace-nowrap transition-colors hover:bg-slate-50 hover:border-slate-300">
      <span aria-hidden="true" className="text-xs leading-none" style={{ color: warna }}><Ikon nama={icon} ukuran={14} /></span>
      <span>{label}</span>
    </button>
  );
}
