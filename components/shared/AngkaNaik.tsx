'use client';

/**
 * Angka yang menghitung naik (count-up) ke nilainya - dari 0 saat pertama tampil, lalu dari nilai lama ke
 * nilai baru saat datanya berubah. Murni di peramban (requestAnimationFrame): tidak ada permintaan data.
 * Gerak dikurangi (prefers-reduced-motion) -> langsung ke nilai akhir.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function useAngkaNaik(target: number, durasi = 1100): number {
  const dari = useRef(0);
  const [nilai, setNilai] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const kurangi = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const awal = dari.current, d = kurangi ? 0 : durasi;
    const desimal = Number.isInteger(target) ? 0 : Math.min(2, (String(target).split('.')[1] ?? '').length);
    let raf = 0, t0 = 0;
    const langkah = (t: number) => {
      if (!t0) t0 = t;
      const p = d === 0 ? 1 : Math.min(1, (t - t0) / d);
      const v = p === 1 ? target : Number((awal + (target - awal) * (1 - Math.pow(1 - p, 3))).toFixed(desimal));
      dari.current = v;
      setNilai(v);
      if (p < 1) raf = requestAnimationFrame(langkah);
    };
    raf = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(raf);
  }, [target, durasi]);
  return nilai;
}

export function AngkaNaik({ nilai }: { nilai: number }) {
  return <>{useAngkaNaik(nilai)}</>;
}

/** Nilai StatCard bisa ReactNode: hanya angka murni (12 / "12") yang dihitung naik, sisanya apa adanya. */
export function angkaAtauApaAdanya(v: ReactNode): ReactNode {
  if (typeof v === 'number' && Number.isFinite(v)) return <AngkaNaik nilai={v} />;
  if (typeof v === 'string' && /^\d{1,9}$/.test(v)) return <AngkaNaik nilai={Number(v)} />;
  return v;
}
