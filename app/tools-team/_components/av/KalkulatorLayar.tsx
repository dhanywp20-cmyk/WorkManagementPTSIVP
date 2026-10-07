'use client';
/** Kalkulator ukuran layar dari jarak pandang (aturan 4-6-8). */
import { Angka, Catatan, f, Kartu, Nilai, Pilih, Segmen, TombolSalin } from '../bersama/ui';
import { aksiLembar, type Baris, lembarAV } from './lembar';
import { FAKTOR_PANDANG, jarakMaksDariLayar, type JenisPandang, layarDariJarak, ukuranDariDiagonal } from '@/lib/av-hitung';
import { useState } from 'react';

const JENIS: { v: JenisPandang; l: string }[] = [
  { v: 'umum', l: 'Umum (video, presentasi)' },
  { v: 'analitis', l: 'Analitis (dokumen, spreadsheet)' },
  { v: 'detail', l: 'Detail (gambar teknik, angka kecil)' },
];

export const RASIO: { v: string; l: string; w: number; h: number }[] = [
  { v: '16:9', l: '16:9', w: 16, h: 9 }, { v: '16:10', l: '16:10', w: 16, h: 10 },
  { v: '21:9', l: '21:9', w: 21, h: 9 }, { v: '4:3', l: '4:3', w: 4, h: 3 },
];

/* ── Ukuran layar & jarak pandang ────────────────────────────────────── */

export function KalkulatorLayar() {
  const [mode, setMode] = useState<'dariJarak' | 'dariLayar'>('dariJarak');
  const [jarak, setJarak] = useState(8);
  const [diag, setDiag] = useState(86);
  const [jenis, setJenis] = useState<JenisPandang>('umum');
  const [rasioK, setRasioK] = useState('16:9');
  const r = RASIO.find(x => x.v === rasioK)!;
  const dariJarak = layarDariJarak(jarak, jenis, r.w, r.h);
  const ukuran = ukuranDariDiagonal(diag, r.w, r.h);
  const TV = [55, 65, 75, 86, 98, 110];
  const tvCocok = TV.find(t => t >= dariJarak.diagonalInci);
  const ringkas = () => mode === 'dariJarak'
    ? `Penonton terjauh ${jarak} m (${jenis}): tinggi gambar min ${f(dariJarak.tinggiM)} m, lebar ${f(dariJarak.lebarM)} m, diagonal ±${f(dariJarak.diagonalInci, 0)}" (${rasioK}).`
    : `Layar ${diag}" ${rasioK}: ${f(ukuran.lebarM)} × ${f(ukuran.tinggiM)} m; jarak maks umum ${f(jarakMaksDariLayar(ukuran.tinggiM, 'umum'), 1)} m, analitis ${f(jarakMaksDariLayar(ukuran.tinggiM, 'analitis'), 1)} m, detail ${f(jarakMaksDariLayar(ukuran.tinggiM, 'detail'), 1)} m.`;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <Kartu judul="Masukan">
        <div className="space-y-3">
          <Segmen nilai={mode} onUbah={setMode} opsi={[{ v: 'dariJarak', l: 'Cari ukuran layar' }, { v: 'dariLayar', l: 'Cek layar yang ada' }]} />
          {mode === 'dariJarak'
            ? <Angka label="Jarak penonton terjauh" nilai={jarak} onUbah={v => v > 0 && setJarak(v)} satuan="m" />
            : <Angka label="Diagonal layar" nilai={diag} onUbah={v => v > 0 && setDiag(v)} satuan="inci" />}
          {mode === 'dariJarak' && <Pilih label="Jenis tampilan" nilai={jenis} onUbah={setJenis} opsi={JENIS} />}
          <Pilih label="Rasio" nilai={rasioK} onUbah={setRasioK} opsi={RASIO.map(x => ({ v: x.v, l: x.l }))} />
        </div>
        <Catatan>Aturan 4-6-8 (praktik AVIXA): penonton terjauh maksimal 8× tinggi gambar untuk tontonan umum, 6× untuk analitis, 4× untuk detail.</Catatan>
      </Kartu>
      <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(() => lembarAV('Ukuran Layar & Jarak Pandang',
        mode === 'dariJarak'
          ? [['Jarak penonton terjauh', `${f(jarak)} m`], ['Jenis tampilan', JENIS.find(j => j.v === jenis)!.l], ['Rasio', rasioK]]
          : [['Diagonal layar', `${diag}"`], ['Rasio', rasioK]],
        mode === 'dariJarak'
          ? [['Tinggi gambar minimum', `${f(dariJarak.tinggiM)} m`, true], ['Lebar gambar', `${f(dariJarak.lebarM)} m`], ['Diagonal minimum', `${f(dariJarak.diagonalInci, 0)}"`], ['Saran TV/display', tvCocok ? `${tvCocok}"` : '> 110" (LED / proyektor)', true]]
          : [['Lebar × tinggi', `${f(ukuran.lebarM)} × ${f(ukuran.tinggiM)} m`, true], ...(Object.keys(FAKTOR_PANDANG) as JenisPandang[]).map(j => [`Jarak maks · ${j}`, `${f(jarakMaksDariLayar(ukuran.tinggiM, j), 1)} m`] as Baris)],
        'Aturan 4-6-8 (praktik AVIXA): penonton terjauh maksimal 8× tinggi gambar untuk tontonan umum, 6× analitis, 4× detail.'), 'Ukuran Layar')} />}>
        {mode === 'dariJarak' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Nilai label="Tinggi gambar min" nilai={f(dariJarak.tinggiM)} satuan="m" />
            <Nilai label="Lebar gambar" nilai={f(dariJarak.lebarM)} satuan="m" />
            <Nilai label="Diagonal min" nilai={f(dariJarak.diagonalInci, 0)} satuan="inci" />
            <Nilai label="Saran TV/display" nilai={tvCocok ? `${tvCocok}"` : '> 110"'}
              ket={tvCocok ? 'ukuran standar terdekat ke atas' : 'pertimbangkan LED videotron / proyektor'} nada={tvCocok ? 'baik' : 'awas'} />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Nilai label="Lebar × tinggi" nilai={`${f(ukuran.lebarM)} × ${f(ukuran.tinggiM)}`} satuan="m" />
            {(Object.keys(FAKTOR_PANDANG) as JenisPandang[]).map(j => (
              <Nilai key={j} label={`Jarak maks · ${j}`} nilai={f(jarakMaksDariLayar(ukuran.tinggiM, j), 1)} satuan="m" />
            ))}
          </div>
        )}
      </Kartu>
    </div>
  );
}

/* ── Proyektor ───────────────────────────────────────────────────────── */
