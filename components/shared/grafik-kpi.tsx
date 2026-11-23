'use client';

import { useEffect, useRef, useState } from 'react';

export const AKSEN_KPI = '#4f46e5';

export function HBarChart({ data, color, maxItems=6, lebarLabel='7rem' }: { data:{label:string;value:number}[]; color?:string; maxItems?:number; lebarLabel?:string }) {
  const top = data.slice(0, maxItems), max = Math.max(...top.map(d=>d.value), 1);
  return (
    <div className="flex flex-col gap-[7px]">
      {top.map((d,i) => (
        <div key={i} className="flex items-center gap-2">
          <span title={d.label} className="text-[11px] font-semibold shrink-0 text-right" style={{ color:'rgba(0,0,0,0.55)', width:lebarLabel, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.label}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(15,23,42,0.07)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width:`${(d.value/max)*100}%`, background: color ?? AKSEN_KPI }}/>
          </div>
          <span className="text-[11px] font-bold w-5 text-right shrink-0 tabular-nums" style={{ color:'rgba(0,0,0,0.6)' }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TrenBulanan({ data, viewW = 640, viewH = 168, warna = AKSEN_KPI }: { data: number[]; viewW?: number; viewH?: number; warna?: string }) {
  const MN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
  const cur = Math.min(new Date().getMonth(), 11);
  const wadah = useRef<HTMLDivElement>(null);
  const [lebar, setLebar] = useState(viewW);
  useEffect(() => {
    const el = wadah.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width); if (w > 0) setLebar(w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = lebar, H = viewH, pb = 22, pt = 24, sisi = 14;
  const mx = Math.max(...data, 1);
  const X = (i: number) => sisi + (i / 11) * (W - sisi * 2);
  const Y = (v: number) => pt + (1 - v / mx) * (H - pt - pb);
  const tt = data.slice(0, cur + 1).map((v, i) => [X(i), Y(v)] as const);
  const d  = tt.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const total = data.reduce((s, v) => s + v, 0);
  return (
    <div ref={wadah} className="w-full">
    <svg role="img" aria-label={`Trend ticket bulanan, total ${total} tiket`}
      width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: H, overflow: 'visible' }}>
      <defs><linearGradient id="trenIsi" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={warna} stopOpacity="0.26"/>
        <stop offset="1" stopColor={warna} stopOpacity="0"/>
      </linearGradient></defs>
      {[0, 0.5, 1].map(f => {
        const y = pt + f * (H - pt - pb);
        return <line key={f} x1={0} y1={y} x2={W} y2={y} stroke="rgba(15,23,42,0.07)" strokeWidth={1}/>;
      })}
      {tt.length > 1 && <path d={`${d} L ${X(cur)} ${H - pb} L ${X(0)} ${H - pb} Z`} fill="url(#trenIsi)"/>}
      <path d={d} fill="none" stroke={warna} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
      {cur < 11 && <line x1={X(cur)} y1={H - pb} x2={X(11)} y2={H - pb}
        stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="3 4"/>}
      {tt.map((p, i) => {
        const kini = i === cur;
        return <circle key={i} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r={kini ? 4 : 2.5}
          fill="#fff" stroke={warna} strokeWidth={kini ? 2.5 : 1.8}><title>{`${MN[i]}: ${data[i]} ticket`}</title></circle>;
      })}
      {tt.length > 0 && (
        <text x={X(cur)} y={Math.max(11, Y(data[cur] ?? 0) - 9)} textAnchor="middle"
          fontSize="11" fontWeight="800" fill={warna}>{data[cur] ?? 0}</text>
      )}
      {MN.map((m, i) => (
        <text key={m} x={X(i)} y={H - 6} textAnchor="middle" fontSize="9.5"
          fontWeight={i === cur ? 800 : 500} fill={i === cur ? warna : '#94a3b8'}>{m}</text>
      ))}
    </svg>
    </div>
  );
}
