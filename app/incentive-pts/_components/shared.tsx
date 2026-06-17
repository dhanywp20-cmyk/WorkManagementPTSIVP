'use client';
// ─── Incentive PTS — Shared utilities & mini components ──────────────────────

import React from 'react';

export const INCENTIVE_CATEGORIES = ['Konfigurasi', 'Konfigurasi & Training', 'Training'];
export const INCENTIVE_TRIGGER_CATEGORIES = ['Konfigurasi', 'Konfigurasi & Training', 'Training'];

export const inputCls =
  'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';
export const btnPrimary =
  'px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02]';

export const fmtRp = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);

export const fmtPct = (n: number) => `${Number(n).toFixed(1)}%`;

export const fmtDate = (s?: string) =>
  s
    ? new Date(s).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';

export const fmtPeriode = (s?: string) => {
  if (!s) return '-';
  const [y, m] = s.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${months[parseInt(m) - 1]} ${y}`;
};

// ─── Badge ────────────────────────────────────────────────────────────────────
const BADGE_MAP: Record<string, string> = {
  green:  'bg-emerald-100 text-emerald-700 border border-emerald-200',
  amber:  'bg-amber-100 text-amber-700 border border-amber-200',
  blue:   'bg-blue-100 text-blue-700 border border-blue-200',
  gray:   'bg-gray-100 text-gray-600 border border-gray-200',
  red:    'bg-red-100 text-red-700 border border-red-200',
  purple: 'bg-purple-100 text-purple-700 border border-purple-200',
  indigo: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
};

export function Badge({
  color,
  children,
  square,
}: {
  color: string;
  children: React.ReactNode;
  square?: boolean;
}) {
  const rounded = square ? 'rounded' : 'rounded-full';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 ${rounded} text-[11px] font-semibold ${
        BADGE_MAP[color] ?? BADGE_MAP.gray
      }`}
    >
      {children}
    </span>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ background: color + '20' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}
