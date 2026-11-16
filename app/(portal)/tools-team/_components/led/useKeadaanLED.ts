'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRiwayat } from '../bersama/riwayat';
import { useBerkas } from '../bersama/berkas/useBerkas';
import { f } from '../bersama/ui';
import { adapterLED, type EkstraLED } from './adapterLED';
import { svgPosterKoneksi } from './koneksi/svg';
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

  const { modul, brandAda, brandAktif, modulBrand, u, labelLED, px, namaUnit, luasUnit, dayaUnitEf, beratUnitEf, opsiBulat, kolom, baris, h, hw,
    vpSaja, vpM, vpAio, kartuM, teksHw, hwKoneksi, lewat4K, n, tKon, hDaya, ctrlBom, barisBom, nilaiPenawaran, adaHarga, selisihW, selisihH, dataKoneksi, dataDaya } = useTurunanLED(isian, refLED.data);

  const ekstra = useRef<() => EkstraLED>(() => ({ ringkasan: { project: '', customer: '', kode: '', lebarM: 0, tinggiM: 0, resX: 0, resY: 0, jumlahCab: 0, screen: 1 }, svg: () => '' }));
  useEffect(() => {
    ekstra.current = () => ({
      ringkasan: { project, customer, kode: labelLED.slice(0, 30), lebarM: h.lebarM, tinggiM: h.tinggiM, resX: h.resX, resY: h.resY, jumlahCab: h.jumlahCab, screen: n },
      svg: () => svgPosterKoneksi(dataKoneksi, koneksi, 'Screen Connection LED', [project || 'Tanpa nama project', customer].filter(Boolean).join(' — ')),
    });
  });
  const adapter = useMemo(() => adapterLED(ekstra), []);
  const berkas = useBerkas({
    adapter, data: isian, hanyaLihat,
    namaAwal: () => [project, customer].filter(Boolean).join(' - ') || `LED ${u.kode} ${f(h.lebarM)}×${f(h.tinggiM)} m`,
    terapkan: d => {
      if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
      const v = d as Partial<typeof isian>;
      terapkan(v); riwayat.mulaiBaru({ ...isian, ...v });
      return true;
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

  return { adaHarga, baris, barisBom, barisIn, beratUnit, beratUnitEf, bit, berkas, bom, brandAda, brandAktif, bukaRef, bulat, cabH, cabKey, cabW, ctrlBom, customer, daftarKartu, daftarModul, daftarVP, dataDaya, dataKoneksi, dayaLED, dayaUnit, dayaUnitEf, faktorDaya, faktorRata, h, hDaya, hanyaLihat, harga, hw, hwKoneksi, isian, kartuM, kartuPilih, kolom, kolomIn, koneksi, labelLED, lewat4K, lingkungan, luasUnit, mode, modeHw, modul, modulBrand, modulKode, n, namaUnit, nilaiPenawaran, opsiBulat, pembuat, pilihBrand, pilihCab, pilihModul, pindah, pitch, project, px, pxIn, refLED, refresh, resetUnit, riwayat, satuan, screen, selisihH, selisihW, setBarisIn, setBeratUnit, setBit, setBom, setBukaRef, setBulat, setCabH, setCabKey, setCabW, setCustomer, setDayaLED, setDayaUnit, setFaktorDaya, setFaktorRata, setHarga, setKartuPilih, setKolomIn, setKoneksi, setLingkungan, setMode, setModeHw, setModulKode, setPembuat, setPitch, setProject, setPxIn, setRefresh, setSatuan, setScreen, setTampilan, setTanggal, setTargetH, setTargetW, setTegangan, setVpPilih, tKon, tampilan, tanggal, targetH, targetW, tegangan, teksHw, terapkan, u, vpAio, vpM, vpPilih, vpSaja };
}

export type KeadaanLED = ReturnType<typeof useKeadaanLED>;
