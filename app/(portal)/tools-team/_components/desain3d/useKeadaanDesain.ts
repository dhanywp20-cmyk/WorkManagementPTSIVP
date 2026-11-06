'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useImporObjek } from './impor/useImporObjek';
import { analisisDari, ukuranGambarDisplay, type Benda, type CahayaDiPermukaan, contohAwal, daftarRuang, DISPLAY, golonganDipakai, jalurKabel, KATEGORI_RUANG, type OpsiKelas, type Snap, snapSah, type Titik, type Ruang, ruangDari, tinggiAlasDi, titikPenonton, type Blending } from './inti';
import { useRiwayat } from '../bersama/riwayat';
import type { ConfirmState } from '@/components/shared/ConfirmDialog';
import { getSession } from '@/lib/auth/sesi';
import { FAKTOR_PANDANG, type JenisPandang } from '@/lib/av/hitung';
import { isPimpinan } from '@/lib/pimpinan';
import type * as T from 'three';
import type { Mesin, Sudut } from './mesin/tipe';
import { batasDunia } from './mesin/kamera';
import { lupakanPilihanKartu } from './mesin/ukurBlending';
import { bacaIngatanAwal, isiDariIngatan, KATEGORI_AWAL } from './simpan/templateAwal';

export const KUNCI_SIMPAN = 'wm_desain3d';

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
  const [pilih, setPilih] = useState<string | null>(null);
  const [pilihLain, setPilihLain] = useState<string[]>([]);
  const [modeBanyak, setModeBanyak] = useState(false);
  const [layarPenuh, setLayarPenuh] = useState(false);
  const pilihRef = useRef(pilih), pilihLainRef = useRef(pilihLain), modeBanyakRef = useRef(modeBanyak);
  useEffect(() => { pilihRef.current = pilih; pilihLainRef.current = pilihLain; modeBanyakRef.current = modeBanyak; }, [pilih, pilihLain, modeBanyak]);
  const dariToggle = useRef(false);
  const setPilihan = (utama: string | null, lain: string[]) => {
    if (utama !== pilihRef.current) dariToggle.current = true;
    setPilih(utama); setPilihLain(lain);
  };
  useEffect(() => {
    if (dariToggle.current) { dariToggle.current = false; return; }
    setPilihLain(l => (l.length ? [] : l));
  }, [pilih]);
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
  const [chipBuka, setChipBukaMentah] = useState(() => { try { const s = localStorage.getItem('wm_desain3d_chip'); return s === null ? window.innerWidth >= 640 : s === '1'; } catch { return false; } });
  const setChipBuka = (f: (v: boolean) => boolean) => setChipBukaMentah(v => { const x = f(v); try { localStorage.setItem('wm_desain3d_chip', x ? '1' : '0'); } catch {  } return x; });
  const [sembunyiTeks, setSembunyiTeksMentah] = useState(() => { try { return localStorage.getItem('wm_desain3d_sembunyi_teks') === '1'; } catch { return false; } });
  const setSembunyiTeks = (v: boolean) => { setSembunyiTeksMentah(v); try { localStorage.setItem('wm_desain3d_sembunyi_teks', v ? '1' : '0'); } catch {  } };
  const [sinarNyata, setSinarNyataMentah] = useState(() => { try { return localStorage.getItem('wm_desain3d_sinar_nyata') !== '0'; } catch { return true; } });
  const setSinarNyata = (v: boolean) => { setSinarNyataMentah(v); try { localStorage.setItem('wm_desain3d_sinar_nyata', v ? '1' : '0'); } catch {  } };
  const [jarakDinding, setJarakDindingMentah] = useState(() => { try { return localStorage.getItem('wm_desain3d_jarak_dinding') === '1'; } catch { return false; } });
  const setJarakDinding = (v: boolean) => { setJarakDindingMentah(v); try { localStorage.setItem('wm_desain3d_jarak_dinding', v ? '1' : '0'); } catch {  } };
  const [targetKontras, setTargetKontras] = useState(15);
  const [kerucut, setKerucut] = useState(true);
  const [sinar, setSinar] = useState(true);
  const [tampilBlending, setTampilBlending] = useState(true);
  const [detailBlending, setDetailBlendingMentah] = useState(() => { try { return localStorage.getItem('wm_desain3d_detail_blending') === '1'; } catch { return false; } });
  const setDetailBlending = (v: boolean) => {
    lupakanPilihanKartu(); setDetailBlendingMentah(v);
    try { localStorage.setItem('wm_desain3d_detail_blending', v ? '1' : '0'); } catch {  }
  };
  const [gridSinar, setGridSinar] = useState(false);
  const [teksSinar, setTeksSinarMentah] = useState(() => { try { return localStorage.getItem('wm_desain3d_teks_sinar') !== '0'; } catch { return true; } });
  const setTeksSinar = (v: boolean) => { setTeksSinarMentah(v); try { localStorage.setItem('wm_desain3d_teks_sinar', v ? '1' : '0'); } catch {  } };
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
  const [namaDesain, setNamaDesain] = useState(() => (isiAwal ? `${isiAwal.nama} (salinan)` : 'Ruang Meeting'));
  const [asal, setAsal] = useState<{ jenis: 'baru' | 'laptop' | 'lokal' | 'template'; nama?: string }>(() => (isiAwal
    ? { jenis: 'template', nama: `${KATEGORI_RUANG.find(k => k.id === KATEGORI_AWAL)?.judul ?? isiAwal.nama} · default Admin` }
    : { jenis: 'baru' }));
  const [dasar, setDasar] = useState<string | null>(null);
  const [tersimpan, setTersimpan] = useState<{ nama: string; ruang: Ruang; benda: Benda[] }[]>([]);
  const [daftarTim, setDaftarTim] = useState<DesainTim[] | null>(null);
  const [desainAktif, setDesainAktif] = useState<{ id: string; bolehUbah: boolean; versi: number } | null>(null);
  const [lihatVersi, setLihatVersi] = useState<{ versi: number; terbaru: number } | null>(null);
  const [statusSimpan, setStatusSimpan] = useState<{ teks: string; nada: 'ok' | 'galat' | 'info' } | null>(null);
  const [sibukSimpan, setSibukSimpan] = useState(false);
  const [siap, setSiap] = useState(false);
  const [galat, setGalat] = useState('');
  const wadahRef = useRef<HTMLDivElement>(null);
  const mesin = useRef<Mesin | null>(null);
  const pasSetelahTemplate = useRef<boolean | 'langsung'>(false);
  const teksturBayang = useRef<{ bayang: T.Texture; cahaya: T.Texture } | null>(null);
  const gambarLayar = useRef(new Map<string, T.Texture>());
  const sumberTekstur = useRef(new Map<string, string>());
  const gambarTekstur = useRef(new Map<string, HTMLImageElement>());
  const [versiTekstur, setVersiTekstur] = useState(0);
  const [snap, setSnapMentah] = useState<Snap>(() => { try { return snapSah(JSON.parse(localStorage.getItem('wm_desain3d_snap') ?? 'null')); } catch { return snapSah(null); } });
  const setSnap = (s: Snap) => { setSnapMentah(s); try { localStorage.setItem('wm_desain3d_snap', JSON.stringify(s)); } catch {  } };
  const [daftarKanvas, setDaftarKanvasMentah] = useState(() => { try { return localStorage.getItem('wm_desain3d_daftar') === '1'; } catch { return false; } });
  const setDaftarKanvas = (v: boolean) => { setDaftarKanvasMentah(v); try { localStorage.setItem('wm_desain3d_daftar', v ? '1' : '0'); } catch {  } };
  const [alatKanvas, setAlatKanvas] = useState<'pilih' | 'ukur'>('pilih');
  const [titikUkur, setTitikUkur] = useState<Titik | null>(null);
  const klikUkurRef = useRef<((p: Titik) => void) | null>(null);
  const snapRef = useRef(snap); snapRef.current = snap;
  const sumbuGeserRef = useRef<'x' | 'z'>('x');
  const [sembunyiGolongan, setSembunyiGolongan] = useState<string[]>([]);
  const sembunyiRef = useRef(sembunyiGolongan); sembunyiRef.current = sembunyiGolongan;
  const modelImpor = useRef(new Map<string, T.Object3D>());
  const [versiGambar, setVersiGambar] = useState(0);
  const inputGambar = useRef<HTMLInputElement>(null);
  const inputModel = useRef<HTMLInputElement>(null);
  const inputLaptop = useRef<HTMLInputElement>(null);
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
    try { const s = localStorage.getItem(KUNCI_SIMPAN); if (s) setTersimpan(JSON.parse(s)); } catch {  }
  }, []);
  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(''), 4000);
    return () => clearTimeout(t);
  }, [pesan]);

  const analisis = useMemo(() => {
    const penonton = titikPenonton(benda);
    return benda.filter(b => DISPLAY.includes(b.jenis)).map(d => {
      const ri = ruangDari(ruang, d.x);
      const r = (d.rot * Math.PI) / 180;
      const hadap = { x: Math.sin(r), z: Math.cos(r) };
      const data = penonton.filter(p => ruangDari(ruang, p.x) === ri).map(p => {
        const dx = p.x - d.x, dz = p.z - d.z;
        const jarak = Math.hypot(dx, dz);
        const sudut = jarak > 0 ? (Math.acos(Math.max(-1, Math.min(1, (dx * hadap.x + dz * hadap.z) / jarak))) * 180) / Math.PI : 0;
        return { ...p, jarak, sudut };
      });
      const terjauhP = data.reduce<typeof data[number] | null>((m, x) => (!m || x.jarak > m.jarak ? x : m), null);
      const terjauh = terjauhP?.jarak ?? 0;
      const terdekat = data.reduce((m, x) => Math.min(m, x.jarak), Infinity);
      const sudutMaks = data.reduce((m, x) => Math.max(m, x.sudut), 0);
      const tinggiPerlu = terjauh / faktorPandang;
      const gambar = ukuranGambarDisplay(d);
      return { d, ri, gambar, jumlah: data.length, terjauh, terjauhP, terdekat, sudutMaks, tinggiPerlu, cukup: gambar.h >= tinggiPerlu };
    });
  }, [benda, faktorPandang, ruang]);
  const terpilih = benda.find(b => b.id === pilih) ?? null;
  const gantiBenda = (baru: Benda) => setBenda(bs => bs.map(b => (b.id === baru.id ? baru : b)));
  const duaRuang = kotakRuang.length > 1;
  const adaProyektor = benda.some(b => b.jenis === 'proyektor');
  const jumlahProyektor = benda.filter(b => b.jenis === 'proyektor').length;

  return { sinarNyata, setSinarNyata, sembunyiTeks, setSembunyiTeks, jarakDinding, setJarakDinding, teksSinar, setTeksSinar, daftarKanvas, setDaftarKanvas, ukuranCahaya, setUkuranCahaya, snapRef, sumbuGeserRef, sembunyiGolongan, setSembunyiGolongan, sembunyiRef, snap, setSnap, alatKanvas, setAlatKanvas, titikUkur, setTitikUkur, klikUkurRef, ingatanAwal, sumberTekstur, gambarTekstur, versiTekstur, setVersiTekstur, setPilihan, pilihLain, setPilihLain, modeBanyak, setModeBanyak, layarPenuh, setLayarPenuh, pilihRef, pilihLainRef, modeBanyakRef, dariToggle, tampilShare, setTampilShare, adaPerubahan, adaProyektor, detailBlending, gridSinar, infoBlending, jumlahProyektor, setDetailBlending, setGridSinar, setInfoBlending, setTampilBlending, tampilBlending, an, analisis, asal, asideRef, batas, bayangan, benda, bendaRef, bukaKelas, bukaSisi, cariProduk, chipBuka, daftarTim, dasar, desainAktif, duaRuang, faktorCustom, faktorPandang, fokusRuang, galat, galatProduk, gambarLayar, gantiBenda, gantiIsi, garisUkur, hanyaLihat, impor, inputGambar, inputLaptop, inputModel, jangkau, jenisPandang, kabel, kabelPower, kameraSiap, kerucut, konfirmasi, kotakRuang, kunciKini, labelProduk, legendaKabel, lihatVersi, menuPusat, menuSudut, mesin, modal, modeGizmo, modeSeret, modelImpor, namaDesain, objekGambar, opsiKelas, panel, pasSetelahTemplate, pesan, pilih, plafonDi, potret, produkTim, riwayat, ruang, ruangRef, setAnalisis, setAsal, setBayangan, setBenda, setBukaKelas, setCariProduk, setChipBuka, setDaftarTim, setDasar, setDesainAktif, setFaktorCustom, setFokusRuang, setGalat, setGalatProduk, setGantiIsi, setGarisUkur, setJangkau, setJenisPandang, setKabelPower, setKerucut, setKonfirmasi, setLabelProduk, setLihatVersi, setMenuPusat, setMenuSudut, setModal, setModeGizmo, setModeSeret, setNamaDesain, setObjekGambar, setOpsiKelas, setPanel, setPesan, setPilih, setProdukTim, setRuang, setSiap, setSibukSimpan, setSinar, setSisi, setStatusSimpan, setSudutNyaman, setTampilKabel, setTampilan, setTargetKontras, setTargetRuang, setTersimpan, setUkur, setVersiGambar, siap, sibukSimpan, sinar, sisi, statusSimpan, sudutNyaman, sudutRef, tampilKabel, tampilan, targetKontras, targetRuang, teksturBayang, terpilih, tersimpan, ukur, versiGambar, wadahRef };
}
