'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * Shared MiniPieChart — stroke-based donut, clickable untuk filter.
 * Dipakai di reminder-schedule, daily-report, dan platform lain.
 *
 * Props compatibility:
 * - data: array {label/name, value, color}. Mendukung kedua key untuk backward-compat.
 * - title + icon di header
 * - activeFilter (optional) untuk highlight slice yang sedang difilter
 * - onSliceClick (optional) untuk klik filter
 */

function DonutSVG({
  data,
  total,
  activeFilter,
  onSliceClick,
  hoveredLabel,
  setHoveredLabel,
}: {
  data: { label: string; value: number; color: string }[];
  total: number;
  activeFilter?: string | null;
  onSliceClick?: (label: string) => void;
  hoveredLabel: string | null;
  setHoveredLabel: (v: string | null) => void;
}) {
  const cx = 60, cy = 60, r = 44, sw = 15, gap = 1.8;
  let angle = -90;
  const filtered = data.filter(d => d.value > 0);
  const slices = filtered.map(d => {
    const pct = d.value / Math.max(total, 1);
    const sweep = Math.max(pct * 360 - (filtered.length > 1 ? gap : 0), 0.3);
    const start = angle;
    angle += pct * 360;
    return { ...d, start, end: start + sweep };
  });

  const arc = (s: number, e: number, ri: number) => {
    const sa = (s * Math.PI) / 180, ea = (e * Math.PI) / 180;
    const x1 = cx + ri * Math.cos(sa), y1 = cy + ri * Math.sin(sa);
    const x2 = cx + ri * Math.cos(ea), y2 = cy + ri * Math.sin(ea);
    return `M ${x1} ${y1} A ${ri} ${ri} 0 ${e - s > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };

  if (total === 0) return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw} />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="12" fontWeight="800" fill="#cbd5e1">0</text>
    </svg>
  );

  return (
    <svg width="120" height="120" viewBox="0 0 120 120" style={{ cursor: onSliceClick ? 'pointer' : 'default' }}>
      {/* track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
      {slices.map((s) => {
        const isActive = activeFilter === s.label;
        const isHovered = hoveredLabel === s.label;
        const dimmed = activeFilter != null && !isActive;
        const rr = isActive || isHovered ? r + 1.5 : r;
        const sww = isActive ? sw + 3 : isHovered ? sw + 1.5 : sw;
        return (
          <path
            key={s.label}
            d={arc(s.start, s.end, rr)}
            fill="none"
            stroke={s.color}
            strokeWidth={sww}
            strokeLinecap="round"
            opacity={dimmed ? 0.22 : 1}
            style={{
              transition: 'all 0.15s ease',
              filter: isActive ? `drop-shadow(0 0 4px ${s.color}99)` : undefined,
            }}
            onMouseEnter={() => setHoveredLabel(s.label)}
            onMouseLeave={() => setHoveredLabel(null)}
            onClick={() => onSliceClick?.(s.label)}
          />
        );
      })}
      {/* center text */}
      {(() => {
        const hl = hoveredLabel ?? activeFilter;
        const ds = hl ? data.find(d => d.label === hl) : null;
        return ds ? (
          <>
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize="15" fontWeight="900" fill={ds.color}>{ds.value}</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="6.5" fontWeight="700" fill={ds.color} opacity={0.75}>
              {ds.label.length > 11 ? ds.label.slice(0, 10) + '…' : ds.label}
            </text>
          </>
        ) : (
          <>
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize="16" fontWeight="800" fill="#1e293b">{total}</text>
            <text x={cx} y={cy + 16} textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="600">TOTAL</text>
          </>
        );
      })()}
    </svg>
  );
}

export function MiniPieChart({
  data, title, icon, activeFilter, onSliceClick,
}: {
  data: { label?: string; name?: string; value: number; color: string }[];
  title: string; icon: string;
  activeFilter?: string | null;
  onSliceClick?: (label: string) => void;
}) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Normalize: terima data dengan label atau name
  const normalized = data.map(d => ({ ...d, label: d.label ?? d.name ?? '' }));
  const total = normalized.reduce((s, d) => s + d.value, 0);
  const sorted = [...normalized].sort((a, b) => b.value - a.value);

  useEffect(() => {
    if (activeFilter && listRef.current) {
      const el = listRef.current.querySelector(`[data-label="${CSS.escape(activeFilter)}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeFilter]);

  if (total === 0) return (
    <div className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)' }}>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{icon} {title}</p>
      <p className="text-gray-400 text-sm text-center py-4">Belum ada data</p>
    </div>
  );

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.97)',
        border: activeFilter ? '1.5px solid rgba(220,38,38,0.22)' : '1px solid rgba(200,200,200,0.5)',
        boxShadow: activeFilter ? '0 4px 20px rgba(220,38,38,0.08)' : '0 2px 12px rgba(0,0,0,0.06)',
        backdropFilter: 'blur(10px)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
        <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">{icon} {title}</p>
        {activeFilter && onSliceClick && (
          <button
            onClick={() => onSliceClick(activeFilter)}
            className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: '#dc2626' }}
          >
            Reset ✕
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-3 flex items-center gap-2">
        {/* Donut */}
        <div className="flex-shrink-0">
          <DonutSVG
            data={normalized}
            total={total}
            activeFilter={activeFilter}
            onSliceClick={onSliceClick}
            hoveredLabel={hoveredLabel}
            setHoveredLabel={setHoveredLabel}
          />
        </div>

        {/* Legend */}
        <div
          ref={listRef}
          className="flex flex-col gap-1 flex-1 min-w-0 overflow-y-auto"
          style={{ maxHeight: 120 }}
        >
          {sorted.map((s) => {
            const isActive = activeFilter === s.label;
            const isHovered = hoveredLabel === s.label;
            const dimmed = activeFilter != null && !isActive;
            return (
              <div
                key={s.label}
                data-label={s.label}
                className="flex items-center gap-1.5 cursor-pointer rounded-lg px-1.5 py-0.5 transition-all"
                style={{
                  background: isActive ? `${s.color}20` : isHovered ? `${s.color}10` : 'transparent',
                  outline: isActive ? `1px solid ${s.color}60` : 'none',
                  opacity: dimmed ? 0.35 : 1,
                }}
                onMouseEnter={() => setHoveredLabel(s.label)}
                onMouseLeave={() => setHoveredLabel(null)}
                onClick={() => onSliceClick?.(s.label)}
              >
                <span
                  className="rounded-full flex-shrink-0 transition-all"
                  style={{
                    width: isActive ? 9 : 7,
                    height: isActive ? 9 : 7,
                    background: s.color,
                    boxShadow: isActive ? `0 0 0 2px ${s.color}40` : undefined,
                  }}
                />
                <span
                  className="truncate flex-1"
                  style={{ fontSize: '10px', fontWeight: isActive ? 700 : 600, color: isActive ? s.color : '#4b5563' }}
                >
                  {s.label}
                </span>
                <span
                  className="text-[10px] font-bold flex-shrink-0"
                  style={{ color: isActive ? s.color : '#1e293b' }}
                >
                  {s.value}
                </span>
                {isActive && <span className="text-[9px] font-bold flex-shrink-0" style={{ color: s.color }}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
