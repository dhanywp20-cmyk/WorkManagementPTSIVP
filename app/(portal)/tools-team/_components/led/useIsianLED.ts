'use client';
import { useMemo, useState } from 'react';
import { bersihkanDaya, DAYA_AWAL, type PengaturanDaya } from './daya/data';
import { bersihkanKoneksi, KONEKSI_AWAL, type PengaturanKoneksi } from './koneksi/data';
import { getSession } from '@/lib/auth/sesi';
import { type Pembulatan } from '@/lib/av/hitung';
import { bersihkanBOM, bersihkanHarga, BOM_AWAL, type Lingkungan, type PengaturanBOM } from './data';
import { NAMA_VP_LAMA } from '@/lib/av/hitung';

export function useIsianLED() {
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
  const [harga, setHarga] = useState<Record<string, number>>({});

  const isian = useMemo(() => ({
    modeHw, vpPilih, kartuPilih, project, customer, tanggal, pembuat, mode, satuan, modulKode, lingkungan, pitch,
    cabKey, cabW, cabH, pxIn, targetW, targetH, bulat, screen, kolomIn, barisIn, dayaUnit, beratUnit, faktorRata,
    refresh, bit, tegangan, faktorDaya, koneksi, dayaLED, bom, harga,
  }), [modeHw, vpPilih, kartuPilih, project, customer, tanggal, pembuat, mode, satuan, modulKode, lingkungan, pitch,
    cabKey, cabW, cabH, pxIn, targetW, targetH, bulat, screen, kolomIn, barisIn, dayaUnit, beratUnit, faktorRata,
    refresh, bit, tegangan, faktorDaya, koneksi, dayaLED, bom, harga]);
  type Isian = typeof isian;
  const terapkan = (v: Partial<Isian>) => {
    const pasang = <K extends keyof Isian>(k: K, setel: (x: Isian[K]) => void) => { if (k in v) setel(v[k] as Isian[K]); };
    pasang('modeHw', setModeHw); pasang('vpPilih', v => setVpPilih(NAMA_VP_LAMA[v] ?? v)); pasang('kartuPilih', setKartuPilih);
    pasang('project', setProject); pasang('customer', setCustomer); pasang('tanggal', setTanggal); pasang('pembuat', setPembuat);
    pasang('mode', setMode); pasang('satuan', setSatuan); pasang('modulKode', setModulKode); pasang('lingkungan', setLingkungan);
    pasang('pitch', setPitch); pasang('cabKey', setCabKey); pasang('cabW', setCabW); pasang('cabH', setCabH); pasang('pxIn', setPxIn);
    pasang('targetW', setTargetW); pasang('targetH', setTargetH); pasang('bulat', setBulat); pasang('screen', setScreen);
    pasang('kolomIn', setKolomIn); pasang('barisIn', setBarisIn); pasang('dayaUnit', setDayaUnit); pasang('beratUnit', setBeratUnit);
    pasang('faktorRata', setFaktorRata); pasang('refresh', setRefresh); pasang('bit', setBit); pasang('tegangan', setTegangan);
    pasang('faktorDaya', setFaktorDaya);
    setKoneksi(bersihkanKoneksi(v.koneksi));
    setDayaLED(bersihkanDaya(v.dayaLED)); setBom(bersihkanBOM(v.bom)); setHarga(bersihkanHarga(v.harga));
  };
  return { modeHw, setModeHw, bukaRef, setBukaRef, vpPilih, setVpPilih, kartuPilih, setKartuPilih, project, setProject, customer, setCustomer,
    tanggal, setTanggal, pembuat, setPembuat, mode, setMode, satuan, setSatuan, modulKode, setModulKode, lingkungan, setLingkungan, pitch, setPitch,
    cabKey, setCabKey, cabW, setCabW, cabH, setCabH, pxIn, setPxIn, targetW, setTargetW, targetH, setTargetH, bulat, setBulat, screen, setScreen,
    kolomIn, setKolomIn, barisIn, setBarisIn, dayaUnit, setDayaUnit, beratUnit, setBeratUnit, faktorRata, setFaktorRata, refresh, setRefresh, bit,
    setBit, tegangan, setTegangan, faktorDaya, setFaktorDaya, koneksi, setKoneksi, dayaLED, setDayaLED, bom, setBom, harga, setHarga, isian, terapkan };
}
