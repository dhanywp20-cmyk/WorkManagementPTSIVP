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
export const UBIN = 'relative overflow-hidden rounded-[18px] bg-white border border-black/[0.07] p-4 flex flex-col min-w-0';
export const BAYANG_UBIN = '0 1px 2px rgba(15,23,42,0.04), 0 10px 26px -18px rgba(15,23,42,0.30)';

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
export function RelAksen({ warna }: { warna: string }) {
  return <span aria-hidden="true" className="absolute left-0 right-0 top-0 h-[3px]" style={{ background: warna }} />;
}

export function WidgetCard({ title, icon, accent, children, onSeeAll, seeAllLabel }: {
  title: string; icon: string; accent: string;
  children: React.ReactNode; onSeeAll?: () => void; seeAllLabel?: string;
}) {
  return (
    <div className={`${UBIN} h-full`} style={{ boxShadow: BAYANG_UBIN }}>
      <RelAksen warna={accent} />
      <div className="flex items-center gap-2 mb-3">
        <div className="w-[26px] h-[26px] rounded-[9px] flex items-center justify-center text-[13px] flex-shrink-0"
          style={{ background: `${accent}1a`, color: accent }}>{icon}</div>
        <h3 className="font-extrabold text-slate-900 text-[12.5px] tracking-[-0.01em] truncate flex-1">{title}</h3>
        {onSeeAll && (
          <button onClick={onSeeAll}
            className="text-[11px] font-semibold px-2 py-1 rounded-lg transition-all hover:scale-[1.03] flex-shrink-0"
            style={{ background: `${accent}14`, color: accent }}>
            {seeAllLabel ?? 'Lihat semua'} →
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
export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center min-h-[44px] rounded-xl px-3 py-3 text-[11px] text-slate-400 text-center"
      style={{ border: '1px dashed rgba(15,23,42,0.10)', background: 'rgba(15,23,42,0.015)' }}>
      {text}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[80px]">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(226,168,75,0.25)', borderTopColor: '#e2a84b' }} />
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
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white font-bold text-[11px] whitespace-nowrap transition-all hover:brightness-110 hover:scale-[1.03]"
      style={{ background: warna, boxShadow: `0 2px 8px ${warna}4d` }}>
      <span aria-hidden="true" className="text-xs leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
