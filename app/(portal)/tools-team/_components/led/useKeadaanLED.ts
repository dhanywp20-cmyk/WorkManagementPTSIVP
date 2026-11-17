'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRiwayat } from '../bersama/riwayat';
import { useBerkas } from '../bersama/berkas/useBerkas';
import { f } from '../bersama/ui';
import { adapterLED, type EkstraLED } from './adapterLED';
import { svgPosterKoneksiMulti } from './koneksi/svg';
import type { PengaturanKoneksi } from './koneksi/data';
import { layarBaru, type LayarTambahan, MAKS_LAYAR } from './layar';
import { useReferensiLED } from './referensi/useReferensiLED';
import { getSession } from '@/lib/auth/sesi';
import { brandModul, cariModul, kunciModul } from '@/lib/av/hitung';
import { isPimpinan } from '@/lib/pimpinan';
import { CABINET, LINGKUNGAN_TIPE } from './data';
import type { SubLED } from './panel/BarSub';
import { useIsianLED } from './useIsianLED';
import { useTurunanLED } from './useTurunanLED';
import { gabungRef } from './refPakai';

export function useKeadaanLED({ subAwal = 'led', onSub }: { subAwal?: SubLED; onSub?: (sub: SubLED) => void }) {
  const [tampilan, setTampilan] = useState<SubLED>(subAwal);
  const [hanyaLihat] = useState(() => isPimpinan(getSession()));
  const pindah = (v: SubLED) => { setTampilan(v); onSub?.(v); };
  const refLED = useReferensiLED();
  const { modeHw, setModeHw, bukaRef, setBukaRef, vpPilih, setVpPilih, kartuPilih, setKartuPilih, project, setProject, customer, setCustomer,
    tanggal, setTanggal, pembuat, setPembuat, mode, setMode, satuan, setSatuan, modulKode, setModulKode, lingkungan, setLingkungan, pitch, setPitch,
    cabKey, setCabKey, cabW, setCabW, cabH, setCabH, pxIn, setPxIn, targetW, setTargetW, targetH, setTargetH, bulat, setBulat, screen, setScreen,
    kolomIn, setKolomIn, barisIn, setBarisIn, dayaUnit, setDayaUnit, beratUnit, setBeratUnit, faktorRata, setFaktorRata, refresh, setRefresh, bit,
    setBit, tegangan, setTegangan, faktorDaya, setFaktorDaya, koneksi, setKoneksi, dayaLED, setDayaLED, bom, setBom, harga, setHarga,
    namaLayar, setNamaLayar, layarLain, setLayarLain, pisahKartu, setPisahKartu, isian, terapkan } = useIsianLED();
  const riwayat = useRiwayat(isian, v => terapkan(v));
  const [isianAwal] = useState(isian);
  const refData = useMemo(() => gabungRef(refLED.data, isian.refPakai), [refLED.data, isian.refPakai]);
  const { modul: daftarModul, kartu: daftarKartu, vp: daftarVP } = refData;
  const refHilang = [
    cariModul(daftarModul, modulKode) ? '' : `modul ${(([br, kd, md]) => [kd ?? br, md, kd && br !== 'Umum' ? br : ''].filter(Boolean).join(' '))(modulKode.split('|'))}`,
    vpPilih && !daftarVP.some(v => v.nama === vpPilih) ? `video processor ${vpPilih}` : '',
    kartuPilih && !daftarKartu.some(k => k.nama === kartuPilih) ? `sending card ${kartuPilih}` : '',
  ].filter(Boolean);

  const { modul, brandAda, brandAktif, modulBrand, u, labelLED, px, namaUnit, luasUnit, dayaUnitEf, beratUnitEf, opsiBulat, kolom, baris, h, hw,
    vpSaja, vpM, vpAio, kartuM, teksHw, hwKoneksi, lewat4K, n, tKon, hDaya, ctrlBom, barisBom, nilaiPenawaran, adaHarga, selisihW, selisihH, dataKoneksi, dataDaya,
    layarTurunan, multi, modulCampur, hTotal, layarKoneksi, mKon, layarDaya, sirkuitTotal } = useTurunanLED(isian, refData);

  const ekstra = useRef<() => EkstraLED>(() => ({ ringkasan: { project: '', customer: '', kode: '', lebarM: 0, tinggiM: 0, resX: 0, resY: 0, jumlahCab: 0, screen: 1 }, svg: () => '' }));
  useEffect(() => {
    ekstra.current = () => ({
      ringkasan: { project, customer, kode: labelLED.slice(0, 30), lebarM: h.lebarM, tinggiM: h.tinggiM, resX: h.resX, resY: h.resY, jumlahCab: hTotal.jumlahCab, screen: multi ? hTotal.screen : n },
      svg: () => svgPosterKoneksiMulti(layarKoneksi, pisahKartu, 'Screen Connection LED', [project || 'Tanpa nama project', customer].filter(Boolean).join(' — ')),
    });
  });
  const adapter = useMemo(() => adapterLED(ekstra), []);
  const dataBerkas = useMemo(() => ({ ...isian, refPakai: { modul, vp: vpM, kartu: kartuM } }), [isian, modul, vpM, kartuM]);
  const berkas = useBerkas({
    adapter, data: dataBerkas, hanyaLihat,
    namaAwal: () => [project, customer].filter(Boolean).join(' - ') || `LED ${u.kode} ${f(h.lebarM)}×${f(h.tinggiM)} m`,
    terapkan: d => {
      if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
      const v = d as Partial<typeof isian>;
      terapkan(v); riwayat.mulaiBaru({ ...isian, ...v });
      return true;
    },
    kosongkan: () => {
      const v = { ...isianAwal, pembuat, tanggal: new Date().toISOString().slice(0, 10) };
      terapkan(v); riwayat.mulaiBaru(v);
    },
  });

  const resetUnit = () => { setPxIn(null); setDayaUnit(null); setBeratUnit(null); };
  const pilihModul = (k: string) => {
    setModulKode(k); resetUnit();
    const m = cariModul(daftarModul, k);
    if (m) setLingkungan(LINGKUNGAN_TIPE[m.tipe]);
  };
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

  const tambahLayar = (dari?: number) => setLayarLain(daftar => {
    if (daftar.length + 1 >= MAKS_LAYAR) return daftar;
    const urut = daftar.length + 2;
    if (dari === undefined) return [...daftar, layarBaru(urut, { targetW: Math.max(1, Math.round(targetW * 0.6 * 10) / 10), targetH: Math.max(0.5, Math.round(targetH * 0.6 * 10) / 10) })];
    const sumber: Partial<LayarTambahan> = dari === 0
      ? { mode, targetW, targetH, bulat, kolomIn, barisIn, koneksi }
      : daftar[dari - 1];
    return [...daftar, layarBaru(urut, { ...sumber, koneksi: sumber.koneksi ? { ...sumber.koneksi, manual: null, mode: 'template' } : undefined })];
  });
  const ubahLayar = (i: number, x: Partial<LayarTambahan>) => setLayarLain(daftar => daftar.map((l, j) => (j === i - 1 ? { ...l, ...x } : l)));
  const hapusLayar = (i: number) => setLayarLain(daftar => daftar.filter((_, j) => j !== i - 1));
  const ubahKoneksiLayar = (i: number, s: PengaturanKoneksi) => (i === 0 ? setKoneksi(s) : ubahLayar(i, { koneksi: s }));

  return { refHilang, hTotal, hapusLayar, modulCampur, layarDaya, layarKoneksi, layarLain, layarTurunan, mKon, multi, namaLayar, pisahKartu, setNamaLayar, setPisahKartu, sirkuitTotal, tambahLayar, ubahKoneksiLayar, ubahLayar, adaHarga, baris, barisBom, barisIn, beratUnit, beratUnitEf, bit, berkas, bom, brandAda, brandAktif, bukaRef, bulat, cabH, cabKey, cabW, ctrlBom, customer, daftarKartu, daftarModul, daftarVP, dataDaya, dataKoneksi, dayaLED, dayaUnit, dayaUnitEf, faktorDaya, faktorRata, h, hDaya, hanyaLihat, harga, hw, hwKoneksi, isian, kartuM, kartuPilih, kolom, kolomIn, koneksi, labelLED, lewat4K, lingkungan, luasUnit, mode, modeHw, modul, modulBrand, modulKode, n, namaUnit, nilaiPenawaran, opsiBulat, pembuat, pilihBrand, pilihCab, pilihModul, pindah, pitch, project, px, pxIn, refLED, refresh, resetUnit, riwayat, satuan, screen, selisihH, selisihW, setBarisIn, setBeratUnit, setBit, setBom, setBukaRef, setBulat, setCabH, setCabKey, setCabW, setCustomer, setDayaLED, setDayaUnit, setFaktorDaya, setFaktorRata, setHarga, setKartuPilih, setKolomIn, setKoneksi, setLingkungan, setMode, setModeHw, setModulKode, setPembuat, setPitch, setProject, setPxIn, setRefresh, setSatuan, setScreen, setTampilan, setTanggal, setTargetH, setTargetW, setTegangan, setVpPilih, tKon, tampilan, tanggal, targetH, targetW, tegangan, teksHw, terapkan, u, vpAio, vpM, vpPilih, vpSaja };
}

export type KeadaanLED = ReturnType<typeof useKeadaanLED>;
