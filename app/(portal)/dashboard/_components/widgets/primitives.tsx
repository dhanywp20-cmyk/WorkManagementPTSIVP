'use client';

import React from 'react';
import type { User } from '../shared';
import { Ikon } from '@/components/shared/Ikon';

export interface WidgetProps {
  user: User;
  openMenu: (key: string) => void;
  openUrl: (url: string, title: string) => void;
}

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

export interface WidgetDef {
  id: string;
  permission: (u: User) => boolean;
  priority: number;
  size: WidgetSize;
  Component: React.FC<WidgetProps>;
}

import { UBIN, BAYANG_UBIN, AKSEN_UTAMA, LABEL_UBIN, RelAksen } from '@/components/shared/ubin';
export { UBIN, BAYANG_UBIN, AKSEN_UTAMA, LABEL_UBIN, RelAksen };

export function WidgetCard({ title, icon, accent, children, onSeeAll, seeAllLabel }: {
  title: string; icon: string; accent: string;
  children: React.ReactNode; onSeeAll?: () => void; seeAllLabel?: string;
}) {
  return (
    <div className={`${UBIN} h-full`} style={{ boxShadow: BAYANG_UBIN }}>
      <div className="flex items-center gap-2 mb-4">
        <h3 className={`${LABEL_UBIN} truncate flex-1`}>{title}</h3>
        {onSeeAll && (
          <button onClick={onSeeAll}
            className="text-[12px] font-semibold shrink-0 hover:underline underline-offset-2"
            style={{ color: AKSEN_UTAMA }}>
            {seeAllLabel ?? 'Lihat'} →
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

export function EmptyState({ text, judul, aksi }: {
  text: string;
  judul?: string;
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

export function QuickActionChip({ label, icon, warna, onClick }: {
  label: string; icon: string; warna: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold text-[12px] whitespace-nowrap transition-colors hover:bg-slate-50 hover:border-slate-300">
      <span aria-hidden="true" className="text-xs leading-none" style={{ color: warna }}><Ikon nama={icon} ukuran={14} /></span>
      <span>{label}</span>
    </button>
  );
}
