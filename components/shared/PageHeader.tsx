'use client';

import { ReactNode } from 'react';
import { Ikon } from './Ikon';
import { NETRAL } from '@/lib/desain';

interface PageHeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
  /** Hex color for border accent and icon background gradient (e.g. '#dc2626') */
  color: string;
  /** Lighter shade for icon gradient end (optional, auto-derived if omitted) */
  colorLight?: string;
  /** Right-side actions / buttons */
  children?: ReactNode;
}

/**
 * Shared sticky page header used across all platform modules.
 * Enforces consistent visual identity per module through `color` prop.
 *
 * @example
 * <PageHeader icon="" title="Ticket Troubleshooting" color="#dc2626">
 *   <button>...</button>
 * </PageHeader>
 */
export function PageHeader({ icon, title, subtitle, color, colorLight, children }: PageHeaderProps) {
  // Dirombak 2026-09-25: header putih solid di atas latar netral, garis
  // bawah tipis, ikon garis di ubin berwarna lembut. Dulu: blok gradien
  // berbayang + emoji + judul berwarna modul + garis bawah 3px - ramai
  // untuk elemen yang muncul di setiap halaman. Warna modul tetap dipakai
  // (ikon & aksen tipis) supaya identitas modul tidak hilang.
  void colorLight;

  return (
    <header
      className="sticky top-0 z-50 animate-slide-down anim-d0"
      style={{
        background: NETRAL.permukaan,
        borderBottom: `1px solid ${NETRAL.garis}`,
        boxShadow: `inset 0 2px 0 ${color}`,
      }}
    >
      <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap">
        {/* Left: icon + title */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}14`, color, border: `1px solid ${color}26` }}
          >
            <Ikon nama={icon} ukuran={18} />
          </div>
          <div>
            <h1
              className="text-base font-bold tracking-tight leading-tight"
              style={{ color: NETRAL.tinta }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] font-medium" style={{ color: NETRAL.tinta2 }}>{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: action slot */}
        {children && (
          <div className="flex items-center gap-2 flex-wrap">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
