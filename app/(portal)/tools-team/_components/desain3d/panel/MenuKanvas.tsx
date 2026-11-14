'use client';
import { Grid3x3, Layers3 } from 'lucide-react';
import { DISPLAY, labelLangkah, LANGKAH_SNAP, nirkabel, SUDUT_SNAP } from '../inti';
import { GarisMenu, JudulMenu, Menu, Sakelar } from '../../bersama/MenuBilah';
import type { AlatDesain } from './alat';

interface Centang { v: boolean; s: (v: boolean) => void; l: string }

function Pilihan<T extends number>({ nilai, opsi, label, onPilih }: { nilai: T | null; opsi: readonly T[]; label: (v: T) => string; onPilih: (v: T) => void }) {
  return (
    <div className="grid gap-0.5 rounded-lg bg-slate-100 p-0.5 mx-2.5 mb-1.5" style={{ gridTemplateColumns: `repeat(${opsi.length > 4 ? 3 : opsi.length}, minmax(0, 1fr))` }}>
      {opsi.map(v => (
        <button key={v} type="button" onClick={() => onPilih(v)} aria-pressed={nilai === v}
          className={`rounded-md py-1 text-[12px] font-bold tabular-nums transition-colors duration-150 ${nilai === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{label(v)}</button>
      ))}
    </div>
  );
}

export function MenuSnap({ a }: { a: AlatDesain }) {
  const { snap, setSnap } = a.K;
  return (
    <Menu label={snap.aktif ? `Snap grid aktif · ${labelLangkah(snap.langkah)} · ${snap.sudut}° (G)` : 'Snap grid - geser & putar presisi (G)'} ikon={Grid3x3} aktif={snap.aktif} lebar="w-64"
      teks={snap.aktif ? labelLangkah(snap.langkah) : undefined} teksKelas="hidden 2xl:inline tabular-nums">
      <div className="space-y-2 px-2.5 py-2">
        <Sakelar label="Snap grid" nilai={snap.aktif} onUbah={v => setSnap({ ...snap, aktif: v })} judul="Tombol G" />
        <Sakelar label="Magnet ke benda lain" nilai={snap.magnet} onUbah={v => setSnap({ ...snap, magnet: v })} judul="Saat digeser, benda menempel ke tepi / tengah benda lain dalam jarak 5 cm" />
      </div>
      <GarisMenu />
      <JudulMenu>Langkah geser</JudulMenu>
      <Pilihan nilai={snap.aktif ? snap.langkah as (typeof LANGKAH_SNAP)[number] : null} opsi={LANGKAH_SNAP} label={labelLangkah} onPilih={l => setSnap({ ...snap, aktif: true, langkah: l })} />
      <JudulMenu>Langkah putar</JudulMenu>
      <Pilihan nilai={snap.aktif ? snap.sudut as (typeof SUDUT_SNAP)[number] : null} opsi={SUDUT_SNAP} label={s => `${s}°`} onPilih={s => setSnap({ ...snap, aktif: true, sudut: s })} />
    </Menu>
  );
}

export function MenuTampilan({ a }: { a: AlatDesain }) {
  const { sinarNyata, setSinarNyata, sembunyiTeks, setSembunyiTeks, jarakDinding, setJarakDinding, teksSinar, setTeksSinar, adaProyektor, bayangan, benda, detailBlending, garisUkur,
    gridSinar, setGridSinar, jangkau, jumlahProyektor, kabel, kabelPower, kerucut, labelProduk, setBayangan, setDetailBlending, setGarisUkur, setJangkau, setKabelPower, setKerucut,
    setLabelProduk, setSinar, setTampilBlending, setTampilKabel, setUkur, sinar, tampilBlending, tampilKabel, tampilShare, setTampilShare, ukur } = a.K;
  const kelompok: { judul: string; isi: Centang[] }[] = ([
    { judul: 'Ukuran & label', isi: [
      { v: ukur, s: setUkur, l: 'Ukuran' },
      { v: jarakDinding, s: setJarakDinding, l: 'Jarak ke dinding' },
      ...(benda.some(b => DISPLAY.includes(b.jenis)) ? [{ v: garisUkur, s: setGarisUkur, l: 'Garis ukuran (mm)' }] : []),
      { v: labelProduk, s: setLabelProduk, l: 'Label produk' },
      { v: !sembunyiTeks, s: (v: boolean) => setSembunyiTeks(!v), l: 'Tulisan di kanvas' },
    ] },
    { judul: 'Analisis', isi: [
      { v: kerucut, s: setKerucut, l: 'Sudut pandang' },
      ...(benda.some(b => b.jenis === 'speaker' || b.jenis === 'speaker-plafon') ? [{ v: jangkau, s: setJangkau, l: 'Jangkauan speaker' }] : []),
      ...(kabel.length ? [{ v: tampilKabel, s: setTampilKabel, l: 'Jalur kabel' }] : []),
      ...(kabel.length && tampilKabel ? [{ v: kabelPower, s: setKabelPower, l: 'Kabel power' }] : []),
      ...(benda.some(nirkabel) ? [{ v: tampilShare, s: setTampilShare, l: 'Share nirkabel' }] : []),
    ] },
    { judul: 'Proyektor', isi: adaProyektor ? [
      { v: sinar, s: setSinar, l: 'Sinar proyektor' },
      ...(sinar ? [{ v: sinarNyata, s: setSinarNyata, l: 'Sinar nyata' }] : []),
      ...(sinar ? [{ v: gridSinar, s: setGridSinar, l: 'Grid sinar' }] : []),
      ...(sinar ? [{ v: teksSinar, s: setTeksSinar, l: 'Keterangan sinar' }] : []),
      ...(jumlahProyektor >= 2 ? [{ v: tampilBlending, s: setTampilBlending, l: 'Area blending' }] : []),
      ...(jumlahProyektor >= 2 && tampilBlending ? [{ v: detailBlending, s: setDetailBlending, l: 'Keterangan blending' }] : []),
    ] : [] },
    { judul: 'Render', isi: [{ v: bayangan, s: setBayangan, l: 'Bayangan & cahaya' }] },
  ] as { judul: string; isi: Centang[] }[]).filter(k => k.isi.length);
  const jumlahAktif = kelompok.reduce((n, k) => n + k.isi.filter(c => c.v).length, 0);
  return (
    <Menu label="Tampil di kanvas: ukuran, label, sinar proyektor, kabel, bayangan" ikon={Layers3} teks="Tampilan" teksKelas="hidden xl:inline" lencana={jumlahAktif} lebar="w-64">
      {kelompok.map((k, i) => (
        <div key={k.judul}>
          {i > 0 && <GarisMenu />}
          <JudulMenu>{k.judul}</JudulMenu>
          <div className="space-y-2 px-2.5 pb-1.5 pt-0.5">
            {k.isi.map(c => <Sakelar key={c.l} label={c.l} nilai={c.v} onUbah={c.s} />)}
          </div>
        </div>
      ))}
    </Menu>
  );
}
