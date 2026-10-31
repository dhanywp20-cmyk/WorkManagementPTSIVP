'use client';
/**
 * Pilih model + lensa dari katalog RESMI Panasonic (data Throw Distance Calculator) - mengisi lensa, panel, lumen &
 * lens shift dengan angka yang sama persis dengan kalkulator itu (desain3d/inti/katalogPanasonic.ts). Dipakai Desain 3D
 * (Atur proyektor) & Kalkulator AV - Proyektor. Katalog dimuat saat kotak ini dibuka saja.
 */
import { useEffect, useMemo, useState } from 'react';
import { Catatan } from '../bersama/ui';
import {
  cekDataLensa, KATEGORI_TDC, type KatalogTdc, type LensaTdc, type ModelTdc, muatKatalogPanasonic, type RasioProyektor, rasioUntukLensa,
} from '../desain3d/inti';

/** `rasio` = rasio sinyal sekarang (dipakai bila lensa mendukungnya), `sumber` = sumber data lensa sekarang. */
export function PilihPanasonic({ rasio: rasioSekarang, sumber, onPakai }: {
  rasio?: RasioProyektor; sumber?: string; onPakai: (m: ModelTdc, l: LensaTdc, rasio: RasioProyektor, versi: string) => void;
}) {
  const [buka, setBuka] = useState(false);
  const [kat, setKat] = useState<KatalogTdc | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [cari, setCari] = useState('');
  /** Model type seperti kalkulator Panasonic: 0 = All (semua 290 model, termasuk Previous) - dulu Previous disembunyikan. */
  const [jenis, setJenis] = useState(0);
  const [model, setModel] = useState('');
  const [lensa, setLensa] = useState('');
  useEffect(() => {
    if (!buka || kat) return;
    let hidup = true;
    muatKatalogPanasonic().then(k => { if (hidup) setKat(k); }).catch(() => { if (hidup) setGalat('Katalog Panasonic gagal dimuat - periksa koneksi lalu buka lagi.'); });
    return () => { hidup = false; };
  }, [buka, kat]);

  const daftar = useMemo(() => {
    if (!kat) return [];
    const q = cari.trim().toUpperCase().replace(/\s+/g, '');
    return kat.model.filter(m => (!jenis || m.kat === jenis) && (!q || m.n.toUpperCase().replace(/[\s-]/g, '').includes(q.replace(/-/g, ''))));
  }, [kat, cari, jenis]);
  const m = kat?.model.find(x => x.n === model) ?? null;
  const l = m?.l.find(x => x.n === lensa) ?? m?.l[0] ?? null;
  const rasio = m && l ? rasioUntukLensa(m, l, rasioSekarang) : null;

  if (!buka) {
    return (
      <button type="button" onClick={() => setBuka(true)}
        className="w-full px-2.5 py-2 rounded-lg text-[12px] font-bold border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 text-left">
        Pilih model &amp; lensa Panasonic (data resmi kalkulator Panasonic){sumber ? ` · sekarang: ${sumber}` : ''}
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-900">Katalog Panasonic{kat ? ` · TDC ${kat.versi}` : ''}</p>
        <button type="button" onClick={() => setBuka(false)} className="text-[11.5px] font-bold text-slate-600 hover:text-slate-900">Tutup</button>
      </div>
      {galat && <p className="text-[12px] font-semibold text-rose-700">{galat}</p>}
      {!kat && !galat && <p className="text-[12px] text-slate-600">Memuat katalog…</p>}
      {kat && (
        <>
          <div className="flex items-center gap-2">
            <input type="search" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari model, mis. VMZ51" aria-label="Cari model Panasonic"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12.5px]" />
            <select aria-label="Model type" value={jenis} onChange={e => setJenis(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12.5px]">
              {KATEGORI_TDC.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </div>
          <select aria-label="Model Panasonic" value={model} onChange={e => { setModel(e.target.value); setLensa(''); }}
            className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12.5px]">
            <option value="">{daftar.length ? `Pilih model (${daftar.length})` : 'Tidak ada model yang cocok'}</option>
            {daftar.map(x => <option key={x.n} value={x.n}>{x.n} · {x.lm.toLocaleString('id-ID')} lm · {x.a}{x.kat === 7 ? ' · Previous' : ''}</option>)}
          </select>
          {m && (
            <select aria-label="Lensa" value={l?.n ?? ''} onChange={e => setLensa(e.target.value)}
              className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12.5px]">
              {m.l.map(x => <option key={x.n} value={x.n}>{x.n}{x.z ? '' : ' (fixed)'}{x.ket ? ` · TR ${x.ket.slice(0, 40)}` : ''}{x.k ? ' · jarak khusus' : ''}</option>)}
            </select>
          )}
          {m && l && rasio && (
            <>
              <p className="text-[12px] text-slate-700 leading-snug">
                Panel {m.a}{m.r ? ` (${m.r})` : ''}, {m.lm.toLocaleString('id-ID')} lm, rasio sinyal {rasio}{rasioSekarang && rasio !== rasioSekarang && !l.ar[rasioSekarang] ? ` (${rasioSekarang} tidak didukung lensa ini)` : ''}.
                {' '}TR {l.ar[rasio]![0].toFixed(4)}{l.z ? `–${l.ar[rasio]![1].toFixed(4)}` : ''}, b {l.ar[rasio]![2].toFixed(4)} m{l.pg ? '' : ', tanpa lens shift'}.
              </p>
              {cekDataLensa(l, rasio) && <p className="text-[12px] font-semibold text-amber-700">{cekDataLensa(l, rasio)}</p>}
              {l.k && <p className="text-[12px] font-semibold text-amber-700">Lensa ini diukur khusus di kalkulator Panasonic (ultra short throw / lensa L): jarak L di sini dari muka lensa, bukan L1/L2 Panasonic.</p>}
              <button type="button" onClick={() => { onPakai(m, l, rasio, kat.versi); setBuka(false); }}
                className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-blue-700 bg-blue-700 text-white hover:bg-blue-800">
                Pakai {m.n} + {l.n}
              </button>
            </>
          )}
          <Catatan>Data dari Panasonic Throw Distance Calculator (docs.connect.panasonic.com/projector/calculator/tdc). Angka L, ukuran, lens shift &amp; lux mengikuti rumus kalkulator itu, per rasio sinyal.</Catatan>
        </>
      )}
    </div>
  );
}
