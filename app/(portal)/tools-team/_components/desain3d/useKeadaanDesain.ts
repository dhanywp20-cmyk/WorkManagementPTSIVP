'use client';
/**
 * Keadaan Desain 3D: seluruh state, ref, dan nilai turunan (analisis tampilan, kabel, riwayat undo).
 * Bagian dari Desain3D.tsx (Tools Team) - lihat struktur di desain3d/README.md.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useImporObjek } from './impor/useImporObjek';
import { analisisDari, type Benda, contohAwal, daftarRuang, DISPLAY, golonganDipakai, jalurKabel, KATEGORI_RUANG, type OpsiKelas, type Snap, snapSah, type Titik, type Ruang, ruangDari, tinggiAlasDi, titikPenonton, type Blending } from './inti';
import { useRiwayat } from '../bersama/riwayat';
import type { ConfirmState } from '@/components/shared/ConfirmDialog';
import { getSession } from '@/lib/auth';
import { FAKTOR_PANDANG, type JenisPandang } from '@/lib/av-hitung';
import { isPimpinan } from '@/lib/pimpinan';
import type * as T from 'three';
import type { Mesin, Sudut } from './mesin/tipe';
import { batasDunia } from './mesin/kamera';
import { bacaIngatanAwal, isiDariIngatan, KATEGORI_AWAL } from './simpan/templateAwal';


export const KUNCI_SIMPAN = 'wm_desain3d';

export interface DesainTim {
  id: string; nama: string; versi: number; jumlah_benda: number; dibuat_oleh_nama: string; diubah_oleh_nama: string;
  updated_at: string; ruang: Ruang | null; bolehUbah: boolean;
}

export const RUANG_AWAL: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null };

export const API_PRODUK = '/api/tools-team/produk';

/** Template "Produk saya" seperti dikirim /api/tools-team/produk. */
export type ProdukTimC = { id: string; label: string; ket: string; jenis: Benda['jenis']; atur: Record<string, unknown>; oleh: string; bolehHapus?: boolean };

export const R2_AWAL = { aktif: true, p: 6, l: 6, t: 3, lantai: 'karpet' as const, pintu: true };

/** Sidik isi desain (ruangan + benda + nama) - pembeda "ada perubahan belum disimpan". */
export const ambilKunci = (r: Ruang, b: Benda[], n: string) => JSON.stringify({ r, b, n });


/** Seluruh keadaan Desain 3D - diteruskan ke hook engine & panel. */
export type KeadaanDesain = ReturnType<typeof useKeadaanDesain>;

export function useKeadaanDesain() {
  //  Kanvas awal: default Admin yang diingat perangkat ini (simpan/templateAwal.ts), selain itu bawaan
  //  pabrikan. Dibaca sekali saat dipasang - komponen ini hanya dirender di peramban (ssr: false).
  const [ingatanAwal] = useState(bacaIngatanAwal);
  const isiAwal = isiDariIngatan(ingatanAwal);
  const [ruang, setRuang] = useState<Ruang>(() => (isiAwal ? { ...RUANG_AWAL, ...isiAwal.ruang } : RUANG_AWAL));
  const [benda, setBenda] = useState<Benda[]>(() => (isiAwal ? isiAwal.benda : contohAwal(RUANG_AWAL)));
  const [pilih, setPilih] = useState<string | null>(null);
  /** Pilih banyak: benda lain yang ikut terpilih bersama `pilih` (utama). Shift / Ctrl + klik, atau mode pilih banyak (HP). */
  const [pilihLain, setPilihLain] = useState<string[]>([]);
  const [modeBanyak, setModeBanyak] = useState(false);
  /** Kanvas layar penuh (menutupi seluruh jendela, fokus ke desain) - Esc / tombol untuk kembali. */
  const [layarPenuh, setLayarPenuh] = useState(false);
  //  Salinan terbaru untuk handler engine (klik kanvas, gizmo) yang dipasang sekali.
  const pilihRef = useRef(pilih), pilihLainRef = useRef(pilihLain), modeBanyakRef = useRef(modeBanyak);
  useEffect(() => { pilihRef.current = pilih; pilihLainRef.current = pilihLain; modeBanyakRef.current = modeBanyak; }, [pilih, pilihLain, modeBanyak]);
  /** true = perubahan `pilih` berikut berasal dari toggle pilih banyak (pilihan lain tidak direset). */
  const dariToggle = useRef(false);
  /** Pasang pilihan banyak sekaligus (utama + lain) tanpa direset efek di bawah. */
  const setPilihan = (utama: string | null, lain: string[]) => {
    if (utama !== pilihRef.current) dariToggle.current = true;
    setPilih(utama); setPilihLain(lain);
  };
  //  Pilih satu benda dari tempat lain (klik biasa, tambah benda, daftar) = pilihan lain dilepas.
  useEffect(() => {
    if (dariToggle.current) { dariToggle.current = false; return; }
    setPilihLain(l => (l.length ? [] : l));
  }, [pilih]);
  const [panel, setPanel] = useState(false);
  const [modal, setModal] = useState<'simpan' | 'buka' | null>(null);
  //  Panel kanan (menempel di samping kanvas, tidak menutupi tampilan 3D). Satu panel
  //  pada satu waktu: Tambah / Ruangan / Daftar benda, atau Atur benda terpilih (`panel`).
  const [sisi, setSisi] = useState<'kategori' | 'tambah' | 'ruang' | 'daftar' | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const bukaSisi = (k: 'kategori' | 'tambah' | 'ruang' | 'daftar') => { setPanel(false); setSisi(v => (v === k ? null : k)); };
  const [targetRuang, setTargetRuang] = useState<string>('0');
  const [tampilan, setTampilan] = useState<'3d' | 'atas' | 'kursi'>('3d');
  const [modeGizmo, setModeGizmo] = useState<'translate' | 'rotate'>('translate');
  const [ukur, setUkur] = useState(true);
  //  Garis ukuran display (lebar & tinggi dalam mm, garis merah ala gambar kerja).
  const [garisUkur, setGarisUkur] = useState(true);
  //  Label nama produk di atas tiap benda (benda kembar cukup satu label + jumlah).
  //  Layar HP sempit: label produk mulai mati supaya kanvas tidak tertutup (tetap bisa dinyalakan).
  const [labelProduk, setLabelProduk] = useState(() => typeof window === 'undefined' || window.innerWidth >= 640);
  /** Ponsel: tombol tampilan dilipat ke satu tombol "Tampilan". */
  const [chipBuka, setChipBuka] = useState(false);
  //  Target kontras gambar proyeksi (ANSI/INFOCOMM 3M-2011): 15:1 = presentasi / rapat.
  const [targetKontras, setTargetKontras] = useState(15);
  const [kerucut, setKerucut] = useState(true);
  const [sinar, setSinar] = useState(true);
  /** Area blending antar proyektor (lebar cm & persen) - label & zona di kanvas, panel proyektor, lembar cetak. */
  const [tampilBlending, setTampilBlending] = useState(true);
  /** Kartu keterangan detail blending (persen & piksel) - garis ukur & angka cm tetap ikut tampilBlending. */
  const [detailBlending, setDetailBlending] = useState(true);
  /** Sinar proyektor ditampilkan sebagai pola grid (test pattern) - seperti mode grid simulator pabrikan. */
  const [gridSinar, setGridSinar] = useState(false);
  /** Hasil hitung blending terakhir dari kanvas (mesin/alatBantu.ts). */
  const [infoBlending, setInfoBlending] = useState<Blending[]>([]);
  /** Seret satu jari / klik kiri: putar kamera atau geser bidang. */
  const [modeSeret, setModeSeret] = useState<'putar' | 'geser'>('putar');
  const [menuSudut, setMenuSudut] = useState(false);
  const [fokusRuang, setFokusRuang] = useState<'semua' | number>('semua');
  const [gantiIsi, setGantiIsi] = useState(false);
  const [pesan, setPesan] = useState('');
  //  Akun pimpinan: melihat & mengekspor saja, tidak menyimpan ke server (server juga menolak).
  const [hanyaLihat] = useState(() => isPimpinan(getSession()));
  //  Konfirmasi di dalam aplikasi (bukan dialog bawaan browser yang menampilkan alamat situs).
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const sudutRef = useRef<Sudut | 'kursi'>('iso');
  const kameraSiap = useRef(false);
  //  Pengaturan analisis tampilan tersimpan bersama desain (ruang.analisis), jadi ikut
  //  terbuka lagi dari server/laptop dan ikut undo/redo.
  const an = analisisDari(ruang);
  const jenisPandang = an.jenis, faktorCustom = an.faktor, sudutNyaman = an.sudut;
  const setAnalisis = (x: Partial<NonNullable<Ruang['analisis']>>) => setRuang(r => ({ ...r, analisis: { ...analisisDari(r), ...x } }));
  const setJenisPandang = (v: JenisPandang | 'custom') => setAnalisis({ jenis: v });
  const setFaktorCustom = (v: number) => setAnalisis({ faktor: v });
  const setSudutNyaman = (v: number) => setAnalisis({ sudut: v });
  /** Tampilkan jangkauan suara semua speaker (per speaker: Benda.tampilJangkauan). */
  const [jangkau, setJangkau] = useState(false);
  /** Garis share nirkabel (dongle / HP / tablet -> display) di kanvas. */
  const [tampilShare, setTampilShare] = useState(true);
  /** Jalur kabel perangkat -> rack digambar di kanvas. */
  const [tampilKabel, setTampilKabel] = useState(false);
  /** Kabel power ke stop kontak terdekat (opsional - menambah banyak garis). */
  const [kabelPower, setKabelPower] = useState(false);
  const kabel = useMemo(() => jalurKabel(benda, ruang, { power: kabelPower }), [benda, ruang, kabelPower]);
  /** Legend kabel tampil (di layar, PNG & cetak) hanya saat jalur kabel dicentang. */
  const legendaKabel = tampilKabel && kabel.length > 0 ? golonganDipakai(kabel) : null;
  /** Bayangan lembut display di dinding/lantai + cahaya layar ke lantai. */
  const [bayangan, setBayangan] = useState(true);
  /** Katalog "Produk saya" (template tim di server). */
  const [produkTim, setProdukTim] = useState<{ daftar: ProdukTimC[]; bolehTambah: boolean } | null>(null);
  const [galatProduk, setGalatProduk] = useState('');
  const [cariProduk, setCariProduk] = useState('');
  /** Set ruang kelas: panel pilihan & isiannya (kosong = otomatis dari ukuran ruang). */
  const [bukaKelas, setBukaKelas] = useState(false);
  const [opsiKelas, setOpsiKelas] = useState<OpsiKelas>({});
  const faktorPandang = jenisPandang === 'custom' ? faktorCustom : FAKTOR_PANDANG[jenisPandang];
  //  Nama & asal mengikuti pasangKategoriYa() supaya kanvas awal dari ingatan sama persis dengan
  //  kanvas yang dipasang dari server.
  const [namaDesain, setNamaDesain] = useState(() => (isiAwal ? `${isiAwal.nama} (salinan)` : 'Ruang Meeting'));
  /**
   * Dari mana desain di kanvas berasal, untuk penanda "berkas yang sedang dibuka":
   * baru = belum pernah disimpan; laptop = dibuka dari/disimpan ke .glb; lokal = salinan di perangkat ini.
   * Desain server dikenali dari `desainAktif`. `dasar` = sidik isi saat terakhir dibuka/disimpan.
   */
  const [asal, setAsal] = useState<{ jenis: 'baru' | 'laptop' | 'lokal' | 'template'; nama?: string }>(() => (isiAwal
    ? { jenis: 'template', nama: `${KATEGORI_RUANG.find(k => k.id === KATEGORI_AWAL)?.judul ?? isiAwal.nama} · default Admin` }
    : { jenis: 'baru' }));
  const [dasar, setDasar] = useState<string | null>(null);
  const [tersimpan, setTersimpan] = useState<{ nama: string; ruang: Ruang; benda: Benda[] }[]>([]);
  /** Desain tim di server (/api/tools-team/desain) & desain server yang sedang dibuka. */
  const [daftarTim, setDaftarTim] = useState<DesainTim[] | null>(null);
  /** versi = versi TERBARU di server saat dibuka (dikirim balik saat menyimpan untuk cek konflik). */
  const [desainAktif, setDesainAktif] = useState<{ id: string; bolehUbah: boolean; versi: number } | null>(null);
  /** Sedang melihat versi lama (mis. dibuka dari tautan Request Design). */
  const [lihatVersi, setLihatVersi] = useState<{ versi: number; terbaru: number } | null>(null);
  const [statusSimpan, setStatusSimpan] = useState<{ teks: string; nada: 'ok' | 'galat' | 'info' } | null>(null);
  const [sibukSimpan, setSibukSimpan] = useState(false);
  const [siap, setSiap] = useState(false);
  const [galat, setGalat] = useState('');
  const wadahRef = useRef<HTMLDivElement>(null);
  const mesin = useRef<Mesin | null>(null);
  /** Kamera dipas ke ruangan baru setelah template kategori dipasang. */
  const pasSetelahTemplate = useRef(false);
  /** Tekstur bayangan & cahaya (dibuat sekali, dipakai ulang tiap pembaruan). */
  const teksturBayang = useRef<{ bayang: T.Texture; cahaya: T.Texture } | null>(null);
  const gambarLayar = useRef(new Map<string, T.Texture>());
  /** Tekstur lantai / dinding (simpan/teksturRuang.ts): kunci -> data URL (ikut disimpan) & gambar termuat (bangunRuangan). */
  const sumberTekstur = useRef(new Map<string, string>());
  const gambarTekstur = useRef(new Map<string, HTMLImageElement>());
  const [versiTekstur, setVersiTekstur] = useState(0);
  /** Presisi (inti/presisi.ts): snap grid geser / putar - diingat per perangkat. */
  const [snap, setSnapMentah] = useState<Snap>(() => { try { return snapSah(JSON.parse(localStorage.getItem('wm_desain3d_snap') ?? 'null')); } catch { return snapSah(null); } });
  const setSnap = (s: Snap) => { setSnapMentah(s); try { localStorage.setItem('wm_desain3d_snap', JSON.stringify(s)); } catch { /* abaikan */ } };
  /** Alat kanvas: pilih benda (bawaan) atau penggaris; titik pertama penggaris yang sedang dibuat. */
  const [alatKanvas, setAlatKanvas] = useState<'pilih' | 'ukur'>('pilih');
  const [titikUkur, setTitikUkur] = useState<Titik | null>(null);
  /** Dipanggil engine saat kanvas diklik dalam mode penggaris (diisi useAlatKanvas). */
  const klikUkurRef = useRef<((p: Titik) => void) | null>(null);
  const modelImpor = useRef(new Map<string, T.Object3D>());
  const [versiGambar, setVersiGambar] = useState(0);
  const inputGambar = useRef<HTMLInputElement>(null);
  const inputModel = useRef<HTMLInputElement>(null);
  const inputLaptop = useRef<HTMLInputElement>(null);
  const [menuPusat, setMenuPusat] = useState(false);
  const bendaRef = useRef(benda); bendaRef.current = benda;
  const ruangRef = useRef(ruang); ruangRef.current = ruang;

  //  Undo / redo seluruh desain (ruangan + benda).
  const potret = useMemo(() => ({ ruang, benda }), [ruang, benda]);
  const riwayat = useRiwayat(potret, v => { ruangRef.current = v.ruang; setRuang(v.ruang); setBenda(v.benda); });

  const kunciKini = useMemo(() => ambilKunci(ruang, benda, namaDesain), [ruang, benda, namaDesain]);
  const adaPerubahan = dasar !== null && kunciKini !== dasar;

  const kotakRuang = useMemo(() => daftarRuang(ruang), [ruang]);
  /** Objek dari luar: berkas 3D (desain3d/impor/berkas3d) & siluet dari gambar (ModalObjekGambar). */
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
    try { const s = localStorage.getItem(KUNCI_SIMPAN); if (s) setTersimpan(JSON.parse(s)); } catch { /* abaikan */ }
  }, []);
  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(''), 4000);
    return () => clearTimeout(t);
  }, [pesan]);

  // ── Analisis tampilan (penonton dihitung per ruang) ──
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
      return { d, ri, jumlah: data.length, terjauh, terjauhP, terdekat, sudutMaks, tinggiPerlu, cukup: d.h >= tinggiPerlu };
    });
  }, [benda, faktorPandang, ruang]);
  const terpilih = benda.find(b => b.id === pilih) ?? null;
  const gantiBenda = (baru: Benda) => setBenda(bs => bs.map(b => (b.id === baru.id ? baru : b)));
  const duaRuang = kotakRuang.length > 1;
  const adaProyektor = benda.some(b => b.jenis === 'proyektor');
  const jumlahProyektor = benda.filter(b => b.jenis === 'proyektor').length;

  return { snap, setSnap, alatKanvas, setAlatKanvas, titikUkur, setTitikUkur, klikUkurRef, ingatanAwal, sumberTekstur, gambarTekstur, versiTekstur, setVersiTekstur, setPilihan, pilihLain, setPilihLain, modeBanyak, setModeBanyak, layarPenuh, setLayarPenuh, pilihRef, pilihLainRef, modeBanyakRef, dariToggle, tampilShare, setTampilShare, adaPerubahan, adaProyektor, detailBlending, gridSinar, infoBlending, jumlahProyektor, setDetailBlending, setGridSinar, setInfoBlending, setTampilBlending, tampilBlending, an, analisis, asal, asideRef, batas, bayangan, benda, bendaRef, bukaKelas, bukaSisi, cariProduk, chipBuka, daftarTim, dasar, desainAktif, duaRuang, faktorCustom, faktorPandang, fokusRuang, galat, galatProduk, gambarLayar, gantiBenda, gantiIsi, garisUkur, hanyaLihat, impor, inputGambar, inputLaptop, inputModel, jangkau, jenisPandang, kabel, kabelPower, kameraSiap, kerucut, konfirmasi, kotakRuang, kunciKini, labelProduk, legendaKabel, lihatVersi, menuPusat, menuSudut, mesin, modal, modeGizmo, modeSeret, modelImpor, namaDesain, objekGambar, opsiKelas, panel, pasSetelahTemplate, pesan, pilih, plafonDi, potret, produkTim, riwayat, ruang, ruangRef, setAnalisis, setAsal, setBayangan, setBenda, setBukaKelas, setCariProduk, setChipBuka, setDaftarTim, setDasar, setDesainAktif, setFaktorCustom, setFokusRuang, setGalat, setGalatProduk, setGantiIsi, setGarisUkur, setJangkau, setJenisPandang, setKabelPower, setKerucut, setKonfirmasi, setLabelProduk, setLihatVersi, setMenuPusat, setMenuSudut, setModal, setModeGizmo, setModeSeret, setNamaDesain, setObjekGambar, setOpsiKelas, setPanel, setPesan, setPilih, setProdukTim, setRuang, setSiap, setSibukSimpan, setSinar, setSisi, setStatusSimpan, setSudutNyaman, setTampilKabel, setTampilan, setTargetKontras, setTargetRuang, setTersimpan, setUkur, setVersiGambar, siap, sibukSimpan, sinar, sisi, statusSimpan, sudutNyaman, sudutRef, tampilKabel, tampilan, targetKontras, targetRuang, teksturBayang, terpilih, tersimpan, ukur, versiGambar, wadahRef };
}
