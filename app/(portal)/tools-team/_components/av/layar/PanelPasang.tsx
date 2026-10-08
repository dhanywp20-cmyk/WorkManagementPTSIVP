'use client';
/**
 * Pemasangan layar & penonton terdekat: tepi atas vs plafon, sudut leher penonton terdekat (batas
 * nyaman 30°), dan resolusi yang cukup tajam pada jarak itu (ketajaman mata 1 menit busur).
 * Rumus: lib/av-layar-proyektor.ts.
 */
import { Angka, Catatan, f, Kartu, Nilai, TombolSalin } from '../../bersama/ui';
import { aksiLembar, lembarAV } from '../lembar';
import { cekResolusi, jarakTerdekatNyamanM, sudutKeAtasDerajat } from '@/lib/av-layar-proyektor';
import { useState } from 'react';

const CATATAN = 'Tepi bawah gambar ±1,0-1,2 m supaya terlihat melewati kepala penonton di depan. Sudut ke tepi atas ≤ 30° dari mata penonton terdekat (nyaman untuk menonton lama). Resolusi "cukup" bila penonton terdekat duduk sejauh jarak piksel menyatu atau lebih (ketajaman mata ±1 menit busur).';

export function PanelPasang({ lebarM, tinggiM }: { lebarM: number; tinggiM: number }) {
  const [mata, setMata] = useState(1.2);
  const [bawah, setBawah] = useState(1.0);
  const [plafon, setPlafon] = useState(2.8);
  const [terdekat, setTerdekat] = useState(2.5);
  const atas = bawah + tinggiM;
  const sisaPlafon = plafon - atas;
  const sudut = sudutKeAtasDerajat(terdekat, mata, bawah, tinggiM);
  const nyamanM = jarakTerdekatNyamanM(mata, bawah, tinggiM);
  const res = cekResolusi(lebarM, terdekat);
  const resCukup = res.find(r => r.cukup);
  const ringkas = () => [
    `*Pemasangan layar ${f(lebarM)} × ${f(tinggiM)} m*`,
    `Tepi bawah ${f(bawah)} m, tepi atas ${f(atas)} m (plafon ${f(plafon)} m, sisa ${f(sisaPlafon)} m)`,
    `Penonton terdekat ${f(terdekat)} m: sudut ke tepi atas ${f(sudut, 1)}° (jarak nyaman ≥ ${f(nyamanM)} m)`,
    ...res.map(r => `${r.nama}: pitch ${f(r.pitchMm)} mm, piksel menyatu ≥ ${f(r.menyatuM, 1)} m ${r.cukup ? '✓' : '✗'}`),
  ].join('\n');
  const lembar = () => lembarAV('Pemasangan Layar & Penonton Terdekat',
    [['Ukuran gambar', `${f(lebarM)} × ${f(tinggiM)} m`], ['Tinggi mata', `${f(mata)} m`], ['Tepi bawah gambar', `${f(bawah)} m`], ['Tinggi plafon', `${f(plafon)} m`], ['Penonton terdekat', `${f(terdekat)} m`]],
    [['Tepi atas gambar', `${f(atas)} m`, true], ['Sudut ke tepi atas', `${f(sudut, 1)}°`, true], ['Jarak terdekat nyaman', `≥ ${f(nyamanM)} m`],
      ['Resolusi cukup', resCukup ? resCukup.nama : 'belum ada (pakai 8K / jauhkan penonton)', true]],
    CATATAN,
    [{ judul: 'Ketajaman per resolusi', jenis: 'tabel', kepala: ['Resolusi', 'Pitch piksel', 'Piksel menyatu mulai', 'Penonton terdekat'], rataKanan: [1, 2],
      isi: res.map(r => [`${r.nama} (${r.x}×${r.y})`, `${f(r.pitchMm)} mm`, `${f(r.menyatuM, 1)} m`, r.cukup ? 'tajam' : 'piksel terlihat']) }]);
  return (
    <Kartu judul="Pemasangan & penonton terdekat" aksi={<TombolSalin teks={ringkas} {...aksiLembar(lembar, 'Pemasangan Layar')} />}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-3 content-start">
          <Angka label="Tinggi mata" nilai={mata} onUbah={v => v > 0 && setMata(v)} satuan="m" bantuan="duduk 1,2 · berdiri 1,6" />
          <Angka label="Tepi bawah gambar" nilai={bawah} onUbah={v => v >= 0 && setBawah(v)} satuan="m" />
          <Angka label="Tinggi plafon" nilai={plafon} onUbah={v => v > 0 && setPlafon(v)} satuan="m" />
          <Angka label="Penonton terdekat" nilai={terdekat} onUbah={v => v > 0 && setTerdekat(v)} satuan="m" />
        </div>
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Nilai label="Tepi atas gambar" nilai={f(atas)} satuan="m" nada={sisaPlafon < 0.05 ? 'buruk' : sisaPlafon < 0.2 ? 'awas' : 'baik'}
              ket={sisaPlafon < 0.05 ? 'melewati plafon - turunkan / kecilkan' : `sisa ${f(sisaPlafon)} m ke plafon`} />
            <Nilai label="Sudut penonton terdekat" nilai={f(sudut, 1)} satuan="°" nada={sudut > 35 ? 'buruk' : sudut > 30 ? 'awas' : 'baik'} ket="batas nyaman 30°" />
            <Nilai label="Jarak terdekat nyaman" nilai={`≥ ${f(nyamanM)}`} satuan="m" nada={terdekat >= nyamanM ? 'baik' : 'awas'} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50 text-slate-600"><tr>
                <th className="px-3 py-2 text-left">Resolusi</th><th className="px-3 py-2 text-right">Pitch piksel</th>
                <th className="px-3 py-2 text-right">Piksel menyatu</th><th className="px-3 py-2 text-left">Di {f(terdekat)} m</th>
              </tr></thead>
              <tbody>{res.map(r => (
                <tr key={r.nama} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-semibold text-slate-800">{r.nama}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{f(r.pitchMm)} mm</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">≥ {f(r.menyatuM, 1)} m</td>
                  <td className={`px-3 py-1.5 font-semibold ${r.cukup ? 'text-emerald-700' : 'text-amber-700'}`}>{r.cukup ? '✓ tajam' : 'piksel terlihat'}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Catatan>{CATATAN}</Catatan>
    </Kartu>
  );
}
