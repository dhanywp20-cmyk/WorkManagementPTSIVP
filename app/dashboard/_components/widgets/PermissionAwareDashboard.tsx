'use client';

/**
 * PermissionAwareDashboard.tsx - Homepage adaptif berbasis permission.
 *
 * Flow (sesuai spec): Registry  Permission Resolver  Filter  Sort Priority
 * Compose  Render. Semua role memakai komponen INI (tidak ada dashboard
 * terpisah per role); yang berbeda hanya kumpulan widget hasil resolve dari
 * `allowed_menus`. Widget `full` (Analytics hero, Quick Action) dirender full
 * width; sisanya (lg/md/sm) di-grid responsif dengan `lg` melebar 2 kolom.
 */

import React from 'react';
import type { User } from '../shared';
import { WIDGETS, type WidgetDef } from './Widgets';

const SIZE_SPAN: Record<string, string> = {
  lg: 'sm:col-span-2 lg:col-span-2',
  md: '',
  sm: '',
};

export default function PermissionAwareDashboard({ currentUser, openMenu, openUrl }: {
  currentUser: User;
  openMenu: (key: string) => void;
  openUrl: (url: string, title: string) => void;
}) {
  // Resolve: filter by permission  sort by priority.
  const visible = WIDGETS
    .filter(w => w.permission(currentUser))
    .sort((a, b) => a.priority - b.priority);

  // Compose: pertahankan urutan priority, tapi kelompokkan widget non-full yang
  // berurutan ke dalam satu grid; widget `full` berdiri sendiri full width.
  const composed: ({ type: 'full'; widget: WidgetDef } | { type: 'grid'; widgets: WidgetDef[] })[] = [];
  let buffer: WidgetDef[] = [];
  const flush = () => { if (buffer.length) { composed.push({ type: 'grid', widgets: buffer }); buffer = []; } };
  for (const w of visible) {
    if (w.size === 'full') { flush(); composed.push({ type: 'full', widget: w }); }
    else buffer.push(w);
  }
  flush();

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = (currentUser.full_name ?? '').split(' ')[0];

  return (
    <div className="w-full h-full overflow-y-auto">
      {/* ── Header sambutan ──────────────────────────────────────────────────
          Dulu sambutan ini ikut terkurung di dalam kolom max-w-[1600px] yang
          sama dengan isi, jadi ia melayang di atas latar tanpa batas yang
          jelas — beda sendiri dari seluruh platform lain yang memakai bilah
          header penuh kiri-ke-kanan. Sekarang bilahnya membentang penuh dan
          menempel di atas seperti PageHeader di modul lain; hanya isinya yang
          tetap dibatasi lebarnya supaya sejajar dengan widget di bawahnya. */}
      <header className="sticky top-0 z-40"
        style={{ background: 'rgba(255,255,255,0.95)', borderBottom: '3px solid #b91c1c', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-2.5 md:py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-base md:text-xl font-black tracking-tight leading-tight text-slate-800">Halo, {firstName} 👋</h1>
            <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5">{today}</p>
          </div>
          <span className="text-[10px] md:text-[11px] font-semibold px-2.5 py-1 md:px-3 md:py-1.5 rounded-full bg-slate-100 text-slate-600 border border-black/5 flex-shrink-0">
            {visible.length} widget aktif
          </span>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-3 md:px-8 py-4 md:py-6 space-y-4 md:space-y-5">
        {composed.map((block, i) =>
          block.type === 'full' ? (
            <div key={`full-${block.widget.id}-${i}`}>
              <block.widget.Component user={currentUser} openMenu={openMenu} openUrl={openUrl} />
            </div>
          ) : (
            <div key={`grid-${i}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
              {block.widgets.map(w => (
                <div key={w.id} className={SIZE_SPAN[w.size] ?? ''}>
                  <w.Component user={currentUser} openMenu={openMenu} openUrl={openUrl} />
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
