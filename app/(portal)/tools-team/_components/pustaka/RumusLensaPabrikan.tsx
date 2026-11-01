'use client';
/**
 * Rumus lensa L = TR x lebar - b dari DUA hasil kalkulator pabrikan (mis. Panasonic: 100" & 200" di zoom yang sama) -
 * untuk proyektor yang tidak ada di katalog / Pustaka. TR brosur ("1.09-1.77:1") bukan angka rumus kalkulatornya
 * (PT-VMZ61: 1,105112 & b 0,0294) - memakai TR brosur tanpa b meleset ±2 cm. Dipakai Desain 3D & Kalkulator AV.
 */
import { useState } from 'react';
import { Angka, f } from '../bersama/ui';
import { rumusLensaDariDuaTitik } from '@/lib/av-layar-proyektor';

/** 6 desimal: dibulatkan 3 desimal, jarak bisa meleset beberapa mm dari kalkulator pabrikan. */
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

export function RumusLensaPabrikan({ onPakai }: { onPakai: (ujung: 'min' | 'maks', tr: number, b: number) => void }) {
  const [titik, setTitik] = useState({ w1: 2.215, l1: 0, w2: 4.43, l2: 0 });
  const rumus = rumusLensaDariDuaTitik(titik.w1, titik.l1, titik.w2, titik.l2);
  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
      <summary className="cursor-pointer text-[12.5px] font-semibold text-slate-700">Ambil rumus lensa dari kalkulator pabrikan</summary>
      <div className="mt-2 space-y-2">
        <p className="text-[11.5px] text-slate-600">
          Untuk proyektor di luar katalog: isi Width &amp; jarak dua ukuran gambar dari kalkulator pabrikan (zoom sama: dua-duanya
          Minimum, atau dua-duanya Maximum). TR brosur tanpa b bisa meleset beberapa cm.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Angka label="Lebar 1" nilai={titik.w1} step={0.001} onUbah={v => setTitik(t => ({ ...t, w1: v }))} satuan="m" />
          <Angka label="Jarak 1" nilai={titik.l1} step={0.001} onUbah={v => setTitik(t => ({ ...t, l1: v }))} satuan="m" />
          <Angka label="Lebar 2" nilai={titik.w2} step={0.001} onUbah={v => setTitik(t => ({ ...t, w2: v }))} satuan="m" />
          <Angka label="Jarak 2" nilai={titik.l2} step={0.001} onUbah={v => setTitik(t => ({ ...t, l2: v }))} satuan="m" />
        </div>
        {rumus ? (
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-700">
            <span className="font-semibold tabular-nums">L = {f(rumus.tr, 6)} × lebar − {f(rumus.b, 4)}</span>
            <button type="button" onClick={() => onPakai('min', r6(rumus.tr), r6(rumus.b))} className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-100">Pakai sebagai throw min (wide)</button>
            <button type="button" onClick={() => onPakai('maks', r6(rumus.tr), r6(rumus.b))} className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-100">Pakai sebagai throw maks (tele)</button>
          </div>
        ) : <p className="text-[11.5px] text-slate-500">Isi kedua jarak (lebar harus berbeda).</p>}
      </div>
    </details>
  );
}
