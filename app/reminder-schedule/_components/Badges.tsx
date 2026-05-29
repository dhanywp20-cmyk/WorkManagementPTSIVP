'use client';
import { Priority, Status, PRIORITY_CONFIG, STATUS_CONFIG, CATEGORY_CONFIG } from './shared';

export function PriorityBadge({ priority, onHeader }: { priority: Priority; onHeader?: boolean }) {
  const c = PRIORITY_CONFIG[priority];
  if (onHeader) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
        style={{ color: '#fff', background: c.dot, border: '2px solid rgba(255,255,255,0.6)', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
        {c.label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

export function StatusBadge({ status, onHeader }: { status: Status; onHeader?: boolean }) {
  const c = STATUS_CONFIG[status];
  const solidBg: Record<Status, string> = {
    pending: '#d97706',
    done: '#059669',
    cancelled: '#4b5563',
  };
  if (onHeader) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold"
        style={{ color: '#fff', background: solidBg[status], border: '2px solid rgba(255,255,255,0.6)', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
        {c.icon} {c.label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold"
      style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
}

export function CategoryBadge({ category, onHeader }: { category: string; onHeader?: boolean }) {
  const c = CATEGORY_CONFIG[category] ?? { icon: '📁', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.3)', accent: '#64748b' };
  if (onHeader) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
        style={{ color: '#fff', background: c.accent, border: '2px solid rgba(255,255,255,0.6)', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
        {c.icon} {category}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}>
      {c.icon} {category}
    </span>
  );
}
