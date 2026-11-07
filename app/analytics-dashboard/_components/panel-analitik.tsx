'use client';
import { Ikon } from '@/components/shared/Ikon';

export function Panel({ title, icon, color, borderClr, count, children }: {
  title: string; icon: string; color: string; borderClr: string; count?: number; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'rgba(255,255,255,0.97)', border: `1px solid ${borderClr}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center gap-2 px-4 py-3 shrink-0"
        style={{ background: `${color}10`, borderBottom: `1px solid ${borderClr}` }}>
        <span className="text-base select-none"><Ikon nama={icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>
        <span className="font-bold text-sm flex-1" style={{ color }}>{title}</span>
        {count !== undefined && count > 0 && (
          <span className="text-[11px] font-black px-2 py-0.5 rounded-full text-white" style={{ background: color }}>
            {count}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto max-h-56 p-3 space-y-1.5">{children}</div>
    </div>
  );
}

export function Empty({ emoji, msg }: { emoji: string; msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <span className="text-3xl select-none"><Ikon nama={emoji} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>
      <p className="text-xs font-medium text-gray-500 text-center">{msg}</p>
    </div>
  );
}

export function Row({ dot, title, sub, badge, badgeBg, badgeColor, badgeBorder }: {
  dot: string; title: string; sub: string;
  badge?: string; badgeBg?: string; badgeColor?: string; badgeBorder?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 rounded-xl"
      style={{ background: `${dot}0C`, border: `1px solid ${dot}20` }}>
      <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: dot }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
        <p className="text-xs text-gray-500 truncate mt-0.5">{sub}</p>
      </div>
      {badge && (
        <span className="text-[11px] font-black px-1.5 py-0.5 rounded-sm whitespace-nowrap shrink-0 mt-0.5"
          style={{ background: badgeBg ?? '#f3f4f6', color: badgeColor ?? '#374151', border: `1px solid ${badgeBorder ?? '#d1d5db'}` }}>
          {badge}
        </span>
      )}
    </div>
  );
}

export const ACTION_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  create:        { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  approve:       { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  mark_done:     { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  Solved:        { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  update:        { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  assign:        { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  status_change: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  export:        { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  delete:        { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  reject:        { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  Overdue:       { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  login:         { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  logout:        { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  'In Progress': { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  'Waiting Approval': { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
};

export const MODULE_ICON: Record<string, string> = {
  ticket: '🎫', reminder: '📅', project: '🏗️', piket: '🏪',
  kpi: '📊', incentive: '💰', movement: '🚚', user: '👥',
  learning: '🎓', 'tech-note': '📝', 'form-review': '⭐',
  'daily-report': '📈', system: '⚙️',
};
