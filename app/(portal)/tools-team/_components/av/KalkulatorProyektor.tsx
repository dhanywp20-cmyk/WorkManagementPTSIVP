'use client';
/** Kalkulator proyektor: throw ratio, jarak lempar, ukuran gambar, kecerahan. */
import { Angka, Catatan, f, Kartu, Nilai, Pilih, TombolSalin } from '../bersama/ui';
import { RASIO } from './KalkulatorLayar';
import { aksiLembar, lembarAV } from './lembar';
import { jarakLempar, lumenDibutuhkan } from '@/lib/av-hitung';
import { useState } from 'react';

export function KalkulatorProyektor() {
  const [lebar, setLebar] = useState(3);
  const [rasioK, setRasioK] = useState('16:10');
  const [throwMin, setThrowMin] = useState(1.39);
  const [throwMax, setThrowMax] = useState(2.09);
  const [lux, setLux] = useState(300);
  const [gain, setGain] = useState(1);
  const r = RASIO.find(x => x.v === rasioK)!;
  const tinggi = (lebar * r.h) / r.w;
  const luas = lebar * tinggi;
  const lumen = lumenDibutuhkan(luas, lux, gain);
  const ringkas = () => `Layar ${f(lebar)} × ${f(tinggi)} m (${rasioK}). Jarak lempar ${f(jarakLempar(throwMin, lebar))}-${f(jarakLempar(throwMax, lebar))} m (throw ${throwMin}-${throwMax}). Kebutuhan ±${f(lumen, 0)} lumen untuk cahaya ruangan ${lux} lux.`;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <Kartu judul="Masukan">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Angka label="Lebar gambar" nilai={lebar} onUbah={v => v > 0 && setLebar(v)} satuan="m" />
            <Pilih label="Rasio" nilai={rasioK} onUbah={setRasioK} opsi={RASIO.map(x => ({ v: x.v, l: x.l }))} />
            <Angka label="Throw ratio min" nilai={throwMin} onUbah={v => v > 0 && setThrowMin(v)} />
            <Angka label="Throw ratio maks" nilai={throwMax} onUbah={v => v > 0 && setThrowMax(v)} />
          </div>
          <Pilih label="Cahaya ruangan" nilai={lux} onUbah={setLux} opsi={[
            { v: 50, l: 'Gelap (bioskop) ±50 lux' }, { v: 150, l: 'Redup ±150 lux' },
            { v: 300, l: 'Ruang rapat ±300 lux' }, { v: 500, l: 'Kelas / kantor terang ±500 lux' }, { v: 750, l: 'Sangat terang ±750 lux' },
          ]} />
          <Angka label="Gain layar" nilai={gain} onUbah={v => v > 0 && setGain(v)} bantuan="Layar matte putih umumnya 1.0" />
        </div>
      </Kartu>
      <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(() => lembarAV('Proyektor',
        [['Lebar gambar', `${f(lebar)} m (${rasioK})`], ['Throw ratio', `${throwMin} – ${throwMax}`], ['Cahaya ruangan', `±${lux} lux`], ['Gain layar', f(gain)]],
        [['Ukuran gambar', `${f(lebar)} × ${f(tinggi)} m (${f((Math.hypot(lebar, tinggi) * 1000) / 25.4, 0)}")`], ['Jarak lempar', `${f(jarakLempar(throwMin, lebar))} – ${f(jarakLempar(throwMax, lebar))} m`, true], ['Lumen dibutuhkan', `±${f(lumen, 0)} lm`, true]],
        'Lumen dihitung agar kecerahan layar ±7× cahaya ruangan. Untuk konten detail/analitis naikkan 20-30%.'), 'Proyektor')} />}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <Nilai label="Ukuran gambar" nilai={`${f(lebar)} × ${f(tinggi)}`} satuan="m" ket={`${f((Math.hypot(lebar, tinggi) * 1000) / 25.4, 0)} inci`} />
          <Nilai label="Jarak lempar" nilai={`${f(jarakLempar(throwMin, lebar))}-${f(jarakLempar(throwMax, lebar))}`} satuan="m" ket="lensa ke layar" />
          <Nilai label="Lumen dibutuhkan" nilai={f(lumen, 0)} satuan="lm" ket={lumen > 7000 ? 'pertimbangkan LED/laser kelas venue' : undefined} nada={lumen > 7000 ? 'awas' : undefined} />
        </div>
        <Catatan>Lumen dihitung agar kecerahan layar ±7× cahaya ruangan (kontras cukup untuk presentasi). Untuk konten detail/analitis, naikkan 20-30%.</Catatan>
      </Kartu>
    </div>
  );
}

/* ── Bandwidth sinyal ────────────────────────────────────────────────── */
