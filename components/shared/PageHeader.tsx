'use client';

import { ReactNode } from 'react';
import { Ikon } from './Ikon';
import { NETRAL } from '@/lib/desain';

interface PageHeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
  /** @deprecated Diabaikan - semua menu memakai warna merek (lihat komentar di bawah). */
  color?: string;
  /** @deprecated Diabaikan. */
  colorLight?: string;
  /** Right-side actions / buttons */
  children?: ReactNode;
}

/**
 * Shared sticky page header used across all platform modules.
 * Semua menu tampil sama: aksen & ubin ikon memakai warna merek.
 *
 * @example
 * <PageHeader icon="" title="Ticket Troubleshooting">
 *   <button>...</button>
 * </PageHeader>
 */
export function PageHeader({ icon, title, subtitle, children }: PageHeaderProps) {
  // Dirombak 2026-09-25: header putih solid di atas latar netral, garis
  // bawah tipis, ikon garis di ubin berwarna lembut. Dulu: blok gradien
  // berbayang + emoji + judul berwarna modul + garis bawah 3px - ramai
  // untuk elemen yang muncul di setiap halaman. Warna modul tetap dipakai
  // (ikon & aksen tipis) supaya identitas modul tidak hilang.
  // 2026-10: warna per modul dihapus - permintaan pemilik: tidak ada menu dengan
  // tema sendiri. Identitas menu cukup dari ikon & judul; warnanya warna merek.

  return (
    <header
      className="sticky top-0 z-50 animate-slide-down anim-d0"
      style={{
        background: NETRAL.permukaan,
        borderBottom: `1px solid ${NETRAL.garis}`,
        boxShadow: 'inset 0 2px 0 var(--merek-utama)',
      }}
    >
      {/* Ponsel: ringkas - padding kecil, subjudul disembunyikan, tombol aksi
          SATU baris yang bisa digeser. Dulu judul + tombol yang turun ke baris
          kedua/ketiga memakan ~1/4 layar sebelum isi halaman terlihat. */}
      <div className="max-w-[1600px] mx-auto px-4 py-2.5 sm:px-6 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
        {/* Left: icon + title */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--merek-utama-tembus)', color: 'var(--merek-utama)', border: '1px solid var(--merek-utama-tembus)' }}
          >
            <Ikon nama={icon} ukuran={18} />
          </div>
          <div>
            <h1
              className="text-[15px] sm:text-base font-bold tracking-tight leading-tight truncate"
              style={{ color: NETRAL.tinta }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="hidden sm:block text-[11px] font-medium" style={{ color: NETRAL.tinta2 }}>{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: action slot */}
        {children && (
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto sm:overflow-visible sm:flex-wrap -mx-4 px-4 sm:mx-0 sm:px-0 *:shrink-0"
            style={{ scrollbarWidth: 'none' }}>
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
