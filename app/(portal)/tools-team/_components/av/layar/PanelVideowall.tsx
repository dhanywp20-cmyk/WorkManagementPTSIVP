'use client';
/**
 * Saran videowall LCD untuk ukuran gambar yang dibutuhkan: susunan kolom × baris panel 16:9 yang
 * paling mendekati, termasuk celah bezel. Rumus: lib/av-layar-proyektor.ts.
 */
import { Catatan, f, Kartu, Nilai, Pilih, TombolSalin } from '../../bersama/ui';
import { aksiLembar, lembarAV } from '../lembar';
import { PANEL_VIDEOWALL, videowallUntuk } from '@/lib/av-layar-proyektor';
import { useState } from 'react';

const CATATAN = 'Ukuran panel = area gambar 16:9 dari diagonalnya; celah bezel (bezel-to-bezel) ditambahkan di antara panel. Bezel tipis (≤ 1,8 mm) disarankan bila teks/spreadsheet melintasi sambungan.';

export function PanelVideowall({ lebarM, tinggiM }: { lebarM: number; tinggiM: number }) {
  const [i, setI] = useState(2);
  const panel = PANEL_VIDEOWALL[i];
  const vw = videowallUntuk(lebarM, tinggiM, panel);
  const ringkas = () => `Videowall ${panel.nama}: ${vw.kolom} × ${vw.baris} (${vw.jumlah} panel), ${f(vw.lebarM)} × ${f(vw.tinggiM)} m (±${f(vw.diagonalInci, 0)}"), resolusi gabungan ${vw.resX} × ${vw.resY}.`;
  const lembar = () => lembarAV('Saran Videowall LCD',
    [['Ukuran dibutuhkan', `${f(lebarM)} × ${f(tinggiM)} m`], ['Panel', panel.nama]],
    [['Susunan', `${vw.kolom} × ${vw.baris} (${vw.jumlah} panel)`, true], ['Ukuran videowall', `${f(vw.lebarM)} × ${f(vw.tinggiM)} m`, true],
      ['Diagonal', `±${f(vw.diagonalInci, 0)}"`], ['Resolusi gabungan', `${vw.resX} × ${vw.resY}`]],
    CATATAN);
  return (
    <Kartu judul="Alternatif videowall LCD" aksi={<TombolSalin teks={ringkas} {...aksiLembar(lembar, 'Videowall LCD')} />}>
      <div className="grid gap-3 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] items-start">
        <Pilih label="Panel" nilai={String(i)} onUbah={v => setI(Number(v))} opsi={PANEL_VIDEOWALL.map((p, j) => ({ v: String(j), l: p.nama }))} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Nilai label="Susunan" nilai={`${vw.kolom} × ${vw.baris}`} ket={`${vw.jumlah} panel`} />
          <Nilai label="Ukuran" nilai={`${f(vw.lebarM)} × ${f(vw.tinggiM)}`} satuan="m" />
          <Nilai label="Diagonal" nilai={f(vw.diagonalInci, 0)} satuan="inci" />
          <Nilai label="Resolusi" nilai={`${vw.resX} × ${vw.resY}`} />
        </div>
      </div>
      <Catatan>{CATATAN}</Catatan>
    </Kartu>
  );
}
