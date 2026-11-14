'use client';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { type Kotak, sisiKeTitik } from '@/lib/sld/geometri';
import { letakLabel } from '@/lib/sld/lembar1';
import type { Perangkat, Titik } from '@/lib/sld/tipe';
import type { Alat } from './useKeadaanSLD';

export type Seret =
  | { mode: 'grup'; mulai: Titik; awal: Map<string, Titik>; kotak?: Kotak; lain: Kotak[] }
  | { mode: 'kotak'; dari: Titik; ke: Titik }
  | { mode: 'ukurZona'; id: string; x0: number; y0: number }
  | { mode: 'ukur'; id: string; x0: number; y0: number }
  | { mode: 'sambung'; dari: string; titik: Titik }
  | { mode: 'ruas'; id: string; awal: Titik[]; k: number; tegak: boolean }
  | { mode: 'sudut'; id: string; awal: Titik[]; k: number }
  | { mode: 'putar'; id: string; cx: number; cy: number }
  | { mode: 'zonaBaru'; dari: Titik; ke: Titik }
  | { mode: 'geser'; x: number; y: number; sl: number; st: number }
  ;

const PETUNJUK: Record<string, string> = {
  geser: 'Seret kanvas untuk menggeser tampilan. Tahan Spasi kapan saja untuk geser sementara, Ctrl + scroll untuk zoom.',
  teks: 'Klik di diagram untuk menaruh teks.',
  area: 'Seret untuk menggambar area (Rack, Wall, ruangan). Klik saja = ukuran bawaan.',
  hapus: 'Klik perangkat, kabel, teks atau area untuk menghapusnya. Ctrl+Z untuk membatalkan.',
};

export const BIRU = '#2563eb';
export const HIJAU = '#059669';
export const snap = (v: number) => Math.round(v * 2) / 2;

export function tepiMenghadap(k: Kotak, ke: Titik, sebelum?: Titik) {
  const s = sisiKeTitik(k, ke, sebelum);
  return { s, t: s === 'kiri' ? { x: k.x, y: k.y + k.h / 2 } : s === 'kanan' ? { x: k.x + k.w, y: k.y + k.h / 2 } : s === 'atas' ? { x: k.x + k.w / 2, y: k.y } : { x: k.x + k.w / 2, y: k.y + k.h } };
}

export function areaLabel(p: Perangkat, f = 1) {
  const l = letakLabel(p, f), lx = l.kanan ? l.x - l.w - 0.5 : l.x - 0.5;
  const x = Math.min(p.x, lx), y = Math.min(p.y, l.atas), x2 = Math.max(p.x + p.w, lx + l.w + 1), y2 = Math.max(p.y + p.h, l.atas + l.h + 0.5);
  return { x, y, w: x2 - x, h: y2 - y };
}

export function useZoomRoda(wadahRef: React.RefObject<HTMLDivElement | null>, onZoom?: (f: (z: number) => number) => void) {
  const onZoomRef = useRef(onZoom);
  useEffect(() => { onZoomRef.current = onZoom; });
  useEffect(() => {
    const el = wadahRef.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !onZoomRef.current) return;
      e.preventDefault();
      onZoomRef.current(z => Math.min(4, Math.max(1, Math.round(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15) * 20) / 20)));
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, [wadahRef]);
}

export function useSpasi() {
  const [spasi, setSpasi] = useState(false);
  useEffect(() => {
    const isian = (e: KeyboardEvent) => { const el = e.target as HTMLElement | null; return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName)); };
    const turun = (e: KeyboardEvent) => { if (e.code === 'Space' && !isian(e)) { e.preventDefault(); if (!e.repeat) setSpasi(true); } };
    const naik = (e: KeyboardEvent) => { if (e.code === 'Space') setSpasi(false); };
    const hilang = () => setSpasi(false);
    window.addEventListener('keydown', turun);
    window.addEventListener('keyup', naik);
    window.addEventListener('blur', hilang);
    return () => { window.removeEventListener('keydown', turun); window.removeEventListener('keyup', naik); window.removeEventListener('blur', hilang); };
  }, []);
  return spasi;
}

export function GridKanvas({ w, h }: { w: number; h: number }) {
  return (
          <g pointerEvents="none">
            <defs>
              <pattern id="sld-grid-kecil" width={5} height={5} patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="#cbd5e1" strokeWidth={0.12} /></pattern>
              <pattern id="sld-grid" width={25} height={25} patternUnits="userSpaceOnUse">
                <rect width={25} height={25} fill="url(#sld-grid-kecil)" /><path d="M25 0H0V25" fill="none" stroke="#94a3b8" strokeWidth={0.2} />
              </pattern>
            </defs>
            <rect width={w} height={h} fill="url(#sld-grid)" />
          </g>
  );
}

export function PetunjukAlat({ alat, onTutup, sumber, garis }: { alat: Alat; onTutup: () => void; sumber: boolean; garis?: 'asal' | number }) {
  return (
    <div className="absolute left-2 bottom-2 z-10 flex items-start gap-1.5 max-w-[min(520px,calc(100%-16px))]">
      <p role="status" className={`rounded-lg border bg-white/95 px-3 py-1.5 text-[12px] leading-snug text-slate-700 shadow-sm ${alat === 'hapus' ? 'border-rose-200' : 'border-blue-200'}`}>
        {garis !== undefined ? (<><b>Alat garis.</b> {garis === 'asal' ? <>Klik perangkat <b>asal</b> kabel.</>
          : <>Klik di kanvas untuk titik belok ({garis}), lalu klik perangkat <b>tujuan</b>. Shift = titik bebas. Backspace / klik kanan = batalkan titik. Esc = keluar.</>}</>)
          : alat === 'format' ? (<><b>Kuas format.</b> {sumber ? 'Klik objek sejenis untuk menyalin ukuran, huruf, warna & posisi label. Bisa berkali-kali.' : 'Klik objek sumber yang formatnya mau disalin.'}</>)
            : PETUNJUK[alat]}
        {garis === undefined && ' Esc = selesai.'}
      </p>
      <button type="button" onClick={onTutup} aria-label="Keluar dari alat" title="Keluar (Esc)"
        className="shrink-0 grid place-items-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"><X size={15} /></button>
    </div>
  );
}
