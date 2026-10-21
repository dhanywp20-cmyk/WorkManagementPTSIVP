'use client';
/**
 * Kalkulator proyektor: jarak lempar (lensa zoom), tinggi pasang lensa (lens shift), kecerahan menurut
 * kategori kontras ANSI/INFOCOMM 3M-2011 + susut cahaya, dan edge blending (PanelBlending).
 * Rumus: lib/av-layar-proyektor.ts.
 */
import { Angka, Catatan, f, Kartu, Nilai, Pilih, Segmen, TombolSalin } from '../bersama/ui';
import { RASIO } from './KalkulatorLayar';
import { aksiLembar, lembarAV } from './lembar';
import { PanelBlending } from './proyektor/PanelBlending';
import { PilihPustaka } from '../pustaka/PilihPustaka';
import { angkaDari, type EntriPustaka, teksDari } from '@/lib/pustaka';
import { KONTRAS_ANSI, type KategoriKontras, lumenSpesifikasi, lumenUntukKontras, rentangJarakLempar, rentangTinggiLensa, rumusLensaDariDuaTitik } from '@/lib/av-layar-proyektor';
import { ukuranDariDiagonal } from '@/lib/av-hitung';
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
/** Rasio gambar proyektor: rasio layar + 17:9 (Native 4K DCI 4096 x 2160), sama dengan Desain 3D. */
const RASIO_PROYEKTOR = [...RASIO.slice(0, 2), { v: '17:9', l: '17:9 (Native 4K)', w: 17, h: 9 }, ...RASIO.slice(2)];
/** Resolusi Pustaka -> rasio panel (sama dengan desain3d/inti/pustaka.ts). */
const RASIO_DARI_RESOLUSI: Record<string, string> = { FHD: '16:9', '4K': '16:9', WUXGA: '16:10', WXGA: '16:10', '4KDCI': '17:9' };
const CATATAN = 'Kecerahan dari kategori kontras ANSI/INFOCOMM 3M-2011: kontras = (cahaya proyektor + cahaya ruang di layar) / cahaya ruang di layar. Lux = cahaya ruang yang JATUH DI LAYAR (ukur dengan lux meter menghadap ruangan), bukan di meja. Lumen spesifikasi sudah memperhitungkan susut cahaya sampai akhir umur sumber cahaya.';

export function KalkulatorProyektor() {
  /** Ukuran gambar diisi sebagai diagonal (inci, seperti kalkulator Panasonic) atau lebar (m). */
  const [modeUkuran, setModeUkuran] = useState<'diagonal' | 'lebar'>('diagonal');
  const [diagonal, setDiagonal] = useState(120);
  const [lebarIsi, setLebarIsi] = useState(3);
  const [rasioK, setRasioK] = useState('16:10');
  const [throwMin, setThrowMin] = useState(1.39);
  const [throwMax, setThrowMax] = useState(2.09);
  /** Koreksi jarak b rumus lensa L = TR x lebar - b (datasheet / kalkulator pabrikan); 0 = L = TR x lebar. */
  const [koreksi, setKoreksi] = useState(0);
  const [lux, setLux] = useState(300);
  const [gain, setGain] = useState(1);
  const [kontras, setKontras] = useState<KategoriKontras>('dasar');
  const [sumber, setSumber] = useState<(typeof SUMBER)[number]['v']>('laser');
  const [bawah, setBawah] = useState(0.9);
  const [shiftAtas, setShiftAtas] = useState(50);
  const [shiftBawah, setShiftBawah] = useState(50);
  /** Model dari Pustaka (opsional): lumennya dibandingkan dengan kebutuhan. */
  const [model, setModel] = useState<{ nama: string; lumen: number } | null>(null);
  /** Dua hasil kalkulator pabrikan (lebar gambar, jarak) pada zoom yang sama -> TR & b (rumusLensaDariDuaTitik). */
  const [titik, setTitik] = useState({ w1: 2.215, l1: 0, w2: 4.43, l2: 0 });
  const rumus = rumusLensaDariDuaTitik(titik.w1, titik.l1, titik.w2, titik.l2);
  const pakaiRumus = (ujung: 'min' | 'maks') => {
    if (!rumus) return;
    const tr = Math.round(rumus.tr * 1000) / 1000;
    if (ujung === 'min') setThrowMin(tr); else setThrowMax(tr);
    setKoreksi(Math.round(rumus.b * 1000) / 1000);
  };
  const pakaiModel = (e: EntriPustaka) => {
    const rp = RASIO_DARI_RESOLUSI[teksDari(e, 'resolusi') ?? ''];
    if (rp) setRasioK(rp);
    setThrowMin(angkaDari(e, 'throwMin', throwMin)); setThrowMax(angkaDari(e, 'throwMaks', throwMax)); setKoreksi(angkaDari(e, 'koreksiJarak', 0));
    setShiftAtas(angkaDari(e, 'shiftAtas', 0)); setShiftBawah(angkaDari(e, 'shiftBawah', 0));
    const s = teksDari(e, 'sumber'); if (s === 'laser' || s === 'lampu' || s === 'led') setSumber(s);
    setModel({ nama: e.nama, lumen: angkaDari(e, 'lumen') });
  };
  const r = RASIO_PROYEKTOR.find(x => x.v === rasioK) ?? RASIO_PROYEKTOR[1];
  const lebar = modeUkuran === 'diagonal' ? ukuranDariDiagonal(diagonal, r.w, r.h).lebarM : lebarIsi;
  const tinggi = (lebar * r.h) / r.w;
  const luas = lebar * tinggi;
  const diag = (Math.hypot(lebar, tinggi) * 1000) / 25.4;
  const kat = KONTRAS_ANSI.find(k => k.v === kontras)!;
  const sus = SUMBER.find(s => s.v === sumber)!;
  const perlu = lumenUntukKontras(luas, lux, kat.rasio, gain);
  const spek = lumenSpesifikasi(perlu, sus.susut);
  const lempar = rentangJarakLempar(lebar, throwMin, throwMax, koreksi);
  const lensa = rentangTinggiLensa(bawah, tinggi, shiftAtas, shiftBawah);
  const nadaLumen = spek > 20000 ? 'buruk' : spek > 10000 ? 'awas' : 'baik';
  const ringkas = () => [
    `*Proyektor - gambar ${f(lebar)} × ${f(tinggi)} m (${rasioK}, ±${f(diag, 0)}")*`,
    `Jarak lensa ke layar ${f(lempar.dekatM, 3)}-${f(lempar.jauhM, 3)} m (throw ${throwMin}-${throwMax}${koreksi ? `, L = TR × lebar − ${f(koreksi, 3)}` : ', TANPA koreksi b lensa - cek datasheet'})`,
    `Tinggi pusat lensa tanpa keystone: ${f(lensa.terendahM)}-${f(lensa.tertinggiM)} m (shift +${shiftAtas}% / −${shiftBawah}%)`,
    `Kontras ${kat.rasio}:1 (${kat.l}) di ${lux} lux: perlu ±${f(perlu, 0)} lm, spesifikasi ${sus.v} ±${f(spek, 0)} lm`,
    ...(model ? [`Model ${model.nama}: ${f(model.lumen, 0)} lm - ${model.lumen >= spek ? 'cukup' : model.lumen >= perlu ? 'cukup saat baru' : 'kurang'}`] : []),
  ].join('\n');
  const lembar = () => lembarAV('Proyektor',
    [['Lebar gambar', `${f(lebar)} m (${rasioK})`], ['Throw ratio', `${throwMin} – ${throwMax}${koreksi ? ` (koreksi b ${f(koreksi, 3)} m)` : ' (tanpa koreksi b - cek datasheet)'}`], ['Tepi bawah gambar', `${f(bawah)} m`], ['Lens shift', `+${shiftAtas}% / −${shiftBawah}%`],
      ['Cahaya di layar', `±${lux} lux`], ['Gain layar', f(gain)], ['Kategori kontras', `${kat.l} (${kat.rasio}:1)`], ['Sumber cahaya', sus.l]],
    [['Ukuran gambar', `${f(lebar)} × ${f(tinggi)} m (±${f(diag, 0)}")`], ['Jarak lempar', `${f(lempar.dekatM, 3)} – ${f(lempar.jauhM, 3)} m`, true],
      ['Tinggi pusat lensa', `${f(lensa.terendahM)} – ${f(lensa.tertinggiM)} m`, true], ['Lumen perlu', `±${f(perlu, 0)} lm`], ['Lumen spesifikasi', `±${f(spek, 0)} lm`, true]],
    CATATAN);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
        <Kartu judul="Masukan">
          <div className="space-y-3">
            <PilihPustaka jenis="proyektor" label="Model dari Pustaka" onPilih={pakaiModel} />
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Segmen label="Ukuran gambar dari" nilai={modeUkuran} onUbah={setModeUkuran} opsi={[{ v: 'diagonal', l: 'Diagonal (inci)' }, { v: 'lebar', l: 'Lebar (m)' }]} />
              </div>
              {modeUkuran === 'diagonal'
                ? <Angka label="Diagonal gambar" nilai={diagonal} onUbah={v => v > 0 && setDiagonal(v)} satuan="inci" bantuan="Diagonal gambar proyektor dalam rasio panelnya - sama dengan Screen size di kalkulator Panasonic" />
                : <Angka label="Lebar gambar" nilai={lebarIsi} onUbah={v => v > 0 && setLebarIsi(v)} satuan="m" />}
              <Pilih label="Rasio proyektor" nilai={rasioK} onUbah={setRasioK} opsi={RASIO_PROYEKTOR.map(x => ({ v: x.v, l: x.l }))} />
              <Angka label="Throw ratio min" nilai={throwMin} onUbah={v => v > 0 && setThrowMin(v)} />
              <Angka label="Throw ratio maks" nilai={throwMax} onUbah={v => v > 0 && setThrowMax(v)} />
              <Angka label="Koreksi jarak b" nilai={koreksi} min={-1} step={0.001} onUbah={v => v >= -1 && v <= 1 && setKoreksi(v)} satuan="m" bantuan="L = TR × lebar − b" />
              <Angka label="Tepi bawah gambar" nilai={bawah} onUbah={v => v >= 0 && setBawah(v)} satuan="m" />
              <Angka label="Gain layar" nilai={gain} onUbah={v => v > 0 && setGain(v)} bantuan="matte putih 1,0" />
              <Angka label="Lens shift atas" nilai={shiftAtas} onUbah={v => v >= 0 && setShiftAtas(v)} satuan="%" />
              <Angka label="Lens shift bawah" nilai={shiftBawah} onUbah={v => v >= 0 && setShiftBawah(v)} satuan="%" />
            </div>
            {!koreksi && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
                Koreksi jarak b lensa belum diisi - jarak dihitung L = TR × lebar dan bisa selisih beberapa cm hingga puluhan cm dari
                kalkulator pabrikan. Isi b dari rumus lensa di datasheet, atau hitung dari dua hasil kalkulator Panasonic di bawah.
              </p>
            )}
            <details className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
              <summary className="cursor-pointer text-[12.5px] font-semibold text-slate-700">Ambil rumus lensa dari kalkulator pabrikan</summary>
              <div className="mt-2 space-y-2">
                <p className="text-[11.5px] text-slate-600">Isi dua ukuran gambar &amp; jarak hasil kalkulator (zoom sama: dua-duanya Min, atau dua-duanya Max).</p>
                <div className="grid grid-cols-2 gap-2">
                  <Angka label="Lebar 1" nilai={titik.w1} onUbah={v => setTitik(t => ({ ...t, w1: v }))} satuan="m" />
                  <Angka label="Jarak 1" nilai={titik.l1} onUbah={v => setTitik(t => ({ ...t, l1: v }))} satuan="m" />
                  <Angka label="Lebar 2" nilai={titik.w2} onUbah={v => setTitik(t => ({ ...t, w2: v }))} satuan="m" />
                  <Angka label="Jarak 2" nilai={titik.l2} onUbah={v => setTitik(t => ({ ...t, l2: v }))} satuan="m" />
                </div>
                {rumus ? (
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-700">
                    <span className="font-semibold tabular-nums">L = {f(rumus.tr, 3)} × lebar − {f(rumus.b, 3)}</span>
                    <button type="button" onClick={() => pakaiRumus('min')} className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-100">Pakai sebagai throw min</button>
                    <button type="button" onClick={() => pakaiRumus('maks')} className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-100">Pakai sebagai throw maks</button>
                  </div>
                ) : <p className="text-[11.5px] text-slate-500">Isi kedua jarak (lebar harus berbeda).</p>}
              </div>
            </details>
            <Pilih label="Cahaya ruang di layar" nilai={lux} onUbah={setLux} opsi={LUX} />
            <Pilih label="Kategori kontras (ANSI/INFOCOMM 3M)" nilai={kontras} onUbah={setKontras} opsi={KONTRAS_ANSI.map(k => ({ v: k.v, l: `${k.l} · ${k.rasio}:1` }))} />
            <Pilih label="Sumber cahaya" nilai={sumber} onUbah={setSumber} opsi={SUMBER.map(s => ({ v: s.v, l: s.l }))} />
          </div>
        </Kartu>
        <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(lembar, 'Proyektor')} />}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Nilai label="Ukuran gambar" nilai={`${f(lebar)} × ${f(tinggi)}`} satuan="m" ket={`${f(diag, 0)} inci · ${f(luas)} m²`} />
            <Nilai label="Jarak lempar" nilai={`${f(lempar.dekatM, 3)}-${f(lempar.jauhM, 3)}`} satuan="m" nada={koreksi ? undefined : 'awas'} ket={koreksi ? 'ujung lensa ke layar' : 'tanpa koreksi b lensa'} />
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
