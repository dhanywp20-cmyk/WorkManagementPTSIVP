'use client';

import { WARNA } from '@/lib/desain';

export function MiniSpark({
  values, color = '#3b82f6', width = 56, height = 18,
}: {
  values: number[]; color?: string; width?: number; height?: number;
}) {
  if (values.length === 0) return <svg width={width} height={height} aria-hidden="true" />;
  const max = Math.max(...values, 1);
  const bw = Math.max(2, Math.floor(width / values.length) - 1);
  return (
    <svg width={width} height={height} className="flex-shrink-0"
      role="img" aria-label={`Tren ${values.length} periode terakhir`}>
      {values.map((v, i) => {
        const bh = Math.max(2, (v / max) * height);
        return (
          <rect key={i} x={i * (bw + 1)} y={height - bh} width={bw} height={bh} rx={1}
            fill={color} opacity={0.35 + (i / values.length) * 0.65} />
        );
      })}
    </svg>
  );
}

const BULAN = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const BULAN_PANJANG = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function MonthBarChart({
  values, color, labels, highlightIndex, height = 72,
}: {
  values: number[]; color: string; labels?: string[];
  highlightIndex?: number; height?: number;
}) {
  const max = Math.max(...values, 1);
  const sorot = highlightIndex ?? new Date().getMonth();
  const teks = labels ?? BULAN;
  const idxPuncak = values.indexOf(Math.max(...values));
  const LABEL_ATAS = 12;
  const tinggiPlot = Math.max(24, height - LABEL_ATAS);
  return (
    <div role="img" aria-label={`Per bulan: ${values.map((v, i) => `${labels?.[i] ?? BULAN_PANJANG[i] ?? i + 1} ${v}`).join(', ')}`}>
      <div className="relative flex items-end gap-[2px] border-b border-slate-200" style={{ height: tinggiPlot + LABEL_ATAS }}>
        {values.map((v, i) => {
          const bh = v > 0 ? Math.max(2, (v / max) * tinggiPlot) : 0;
          const kini = i === sorot;
          const tampilkanNilai = v > 0 && (kini || i === idxPuncak);
          const nama = labels?.[i] ?? BULAN_PANJANG[i] ?? String(i + 1);
          return (
            <div key={i} className="group relative flex-1 h-full flex flex-col items-center justify-end">
              {tampilkanNilai && (
                <span className={`text-[10px] leading-none mb-0.5 tabular-nums ${kini ? 'font-bold text-slate-800' : 'font-medium text-slate-500'}`}>{v}</span>
              )}
              <div className="w-full rounded-t-[3px] transition-[height] duration-500"
                style={{ height: bh, background: color, opacity: kini ? 1 : 0.32 }} />
              <span className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {nama}: {v}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-[2px] mt-1">
        {values.map((_, i) => (
          <span key={i} className={`flex-1 text-center text-[10px] leading-none ${i === sorot ? 'font-bold text-slate-700' : 'text-slate-500'}`}>{teks[i] ?? ''}</span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  segments, size = 68, strokeWidth = 8, label = '',
}: {
  segments: { value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const r = (size - strokeWidth) / 2, circ = 2 * Math.PI * r;
  const isi = segments.filter(s => s.value > 0);
  const total = isi.reduce((s, x) => s + x.value, 0);

  if (!total) {
    return (
      <div style={{ width: size, height: size }}
        className="flex items-center justify-center flex-shrink-0">
        <span className="text-[11px] text-slate-400 font-bold">—</span>
      </div>
    );
  }

  const celah = isi.length > 1 ? 2 : 0;
  let cum = 0;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg aria-hidden="true" focusable="false" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        {isi.map((seg, i) => {
          const panjang = (seg.value / total) * circ;
          const dash = Math.max(0, panjang - celah);
          const offset = -(cum / total) * circ;
          cum += seg.value;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={seg.color}
              strokeWidth={strokeWidth} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={offset} />
          );
        })}
      </svg>
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[12px] font-bold text-slate-800">{label}</span>
        </div>
      )}
    </div>
  );
}

export function TrendBadge({
  delta, lowerIsBetter = false, suffix = '%',
}: {
  delta: number; lowerIsBetter?: boolean; suffix?: string;
}) {
  const abs = Math.abs(delta);
  if (abs < 0.05) {
    return <span className="text-[11px] text-slate-500 font-medium">— 0{suffix}</span>;
  }
  const bagus = lowerIsBetter ? delta < 0 : delta > 0;
  const panah = delta > 0 ? '▲' : '▼';
  return (
    <span className="text-[11px] font-bold flex-shrink-0"
      style={{ color: bagus ? WARNA.berhasil.teks : WARNA.bahaya.teks }}
      title={`${bagus ? 'Membaik' : 'Memburuk'} ${abs.toFixed(1)}${suffix} dibanding periode sebelumnya`}>
      {panah} {abs.toFixed(1)}{suffix}
    </span>
  );
}

export function hitungDelta(sekarang: number, sebelumnya: number): number {
  if (sebelumnya === 0) return sekarang === 0 ? 0 : 100;
  return ((sekarang - sebelumnya) / sebelumnya) * 100;
}
