'use client';

import { ReactNode } from 'react';
import { Ikon } from './Ikon';
import { NETRAL } from '@/lib/desain';

interface PageHeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
  color?: string;
  colorLight?: string;
  children?: ReactNode;
}

export function PageHeader({ icon, title, subtitle, children }: PageHeaderProps) {

  return (
    <header
      className="sticky top-0 z-50 animate-slide-down anim-d0"
      style={{
        background: NETRAL.permukaan,
        borderBottom: `1px solid ${NETRAL.garis}`,
        boxShadow: 'inset 0 2px 0 var(--merek-utama)',
      }}
    >
      <div className="max-w-[1600px] mx-auto px-4 py-2.5 sm:px-6 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0"
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

        {children && (
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto sm:overflow-visible sm:flex-wrap -mx-4 px-4 sm:mx-0 sm:px-0 [&>*]:flex-shrink-0"
            style={{ scrollbarWidth: 'none' }}>
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
