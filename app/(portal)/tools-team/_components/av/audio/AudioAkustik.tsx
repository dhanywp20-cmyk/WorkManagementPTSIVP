'use client';
/**
 * Audio · akustik ruang: RT60 Sabine dari ukuran ruang, material permukaan & jumlah orang, dibanding
 * target per jenis ruang; luas panel akustik tambahan agar masuk target. Rumus: lib/av-audio-jaringan.ts.
 */
import { Angka, Catatan, f, Kartu, Nilai, Pilih, TombolSalin } from '../../bersama/ui';
import { aksiLembar, lembarAV } from '../lembar';
import { MATERIAL_AKUSTIK, rt60Sabine, serapanTambahanM2, TARGET_RT60 } from '@/lib/av-audio-jaringan';
import { angkaDari } from '@/lib/pustaka';
import { usePustaka } from '../../pustaka/usePustaka';
import { useState } from 'react';

/** Material diacu lewat NAMA - daftarnya dari Pustaka (material-akustik), bawaan kode bila kosong. */
interface Tambahan { material: string; luas: number }
const namaMat = (m: string) => m;
const CATATAN = 'RT60 Sabine dengan koefisien serap tipikal 500 Hz - perkiraan awal untuk ruang berbentuk kotak. Permukaan tambahan (kaca, panel akustik, gorden) mengganti sebagian dinding dengan luas yang sama. Panel akustik paling efektif di dinding belakang & titik pantul samping; ruang video conference sebaiknya ≤ 0,6 s.';

export function AudioAkustik() {
  const { entri } = usePustaka('material-akustik');
  const bahan = entri.length ? entri.map(e => ({ l: e.nama, a: angkaDari(e, 'a') })) : MATERIAL_AKUSTIK.map(m => ({ l: m.l, a: m.a }));
  const koef = (m: string) => bahan.find(b => b.l === m)?.a ?? MATERIAL_AKUSTIK.find(x => x.l === m)?.a ?? 0.05;
  const OPSI_MAT = bahan.map(b => ({ v: b.l, l: `${b.l} (α ${b.a})` }));
  //  Panel akustik untuk saran luas: entri "Panel akustik" di pustaka, bila tidak ada α 0,9.
  const aPanel = bahan.find(b => /panel akustik/i.test(b.l))?.a ?? 0.9;
  const [p, setP] = useState(8); const [l, setL] = useState(6); const [t, setT] = useState(3);
  const [lantai, setLantai] = useState('Keramik / granit');
  const [plafon, setPlafon] = useState('Gipsum');
  const [dinding, setDinding] = useState('Beton / bata plester');
  const [tambahan, setTambahan] = useState<Tambahan[]>([{ material: 'Kaca', luas: 12 }]);
  const [orang, setOrang] = useState(10);
  const [jenis, setJenis] = useState('meeting');
  const luasLantai = p * l, luasDinding = 2 * (p + l) * t;
  const luasTambahan = tambahan.reduce((n, x) => n + Math.max(0, x.luas), 0);
  const dindingSisa = Math.max(0, luasDinding - luasTambahan);
  const permukaan = [
    { luasM2: luasLantai, a: koef(lantai) }, { luasM2: luasLantai, a: koef(plafon) }, { luasM2: dindingSisa, a: koef(dinding) },
    ...tambahan.map(x => ({ luasM2: x.luas, a: koef(x.material) })),
  ];
  const volume = luasLantai * t;
  const h = rt60Sabine(volume, permukaan, orang);
  const tg = TARGET_RT60[jenis];
  const tambahSerap = serapanTambahanM2(volume, h.serapanM2, tg.maks);
  //  Panel akustik di atas dinding: tiap m² menambah α panel − α dinding.
  const panelM2 = tambahSerap > 0 ? tambahSerap / Math.max(0.05, aPanel - koef(dinding)) : 0;
  const status = h.rt60 > tg.maks ? 'terlalu bergema' : h.rt60 < tg.min ? 'terlalu "mati"' : 'sesuai target';
  const ubah = (i: number, x: Partial<Tambahan>) => setTambahan(a => a.map((v, j) => (j === i ? { ...v, ...x } : v)));
  const ringkas = () => `Ruang ${p}×${l}×${t} m (${f(volume, 0)} m³), ${orang} orang: RT60 ±${f(h.rt60, 2)} s (${tg.l}: ${tg.min}-${tg.maks} s) - ${status}${panelM2 > 0 ? `; tambah ±${f(panelM2, 1)} m² panel akustik` : ''}.`;
  const lembar = () => lembarAV('Audio · Akustik Ruang (RT60)',
    [['Ukuran ruang', `${p} × ${l} × ${t} m (${f(volume, 0)} m³)`], ['Lantai / plafon / dinding', `${namaMat(lantai)} / ${namaMat(plafon)} / ${namaMat(dinding)}`], ['Jumlah orang', String(orang)], ['Jenis ruang', tg.l]],
    [['Serapan total', `${f(h.serapanM2, 1)} m² Sabin`], ['RT60', `${f(h.rt60, 2)} s`, true], ['Target', `${tg.min} – ${tg.maks} s`], ['Status', status, true], ['Panel akustik tambahan', panelM2 > 0 ? `±${f(panelM2, 1)} m²` : '-']],
    CATATAN,
    [{ judul: 'Permukaan', jenis: 'tabel', kepala: ['Permukaan', 'Material', 'Luas', 'Serapan'], rataKanan: [2, 3],
      isi: [['Lantai', namaMat(lantai), `${f(luasLantai, 1)} m²`, `${f(luasLantai * koef(lantai), 2)}`], ['Plafon', namaMat(plafon), `${f(luasLantai, 1)} m²`, `${f(luasLantai * koef(plafon), 2)}`],
        ['Dinding', namaMat(dinding), `${f(dindingSisa, 1)} m²`, `${f(dindingSisa * koef(dinding), 2)}`], ...tambahan.map(x => ['Tambahan', namaMat(x.material), `${f(x.luas, 1)} m²`, `${f(x.luas * koef(x.material), 2)}`])] }]);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] items-start">
      <Kartu judul="Ruang & material">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Angka label="Panjang" nilai={p} onUbah={v => v > 0 && setP(v)} satuan="m" />
            <Angka label="Lebar" nilai={l} onUbah={v => v > 0 && setL(v)} satuan="m" />
            <Angka label="Tinggi" nilai={t} onUbah={v => v > 0 && setT(v)} satuan="m" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Pilih label="Lantai" nilai={lantai} onUbah={setLantai} opsi={OPSI_MAT} />
            <Pilih label="Plafon" nilai={plafon} onUbah={setPlafon} opsi={OPSI_MAT} />
            <Pilih label="Dinding" nilai={dinding} onUbah={setDinding} opsi={OPSI_MAT} />
          </div>
          {tambahan.map((x, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_96px_32px] gap-2 items-end">
              <Pilih label={i === 0 ? 'Permukaan di dinding (kaca, panel, gorden)' : ''} nilai={x.material} onUbah={v => ubah(i, { material: v })} opsi={OPSI_MAT} />
              <Angka label={i === 0 ? 'Luas' : ''} nilai={x.luas} onUbah={v => v >= 0 && ubah(i, { luas: v })} satuan="m²" />
              <button type="button" aria-label="Hapus permukaan" onClick={() => setTambahan(a => a.filter((_, j) => j !== i))}
                className="h-[38px] rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setTambahan(a => [...a, { material: bahan.find(b => /panel akustik/i.test(b.l))?.l ?? bahan[bahan.length - 1].l, luas: 6 }])}
            className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">+ Tambah permukaan</button>
          <div className="grid grid-cols-2 gap-3">
            <Angka label="Jumlah orang" nilai={orang} onUbah={v => v >= 0 && setOrang(Math.round(v))} step={1} />
            <Pilih label="Jenis ruang" nilai={jenis} onUbah={setJenis} opsi={Object.entries(TARGET_RT60).map(([v, x]) => ({ v, l: `${x.l} (${x.min}-${x.maks} s)` }))} />
          </div>
        </div>
      </Kartu>
      <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(lembar, 'Akustik Ruang')} />}>
        <div className="grid grid-cols-2 gap-2.5">
          <Nilai label="Volume" nilai={f(volume, 0)} satuan="m³" />
          <Nilai label="Serapan total" nilai={f(h.serapanM2, 1)} satuan="m²" ket="Sabin" />
          <Nilai label="RT60" nilai={f(h.rt60, 2)} satuan="s" nada={status === 'sesuai target' ? 'baik' : h.rt60 > tg.maks * 1.5 ? 'buruk' : 'awas'} ket={status} />
          <Nilai label="Target" nilai={`${tg.min}-${tg.maks}`} satuan="s" ket={tg.l} />
          <Nilai label="Panel akustik tambahan" nilai={panelM2 > 0 ? f(panelM2, 1) : '-'} satuan={panelM2 > 0 ? 'm²' : undefined} ket={panelM2 > 0 ? 'panel 50 mm di dinding' : 'tidak perlu'} />
        </div>
        <Catatan>{CATATAN}</Catatan>
      </Kartu>
    </div>
  );
}
