'use client';
import { useMemo } from 'react';
import { useReferensiLED } from './referensi/useReferensiLED';
import { type DataDaya, susunDaya } from './daya/data';
import { type DataKoneksi, susunKoneksi } from './koneksi/data';
import { bomLED, BRAND_UMUM, brandModul, cabinetUntukUkuran, cariModul, daftarBrand, type Hardware, hitungLED, kapasitasHardware, pikselUnit, saranHardware, totalPenawaran } from '@/lib/av/hitung';
import { BULAT, PER_M2 } from './data';
import type { useIsianLED } from './useIsianLED';

type IsianLED = ReturnType<typeof useIsianLED>['isian'];
type DataRefLED = ReturnType<typeof useReferensiLED>['data'];

export function useTurunanLED(isian: IsianLED, data: DataRefLED) {
  const { modeHw, vpPilih, kartuPilih, mode, satuan, modulKode, lingkungan, pitch, cabW, cabH, pxIn, targetW, targetH, bulat, screen, kolomIn,
    barisIn, dayaUnit, beratUnit, faktorRata, refresh, bit, tegangan, faktorDaya, koneksi, dayaLED, bom, harga } = isian;
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
  const hw = saranHardware(h.totalPx, h.portLAN, daftarKartu, daftarVP);
  const vpSaja = daftarVP.filter(v => !(v.senderBawaan && v.port > 0));
  const vpM = daftarVP.find(v => v.nama === vpPilih) ?? null;
  const vpAio = !!vpM && vpM.senderBawaan && vpM.port > 0;
  const kartuM = vpAio ? null : (daftarKartu.find(k => k.nama === kartuPilih) ?? hw.kartu?.hw ?? null);
  const teksHw = modeHw === 'manual'
    ? [vpM && `${kapasitasHardware(vpM, h.totalPx, h.portLAN).qty}× ${vpM.nama}`, kartuM && `${kapasitasHardware(kartuM, h.totalPx, h.portLAN).qty}× ${kartuM.nama}`].filter(Boolean).join(' + ')
    : '';
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
  return { modul, brandAda, brandAktif, modulBrand, u, labelLED, px, namaUnit, luasUnit, dayaUnitEf, beratUnitEf, opsiBulat, kolom, baris, h, hw,
    vpSaja, vpM, vpAio, kartuM, teksHw, hwKoneksi, lewat4K, n, tKon, hDaya, ctrlBom, barisBom, nilaiPenawaran, adaHarga, selisihW, selisihH, dataKoneksi, dataDaya };
}
