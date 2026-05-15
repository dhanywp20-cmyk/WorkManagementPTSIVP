'use client';

import React from 'react';

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IcoEye({ s = 12 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function IcoPen({ s = 12 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    </svg>
  );
}
function IcoTrash({ s = 12 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  );
}
function IcoCalendar({ s = 12 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  );
}
function IcoCopy({ s = 12 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}
function IcoCheck({ s = 12 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  );
}

// ─── Base style ───────────────────────────────────────────────────────────────
const base = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-all duration-150 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed';

// ─── Action Button Components ─────────────────────────────────────────────────

export function ViewIconBtn({ onClick, title = 'Lihat', label = 'Lihat', disabled }: {
  onClick: () => void; title?: string; label?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`${base} text-blue-600 bg-white border-slate-200 hover:bg-blue-50 hover:border-blue-200`}>
      <IcoEye />{label}
    </button>
  );
}

export function EditIconBtn({ onClick, title = 'Edit', label = 'Edit', disabled }: {
  onClick: () => void; title?: string; label?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`${base} text-emerald-600 bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-200`}>
      <IcoPen />{label}
    </button>
  );
}

export function DeleteIconBtn({ onClick, title = 'Hapus', label = 'Hapus', disabled }: {
  onClick: () => void; title?: string; label?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`${base} text-rose-600 bg-white border-slate-200 hover:bg-rose-50 hover:border-rose-200`}>
      <IcoTrash />{label}
    </button>
  );
}

export function RescheduleIconBtn({ onClick, title = 'Reschedule', label = 'Reschedule', disabled }: {
  onClick: () => void; title?: string; label?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`${base} text-amber-600 bg-white border-slate-200 hover:bg-amber-50 hover:border-amber-200`}>
      <IcoCalendar />{label}
    </button>
  );
}

export function DuplicateIconBtn({ onClick, title = 'Duplikat', label = 'Duplikat', disabled }: {
  onClick: () => void; title?: string; label?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`${base} text-violet-600 bg-white border-slate-200 hover:bg-violet-50 hover:border-violet-200`}>
      <IcoCopy />{label}
    </button>
  );
}

export function CompleteIconBtn({ onClick, title = 'Selesai', label = 'Selesai', disabled }: {
  onClick: () => void; title?: string; label?: string; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`${base} text-emerald-700 bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-200`}>
      <IcoCheck />{label}
    </button>
  );
}

/**
 * Wrapper untuk action column — flex container standar
 */
export function ActionGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1.5 flex-wrap">{children}</div>;
}
