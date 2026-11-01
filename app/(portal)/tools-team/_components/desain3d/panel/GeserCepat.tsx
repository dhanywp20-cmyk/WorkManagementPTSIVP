'use client';
/**
 * Geser cepat benda terpilih tanpa menyeret gizmo: kiri / kanan / maju / mundur MENGIKUTI arah kamera
 * (layar), naik / turun. Juga tombol panah keyboard (PageUp / PageDown = naik / turun, Shift = 1 cm).
 * Tombol tengah = besar langkah. Benda terkunci tidak bergeser.
 */
import { useEffect, useState } from 'react';
import { ArrowBigDown, ArrowBigUp, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { jepitProyektor } from '../inti';
import type { AlatDesain } from './alat';

const LANGKAH = [0.01, 0.05, 0.1, 0.5];
const label = (m: number) => (m < 1 ? `${Math.round(m * 100)} cm` : `${m} m`);

export function GeserCepat({ a }: { a: AlatDesain }) {
  const { alatKanvas, batas, mesin, pilihLain, plafonDi, setBenda, snap, terpilih } = a.K;
  const [iLangkah, setILangkah] = useState(1);
  const langkahDasar = snap.aktif ? snap.langkah : LANGKAH[iLangkah];

  /** Sumbu lantai yang paling sejajar dengan kanan layar -> arah kanan & maju (menjauhi kamera). */
  const arahLayar = () => {
    const m = mesin.current;
    if (!m) return { kanan: [1, 0], maju: [0, -1] };
    const k = new m.THREE.Vector3(1, 0, 0).applyQuaternion(m.kamera.quaternion);
    const kanan = Math.abs(k.x) >= Math.abs(k.z) ? [Math.sign(k.x) || 1, 0] : [0, Math.sign(k.z) || 1];
    return { kanan, maju: [kanan[1], -kanan[0]] };
  };
  const geser = (dKanan: number, dMaju: number, dNaik: number, langkah = langkahDasar) => {
    if (!terpilih) return;
    const ids = new Set([terpilih.id, ...pilihLain]);
    const { kanan, maju } = arahLayar();
    const dx = (kanan[0] * dKanan + maju[0] * dMaju) * langkah, dz = (kanan[1] * dKanan + maju[1] * dMaju) * langkah;
    const r = (v: number) => Math.round(v * 1000) / 1000;
    setBenda(bs => bs.map(b => {
      if (!ids.has(b.id) || b.terkunci) return b;
      if (b.jenis === 'proyektor') {
        //  Badan boleh menembus dinding / plafon - yang dijaga di dalam ruang hanya lensanya.
        const j = jepitProyektor({ ...b, x: b.x + dx, z: b.z + dz, elev: b.elev + dNaik * langkah }, batas.x, batas.z, plafonDi(Math.min(batas.x, Math.max(0, b.x + dx))));
        return { ...b, x: r(j.x), z: r(j.z), elev: r(j.elev) };
      }
      const x = r(Math.min(batas.x, Math.max(0, b.x + dx))), z = r(Math.min(batas.z, Math.max(0, b.z + dz)));
      const elev = r(Math.min(Math.max(0, plafonDi(x) - b.h), Math.max(0, b.elev + dNaik * langkah)));
      return { ...b, x, z, elev };
    }));
  };

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!terpilih || alatKanvas !== 'pilih' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (el?.closest('input, textarea, select, [contenteditable="true"], [role=dialog]')) return;
      const arah: Record<string, [number, number, number]> = {
        ArrowLeft: [-1, 0, 0], ArrowRight: [1, 0, 0], ArrowUp: [0, 1, 0], ArrowDown: [0, -1, 0], PageUp: [0, 0, 1], PageDown: [0, 0, -1],
      };
      const d = arah[e.key]; if (!d) return;
      e.preventDefault();
      geser(...d, e.shiftKey ? 0.01 : langkahDasar);
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  });

  if (!terpilih || terpilih.terkunci) return null;
  const t = 'h-9 grid place-items-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 active:bg-blue-100';
  //  Panel "Geser" di bilah benda terpilih: tombol panah seperti papan ketik (kiri-maju-mundur-kanan) | naik, turun | langkah.
  //  Komponen tetap terpasang walau panelnya tertutup, supaya panah keyboard selalu jalan.
  return (
    <div className="flex items-stretch gap-2" role="group" aria-label="Geser cepat">
      <div className="grid grid-cols-3 gap-1 w-[7.5rem]">
        <span />
        <button type="button" className={t} onClick={() => geser(0, 1, 0)} title="Maju / menjauh (↑)" aria-label="Maju"><ChevronUp size={16} /></button>
        <span />
        <button type="button" className={t} onClick={() => geser(-1, 0, 0)} title="Kiri (←)" aria-label="Kiri"><ChevronLeft size={16} /></button>
        <button type="button" className={t} onClick={() => geser(0, -1, 0)} title="Mundur / mendekat (↓)" aria-label="Mundur"><ChevronDown size={16} /></button>
        <button type="button" className={t} onClick={() => geser(1, 0, 0)} title="Kanan (→)" aria-label="Kanan"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-rows-2 gap-1 w-10">
        <button type="button" className={t} onClick={() => geser(0, 0, 1)} title="Naik (PageUp)" aria-label="Naik"><ArrowBigUp size={15} /></button>
        <button type="button" className={t} onClick={() => geser(0, 0, -1)} title="Turun (PageDown)" aria-label="Turun"><ArrowBigDown size={15} /></button>
      </div>
      <button type="button" onClick={() => !snap.aktif && setILangkah(i => (i + 1) % LANGKAH.length)} disabled={snap.aktif}
        title={snap.aktif ? 'Langkah = snap grid' : 'Besar langkah - klik untuk ganti (Shift = 1 cm)'}
        className="flex-1 flex flex-col items-center justify-center rounded-lg text-blue-800 bg-blue-50 hover:bg-blue-100 disabled:opacity-70">
        <span className="text-[10.5px] font-semibold text-blue-700/80">Langkah</span>
        <span className="text-[13px] font-bold whitespace-nowrap">{label(langkahDasar)}</span>
      </button>
    </div>
  );
}
