'use client';
import { useMemo } from 'react';
import { useReferensiLED } from './referensi/useReferensiLED';
import { type DataDaya, susunDaya } from './daya/data';
import { type DataKoneksi } from './koneksi/data';
import { bomLED, BRAND_UMUM, brandModul, cabinetUntukUkuran, cariModul, daftarBrand, type Hardware, hitungLED, kapasitasHardware, pikselUnit, saranHardware, totalPenawaran } from '@/lib/av/hitung';
import { BULAT, PER_M2 } from './data';
import { susunanLayar } from './layar';
import { type LayarKoneksi, susunMulti } from './koneksi/multi';
import type { useIsianLED } from './useIsianLED';

type IsianLED = ReturnType<typeof useIsianLED>['isian'];
type DataRefLED = ReturnType<typeof useReferensiLED>['data'];

export function useTurunanLED(isian: IsianLED, data: DataRefLED) {
  const { modeHw, vpPilih, kartuPilih, mode, satuan, modulKode, lingkungan, pitch, cabW, cabH, pxIn, targetW, targetH, bulat, screen, kolomIn,
    barisIn, dayaUnit, beratUnit, faktorRata, refresh, bit, tegangan, faktorDaya, koneksi, dayaLED, bom, harga, namaLayar, layarLain, pisahKartu } = isian;
  const { modul: daftarModul, kartu: daftarKartu, vp: daftarVP } = data;
  const modul = cariModul(daftarModul, modulKode) ?? daftarModul[0];
  const brandAda = daftarBrand(data.brand, daftarModul, true);
  const brandAktif = brandModul(modul);
  const modulBrand = daftarModul.filter(m => brandModul(m) === brandAktif);
  const u = satuan === 'modul'
    ? { pitch: modul.pitch, w: modul.w, h: modul.h, pxX: modul.pxW, pxY: modul.pxH, kode: modul.kode, merek: brandAktif, model: modul.model ?? '' }
    : { pitch, w: cabW, h: cabH, pxX: pikselUnit(cabW, pitch), pxY: pikselUnit(cabH, pitch), kode: `P${pitch}`, merek: '', model: '' };
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
  /** Screen 2, 3, … : modul sama, ukuran sendiri. */
  const layarTurunan = useMemo(() => layarLain.map(l => {
    const { kolom: k, baris: b } = susunanLayar(l, u.w, u.h);
    const hl = hitungLED({
      pitch: u.pitch, cabLebar: u.w, cabTinggi: u.h, kolom: k, baris: b, pxX: px.x, pxY: px.y, dayaMaksCab: dayaUnitEf,
      faktorRata: faktorRata / 100, beratCab: beratUnitEf, refresh, bit, tegangan, faktorDaya,
    });
    const selisih = l.mode === 'ukuran' ? { w: hl.lebarM - l.targetW, h: hl.tinggiM - l.targetH } : { w: 0, h: 0 };
    return { l, kolom: k, baris: b, h: hl, selisih };
  }), [layarLain, u.pitch, u.w, u.h, px.x, px.y, dayaUnitEf, faktorRata, beratUnitEf, refresh, bit, tegangan, faktorDaya]);
  const multi = layarTurunan.length > 0;
  /** Total semua screen - dasar pemilihan SATU video processor. */
  const hTotal = useMemo(() => {
    const semua = [h, ...layarTurunan.map(x => x.h)];
    const jml = (fn: (x: typeof h) => number) => semua.reduce((a, x) => a + fn(x), 0);
    return {
      screen: semua.length, totalPx: jml(x => x.totalPx), portLAN: jml(x => x.portLAN), jumlahCab: jml(x => x.jumlahCab), luasM2: jml(x => x.luasM2),
      dayaMaksW: jml(x => x.dayaMaksW), dayaRataW: jml(x => x.dayaRataW), arusMaksA: jml(x => x.arusMaksA), panasBTU: jml(x => x.panasBTU), beratKg: jml(x => x.beratKg),
    };
  }, [h, layarTurunan]);
  const hw = saranHardware(hTotal.totalPx, hTotal.portLAN, daftarKartu, daftarVP);
  const vpSaja = daftarVP.filter(v => !(v.senderBawaan && v.port > 0));
  const vpM = daftarVP.find(v => v.nama === vpPilih) ?? null;
  const vpAio = !!vpM && vpM.senderBawaan && vpM.port > 0;
  const kartuM = vpAio ? null : (daftarKartu.find(k => k.nama === kartuPilih) ?? hw.kartu?.hw ?? null);
  const teksHw = modeHw === 'manual'
    ? [vpM && `${kapasitasHardware(vpM, hTotal.totalPx, hTotal.portLAN).qty}× ${vpM.nama}`, kartuM && `${kapasitasHardware(kartuM, hTotal.totalPx, hTotal.portLAN).qty}× ${kartuM.nama}`].filter(Boolean).join(' + ')
    : '';
  const hwKoneksi = modeHw === 'manual' ? (vpAio ? vpM : kartuM) : (hw.vp?.hw ?? hw.kartu?.hw ?? null);
  const ppkHw = hwKoneksi?.port ?? 0;
  const namaHw = hwKoneksi?.nama ?? null;
  const dataKoneksi: DataKoneksi = useMemo(() => ({
    kolom, baris, wUnit: u.w, hUnit: u.h, pxX: px.x, pxY: px.y, satuan: namaUnit, pxPerPort: h.pxPerPort, portIdeal: h.portLAN,
    ppkHw, namaHw, refresh, bit,
  }), [kolom, baris, u.w, u.h, px.x, px.y, namaUnit, h.pxPerPort, h.portLAN, ppkHw, namaHw, refresh, bit]);
  const dataDaya: DataDaya = useMemo(() => ({
    kolom, baris, wUnit: u.w, hUnit: u.h, satuan: namaUnit, wattUnit: dayaUnitEf, tegangan, faktorDaya,
  }), [kolom, baris, u.w, u.h, namaUnit, dayaUnitEf, tegangan, faktorDaya]);
  const lewat4K = h.resX > 3840 || h.resY > 2160;
  /** "Jumlah screen identik" hanya untuk satu ukuran; multi-screen memakai daftar screen. */
  const n = multi ? 1 : Math.max(1, screen);

  const layarKoneksi: LayarKoneksi[] = useMemo(() => [
    { nama: namaLayar || 'Screen 1', d: dataKoneksi, s: koneksi },
    ...layarTurunan.map(x => ({ nama: x.l.nama, s: x.l.koneksi, d: { ...dataKoneksi, kolom: x.kolom, baris: x.baris, portIdeal: x.h.portLAN } })),
  ], [namaLayar, dataKoneksi, koneksi, layarTurunan]);
  const mKon = useMemo(() => susunMulti(layarKoneksi, pisahKartu), [layarKoneksi, pisahKartu]);
  /** Gabungan semua screen (sama dengan susunan Screen 1 bila hanya satu screen). */
  const tKon = mKon.gabung;
  const layarDaya: { nama: string; d: DataDaya }[] = useMemo(() => [
    { nama: namaLayar || 'Screen 1', d: dataDaya },
    ...layarTurunan.map(x => ({ nama: x.l.nama, d: { ...dataDaya, kolom: x.kolom, baris: x.baris } })),
  ], [namaLayar, dataDaya, layarTurunan]);
  const hDaya = useMemo(() => susunDaya(dataDaya, dayaLED), [dataDaya, dayaLED]);
  const sirkuitTotal = useMemo(() => layarDaya.reduce((a, x, i) => a + (i ? susunDaya(x.d, dayaLED) : hDaya).sirkuit.length, 0), [layarDaya, dayaLED, hDaya]);
  const ctrlBom = (() => {
    if (modeHw === 'manual') return [vpM, kartuM].filter((x): x is Hardware => !!x).map(x => ({ nama: x.nama, qty: kapasitasHardware(x, hTotal.totalPx, hTotal.portLAN).qty }));
    const pilih = hw.vp ?? hw.kartu;
    return pilih ? [{ nama: pilih.hw.nama, qty: Math.max(pilih.qty, tKon.controller) }] : [];
  })();
  const barisBom = bomLED({
    satuan: satuan === 'modul' && namaUnit === 'modul' ? 'modul' : 'cabinet', namaLED: labelLED,
    unit: hTotal.jumlahCab * n, screen: n, cadanganUnit: bom.cadanganUnit,
    receivingCard: (tKon.hasil.sel.length + tKon.hasil.tanpaPort.length) * n, namaRC: tKon.rc?.nama ?? '', cadanganRC: bom.cadanganRC,
    controller: ctrlBom, controllerCadangan: koneksi.cadangan === 'controller',
    dayaMaksW: hTotal.dayaMaksW * n, psuW: bom.psuW,
    port: tKon.portTerpakai * n, portCadangan: tKon.portCadangan * n, panjangLAN: bom.panjangLAN,
    sirkuit: sirkuitTotal * n, mcb: dayaLED.mcb, panjangPower: dayaLED.panjang,
    lebarM: h.lebarM, tinggiM: h.tinggiM, baris,
    layar: multi ? [{ lebarM: h.lebarM, tinggiM: h.tinggiM, baris }, ...layarTurunan.map(x => ({ lebarM: x.h.lebarM, tinggiM: x.h.tinggiM, baris: x.baris }))] : undefined,
  });
  const nilaiPenawaran = totalPenawaran(barisBom, harga, bom.ppn);
  const adaHarga = barisBom.some(b => (harga[b.kunci] ?? 0) > 0);
  const selisihW = mode === 'ukuran' ? h.lebarM - targetW : 0;
  const selisihH = mode === 'ukuran' ? h.tinggiM - targetH : 0;
  return { modul, brandAda, brandAktif, modulBrand, u, labelLED, px, namaUnit, luasUnit, dayaUnitEf, beratUnitEf, opsiBulat, kolom, baris, h, hw,
    vpSaja, vpM, vpAio, kartuM, teksHw, hwKoneksi, lewat4K, n, tKon, hDaya, ctrlBom, barisBom, nilaiPenawaran, adaHarga, selisihW, selisihH, dataKoneksi, dataDaya,
    layarTurunan, multi, hTotal, layarKoneksi, mKon, layarDaya, sirkuitTotal };
}
