'use client';
/**
 * Kalkulator proyektor: jarak lempar (lensa zoom), tinggi pasang lensa (lens shift), kecerahan menurut
 * kategori kontras ANSI/INFOCOMM 3M-2011 + susut cahaya, dan edge blending (PanelBlending).
 * Rumus: lib/av-layar-proyektor.ts.
 */
import { Angka, Catatan, f, Kartu, Nilai, Pilih, TombolSalin } from '../bersama/ui';
import { RASIO } from './KalkulatorLayar';
import { aksiLembar, lembarAV } from './lembar';
import { PanelBlending } from './proyektor/PanelBlending';
import { PilihPustaka } from '../pustaka/PilihPustaka';
import { angkaDari, type EntriPustaka, teksDari } from '@/lib/pustaka';
import { KONTRAS_ANSI, type KategoriKontras, lumenSpesifikasi, lumenUntukKontras, rentangJarakLempar, rentangTinggiLensa } from '@/lib/av-layar-proyektor';
import { useState } from 'react';

const SUMBER = [
  { v: 'laser', l: 'Laser (susut ±20% sampai 20.000 jam)', susut: 20 },
  { v: 'lampu', l: 'Lampu (susut ±40% sampai ganti lampu)', susut: 40 },
  { v: 'led', l: 'LED (susut ±25%)', susut: 25 },
] as const;
const LUX = [
  { v: 50, l: 'Gelap (bioskop) ±50 lux' }, { v: 150, l: 'Redup ±150 lux' },
  { v: 300, l: 'Ruang rapat ±300 lux' }, { v: 500, l: 'Kelas / kantor terang ±500 lux' }, { v: 750, l: 'Sangat terang ±750 lux' },
];
const CATATAN = 'Kecerahan dari kategori kontras ANSI/INFOCOMM 3M-2011: kontras = (cahaya proyektor + cahaya ruang di layar) / cahaya ruang di layar. Lux = cahaya ruang yang JATUH DI LAYAR (ukur dengan lux meter menghadap ruangan), bukan di meja. Lumen spesifikasi sudah memperhitungkan susut cahaya sampai akhir umur sumber cahaya.';

export function KalkulatorProyektor() {
  const [lebar, setLebar] = useState(3);
  const [rasioK, setRasioK] = useState('16:10');
  const [throwMin, setThrowMin] = useState(1.39);
  const [throwMax, setThrowMax] = useState(2.09);
  const [lux, setLux] = useState(300);
  const [gain, setGain] = useState(1);
  const [kontras, setKontras] = useState<KategoriKontras>('dasar');
  const [sumber, setSumber] = useState<(typeof SUMBER)[number]['v']>('laser');
  const [bawah, setBawah] = useState(0.9);
  const [shiftAtas, setShiftAtas] = useState(50);
  const [shiftBawah, setShiftBawah] = useState(50);
  /** Model dari Pustaka (opsional): lumennya dibandingkan dengan kebutuhan. */
  const [model, setModel] = useState<{ nama: string; lumen: number } | null>(null);
  const pakaiModel = (e: EntriPustaka) => {
    setThrowMin(angkaDari(e, 'throwMin', throwMin)); setThrowMax(angkaDari(e, 'throwMaks', throwMax));
    setShiftAtas(angkaDari(e, 'shiftAtas', 0)); setShiftBawah(angkaDari(e, 'shiftBawah', 0));
    const s = teksDari(e, 'sumber'); if (s === 'laser' || s === 'lampu' || s === 'led') setSumber(s);
    setModel({ nama: e.nama, lumen: angkaDari(e, 'lumen') });
  };
  const r = RASIO.find(x => x.v === rasioK)!;
  const tinggi = (lebar * r.h) / r.w;
  const luas = lebar * tinggi;
  const diag = (Math.hypot(lebar, tinggi) * 1000) / 25.4;
  const kat = KONTRAS_ANSI.find(k => k.v === kontras)!;
  const sus = SUMBER.find(s => s.v === sumber)!;
  const perlu = lumenUntukKontras(luas, lux, kat.rasio, gain);
  const spek = lumenSpesifikasi(perlu, sus.susut);
  const lempar = rentangJarakLempar(lebar, throwMin, throwMax);
  const lensa = rentangTinggiLensa(bawah, tinggi, shiftAtas, shiftBawah);
  const nadaLumen = spek > 20000 ? 'buruk' : spek > 10000 ? 'awas' : 'baik';
  const ringkas = () => [
    `*Proyektor - gambar ${f(lebar)} × ${f(tinggi)} m (${rasioK}, ±${f(diag, 0)}")*`,
    `Jarak lensa ke layar ${f(lempar.dekatM)}-${f(lempar.jauhM)} m (throw ${throwMin}-${throwMax})`,
    `Tinggi pusat lensa tanpa keystone: ${f(lensa.terendahM)}-${f(lensa.tertinggiM)} m (shift +${shiftAtas}% / −${shiftBawah}%)`,
    `Kontras ${kat.rasio}:1 (${kat.l}) di ${lux} lux: perlu ±${f(perlu, 0)} lm, spesifikasi ${sus.v} ±${f(spek, 0)} lm`,
    ...(model ? [`Model ${model.nama}: ${f(model.lumen, 0)} lm - ${model.lumen >= spek ? 'cukup' : model.lumen >= perlu ? 'cukup saat baru' : 'kurang'}`] : []),
  ].join('\n');
  const lembar = () => lembarAV('Proyektor',
    [['Lebar gambar', `${f(lebar)} m (${rasioK})`], ['Throw ratio', `${throwMin} – ${throwMax}`], ['Tepi bawah gambar', `${f(bawah)} m`], ['Lens shift', `+${shiftAtas}% / −${shiftBawah}%`],
      ['Cahaya di layar', `±${lux} lux`], ['Gain layar', f(gain)], ['Kategori kontras', `${kat.l} (${kat.rasio}:1)`], ['Sumber cahaya', sus.l]],
    [['Ukuran gambar', `${f(lebar)} × ${f(tinggi)} m (±${f(diag, 0)}")`], ['Jarak lempar', `${f(lempar.dekatM)} – ${f(lempar.jauhM)} m`, true],
      ['Tinggi pusat lensa', `${f(lensa.terendahM)} – ${f(lensa.tertinggiM)} m`, true], ['Lumen perlu', `±${f(perlu, 0)} lm`], ['Lumen spesifikasi', `±${f(spek, 0)} lm`, true]],
    CATATAN);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
        <Kartu judul="Masukan">
          <div className="space-y-3">
            <PilihPustaka jenis="proyektor" label="Model dari Pustaka" onPilih={pakaiModel} />
            <div className="grid grid-cols-2 gap-3">
              <Angka label="Lebar gambar" nilai={lebar} onUbah={v => v > 0 && setLebar(v)} satuan="m" />
              <Pilih label="Rasio" nilai={rasioK} onUbah={setRasioK} opsi={RASIO.map(x => ({ v: x.v, l: x.l }))} />
              <Angka label="Throw ratio min" nilai={throwMin} onUbah={v => v > 0 && setThrowMin(v)} />
              <Angka label="Throw ratio maks" nilai={throwMax} onUbah={v => v > 0 && setThrowMax(v)} />
              <Angka label="Tepi bawah gambar" nilai={bawah} onUbah={v => v >= 0 && setBawah(v)} satuan="m" />
              <Angka label="Gain layar" nilai={gain} onUbah={v => v > 0 && setGain(v)} bantuan="matte putih 1,0" />
              <Angka label="Lens shift atas" nilai={shiftAtas} onUbah={v => v >= 0 && setShiftAtas(v)} satuan="%" />
              <Angka label="Lens shift bawah" nilai={shiftBawah} onUbah={v => v >= 0 && setShiftBawah(v)} satuan="%" />
            </div>
            <Pilih label="Cahaya ruang di layar" nilai={lux} onUbah={setLux} opsi={LUX} />
            <Pilih label="Kategori kontras (ANSI/INFOCOMM 3M)" nilai={kontras} onUbah={setKontras} opsi={KONTRAS_ANSI.map(k => ({ v: k.v, l: `${k.l} · ${k.rasio}:1` }))} />
            <Pilih label="Sumber cahaya" nilai={sumber} onUbah={setSumber} opsi={SUMBER.map(s => ({ v: s.v, l: s.l }))} />
          </div>
        </Kartu>
        <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(lembar, 'Proyektor')} />}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Nilai label="Ukuran gambar" nilai={`${f(lebar)} × ${f(tinggi)}`} satuan="m" ket={`${f(diag, 0)} inci · ${f(luas)} m²`} />
            <Nilai label="Jarak lempar" nilai={`${f(lempar.dekatM)}-${f(lempar.jauhM)}`} satuan="m" ket="lensa ke layar" />
            <Nilai label="Tinggi pusat lensa" nilai={`${f(lensa.terendahM)}-${f(lensa.tertinggiM)}`} satuan="m" ket="tanpa keystone" />
            <Nilai label="Lumen perlu" nilai={f(perlu, 0)} satuan="lm" ket={`kontras ${kat.rasio}:1 di ${lux} lux`} />
            <Nilai label="Lumen spesifikasi" nilai={f(spek, 0)} satuan="lm" nada={nadaLumen}
              ket={spek > 20000 ? 'redupkan ruang / blending 2 proyektor' : spek > 10000 ? 'kelas venue / laser' : `+${sus.susut}% susut ${sus.v}`} />
            {model && (
              <Nilai label={`Model: ${model.nama}`} nilai={f(model.lumen, 0)} satuan="lm" nada={model.lumen >= spek ? 'baik' : model.lumen >= perlu ? 'awas' : 'buruk'}
                ket={model.lumen >= spek ? 'cukup sampai akhir umur' : model.lumen >= perlu ? 'cukup saat baru, kurang setelah susut' : 'kurang terang'} />
            )}
          </div>
          <Catatan>{CATATAN}</Catatan>
        </Kartu>
      </div>
      <PanelBlending lebarSatuAwal={lebar} />
    </div>
  );
}
