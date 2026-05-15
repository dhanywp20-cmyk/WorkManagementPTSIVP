'use client';

import React from 'react';

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IcoEye({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function IcoPen({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    </svg>
  );
}
function IcoTrash({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  );
}
function IcoCalendar({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  );
}
function IcoCopy({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}
function IcoCheck({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  );
}
function IcoBarChart({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
    </svg>
  );
}
function IcoPrinter({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9V2h12v7"/>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <path d="M6 14h12v8H6z"/>
    </svg>
  );
}
function IcoUnlock({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
    </svg>
  );
}
function IcoClock({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
    </svg>
  );
}

// ─── Base style — icon-only square button ─────────────────────────────────────
const base = 'inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed';

// ─── Action Button Components ─────────────────────────────────────────────────

export function ViewIconBtn({ onClick, title, label, disabled }: {
  onClick: () => void; title?: string; label?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={label || title || 'Lihat'} disabled={disabled}
      className={`${base} text-blue-600 bg-white border-slate-200 hover:bg-blue-50 hover:border-blue-200`}>
      <IcoEye />
    </button>
  );
}

export function EditIconBtn({ onClick, title, label, disabled }: {
  onClick: () => void; title?: string; label?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={label || title || 'Edit'} disabled={disabled}
      className={`${base} text-emerald-600 bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-200`}>
      <IcoPen />
    </button>
  );
}

export function DeleteIconBtn({ onClick, title, label, disabled }: {
  onClick: () => void; title?: string; label?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={label || title || 'Hapus'} disabled={disabled}
      className={`${base} text-rose-600 bg-white border-slate-200 hover:bg-rose-50 hover:border-rose-200`}>
      <IcoTrash />
    </button>
  );
}

export function RescheduleIconBtn({ onClick, title, label, disabled }: {
  onClick: () => void; title?: string; label?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={label || title || 'Reschedule'} disabled={disabled}
      className={`${base} text-amber-600 bg-white border-slate-200 hover:bg-amber-50 hover:border-amber-200`}>
      <IcoCalendar />
    </button>
  );
}

export function DuplicateIconBtn({ onClick, title, label, disabled }: {
  onClick: () => void; title?: string; label?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={label || title || 'Duplikat'} disabled={disabled}
      className={`${base} text-violet-600 bg-white border-slate-200 hover:bg-violet-50 hover:border-violet-200`}>
      <IcoCopy />
    </button>
  );
}

export function CompleteIconBtn({ onClick, title, label, disabled }: {
  onClick: () => void; title?: string; label?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={label || title || 'Selesai'} disabled={disabled}
      className={`${base} text-emerald-700 bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-200`}>
      <IcoCheck />
    </button>
  );
}

export function FlowchartIconBtn({ onClick, title = 'Flowchart / Riwayat', disabled }: {
  onClick: () => void; title?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`${base} text-indigo-600 bg-white border-slate-200 hover:bg-indigo-50 hover:border-indigo-200`}>
      <IcoBarChart />
    </button>
  );
}

export function PrintIconBtn({ onClick, title = 'Print PDF', disabled }: {
  onClick: () => void; title?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`${base} text-slate-500 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300`}>
      <IcoPrinter />
    </button>
  );
}

export function ApproveIconBtn({ onClick, title = 'Approve', disabled, pulse }: {
  onClick: () => void; title?: string; disabled?: boolean; pulse?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`${base} text-orange-500 bg-white border-orange-200 hover:bg-orange-50 hover:border-orange-300${pulse ? ' animate-pulse' : ''}`}>
      <IcoCheck />
    </button>
  );
}

export function ReopenIconBtn({ onClick, title = 'Re-open', disabled }: {
  onClick: () => void; title?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`${base} text-amber-600 bg-white border-slate-200 hover:bg-amber-50 hover:border-amber-200`}>
      <IcoUnlock />
    </button>
  );
}

export function OverdueIconBtn({ onClick, title = 'Overdue Setting', disabled, active }: {
  onClick: () => void; title?: string; disabled?: boolean; active?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`${base} ${active
        ? 'text-red-600 bg-white border-red-200 hover:bg-red-50 hover:border-red-300'
        : 'text-slate-400 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}>
      <IcoClock />
    </button>
  );
}

/**
 * Wrapper untuk action column — flex container standar
 */
export function ActionGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1 flex-wrap justify-center">{children}</div>;
}
