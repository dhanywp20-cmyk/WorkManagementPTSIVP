'use client';
/**
 * Edge blending: kolom × baris proyektor identik dengan tumpang-tindih → ukuran & resolusi gambar
 * gabungan, lebar & piksel area blending. Rumus: lib/av-layar-proyektor.ts (hitungBlending).
 */
import { Angka, Catatan, f, Kartu, Nilai, Pilih, TombolSalin } from '../../bersama/ui';
import { aksiLembar, lembarAV } from '../lembar';
import { hitungBlending } from '@/lib/av-layar-proyektor';
import { useState } from 'react';

const RESOLUSI = [
  { v: 'wuxga', l: 'WUXGA 1920 × 1200', x: 1920, y: 1200 },
  { v: 'fhd', l: 'Full HD 1920 × 1080', x: 1920, y: 1080 },
  { v: '4k', l: '4K UHD 3840 × 2160', x: 3840, y: 2160 },
  { v: 'wxga', l: 'WXGA 1280 × 800', x: 1280, y: 800 },
];
const CATATAN = 'Overlap umum 15-25% lebar gambar satu proyektor. Area tumpang-tindih menjadi lebih terang sebelum di-blend; gunakan prosesor / fitur blending bawaan proyektor dan proyektor dengan model, lensa & umur sumber cahaya yang sama.';

export function PanelBlending({ lebarSatuAwal }: { lebarSatuAwal: number }) {
  const [kolom, setKolom] = useState(2);
  const [baris, setBaris] = useState(1);
  const [lebarSatu, setLebarSatu] = useState(lebarSatuAwal);
  const [overlap, setOverlap] = useState(15);
  const [resK, setResK] = useState('wuxga');
  const res = RESOLUSI.find(x => x.v === resK)!;
  const b = hitungBlending(kolom, baris, lebarSatu, overlap, res.x, res.y);
  const ringkas = () => `Blending ${kolom} × ${baris} (${b.jumlah} proyektor ${res.l}), overlap ${overlap}% (${f(b.overlapM)} m / ${b.overlapPx} px): gambar ${f(b.lebarM)} × ${f(b.tinggiM)} m, resolusi ${b.resX} × ${b.resY}.`;
  const lembar = () => lembarAV('Edge Blending Proyektor',
    [['Susunan', `${kolom} × ${baris}`], ['Resolusi per proyektor', res.l], ['Lebar gambar per proyektor', `${f(lebarSatu)} m`], ['Overlap', `${overlap}%`]],
    [['Jumlah proyektor', String(b.jumlah)], ['Gambar gabungan', `${f(b.lebarM)} × ${f(b.tinggiM)} m`, true], ['Resolusi gabungan', `${b.resX} × ${b.resY}`, true], ['Lebar area blending', `${f(b.overlapM)} m · ${b.overlapPx} px`]],
    CATATAN);
  return (
    <Kartu judul="Edge blending" aksi={<TombolSalin teks={ringkas} {...aksiLembar(lembar, 'Edge Blending')} />}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-3 content-start">
          <Angka label="Kolom" nilai={kolom} onUbah={v => v >= 1 && v <= 12 && setKolom(Math.round(v))} step={1} />
          <Angka label="Baris" nilai={baris} onUbah={v => v >= 1 && v <= 6 && setBaris(Math.round(v))} step={1} />
          <Angka label="Lebar gambar / proyektor" nilai={lebarSatu} onUbah={v => v > 0 && setLebarSatu(v)} satuan="m" />
          <Angka label="Overlap" nilai={overlap} onUbah={v => v >= 0 && v <= 50 && setOverlap(v)} satuan="%" />
          <div className="col-span-2"><Pilih label="Resolusi proyektor" nilai={resK} onUbah={setResK} opsi={RESOLUSI.map(x => ({ v: x.v, l: x.l }))} /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 content-start">
          <Nilai label="Proyektor" nilai={b.jumlah} ket={`${kolom} × ${baris}`} />
          <Nilai label="Gambar gabungan" nilai={`${f(b.lebarM)} × ${f(b.tinggiM)}`} satuan="m" />
          <Nilai label="Resolusi gabungan" nilai={`${b.resX} × ${b.resY}`} />
          <Nilai label="Area blending" nilai={f(b.overlapM)} satuan="m" ket={`${b.overlapPx} px`} />
        </div>
      </div>
      <Catatan>{CATATAN}</Catatan>
    </Kartu>
  );
}
