'use client';
import { f } from '../../bersama/ui';
import { type KotakLayar, type Panggung, SILUET, TINGGI_ORANG, teksUkur, VB_W } from './geometri';

export type KontenPanggung = 'contoh' | 'grid';
export interface OpsiGambar { penggaris: boolean; satuan: 'm' | 'ft'; konten: KontenPanggung; orang: boolean }

const n = (v: number) => Math.round(v * 10) / 10;
const HURUF = 'Segoe UI, Inter, Arial, sans-serif';

function GarisUkur({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const tegak = Math.abs(x1 - x2) < 0.5;
  const t = 5;
  return (
    <g stroke="#64748b" strokeWidth={1}>
      <line x1={n(x1)} y1={n(y1)} x2={n(x2)} y2={n(y2)} />
      {tegak
        ? <><line x1={n(x1 - t)} x2={n(x1 + t)} y1={n(y1)} y2={n(y1)} /><line x1={n(x2 - t)} x2={n(x2 + t)} y1={n(y2)} y2={n(y2)} /></>
        : <><line x1={n(x1)} x2={n(x1)} y1={n(y1 - t)} y2={n(y1 + t)} /><line x1={n(x2)} x2={n(x2)} y1={n(y2 - t)} y2={n(y2 + t)} /></>}
    </g>
  );
}

function LabelUkur({ x, y, teks, putar }: { x: number; y: number; teks: string; putar?: boolean }) {
  const w = teks.length * 6.2 + 10;
  return (
    <g transform={`translate(${n(x)} ${n(y)})${putar ? ' rotate(-90)' : ''}`}>
      <rect x={-w / 2} y={-9} width={w} height={18} rx={4} fill="#f8fafc" />
      <text y={4} textAnchor="middle" fontSize={11.5} fill="#334155" fontFamily={HURUF}>{teks}</text>
    </g>
  );
}

function IsiLayar({ k, id, konten }: { k: KotakLayar; id: string; konten: KontenPanggung }) {
  const grid = k.kolom <= 90 && k.baris <= 90;
  const garis = konten === 'grid' ? '#475569' : '#ffffff';
  const opa = konten === 'grid' ? 0.9 : 0.42;
  return (
    <g>
      {konten === 'contoh' ? (
        <>
          <rect x={n(k.x)} y={n(k.y)} width={n(k.w)} height={n(k.h)} fill={`url(#${id}-dasar)`} />
          <rect x={n(k.x)} y={n(k.y)} width={n(k.w)} height={n(k.h)} fill={`url(#${id}-merah)`} />
          <rect x={n(k.x)} y={n(k.y)} width={n(k.w)} height={n(k.h)} fill={`url(#${id}-sian)`} />
        </>
      ) : <rect x={n(k.x)} y={n(k.y)} width={n(k.w)} height={n(k.h)} fill="#0f172a" />}
      {grid && (
        <g stroke={garis} strokeOpacity={opa} strokeWidth={k.w / k.kolom > 14 ? 1 : 0.6}>
          {Array.from({ length: k.kolom - 1 }, (_, i) => { const x = n(k.x + ((i + 1) * k.w) / k.kolom); return <line key={`v${i}`} x1={x} x2={x} y1={n(k.y)} y2={n(k.y + k.h)} />; })}
          {Array.from({ length: k.baris - 1 }, (_, i) => { const y = n(k.y + ((i + 1) * k.h) / k.baris); return <line key={`h${i}`} y1={y} y2={y} x1={n(k.x)} x2={n(k.x + k.w)} />; })}
        </g>
      )}
      <rect x={n(k.x)} y={n(k.y)} width={n(k.w)} height={n(k.h)} fill="none" stroke="#0f172a" strokeWidth={2} />
    </g>
  );
}

export function GambarPanggung({ p, o, id, diagonal, multi }: { p: Panggung; o: OpsiGambar; id: string; diagonal: string; multi: boolean }) {
  const { dinding: d, kotak, orang, X, Y } = p;
  const u = kotak[0];
  const lantai = Y(0);
  const xTinggi = p.kananDinding + 46;
  const elev = lantai - (u.y + u.h);
  const ko = (orang.s * TINGGI_ORANG) / 170;
  return (
    <svg viewBox={`0 0 ${VB_W} ${n(p.vbH)}`} className="absolute inset-0 w-full h-full" role="img" aria-label="Gambar dinding dan layar LED">
      <defs>
        <linearGradient id={`${id}-dasar`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0b1a4a" /><stop offset="0.45" stopColor="#1e40af" /><stop offset="1" stopColor="#0e7490" />
        </linearGradient>
        <radialGradient id={`${id}-merah`} cx="0.72" cy="0.32" r="0.5">
          <stop offset="0" stopColor="#f472b6" stopOpacity="0.75" /><stop offset="1" stopColor="#f472b6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-sian`} cx="0.22" cy="0.78" r="0.55">
          <stop offset="0" stopColor="#38bdf8" stopOpacity="0.7" /><stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-dinding`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2e8f0" /><stop offset="1" stopColor="#d5dde8" />
        </linearGradient>
      </defs>
      <rect x={n(d.x)} y={n(d.y)} width={n(d.w)} height={n(d.h)} fill={`url(#${id}-dinding)`} />
      <line x1={n(X(-1.5))} x2={n(d.x + d.w + 20)} y1={n(lantai)} y2={n(lantai)} stroke="#94a3b8" strokeWidth={1.5} />
      {o.penggaris && (
        <g stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3 3">
          <line x1={n(u.x)} x2={n(u.x)} y1={n(u.y)} y2={p.garisAtas - 8} />
          <line x1={n(u.x + u.w)} x2={n(u.x + u.w)} y1={n(u.y)} y2={p.garisAtas - 8} />
          <line x1={n(u.x + u.w)} x2={xTinggi + 8} y1={n(u.y)} y2={n(u.y)} />
          <line x1={n(u.x + u.w)} x2={xTinggi + 8} y1={n(u.y + u.h)} y2={n(u.y + u.h)} />
        </g>
      )}
      {kotak.map((k, i) => <IsiLayar key={i} k={k} id={id} konten={o.konten} />)}
      {multi && kotak.map((k, i) => (
        <text key={`n${i}`} x={n(k.x + 4)} y={n(k.y - 6)} fontSize={11} fontWeight={700} fill="#1e3a8a" fontFamily={HURUF}>{k.nama}</text>
      ))}
      {o.penggaris && (
        <g>
          <line x1={n(u.x)} y1={n(u.y + u.h)} x2={n(u.x + u.w)} y2={n(u.y)} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1} strokeDasharray="6 4" />
          <text x={n(X(-1.5))} y={22} fontSize={13} fill="#0f172a" fontFamily={HURUF}>Diagonal: <tspan fontWeight={700}>{diagonal}</tspan></text>
          <GarisUkur x1={u.x} y1={p.garisAtas} x2={u.x + u.w} y2={p.garisAtas} />
          <GarisUkur x1={xTinggi} y1={u.y} x2={xTinggi} y2={u.y + u.h} />
          <GarisUkur x1={d.x - 16} y1={d.y} x2={d.x - 16} y2={lantai} />
          <LabelUkur x={d.x - 16} y={d.y + d.h / 2} teks={teksUkur(p.dindingH, o.satuan)} putar />
          <GarisUkur x1={d.x} y1={lantai + 26} x2={d.x + d.w} y2={lantai + 26} />
          <LabelUkur x={d.x + d.w / 2} y={lantai + 26} teks={`Dinding ${teksUkur(p.dindingW, o.satuan)}`} />
          {elev > 18 && (
            <>
              <GarisUkur x1={u.x + 14} y1={u.y + u.h} x2={u.x + 14} y2={lantai} />
              <LabelUkur x={u.x + 14} y={(u.y + u.h + lantai) / 2} teks={teksUkur((lantai - u.y - u.h) / p.s, o.satuan)} putar />
            </>
          )}
        </g>
      )}
      {o.orang && (
        <g>
          <g transform={`translate(${n(orang.x)} ${n(lantai - 170 * ko)}) scale(${ko})`} fill="#a8b3c2">
            <circle cx={0} cy={10} r={10} />
            <path d={SILUET} />
          </g>
          <text x={n(orang.x)} y={n(lantai + 44)} textAnchor="middle" fontSize={10.5} fill="#64748b" fontFamily={HURUF}>*Orang {f(TINGGI_ORANG * 100, 0)} cm</text>
        </g>
      )}
    </svg>
  );
}
