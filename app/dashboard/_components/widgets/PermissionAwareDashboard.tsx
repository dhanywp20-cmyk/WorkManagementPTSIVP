'use client';

/**
 * PermissionAwareDashboard.tsx — Homepage adaptif berbasis permission.
 *
 * Flow (sesuai spec): Registry → Permission Resolver → Filter → Sort Priority →
 * Compose → Render. Semua role memakai komponen INI (tidak ada dashboard
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
  // Resolve: filter by permission → sort by priority.
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
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 space-y-5">
        {/* Header sambutan — di atas background transparan, pakai text-shadow biar terbaca */}
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div style={{ textShadow: '0 1px 6px rgba(0,0,0,0.35)' }}>
            <h1 className="text-xl md:text-2xl font-black text-white">Halo, {firstName} 👋</h1>
            <p className="text-xs md:text-sm text-white/85 mt-0.5">{today}</p>
          </div>
          <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-white/85 text-slate-600 border border-black/5">
            {visible.length} widget aktif
          </span>
        </div>

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
