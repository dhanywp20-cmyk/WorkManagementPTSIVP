'use client';
import { Angka, Catatan, f, fTetap, Kartu, Nilai, Pilih, Segmen, TombolSalin } from '../bersama/ui';
import {
  BATAS_B, bagianPanelRasio, type KatalogLain, type LensaLain, type LensaPadaRasio, type LensaTdc, lensaPadaRasio, lensaPadaRasioLain, type ModelLain, type ModelTdc,
  RASIO_PROYEKTOR as RASIO_GAMBAR, type RasioProyektor, resolusiPanel, SUMBER_LAIN,
} from '../desain3d/inti';
import { aksiLembar, lembarAV } from './lembar';
import { PanelBlending } from './proyektor/PanelBlending';
import { PilihPanasonic } from '../pustaka/PilihPanasonic';
import { PilihMerekLain } from '../pustaka/PilihMerekLain';
import { PilihPustaka } from '../pustaka/PilihPustaka';
import { RumusLensaPabrikan } from '../pustaka/RumusLensaPabrikan';
import { usePustaka } from '../pustaka/usePustaka';
import { angkaDari, type EntriPustaka, teksDari } from '@/lib/pustaka';
import { KONTRAS_ANSI, type KategoriKontras, kontrasDiLayar, lumenSpesifikasi, lumenUntukKontras, luminanceLayar, type Pemasangan, rentangJarakLempar, rentangTinggiLensa, tinggiLensaTetap } from '@/lib/av/layar-proyektor';
import { ukuranDariDiagonal } from '@/lib/av/hitung';
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
const RASIO_PROYEKTOR = (Object.keys(RASIO_GAMBAR) as RasioProyektor[]).map(k => ({ v: k, l: RASIO_GAMBAR[k].label, w: RASIO_GAMBAR[k].lebar, h: RASIO_GAMBAR[k].tinggi }));
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const RASIO_DARI_RESOLUSI: Record<string, string> = { XGA: '4:3', FHD: '16:9', '4K': '16:9', WUXGA: '16:10', WXGA: '16:10', '4KDCI': '17:9' };
const CATATAN = 'Kecerahan dari kategori kontras ANSI/INFOCOMM 3M-2011: kontras = (cahaya proyektor + cahaya ruang di layar) / cahaya ruang di layar - rumus kalkulator Panasonic. Gain layar tidak mengubah kontras (gambar & cahaya ruang sama-sama dipantulkan kain layar), hanya luminance (cd/m² = lux × gain / π). Lux = cahaya ruang yang JATUH DI LAYAR (ukur dengan lux meter menghadap ruangan), bukan di meja. Lumen spesifikasi sudah memperhitungkan susut cahaya sampai akhir umur sumber cahaya.';

export function KalkulatorProyektor() {
  const [modeUkuran, setModeUkuran] = useState<'diagonal' | 'lebar'>('diagonal');
  const [diagonal, setDiagonal] = useState(120);
  const [lebarIsi, setLebarIsi] = useState(3);
  const [rasioK, setRasioK] = useState('16:10');
  const [throwMin, setThrowMin] = useState(1.39);
  const [throwMax, setThrowMax] = useState(2.09);
  const [koreksi, setKoreksi] = useState(0);
  const [koreksiTele, setKoreksiTele] = useState<number | null>(null);
  const [offsetTetap, setOffsetTetap] = useState<number | null>(null);
  const [kontrasAsli, setKontrasAsli] = useState(0);
  const [lux, setLux] = useState(300);
  const [gain, setGain] = useState(1);
  const [kontras, setKontras] = useState<KategoriKontras>('dasar');
  const [sumber, setSumber] = useState<(typeof SUMBER)[number]['v']>('laser');
  const [bawah, setBawah] = useState(0.9);
  const [shiftAtas, setShiftAtas] = useState(50);
  const [shiftBawah, setShiftBawah] = useState(50);
  const [shiftH, setShiftH] = useState(0);
  const [pasang, setPasang] = useState<Pemasangan>('plafon');
  const [resolusiModel, setResolusiModel] = useState<string | null>(null);
  const [model, setModel] = useState<{ nama: string; lumen: number } | null>(null);
  const [rasioPanel, setRasioPanel] = useState<RasioProyektor | null>(null);
  const [panasonic, setPanasonic] = useState<{ m: ModelTdc; l: LensaTdc; versi: string } | null>(null);
  const [lain, setLain] = useState<{ k: KatalogLain; m: ModelLain; l: LensaLain } | null>(null);
  const pakaiRumus = (ujung: 'min' | 'maks', tr: number, b: number) => {
    setPanasonic(null); setLain(null);
    if (ujung === 'min') { setThrowMin(tr); setKoreksi(b); } else { setThrowMax(tr); setKoreksiTele(b); }
  };
  const terapkanLensa = (x: LensaPadaRasio) => {
    setRasioK(x.rasio); setThrowMin(x.trW); setThrowMax(x.trT); setKoreksi(x.bW); setKoreksiTele(x.bT);
    const persen = (v: number) => Math.round(v * 1e4) / 100;
    if (x.shift) { setOffsetTetap(null); setShiftAtas(persen(x.shift.atas)); setShiftBawah(persen(x.shift.bawah)); setShiftH(persen(x.shift.h)); }
    else setOffsetTetap(persen(x.offset));
  };
  const pakaiPanasonic = (m: ModelTdc, l: LensaTdc, rasio: RasioProyektor, versi: string) => {
    setPanasonic({ m, l, versi }); setRasioPanel(m.a); terapkanLensa(lensaPadaRasio(m, l, rasio));
    setKontrasAsli(m.c ?? 0); setResolusiModel(resolusiPanel(m) ?? null); setModel({ nama: `Panasonic ${m.n} + ${l.n}`, lumen: m.lm });
    setLain(null);
  };
  const pakaiLain = (k: KatalogLain, m: ModelLain, l: LensaLain, rasio: RasioProyektor) => {
    setPanasonic(null); setLain({ k, m, l }); setRasioPanel(m.a); terapkanLensa(lensaPadaRasioLain(m, l, rasio));
    setKontrasAsli(m.c ?? 0); setResolusiModel(resolusiPanel(m) ?? null); setModel({ nama: `${k.merek} ${m.n} + ${l.n}`, lumen: l.lm || m.lm });
  };
  const ubahRasio = (v: string) => {
    const r = v as RasioProyektor;
    if (panasonic?.l.ar[r]) { terapkanLensa(lensaPadaRasio(panasonic.m, panasonic.l, r)); return; }
    if (lain?.l.ar[r]) { terapkanLensa(lensaPadaRasioLain(lain.m, lain.l, r)); return; }
    if (rasioPanel) {
      const k = bagianPanelRasio(rasioPanel, rasioK as RasioProyektor).lebar / bagianPanelRasio(rasioPanel, r).lebar;
      if (Math.abs(k - 1) > 1e-9) { setThrowMin(r6(throwMin * k)); setThrowMax(r6(throwMax * k)); }
    }
    setPanasonic(null); setLain(null); setRasioK(v);
  };
  const pakaiModel = (e: EntriPustaka) => {
    const rp = RASIO_DARI_RESOLUSI[teksDari(e, 'resolusi') ?? ''];
    if (rp) setRasioK(rp);
    setPanasonic(null); setLain(null); setRasioPanel(null);
    const ada = (k: string) => typeof e.data[k] === 'number';
    setThrowMin(angkaDari(e, 'throwMin', throwMin)); setThrowMax(angkaDari(e, 'throwMaks', throwMax)); setKoreksi(angkaDari(e, 'koreksiJarak', 0));
    setKoreksiTele(ada('koreksiJarakTele') ? angkaDari(e, 'koreksiJarakTele') : null);
    setOffsetTetap(ada('offsetTetap') ? angkaDari(e, 'offsetTetap') : null);
    setKontrasAsli(angkaDari(e, 'kontras', 0));
    setShiftAtas(angkaDari(e, 'shiftAtas', 0)); setShiftBawah(angkaDari(e, 'shiftBawah', 0)); setShiftH(angkaDari(e, 'shiftHorizontal', 0));
    setResolusiModel(teksDari(e, 'resolusi') ?? null);
    const s = teksDari(e, 'sumber'); if (s === 'laser' || s === 'lampu' || s === 'led') setSumber(s);
    setModel({ nama: e.nama, lumen: angkaDari(e, 'lumen') });
  };
  const r = RASIO_PROYEKTOR.find(x => x.v === rasioK) ?? RASIO_PROYEKTOR.find(x => x.v === '16:10')!;
  const lebar = modeUkuran === 'diagonal' ? ukuranDariDiagonal(diagonal, r.w, r.h).lebarM : lebarIsi;
  const tinggi = (lebar * r.h) / r.w;
  const luas = lebar * tinggi;
  const diag = (Math.hypot(lebar, tinggi) * 1000) / 25.4;
  const kat = KONTRAS_ANSI.find(k => k.v === kontras)!;
  const sus = SUMBER.find(s => s.v === sumber)!;
  const bp = bagianPanelRasio(rasioPanel ?? (r.v as RasioProyektor), r.v as RasioProyektor);
  const bagianLuas = bp.lebar * bp.tinggi;
  const potong = bagianLuas < 0.9999;
  const perluGambar = lumenUntukKontras(luas, lux, kat.rasio, kontrasAsli || undefined);
  const perlu = perluGambar / bagianLuas;
  const spek = lumenSpesifikasi(perlu, sus.susut);
  const takTercapai = !Number.isFinite(perlu);
  const lempar = rentangJarakLempar(lebar, throwMin, throwMax, koreksi, koreksiTele ?? koreksi);
  const tetapM = offsetTetap !== null ? tinggiLensaTetap(bawah, tinggi, offsetTetap, pasang) : 0;
  const lensa = offsetTetap !== null ? { terendahM: tetapM, tertinggiM: tetapM } : rentangTinggiLensa(bawah, tinggi, shiftAtas, shiftBawah, pasang);
  const teksPasang = pasang === 'plafon' ? 'gantung plafon' : 'di meja';
  const geserH = offsetTetap === null && shiftH > 0 ? (lebar * shiftH) / 100 : 0;
  const outputModel = model && model.lumen > 0 ? model.lumen * bagianLuas : 0;
  const luxModel = outputModel ? outputModel / luas : 0;
  const kontrasModel = luxModel ? kontrasDiLayar(outputModel, luas, lux, kontrasAsli || undefined) : 0;
  const teksPanel = potong ? `${bp.lebar > 0.9999 ? 'letterbox' : 'pillarbox'} ${f(bagianLuas * 100, 1)}% panel ${rasioPanel}` : '';
  const teksB = koreksi || koreksiTele
    ? `L = TR × lebar − b (b ${f(koreksi, 3)}${koreksiTele !== null && koreksiTele !== koreksi ? ` wide / ${f(koreksiTele, 3)} tele` : ''})`
    : 'TANPA koreksi b lensa - cek datasheet';
  const teksShift = offsetTetap !== null ? `tanpa lens shift, offset tetap ${f(offsetTetap, 1)}%` : `shift +${shiftAtas}% / −${shiftBawah}%`;
  const nadaLumen = spek > 20000 ? 'buruk' : spek > 10000 ? 'awas' : 'baik';
  const ringkas = () => [
    `*Proyektor - gambar per proyektor ${fTetap(lebar)} × ${fTetap(tinggi)} m (${rasioK}${teksPanel ? `, ${teksPanel}` : ''}, ${fTetap(diag, 2)}")*`,
    `Jarak lensa ke layar ${fTetap(lempar.dekatM)}-${fTetap(lempar.jauhM)} m (throw ${throwMin}-${throwMax}, ${teksB})`,
    `Tinggi pusat lensa tanpa keystone (${teksPasang}): ${offsetTetap !== null ? f(lensa.terendahM) : `${f(lensa.terendahM)}-${f(lensa.tertinggiM)}`} m (${teksShift})`,
    ...(geserH ? [`Lensa boleh bergeser kiri-kanan ±${f(geserH)} m dari tengah gambar (shift ±${shiftH}%)`] : []),
    takTercapai ? `Kontras ${kat.rasio}:1 (${kat.l}) melebihi kontras asli proyektor ${f(kontrasAsli, 0)}:1 - tidak tercapai`
      : `Kontras ${kat.rasio}:1 (${kat.l}) di ${lux} lux: perlu ±${f(perlu, 0)} lm, spesifikasi ${sus.v} ±${f(spek, 0)} lm`,
    ...(model ? [`Model ${model.nama}: ${f(model.lumen, 0)} lm - ${model.lumen >= spek ? 'cukup' : model.lumen >= perlu ? 'cukup saat baru' : 'kurang'}`] : []),
    ...(luxModel ? [`Projector output ${f(outputModel, 0)} lm, screen illuminance ${f(luxModel, 0)} lux, ${f(luminanceLayar(luxModel, gain), 0)} cd/m² (gain ${f(gain)}), kontras ${f(kontrasModel, 1)} : 1 di ${lux} lux`] : []),
  ].join('\n');
  const lembar = () => lembarAV('Proyektor',
    [['Lebar gambar / proyektor', `${f(lebar)} m (${rasioK})`], ['Throw ratio', `${throwMin} – ${throwMax} (${teksB})`], ['Tepi bawah gambar', `${f(bawah)} m`], ['Pemasangan', teksPasang], ['Lens shift', teksShift],
      ['Cahaya di layar', `±${lux} lux`], ['Gain layar', f(gain)], ['Kategori kontras', `${kat.l} (${kat.rasio}:1)`], ['Sumber cahaya', sus.l]],
    [['Gambar per proyektor', `${fTetap(lebar)} × ${fTetap(tinggi)} m (${fTetap(diag, 2)}")`], ['Jarak lempar', `${fTetap(lempar.dekatM)} – ${fTetap(lempar.jauhM)} m`, true],
      ['Tinggi pusat lensa', offsetTetap !== null ? `${f(lensa.terendahM)} m (tetap)` : `${f(lensa.terendahM)} – ${f(lensa.tertinggiM)} m`, true],
      ...(geserH ? [['Geser lensa kiri-kanan', `±${f(geserH)} m dari tengah gambar`] as [string, string]] : []),
      ...(luxModel ? [['Model di layar', `${f(outputModel, 0)} lm · ${f(luxModel, 0)} lux · ${f(luminanceLayar(luxModel, gain), 0)} cd/m² · kontras ${f(kontrasModel, 1)} : 1`] as [string, string]] : []),
      ['Lumen perlu', takTercapai ? 'tidak tercapai (melebihi kontras asli)' : `±${f(perlu, 0)} lm`], ['Lumen spesifikasi', takTercapai ? '—' : `±${f(spek, 0)} lm`, true]],
    CATATAN);
  const adaPustaka = usePustaka('proyektor').entri.length > 0;
  const teksModel = model ? `${model.nama}${model.lumen ? ` · ${f(model.lumen, 0)} lm` : ''}${resolusiModel ? ` · ${resolusiModel}` : ''}${panasonic ? ` · Panasonic TDC ${panasonic.versi}` : ''}${lain ? ` · ${SUMBER_LAIN[lain.k.merek].singkat} ${lain.k.versi}` : ''}` : '';
  return (
    <div className="space-y-4">
      <Kartu judul="Proyektor & lensa">
        <div className="space-y-3">
          <PilihPanasonic rasio={rasioK as RasioProyektor} sumber={panasonic ? `${panasonic.m.n} + ${panasonic.l.n}` : undefined} onPakai={pakaiPanasonic} />
          <PilihMerekLain rasio={rasioK as RasioProyektor} sumber={lain ? `${lain.k.merek} ${lain.m.n} + ${lain.l.n}` : undefined} onPakai={pakaiLain} />
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 items-end">
            {adaPustaka && (
              <div className="col-span-2">
                <PilihPustaka jenis="proyektor" label="Model dari Pustaka" onPilih={pakaiModel} />
                {teksModel && <p className="mt-1 truncate text-[11.5px] font-semibold text-slate-600" title={teksModel}>Dipakai: {teksModel}</p>}
              </div>
            )}
            <Pilih label="Rasio sinyal (aspect ratio)" nilai={rasioK} onUbah={ubahRasio} opsi={RASIO_PROYEKTOR.map(x => ({ v: x.v, l: x.l }))} />
            <Pilih label="Panel native" nilai={rasioPanel ?? ''} onUbah={(v: string) => setRasioPanel(v ? v as RasioProyektor : null)}
              opsi={[{ v: '', l: 'Sama dengan sinyal' }, ...RASIO_PROYEKTOR.map(x => ({ v: x.v, l: x.v }))]} />
            <Angka label="Throw ratio min" nilai={throwMin} step={0.01} onUbah={v => { if (v > 0) { setThrowMin(r6(v)); setPanasonic(null); } }} />
            <Angka label="Throw ratio maks" nilai={throwMax} step={0.01} onUbah={v => { if (v > 0) { setThrowMax(r6(v)); setPanasonic(null); } }} />
            <Angka label="Koreksi b wide" nilai={koreksi} min={-BATAS_B} step={0.001} onUbah={v => { if (v >= -BATAS_B && v <= BATAS_B) { setKoreksi(r6(v)); setPanasonic(null); } }} satuan="m" bantuan="L = TR terlebar × lebar − b" />
            <Angka label="Koreksi b tele" nilai={koreksiTele ?? koreksi} min={-BATAS_B} step={0.001} onUbah={v => { if (v >= -BATAS_B && v <= BATAS_B) { setKoreksiTele(r6(v)); setPanasonic(null); } }} satuan="m" bantuan="L = TR terpanjang × lebar − b (kalkulator Panasonic menyimpan b wide & tele terpisah)" />
            {offsetTetap === null ? (
              <>
                <Angka label="Lens shift atas" nilai={shiftAtas} onUbah={v => v >= 0 && setShiftAtas(v)} satuan="%" />
                <Angka label="Lens shift bawah" nilai={shiftBawah} onUbah={v => v >= 0 && setShiftBawah(v)} satuan="%" />
              </>
            ) : (
              <p className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-snug text-slate-700">
                Tanpa lens shift - pusat gambar tetap {f(offsetTetap, 1)}% tinggi gambar dari sumbu lensa (datasheet).{' '}
                <button type="button" onClick={() => setOffsetTetap(null)} className="font-bold text-blue-700 hover:underline">Pakai lens shift</button>
              </p>
            )}
            <div className="col-span-2">
              <Segmen label="Pemasangan" nilai={pasang} onUbah={setPasang} opsi={[{ v: 'plafon', l: 'Gantung plafon' }, { v: 'meja', l: 'Meja / lantai' }]} />
            </div>
            <div className="col-span-2">
              <Angka label="Kontras asli" nilai={kontrasAsli} onUbah={v => v >= 0 && setKontrasAsli(v)} satuan=":1" bantuan="Full on / full off dari datasheet; 0 = abaikan" />
            </div>
          </div>
          {potong && (
            <p className="text-[12px] leading-snug text-slate-700">
              Sinyal {rasioK} di panel {rasioPanel}: {teksPanel} - lumen yang jatuh di gambar {f(bagianLuas * 100, 1)}% lumen proyektor (Projector output kalkulator Panasonic).
            </p>
          )}
          {!koreksi && !koreksiTele && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
              Koreksi b lensa belum diisi, jarak lempar masih estimasi.{' '}
              <Catatan>Jarak dihitung L = TR × lebar dan bisa selisih beberapa cm hingga puluhan cm dari kalkulator pabrikan. Pilih model, isi b dari rumus lensa di datasheet, atau hitung dari dua hasil kalkulator pabrikan di bawah.</Catatan>
            </p>
          )}
          <RumusLensaPabrikan onPakai={pakaiRumus} />
        </div>
      </Kartu>


      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Kartu judul="Satu proyektor · ukuran & kecerahan">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Segmen label="Gambar 1 proyektor dari" nilai={modeUkuran} onUbah={setModeUkuran} opsi={[{ v: 'diagonal', l: 'Diagonal (inci)' }, { v: 'lebar', l: 'Lebar (m)' }]} />
            </div>
            {modeUkuran === 'diagonal'
              ? <Angka label="Diagonal gambar" nilai={diagonal} onUbah={v => v > 0 && setDiagonal(v)} satuan="inci" bantuan="Diagonal gambar proyektor dalam rasio panelnya - sama dengan Screen size di kalkulator Panasonic" />
              : <Angka label="Lebar gambar" nilai={lebarIsi} onUbah={v => v > 0 && setLebarIsi(v)} satuan="m" />}
            <Angka label="Tepi bawah gambar" nilai={bawah} onUbah={v => v >= 0 && setBawah(v)} satuan="m" />
            <Angka label="Gain layar" nilai={gain} onUbah={v => v > 0 && setGain(v)} bantuan="Matte putih 1,0. Hanya menaikkan luminance (cd/m²); kontras tidak berubah - sama dengan kalkulator Panasonic" />
            <Pilih label="Sumber cahaya" nilai={sumber} onUbah={setSumber} opsi={SUMBER.map(s => ({ v: s.v, l: s.l }))} />
            <div className="col-span-2"><Pilih label="Cahaya ruang di layar" nilai={lux} onUbah={setLux} opsi={LUX} /></div>
            <div className="col-span-2">
              <Pilih label="Kategori kontras (ANSI/INFOCOMM 3M)" nilai={kontras} onUbah={setKontras} opsi={KONTRAS_ANSI.map(k => ({ v: k.v, l: `${k.l} · ${k.rasio}:1` }))} />
            </div>
          </div>
        </Kartu>
        <Kartu judul="Hasil satu proyektor" aksi={<TombolSalin teks={ringkas} {...aksiLembar(lembar, 'Proyektor')} />}>
          <div className="kisi-nilai">
            <Nilai label="Gambar 1 proyektor" nilai={`${fTetap(lebar)} × ${fTetap(tinggi)}`} satuan="m" ket={`${fTetap(diag, 2)} inci · ${f(luas)} m²`} />
            <Nilai label="Jarak lempar" nilai={`${fTetap(lempar.dekatM)}-${fTetap(lempar.jauhM)}`} satuan="m" nada={koreksi || koreksiTele ? undefined : 'awas'} ket={koreksi || koreksiTele ? 'ujung lensa ke layar' : 'tanpa koreksi b lensa'} />
            <Nilai label="Tinggi pusat lensa" nilai={offsetTetap !== null ? f(lensa.terendahM) : `${f(lensa.terendahM)}-${f(lensa.tertinggiM)}`} satuan="m"
              ket={`${teksPasang} · ${offsetTetap !== null ? 'tetap (tanpa lens shift)' : 'tanpa keystone'}`} />
            {geserH > 0 && (
              <Nilai label="Geser lensa kiri-kanan" nilai={`±${f(geserH)}`} satuan="m" ket={`shift ±${shiftH}% · penuh hanya saat shift vertikal kecil`} />
            )}
            <Nilai label="Lumen perlu" nilai={takTercapai ? 'Tidak tercapai' : f(perlu, 0)} satuan={takTercapai ? undefined : 'lm'} nada={takTercapai ? 'buruk' : undefined}
              ket={takTercapai ? `kontras asli proyektor ${f(kontrasAsli, 0)}:1` : `kontras ${kat.rasio}:1 di ${lux} lux${potong ? ` · ${f(perluGambar, 0)} lm di gambar` : ''}`} />
            <Nilai label="Lumen spesifikasi" nilai={takTercapai ? '—' : f(spek, 0)} satuan={takTercapai ? undefined : 'lm'} nada={takTercapai ? 'buruk' : nadaLumen}
              ket={takTercapai ? 'pilih kategori kontras lebih rendah' : spek > 20000 ? 'redupkan ruang / blending 2 proyektor' : spek > 10000 ? 'kelas venue / laser' : `+${sus.susut}% susut ${sus.v}`} />
            {model && (
              <Nilai label={`Model: ${model.nama}`} nilai={f(model.lumen, 0)} satuan="lm" nada={model.lumen >= spek ? 'baik' : model.lumen >= perlu ? 'awas' : 'buruk'}
                ket={model.lumen >= spek ? 'cukup sampai akhir umur' : model.lumen >= perlu ? 'cukup saat baru, kurang setelah susut' : 'kurang terang'} />
            )}
            {luxModel > 0 && (
              <Nilai label="Model di layar" nilai={`${f(kontrasModel, 1)} : 1`} nada={kontrasModel >= kat.rasio ? 'baik' : 'buruk'}
                ket={`output ${f(outputModel, 0)} lm · ${f(luxModel, 0)} lux · ${f(luminanceLayar(luxModel, gain), 0)} cd/m²`} />
            )}
          </div>
          <Catatan>{CATATAN}</Catatan>
        </Kartu>
      </div>

      <PanelBlending lebarSatuAwal={lebar} resolusiModel={resolusiModel}
        lensa={{ trMin: throwMin, trMaks: throwMax, bWide: koreksi, bTele: koreksiTele ?? koreksi }} />
    </div>
  );
}
