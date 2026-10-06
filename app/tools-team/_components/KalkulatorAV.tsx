'use client';
import { useMemo, useState } from 'react';
import {
  layarDariJarak, ukuranDariDiagonal, jarakMaksDariLayar, FAKTOR_PANDANG, type JenisPandang,
  jarakLempar, lumenDibutuhkan, bandwidthGbps, ANTARMUKA, type Chroma,
  splPadaJarak, splMaks, speakerPlafon, hitungDaya, type Beban,
} from '@/lib/av-hitung';
import { Angka, Pilih, Segmen, Kartu, Nilai, TombolSalin, Catatan, f } from './bersama/ui';
import { bukaCetak, unduhLembarPNG, namaBerkas, type Lembar, type Seksi } from './bersama/cetak';
import { Ikon } from '@/components/shared/Ikon';

/**
 * Kalkulator AV (ukuran layar, proyektor, bandwidth sinyal, audio, daya & panas). Rumus di
 * lib/av-hitung.ts; tiap hasil bisa disalin, dicetak (lembar A4), dan diunduh PNG.
 */

type Baris = [string, string, boolean?];
const info = (b: Baris[]) => b.map(([label, nilai, sorot]) => ({ label, nilai, sorot }));
/** Lembar cetak sederhana: masukan | hasil, plus seksi tambahan (tabel). */
function lembarAV(judul: string, masukan: Baris[], hasil: Baris[], catatan: string, tambahan: Seksi[] = []): Lembar {
  return {
    judul, subjudul: 'Kalkulator AV · Tools Team',
    kepala: [['Tanggal', new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })]],
    seksi: [{ judul: 'Masukan & hasil', jenis: 'info', kiri: info(masukan), kanan: info(hasil) }, ...tambahan],
    catatan,
  };
}
const aksiLembar = (l: () => Lembar, nama: string) => ({ onCetak: () => bukaCetak(l()), onPng: () => unduhLembarPNG(l(), namaBerkas(nama)) });

const JENIS: { v: JenisPandang; l: string }[] = [
  { v: 'umum', l: 'Umum (video, presentasi)' },
  { v: 'analitis', l: 'Analitis (dokumen, spreadsheet)' },
  { v: 'detail', l: 'Detail (gambar teknik, angka kecil)' },
];
const RASIO: { v: string; l: string; w: number; h: number }[] = [
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
const RESOLUSI = [[1280, 720], [1920, 1080], [2560, 1440], [3840, 2160], [4096, 2160], [7680, 4320]];
export function KalkulatorSinyal() {
  const [res, setRes] = useState('3840x2160');
  const [hz, setHz] = useState(60);
  const [bit, setBit] = useState(8);
  const [chroma, setChroma] = useState<Chroma>('4:4:4');
  const [lebar, tinggi] = res.split('x').map(Number);
  const b = bandwidthGbps(lebar, tinggi, hz, bit, chroma);
  const ringkas = () => `${lebar}×${tinggi} @${hz}Hz ${bit}-bit ${chroma}: ±${f(b.dataGbps, 2)} Gbps. Cocok: ${ANTARMUKA.filter(a => a.gbps >= b.dataGbps).map(a => a.nama).join(', ') || 'tidak ada (butuh kompresi DSC)'}.`;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <Kartu judul="Format sinyal">
        <div className="grid grid-cols-2 gap-3">
          <Pilih label="Resolusi" nilai={res} onUbah={setRes} opsi={RESOLUSI.map(([w, h]) => ({ v: `${w}x${h}`, l: `${w} × ${h}` }))} />
          <Pilih label="Refresh" nilai={hz} onUbah={setHz} opsi={[24, 30, 50, 60, 120, 144].map(v => ({ v, l: `${v} Hz` }))} />
          <Pilih label="Bit depth" nilai={bit} onUbah={setBit} opsi={[8, 10, 12].map(v => ({ v, l: `${v}-bit` }))} />
          <Pilih label="Chroma" nilai={chroma} onUbah={setChroma} opsi={(['4:4:4', '4:2:2', '4:2:0'] as Chroma[]).map(v => ({ v, l: v }))} />
        </div>
      </Kartu>
      <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(() => lembarAV('Bandwidth Sinyal Video',
        [['Resolusi', `${lebar} × ${tinggi}`], ['Refresh', `${hz} Hz`], ['Bit depth / chroma', `${bit}-bit · ${chroma}`]],
        [['Data video', `${f(b.dataGbps, 2)} Gbps`, true], ['Pixel clock', `${f(b.pixelClockMHz, 1)} MHz`]],
        'Timing standar termasuk blanking. Extender/matrix dengan kompresi (DSC, VC-2) bisa membawa format di atas kapasitas murninya.',
        [{ judul: 'Kecocokan antarmuka', jenis: 'tabel', kepala: ['Antarmuka', 'Kapasitas', 'Status', 'Panjang kabel'], rataKanan: [1],
          isi: ANTARMUKA.map(a => [a.nama, `${a.gbps} Gbps`, a.gbps >= b.dataGbps ? 'Cukup' : 'Tidak cukup', a.panjang]) }]), 'Bandwidth Sinyal')} />}>
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <Nilai label="Data video" nilai={f(b.dataGbps, 2)} satuan="Gbps" />
          <Nilai label="Pixel clock" nilai={f(b.pixelClockMHz, 1)} satuan="MHz" />
        </div>
        <ul className="divide-y divide-slate-100">
          {ANTARMUKA.map(a => {
            const ok = a.gbps >= b.dataGbps;
            return (
              <li key={a.nama} className="py-2 flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold text-slate-800">{a.nama}</span>
                  <span className="block text-[11.5px] text-slate-500">{a.panjang}</span>
                </span>
                <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {ok ? 'Cukup' : 'Tidak cukup'} · {a.gbps} Gbps
                </span>
              </li>
            );
          })}
        </ul>
        <Catatan>Perhitungan memakai timing standar (termasuk blanking). Extender/matrix tertentu memakai kompresi (DSC, VC-2) sehingga bisa membawa format di atas kapasitas murninya - cek spesifikasi perangkat.</Catatan>
      </Kartu>
    </div>
  );
}

/* ── Audio ───────────────────────────────────────────────────────────── */
export function KalkulatorAudio() {
  const [mode, setMode] = useState<'plafon' | 'spl'>('plafon');
  const [p, setP] = useState(10); const [l, setL] = useState(8); const [t, setT] = useState(3);
  const [telinga, setTelinga] = useState(1.2); const [sudut, setSudut] = useState(90);
  const [rapat, setRapat] = useState<'rapat' | 'standar'>('rapat');
  const [sens, setSens] = useState(90); const [daya, setDaya] = useState(60); const [jarak, setJarak] = useState(10);
  const sp = speakerPlafon(p, l, t, telinga, sudut, rapat === 'rapat');
  const maks = splMaks(sens, daya);
  const diJarak = splPadaJarak(maks, jarak);
  const ringkas = () => mode === 'plafon'
    ? `Ruang ${p}×${l} m, plafon ${t} m, speaker ${sudut}°: diameter cakupan ${f(sp.diameterM)} m, jarak antar speaker ±${f(sp.jarakM)} m, butuh ${sp.jumlah} speaker (${sp.kolom}×${sp.baris}).`
    : `Speaker ${sens} dB/1W/1m @${daya} W: SPL maks ${f(maks, 1)} dB di 1 m, ±${f(diJarak, 1)} dB di ${jarak} m.`;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <Kartu judul="Masukan">
        <div className="space-y-3">
          <Segmen nilai={mode} onUbah={setMode} opsi={[{ v: 'plafon', l: 'Speaker plafon' }, { v: 'spl', l: 'SPL & jarak' }]} />
          {mode === 'plafon' ? (
            <div className="grid grid-cols-2 gap-3">
              <Angka label="Panjang ruang" nilai={p} onUbah={v => v > 0 && setP(v)} satuan="m" />
              <Angka label="Lebar ruang" nilai={l} onUbah={v => v > 0 && setL(v)} satuan="m" />
              <Angka label="Tinggi plafon" nilai={t} onUbah={v => v > 0 && setT(v)} satuan="m" />
              <Angka label="Tinggi telinga" nilai={telinga} onUbah={v => v > 0 && setTelinga(v)} satuan="m" bantuan="duduk 1,2 · berdiri 1,6" />
              <Angka label="Sudut sebaran" nilai={sudut} onUbah={v => v > 10 && v < 180 && setSudut(v)} satuan="°" />
              <Segmen label="Kerapatan" nilai={rapat} onUbah={setRapat} opsi={[{ v: 'rapat', l: 'Merata' }, { v: 'standar', l: 'Tepi-tepi' }]} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Angka label="Sensitivitas" nilai={sens} onUbah={setSens} satuan="dB" bantuan="1W / 1m" />
              <Angka label="Daya ke speaker" nilai={daya} onUbah={v => v > 0 && setDaya(v)} satuan="W" />
              <Angka label="Jarak pendengar" nilai={jarak} onUbah={v => v > 0 && setJarak(v)} satuan="m" />
            </div>
          )}
        </div>
      </Kartu>
      <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(() => (mode === 'plafon'
        ? lembarAV('Audio · Speaker Plafon',
          [['Ruang', `${f(p)} × ${f(l)} m`], ['Tinggi plafon / telinga', `${f(t)} m / ${f(telinga)} m`], ['Sudut sebaran', `${sudut}° · ${rapat === 'rapat' ? 'merata' : 'tepi-tepi'}`]],
          [['Diameter cakupan', `${f(sp.diameterM)} m`], ['Jarak antar speaker', `${f(sp.jarakM)} m`], ['Jumlah speaker', `${sp.jumlah} (${sp.kolom} × ${sp.baris})`, true]],
          'Hitungan geometris; sisakan headroom 6-10 dB dari daya amplifier.')
        : lembarAV('Audio · SPL & Jarak',
          [['Sensitivitas', `${sens} dB (1 W / 1 m)`], ['Daya ke speaker', `${daya} W`], ['Jarak pendengar', `${f(jarak)} m`]],
          [['SPL maks @1 m', `${f(maks, 1)} dB`], [`SPL @${f(jarak)} m`, `${f(diJarak, 1)} dB`, true]],
          'Medan bebas: turun 6 dB tiap jarak 2×. Pantulan ruang menambah SPL namun menurunkan kejelasan (STI).')), 'Audio')} />}>
        {mode === 'plafon' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Nilai label="Diameter cakupan" nilai={f(sp.diameterM)} satuan="m" ket="di ketinggian telinga" />
            <Nilai label="Jarak antar speaker" nilai={f(sp.jarakM)} satuan="m" />
            <Nilai label="Jumlah speaker" nilai={sp.jumlah} ket={`${sp.kolom} × ${sp.baris} titik`} nada="baik" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Nilai label="SPL maks @1 m" nilai={f(maks, 1)} satuan="dB" />
            <Nilai label={`SPL @${jarak} m`} nilai={f(diJarak, 1)} satuan="dB"
              ket={diJarak >= 85 ? 'cukup untuk musik/event' : diJarak >= 70 ? 'cukup untuk percakapan/paging' : 'kurang - tambah speaker/daya'}
              nada={diJarak >= 70 ? 'baik' : 'buruk'} />
            <Nilai label="Turun per 2× jarak" nilai="-6" satuan="dB" ket="medan bebas, tanpa pantulan" />
          </div>
        )}
        <Catatan>Hitungan geometris/medan bebas; ruangan dengan pantulan kuat menambah SPL namun menurunkan kejelasan (STI). Sisakan headroom 6-10 dB dari daya amplifier.</Catatan>
      </Kartu>
    </div>
  );
}

/* ── Daya, UPS & panas ───────────────────────────────────────────────── */
const BEBAN_AWAL: Beban[] = [
  { nama: 'Display / TV 86"', watt: 400, jumlah: 1 },
  { nama: 'Video conference bar', watt: 60, jumlah: 1 },
  { nama: 'DSP / amplifier', watt: 150, jumlah: 1 },
  { nama: 'Switcher / matrix', watt: 50, jumlah: 1 },
];
export function KalkulatorDaya() {
  const [beban, setBeban] = useState<Beban[]>(BEBAN_AWAL);
  const [tegangan, setTegangan] = useState(220);
  const [pf, setPf] = useState(0.9);
  const h = useMemo(() => hitungDaya(beban, tegangan, pf), [beban, tegangan, pf]);
  const ubah = (i: number, x: Partial<Beban>) => setBeban(b => b.map((v, j) => (j === i ? { ...v, ...x } : v)));
  const ringkas = () => [
    '*Beban daya perangkat AV*',
    ...beban.map(b => `- ${b.nama}: ${b.jumlah} × ${b.watt} W`),
    `Total ${f(h.totalW, 0)} W (${f(h.va, 0)} VA), arus ${f(h.arusA, 1)} A @${tegangan}V, MCB ${h.mcbA} A`,
    `UPS saran ${f(h.upsVA, 0)} VA; panas ±${f(h.btu, 0)} BTU/jam (±${f(h.pkAC, 1)} PK)`,
  ].join('\n');
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] items-start">
      <Kartu judul="Daftar perangkat">
        <div className="space-y-2">
          {beban.map((b, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_80px_64px_32px] gap-2 items-end">
              <label className="block min-w-0">
                {i === 0 && <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Perangkat</span>}
                <input value={b.nama} onChange={e => ubah(i, { nama: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
              </label>
              <Angka label={i === 0 ? 'Watt' : ''} nilai={b.watt} onUbah={v => ubah(i, { watt: v })} />
              <Angka label={i === 0 ? 'Jml' : ''} nilai={b.jumlah} onUbah={v => ubah(i, { jumlah: Math.round(v) })} step={1} />
              <button type="button" aria-label={`Hapus ${b.nama}`} onClick={() => setBeban(x => x.filter((_, j) => j !== i))}
                className="h-[38px] rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setBeban(b => [...b, { nama: 'Perangkat baru', watt: 100, jumlah: 1 }])}
            className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">+ Tambah perangkat</button>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Angka label="Tegangan" nilai={tegangan} onUbah={v => v > 0 && setTegangan(v)} satuan="V" />
            <Angka label="Power factor" nilai={pf} onUbah={v => v > 0.3 && v <= 1 && setPf(v)} />
          </div>
        </div>
      </Kartu>
      <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(() => lembarAV('Daya, UPS & Panas Perangkat AV',
        [['Tegangan', `${tegangan} V`], ['Power factor', f(pf)], ['Jumlah perangkat', String(beban.reduce((a, b) => a + b.jumlah, 0))]],
        [['Total daya', `${f(h.totalW, 0)} W · ${f(h.va, 0)} VA`, true], [`Arus @${tegangan} V`, `${f(h.arusA, 1)} A · MCB ${h.mcbA} A`], ['UPS saran', `${f(h.upsVA, 0)} VA (+25%)`, true], ['Panas', `±${f(h.btu, 0)} BTU/jam (±${f(h.pkAC, 1)} PK)`]],
        'Gunakan daya maksimum dari datasheet. Kebutuhan AC ruangan juga dipengaruhi jumlah orang, kaca, dan luas ruang.',
        [{ judul: 'Daftar perangkat', jenis: 'tabel', kepala: ['Perangkat', 'Watt', 'Jumlah', 'Subtotal'], rataKanan: [1, 2, 3],
          isi: beban.map(b => [b.nama, `${b.watt} W`, String(b.jumlah), `${f(b.watt * b.jumlah, 0)} W`]) }]), 'Daya AV')} />}>
        <div className="grid grid-cols-2 gap-2.5">
          <Nilai label="Total daya" nilai={f(h.totalW, 0)} satuan="W" ket={`${f(h.va, 0)} VA`} />
          <Nilai label={`Arus @${tegangan}V`} nilai={f(h.arusA, 1)} satuan="A" ket={`MCB ${h.mcbA} A`} />
          <Nilai label="UPS saran" nilai={f(h.upsVA, 0)} satuan="VA" ket="+25% cadangan" />
          <Nilai label="Panas" nilai={f(h.btu, 0)} satuan="BTU/h" ket={`±${f(h.pkAC, 1)} PK AC (perangkat saja)`} />
        </div>
        <Catatan>Gunakan daya maksimum dari datasheet. Kebutuhan AC ruangan juga dipengaruhi jumlah orang, kaca, dan luas ruang.</Catatan>
      </Kartu>
    </div>
  );
}

/** Menu Kalkulator AV: lima kalkulator dalam satu alat (sub menu). */
const SUB_AV = [
  { k: 'layar', judul: 'Ukuran Layar', ikon: '📐', C: KalkulatorLayar },
  { k: 'proyektor', judul: 'Proyektor', ikon: '📽', C: KalkulatorProyektor },
  { k: 'sinyal', judul: 'Bandwidth Sinyal', ikon: '〰', C: KalkulatorSinyal },
  { k: 'audio', judul: 'Audio', ikon: '🔊', C: KalkulatorAudio },
  { k: 'daya', judul: 'Daya & Panas', ikon: '⚡', C: KalkulatorDaya },
] as const;

export function KalkulatorAV() {
  const [aktif, setAktif] = useState<string>('layar');
  const C = SUB_AV.find(x => x.k === aktif)?.C ?? KalkulatorLayar;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-white border border-slate-200 w-fit max-w-full overflow-x-auto print:hidden" role="tablist" aria-label="Kalkulator AV">
        {SUB_AV.map(x => {
          const on = x.k === aktif;
          return (
            <button key={x.k} type="button" role="tab" aria-selected={on} onClick={() => setAktif(x.k)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap ${on ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}>
              <Ikon nama={x.ikon} ukuran={14} /> {x.judul}
            </button>
          );
        })}
      </div>
      <C />
    </div>
  );
}
