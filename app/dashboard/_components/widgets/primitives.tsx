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
 * Pintasan membuat data baru dari dashboard.
 *
 * Ikon kirim yang sama dengan tombol Submit Form di tiap platform, supaya
 * jelas sejak dari dashboard bahwa tombol ini bermuara ke sebuah form - bukan
 * ke tabel.
 */
export function PintasanBuat({ label, warna, onClick }: { label: string; warna: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-xl text-white font-bold text-xs transition-all hover:scale-[1.02] text-left"
      style={{ background: warna, boxShadow: `0 4px 14px ${warna}59` }}>
      <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.22)' }}>
        <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </span>
      <span className="leading-tight min-w-0 truncate">
        <span className="block opacity-80 text-[9px] font-semibold">Buat</span>
        <span className="block truncate">{label}</span>
      </span>
    </button>
  );
}
