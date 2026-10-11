'use client';
/** Kontrol di atas kanvas 3D: centang tampilan, aksi benda terpilih, geser tepat, bilah alat kiri, layar penuh. */
import { useEffect, useState } from 'react';
import { DISPLAY, nirkabel } from '../inti';
import { Maximize2, Minimize2, Settings2 } from 'lucide-react';
import { AksiTerpilih } from './AksiTerpilih';
import { GeserTepat } from './GeserTepat';
import { BilahKiri } from './BilahKiri';
import type { AlatDesain } from './alat';

export function KontrolKanvas({ a }: { a: AlatDesain }) {
  const { adaProyektor, bayangan, benda, chipBuka, detailBlending, garisUkur, gridSinar, setGridSinar, jangkau, jumlahProyektor, kabel, kabelPower, kerucut, labelProduk, setBayangan, setChipBuka, setDetailBlending, setGarisUkur, setJangkau, setKabelPower, setKerucut, setLabelProduk, setSinar, setTampilBlending, setTampilKabel, setUkur, sinar, tampilBlending, tampilKabel, tampilShare, setTampilShare, terpilih, ukur, layarPenuh, setLayarPenuh, alatKanvas } = a.K;
  //  Geser tepat terikat ke benda yang terpilih saat dibuka - pilih benda lain = otomatis tertutup.
  const [geser, setGeser] = useState<{ id: string; teks: string } | null>(null);
  const geserAktif = geser && geser.id === terpilih?.id ? geser : null;
  //  Ketik angka (atau -) saat benda terpilih = buka Geser tepat dengan angka itu.
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!terpilih || terpilih.terkunci || geserAktif || alatKanvas !== 'pilih' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (el?.closest('input, textarea, select, [contenteditable="true"], [role=dialog]')) return;
      if (/^[0-9-]$/.test(e.key)) { e.preventDefault(); setGeser({ id: terpilih.id, teks: e.key }); }
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [terpilih, geserAktif, alatKanvas]);
  return (
    <>
      <div className="kontrol-kanvas lapis-tembus absolute left-2 top-2 z-10 flex flex-col items-start gap-1.5 max-w-[calc(100%-16px)]">
        <button type="button" onClick={() => setChipBuka(v => !v)} aria-expanded={chipBuka}
          className="sm:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/95 border border-slate-200 text-[12px] font-bold text-slate-700 shadow-sm">
          <Settings2 size={14} /> Tampilan {chipBuka ? '▴' : '▾'}
        </button>
        <div className={`${chipBuka ? 'flex' : 'hidden'} sm:flex gap-1.5 flex-wrap lapis-tembus`}>
          {[{ v: ukur, s: setUkur, l: 'Ukuran' },
            ...(benda.some(b => DISPLAY.includes(b.jenis)) ? [{ v: garisUkur, s: setGarisUkur, l: 'Garis ukuran (mm)' }] : []),
            { v: labelProduk, s: setLabelProduk, l: 'Label produk' },
            { v: kerucut, s: setKerucut, l: 'Sudut pandang' },
            ...(adaProyektor ? [{ v: sinar, s: setSinar, l: 'Sinar proyektor' }] : []),
            //  Mode grid: gambar tiap proyektor sebagai pola garis 16 x 9 (bentuk & sambungan antar gambar terlihat).
            ...(adaProyektor && sinar ? [{ v: gridSinar, s: setGridSinar, l: 'Grid sinar' }] : []),
            ...(jumlahProyektor >= 2 ? [{ v: tampilBlending, s: setTampilBlending, l: 'Area blending' }] : []),
            //  Garis ukur & angka cm ikut "Area blending"; kartu keterangan (persen & piksel) bisa disembunyikan sendiri.
            ...(jumlahProyektor >= 2 && tampilBlending ? [{ v: detailBlending, s: setDetailBlending, l: 'Detail blending' }] : []),
            ...(benda.some(b => b.jenis === 'speaker' || b.jenis === 'speaker-plafon') ? [{ v: jangkau, s: setJangkau, l: 'Jangkauan speaker' }] : []),
            ...(kabel.length ? [{ v: tampilKabel, s: setTampilKabel, l: 'Jalur kabel' }] : []),
            ...(benda.some(nirkabel) ? [{ v: tampilShare, s: setTampilShare, l: 'Share nirkabel' }] : []),
            ...(kabel.length && tampilKabel ? [{ v: kabelPower, s: setKabelPower, l: 'Kabel power' }] : []),
            { v: bayangan, s: setBayangan, l: 'Bayangan & cahaya' }].map(t => (
            <label key={t.l} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/90 border border-slate-200 text-[11.5px] font-semibold text-slate-700 shadow-sm">
              <input type="checkbox" checked={t.v} onChange={e => t.s(e.target.checked)} /> {t.l}
            </label>
          ))}
        </div>
        {/* Aksi benda terpilih (panel/AksiTerpilih.tsx) & geser tepat. */}
        <AksiTerpilih a={a} onGeserTepat={() => terpilih && setGeser({ id: terpilih.id, teks: '' })} />
        {geserAktif && <GeserTepat a={a} awal={geserAktif.teks} onTutup={() => setGeser(null)} />}
        {/* Bilah alat kiri: Tambah, teks, pilih banyak, penggaris, snap grid, geser / putar. */}
        <BilahKiri a={a} />
      </div>
      <button type="button" onClick={() => setLayarPenuh(v => !v)} aria-pressed={layarPenuh}
        title={layarPenuh ? 'Keluar layar penuh (Esc)' : 'Layar penuh'} aria-label={layarPenuh ? 'Keluar layar penuh' : 'Layar penuh'}
        className="kontrol-kanvas absolute right-2 top-2 z-10 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/95 border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50">
        {layarPenuh ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </>
  );
}
