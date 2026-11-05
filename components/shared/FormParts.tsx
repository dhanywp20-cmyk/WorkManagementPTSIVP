'use client';

import { Ikon } from './Ikon';

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#64748b' }}>{label}</span>
      {children}
    </label>
  );
}

export function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-1.5 pb-1.5 border-b" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
      <Ikon nama={icon} ukuran={14} className="text-slate-500" />
      <span className="text-xs font-bold tracking-wide text-slate-700">{title}</span>
    </div>
  );
}

export function SectionHeaderSmall({ icon, title }: { icon: string; title: string }) {
  return (
    <p className="text-[11px] font-bold tracking-widest uppercase flex items-center gap-1.5" style={{ color: '#64748b' }}>
      <Ikon nama={icon} ukuran={12} />{title}
    </p>
  );
}

export function InfoRow({ icon, label, value }: { icon: string; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <Ikon nama={icon} ukuran={16} className="text-slate-500" />
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: '#64748b' }}>{label}</p>
        <p className="text-sm font-semibold text-slate-800 break-words">{value}</p>
      </div>
    </div>
  );
}

export function InfoLine({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-2 border-b border-gray-100 last:border-0">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mr-1.5">{label}:</span>
      <span className="text-sm text-slate-800 font-medium">{value}</span>
    </div>
  );
}
