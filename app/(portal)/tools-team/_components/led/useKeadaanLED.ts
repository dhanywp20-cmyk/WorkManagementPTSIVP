'use client';
/** Keadaan Kalkulator LED: isian, referensi produk, hasil hitung, hardware, data koneksi & daya, BOM. */
import { useMemo, useState } from 'react';
import { useRiwayat } from '../bersama/riwayat';
import type { FileAktifLED } from './FileLED';
import { useReferensiLED } from './referensi/useReferensiLED';
import { bersihkanDaya, type DataDaya, DAYA_AWAL, type PengaturanDaya, susunDaya } from './daya/data';
import { bersihkanKoneksi, type DataKoneksi, KONEKSI_AWAL, type PengaturanKoneksi, susunKoneksi } from './koneksi/data';
import { getSession } from '@/lib/auth';
import { bomLED, BRAND_UMUM, brandModul, cabinetUntukUkuran, cariModul, daftarBrand, type Hardware, hitungLED, kapasitasHardware, kunciModul, type Pembulatan, saranHardware, totalPenawaran } from '@/lib/av-hitung';
import { isPimpinan } from '@/lib/pimpinan';
import { bersihkanBOM, bersihkanHarga, BOM_AWAL, BULAT, CABINET, type Lingkungan, LINGKUNGAN_TIPE, type PengaturanBOM, PER_M2 } from './data';
import type { SubLED } from './panel/BarSub';

export function useKeadaanLED({ subAwal = 'led', onSub }: { subAwal?: SubLED; onSub?: (sub: SubLED) => void }) {
  const [tampilan, setTampilan] = useState<SubLED>(subAwal);
  //  Akun pimpinan: menghitung & mencetak boleh, menyimpan ke server tidak.
  const [hanyaLihat] = useState(() => isPimpinan(getSession()));
  const pindah = (v: SubLED) => { setTampilan(v); onSub?.(v); };
  const refLED = useReferensiLED();
  const { modul: daftarModul, kartu: daftarKartu, vp: daftarVP } = refLED.data;
  const [modeHw, setModeHw] = useState<'otomatis' | 'manual'>('otomatis');
  const [bukaRef, setBukaRef] = useState(false);
  const [vpPilih, setVpPilih] = useState('');
  const [kartuPilih, setKartuPilih] = useState('');
  const [project, setProject] = useState('');
  const [customer, setCustomer] = useState('');
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [pembuat, setPembuat] = useState(() => getSession<{ full_name?: string }>()?.full_name ?? '');

  const [mode, setMode] = useState<'ukuran' | 'jumlah'>('ukuran');
  const [satuan, setSatuan] = useState<'modul' | 'cabinet'>('modul');
  const [modulKode, setModulKode] = useState('P2.5');
  const [lingkungan, setLingkungan] = useState<Lingkungan>('indoor');
  const [pitch, setPitch] = useState(2.5);
  const [cabKey, setCabKey] = useState('500x500');
  const [cabW, setCabW] = useState(500);
  const [cabH, setCabH] = useState(500);
  const [pxIn, setPxIn] = useState<{ x: number; y: number } | null>(null);
  const [targetW, setTargetW] = useState(4);
  const [targetH, setTargetH] = useState(2.25);
  const [bulat, setBulat] = useState<Pembulatan>('round');
  const [screen, setScreen] = useState(1);
  const [kolomIn, setKolomIn] = useState(8);
  const [barisIn, setBarisIn] = useState(5);
  const [dayaUnit, setDayaUnit] = useState<number | null>(null);
  const [beratUnit, setBeratUnit] = useState<number | null>(null);
  const [faktorRata, setFaktorRata] = useState(33);
  const [refresh, setRefresh] = useState<60 | 120 | 144 | 240>(60);
  const [bit, setBit] = useState<8 | 10 | 12>(8);
  const [tegangan, setTegangan] = useState(220);
  const [faktorDaya, setFaktorDaya] = useState(0.95);
  const [koneksi, setKoneksi] = useState<PengaturanKoneksi>(KONEKSI_AWAL);
  const [dayaLED, setDayaLED] = useState<PengaturanDaya>(DAYA_AWAL);
  const [bom, setBom] = useState<PengaturanBOM>(BOM_AWAL);
  /** Harga satuan per baris BOM (Rp), ikut tersimpan bersama hitungan. */
  const [harga, setHarga] = useState<Record<string, number>>({});

  //  Potret seluruh isian: dasar undo/redo dan simpan/buka hitungan.
  const isian = useMemo(() => ({
    modeHw, vpPilih, kartuPilih, project, customer, tanggal, pembuat, mode, satuan, modulKode, lingkungan, pitch,
    cabKey, cabW, cabH, pxIn, targetW, targetH, bulat, screen, kolomIn, barisIn, dayaUnit, beratUnit, faktorRata,
    refresh, bit, tegangan, faktorDaya, koneksi, dayaLED, bom, harga,
  }), [modeHw, vpPilih, kartuPilih, project, customer, tanggal, pembuat, mode, satuan, modulKode, lingkungan, pitch,
    cabKey, cabW, cabH, pxIn, targetW, targetH, bulat, screen, kolomIn, barisIn, dayaUnit, beratUnit, faktorRata,
    refresh, bit, tegangan, faktorDaya, koneksi, dayaLED, bom, harga]);
  type Isian = typeof isian;
  /** Kembalikan isian; kunci yang tidak ada (hitungan versi lama) dibiarkan. */
  const terapkan = (v: Partial<Isian>) => {
    const pasang = <K extends keyof Isian>(k: K, setel: (x: Isian[K]) => void) => { if (k in v) setel(v[k] as Isian[K]); };
    pasang('modeHw', setModeHw); pasang('vpPilih', setVpPilih); pasang('kartuPilih', setKartuPilih);
    pasang('project', setProject); pasang('customer', setCustomer); pasang('tanggal', setTanggal); pasang('pembuat', setPembuat);
    pasang('mode', setMode); pasang('satuan', setSatuan); pasang('modulKode', setModulKode); pasang('lingkungan', setLingkungan);
    pasang('pitch', setPitch); pasang('cabKey', setCabKey); pasang('cabW', setCabW); pasang('cabH', setCabH); pasang('pxIn', setPxIn);
    pasang('targetW', setTargetW); pasang('targetH', setTargetH); pasang('bulat', setBulat); pasang('screen', setScreen);
    pasang('kolomIn', setKolomIn); pasang('barisIn', setBarisIn); pasang('dayaUnit', setDayaUnit); pasang('beratUnit', setBeratUnit);
    pasang('faktorRata', setFaktorRata); pasang('refresh', setRefresh); pasang('bit', setBit); pasang('tegangan', setTegangan);
    pasang('faktorDaya', setFaktorDaya);
    //  Hitungan lama belum punya screen connection -> pengaturan bawaan.
    setKoneksi(bersihkanKoneksi(v.koneksi));
    setDayaLED(bersihkanDaya(v.dayaLED)); setBom(bersihkanBOM(v.bom)); setHarga(bersihkanHarga(v.harga));
  };
  const riwayat = useRiwayat(isian, v => terapkan(v));
  const [fileMode, setFileMode] = useState<'buka' | 'simpan' | null>(null);
  const [fileAktif, setFileAktif] = useState<FileAktifLED | null>(null);

  //  Satuan aktif: modul/cabinet dari referensi brand, atau cabinet ukuran bebas.
  const modul = cariModul(daftarModul, modulKode) ?? daftarModul[0];
  const brandAda = daftarBrand(refLED.data.brand, daftarModul, true);
  const brandAktif = brandModul(modul);
  const modulBrand = daftarModul.filter(m => brandModul(m) === brandAktif);
  const u = satuan === 'modul'
    ? { pitch: modul.pitch, w: modul.w, h: modul.h, pxX: modul.pxW, pxY: modul.pxH, kode: modul.kode, merek: brandAktif, model: modul.model ?? '' }
    : { pitch, w: cabW, h: cabH, pxX: Math.round(cabW / pitch), pxY: Math.round(cabH / pitch), kode: `P${pitch}`, merek: '', model: '' };
  /** Nama produk di ringkasan & cetak: brand (kecuali Umum) + model + pitch. */
  const labelLED = [u.merek !== BRAND_UMUM && u.merek, u.model, u.kode].filter(Boolean).join(' ');
  const px = pxIn ?? { x: u.pxX, y: u.pxY };
  const namaUnit = satuan === 'modul' ? (modul.unit ?? 'modul') : 'cabinet';

  const luasUnit = (u.w * u.h) / 1e6;
  const dayaUnitEf = dayaUnit ?? Math.round(PER_M2[lingkungan].daya * luasUnit * 10) / 10;
  const beratUnitEf = beratUnit ?? Math.round(PER_M2[lingkungan].berat * luasUnit * 100) / 100;
  const opsiBulat = BULAT.map(b => ({ ...b, ...cabinetUntukUkuran(targetW, targetH, u.w, u.h, b.v) }));
  const { kolom, baris } = mode === 'ukuran' ? opsiBulat.find(o => o.v === bulat)! : { kolom: kolomIn, baris: barisIn };

  const h = useMemo(() => hitungLED({
    pitch: u.pitch, cabLebar: u.w, cabTinggi: u.h, kolom, baris, pxX: px.x, pxY: px.y, dayaMaksCab: dayaUnitEf,
    faktorRata: faktorRata / 100, beratCab: beratUnitEf, refresh, bit, tegangan, faktorDaya,
  }), [u.pitch, u.w, u.h, kolom, baris, px.x, px.y, dayaUnitEf, faktorRata, beratUnitEf, refresh, bit, tegangan, faktorDaya]);
  const hw = saranHardware(h.totalPx, h.portLAN, daftarKartu, daftarVP);
  const vpSaja = daftarVP.filter(v => !(v.senderBawaan && v.port > 0));
  //  Mode manual: VP pilihan; sending card hanya dibutuhkan bila VP tidak all-in-one.
  const vpM = daftarVP.find(v => v.nama === vpPilih) ?? null;
  const vpAio = !!vpM && vpM.senderBawaan && vpM.port > 0;
  const kartuM = vpAio ? null : (daftarKartu.find(k => k.nama === kartuPilih) ?? hw.kartu?.hw ?? null);
  const teksHw = modeHw === 'manual'
    ? [vpM && `${kapasitasHardware(vpM, h.totalPx, h.portLAN).qty}× ${vpM.nama}`, kartuM && `${kapasitasHardware(kartuM, h.totalPx, h.portLAN).qty}× ${kartuM.nama}`].filter(Boolean).join(' + ')
    : '';
  //  Screen connection: port per controller dari hardware terpilih (manual) atau opsi A/B (otomatis).
  const hwKoneksi = modeHw === 'manual' ? (vpAio ? vpM : kartuM) : (hw.vp?.hw ?? hw.kartu?.hw ?? null);
  const dataKoneksi: DataKoneksi = useMemo(() => ({
    kolom, baris, wUnit: u.w, hUnit: u.h, pxX: px.x, pxY: px.y, satuan: namaUnit, pxPerPort: h.pxPerPort, portIdeal: h.portLAN,
    ppkHw: hwKoneksi?.port ?? 0, namaHw: hwKoneksi?.nama ?? null, refresh, bit,
  }), [kolom, baris, u.w, u.h, px.x, px.y, namaUnit, h.pxPerPort, h.portLAN, hwKoneksi?.port, hwKoneksi?.nama, refresh, bit]);
  const dataDaya: DataDaya = useMemo(() => ({
    kolom, baris, wUnit: u.w, hUnit: u.h, satuan: namaUnit, wattUnit: dayaUnitEf, tegangan, faktorDaya,
  }), [kolom, baris, u.w, u.h, namaUnit, dayaUnitEf, tegangan, faktorDaya]);
  const lewat4K = h.resX > 3840 || h.resY > 2160;
  const n = Math.max(1, screen);

  //  Daftar material dari kalkulator + screen connection + power connection (semua screen).
  const tKon = useMemo(() => susunKoneksi(dataKoneksi, koneksi), [dataKoneksi, koneksi]);
  const hDaya = useMemo(() => susunDaya(dataDaya, dayaLED), [dataDaya, dayaLED]);
  const ctrlBom = (() => {
    if (modeHw === 'manual') return [vpM, kartuM].filter((x): x is Hardware => !!x).map(x => ({ nama: x.nama, qty: kapasitasHardware(x, h.totalPx, h.portLAN).qty }));
    const pilih = hw.vp ?? hw.kartu;
    return pilih ? [{ nama: pilih.hw.nama, qty: Math.max(pilih.qty, tKon.controller) }] : [];
  })();
  const barisBom = bomLED({
    satuan: satuan === 'modul' && namaUnit === 'modul' ? 'modul' : 'cabinet', namaLED: labelLED,
    unit: h.jumlahCab * n, screen: n, cadanganUnit: bom.cadanganUnit,
    receivingCard: (tKon.hasil.sel.length + tKon.hasil.tanpaPort.length) * n, namaRC: tKon.rc?.nama ?? '', cadanganRC: bom.cadanganRC,
    controller: ctrlBom, controllerCadangan: koneksi.cadangan === 'controller',
    dayaMaksW: h.dayaMaksW * n, psuW: bom.psuW,
    port: tKon.portTerpakai * n, portCadangan: tKon.portCadangan * n, panjangLAN: bom.panjangLAN,
    sirkuit: hDaya.sirkuit.length * n, mcb: dayaLED.mcb, panjangPower: dayaLED.panjang,
    lebarM: h.lebarM, tinggiM: h.tinggiM, baris,
  });
  const nilaiPenawaran = totalPenawaran(barisBom, harga, bom.ppn);
  const adaHarga = barisBom.some(b => (harga[b.kunci] ?? 0) > 0);
  const selisihW = mode === 'ukuran' ? h.lebarM - targetW : 0;
  const selisihH = mode === 'ukuran' ? h.tinggiM - targetH : 0;

  const resetUnit = () => { setPxIn(null); setDayaUnit(null); setBeratUnit(null); };
  const pilihModul = (k: string) => {
    setModulKode(k); resetUnit();
    const m = cariModul(daftarModul, k);
    if (m) setLingkungan(LINGKUNGAN_TIPE[m.tipe]);
  };
  /** Ganti brand: pilih modul brand itu yang pitch-nya sama, atau yang pertama. */
  const pilihBrand = (nama: string) => {
    const daftar = daftarModul.filter(m => brandModul(m) === nama);
    const m = daftar.find(x => x.kode === modul.kode) ?? daftar[0];
    if (m) pilihModul(kunciModul(m));
  };
  const pilihCab = (v: string) => {
    setCabKey(v); resetUnit();
    const c = CABINET.find(x => x.v === v);
    if (c && c.w) { setCabW(c.w); setCabH(c.h); }
  };

  return { adaHarga, baris, barisBom, barisIn, beratUnit, beratUnitEf, bit, bom, brandAda, brandAktif, bukaRef, bulat, cabH, cabKey, cabW, ctrlBom, customer, daftarKartu, daftarModul, daftarVP, dataDaya, dataKoneksi, dayaLED, dayaUnit, dayaUnitEf, faktorDaya, faktorRata, fileAktif, fileMode, h, hDaya, hanyaLihat, harga, hw, hwKoneksi, isian, kartuM, kartuPilih, kolom, kolomIn, koneksi, labelLED, lewat4K, lingkungan, luasUnit, mode, modeHw, modul, modulBrand, modulKode, n, namaUnit, nilaiPenawaran, opsiBulat, pembuat, pilihBrand, pilihCab, pilihModul, pindah, pitch, project, px, pxIn, refLED, refresh, resetUnit, riwayat, satuan, screen, selisihH, selisihW, setBarisIn, setBeratUnit, setBit, setBom, setBukaRef, setBulat, setCabH, setCabKey, setCabW, setCustomer, setDayaLED, setDayaUnit, setFaktorDaya, setFaktorRata, setFileAktif, setFileMode, setHarga, setKartuPilih, setKolomIn, setKoneksi, setLingkungan, setMode, setModeHw, setModulKode, setPembuat, setPitch, setProject, setPxIn, setRefresh, setSatuan, setScreen, setTampilan, setTanggal, setTargetH, setTargetW, setTegangan, setVpPilih, tKon, tampilan, tanggal, targetH, targetW, tegangan, teksHw, terapkan, u, vpAio, vpM, vpPilih, vpSaja };
}

export type KeadaanLED = ReturnType<typeof useKeadaanLED>;
