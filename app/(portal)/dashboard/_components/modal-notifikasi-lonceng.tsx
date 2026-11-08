'use client';
import { Ikon } from '@/components/shared/Ikon';
import { useEffect, useRef, useState } from 'react';
import { NotifBellProps } from './shared';

export function NotifBell({ icon: Icon, label, count, color, bgColor, borderColor, dotColor, items, onItemClick, onMarkAllRead }: NotifBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const tutup = () => setOpen(false);
    const saatEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    window.addEventListener('blur', tutup);
    document.addEventListener('keydown', saatEscape);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('blur-sm', tutup);
      document.removeEventListener('keydown', saatEscape);
    };
  }, []);

  const formatTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins}m lalu`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}j lalu`;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={`${label}: ${count} notifikasi`} title={label}
        className="relative flex items-center gap-2 px-3 py-2 rounded-xl transition-colors duration-200 hover:bg-slate-50 active:scale-95"
        style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #e2e8f0' }}
      >
        <Icon className="w-4 h-4 shrink-0" style={{ color: count > 0 ? color : '#94a3b8' }} />
        <span className="text-xs font-bold hidden 2xl:block text-slate-700">{label}</span>
        {count > 0 && (
          <span className="flex items-center justify-center rounded-full text-white font-bold text-[11px] min-w-[18px] h-[18px] px-1 bg-slate-700">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 z-40 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: 320,
            background: 'rgba(255,255,255,0.97)',
            border: `1.5px solid ${borderColor}`,
            backdropFilter: 'blur(16px)',
            boxShadow: `0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px ${borderColor}33`,
            animation: 'dropIn 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: bgColor, borderBottom: `1px solid ${borderColor}44` }}>
            <div className="flex items-center gap-2">
              <Icon className="w-[18px] h-[18px] shrink-0" style={{ color }} />
              <span className="text-sm font-bold" style={{ color }}>{label}</span>
            </div>
            {count > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black text-white" style={{ background: dotColor }}>{count} baru</span>
            )}
          </div>
          {onMarkAllRead && count > 0 && (
            <button onClick={() => onMarkAllRead()}
              className="w-full text-center py-2 text-[11px] font-bold hover:bg-slate-50 transition-colors border-b border-slate-100"
              style={{ color }}>
              ✓ Tandai semua dibaca
            </button>
          )}
          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="text-3xl opacity-40"><Ikon nama="✅" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <p className="text-xs text-slate-500 font-medium">Tidak ada notifikasi</p>
              </div>
            ) : (
              items.map((item) => (
                <button key={item.id} onClick={() => { onItemClick(item); setOpen(false); }}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100/80 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{item.title}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                  </div>
                  <span className="text-[11px] text-slate-500 shrink-0 mt-0.5">{formatTime(item.time)}</span>
                </button>
              ))
            )}
          </div>
          {items.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100">
              <p className="text-[11px] text-center text-slate-500 font-medium">Klik item untuk membuka</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
