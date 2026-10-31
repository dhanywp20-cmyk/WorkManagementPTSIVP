'use client';

/**
 * dimensi.tsx - komponen beranda bergaya "3D" (permintaan pemilik: dashboard dengan benda 3D & animasi,
 * tetap TERANG dan senada merek - bukan mode gelap).
 *
 *   AngkaNaik         angka berhitung naik saat tampil
 *   MeteranSetengah   meteran setengah lingkaran bersegmen yang mengisi (gaya "Sprint Velocity")
 *   IkonTimbul        ikon di atas "ubin tanah liat" bergradasi dengan bayangan berwarna
 *   KartuAngka3D      kartu angka timbul (bisa dipilih) - dipakai tab Agenda
 *   TumpukanPeringkat kartu bertumpuk berperspektif, teratas paling timbul (gaya "Time Sheet")
 *
 * Gerak dihentikan bila perangkat meminta gerak dikurangi (prefers-reduced-motion).
 * `transform` hanya dipakai pada elemen DAUN (tombol/kartu kecil) - tidak pada ubin yang mungkin
 * memuat popup `fixed` (lihat catatan .dasbor-3d di app/globals.css).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Ikon } from '@/components/shared/Ikon';

const geraKurang = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Nilai yang bergerak dari 0 (atau nilai sebelumnya) ke `target` dengan perlambatan di akhir. */
export function useHitungNaik(target: number, durasi = 900): number {
  const [nilai, setNilai] = useState(0);
  const dari = useRef(0);
  useEffect(() => {
    if (geraKurang()) { dari.current = target; setNilai(target); return; }
    const awal = dari.current, t0 = performance.now();
    let raf = 0;
    const langkah = (t: number) => {
      const p = Math.min(1, (t - t0) / durasi), e = 1 - Math.pow(1 - p, 3);
      const v = awal + (target - awal) * e;
      setNilai(v);
      if (p < 1) raf = requestAnimationFrame(langkah); else dari.current = target;
    };
    raf = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(raf);
  }, [target, durasi]);
  return nilai;
}

export function AngkaNaik({ nilai, akhiran = '', className = '' }: { nilai: number; akhiran?: string; className?: string }) {
  const v = useHitungNaik(nilai);
  return <span className={`tabular-nums ${className}`}>{Math.round(v)}{akhiran}</span>;
}

/** Busur SVG dari sudut a0 ke a1 (derajat, 180 = kiri, 0 = kanan) pada lingkaran (cx, cy, r). */
function busur(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const rad = (a: number) => (a * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad(a0)), y0 = cy - r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1)), y1 = cy - r * Math.sin(rad(a1));
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
}

const SEGMEN = ['#8b5cf6', '#2dd4bf', '#f59e0b', '#3b82f6', '#f43f5e'];

/**
 * Meteran setengah lingkaran: 5 segmen berwarna; bagian yang belum tercapai abu-abu. Mengisi dari
 * kiri saat tampil. `pct` 0..100.
 */
export function MeteranSetengah({ pct, label, sub, ariaLabel }: { pct: number; label: string; sub?: string; ariaLabel: string }) {
  const v = useHitungNaik(Math.max(0, Math.min(100, pct)), 1100);
  const cx = 70, cy = 66, r = 54, celah = 4;
  const per = (180 - celah * (SEGMEN.length - 1)) / SEGMEN.length;
  const batas = 180 - (v / 100) * 180; // sudut ujung isian (dari 180 turun ke 0)
  return (
    <div className="relative w-[148px] flex-shrink-0" role="img" aria-label={ariaLabel}>
      <svg viewBox="0 0 140 76" className="w-full overflow-visible" aria-hidden="true">
        {SEGMEN.map((w, i) => {
          const a0 = 180 - i * (per + celah), a1 = a0 - per;
          const isi0 = a0, isi1 = Math.max(a1, batas);
          return (
            <g key={w}>
              <path d={busur(cx, cy, r, a0, a1)} fill="none" stroke="#e8edf3" strokeWidth="9" strokeLinecap="round" />
              {isi1 < isi0 && (
                <path d={busur(cx, cy, r, isi0, isi1)} fill="none" stroke={w} strokeWidth="9" strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 2px 3px ${w}66)` }} />
              )}
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center leading-none">
        <span className="text-[22px] font-extrabold text-slate-900 tabular-nums">{label}</span>
        {sub && <span className="text-[11px] font-semibold text-slate-500 mt-1 tabular-nums">{sub}</span>}
      </div>
    </div>
  );
}

/** Ikon di atas ubin "tanah liat": gradasi warna modul, kilau atas, bayangan berwarna di bawahnya. */
export function IkonTimbul({ ikon, warna, ukuran = 36 }: { ikon: string; warna: string; ukuran?: number }) {
  return (
    <span aria-hidden="true" className="ikon-timbul grid place-items-center flex-shrink-0 text-white"
      style={{ width: ukuran, height: ukuran, ['--warna-ikon' as string]: warna }}>
      <Ikon nama={ikon} ukuran={Math.round(ukuran * 0.5)} />
    </span>
  );
}

/** Kartu angka timbul yang bisa dipilih (tab). Aktif = ring warna + terangkat. */
export function KartuAngka3D({ label, nilai, ikon, warna, aktif, onClick }: {
  label: string; nilai: number; ikon: string; warna: string; aktif: boolean; onClick: () => void;
}) {
  return (
    <button type="button" role="tab" aria-selected={aktif} onClick={onClick}
      className={`kartu-angka-3d group text-left ${aktif ? 'aktif' : ''}`} style={{ ['--warna-ikon' as string]: warna }}>
      <span className="block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-[0.06em] sm:tracking-[0.08em] text-slate-500 truncate">{label}</span>
      <span className="mt-2 flex items-end justify-between gap-2">
        <AngkaNaik nilai={nilai} className="text-[26px] sm:text-[30px] leading-none font-extrabold tracking-tight text-slate-900" />
        <IkonTimbul ikon={ikon} warna={warna} ukuran={30} />
      </span>
    </button>
  );
}

export interface ItemTumpukan { id: string; judul: string; ket: string; nilai?: string; onClick?: () => void }

/**
 * Kartu bertumpuk berperspektif: kartu pertama paling depan (warna merek), yang berikutnya makin
 * ke belakang - lebih sempit, lebih redup, sedikit tertutup kartu di atasnya.
 */
export function TumpukanPeringkat({ items }: { items: ItemTumpukan[] }) {
  return (
    <ol className="tumpukan-3d">
      {items.map((it, i) => (
        <li key={it.id} style={{ ['--urut' as string]: i }}>
          <button type="button" onClick={it.onClick} className={`tumpukan-kartu ${i === 0 ? 'utama' : ''}`}>
            <span className="tumpukan-no">{i + 1}</span>
            <span className="tumpukan-avatar">{it.judul.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]!.toUpperCase()).join('')}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold truncate">{it.judul}</span>
              <span className="block text-[11px] truncate opacity-75">{it.ket}</span>
            </span>
            {it.nilai && <span className="tumpukan-nilai">{it.nilai}</span>}
          </button>
        </li>
      ))}
    </ol>
  );
}
