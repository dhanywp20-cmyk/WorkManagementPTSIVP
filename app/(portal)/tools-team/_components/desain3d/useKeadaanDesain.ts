'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useImporObjek } from './impor/useImporObjek';
import { analisisDari, type Benda, type CahayaDiPermukaan, contohAwal, daftarRuang, golonganDipakai, jalurKabel, type OpsiKelas, type Titik, type Ruang, ruangDari, tinggiAlasDi, type Blending } from './inti';
import { useRiwayat } from '../bersama/riwayat';
import type { ConfirmState } from '@/components/shared/ConfirmDialog';
import { getSession } from '@/lib/auth/sesi';
import { FAKTOR_PANDANG, type JenisPandang } from '@/lib/av/hitung';
import { isPimpinan } from '@/lib/pimpinan';
import type { Sudut } from './mesin/tipe';
import { batasDunia } from './mesin/kamera';
import { bacaIngatanAwal, isiDariIngatan } from './simpan/templateAwal';
import { usePilihanBenda } from './usePilihanBenda';
import { usePreferensiKanvas } from './usePreferensiKanvas';
import { useStatusDesain } from './useStatusDesain';
import { useRefMesin } from './useRefMesin';
import { useAnalisisDisplay } from './useAnalisisDisplay';

export { KUNCI_SIMPAN } from './useStatusDesain';

export interface DesainTim {
  id: string; nama: string; versi: number; jumlah_benda: number; dibuat_oleh_nama: string; diubah_oleh_nama: string;
  updated_at: string; ruang: Ruang | null; bolehUbah: boolean;
}

export const RUANG_AWAL: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null };

export const API_PRODUK = '/api/tools-team/produk';

export type ProdukTimC = { id: string; label: string; ket: string; jenis: Benda['jenis']; atur: Record<string, unknown>; oleh: string; bolehHapus?: boolean };

export const R2_AWAL = { aktif: true, p: 6, l: 6, t: 3, lantai: 'karpet' as const, pintu: true };

export const ambilKunci = (r: Ruang, b: Benda[], n: string) => JSON.stringify({ r, b, n });

export type KeadaanDesain = ReturnType<typeof useKeadaanDesain>;

export function useKeadaanDesain() {
  const [ingatanAwal] = useState(bacaIngatanAwal);
  const isiAwal = isiDariIngatan(ingatanAwal);
  const [ruang, setRuang] = useState<Ruang>(() => (isiAwal ? { ...RUANG_AWAL, ...isiAwal.ruang } : RUANG_AWAL));
  const [benda, setBenda] = useState<Benda[]>(() => (isiAwal ? isiAwal.benda : contohAwal(RUANG_AWAL)));
  const { pilih, setPilih, pilihLain, setPilihLain, modeBanyak, setModeBanyak, pilihRef, pilihLainRef, modeBanyakRef, dariToggle, setPilihan } = usePilihanBenda();
  const [layarPenuh, setLayarPenuh] = useState(false);
  const [panel, setPanel] = useState(false);
  const [modal, setModal] = useState<'simpan' | 'buka' | null>(null);
  const [sisi, setSisi] = useState<'kategori' | 'tambah' | 'ruang' | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const bukaSisi = (k: 'kategori' | 'tambah' | 'ruang') => { setPanel(false); setSisi(v => (v === k ? null : k)); };
  const [targetRuang, setTargetRuang] = useState<string>('0');
  const [tampilan, setTampilan] = useState<'3d' | 'atas' | 'kursi'>('3d');
  const [modeGizmo, setModeGizmo] = useState<'translate' | 'rotate'>('translate');
  const [ukur, setUkur] = useState(true);
  const [garisUkur, setGarisUkur] = useState(true);
  const [labelProduk, setLabelProduk] = useState(() => typeof window === 'undefined' || window.innerWidth >= 640);
  const { chipBuka, setChipBuka, sembunyiTeks, setSembunyiTeks, sinarNyata, setSinarNyata, jarakDinding, setJarakDinding, detailBlending,
    setDetailBlending, teksSinar, setTeksSinar, snap, setSnap, daftarKanvas, setDaftarKanvas } = usePreferensiKanvas();
  const [targetKontras, setTargetKontras] = useState(15);
  const [kerucut, setKerucut] = useState(true);
  const [sinar, setSinar] = useState(true);
  const [tampilBlending, setTampilBlending] = useState(true);
  const [gridSinar, setGridSinar] = useState(false);
  const [infoBlending, setInfoBlending] = useState<Blending[]>([]);
  const [ukuranCahaya, setUkuranCahaya] = useState<Record<string, CahayaDiPermukaan>>({});
  const [modeSeret, setModeSeret] = useState<'putar' | 'geser'>('putar');
  const [menuSudut, setMenuSudut] = useState(false);
  const [fokusRuang, setFokusRuang] = useState<'semua' | number>('semua');
  const [gantiIsi, setGantiIsi] = useState(false);
  const [pesan, setPesan] = useState('');
  const [hanyaLihat] = useState(() => isPimpinan(getSession()));
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const sudutRef = useRef<Sudut | 'kursi'>('iso');
  const kameraSiap = useRef(false);
  const an = analisisDari(ruang);
  const jenisPandang = an.jenis, faktorCustom = an.faktor, sudutNyaman = an.sudut;
  const setAnalisis = (x: Partial<NonNullable<Ruang['analisis']>>) => setRuang(r => ({ ...r, analisis: { ...analisisDari(r), ...x } }));
  const setJenisPandang = (v: JenisPandang | 'custom') => setAnalisis({ jenis: v });
  const setFaktorCustom = (v: number) => setAnalisis({ faktor: v });
  const setSudutNyaman = (v: number) => setAnalisis({ sudut: v });
  const [jangkau, setJangkau] = useState(false);
  const [tampilShare, setTampilShare] = useState(true);
  const [tampilKabel, setTampilKabel] = useState(false);
  const [kabelPower, setKabelPower] = useState(false);
  const kabel = useMemo(() => jalurKabel(benda, ruang, { power: kabelPower }), [benda, ruang, kabelPower]);
  const legendaKabel = tampilKabel && kabel.length > 0 ? golonganDipakai(kabel) : null;
  const [bayangan, setBayangan] = useState(true);
  const [produkTim, setProdukTim] = useState<{ daftar: ProdukTimC[]; bolehTambah: boolean } | null>(null);
  const [galatProduk, setGalatProduk] = useState('');
  const [cariProduk, setCariProduk] = useState('');
  const [bukaKelas, setBukaKelas] = useState(false);
  const [opsiKelas, setOpsiKelas] = useState<OpsiKelas>({});
  const faktorPandang = jenisPandang === 'custom' ? faktorCustom : FAKTOR_PANDANG[jenisPandang];
  const { namaDesain, setNamaDesain, asal, setAsal, dasar, setDasar, tersimpan, setTersimpan, daftarTim, setDaftarTim, desainAktif, setDesainAktif,
    lihatVersi, setLihatVersi, statusSimpan, setStatusSimpan, sibukSimpan, setSibukSimpan } = useStatusDesain(isiAwal);
  const [siap, setSiap] = useState(false);
  const [galat, setGalat] = useState('');
  const { wadahRef, mesin, pasSetelahTemplate, teksturBayang, gambarLayar, sumberTekstur, gambarTekstur, modelImpor, inputGambar, inputModel,
    inputLaptop } = useRefMesin();
  const [versiTekstur, setVersiTekstur] = useState(0);
  const [alatKanvas, setAlatKanvas] = useState<'pilih' | 'ukur'>('pilih');
  const [titikUkur, setTitikUkur] = useState<Titik | null>(null);
  const klikUkurRef = useRef<((p: Titik) => void) | null>(null);
  const snapRef = useRef(snap); snapRef.current = snap;
  const sumbuGeserRef = useRef<'x' | 'z'>('x');
  const [sembunyiGolongan, setSembunyiGolongan] = useState<string[]>([]);
  const sembunyiRef = useRef(sembunyiGolongan); sembunyiRef.current = sembunyiGolongan;
  const [versiGambar, setVersiGambar] = useState(0);
  const [menuPusat, setMenuPusat] = useState(false);
  const bendaRef = useRef(benda); bendaRef.current = benda;
  const ruangRef = useRef(ruang); ruangRef.current = ruang;

  const potret = useMemo(() => ({ ruang, benda }), [ruang, benda]);
  const riwayat = useRiwayat(potret, v => { ruangRef.current = v.ruang; setRuang(v.ruang); setBenda(v.benda); });

  const kunciKini = useMemo(() => ambilKunci(ruang, benda, namaDesain), [ruang, benda, namaDesain]);
  const adaPerubahan = dasar !== null && kunciKini !== dasar;

  const kotakRuang = useMemo(() => daftarRuang(ruang), [ruang]);
  const [objekGambar, setObjekGambar] = useState<{ ganti?: Benda } | null>(null);
  const impor = useImporObjek({
    THREE: () => mesin.current?.THREE ?? null, modelImpor, gambarLayar,
    kotak: () => kotakRuang[Number(targetRuang)] ?? kotakRuang[0],
    tambahBenda: b => {
      setBenda(bs => (bs.some(x => x.id === b.id) ? bs.map(x => (x.id === b.id ? b : x)) : [...bs, { ...b, elev: tinggiAlasDi(bs, b.x, b.z) }]));
      setPilih(b.id); setModal(null);
    },
    gambarBerubah: () => setVersiGambar(v => v + 1), setPesan, setGalat,
  });
  const batas = useMemo(() => batasDunia(ruang), [ruang]);
  const plafonDi = (x: number) => kotakRuang[ruangDari(ruang, x)]?.t ?? ruang.t;

  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(''), 4000);
    return () => clearTimeout(t);
  }, [pesan]);

  const analisis = useAnalisisDisplay({ benda, ruang, faktorPandang });
  const terpilih = benda.find(b => b.id === pilih) ?? null;
  const gantiBenda = (baru: Benda) => setBenda(bs => bs.map(b => (b.id === baru.id ? baru : b)));
  const duaRuang = kotakRuang.length > 1;
  const adaProyektor = benda.some(b => b.jenis === 'proyektor');
  const jumlahProyektor = benda.filter(b => b.jenis === 'proyektor').length;

  const bukaAtur = useRef(() => { setSisi(null); setPanel(true); });
  const sisiLalu = useRef(sisi), bendaLalu = useRef(benda);
  useEffect(() => {
    if (!pilih) { setPanel(false); return; }
    if (sisiLalu.current === 'tambah' && !bendaLalu.current.some(b => b.id === pilih)) return;
    bukaAtur.current();
  }, [pilih]);
  useEffect(() => { sisiLalu.current = sisi; bendaLalu.current = benda; }, [sisi, benda]);

  return { bukaAtur, sinarNyata, setSinarNyata, sembunyiTeks, setSembunyiTeks, jarakDinding, setJarakDinding, teksSinar, setTeksSinar, daftarKanvas, setDaftarKanvas, ukuranCahaya, setUkuranCahaya, snapRef, sumbuGeserRef, sembunyiGolongan, setSembunyiGolongan, sembunyiRef, snap, setSnap, alatKanvas, setAlatKanvas, titikUkur, setTitikUkur, klikUkurRef, ingatanAwal, sumberTekstur, gambarTekstur, versiTekstur, setVersiTekstur, setPilihan, pilihLain, setPilihLain, modeBanyak, setModeBanyak, layarPenuh, setLayarPenuh, pilihRef, pilihLainRef, modeBanyakRef, dariToggle, tampilShare, setTampilShare, adaPerubahan, adaProyektor, detailBlending, gridSinar, infoBlending, jumlahProyektor, setDetailBlending, setGridSinar, setInfoBlending, setTampilBlending, tampilBlending, an, analisis, asal, asideRef, batas, bayangan, benda, bendaRef, bukaKelas, bukaSisi, cariProduk, chipBuka, daftarTim, dasar, desainAktif, duaRuang, faktorCustom, faktorPandang, fokusRuang, galat, galatProduk, gambarLayar, gantiBenda, gantiIsi, garisUkur, hanyaLihat, impor, inputGambar, inputLaptop, inputModel, jangkau, jenisPandang, kabel, kabelPower, kameraSiap, kerucut, konfirmasi, kotakRuang, kunciKini, labelProduk, legendaKabel, lihatVersi, menuPusat, menuSudut, mesin, modal, modeGizmo, modeSeret, modelImpor, namaDesain, objekGambar, opsiKelas, panel, pasSetelahTemplate, pesan, pilih, plafonDi, potret, produkTim, riwayat, ruang, ruangRef, setAnalisis, setAsal, setBayangan, setBenda, setBukaKelas, setCariProduk, setChipBuka, setDaftarTim, setDasar, setDesainAktif, setFaktorCustom, setFokusRuang, setGalat, setGalatProduk, setGantiIsi, setGarisUkur, setJangkau, setJenisPandang, setKabelPower, setKerucut, setKonfirmasi, setLabelProduk, setLihatVersi, setMenuPusat, setMenuSudut, setModal, setModeGizmo, setModeSeret, setNamaDesain, setObjekGambar, setOpsiKelas, setPanel, setPesan, setPilih, setProdukTim, setRuang, setSiap, setSibukSimpan, setSinar, setSisi, setStatusSimpan, setSudutNyaman, setTampilKabel, setTampilan, setTargetKontras, setTargetRuang, setTersimpan, setUkur, setVersiGambar, siap, sibukSimpan, sinar, sisi, statusSimpan, sudutNyaman, sudutRef, tampilKabel, tampilan, targetKontras, targetRuang, teksturBayang, terpilih, tersimpan, ukur, versiGambar, wadahRef };
}
