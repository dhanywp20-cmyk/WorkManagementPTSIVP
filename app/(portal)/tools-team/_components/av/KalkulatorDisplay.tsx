'use client';
/**
 * Videowall LCD & interactive flat panel (IFP): ukuran -> konfigurasi -> daftar material -> penawaran.
 * Rumus & BOM di lib/av-hitung-display.ts; tabel harga & lembar BOM dipakai bersama dengan LED Videotron.
 */
import { useState } from 'react';
import { Angka, Catatan, f, Kartu, kelasInput, Nilai, Pilih, Segmen, TombolSalin } from '../bersama/ui';
import { bukaCetak, diagramSusunan, type Info, type Lembar, namaBerkas, unduhLembarPNG } from '../bersama/cetak';
import { isiLembarBom, TabelBom, teksBarisBom } from '../bersama/TabelBom';
import { usePustaka } from '../pustaka/usePustaka';
import { PANEL_VIDEOWALL, videowallUntuk } from '@/lib/av-layar-proyektor';
import { totalPenawaran, type JenisPandang, ukuranDariDiagonal } from '@/lib/av-hitung';
import {
  bomIFP, bomVideowall, dayaIFP, dayaVideowall, IFP_BAWAAN, type MasukanIFP, type MasukanVideowall, PASANG_VIDEOWALL,
  type PasangVideowall, saranIFP, SINYAL_VIDEOWALL, type SinyalVideowall, USB_PASIF_MAKS_M, WATT_PANEL_BAWAAN,
} from '@/lib/av-hitung-display';
import { angkaDari, teksDari } from '@/lib/pustaka';

const JENIS: { v: JenisPandang; l: string }[] = [
  { v: 'umum', l: 'Umum (video, presentasi)' },
  { v: 'analitis', l: 'Analitis (dokumen, spreadsheet)' },
  { v: 'detail', l: 'Detail (gambar teknik, angka kecil)' },
];

function Teks({ label, nilai, onUbah, placeholder }: { label: string; nilai: string; onUbah: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{label}</span>
      <input type="text" value={nilai} placeholder={placeholder} onChange={e => onUbah(e.target.value)} className={kelasInput} />
    </label>
  );
}

function Centang({ label, nilai, onUbah }: { label: string; nilai: boolean; onUbah: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 cursor-pointer select-none">
      <input type="checkbox" checked={nilai} onChange={e => onUbah(e.target.checked)} className="w-4 h-4 accent-blue-700" /> {label}
    </label>
  );
}

export function KalkulatorDisplay() {
  const [jenis, setJenis] = useState<'videowall' | 'ifp'>('videowall');
  const [project, setProject] = useState('');
  const [customer, setCustomer] = useState('');
  const [ppn, setPpn] = useState(11);
  //  Harga terpisah per jenis: kunci baris BOM keduanya sebagian sama ("pasang", "stop-kontak").
  const [hargaVW, setHargaVW] = useState<Record<string, number>>({});
  const [hargaIFP, setHargaIFP] = useState<Record<string, number>>({});

  // ── Videowall ──
  //  Panel dari Pustaka (display dengan bezel > 0); bawaan kode bila pustaka kosong - sama dengan Ukuran Layar.
  const { entri } = usePustaka('display');
  const panelPustaka = entri.filter(e => angkaDari(e, 'bezel') > 0).map(e => ({
    nama: [teksDari(e, 'merek'), e.nama].filter(Boolean).join(' '), diagonalInci: angkaDari(e, 'diagonal'), bezelMm: angkaDari(e, 'bezel'), watt: angkaDari(e, 'watt', WATT_PANEL_BAWAAN),
  }));
  const daftarPanel = panelPustaka.length ? panelPustaka : PANEL_VIDEOWALL.map(p => ({ ...p, watt: WATT_PANEL_BAWAAN }));
  const [iPanel, setIPanel] = useState(2);
  const panel = daftarPanel[Math.min(iPanel, daftarPanel.length - 1)];
  const [modeVW, setModeVW] = useState<'ukuran' | 'susunan'>('ukuran');
  const [targetW, setTargetW] = useState(3.6);
  const [targetH, setTargetH] = useState(2);
  const [kolomIn, setKolomIn] = useState(3);
  const [barisIn, setBarisIn] = useState(3);
  const [screen, setScreen] = useState(1);
  const [pasang, setPasang] = useState<PasangVideowall>('pop-out');
  const [sinyal, setSinyal] = useState<SinyalVideowall>('controller');
  const [input, setInput] = useState(2);
  const [panjangSinyal, setPanjangSinyal] = useState(10);
  const [player, setPlayer] = useState(1);
  const [spare, setSpare] = useState(0);
  const dariUkuran = videowallUntuk(targetW, targetH, panel);
  const kolom = modeVW === 'ukuran' ? dariUkuran.kolom : kolomIn, baris = modeVW === 'ukuran' ? dariUkuran.baris : barisIn;
  const satuPanel = ukuranDariDiagonal(panel.diagonalInci, 16, 9), bz = panel.bezelMm / 1000;
  const vw = { lebarM: kolom * satuPanel.lebarM + (kolom - 1) * bz, tinggiM: baris * satuPanel.tinggiM + (baris - 1) * bz, resX: kolom * 1920, resY: baris * 1080 };
  const mVW: MasukanVideowall = { namaPanel: panel.nama, kolom, baris, screen, cadanganPanel: spare, pasang, sinyal, input, panjangSinyal, wattPanel: panel.watt, mediaPlayer: player };
  const bomVW = bomVideowall(mVW), dVW = dayaVideowall(mVW);

  // ── IFP ──
  const ifpPustaka = entri.filter(e => angkaDari(e, 'bezel') === 0 && angkaDari(e, 'diagonal') >= 55).map(e => ({
    nama: [teksDari(e, 'merek'), e.nama].filter(Boolean).join(' '), diagonal: angkaDari(e, 'diagonal'), watt: angkaDari(e, 'watt', 0),
  }));
  const daftarIFP = ifpPustaka.length ? ifpPustaka : IFP_BAWAAN.map(x => ({ nama: `${x.diagonal}"`, diagonal: x.diagonal, watt: x.watt }));
  const [jarak, setJarak] = useState(6);
  const [jenisPandang, setJenisPandang] = useState<JenisPandang>('analitis');
  const saran = saranIFP(jarak, jenisPandang, daftarIFP.map(x => x.diagonal));
  //  null = ikuti saran dari jarak pandang; angka = pilihan manual.
  const [iIFP, setIIFP] = useState<number | null>(null);
  const iSaran = saran.saran === null ? daftarIFP.length - 1 : daftarIFP.findIndex(x => x.diagonal === saran.saran);
  const ifp = daftarIFP[Math.min(iIFP ?? iSaran, daftarIFP.length - 1)];
  const [ruang, setRuang] = useState(1);
  const [pasangIFP, setPasangIFP] = useState<'dinding' | 'troli'>('dinding');
  const [ops, setOps] = useState(true);
  const [kamera, setKamera] = useState(true);
  const [mic, setMic] = useState(true);
  const [dongle, setDongle] = useState(1);
  const [panjangMeja, setPanjangMeja] = useState(4);
  const mIFP: MasukanIFP = { namaUnit: ifp.nama, diagonal: ifp.diagonal, ruang, pasang: pasangIFP, ops, kamera, mic, dongle, panjangMeja,
    wattUnit: ifp.watt || (IFP_BAWAAN.find(x => x.diagonal >= ifp.diagonal)?.watt ?? 600) };
  const bomI = bomIFP(mIFP), dI = dayaIFP(mIFP);
  const kurangBesar = saran.saran === null;

  // ── BOM & penawaran (jenis aktif) ──
  const barisBom = jenis === 'videowall' ? bomVW : bomI;
  const harga = jenis === 'videowall' ? hargaVW : hargaIFP;
  const setHarga = jenis === 'videowall' ? setHargaVW : setHargaIFP;
  const nilai = totalPenawaran(barisBom, harga, ppn);
  const adaHarga = barisBom.some(b => (harga[b.kunci] ?? 0) > 0);
  const judulAlat = jenis === 'videowall' ? 'Videowall LCD' : 'Interactive Flat Panel';
  const tanggal = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const satu = (label: string, isi: string, sorot = false): Info => ({ label, nilai: isi, sorot });
  const konfigurasi = jenis === 'videowall'
    ? `${panel.nama} · ${kolom} × ${baris} (${kolom * baris} panel)${screen > 1 ? ` · ${screen} videowall` : ''} · ${f(vw.lebarM)} × ${f(vw.tinggiM)} m`
    : `IFP ${ifp.nama} · ${ruang} ruang`;

  const lembar = (): Lembar => ({
    judul: `${adaHarga ? 'Penawaran' : 'Daftar Material'} ${judulAlat}`,
    subjudul: [project || 'Tanpa nama project', customer].filter(Boolean).join(' — '),
    kepala: [['Tanggal', tanggal]],
    seksi: [
      jenis === 'videowall'
        ? { judul: 'Konfigurasi videowall', jenis: 'info',
          kiri: [satu('Panel', panel.nama), satu('Susunan', `${kolom} kolom × ${baris} baris (${kolom * baris} panel)${screen > 1 ? ` · ${screen} videowall` : ''}`, true),
            satu('Pemasangan', PASANG_VIDEOWALL.find(x => x.v === pasang)!.l), satu('Sinyal', `${SINYAL_VIDEOWALL.find(x => x.v === sinyal)!.l} · ${input} sumber`)],
          kanan: [satu('Ukuran', `${f(vw.lebarM)} × ${f(vw.tinggiM)} m (±${f((Math.hypot(vw.lebarM, vw.tinggiM) * 1000) / 25.4, 0)}")`, true),
            satu('Resolusi gabungan', `${vw.resX} × ${vw.resY} px`), satu('Daya / videowall', `±${f(dVW.totalW, 0)} W · ${f(dVW.arusA, 1)} A · ${dVW.sirkuit} jalur MCB 16 A`),
            satu('Panas / videowall', `±${f(dVW.btu, 0)} BTU/jam`)] }
        : { judul: 'Konfigurasi IFP', jenis: 'info',
          kiri: [satu('Unit', `IFP ${ifp.nama}`, true), satu('Jumlah ruang', String(ruang)),
            satu('Pemasangan', pasangIFP === 'troli' ? 'Mobile stand / troli' : 'Bracket dinding'),
            satu('Kelengkapan', [ops && 'OPS PC', kamera && 'kamera', mic && 'speakerphone', dongle > 0 && `${dongle} dongle`].filter(Boolean).join(', ') || '—')],
          kanan: [satu('Penonton terjauh', `${f(jarak, 1)} m · ${JENIS.find(j => j.v === jenisPandang)!.l}`),
            satu('Diagonal minimum', `${f(saran.diagonalMin, 0)}"`, true), satu('Daya / ruang', `±${f(dI.totalW, 0)} W · ${f(dI.arusA, 1)} A`)] },
      ...(jenis === 'videowall' ? [{ judul: 'Susunan panel', jenis: 'html' as const, html: diagramSusunan(kolom, baris, vw.lebarM, vw.tinggiM, 'panel') }] : []),
      { judul: adaHarga ? 'Rincian penawaran' : 'Daftar material', jenis: 'tabel', ...isiLembarBom(barisBom, harga, ppn, nilai) },
    ],
    catatan: 'Jumlah bracket, kabel, stop kontak & jalur power adalah perkiraan lapangan dari AV Solution Tools. Pastikan panel mendukung jalur sinyal yang dipilih; verifikasi datasheet, stok & harga sebelum penawaran resmi.',
    tandaTangan: [{ label: 'Dibuat oleh' }, { label: 'Disetujui' }],
  });
  const teks = () => [
    project && `*${project}*${customer ? ` - ${customer}` : ''}`,
    `*${adaHarga ? 'Penawaran' : 'Daftar material'} ${judulAlat}* · ${konfigurasi}`,
    ...teksBarisBom(barisBom, harga, ppn, nilai),
  ].filter(Boolean).join('\n');
  const nama = adaHarga ? `Penawaran ${judulAlat}` : `BOM ${judulAlat}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
        <Kartu judul="Masukan">
          <div className="space-y-3">
            <Segmen nilai={jenis} onUbah={setJenis} opsi={[{ v: 'videowall', l: 'Videowall LCD' }, { v: 'ifp', l: 'Interactive flat panel' }]} />
            <div className="grid grid-cols-2 gap-2.5">
              <Teks label="Project" nilai={project} onUbah={setProject} placeholder="Nama project" />
              <Teks label="Customer" nilai={customer} onUbah={setCustomer} placeholder="Customer" />
            </div>
            {jenis === 'videowall' ? (
              <>
                <Pilih label="Panel" nilai={String(Math.min(iPanel, daftarPanel.length - 1))} onUbah={v => setIPanel(Number(v))}
                  opsi={daftarPanel.map((p, j) => ({ v: String(j), l: p.nama }))} />
                <Segmen nilai={modeVW} onUbah={setModeVW} opsi={[{ v: 'ukuran', l: 'Dari ukuran target' }, { v: 'susunan', l: 'Kolom × baris' }]} />
                {modeVW === 'ukuran' ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Angka label="Lebar target" nilai={targetW} satuan="m" onUbah={v => v > 0 && v <= 50 && setTargetW(v)} />
                    <Angka label="Tinggi target" nilai={targetH} satuan="m" onUbah={v => v > 0 && v <= 20 && setTargetH(v)} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Angka label="Kolom" nilai={kolomIn} step={1} onUbah={v => v >= 1 && v <= 20 && setKolomIn(Math.round(v))} />
                    <Angka label="Baris" nilai={barisIn} step={1} onUbah={v => v >= 1 && v <= 20 && setBarisIn(Math.round(v))} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  <Angka label="Jumlah videowall" nilai={screen} step={1} onUbah={v => v >= 1 && v <= 50 && setScreen(Math.round(v))} />
                  <Angka label="Spare panel" nilai={spare} satuan="%" step={1} onUbah={v => v >= 0 && v <= 50 && setSpare(v)} />
                </div>
                <Pilih label="Pemasangan" nilai={pasang} onUbah={setPasang} opsi={PASANG_VIDEOWALL} />
                <Pilih label="Jalur sinyal" nilai={sinyal} onUbah={setSinyal} opsi={SINYAL_VIDEOWALL} />
                <div className="grid grid-cols-3 gap-2.5">
                  {sinyal !== 'loop' && <Angka label="Sumber" nilai={input} step={1} onUbah={v => v >= 1 && v <= 64 && setInput(Math.round(v))} />}
                  <Angka label="Media player" nilai={player} step={1} onUbah={v => v >= 0 && v <= 20 && setPlayer(Math.round(v))} />
                  <Angka label="Kabel sinyal" nilai={panjangSinyal} satuan="m" onUbah={v => v >= 1 && v <= 100 && setPanjangSinyal(v)} />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <Angka label="Penonton terjauh" nilai={jarak} satuan="m" onUbah={v => v > 0 && v <= 30 && setJarak(v)} />
                  <Angka label="Jumlah ruang" nilai={ruang} step={1} onUbah={v => v >= 1 && v <= 200 && setRuang(Math.round(v))} />
                </div>
                <Pilih label="Jenis tampilan" nilai={jenisPandang} onUbah={setJenisPandang} opsi={JENIS} />
                <Pilih label="Ukuran IFP" nilai={String(iIFP ?? -1)} onUbah={v => setIIFP(Number(v) < 0 ? null : Number(v))}
                  opsi={[{ v: '-1', l: `Ikuti saran${saran.saran ? ` (${saran.saran}")` : ''}` }, ...daftarIFP.map((x, j) => ({ v: String(j), l: x.nama }))]} />
                <div className="grid grid-cols-2 gap-2.5">
                  <Pilih label="Pemasangan" nilai={pasangIFP} onUbah={setPasangIFP} opsi={[{ v: 'dinding', l: 'Bracket dinding' }, { v: 'troli', l: 'Mobile stand / troli' }]} />
                  <Angka label="Meja ke IFP" nilai={panjangMeja} satuan="m" onUbah={v => v >= 1 && v <= 50 && setPanjangMeja(v)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Centang label="OPS PC" nilai={ops} onUbah={setOps} />
                  <Centang label="Kamera conference" nilai={kamera} onUbah={setKamera} />
                  <Centang label="Speakerphone / mic" nilai={mic} onUbah={setMic} />
                  <Angka label="Wireless dongle / ruang" nilai={dongle} step={1} onUbah={v => v >= 0 && v <= 10 && setDongle(Math.round(v))} />
                </div>
              </>
            )}
          </div>
        </Kartu>

        <Kartu judul="Hasil">
          {jenis === 'videowall' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <Nilai label="Susunan" nilai={`${kolom} × ${baris}`} ket={`${kolom * baris} panel${screen > 1 ? ` · ${kolom * baris * screen} total` : ''}`} />
              <Nilai label="Ukuran" nilai={`${f(vw.lebarM)} × ${f(vw.tinggiM)}`} satuan="m"
                ket={modeVW === 'ukuran' ? `target ${f(targetW)} × ${f(targetH)} m` : undefined} />
              <Nilai label="Resolusi" nilai={`${vw.resX} × ${vw.resY}`} />
              <Nilai label="Daya / videowall" nilai={f(dVW.totalW / 1000)} satuan="kW" ket={`${f(dVW.arusA, 1)} A · ${dVW.sirkuit} jalur MCB 16 A`} />
              <Nilai label="Panas" nilai={f(dVW.btu, 0)} satuan="BTU/jam" ket={`±${f(dVW.pkAC, 1)} PK AC`} />
              <Nilai label="Bezel" nilai={f(panel.bezelMm)} satuan="mm" nada={panel.bezelMm <= 1.8 ? 'baik' : 'awas'}
                ket={panel.bezelMm <= 1.8 ? 'cocok untuk teks / spreadsheet' : 'sambungan terlihat pada teks kecil'} />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <Nilai label="Diagonal minimum" nilai={f(saran.diagonalMin, 0)} satuan="inci" ket={`penonton ${f(jarak, 1)} m`} />
              <Nilai label="IFP dipakai" nilai={`${ifp.diagonal}"`} nada={kurangBesar || ifp.diagonal < saran.diagonalMin ? 'awas' : 'baik'}
                ket={kurangBesar ? 'tidak ada IFP cukup besar - pertimbangkan videowall / LED' : ifp.diagonal < saran.diagonalMin ? 'lebih kecil dari minimum' : 'memenuhi jarak pandang'} />
              <Nilai label="Daya / ruang" nilai={f(dI.totalW, 0)} satuan="W" ket={`${f(dI.arusA, 1)} A`} />
              {panjangMeja > USB_PASIF_MAKS_M && <Nilai label="Sentuh dari meja" nilai="Extender" nada="awas" ket={`lebih dari ${USB_PASIF_MAKS_M} m, USB pasif tidak andal`} />}
            </div>
          )}
          <Catatan>{jenis === 'videowall'
            ? 'Ukuran panel = area gambar 16:9 dari diagonalnya, ditambah celah bezel. Daya panel dari Pustaka (bidang Daya), bawaan 180 W/panel bila kosong.'
            : 'Diagonal minimum dari aturan 4-6-8 (AVIXA). Daftar ukuran dari Pustaka (display tanpa bezel, ≥ 55"), bawaan 55-110" bila kosong.'}</Catatan>
        </Kartu>
      </div>

      <Kartu judul={adaHarga ? 'Daftar material & penawaran' : 'Daftar material (BOM)'}
        aksi={<TombolSalin teks={teks} onCetak={() => bukaCetak(lembar())} onPng={() => unduhLembarPNG(lembar(), namaBerkas(nama, project, customer))} simpan={{ judul: nama, lembar }} />}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-3">
          <Angka label="PPN" nilai={ppn} satuan="%" onUbah={v => v >= 0 && v <= 30 && setPpn(v)} />
        </div>
        <TabelBom baris={barisBom} harga={harga} setHarga={setHarga} ppn={ppn} nilai={nilai} />
        <Catatan>Isi harga satuan untuk membuat lembar penawaran. Simpan ke proyek menyimpan potret lembar ini di Project Progress.</Catatan>
      </Kartu>
    </div>
  );
}
