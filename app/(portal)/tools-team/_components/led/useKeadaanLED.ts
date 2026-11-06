'use client';
import { useState } from 'react';
import { useRiwayat } from '../bersama/riwayat';
import type { FileAktifLED } from './FileLED';
import { useReferensiLED } from './referensi/useReferensiLED';
import { getSession } from '@/lib/auth/sesi';
import { brandModul, cariModul, kunciModul } from '@/lib/av/hitung';
import { isPimpinan } from '@/lib/pimpinan';
import { CABINET, LINGKUNGAN_TIPE } from './data';
import type { SubLED } from './panel/BarSub';
import { useIsianLED } from './useIsianLED';
import { useTurunanLED } from './useTurunanLED';

export function useKeadaanLED({ subAwal = 'led', onSub }: { subAwal?: SubLED; onSub?: (sub: SubLED) => void }) {
  const [tampilan, setTampilan] = useState<SubLED>(subAwal);
  const [hanyaLihat] = useState(() => isPimpinan(getSession()));
  const pindah = (v: SubLED) => { setTampilan(v); onSub?.(v); };
  const refLED = useReferensiLED();
  const { modul: daftarModul, kartu: daftarKartu, vp: daftarVP } = refLED.data;
  const { modeHw, setModeHw, bukaRef, setBukaRef, vpPilih, setVpPilih, kartuPilih, setKartuPilih, project, setProject, customer, setCustomer,
    tanggal, setTanggal, pembuat, setPembuat, mode, setMode, satuan, setSatuan, modulKode, setModulKode, lingkungan, setLingkungan, pitch, setPitch,
    cabKey, setCabKey, cabW, setCabW, cabH, setCabH, pxIn, setPxIn, targetW, setTargetW, targetH, setTargetH, bulat, setBulat, screen, setScreen,
    kolomIn, setKolomIn, barisIn, setBarisIn, dayaUnit, setDayaUnit, beratUnit, setBeratUnit, faktorRata, setFaktorRata, refresh, setRefresh, bit,
    setBit, tegangan, setTegangan, faktorDaya, setFaktorDaya, koneksi, setKoneksi, dayaLED, setDayaLED, bom, setBom, harga, setHarga, isian, terapkan } = useIsianLED();
  const riwayat = useRiwayat(isian, v => terapkan(v));
  const [fileMode, setFileMode] = useState<'buka' | 'simpan' | null>(null);
  const [fileAktif, setFileAktif] = useState<FileAktifLED | null>(null);

  const { modul, brandAda, brandAktif, modulBrand, u, labelLED, px, namaUnit, luasUnit, dayaUnitEf, beratUnitEf, opsiBulat, kolom, baris, h, hw,
    vpSaja, vpM, vpAio, kartuM, teksHw, hwKoneksi, lewat4K, n, tKon, hDaya, ctrlBom, barisBom, nilaiPenawaran, adaHarga, selisihW, selisihH, dataKoneksi, dataDaya } = useTurunanLED(isian, refLED.data);

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

  return { adaHarga, baris, barisBom, barisIn, beratUnit, beratUnitEf, bit, bom, brandAda, brandAktif, bukaRef, bulat, cabH, cabKey, cabW, ctrlBom, customer, daftarKartu, daftarModul, daftarVP, dataDaya, dataKoneksi, dayaLED, dayaUnit, dayaUnitEf, faktorDaya, faktorRata, fileAktif, fileMode, h, hDaya, hanyaLihat, harga, hw, hwKoneksi, isian, kartuM, kartuPilih, kolom, kolomIn, koneksi, labelLED, lewat4K, lingkungan, luasUnit, mode, modeHw, modul, modulBrand, modulKode, n, namaUnit, nilaiPenawaran, opsiBulat, pembuat, pilihBrand, pilihCab, pilihModul, pindah, pitch, project, px, pxIn, refLED, refresh, resetUnit, riwayat, satuan, screen, selisihH, selisihW, setBarisIn, setBeratUnit, setBit, setBom, setBukaRef, setBulat, setCabH, setCabKey, setCabW, setCustomer, setDayaLED, setDayaUnit, setFaktorDaya, setFaktorRata, setFileAktif, setFileMode, setHarga, setKartuPilih, setKolomIn, setKoneksi, setLingkungan, setMode, setModeHw, setModulKode, setPembuat, setPitch, setProject, setPxIn, setRefresh, setSatuan, setScreen, setTampilan, setTanggal, setTargetH, setTargetW, setTegangan, setVpPilih, tKon, tampilan, tanggal, targetH, targetW, tegangan, teksHw, terapkan, u, vpAio, vpM, vpPilih, vpSaja };
}

export type KeadaanLED = ReturnType<typeof useKeadaanLED>;
