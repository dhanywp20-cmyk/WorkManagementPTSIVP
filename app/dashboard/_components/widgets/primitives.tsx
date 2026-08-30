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

export function WidgetCard({ title, icon, accent, children, onSeeAll, seeAllLabel }: {
  title: string; icon: string; accent: string;
  children: React.ReactNode; onSeeAll?: () => void; seeAllLabel?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/95 backdrop-blur-sm shadow-lg border border-black/5 p-4 flex flex-col h-full"
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{ background: `${accent}1a`, color: accent }}>{icon}</div>
        <h3 className="font-bold text-slate-800 text-sm truncate flex-1">{title}</h3>
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

export function EmptyState({ text }: { text: string }) {
  return <div className="flex items-center justify-center h-full min-h-[60px] text-[11px] text-slate-400 text-center px-2">{text}</div>;
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
