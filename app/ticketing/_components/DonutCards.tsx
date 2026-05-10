'use client';
import { useState } from 'react';
import { MiniPieChart } from '@/components/shared';

/**
 * 3 generic donut cards = thin wrappers di atas shared MiniPieChart.
 * HandlerDonutCard tetap unik karena ada teamToggle PTS/Services.
 * InfoLine direxport dari shared FormParts.
 */

export { InfoLine } from '@/components/shared';

// ── Status Donut Card ──────────────────────────────────────────────────────────
export function StatusDonutCard({
  data, total, onSliceClick, title, icon,
}: {
  data: { name: string; value: number; color: string }[];
  total: number;
  onSliceClick: (name: string) => void;
  title: string;
  icon: string;
}) {
  return (
    <MiniPieChart
      data={data}
      title={title}
      icon={icon}
      onSliceClick={onSliceClick}
    />
  );
}

// ── Sales Division Donut Card ─────────────────────────────────────────────────
export function SalesDivisionDonutCard({
  data, total, onSliceClick, activeDivision,
}: {
  data: { name: string; value: number; color: string }[];
  total: number;
  onSliceClick: (name: string) => void;
  activeDivision: string | null;
}) {
  return (
    <MiniPieChart
      data={data}
      title="Sales Division"
      icon="📊"
      activeFilter={activeDivision}
      onSliceClick={onSliceClick}
    />
  );
}

// ── Product Donut Card ─────────────────────────────────────────────────────
export function ProductDonutCard({
  data, total, onSliceClick, activeProduct,
}: {
  data: { name: string; value: number; color: string }[];
  total: number;
  onSliceClick: (name: string) => void;
  activeProduct: string | null;
}) {
  return (
    <MiniPieChart
      data={data}
      title="Product"
      icon="📦"
      activeFilter={activeProduct}
      onSliceClick={onSliceClick}
    />
  );
}

// ── Handler Donut Card (UNIK — ada teamToggle PTS/Services) ───────────────────
export function HandlerDonutCard({
  data,
  total,
  teamToggle,
  onToggle,
  onSliceClick,
  activeHandler,
  title,
  icon,
}: {
  data: { name: string; value: number; color: string }[];
  total: number;
  teamToggle: "PTS" | "Services";
  onToggle: (t: "PTS" | "Services") => void;
  onSliceClick: (name: string) => void;
  activeHandler: string | null;
  title: string;
  icon: string;
}) {
  const [hov, setHov] = useState<number | null>(null);
  let cumAngle = -Math.PI / 2;
  const cx = 60, cy = 60, r = 50, ir = 28;
  const slices = total > 0 ? data.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle), y1 = cy + r * Math.sin(cumAngle);
    const x2 = cx + r * Math.cos(cumAngle + angle), y2 = cy + r * Math.sin(cumAngle + angle);
    const xi1 = cx + ir * Math.cos(cumAngle), yi1 = cy + ir * Math.sin(cumAngle);
    const xi2 = cx + ir * Math.cos(cumAngle + angle), yi2 = cy + ir * Math.sin(cumAngle + angle);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ir} ${ir} 0 ${large} 0 ${xi1} ${yi1} Z`;
    cumAngle += angle;
    return { ...d, path, isFullCircle: false, i };
  }) : [];
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(255,255,255,0.8)", backdropFilter: "blur(10px)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">{icon} {title}</p>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(["PTS", "Services"] as const).map((t) => (
            <button key={t} onClick={() => onToggle(t)} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${teamToggle === t ? "bg-white shadow text-purple-600" : "text-gray-500 hover:text-gray-700"}`}>{t}</button>
          ))}
        </div>
      </div>
      {total === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">Belum ada data handler</p>
      ) : (
        <div className="flex items-center gap-3">
          <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0">
            {slices.map((s) =>
              s.isFullCircle ? (
                <g key={s.i} style={{ cursor: "pointer" }} onClick={() => onSliceClick(s.name)}
                  onMouseEnter={() => setHov(s.i)} onMouseLeave={() => setHov(null)}>
                  <circle cx={60} cy={60} r={50} fill={s.color}
                    opacity={hov === null || hov === s.i ? 1 : 0.45}
                    style={{ filter: hov === s.i ? `drop-shadow(0 0 4px ${s.color})` : "none" }} />
                  <circle cx={60} cy={60} r={28} fill="white" />
                </g>
              ) : (
                <path key={s.i} d={s.path} fill={s.color}
                  opacity={hov === null || hov === s.i ? 1 : 0.45}
                  style={{ cursor: "pointer", transition: "opacity 0.15s", filter: hov === s.i || activeHandler === s.name ? `drop-shadow(0 0 4px ${s.color})` : "none" }}
                  onMouseEnter={() => setHov(s.i)} onMouseLeave={() => setHov(null)} onClick={() => onSliceClick(s.name)} />
              )
            )}
            <text x="60" y="57" textAnchor="middle" fontSize="16" fontWeight="800" fill="#1e293b">{total}</text>
            <text x="60" y="70" textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="600">TOTAL</text>
          </svg>
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {slices.map((s) => (
              <div key={s.i} className="flex items-center gap-1.5 cursor-pointer rounded-lg px-1.5 py-0.5 transition-all"
                style={{ background: hov === s.i || activeHandler === s.name ? `${s.color}20` : "transparent", outline: activeHandler === s.name ? `1px solid ${s.color}` : "none" }}
                onMouseEnter={() => setHov(s.i)} onMouseLeave={() => setHov(null)} onClick={() => onSliceClick(s.name)}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="text-[10px] font-semibold text-gray-600 truncate flex-1">{s.name}</span>
                <span className="text-[10px] font-bold flex-shrink-0" style={{ color: s.color }}>{s.value}</span>
                {activeHandler === s.name && <span className="text-[9px] font-bold text-purple-600 flex-shrink-0">✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
