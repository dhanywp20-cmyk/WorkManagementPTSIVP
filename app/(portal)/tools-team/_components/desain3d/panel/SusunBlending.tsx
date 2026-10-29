'use client';
/**
 * Panel proyektor: susun proyektor identik menjadi edge blending ke layar (inti/susunBlending.ts) - lurus tanpa
 * keystone, TR di dalam rentang zoom, lens shift di dalam daerah lensa, seperti kalkulator Panasonic. Ukuran ubin
 * & overlap sama dengan Kalkulator AV › Proyektor › Edge blending.
 */
import { useState } from 'react';
import { Angka, Catatan, f } from '../../bersama/ui';
import { rencanaBlending } from '@/lib/av-layar-proyektor';
import { type Benda, rasioProyektorDari, resolusiProyektorDari, ruangDari, susunBlending, throwRatioDari } from '../inti';
import type { KeadaanDesain } from '../useKeadaanDesain';

export function SusunBlending({ p, layar, K }: { p: Benda; layar: Benda; K: KeadaanDesain }) {
  const [kolom, setKolom] = useState(2);
  const [baris, setBaris] = useState(1);
  const [overlap, setOverlap] = useState(15);
  const [hasil, setHasil] = useState<{ teks: string; peringatan: string[] } | null>(null);
  const res = resolusiProyektorDari(p) ?? rasioProyektorDari(p).px;
  //  Pratinjau ukuran ubin sebelum menyusun - rumus yang sama dengan susunBlending.
  const r = rencanaBlending({ kolom, baris, resX: res.x, resY: res.y, overlapH: overlap, overlapV: overlap, mode: 'target', targetLebarM: layar.w, targetTinggiM: layar.h });
  const susun = () => {
    const k = K.kotakRuang[ruangDari(K.ruang, layar.x)] ?? K.kotakRuang[0];
    const h = susunBlending(p, K.benda, layar, k, K.ruang, { kolom, baris, overlapPersen: overlap });
    K.setBenda(h.benda);
    K.setTampilBlending(true);
    const q = h.benda.find(b => b.id === h.ids[0]);
    setHasil({
      teks: `${h.ids.length} proyektor tersusun: TR ${f(q ? throwRatioDari(q) : 0, 3)}, overlap ${f(h.rencana.overlapHM * 100, 1)} cm (${f(h.rencana.overlapHPersen, 1)}% · ${h.rencana.overlapHpx} px). Area blending tampil di kanvas.`,
      peringatan: h.peringatan,
    });
  };
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-2 space-y-1.5">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-violet-800">Susun edge blending ke {layar.nama}</span>
      <div className="grid grid-cols-3 gap-1.5">
        <Angka label="Kolom" nilai={kolom} step={1} onUbah={v => v >= 1 && v <= 12 && setKolom(Math.round(v))} />
        <Angka label="Baris" nilai={baris} step={1} onUbah={v => v >= 1 && v <= 6 && setBaris(Math.round(v))} />
        <Angka label="Overlap" nilai={overlap} satuan="%" step={1} onUbah={v => v >= 0 && v <= 50 && setOverlap(v)} />
      </div>
      <p className="text-[12px] text-slate-700 leading-relaxed tabular-nums">
        Gambar per proyektor <b>{f(r.lebarSatuM)} × {f(r.tinggiSatuM)} m</b>, overlap {f(r.overlapHM * 100, 1)} cm ({r.overlapHpx} px dari {res.x}
        {resolusiProyektorDari(p) ? '' : ' acuan'}), kanvas {r.kanvasX} × {r.kanvasY} px{r.maskX || r.maskY ? `, mask ${r.maskX} × ${r.maskY} px` : ''}.
      </p>
      <button type="button" onClick={susun}
        className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-violet-300 bg-white text-violet-800 hover:bg-violet-100">
        Susun {kolom * baris} proyektor (lurus, tanpa keystone)
      </button>
      {hasil && <p className="text-[12px] font-semibold text-emerald-700 leading-relaxed">{hasil.teks}</p>}
      {hasil?.peringatan.map(t => <p key={t} className="text-[12px] font-semibold text-amber-700 leading-relaxed">{t}</p>)}
      <Catatan>
        Proyektor ini jadi contoh: model, lensa (TR, koreksi b, batas lens shift) & resolusi disamakan ke semua proyektor susunan; kekurangannya
        disalin. Tiap proyektor lurus di depan pusat ubinnya, jarak lempar dari rumus lensa dalam rentang zoom, tinggi diatur dengan lens shift
        di dalam daerah lensa - yang tidak tercapai dilaporkan di atas.
      </Catatan>
    </div>
  );
}
