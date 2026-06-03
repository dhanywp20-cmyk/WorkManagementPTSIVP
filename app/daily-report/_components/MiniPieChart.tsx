'use client';

import { useState, useRef, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

export interface MiniPieChartProps {
  data: PieSlice[];
  title: string;
  icon: string;
  activeFilter: string | null;
  onSliceClick: (label: string) => void;
}

// ─── Donut SVG ────────────────────────────────────────────────────────────────

function DonutSVG({
  data,
  total,
  activeFilter,
  onSliceClick,
  hoveredLabel,
  setHoveredLabel,
}: {
  data: PieSlice[];
  total: number;
  activeFilter: string | null;
  onSliceClick: (label: string) => void;
  hoveredLabel: string | null;
  setHoveredLabel: (v: string | null) => void;
}) {
  const cx = 50, cy = 50, r = 36;
  const sw = 13; // strokeWidth
  const gap = 1.5; // degree gap between slices

  let angle = -90;
  const filtered = data.filter(d => d.value > 0);
  const slices = filtered.map(d => {
    const pct = d.value / Math.max(total, 1);
    const sweep = Math.max(pct * 360 - (filtered.length > 1 ? gap : 0), 0.3);
    const start = angle;
    angle += pct * 360;
    return { ...d, start, end: start + sweep, pct };
  });

  const arc = (s: number, e: number) => {
    const sa = (s * Math.PI) / 180;
    const ea = (e * Math.PI) / 180;
    const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea);
    const lg = e - s > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2}`;
  };

  if (total === 0) {
    return (
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', cursor: 'pointer' }}>
      {/* track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
      {slices.map((s) => {
        const isActive = activeFilter === s.label;
        const isHovered = hoveredLabel === s.label;
        const dimmed = activeFilter !== null && !isActive;
        const rr = isActive || isHovered ? r + 1 : r;
        const sww = isActive ? sw + 2 : isHovered ? sw + 1 : sw;
        return (
          <path
            key={s.label}
            d={arc(s.start, s.end)}
            fill="none"
            stroke={s.color}
            strokeWidth={sww}
            strokeLinecap="round"
            opacity={dimmed ? 0.28 : 1}
            style={{
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              filter: isActive ? `drop-shadow(0 0 3px ${s.color}88)` : undefined,
            }}
            onMouseEnter={() => setHoveredLabel(s.label)}
            onMouseLeave={() => setHoveredLabel(null)}
            onClick={() => onSliceClick(s.label)}
          />
        );
      })}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MiniPieChart({ data, title, icon, activeFilter, onSliceClick }: MiniPieChartProps) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const total = data.reduce((s, d) => s + d.value, 0);
  const sorted = [...data].sort((a, b) => b.value - a.value);

  // Scroll active item into view
  useEffect(() => {
    if (activeFilter && listRef.current) {
      const el = listRef.current.querySelector(`[data-label="${activeFilter}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeFilter]);

  const displayLabel = hoveredLabel ?? activeFilter;
  const displaySlice = displayLabel ? data.find(d => d.label === displayLabel) : null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.97)',
        border: activeFilter ? '1.5px solid rgba(220,38,38,0.25)' : '1px solid rgba(200,200,200,0.5)',
        boxShadow: activeFilter
          ? '0 4px 20px rgba(220,38,38,0.1)'
          : '0 2px 12px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between border-b"
        style={{ borderColor: 'rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{icon}</span>
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{title}</span>
        </div>
        {activeFilter && (
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
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Donut */}
        <div className="relative flex-shrink-0" style={{ width: 82, height: 82 }}>
          <DonutSVG
            data={data}
            total={total}
            activeFilter={activeFilter}
            onSliceClick={onSliceClick}
            hoveredLabel={hoveredLabel}
            setHoveredLabel={setHoveredLabel}
          />
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {displaySlice ? (
              <>
                <span
                  className="text-sm font-black leading-none"
                  style={{ color: displaySlice.color }}
                >
                  {displaySlice.value}
                </span>
                <span
                  className="text-[8px] font-bold mt-0.5 max-w-[52px] text-center leading-tight"
                  style={{ color: displaySlice.color, opacity: 0.8 }}
                >
                  {displaySlice.label.length > 10
                    ? displaySlice.label.slice(0, 9) + '…'
                    : displaySlice.label}
                </span>
              </>
            ) : (
              <>
                <span className="text-base font-black text-slate-800 leading-none">{total}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">Total</span>
              </>
            )}
          </div>
        </div>

        {/* Legend list */}
        <div
          ref={listRef}
          className="flex-1 space-y-1 overflow-y-auto"
          style={{ maxHeight: 90 }}
        >
          {sorted.map(({ label, value, color }) => {
            const isActive = activeFilter === label;
            const isHovered = hoveredLabel === label;
            const dimmed = activeFilter !== null && !isActive;
            return (
              <div
                key={label}
                data-label={label}
                className="flex items-center justify-between gap-1.5 rounded-lg px-1.5 py-0.5 cursor-pointer transition-all"
                style={{
                  background: isActive
                    ? `${color}18`
                    : isHovered
                    ? `${color}0d`
                    : 'transparent',
                  opacity: dimmed ? 0.4 : 1,
                }}
                onClick={() => onSliceClick(label)}
                onMouseEnter={() => setHoveredLabel(label)}
                onMouseLeave={() => setHoveredLabel(null)}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="flex-shrink-0 rounded-full"
                    style={{
                      width: isActive ? 9 : 7,
                      height: isActive ? 9 : 7,
                      background: color,
                      boxShadow: isActive ? `0 0 0 2px ${color}40` : undefined,
                      transition: 'all 0.15s ease',
                    }}
                  />
                  <span
                    className="truncate"
                    style={{
                      fontSize: '11px',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? color : '#475569',
                    }}
                  >
                    {label}
                  </span>
                </div>
                <span
                  className="flex-shrink-0 text-[11px] font-bold"
                  style={{ color: isActive ? color : '#1e293b' }}
                >
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MiniPieChart;
