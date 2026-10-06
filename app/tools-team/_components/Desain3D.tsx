'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type * as T from 'three';
import type { OrbitControls as KontrolOrbit } from 'three/examples/jsm/controls/OrbitControls.js';
import { AlignCenterVertical, LayoutTemplate, Copy, CopyPlus, Crosshair, Settings2, Trash2, FolderOpen, HardDriveDownload, Maximize2, Move, Pencil, Redo2, Rotate3d, RotateCcw, RotateCw, Undo2, Video, ZoomIn, ZoomOut } from 'lucide-react';
import { bacaDesainGLB, dataDesainFile, namaFileDesain, KUNCI_DESAIN } from './desain3d/file-glb';
import { useRiwayat } from './riwayat';
import { FAKTOR_PANDANG, type JenisPandang } from '@/lib/av-hitung';
import { Angka, Pilih, Segmen, Kartu, Nilai, TombolSalin, Catatan, f } from './ui';
import { Ikon } from '@/components/shared/Ikon';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';
import {
  type Benda, type Ruang, type Kotak, type ItemKatalog, BISA_PASANG, pasangDari, CELAH_PASANG, DISPLAY, BISA_TEMPEL, KATALOG, idBaru, bendaBaru, contohAwal,
  daftarRuang, ruangDari, titikPenonton, tandaBentuk, teksturLantai, teksturKonten,
  salinKeRuang, salinIsi, sesuaikanUkuranRuang, pusatkanIsi, type SumbuPusat, pintuSekat, jendelaSekat, ukuranPintu, sambungan, sambunganKe, MAKS_RUANG, type RuangSambung, warnaSah, sinarProyektor, layarTerdekat, proyektorKeLayar, tiltKeLayar, throwRatioDari, tiltDari,
  analisisDari, bukaanDinding, sisiLuar, panjangDinding, BUKAAN_AWAL, type Bukaan, type SisiDinding, type OpsiKelas, setRuangKelas, ukuranSetKelas, LABEL,
  sebaranSpeaker, sebaranVSpeaker, jangkauanDari, cakupanSpeakerPlafon, TINGGI_DENGAR, tipeSpeakerDari, berkasLineArray, modulLA,
  arahProyektor, offsetLensaDari, geserLensaDari, zoomLensa, lumenDari,
  aturNyalaLampu, nyalaLampu, kontrasProyektor, TARGET_KONTRAS, LUX_PRESET, luxBidangKerja, lumenLampu, sudutLampuDari, SPEK_LAMPU } from './desain3d/model';
import { svgElevasiRak } from './desain3d/rak';
import { buatModel, sesuaikanTinggi, teksturDindingAksen } from './desain3d/bangun';
import { templateRuang, KATEGORI_RUANG, type KategoriRuang } from './desain3d/template';
import { jalurKabel, rekapKabel, HDMI_MAKS } from './desain3d/kabel';
import { PanelBenda } from './desain3d/PanelBenda';
import { PanelRuang } from './desain3d/PanelRuang';
import { ModalBukaDesain, JUDUL_SISI } from './desain3d/ModalBuka';
import { bukaCetak, esc, namaBerkas, unduhKanvasPNG, unduhLembarPNG, unduhUrl, type Lembar } from './cetak';
import { getSession } from '@/lib/auth';
import { isPimpinan } from '@/lib/pimpinan';

/**
 * Desain 3D Ruang AV - dibangun di atas three.js (threejs.org) + add-on resminya:
 *   - RoomEnvironment + PMREM  : pencahayaan PBR realistis tanpa berkas HDR luar
 *   - bayangan & tone mapping   : DirectionalLight shadow, ACES Filmic
 *   - OrbitControls             : putar / zoom (ke titik kursor, pinch) / geser bidang lantai
 *                                 + tombol arah pandang, zoom, putar 45°, fokus dengan animasi
 *   - TransformControls         : gizmo geser (X/Z + naik-turun) & putar benda terpilih
 *   - CSS2DRenderer             : label ukuran & jarak di ruang 3D
 *   - GLTFLoader / GLTFExporter : impor model produk (.glb) & ekspor desain (.glb)
 * Model benda prosedural (desain3d/model.ts); maksimal 2 ruang bersebelahan.
 * three.js dimuat dinamis hanya saat alat ini dibuka.
 */

const KUNCI_SIMPAN = 'wm_desain3d';

interface DesainTim {
  id: string; nama: string; versi: number; jumlah_benda: number; dibuat_oleh_nama: string; diubah_oleh_nama: string;
  updated_at: string; ruang: Ruang | null; bolehUbah: boolean;
}
const RUANG_AWAL: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null };
const API_PRODUK = '/api/tools-team/produk';
/** Template "Produk saya" seperti dikirim /api/tools-team/produk. */
type ProdukTimC = { id: string; label: string; ket: string; jenis: Benda['jenis']; atur: Record<string, unknown>; oleh: string; bolehHapus?: boolean };
const R2_AWAL = { aktif: true, p: 6, l: 6, t: 3, lantai: 'karpet' as const, pintu: true };

type Mesin = {
  THREE: typeof T; renderer: T.WebGLRenderer; labelRenderer: { render: (s: T.Scene, c: T.Camera) => void; setSize: (w: number, h: number) => void; domElement: HTMLElement };
  scene: T.Scene; kamera: T.PerspectiveCamera;
  orbit: KontrolOrbit;
  /** Animasi kamera yang sedang berjalan (tombol arah pandang / fokus). */ terbang: Terbang | null;
  gizmo: T.Object3D & { attach: (o: T.Object3D) => void; detach: () => void; setMode: (m: 'translate' | 'rotate') => void; showX: boolean; showY: boolean; showZ: boolean; dragging: boolean; dispose: () => void; object?: T.Object3D };
  grupRuang: T.Group; grupBenda: T.Group; grupBantu: T.Group;
  /** Bayangan lembut di dinding/lantai & cahaya layar (lihat efek "Bayangan & cahaya"). */ grupBayang: T.Group;
  /** Lampu adegan - intensitasnya mengikuti tingkat cahaya ruangan (terang/redup/gelap). */ lampu: { matahari: T.DirectionalLight; langit: T.HemisphereLight };
  CSS2DObject: new (el: HTMLElement) => T.Object3D;
  GLTFExporter: new () => { parse: (o: T.Object3D, ok: (r: ArrayBuffer | object) => void, err: (e: unknown) => void, opsi: object) => void };
  GLTFLoader: new () => { parse: (data: ArrayBuffer, path: string, ok: (g: { scene: T.Group }) => void, err: (e: unknown) => void) => void };
  cache: Map<string, { obj: T.Object3D; tanda: string }>;
};

type Sisi = 'depan' | 'belakang' | 'kiri' | 'kanan';

/** Animasi kamera: titik pusat bergeser lurus, kamera mengorbit (sferis) supaya tidak menembus ruangan. */
type Terbang = { t0: T.Vector3; t1: T.Vector3; s0: T.Spherical; s1: T.Spherical; mulai: number; durasi: number };

type Sudut = 'iso' | 'atas' | 'depan' | 'belakang' | 'kiri' | 'kanan';
/** Arah dari titik pusat ke kamera. "Depan" = menghadap dinding depan (tempat display), dst. */
const ARAH_SUDUT: Record<Sudut, [number, number, number]> = {
  iso: [0.2, 0.75, 0.95], atas: [0, 1, 0.002],
  depan: [0, 0.38, 1], belakang: [0, 0.38, -1], kiri: [1, 0.38, 0], kanan: [-1, 0.38, 0],
};

/** Tampak untuk ekspor PNG & lembar cetak. */
const TAMPAK: { arah: 'sekarang' | Sudut; judul: string }[] = [
  { arah: 'sekarang', judul: 'Perspektif (sudut sekarang)' }, { arah: 'atas', judul: 'Denah dari atas' },
  { arah: 'depan', judul: 'Tampak depan' }, { arah: 'kiri', judul: 'Tampak samping' },
];

/**
 * Label CSS2D (ukuran, jarak, nama proyektor, dll.) digambar ke kanvas foto di posisi yang
 * sama dengan di layar - label HTML tidak ikut tertangkap oleh WebGL. Gaya diambil dari
 * elemennya sendiri (warna, huruf), diperbesar sesuai resolusi foto.
 */
/**
 * Label produk tidak boleh bertumpuk: label yang menabrak label lain (urutan = prioritas) disembunyikan
 * sementara, dan muncul lagi saat kamera di-zoom / diputar sampai ada ruang.
 */
function hindariTumpuk(wadah: HTMLElement) {
  const ambil: DOMRect[] = [];
  wadah.querySelectorAll<HTMLElement>('[data-produk]').forEach(el => {
    if (el.style.display === 'none') return;
    el.style.visibility = 'visible';
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const tabrak = ambil.some(a => r.left < a.right + 2 && r.right > a.left - 2 && r.top < a.bottom + 1 && r.bottom > a.top - 1);
    if (tabrak) el.style.visibility = 'hidden'; else ambil.push(r);
  });
}

function gambarLabel(m: Mesin, g: CanvasRenderingContext2D, w: number, h: number) {
  //  Sedikit lebih besar dari di layar supaya tetap terbaca saat gambar diperkecil / dicetak.
  const skala = (w / Math.max(1, m.renderer.domElement.clientWidth || w)) * 1.35;
  const v = new m.THREE.Vector3();
  m.scene.updateMatrixWorld();
  m.scene.traverseVisible(o => {
    const el = (o as { element?: HTMLElement }).element;
    if (!(o as { isCSS2DObject?: boolean }).isCSS2DObject || !el || el.style.display === 'none' || el.style.visibility === 'hidden') return;
    const teks = (el.innerText || el.textContent || '').trim(); if (!teks) return;
    v.setFromMatrixPosition(o.matrixWorld).project(m.kamera);
    if (v.z < -1 || v.z > 1) return;
    const x = ((v.x + 1) / 2) * w, y = ((1 - v.y) / 2) * h;
    const cs = getComputedStyle(el);
    const uk = (parseFloat(cs.fontSize) || 11) * skala;
    g.font = `${cs.fontWeight || '600'} ${uk}px ${cs.fontFamily || 'system-ui, sans-serif'}`;
    const baris = teks.split('\n').map(b => b.trim()).filter(Boolean);
    const lebar = Math.max(...baris.map(b => g.measureText(b).width));
    const padX = 6 * skala, tb = uk * 1.3, kw = lebar + padX * 2, kh = baris.length * tb + 4 * skala;
    const tegak = (cs.writingMode || '').startsWith('vertical');
    //  Label produk menempel: digeser setengah tinggi (data-dy -1 = di atas titik, 1 = di bawah).
    const dy = Number(el.dataset.dy || 0) * (kh / 2 + 1 * skala);
    const latar = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent' ? cs.backgroundColor : 'rgba(15,23,42,0.85)';
    g.save();
    g.translate(x, y + dy);
    if (tegak) g.rotate(Math.PI / 2);
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 3 * skala; g.shadowOffsetY = 1 * skala;
    g.fillStyle = latar;
    g.beginPath();
    if (typeof g.roundRect === 'function') g.roundRect(-kw / 2, -kh / 2, kw, kh, 6 * skala); else g.rect(-kw / 2, -kh / 2, kw, kh);
    g.fill();
    g.restore();
    g.fillStyle = cs.color || '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    baris.forEach((b, i) => g.fillText(b, 0, -kh / 2 + 2 * skala + tb * (i + 0.5)));
    g.restore();
  });
}

/**
 * Posisi kamera searah `arah` dari `target` yang memuat seluruh `kotak` di
 * kanvas. Tepat untuk perspektif: tiap pojok kotak harus masuk kerucut
 * pandang, yaitu jarak >= (kedalaman pojok ke arah kamera) + (simpangan
 * kanan/atas pojok ÷ tan setengah FOV).
 */
function posisiPas(m: Mesin, target: T.Vector3, arah: T.Vector3, kotak: T.Box3, longgar = 1.06) {
  const { THREE, kamera } = m;
  const maju = arah.clone().negate();
  const kanan = new THREE.Vector3().crossVectors(maju, kamera.up).normalize();
  const atas = new THREE.Vector3().crossVectors(kanan, maju).normalize();
  const tanV = Math.tan((kamera.fov * Math.PI) / 360), tanH = tanV * Math.max(0.3, kamera.aspect);
  let jarak = 0;
  for (const x of [kotak.min.x, kotak.max.x]) for (const y of [kotak.min.y, kotak.max.y]) for (const z of [kotak.min.z, kotak.max.z]) {
    const v = new THREE.Vector3(x, y, z).sub(target);
    jarak = Math.max(jarak, v.dot(arah) + Math.max(Math.abs(v.dot(kanan)) / tanH, Math.abs(v.dot(atas)) / tanV) * longgar);
  }
  return target.clone().addScaledVector(arah, Math.max(1, jarak));
}

/** Pindahkan kamera (beranimasi, kecuali `langsung`). */
function terbangKe(m: Mesin, pos: T.Vector3, target: T.Vector3, langsung = false) {
  if (langsung) {
    m.terbang = null; m.kamera.position.copy(pos); m.orbit.target.copy(target); m.orbit.update();
    return;
  }
  const { Spherical } = m.THREE;
  m.terbang = {
    t0: m.orbit.target.clone(), t1: target.clone(),
    s0: new Spherical().setFromVector3(m.kamera.position.clone().sub(m.orbit.target)),
    s1: new Spherical().setFromVector3(pos.clone().sub(target)),
    mulai: performance.now(), durasi: 600,
  };
}

/** Tombol bulat kontrol kamera di atas kanvas. */
function TombolNav({ judul, onClick, aktif, children }: { judul: string; onClick: () => void; aktif?: boolean; children: ReactNode }) {
  return (
    <button type="button" title={judul} aria-label={judul} aria-pressed={aktif} onClick={onClick}
      className={`w-9 h-9 grid place-items-center ${aktif ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'}`}>
      {children}
    </button>
  );
}

/** Batas dunia (gabungan ruang). */
function batasDunia(r: Ruang) {
  const k = daftarRuang(r);
  return { x: k.reduce((m, x) => Math.max(m, x.x0 + x.p), 0), z: k.reduce((m, x) => Math.max(m, x.l), 0), t: k.reduce((m, x) => Math.max(m, x.t), 0) };
}

/** Sidik isi desain (ruangan + benda + nama) - pembeda "ada perubahan belum disimpan". */
const ambilKunci = (r: Ruang, b: Benda[], n: string) => JSON.stringify({ r, b, n });

export default function Desain3D() {
  const [ruang, setRuang] = useState<Ruang>(RUANG_AWAL);
  const [benda, setBenda] = useState<Benda[]>(() => contohAwal(RUANG_AWAL));
  const [pilih, setPilih] = useState<string | null>(null);
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
  /** Jalur kabel perangkat -> rack digambar di kanvas. */
  const [tampilKabel, setTampilKabel] = useState(false);
  const kabel = useMemo(() => jalurKabel(benda, ruang), [benda, ruang]);
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
  const [namaDesain, setNamaDesain] = useState('Ruang Meeting');
  /**
   * Dari mana desain di kanvas berasal, untuk penanda "berkas yang sedang dibuka":
   * baru = belum pernah disimpan; laptop = dibuka dari/disimpan ke .glb; lokal = salinan di perangkat ini.
   * Desain server dikenali dari `desainAktif`. `dasar` = sidik isi saat terakhir dibuka/disimpan.
   */
  const [asal, setAsal] = useState<{ jenis: 'baru' | 'laptop' | 'lokal' | 'template'; nama?: string }>({ jenis: 'baru' });
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

  // ── Inisialisasi (sekali) ──
  useEffect(() => {
    let hidup = true;
    let bersihkan = () => {};
    (async () => {
      try {
        const THREE = await import('three');
        const [{ OrbitControls }, { TransformControls }, { RoomEnvironment }, { CSS2DRenderer, CSS2DObject }, { GLTFExporter }, { GLTFLoader }] = await Promise.all([
          import('three/examples/jsm/controls/OrbitControls.js'),
          import('three/examples/jsm/controls/TransformControls.js'),
          import('three/examples/jsm/environments/RoomEnvironment.js'),
          import('three/examples/jsm/renderers/CSS2DRenderer.js'),
          import('three/examples/jsm/exporters/GLTFExporter.js'),
          import('three/examples/jsm/loaders/GLTFLoader.js'),
        ]);
        const wadah = wadahRef.current;
        if (!hidup || !wadah) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        renderer.setClearColor(0xe2e8f0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.localClippingEnabled = true;
        renderer.domElement.style.touchAction = 'none';
        //  setSize(..., false) tidak menyetel ukuran CSS: tanpa ini kanvas tampil seukuran buffer (w x dpr)
        //  sehingga di HP (dpr 2-3) yang terlihat hanya seperempat kiri-atas tampilan 3D.
        renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
        wadah.appendChild(renderer.domElement);

        const labelRenderer = new CSS2DRenderer();
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.inset = '0';
        labelRenderer.domElement.style.pointerEvents = 'none';
        wadah.appendChild(labelRenderer.domElement);

        const scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        const matahari = new THREE.DirectionalLight(0xffffff, 1.6);
        matahari.position.set(6, 10, 8);
        matahari.target.position.set(6, 0, 3);
        matahari.castShadow = true;
        matahari.shadow.mapSize.set(2048, 2048);
        matahari.shadow.camera.left = -16; matahari.shadow.camera.right = 16;
        matahari.shadow.camera.top = 16; matahari.shadow.camera.bottom = -16;
        matahari.shadow.bias = -0.0005;
        scene.add(matahari, matahari.target);
        const langit = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 0.35);
        scene.add(langit);

        const kamera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
        const orbit = new OrbitControls(kamera, renderer.domElement);
        orbit.enableDamping = true; orbit.dampingFactor = 0.12;
        orbit.maxPolarAngle = Math.PI / 2 - 0.02;
        //  Geser = menggeser bidang lantai (seperti peta), bukan bidang layar;
        //  roda/pinch zoom menuju titik di bawah kursor/jari, bukan ke tengah.
        orbit.screenSpacePanning = false;
        orbit.zoomToCursor = true;
        orbit.minDistance = 0.4; orbit.maxDistance = 80;
        orbit.addEventListener('start', () => { if (mesin.current) mesin.current.terbang = null; });

        const gizmo = new TransformControls(kamera, renderer.domElement);
        gizmo.setSize(0.8);
        gizmo.addEventListener('dragging-changed', (e: { value: unknown }) => { orbit.enabled = !e.value; });
        gizmo.addEventListener('objectChange', () => {
          const o = gizmo.object; if (!o?.userData.id) return;
          const r = ruangRef.current;
          const bt = batasDunia(r);
          const b0 = bendaRef.current.find(b => b.id === o.userData.id); if (!b0) return;
          const x = Math.round(Math.min(bt.x, Math.max(0, o.position.x)) * 100) / 100;
          const z = Math.round(Math.min(bt.z, Math.max(0, o.position.z)) * 100) / 100;
          const plafon = daftarRuang(r)[ruangDari(r, x)]?.t ?? r.t;
          const elev = Math.round(Math.min(Math.max(0, plafon - b0.h), Math.max(0, o.position.y)) * 100) / 100;
          const rot = ((Math.round((o.rotation.y * 180) / Math.PI) % 360) + 360) % 360;
          o.position.set(x, elev, z);
          sesuaikanTinggi(o, { ...b0, elev }, plafon);
          setBenda(bs => bs.map(b => (b.id === o.userData.id ? { ...b, x, z, rot, elev } : b)));
        });
        scene.add(gizmo.getHelper ? gizmo.getHelper() : (gizmo as unknown as T.Object3D));

        const grupRuang = new THREE.Group(), grupBenda = new THREE.Group(), grupBantu = new THREE.Group(), grupBayang = new THREE.Group();
        scene.add(grupRuang, grupBenda, grupBantu, grupBayang);

        mesin.current = {
          THREE, renderer, labelRenderer, scene, kamera, orbit,
          gizmo: gizmo as unknown as Mesin['gizmo'], grupRuang, grupBenda, grupBantu, grupBayang, lampu: { matahari, langit },
          CSS2DObject: CSS2DObject as unknown as Mesin['CSS2DObject'],
          GLTFExporter: GLTFExporter as unknown as Mesin['GLTFExporter'],
          GLTFLoader: GLTFLoader as unknown as Mesin['GLTFLoader'],
          cache: new Map(),
          terbang: null,
        };

        const atur = () => {
          const w = wadah.clientWidth, h = wadah.clientHeight;
          renderer.setSize(w, h, false); labelRenderer.setSize(w, h);
          kamera.aspect = w / Math.max(1, h); kamera.updateProjectionMatrix();
        };
        const ro = new ResizeObserver(atur); ro.observe(wadah); atur();

        // Klik = pilih benda (bukan saat gizmo sedang diseret).
        const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2();
        let turunDi: { x: number; y: number } | null = null;
        let ketukLalu: { t: number; x: number; y: number } | null = null;
        const turun = (e: PointerEvent) => { turunDi = { x: e.clientX, y: e.clientY }; };
        const naik = (e: PointerEvent) => {
          if (!turunDi || Math.hypot(e.clientX - turunDi.x, e.clientY - turunDi.y) > 5 || (gizmo as unknown as { dragging: boolean }).dragging) { turunDi = null; return; }
          turunDi = null;
          const r = renderer.domElement.getBoundingClientRect();
          ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
          ray.setFromCamera(ptr, kamera);
          //  Kotak sorotan (garis) dikecualikan: ambang raycast garis 1 m membuat
          //  klik di dekat benda terpilih justru membatalkan pilihan.
          const kena = ray.intersectObjects(grupBenda.children.filter(o => !o.userData.sorot), true)[0];
          let o: T.Object3D | null = kena?.object ?? null;
          while (o && !o.userData.id) o = o.parent;
          setPilih((o?.userData.id as string | undefined) ?? null);
          //  Klik/ketuk dua kali: titik itu menjadi pusat putaran kamera (fokus).
          const kini = performance.now();
          const ganda = !!ketukLalu && kini - ketukLalu.t < 350 && Math.hypot(e.clientX - ketukLalu.x, e.clientY - ketukLalu.y) < 30;
          ketukLalu = ganda ? null : { t: kini, x: e.clientX, y: e.clientY };
          const titik = ganda ? (kena ?? ray.intersectObjects(grupRuang.children, true)[0])?.point : null;
          if (titik && mesin.current) {
            const target = titik.clone(); target.y = Math.min(2.2, Math.max(0.3, target.y));
            const jauh = kamera.position.clone().sub(orbit.target);
            jauh.setLength(Math.max(1.6, jauh.length() * 0.6));
            terbangKe(mesin.current, target.clone().add(jauh), target);
          }
        };
        renderer.domElement.addEventListener('pointerdown', turun);
        renderer.domElement.addEventListener('pointerup', naik);

        let jalan = true;
        const vT = new THREE.Vector3(), vS = new THREE.Vector3(), sf = new THREE.Spherical();
        let tumpukTerakhir = 0;
        const putar = () => {
          if (!jalan) return;
          const tb = mesin.current?.terbang;
          if (tb) {
            const k = Math.min(1, (performance.now() - tb.mulai) / tb.durasi);
            const e = 1 - (1 - k) ** 3;
            const dTheta = Math.atan2(Math.sin(tb.s1.theta - tb.s0.theta), Math.cos(tb.s1.theta - tb.s0.theta));
            vT.lerpVectors(tb.t0, tb.t1, e);
            sf.set(tb.s0.radius + (tb.s1.radius - tb.s0.radius) * e, tb.s0.phi + (tb.s1.phi - tb.s0.phi) * e, tb.s0.theta + dTheta * e);
            orbit.target.copy(vT);
            kamera.position.copy(vT).add(vS.setFromSpherical(sf));
            if (k >= 1 && mesin.current) mesin.current.terbang = null;
          } else {
            //  Titik pusat putaran dijaga di sekitar ruangan (geser tidak bisa "tersesat").
            const bt = batasDunia(ruangRef.current);
            vT.set(Math.min(bt.x + 1, Math.max(-1, orbit.target.x)), Math.min(bt.t, Math.max(0, orbit.target.y)), Math.min(bt.z + 1, Math.max(-1, orbit.target.z)));
            if (!vT.equals(orbit.target)) { vS.subVectors(vT, orbit.target); orbit.target.add(vS); kamera.position.add(vS); }
          }
          orbit.update(); renderer.render(scene, kamera); labelRenderer.render(scene, kamera);
          const kini = performance.now();
          if (kini - tumpukTerakhir > 150) { tumpukTerakhir = kini; hindariTumpuk(labelRenderer.domElement); }
          requestAnimationFrame(putar);
        };
        putar();
        setSiap(true);
        bersihkan = () => {
          jalan = false; ro.disconnect();
          //  BUKAN gizmo.dispose(): di three r169 TransformControls tidak lagi
          //  turunan Object3D, tapi dispose()-nya masih memanggil this.traverse
          //  -> TypeError saat komponen dibongkar, dan React menjatuhkan seluruh
          //  halaman ("Application error") setiap kali pengguna pindah dari
          //  Desain 3D ke alat lain. Cukup lepas event-nya; geometri helper
          //  gizmo ikut dibersihkan scene.traverse di bawah (helper ada di scene).
          try { gizmo.detach(); (gizmo as unknown as { disconnect?: () => void }).disconnect?.(); } catch { /* lanjut bersihkan */ }
          try { orbit.dispose(); } catch { /* lanjut bersihkan */ }
          pmrem.dispose();
          //  renderer.dispose() TIDAK melepas geometri, material, dan tekstur di
          //  dalam scene. Tanpa ini memori GPU bertambah tiap kali pengguna
          //  pindah alat (LED <-> 3D) karena komponen dibongkar-pasang.
          scene.traverse(o => {
            const mesh = o as T.Mesh;
            mesh.geometry?.dispose();
            const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
            for (const mat of mats) {
              for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
              mat.dispose();
            }
          });
          gambarLayar.current.forEach(t => t.dispose()); gambarLayar.current.clear();
          if (scene.environment instanceof THREE.Texture) scene.environment.dispose();
          renderer.dispose();
          renderer.domElement.remove(); labelRenderer.domElement.remove();
        };
      } catch (e) {
        setGalat('Perangkat/peramban ini tidak mendukung WebGL untuk tampilan 3D. ' + ((e as Error).message ?? ''));
      }
    })();
    return () => { hidup = false; bersihkan(); };
  }, []);

  // ── Mode seret: satu jari/klik kiri memutar atau menggeser; dua jari selalu pinch-zoom ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const { MOUSE, TOUCH } = m.THREE;
    const geser = modeSeret === 'geser';
    m.orbit.mouseButtons = { LEFT: geser ? MOUSE.PAN : MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: geser ? MOUSE.ROTATE : MOUSE.PAN };
    m.orbit.touches = { ONE: geser ? TOUCH.PAN : TOUCH.ROTATE, TWO: geser ? TOUCH.DOLLY_ROTATE : TOUCH.DOLLY_PAN };
  }, [modeSeret, siap]);

  // ── Ruangan: lantai bertekstur + 4 dinding per ruang ──
  //  Dinding hanya terlihat dari sisi dalam (FrontSide), jadi dinding yang
  //  membelakangi kamera otomatis "tembus" seperti denah rumah boneka.
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const { THREE, grupRuang } = m;
    //  Lepas geometri, material & tekstur lantai lama (ukuran ruang bisa berubah tiap ketukan).
    grupRuang.traverse(o => {
      const mesh = o as T.Mesh; mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const mt of mats) { for (const v of Object.values(mt)) if (v instanceof THREE.Texture) v.dispose(); mt.dispose(); }
    });
    grupRuang.clear();
    const daftar = daftarRuang(ruang);
    const lantaiDari = (i: number) => (i === 0 ? ruang.lantai : sambunganKe(ruang, i)?.lantai ?? 'kayu');
    const bahanDinding = new THREE.MeshStandardMaterial({ color: warnaSah(ruang.warnaDinding) ?? 0xf5f5f4, roughness: 0.95, side: THREE.FrontSide });
    //  Feature wall depan: marmer / panel kayu, UV dalam meter supaya slab tidak melar.
    const aksen = ruang.dindingDepan && ruang.dindingDepan !== 'polos' ? teksturDindingAksen(THREE, ruang.dindingDepan) : null;
    const bahanAksen = aksen ? new THREE.MeshStandardMaterial({ map: aksen.tex, roughness: ruang.dindingDepan === 'marmer' ? 0.25 : 0.7, metalness: ruang.dindingDepan === 'marmer' ? 0.05 : 0, side: THREE.FrontSide }) : null;
    const garis = new THREE.LineBasicMaterial({ color: 0xa8a29e });
    //  Sekat antar ruang (j = sekat di kiri ruang j): 'tembok' (bawaan), 'kaca' = kaca penuh berangka
    //  aluminium, 'jendela' = tetap tembok dengan SATU jendela kaca persegi untuk melihat ke ruang
    //  sebelah (ruang observasi / sidang), 'terbuka' = tanpa sekat (dua ruang menyatu, mis. bentuk L).
    const jenisSekat = (j: number) => sambunganKe(ruang, j)?.sekat ?? 'tembok';
    const bahanRangkaGelap = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.4 });
    const bahanKaca = new THREE.MeshPhysicalMaterial({
      color: 0xcfe6f5, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
    });
    const bahanRangka = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7, roughness: 0.35 });

    type Lubang = { x0: number; x1: number; y0: number; y1: number; jenis: 'pintu' | 'jendela' | 'terbuka'; luar?: boolean };
    //  Bahan pintu & jendela dinding luar - FrontSide supaya ikut "tembus" bersama dindingnya.
    const bahanKacaLuar = new THREE.MeshStandardMaterial({ color: 0xcfe3f5, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.35, side: THREE.FrontSide, depthWrite: false });
    const bahanKusenLuar = new THREE.MeshStandardMaterial({ color: 0x3f4650, metalness: 0.5, roughness: 0.4, side: THREE.FrontSide });
    const bahanDaunPintu = new THREE.MeshStandardMaterial({ color: 0x8a6542, roughness: 0.6, side: THREE.FrontSide });
    const bahanGagang = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.25, side: THREE.FrontSide });
    /** Lubang pintu/jendela dinding luar ruang i, dalam koordinat lokal dinding (pusat dinding = 0). */
    const lubangLuar = (i: number, sisi: SisiDinding, panjang: number): Lubang[] =>
      bukaanDinding(ruang, i, sisi).map(x => ({ x0: x.x0 - panjang / 2, x1: x.x1 - panjang / 2, y0: x.y0, y1: x.y1, jenis: x.b.jenis, luar: true }));
    /**
     * Dinding sepanjang `panjang`, tengah (x,z), dengan lubang (koordinat lokal
     * dinding: x sepanjang dinding, y dari lantai). `tembus` = kaca penuh;
     * `pasangKaca` = isi lubang jendela dengan kaca + kusen (cukup di SATU sisi
     * sekat - dua bidang kaca di posisi yang sama akan berkedip).
     */
    const dinding = (panjang: number, tinggi: number, x: number, z: number, rotY: number, lubang: Lubang[] = [], opsi: { tembus?: boolean; pasangKaca?: boolean; aksen?: boolean } = {}) => {
      const tembus = !!opsi.tembus;
      const gw = new THREE.Group(); gw.position.set(x, 0, z); gw.rotation.y = rotY;
      const bidang = (x0: number, x1: number, y0: number, y1: number) => {
        if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
        const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
        if (opsi.aksen && aksen && !tembus) {
          const uv = geo.attributes.uv as T.BufferAttribute;
          for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0) + panjang / 2) / aksen.ubinW, (y0 + uv.getY(i) * (y1 - y0)) / aksen.ubinH);
        }
        const d = new THREE.Mesh(geo, tembus ? bahanKaca : opsi.aksen && bahanAksen ? bahanAksen : bahanDinding);
        d.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); d.receiveShadow = !tembus; gw.add(d);
      };
      const balok = (w: number, h: number, bx: number, by: number, m: T.Material = bahanRangkaGelap, tebal = 0.07) => {
        const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, tebal), m); o.position.set(bx, by, 0); gw.add(o);
      };
      if (tembus) {
        //  Rangka: tiang tiap ±1,2 m + ambang atas & bawah, supaya kacanya terbaca sebagai kaca.
        const n = Math.max(1, Math.round(panjang / 1.2));
        for (let i = 0; i <= n; i++) {
          const xt = -panjang / 2 + (panjang * i) / n;
          if (lubang.some(l => xt > l.x0 - 0.05 && xt < l.x1 + 0.05)) continue;   // jangan menghalangi pintu
          const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, tinggi, 0.05), bahanRangka);
          t.position.set(xt, tinggi / 2, 0); gw.add(t);
        }
        for (const y of [0.02, tinggi - 0.02]) {
          const a = new THREE.Mesh(new THREE.BoxGeometry(panjang, 0.04, 0.05), bahanRangka);
          a.position.set(0, y, 0); gw.add(a);
        }
      }
      //  Isi dinding = potongan-potongan persegi di sekitar lubang: dibagi per
      //  lajur di antara tepi-tepi lubang, tiap lajur diisi di atas & bawah lubangnya.
      const xs = [...new Set([-panjang / 2, panjang / 2, ...lubang.flatMap(l => [l.x0, l.x1])]
        .map(v => Math.min(panjang / 2, Math.max(-panjang / 2, v))))].sort((p1, p2) => p1 - p2);
      for (let i = 0; i < xs.length - 1; i++) {
        const xa = xs[i], xb = xs[i + 1], tengah = (xa + xb) / 2;
        let y = 0;
        for (const l of lubang.filter(h => h.x0 < tengah && h.x1 > tengah).sort((h1, h2) => h1.y0 - h2.y0)) {
          bidang(xa, xb, y, l.y0); y = Math.max(y, l.y1);
        }
        bidang(xa, xb, y, tinggi);
      }
      for (const l of lubang) {
        if (l.luar) {
          //  Pintu/jendela dinding luar: bidang-bidang FrontSide (kusen, kaca / daun pintu) sedikit di depan dinding.
          const w = l.x1 - l.x0, h = l.y1 - l.y0, cx = (l.x0 + l.x1) / 2, cy = (l.y0 + l.y1) / 2;
          const kepingan = (pw: number, ph: number, px: number, py: number, m: T.Material, pz = 0.006) => {
            const o = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), m); o.position.set(px, py, pz); gw.add(o);
          };
          const k = l.jenis === 'pintu' ? 0.06 : 0.05;
          kepingan(w + 2 * k, k, cx, l.y1 + k / 2, bahanKusenLuar);
          if (l.jenis === 'jendela') kepingan(w + 2 * k, k, cx, l.y0 - k / 2, bahanKusenLuar);
          kepingan(k, h, l.x0 - k / 2, cy, bahanKusenLuar); kepingan(k, h, l.x1 + k / 2, cy, bahanKusenLuar);
          if (l.jenis === 'jendela') {
            kepingan(w, h, cx, cy, bahanKacaLuar, -0.004);
            //  Palang tengah tiap ±1 m supaya terbaca sebagai jendela, bukan lubang.
            const n = Math.max(1, Math.round(w / 1.0));
            for (let j = 1; j < n; j++) kepingan(0.035, h, l.x0 + (w * j) / n, cy, bahanKusenLuar, 0.004);
          } else {
            kepingan(w - 0.01, h - 0.005, cx, cy - 0.0025, bahanDaunPintu, 0.003);
            const gagang = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), bahanGagang);
            gagang.position.set(l.x1 - Math.min(0.09, w * 0.15), Math.min(1.0, h * 0.48), 0.008); gw.add(gagang);
            kepingan(0.11, 0.022, l.x1 - Math.min(0.09, w * 0.15) - 0.05, Math.min(1.0, h * 0.48), bahanGagang, 0.009);
          }
          continue;
        }
        if (l.jenis === 'pintu') {
          const kusen = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(l.x1 - l.x0, l.y1 - l.y0)), garis);
          kusen.position.set((l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2, 0.002); gw.add(kusen);
        } else if (l.jenis === 'jendela' && opsi.pasangKaca) {
          //  Kaca jendela + kusen gelap di keempat sisi.
          const w = l.x1 - l.x0, h = l.y1 - l.y0, cx = (l.x0 + l.x1) / 2, cy = (l.y0 + l.y1) / 2, k = 0.05;
          const kaca2 = new THREE.Mesh(new THREE.PlaneGeometry(w, h), bahanKaca); kaca2.position.set(cx, cy, 0); gw.add(kaca2);
          balok(w + 2 * k, k, cx, l.y1 + k / 2); balok(w + 2 * k, k, cx, l.y0 - k / 2);
          balok(k, h, l.x0 - k / 2, cy); balok(k, h, l.x1 + k / 2, cy);
        }
      }
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(panjang, tinggi)), garis);
      e.position.y = tinggi / 2; gw.add(e);
      grupRuang.add(gw);
    };

    /**
     * Lubang di sekat ke-j, dalam koordinat lokal dinding (z dunia -> x lokal). `kanan` = dinding kanan
     * ruang j-1 (rotY -90°: x lokal = z - l/2); bukan = dinding kiri ruang j (rotY +90°: x lokal = -(z - l/2)).
     */
    const lubangSekat = (j: number, kanan: boolean, k: Kotak): Lubang[] => {
      if (j < 1 || j >= daftar.length) return [];
      const keLokal = (z0: number, z1: number) => (kanan ? [z0 - k.l / 2, z1 - k.l / 2] : [-(z1 - k.l / 2), -(z0 - k.l / 2)]);
      const hasil: Lubang[] = [];
      if (jenisSekat(j) === 'terbuka') {
        //  Tanpa sekat: bagian yang bersinggungan dengan ruang sebelah dibiarkan terbuka; sisa dinding
        //  (ruang yang lebih dalam) tetap tembok - ruang bentuk L.
        const [x0, x1] = keLokal(0, Math.min(daftar[j - 1].l, daftar[j].l));
        hasil.push({ x0, x1, y0: 0, y1: k.t, jenis: 'terbuka' });
        return hasil;
      }
      const pintuDi = pintuSekat(ruang, j), jendela = jendelaSekat(ruang, j);
      if (pintuDi !== null) {
        const up = ukuranPintu(ruang, j);
        const [x0, x1] = keLokal(pintuDi - up.lebar / 2, pintuDi + up.lebar / 2);
        hasil.push({ x0, x1, y0: 0, y1: Math.min(up.tinggi, k.t - 0.1), jenis: 'pintu' });
      }
      if (jendela) {
        const [x0, x1] = keLokal(jendela.z0, jendela.z1);
        hasil.push({ x0, x1, y0: jendela.y0, y1: jendela.y1, jenis: 'jendela' });
      }
      return hasil;
    };

    daftar.forEach((k, i) => {
      const jenis = lantaiDari(i);
      const lantai = new THREE.Mesh(new THREE.PlaneGeometry(k.p, k.l),
        new THREE.MeshStandardMaterial({ map: teksturLantai(THREE, jenis, k.p, k.l, i === 0 ? ruang.warnaLantai : sambunganKe(ruang, i)?.warnaLantai), roughness: jenis === 'keramik' ? 0.35 : 0.8 }));
      lantai.rotation.x = -Math.PI / 2; lantai.position.set(k.x0 + k.p / 2, 0, k.l / 2); lantai.receiveShadow = true;
      grupRuang.add(lantai);
      dinding(k.p, k.t, k.x0 + k.p / 2, 0, 0, lubangLuar(i, 'depan', k.p), { aksen: true });  // depan (feature wall)
      dinding(k.p, k.t, k.x0 + k.p / 2, k.l, Math.PI, lubangLuar(i, 'belakang', k.p));       // belakang
      //  Kiri (rotY +90°: sumbu lokal x = -z dunia) & kanan (-90°: lokal x = +z dunia).
      //  Sekat kaca penuh cukup satu bidang (milik ruang di kirinya) - dua bidang tembus pandang di posisi yang sama akan berkedip.
      const adaKanan = i < daftar.length - 1;
      if (!(i > 0 && jenisSekat(i) === 'kaca')) dinding(k.l, k.t, k.x0, k.l / 2, Math.PI / 2, [...lubangSekat(i, false, k), ...lubangLuar(i, 'kiri', k.l)]);
      dinding(k.l, k.t, k.x0 + k.p, k.l / 2, -Math.PI / 2, [...(adaKanan ? lubangSekat(i + 1, true, k) : []), ...lubangLuar(i, 'kanan', k.l)],
        { tembus: adaKanan && jenisSekat(i + 1) === 'kaca', pasangKaca: adaKanan });
    });
  }, [ruang, siap]);

  // ── Benda: bangun ulang hanya yang bentuknya berubah ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const { THREE, grupBenda, cache } = m;
    const ada = new Set(benda.map(b => b.id));
    //  Model lama dibuang BESERTA geometri & materialnya - tanpa ini memori GPU
    //  bertambah tiap kali ukuran/bentuk benda diubah (model dibangun ulang).
    //  Gambar unggahan tidak ikut dilepas: ia dipakai ulang model berikutnya.
    const unggahan = new Set(gambarLayar.current.values());
    const buang = (o: T.Object3D) => o.traverse(x => {
      const mesh = x as T.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const mt of mats) {
        for (const v of Object.values(mt)) if (v instanceof THREE.Texture && !unggahan.has(v)) v.dispose();
        mt.dispose();
      }
    });
    for (const [id, c] of cache) if (!ada.has(id)) { grupBenda.remove(c.obj); buang(c.obj); cache.delete(id); }
    for (const b of benda) {
      const tanda = `${tandaBentuk(b)}|${versiGambar}`;
      let c = cache.get(b.id);
      if (!c || c.tanda !== tanda) {
        if (c) { grupBenda.remove(c.obj); buang(c.obj); }
        const obj = buatModel(b, {
          THREE,
          layar: x => (x.konten === 'mati' ? null : x.konten === 'gambar' ? gambarLayar.current.get(x.id) ?? null : teksturKonten(THREE, x)),
          model: k => modelImpor.current.get(k) ?? null,
        });
        obj.userData.id = b.id;
        grupBenda.add(obj);
        c = { obj, tanda }; cache.set(b.id, c);
      }
      c.obj.position.set(b.x, b.elev, b.z);
      c.obj.rotation.y = (b.rot * Math.PI) / 180;
      sesuaikanTinggi(c.obj, b, plafonDi(b.x));
      if (b.jenis === 'lampu') aturNyalaLampu(c.obj, nyalaLampu(b, ruang));
    }
    // Sorotan benda terpilih (kotak batas tipis).
    grupBenda.children.filter(o => o.userData.sorot).forEach(o => { grupBenda.remove(o); buang(o); });
    const terpilih = pilih ? cache.get(pilih)?.obj : null;
    if (terpilih) {
      const s = new THREE.BoxHelper(terpilih, 0x2563eb); s.userData.sorot = true; grupBenda.add(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benda, pilih, siap, ruang, versiGambar]);

  // ── Gizmo menempel ke benda terpilih ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const o = pilih ? m.cache.get(pilih)?.obj : null;
    if (o && tampilan !== 'kursi') {
      m.gizmo.attach(o);
      m.gizmo.setMode(modeGizmo);
      m.gizmo.showX = modeGizmo === 'translate'; m.gizmo.showZ = modeGizmo === 'translate'; m.gizmo.showY = true;
    } else m.gizmo.detach();
  }, [pilih, modeGizmo, siap, tampilan, benda]);

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

  // ── Alat bantu: label ukuran, garis jarak terjauh, kerucut sudut pandang ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const { THREE, grupBantu, CSS2DObject } = m;
    //  Isi lama dibuang BESERTA geometri & materialnya: efek ini berjalan tiap
    //  frame selama benda diseret, jadi tanpa dispose memori GPU terus naik.
    grupBantu.traverse(o => {
      const el = (o as { element?: HTMLElement }).element; if (el) el.remove();
      const mesh = o as T.Mesh; mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      mats.forEach(mt => mt.dispose());
    });
    grupBantu.clear();
    const label = (teks: string, pos: T.Vector3, nada: 'biru' | 'hijau' | 'merah' | 'abu' = 'biru') => {
      const el = document.createElement('div');
      el.textContent = teks;
      const latar = { hijau: '#047857', merah: '#b91c1c', biru: '#1d4ed8', abu: '#334155' }[nada];
      el.style.cssText = `font:600 11px system-ui,sans-serif;padding:2px 6px;border-radius:6px;white-space:nowrap;color:#fff;background:${latar};box-shadow:0 1px 3px rgba(0,0,0,.3)`;
      const o = new CSS2DObject(el); o.position.copy(pos); grupBantu.add(o);
    };
    /** Label produk: kecil, menempel di tepi benda (dy -1 = tepat di atas titik, 1 = tepat di bawah). */
    const labelP = (teks: string, pos: T.Vector3, dy: -1 | 1 = -1) => {
      const el = document.createElement('div');
      el.textContent = teks;
      el.dataset.produk = '1'; el.dataset.dy = String(dy);
      el.style.cssText = `font:600 9.5px system-ui,sans-serif;line-height:1.25;padding:0 5px;border-radius:999px;white-space:nowrap;color:#0f172a;background:rgba(255,255,255,.9);border:1px solid #cbd5e1;margin-top:${dy * 7}px`;
      const o = new CSS2DObject(el); o.position.copy(pos); grupBantu.add(o);
    };
    for (const a of analisis) {
      const d = a.d;
      const r = (d.rot * Math.PI) / 180;
      const pusat = new THREE.Vector3(d.x, d.elev + d.h / 2, d.z);
      if (kerucut) {
        // Kerucut nyaman ±sudutNyaman (bawaan 45°) di lantai, sejauh penonton terjauh (min 3 m), dipotong di dinding ruangnya.
        const k = kotakRuang[a.ri] ?? kotakRuang[0];
        const panjang = Math.max(3, a.terjauh + 0.5);
        const potong = [
          new THREE.Plane(new THREE.Vector3(1, 0, 0), -k.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), k.x0 + k.p),
          new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), k.l),
        ];
        const setengah = (Math.min(85, Math.max(5, sudutNyaman)) * Math.PI) / 180;
        const kipas = new THREE.Mesh(new THREE.CircleGeometry(panjang, 32, Math.PI / 2 - setengah, setengah * 2),
          new THREE.MeshBasicMaterial({ color: a.cukup ? 0x22c55e : 0xef4444, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: potong }));
        kipas.rotation.x = -Math.PI / 2; kipas.rotation.z = r;
        kipas.position.set(d.x, 0.01, d.z); grupBantu.add(kipas);
      }
      if (ukur || (labelProduk && !d.sembunyiLabel)) {
        //  Garis ukuran aktif: label cukup nama, digeser di atas angka mm supaya tidak bertumpuk.
        //  Ukuran mati tetapi label produk hidup: cukup nama display.
        const adaGaris = garisUkur && !d.sembunyiUkur;
        const naik = adaGaris ? Math.max(0.1, Math.min(0.3, Math.max(d.w, d.h) * 0.04)) + (d.jenis === 'layar' ? 0.22 : 0) + Math.max(0.1, Math.min(0.25, Math.max(d.w, d.h) * 0.035)) * 2.2 : 0.02;
        labelP(adaGaris || !ukur ? d.nama : `${d.nama}: ${f(d.w)} × ${f(d.h)} m`, new THREE.Vector3(d.x, d.elev + d.h + naik, d.z));
        if (a.terjauhP) {
          const ujung = new THREE.Vector3(a.terjauhP.x, 1.2, a.terjauhP.z);
          const garis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pusat, ujung]),
            new THREE.LineDashedMaterial({ color: a.cukup ? 0x047857 : 0xb91c1c, dashSize: 0.15, gapSize: 0.08 }));
          garis.computeLineDistances(); grupBantu.add(garis);
          label(`terjauh ${f(a.terjauh, 1)} m · ${a.cukup ? 'layar cukup' : `perlu tinggi ${f(a.tinggiPerlu)} m`}`,
            pusat.clone().lerp(ujung, 0.5), a.cukup ? 'hijau' : 'merah');
        }
      }
    }
    // Sinar proyektor: grid sinar dari lensa (TR/zoom, lens shift, pan & tilt) ditembakkan (raycast) ke
    // SEMUA permukaan - dinding, lantai, plafon, layar, bidang lengkung/cembung, furnitur, dan objek
    // .glb impor. Gambar jatuh tepat mengikuti permukaannya (melipat di sudut, menekuk di lengkungan);
    // tumpang-tindih antar proyektor (blending) tampil lebih terang karena dijumlahkan (aditif).
    if (sinar) {
      const daftarProj = benda.filter(p => p.jenis === 'proyektor');
      if (daftarProj.length) {
        m.scene.updateMatrixWorld(true);
        const ray = new THREE.Raycaster(); ray.near = 0.03; ray.far = 80;
        (ray.params as { Line?: { threshold: number } }).Line = { threshold: 0.0001 };
        //  Saat menyeret: grid lebih kasar supaya tetap lancar.
        const kasar = m.gizmo.dragging;
        const NX = kasar ? 12 : 24, NY = kasar ? 7 : 14;
        const cahaya = { transparent: true, depthWrite: false, toneMapped: false };
        //  Banyak proyektor (immersive): kerucut & bidang gambar diredam supaya tumpukannya tidak silau,
        //  label hanya untuk proyektor yang sedang dipilih.
        const banyak = daftarProj.length > 4, redam = banyak ? 0.35 : 1;
        daftarProj.forEach((p, idx) => {
          const sn = sinarProyektor(p, benda, ruang);
          const O = new THREE.Vector3(...sn.asal);
          const sendiri = m.cache.get(p.id)?.obj;
          const sasaran = [...m.grupRuang.children, ...m.grupBenda.children.filter(o => o !== sendiri && !o.userData.sorot)];
          const r = (p.rot * Math.PI) / 180;
          const D = new THREE.Vector3(...arahProyektor(p)).normalize();
          const kanan = new THREE.Vector3(-Math.cos(r), 0, Math.sin(r));
          const atas = new THREE.Vector3().crossVectors(kanan, D).normalize();
          const w1 = 1 / throwRatioDari(p), h1 = (w1 * 9) / 16, arahV = p.pasangProyektor === 'meja' ? 1 : -1;
          const offV = offsetLensaDari(p), gH = geserLensaDari(p);
          const kena: (T.Vector3 | null)[] = [];
          const arah = new THREE.Vector3();
          for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
            const u = i / (NX - 1) - 0.5, v = j / (NY - 1) - 0.5;
            arah.copy(D).addScaledVector(kanan, (u + gH) * w1).addScaledVector(atas, (v + arahV * offV) * h1).normalize();
            ray.set(O, arah);
            const hit = ray.intersectObjects(sasaran, true).find(h => {
              const o = h.object as T.Mesh;
              if (!o.isMesh) return false;
              const mt = (Array.isArray(o.material) ? o.material[0] : o.material) as T.Material & { opacity?: number };
              return !(mt?.transparent && (mt.opacity ?? 1) < 0.6);    // kaca & bayangan ditembus cahaya
            });
            kena.push(hit ? hit.point.clone().addScaledVector(arah, -0.012) : null);
          }
          const sel = (i: number, j: number) => kena[j * NX + i];
          //  Bidang gambar: sel grid yang keempat sudutnya kena & tidak "melompat" (tepi objek ke dinding di belakangnya).
          const pos: number[] = [];
          for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
            const A = sel(i, j), B = sel(i + 1, j), C = sel(i + 1, j + 1), Dd = sel(i, j + 1);
            if (!A || !B || !C || !Dd) continue;
            const jarak = (A.distanceTo(O) + C.distanceTo(O)) / 2;
            const batas = ((jarak * w1) / (NX - 1)) * 6 + 0.05;
            if (A.distanceTo(B) > batas || B.distanceTo(C) > batas || C.distanceTo(Dd) > batas || Dd.distanceTo(A) > batas) continue;
            pos.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z, A.x, A.y, A.z, C.x, C.y, C.z, Dd.x, Dd.y, Dd.z);
          }
          if (pos.length) {
            const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            const gambar = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ ...cahaya, color: 0xfff1c2, opacity: (sn.layar ? 0.26 : 0.34) * (banyak ? 0.6 : 1), side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
            gambar.renderOrder = 2; grupBantu.add(gambar);
          }
          //  Tepi gambar (warna per proyektor) + kerucut cahaya dari lensa ke tepi itu.
          const tepi: T.Vector3[] = [];
          for (let i = 0; i < NX; i++) tepi.push(sel(i, 0)!);
          for (let j = 1; j < NY; j++) tepi.push(sel(NX - 1, j)!);
          for (let i = NX - 2; i >= 0; i--) tepi.push(sel(i, NY - 1)!);
          for (let j = NY - 2; j > 0; j--) tepi.push(sel(0, j)!);
          const warnaTepi = new THREE.Color().setHSL((0.1 + idx * 0.17) % 1, 0.9, 0.55);
          const garis: number[] = [], kerucut: number[] = [], alfa: number[] = [];
          for (let i = 0; i < tepi.length; i++) {
            const A = tepi[i], B = tepi[(i + 1) % tepi.length];
            if (!A || !B) continue;
            if (A.distanceTo(B) < Math.max(0.6, A.distanceTo(O) * w1 * 0.4)) garis.push(A.x, A.y, A.z, B.x, B.y, B.z);
            kerucut.push(O.x, O.y, O.z, A.x, A.y, A.z, B.x, B.y, B.z);
            alfa.push(1, 0.84, 0.36, 0.45 * redam, 1, 0.9, 0.55, 0.08 * redam, 1, 0.9, 0.55, 0.08 * redam);
          }
          if (garis.length) {
            const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(garis, 3));
            grupBantu.add(new THREE.LineSegments(g2, new THREE.LineBasicMaterial({ ...cahaya, color: warnaTepi, opacity: 0.95 })));
          }
          if (kerucut.length) {
            const g3 = new THREE.BufferGeometry();
            g3.setAttribute('position', new THREE.Float32BufferAttribute(kerucut, 3)); g3.setAttribute('color', new THREE.Float32BufferAttribute(alfa, 4));
            const kerucutSinar = new THREE.Mesh(g3, new THREE.MeshBasicMaterial({ ...cahaya, vertexColors: true, side: THREE.DoubleSide }));
            kerucutSinar.renderOrder = 2; grupBantu.add(kerucutSinar);
          }
          const kilau = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), new THREE.MeshBasicMaterial({ ...cahaya, color: 0xfffbeb, blending: THREE.AdditiveBlending, opacity: 0.95 }));
          kilau.position.copy(O); grupBantu.add(kilau);
          if (ukur && (!banyak || p.id === pilih)) {
            const tengah = sel(Math.floor(NX / 2), Math.floor(NY / 2));
            const jarakSumbu = sn.layar ? sn.jarak : tengah ? tengah.distanceTo(O) : sn.jarak;
            const teks = `${p.nama}: lempar ${f(jarakSumbu)} m · gambar ±${f(jarakSumbu * w1)} × ${f(jarakSumbu * h1)} m`;
            label(teks, tengah ? O.clone().lerp(tengah, 0.3) : O.clone().addScaledVector(D, 0.5), 'abu');
          }
        });
      }
    }
    //  Jangkauan suara speaker (kerucut sebaran H x V), dipotong di dinding, lantai & plafon ruangnya.
    //  Line array: satu berkas per modul + titik jatuh sumbunya di tinggi telinga. Tampil hanya bila
    //  dinyalakan: centang "Jangkauan speaker" (semua) atau "Tampilkan jangkauan" di panel Atur speaker itu.
    for (const b of benda) {
      if (!(b.jenis === 'speaker' || b.jenis === 'speaker-plafon')) continue;
      if (!(jangkau || b.tampilJangkauan)) continue;
      const k = kotakRuang[ruangDari(ruang, b.x)] ?? kotakRuang[0];
      const potong = [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), -k.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), k.x0 + k.p),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), k.l),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(0, -1, 0), k.t),
      ];
      const r = (b.rot * Math.PI) / 180;
      const maju = new THREE.Vector3(Math.sin(r), 0, Math.cos(r)), kanan = new THREE.Vector3(-Math.cos(r), 0, Math.sin(r));
      const isi = (warna: number, opasitas: number) => new THREE.MeshBasicMaterial({ color: warna, transparent: true, opacity: opasitas, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: potong });
      /** Kerucut elips dari O sepanjang `sumbu`: lebar sebaran H (sepanjang kanan) x V (tegak lurus). */
      const kerucutElips = (O: T.Vector3, sumbu: T.Vector3, H: number, V: number, L: number, warna: number, opasitas: number) => {
        const rH = L * Math.tan((Math.min(170, H) / 2) * Math.PI / 180), rV = L * Math.tan((Math.min(170, V) / 2) * Math.PI / 180);
        const geo = new THREE.ConeGeometry(1, L, 48, 1, true); geo.translate(0, -L / 2, 0); geo.scale(rH, 1, rV);
        const sb = sumbu.clone().normalize(), sy = sb.clone().negate(), sz = new THREE.Vector3().crossVectors(kanan, sy).normalize();
        const m = new THREE.Mesh(geo, isi(warna, opasitas));
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(kanan, sy, sz)); m.position.copy(O);
        m.renderOrder = 3; grupBantu.add(m);
      };
      if (b.jenis === 'speaker-plafon') {
        const tinggi = b.elev - TINGGI_DENGAR;
        if (tinggi < 0.1) continue;
        const jari = cakupanSpeakerPlafon(b);
        const geo = new THREE.ConeGeometry(jari, tinggi, 40, 1, true); geo.translate(0, -tinggi / 2, 0);
        const kerucut = new THREE.Mesh(geo, isi(0xf59e0b, 0.07));
        kerucut.position.set(b.x, b.elev, b.z); kerucut.renderOrder = 3; grupBantu.add(kerucut);
        const cakram = new THREE.Mesh(new THREE.CircleGeometry(jari, 48), isi(0xf59e0b, 0.16));
        cakram.rotation.x = -Math.PI / 2; cakram.position.set(b.x, TINGGI_DENGAR, b.z); grupBantu.add(cakram);
        label(`Ø ${f(jari * 2)} m @ ${f(TINGGI_DENGAR)} m`, new THREE.Vector3(b.x, TINGGI_DENGAR + 0.1, b.z), 'abu');
        continue;
      }
      const tipe = tipeSpeakerDari(b), H = sebaranSpeaker(b), V = sebaranVSpeaker(b), L = jangkauanDari(b);
      if (tipe === 'linearray') {
        //  Tiap modul: berkas sempit (V per modul) ke arah sudutnya, warna bergradasi atas -> bawah,
        //  garis sumbu + titik jatuh di tinggi telinga = di mana modul itu "mendarat" di penonton.
        const berkas = berkasLineArray(b), n = berkas.length;
        const jatuh: number[] = [];
        berkas.forEach((x, i) => {
          const O = new THREE.Vector3(...x.asal), sumbu = new THREE.Vector3(...x.arah);
          const warna = new THREE.Color().setHSL(0.08 + 0.5 * (n > 1 ? i / (n - 1) : 0), 0.85, 0.55).getHex();
          kerucutElips(O, sumbu, H, V, L, warna, 0.06);
          const ujung = x.jatuh ? new THREE.Vector3(...x.jatuh) : O.clone().addScaledVector(sumbu, L);
          grupBantu.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([O, ujung]),
            new THREE.LineBasicMaterial({ color: warna, transparent: true, opacity: 0.85, clippingPlanes: potong })));
          if (x.jatuh && x.jarak !== null) {
            const titik = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshBasicMaterial({ color: warna, clippingPlanes: potong }));
            titik.position.copy(ujung); grupBantu.add(titik);
            jatuh.push(x.jarak);
          }
        });
        const teks = jatuh.length ? ` · menjangkau ${f(Math.min(...jatuh), 1)}–${f(Math.max(...jatuh), 1)} m` : '';
        label(`${b.nama}: ${modulLA(b)} modul · ${f(H, 0)}° H${teks}`, new THREE.Vector3(b.x, b.elev + b.h + 0.25, b.z), 'abu');
        continue;
      }
      //  Speaker dinding sedikit menunduk (10°) ke pendengar; portable & kotak berdiri lurus ke depan.
      const tunduk = tipe === 'kolom' ? 0 : 0.175;
      const tinggiPancar = tipe === 'kolom' ? b.elev + b.h - Math.min(0.85, Math.max(0.3, b.h * 0.36)) / 2 : b.elev + b.h / 2;
      const O = new THREE.Vector3(b.x, tinggiPancar, b.z).addScaledVector(maju, tipe === 'kolom' ? 0.06 : b.d / 2);
      const sumbu = maju.clone().multiplyScalar(Math.cos(tunduk)).add(new THREE.Vector3(0, -Math.sin(tunduk), 0)).normalize();
      kerucutElips(O, sumbu, H, V, L, 0xf59e0b, 0.08);
      label(`${b.nama}: ${f(H, 0)}° × ${f(V, 0)}° · ${f(L, 1)} m`, O.clone().addScaledVector(sumbu, Math.min(1.2, L * 0.25)).add(new THREE.Vector3(0, 0.2, 0)), 'abu');
    }
    if (ukur) {
      kotakRuang.forEach((k, i) => {
        label(`${f(k.p)} m`, new THREE.Vector3(k.x0 + k.p / 2, 0.05, k.l + 0.25));
        label(`${f(k.l)} m`, new THREE.Vector3(k.x0 + k.p + (i === kotakRuang.length - 1 ? 0.3 : -0.3), 0.05, k.l / 2));
        //  Di lantai pojok depan-kiri, bukan di tengah setinggi plafon: dari
        //  sudut kamera mana pun posisi itu jatuh tepat di atas display yang
        //  menempel di dinding, sehingga label "Ruang N" menutupi label ukuran
        //  display. Pojok depan-kiri jauh dari display & label ukuran ruang.
        if (kotakRuang.length > 1) label(`Ruang ${i + 1}`, new THREE.Vector3(k.x0 + Math.min(0.7, k.p / 4), 0.05, k.l - Math.min(0.45, k.l / 4)), 'abu');
      });
    }
    //  Jalur kabel ke rack (warna per jenis kabel).
    if (tampilKabel) {
      const bahan = new Map<number, T.LineBasicMaterial>();
      for (const j of kabel) {
        const mt = bahan.get(j.kabel.warna) ?? new THREE.LineBasicMaterial({ color: j.kabel.warna, transparent: true, opacity: 0.9 });
        bahan.set(j.kabel.warna, mt);
        grupBantu.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(j.titik.map(t => new THREE.Vector3(...t))), mt));
      }
    }
    //  Label produk: satu label per nama benda per ruang (kembar = "× jumlah"), di atas benda;
    //  benda di plafon (speaker plafon, proyektor gantung) labelnya di bawah benda.
    if (labelProduk) {
      const grup = new Map<string, Benda[]>();
      for (const b of benda) {
        //  Interior (meja, kursi, tribun, lampu) tidak diberi label - cukup perangkat AV.
        if (DISPLAY.includes(b.jenis) || ['meja', 'kursi', 'tribun', 'lampu'].includes(b.jenis) || b.sembunyiLabel) continue;
        const nama = b.nama.replace(/\s+\d+(\.\d+)?$/, '').trim() || b.nama;
        const kunci = `${ruangDari(ruang, b.x)}|${nama}`;
        const isi = grup.get(kunci); if (isi) isi.push(b); else grup.set(kunci, [b]);
      }
      for (const [kunci, isi] of grup) {
        const b = isi[0], nama = kunci.split('|').slice(1).join('|');
        const atas = b.elev + b.h;
        const diPlafon = atas > plafonDi(b.x) - 0.35;
        labelP(isi.length > 1 ? `${nama} ×${isi.length}` : nama,
          new THREE.Vector3(b.x, diPlafon ? Math.max(0.3, b.elev - 0.02) : atas + 0.02, b.z), diPlafon ? 1 : -1);
      }
    }
    //  Garis ukuran display: lebar di atas & tinggi di kanan, ujung bertanda, angka dalam mm.
    if (garisUkur) {
      const merah = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
      for (const b of benda) {
        if (!DISPLAY.includes(b.jenis) || b.sembunyiUkur) continue;
        const grp = new THREE.Group();
        grp.position.set(b.x, b.elev, b.z); grp.rotation.y = (b.rot * Math.PI) / 180;
        const t = Math.max(0.01, Math.max(b.w, b.h) * 0.004), tanda = Math.max(0.1, Math.min(0.25, Math.max(b.w, b.h) * 0.035));
        const jarak = Math.max(0.1, Math.min(0.3, Math.max(b.w, b.h) * 0.04)) + (b.jenis === 'layar' ? 0.22 : 0);
        const zp = b.d / 2 + 0.03, yAtas = b.h + jarak, xKanan = b.w / 2 + Math.max(0.1, Math.min(0.3, Math.max(b.w, b.h) * 0.04));
        const balok = (w: number, h: number, x: number, y: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), merah); m.position.set(x, y, zp); grp.add(m); };
        balok(b.w, t, 0, yAtas); balok(t, tanda, -b.w / 2, yAtas); balok(t, tanda, b.w / 2, yAtas);
        balok(t, b.h, xKanan, b.h / 2); balok(tanda, t, xKanan, 0); balok(tanda, t, xKanan, b.h);
        const teks = (isi: string, x: number, y: number, tegak: boolean) => {
          const el = document.createElement('div');
          el.textContent = isi;
          el.style.cssText = `font:700 12px system-ui,sans-serif;color:#dc2626;background:rgba(255,255,255,.85);padding:${tegak ? '4px 1px' : '1px 4px'};border-radius:4px;white-space:nowrap${tegak ? ';writing-mode:vertical-rl' : ''}`;
          const o = new CSS2DObject(el); o.position.set(x, y, zp); grp.add(o);
        };
        teks(`${Math.round(b.w * 1000)} mm`, 0, yAtas + tanda * 0.9, false);
        teks(`${Math.round(b.h * 1000)} mm`, xKanan + tanda * 0.9, b.h / 2, true);
        grupBantu.add(grp);
      }
    }
  }, [analisis, ukur, garisUkur, labelProduk, kerucut, sinar, siap, kotakRuang, benda, ruang, sudutNyaman, jangkau, pilih, tampilKabel, kabel]);

  //  Setelah template dipasang: pas-kan kamera ke ruangan BARU (dipanggil dari efek supaya ukuran ruangnya sudah yang baru).
  useEffect(() => {
    if (!pasSetelahTemplate.current || !siap) return;
    pasSetelahTemplate.current = false;
    pasKeLayar('semua');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruang, siap]);

  // ── Tingkat cahaya ruangan ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const f = { terang: 1, redup: 0.45, gelap: 0.12 }[ruang.cahaya ?? 'terang'];
    m.lampu.matahari.intensity = 1.6 * f; m.lampu.langit.intensity = 0.35 * f;
    (m.scene as T.Scene & { environmentIntensity: number }).environmentIntensity = Math.max(0.1, f);
  }, [ruang.cahaya, siap]);

  // ── Bayangan lembut & cahaya layar ──
  //  Lampu arah adegan berada di depan-atas, jadi display yang menempel dinding hanya menjatuhkan
  //  bayangan setebal celah bracket (beberapa cm) - nyaris tak terlihat. Di sini ditambahkan bayangan
  //  lembut (seperti cahaya ruangan dari atas) di dinding belakang display, bayangan kontak di lantai
  //  untuk standfloor, dan pendar cahaya layar yang menyala ke lantai di depannya.
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const { THREE, grupBayang } = m;
    grupBayang.traverse(o => {
      const mesh = o as T.Mesh; mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      mats.forEach(mt => mt.dispose());
    });
    grupBayang.clear();
    if (!bayangan) return;
    if (!teksturBayang.current) {
      const kanvas = (gambar: (g: CanvasRenderingContext2D) => void) => {
        const c = document.createElement('canvas'); c.width = c.height = 256; gambar(c.getContext('2d')!);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
      };
      teksturBayang.current = {
        //  Titik bulat gelap -> transparan. Dipakai sebagai "9-slice" (lihat bayangan9): tengah tekstur = inti
        //  gelap selebar display, setengah luarnya = tepi kabur dengan lebar tetap dalam meter.
        bayang: kanvas(g => {
          const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
          gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
        }),
        cahaya: kanvas(g => {
          const gr = g.createRadialGradient(128, 40, 4, 128, 110, 150);
          gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
        }),
      };
    }
    const { bayang, cahaya } = teksturBayang.current;
    const bidang = (w: number, h: number, mt: T.Material) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), mt);
    /** Bayangan lembut persegi: inti cw x ch gelap penuh + tepi kabur selebar `kabur` m (9 kotak, UV tepi 0..0,5..1). */
    const bayangan9 = (cw: number, ch: number, kabur: number, opasitas: number) => {
      const xs = [-cw / 2 - kabur, -cw / 2, cw / 2, cw / 2 + kabur], ys = [-ch / 2 - kabur, -ch / 2, ch / 2, ch / 2 + kabur], us = [0, 0.5, 0.5, 1];
      const pos: number[] = [], uv: number[] = [], idx: number[] = [];
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { pos.push(xs[i], ys[j], 0); uv.push(us[i], us[j]); }
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const a = j * 4 + i; idx.push(a, a + 1, a + 5, a, a + 5, a + 4); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
      return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: bayang, color: 0x000000, transparent: true, opacity: opasitas, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    };
    for (const d of benda) {
      //  Speaker berdiri di lantai (portable / line array tidak digantung): bayangan kontak di lantai.
      if (d.jenis === 'speaker' && d.elev < 0.05 && (tipeSpeakerDari(d) === 'kolom' || (tipeSpeakerDari(d) === 'linearray' && !d.gantung))) {
        const o = bayangan9(d.w * 0.95, d.d * 0.9, 0.18, 0.5);
        o.rotation.set(-Math.PI / 2, 0, (d.rot * Math.PI) / 180); o.position.set(d.x, 0.003, d.z); grupBayang.add(o);
        continue;
      }
      if (!DISPLAY.includes(d.jenis)) continue;
      const k = kotakRuang[ruangDari(ruang, d.x)] ?? kotakRuang[0];
      const r = (d.rot * Math.PI) / 180, hx = Math.sin(r), hz = Math.cos(r);
      const bx = d.x - hx * d.d / 2, bz = d.z - hz * d.d / 2;     // titik punggung display
      const yTengah = d.elev + d.h / 2;
      const dindingDekat = [
        { cocok: hz > 0.9, celah: bz, pos: (dy: number) => new THREE.Vector3(d.x, yTengah - dy, 0.004), rotY: 0 },
        { cocok: hz < -0.9, celah: k.l - bz, pos: (dy: number) => new THREE.Vector3(d.x, yTengah - dy, k.l - 0.004), rotY: Math.PI },
        { cocok: hx > 0.9, celah: bx - k.x0, pos: (dy: number) => new THREE.Vector3(k.x0 + 0.004, yTengah - dy, d.z), rotY: Math.PI / 2 },
        { cocok: hx < -0.9, celah: k.x0 + k.p - bx, pos: (dy: number) => new THREE.Vector3(k.x0 + k.p - 0.004, yTengah - dy, d.z), rotY: -Math.PI / 2 },
      ].find(x => x.cocok && x.celah >= -0.05 && x.celah <= 0.35);
      const stand = pasangDari(d) === 'standfloor';
      if (dindingDekat && !stand) {
        //  Cahaya ruangan dari atas-depan: bayangan jatuh sedikit di bawah display, makin jauh dari dinding
        //  makin turun & makin kabur.
        const celah = Math.max(0, dindingDekat.celah);
        const o = bayangan9(d.w + 0.02, d.h, 0.07 + celah * 0.9, 0.62 * (1 - celah / 0.5));
        o.position.copy(dindingDekat.pos(0.045 + celah * 0.8)); o.rotation.y = dindingDekat.rotY;
        grupBayang.add(o);
      }
      if (stand || d.elev < 0.25) {
        //  Bayangan kontak di lantai di bawah stand / alas.
        const o = bayangan9(d.w * 0.9, stand ? 0.55 : Math.max(0.15, d.d), 0.22, 0.45);
        o.rotation.set(-Math.PI / 2, 0, r); o.position.set(d.x - hx * 0.03, 0.003, d.z - hz * 0.03); grupBayang.add(o);
      }
      //  Cahaya layar yang menyala (bukan layar proyektor / konten mati) jatuh ke lantai di depannya.
      if (d.jenis !== 'layar' && d.konten !== 'mati') {
        const panjang = Math.min(3.5, Math.max(1.2, d.h * 2.2)), lebar = d.w * 1.7 + 0.4;
        const g = new THREE.Group(); g.position.set(d.x, 0.004, d.z); g.rotation.y = r;
        const o = bidang(lebar, panjang, new THREE.MeshBasicMaterial({
          map: cahaya, color: 0x6fa8ff, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending,
          clippingPlanes: [
            new THREE.Plane(new THREE.Vector3(1, 0, 0), -k.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), k.x0 + k.p),
            new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), k.l),
          ],
        }));
        o.rotation.x = -Math.PI / 2; o.position.z = d.d / 2 + panjang / 2; g.add(o);
        grupBayang.add(g);
      }
    }
  }, [benda, ruang, siap, bayangan, kotakRuang]);

  // ── Kamera ──
  /** Titik pusat & kotak batas untuk dipas ke kanvas: semua ruang atau satu ruang. */
  const fokusKotak = (fk: 'semua' | number) => {
    const { THREE } = mesin.current!;
    const k = fk === 'semua' ? null : kotakRuang[fk] ?? null;
    const x0 = k ? k.x0 : 0, x1 = k ? k.x0 + k.p : batas.x, z1 = k ? k.l : batas.z, t = k ? k.t : batas.t;
    return { target: new THREE.Vector3((x0 + x1) / 2, Math.min(1.2, t * 0.4), z1 / 2), kotak: new THREE.Box3(new THREE.Vector3(x0, 0, 0), new THREE.Vector3(x1, t, z1)) };
  };

  const kameraKe = (sudut: Sudut | 'kursi', fk: 'semua' | number = fokusRuang, langsung = false) => {
    const m = mesin.current; if (!m) return;
    sudutRef.current = sudut;
    if (sudut === 'kursi') {
      // Mata penonton (1,2 m) di kursi terpilih atau penonton terjauh, menatap display di ruang yang sama.
      const sel = benda.find(b => b.id === pilih && b.jenis === 'kursi');
      const ri = sel ? ruangDari(ruang, sel.x) : fk === 'semua' ? 0 : fk;
      const a = analisis.find(x => x.ri === ri) ?? analisis[0];
      const k = kotakRuang[ri] ?? kotakRuang[0];
      const p = sel ? { x: sel.x, z: sel.z } : a?.terjauhP ?? { x: k.x0 + k.p / 2, z: k.l - 0.5 };
      const target = a ? new m.THREE.Vector3(a.d.x, a.d.elev + a.d.h / 2, a.d.z) : new m.THREE.Vector3(k.x0 + k.p / 2, 1.2, 0);
      terbangKe(m, new m.THREE.Vector3(p.x, 1.2, p.z), target, langsung);
      return;
    }
    const { target, kotak } = fokusKotak(fk);
    terbangKe(m, posisiPas(m, target, new m.THREE.Vector3(...ARAH_SUDUT[sudut]).normalize(), kotak), target, langsung);
  };

  const pilihSudut = (sudut: Sudut | 'kursi', fk: 'semua' | number = fokusRuang) => {
    setTampilan(sudut === 'kursi' ? 'kursi' : sudut === 'atas' ? 'atas' : '3d');
    kameraKe(sudut, fk);
  };

  /** Pas seluruh ruangan (atau ruang terfokus) ke kanvas dari arah kamera sekarang. */
  const pasKeLayar = (fk: 'semua' | number = fokusRuang) => {
    const m = mesin.current; if (!m) return;
    const { target, kotak } = fokusKotak(fk);
    terbangKe(m, posisiPas(m, target, m.kamera.position.clone().sub(m.orbit.target).normalize(), kotak), target);
  };

  const zoom = (faktor: number) => {
    const m = mesin.current; if (!m) return;
    const jauh = m.kamera.position.clone().sub(m.orbit.target);
    jauh.setLength(Math.min(m.orbit.maxDistance, Math.max(m.orbit.minDistance, jauh.length() * faktor)));
    terbangKe(m, m.orbit.target.clone().add(jauh), m.orbit.target.clone());
  };

  const putarKamera = (derajat: number) => {
    const m = mesin.current; if (!m) return;
    const jauh = m.kamera.position.clone().sub(m.orbit.target).applyAxisAngle(new m.THREE.Vector3(0, 1, 0), (derajat * Math.PI) / 180);
    terbangKe(m, m.orbit.target.clone().add(jauh), m.orbit.target.clone());
  };

  /** Dekatkan kamera ke benda terpilih (arah pandang tetap). */
  const fokusBenda = () => {
    const m = mesin.current; const o = pilih ? m?.cache.get(pilih)?.obj : null;
    if (!m || !o) return;
    const kotak = new m.THREE.Box3().setFromObject(o);
    const target = kotak.getCenter(new m.THREE.Vector3());
    kotak.expandByScalar(0.5);
    terbangKe(m, posisiPas(m, target, m.kamera.position.clone().sub(m.orbit.target).normalize(), kotak, 1.15), target);
  };

  //  Pertama kali: perspektif seluruh ruangan. Ukuran ruang berubah: pas ulang
  //  dari arah kamera yang sedang dipakai (sudut pilihan pengguna tidak hilang).
  useEffect(() => {
    if (!siap) return;
    if (!kameraSiap.current) { kameraSiap.current = true; kameraKe('iso', 'semua', true); return; }
    if (sudutRef.current === 'kursi') kameraKe('kursi'); else pasKeLayar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batas.x, batas.z, batas.t, siap]);

  const terpilih = benda.find(b => b.id === pilih) ?? null;
  const gantiBenda = (baru: Benda) => setBenda(bs => bs.map(b => (b.id === baru.id ? baru : b)));

  // ── Katalog "Produk saya" (template tim) ──
  const muatProduk = async () => {
    setGalatProduk('');
    try {
      const r = await fetch(API_PRODUK, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setProdukTim({ daftar: j.daftar as ProdukTimC[], bolehTambah: j.bolehTambah !== false });
      else setGalatProduk(j?.alasan ?? 'Gagal memuat Produk saya.');
    } catch { setGalatProduk('Tidak terhubung ke server.'); }
  };
  useEffect(() => { if (sisi === 'tambah' && !produkTim) void muatProduk(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sisi]);
  /** Benda dari template: ukuran & tinggi pasang dari template, posisi bawaan di ruang tujuan. */
  const tambahProduk = (p: ProdukTimC) => {
    const k = kotakRuang[Number(targetRuang)] ?? kotakRuang[0];
    const atur = p.atur as Partial<Benda>;
    const b0 = bendaBaru(p.jenis, k, atur);
    const b1: Benda = { ...b0, w: atur.w ?? b0.w, h: atur.h ?? b0.h, d: atur.d ?? b0.d, elev: atur.elev ?? b0.elev, nama: atur.nama ?? p.label };
    const layar = b1.jenis === 'proyektor' ? layarTerdekat(b1, benda, ruang) : null;
    const b = layar ? proyektorKeLayar(b1, layar, k, ruang) : b1;
    setBenda(bs => [...bs, b]); setPilih(b.id);
  };
  const simpanProduk = async (b: Benda, label: string, ket: string): Promise<string | null> => {
    //  Posisi & id tidak ikut; konten 'gambar' (unggahan) tidak bisa jadi template.
    const { id: _id, x: _x, z: _z, rot: _r, modelKunci: _m, konten, ...atur } = b;
    void _id; void _x; void _z; void _r; void _m;
    try {
      const r = await fetch(API_PRODUK, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, ket, jenis: b.jenis, atur: { ...atur, ...(konten === 'mati' ? { konten } : {}) } }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) return j?.alasan ?? 'Gagal menyimpan produk.';
      setProdukTim(v => ({ daftar: [j.produk as ProdukTimC, ...(v?.daftar ?? [])], bolehTambah: true }));
      setPesan(`"${label}" tersimpan di Produk saya (Tambah → Produk saya).`);
      return null;
    } catch { return 'Tidak terhubung ke server.'; }
  };
  const hapusProduk = (p: ProdukTimC) => setKonfirmasi({
    message: `Hapus "${p.label}" dari Produk saya?`, danger: true, confirmLabel: 'Hapus',
    description: 'Seluruh tim tidak bisa memakainya lagi (benda yang sudah ada di desain tidak berubah).',
    onConfirm: () => void hapusProdukYa(p),
  });
  const hapusProdukYa = async (p: ProdukTimC) => {
    const r = await fetch(`${API_PRODUK}?id=${encodeURIComponent(p.id)}`, { method: 'DELETE', credentials: 'include' }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok || !j?.ok) { setGalatProduk(j?.alasan ?? 'Gagal menghapus.'); return; }
    setProdukTim(v => v && { ...v, daftar: v.daftar.filter(x => x.id !== p.id) });
  };
  /** Pasang template kategori ruangan (mengganti isi kanvas; tercatat di undo). */
  const pasangKategori = (id: KategoriRuang) => {
    const kat = KATEGORI_RUANG.find(k => k.id === id);
    if (!benda.length) { pasangKategoriYa(id); return; }
    setKonfirmasi({
      message: `Ganti isi kanvas dengan template "${kat?.judul}"?`, confirmLabel: 'Ganti isi',
      description: 'Isi kanvas sekarang diganti template ini. Bisa dikembalikan dengan Undo.',
      onConfirm: () => pasangKategoriYa(id),
    });
  };
  const pasangKategoriYa = (id: KategoriRuang) => {
    const kat = KATEGORI_RUANG.find(k => k.id === id);
    const t = templateRuang(id);
    ruangRef.current = t.ruang;
    //  Template default dibuat ulang dari kode tiap kali dipasang (terkunci - tidak ada yang bisa mengubah
    //  aslinya). Yang diubah pengguna hanya salinan di kanvas; Simpan selalu membuat file baru miliknya.
    setRuang(t.ruang); setBenda(t.benda); setNamaDesain(`${t.nama} (salinan)`);
    setDesainAktif(null); setLihatVersi(null); setAsal({ jenis: 'template', nama: kat?.judul ?? t.nama }); setDasar(null); setPilih(null); setFokusRuang('semua');
    pasSetelahTemplate.current = true;
    setPesan(id === 'mapping-objek'
      ? 'Template Mapping objek dipasang. Impor objek lewat Tambah → Impor model .glb, letakkan di atas alas - sinar proyektor langsung jatuh di permukaannya.'
      : `Template ${kat?.judul} dipasang - atur sesuai kebutuhan.`);
  };
  const tambahSetKelas = () => {
    const k = kotakRuang[Number(targetRuang)] ?? kotakRuang[0];
    const daftar = setRuangKelas(k, opsiKelas);
    setBenda(bs => [...bs, ...daftar]); setPilih(null); setBukaKelas(false);
  };

  // ── Pintu & jendela dinding luar ──
  const ubahBukaan = (id: string, x: Partial<Bukaan>) => setRuang(r => ({ ...r, bukaan: (r.bukaan ?? []).map(b => (b.id === id ? { ...b, ...x } : b)) }));
  const tambahBukaan = (jenis: Bukaan['jenis']) => setRuang(r => {
    const ri = Math.min(Math.max(0, Number(targetRuang) || 0), daftarRuang(r).length - 1);
    const sisiAda = sisiLuar(r, ri);
    const sisi: SisiDinding = jenis === 'pintu' ? (sisiAda.includes('belakang') ? 'belakang' : sisiAda[0])
      : sisiAda.includes(ri === 0 ? 'kiri' : 'kanan') ? (ri === 0 ? 'kiri' : 'kanan') : 'belakang';
    const k = daftarRuang(r)[ri] ?? daftarRuang(r)[0];
    const awal = BUKAAN_AWAL[jenis];
    const b: Bukaan = { id: idBaru(), ruang: ri, sisi, jenis, posisi: Math.round(panjangDinding(k, sisi) / 2 * 100) / 100, ...awal };
    return { ...r, bukaan: [...(r.bukaan ?? []), b] };
  });

  const tambah = (it: ItemKatalog) => {
    const k = kotakRuang[Number(targetRuang)] ?? kotakRuang[0];
    if (it.set) {
      //  Preset (mis. set ruang kelas): banyak benda sekaligus, tidak ada yang dipilih.
      const daftar = it.set(k);
      setBenda(bs => [...bs, ...daftar]); setPilih(null); setModal(null);
      return;
    }
    const b0 = bendaBaru(it.jenis, k, it.atur);
    //  Proyektor langsung menghadap layar di ruang itu (bila ada) pada jarak lempar idealnya.
    const layar = b0.jenis === 'proyektor' ? layarTerdekat(b0, benda, ruang) : null;
    const b = layar ? proyektorKeLayar(b0, layar, k, ruang) : b0;
    setBenda(bs => [...bs, b]); setPilih(b.id); setModal(null);
  };

  /** Gambar unggahan ikut ke salinan (tekstur dipakai bersama, tidak diunggah ulang). */
  const salinGambar = (dari: string, ke: string) => {
    const t = gambarLayar.current.get(dari); if (t) gambarLayar.current.set(ke, t);
  };

  const duplikat = (b: Benda) => {
    const c = { ...b, id: idBaru(), x: Math.min(batas.x, b.x + 0.6) };
    salinGambar(b.id, c.id);
    setBenda(bs => [...bs, c]); setPilih(c.id);
  };

  /** Salin satu benda ke ruang sebelah (posisi relatif sama). */
  const salinKeRuangLain = (b: Benda) => {
    const asal = ruangDari(ruang, b.x), tujuan = (asal + 1) % kotakRuang.length;
    const kA = kotakRuang[asal], kT = kotakRuang[tujuan]; if (!kA || !kT || asal === tujuan) return;
    const c = salinKeRuang(b, kA, kT);
    salinGambar(b.id, c.id);
    setBenda(bs => [...bs, c]); setPilih(c.id);
    setPesan(`${b.nama} disalin ke Ruang ${tujuan + 1}.`);
  };

  /** Salin seluruh perangkat & interior satu ruang ke ruang sebelah. */
  const salinIsiRuang = (asal: number, ganti: boolean, ke?: number) => {
    const tujuan = ke ?? (asal + 1) % kotakRuang.length;
    if (tujuan === asal) return;
    const kA = kotakRuang[asal], kT = kotakRuang[tujuan]; if (!kA || !kT) return;
    const isi = benda.filter(b => ruangDari(ruang, b.x) === asal);
    if (!isi.length) { setPesan(`Ruang ${asal + 1} masih kosong.`); return; }
    const lama = benda.filter(b => ruangDari(ruang, b.x) === tujuan);
    const lanjut = () => {
      const baru = salinIsi(isi, ruang, kA, kT);
      isi.forEach((b, i) => salinGambar(b.id, baru[i].id));
      setBenda(bs => [...(ganti ? bs.filter(b => ruangDari(ruang, b.x) !== tujuan) : bs), ...baru]);
      setPilih(null);
      setPesan(`${baru.length} benda disalin dari Ruang ${asal + 1} ke Ruang ${tujuan + 1}.`);
    };
    if (ganti && lama.length) {
      setKonfirmasi({ message: `Ganti isi Ruang ${tujuan + 1}?`, confirmLabel: 'Ganti isi', danger: true,
        description: `${lama.length} benda di sana dihapus lalu diganti salinan Ruang ${asal + 1}. Bisa dikembalikan dengan Undo.`, onConfirm: lanjut });
      return;
    }
    lanjut();
  };

  /** Tempel ke dinding ruang tempat benda berada; sisi belakang menyentuh dinding, menghadap ke dalam. */
  const tempel = (sisi: Sisi) => {
    if (!terpilih) return;
    const k: Kotak = kotakRuang[ruangDari(ruang, terpilih.x)] ?? kotakRuang[0];
    //  Display ditempel dengan bracket / struktur hollow: punggungnya berjarak sesuai pemasangan.
    const psTempel = BISA_PASANG.includes(terpilih.jenis) ? (pasangDari(terpilih) === 'standfloor' && terpilih.jenis !== 'ifp' ? (terpilih.jenis === 'led' ? 'hollow' : 'dinding') : pasangDari(terpilih)) : null;
    const tebal = terpilih.d / 2 + (psTempel ? (psTempel === 'standfloor' ? 0.06 : CELAH_PASANG[psTempel]) : 0.02);
    const xi = Math.min(k.x0 + k.p - terpilih.w / 2, Math.max(k.x0 + terpilih.w / 2, terpilih.x));
    const zi = Math.min(k.l - terpilih.w / 2, Math.max(terpilih.w / 2, terpilih.z));
    const pos: Record<Sisi, Partial<Benda>> = {
      depan: { x: xi, z: tebal, rot: 0 },
      belakang: { x: xi, z: k.l - tebal, rot: 180 },
      kiri: { x: k.x0 + tebal, z: zi, rot: 90 },
      kanan: { x: k.x0 + k.p - tebal, z: zi, rot: 270 },
    };
    const bulat = (v?: number) => (v === undefined ? v : Math.round(v * 100) / 100);
    const p = pos[sisi];
    gantiBenda({ ...terpilih, ...p, x: bulat(p.x)!, z: bulat(p.z)!, pasang: psTempel ?? terpilih.pasang });
  };

  /** Ubah ukuran ruang: isi ruang ikut menyesuaikan, tidak tertinggal di posisi lama. */
  const ubahUkuran = (fn: (r: Ruang) => Ruang) => {
    const lama = ruangRef.current, baru = fn(lama);
    ruangRef.current = baru;
    setBenda(bs => sesuaikanUkuranRuang(bs, lama, baru));
    setRuang(baru);
  };

  /** Ruang tambahan ke-j (r2 = 1, lain[0] = 2, ...). */
  const pasangSambungan = (r: Ruang, j: number, x: RuangSambung | null): Ruang => {
    if (j === 1) return { ...r, r2: x };
    const lain = [...(r.lain ?? [])];
    while (lain.length < j - 1) lain.push({ ...R2_AWAL, aktif: false });
    if (x) lain[j - 2] = x; else lain.splice(j - 2);
    return { ...r, lain };
  };
  const ubahSambungan = (j: number, x: Partial<RuangSambung>, ukur = false) => {
    const fn = (r: Ruang) => { const s0 = sambunganKe(r, j); return s0 ? pasangSambungan(r, j, { ...s0, ...x }) : r; };
    if (ukur) ubahUkuran(fn); else setRuang(fn);
  };
  /** Tambah ruang di kanan ruang terakhir (maks MAKS_RUANG). */
  const tambahRuang = () => setRuang(r => {
    const n = sambungan(r).length;
    if (n >= MAKS_RUANG - 1) return r;
    const lama = n === 0 ? r.r2 : r.lain?.[n - 1];
    return pasangSambungan(r, n + 1, { ...R2_AWAL, ...(lama ?? {}), aktif: true });
  });
  /** Hapus ruang terakhir beserta isinya (dengan konfirmasi bila ada benda). */
  const hapusRuangTerakhir = () => {
    const n = kotakRuang.length - 1; if (n < 1) return;
    const k = kotakRuang[n];
    const isi = benda.filter(b => ruangDari(ruang, b.x) === n);
    const lanjut = () => {
      setBenda(bs => bs.filter(b => !(b.x > k.x0)));
      setRuang(r => { const s0 = sambunganKe(r, n); return s0 ? pasangSambungan(r, n, n === 1 ? { ...s0, aktif: false } : null) : r; });
      setTargetRuang('0'); setFokusRuang('semua');
    };
    if (!isi.length) { lanjut(); return; }
    setKonfirmasi({ message: `Hapus ruang ${n + 1}?`, confirmLabel: 'Hapus', danger: true,
      description: `${isi.length} benda di ruang ${n + 1} ikut dihapus. Bisa dikembalikan dengan Undo.`, onConfirm: lanjut });
  };

  const unggahGambar = (file: File | null) => {
    const m = mesin.current; if (!file || !m || !terpilih) return;
    const url = URL.createObjectURL(file);
    const id = terpilih.id;
    new m.THREE.TextureLoader().load(url, tex => {
      //  Gambar sudah terunggah ke GPU - URL objeknya tidak dipakai lagi.
      URL.revokeObjectURL(url);
      tex.colorSpace = m.THREE.SRGBColorSpace;
      //  Tekstur lama dilepas hanya bila tidak dipakai salinan lain.
      const lama = gambarLayar.current.get(id);
      gambarLayar.current.set(id, tex);
      if (lama && ![...gambarLayar.current.values()].includes(lama)) lama.dispose();
      setBenda(bs => bs.map(b => (b.id === id ? { ...b, konten: 'gambar' } : b)));
      setVersiGambar(v => v + 1);
    });
  };

  const imporModel = async (file: File | null) => {
    const m = mesin.current; if (!file || !m) return;
    if (file.size > 25 * 1024 * 1024) { setGalat('Berkas model maksimal 25 MB.'); return; }
    try {
      const data = await file.arrayBuffer();
      new m.GLTFLoader().parse(data, '', g => {
        const kunci = idBaru();
        modelImpor.current.set(kunci, g.scene);
        const k = new m.THREE.Box3().setFromObject(g.scene).getSize(new m.THREE.Vector3());
        const besar = Math.max(k.x, k.y, k.z) || 1;
        // Ukuran awal dari model (dianggap meter); terlalu besar/kecil -> dinormalkan ke 1 m.
        const skala = besar > 20 || besar < 0.05 ? 1 / besar : 1;
        const kr = kotakRuang[Number(targetRuang)] ?? kotakRuang[0];
        const b: Benda = { ...bendaBaru('model', kr), nama: file.name.replace(/\.(glb|gltf)$/i, ''), w: k.x * skala || 1, h: k.y * skala || 1, d: k.z * skala || 1, modelKunci: kunci };
        setBenda(bs => [...bs, b]); setPilih(b.id); setGalat(''); setModal(null);
      }, () => setGalat('Berkas model tidak bisa dibaca. Gunakan .glb (glTF biner).'));
    } catch { setGalat('Gagal membaca berkas model.'); }
  };

  /**
   * Foto kanvas 3D (resolusi `skala` x layar) tanpa gizmo & kotak sorotan, label ukuran/jarak
   * ikut tergambar. `arah` = sudut kamera sementara; kamera dikembalikan seperti semula.
   */
  const fotoKanvas = (arah: 'sekarang' | Sudut, skala = 2): HTMLCanvasElement | null => {
    const m = mesin.current; if (!m) return null;
    const posLama = m.kamera.position.clone(), targetLama = m.orbit.target.clone(), rasioLama = m.renderer.getPixelRatio();
    const sorot = m.grupBenda.children.filter(o => o.userData.sorot);
    m.gizmo.detach(); sorot.forEach(o => { o.visible = false; });
    try {
      if (arah !== 'sekarang') {
        const { target, kotak } = fokusKotak('semua');
        m.orbit.target.copy(target);
        m.kamera.position.copy(posisiPas(m, target, new m.THREE.Vector3(...ARAH_SUDUT[arah]).normalize(), kotak));
        m.kamera.lookAt(target);
      }
      m.kamera.updateMatrixWorld();
      m.renderer.setPixelRatio(Math.min(3, rasioLama * skala));
      m.renderer.render(m.scene, m.kamera);
      m.labelRenderer.render(m.scene, m.kamera);
      const src = m.renderer.domElement;
      const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      const g = c.getContext('2d'); if (!g) return null;
      g.drawImage(src, 0, 0);
      gambarLabel(m, g, c.width, c.height);
      return c;
    } catch { return null; } finally {
      m.renderer.setPixelRatio(rasioLama);
      m.kamera.position.copy(posLama); m.orbit.target.copy(targetLama); m.orbit.update();
      sorot.forEach(o => { o.visible = true; });
      if (pilih) { const o = m.cache.get(pilih)?.obj; if (o) m.gizmo.attach(o); }
      m.renderer.render(m.scene, m.kamera); m.labelRenderer.render(m.scene, m.kamera);
    }
  };
  const namaGambar = (bagian: string) => namaBerkas(namaDesain || 'Desain AV', bagian);
  const [menuPng, setMenuPng] = useState(false);
  const [sibukPng, setSibukPng] = useState(false);
  const jalankanPng = async (kerja: () => Promise<void>) => {
    setMenuPng(false); setSibukPng(true);
    try { await kerja(); } catch { setGalat('Gambar PNG gagal dibuat.'); } finally { setSibukPng(false); }
  };
  const unduhFoto = (arah: 'sekarang' | Sudut, bagian: string) => jalankanPng(async () => {
    const c = fotoKanvas(arah, 2); if (!c) throw new Error('foto');
    await unduhKanvasPNG(c, namaGambar(bagian));
  });
  /** Empat tampak dalam satu gambar (2 x 2) dengan judul - siap dikirim ke customer. */
  const unduhEmpatTampak = () => jalankanPng(async () => {
    const foto = TAMPAK.map(t => ({ ...t, c: fotoKanvas(t.arah, 1.5) }));
    if (foto.some(x => !x.c)) throw new Error('foto');
    const w = foto[0].c!.width, h = foto[0].c!.height, k = w / 900;
    const jarak = Math.round(16 * k), kepala = Math.round(70 * k), keterangan = Math.round(34 * k);
    const c = document.createElement('canvas');
    c.width = w * 2 + jarak * 3; c.height = kepala + (h + keterangan) * 2 + jarak * 3;
    const g = c.getContext('2d'); if (!g) throw new Error('kanvas');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#1d4ed8'; g.fillRect(0, 0, c.width, kepala);
    g.fillStyle = '#ffffff'; g.textBaseline = 'middle';
    g.font = `800 ${Math.round(26 * k)}px Segoe UI, Arial, sans-serif`; g.fillText(namaDesain || 'Desain AV', jarak, kepala * 0.38);
    g.font = `${Math.round(15 * k)}px Segoe UI, Arial, sans-serif`;
    g.fillText(`Desain 3D Ruang AV · ${kotakRuang.map(r => `${f(r.p)} × ${f(r.l)} × ${f(r.t)} m`).join(' + ')} · ${benda.length} item · ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, jarak, kepala * 0.74);
    foto.forEach((x, i) => {
      const px = jarak + (i % 2) * (w + jarak), py = kepala + jarak + Math.floor(i / 2) * (h + keterangan + jarak);
      g.drawImage(x.c!, px, py);
      g.strokeStyle = '#e2e8f0'; g.lineWidth = Math.max(1, k); g.strokeRect(px, py, w, h + keterangan);
      g.fillStyle = '#f8fafc'; g.fillRect(px, py + h, w, keterangan);
      g.fillStyle = '#334155'; g.font = `700 ${Math.round(15 * k)}px Segoe UI, Arial, sans-serif`; g.fillText(x.judul, px + 10 * k, py + h + keterangan / 2);
    });
    await unduhKanvasPNG(c, namaGambar('4 tampak'));
  });

  /** Gambar layar unggahan -> data URL JPEG (maks 1920 px) supaya ikut tersimpan di file laptop. */
  const gambarKeDataUrl = (t: T.Texture): string | null => {
    try {
      const img = t.image as { width: number; height: number } & CanvasImageSource;
      if (!img?.width) return null;
      const skala = Math.min(1, 1920 / img.width);
      const c = document.createElement('canvas'); c.width = Math.round(img.width * skala); c.height = Math.round(img.height * skala);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.88);
    } catch { return null; }
  };

  /**
   * Simpan ke laptop (.glb): geometri ruang & benda (bisa dibuka SketchUp /
   * Blender) + data desain di extras supaya bisa dibuka & diedit lagi di sini.
   * Tidak memakai storage server sama sekali.
   */
  const simpanKeLaptop = () => {
    const m = mesin.current; if (!m) return;
    const isi = new m.THREE.Group();
    isi.name = namaDesain || 'Desain AV';
    isi.add(m.grupRuang.clone(true), m.grupBenda.clone(true));
    isi.traverse(o => {
      if (o.userData.sorot) o.visible = false;
      //  Tekstur tanpa transparansi (kayu, kain, pola layar, lantai) disimpan
      //  sebagai JPEG, bukan PNG bawaan exporter - file jauh lebih kecil.
      const mats = (o as T.Mesh).material;
      for (const mt of Array.isArray(mats) ? mats : mats ? [mats] : []) {
        if (mt.transparent) continue;
        for (const v of Object.values(mt)) if (v instanceof m.THREE.Texture) v.userData.mimeType = 'image/jpeg';
      }
    });
    const gambar: Record<string, string> = {};
    for (const b of benda) {
      if (b.konten !== 'gambar') continue;
      const t = gambarLayar.current.get(b.id); const url = t ? gambarKeDataUrl(t) : null;
      if (url) gambar[b.id] = url;
    }
    isi.userData = { [KUNCI_DESAIN]: dataDesainFile(namaDesain || 'Desain AV', ruang, benda, gambar) };
    new m.GLTFExporter().parse(isi, hasil => {
      const blob = new Blob([hasil as ArrayBuffer], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      unduhUrl(url, namaFileDesain(namaDesain));
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setPesan(`Tersimpan di laptop: ${namaFileDesain(namaDesain)} (${(blob.size / 1048576).toFixed(1)} MB)`);
      if (!desainAktif) { setAsal({ jenis: 'laptop', nama: namaFileDesain(namaDesain) }); setDasar(ambilKunci(ruangRef.current, bendaRef.current, namaDesain)); }
    }, () => setGalat('Simpan ke laptop gagal.'), { binary: true, maxTextureSize: 1024 });
  };
  const unduhGLB = simpanKeLaptop;

  /** Buka desain .glb dari laptop. File .glb lain (model produk) ditawarkan sebagai benda baru. */
  const bukaDariLaptop = async (file: File | null) => {
    const m = mesin.current; if (!file || !m) return;
    if (file.size > 80 * 1024 * 1024) { setGalat('File terlalu besar (maks 80 MB).'); return; }
    let buf: ArrayBuffer;
    try { buf = await file.arrayBuffer(); } catch { setGalat('File tidak bisa dibaca.'); return; }
    const d = bacaDesainGLB(buf);
    if (!d) {
      setKonfirmasi({ message: 'File ini bukan desain dari Tools Team.', confirmLabel: 'Tambahkan',
        description: 'Mungkin model produk. Tambahkan sebagai model 3D ke ruangan?', onConfirm: () => void imporModel(file) });
      return;
    }
    const namaBerkas = file.name;
    const pasang = (bendaBaru: Benda[]) => {
      const rb = { ...RUANG_AWAL, ...d.ruang };
      ruangRef.current = rb;
      setRuang(rb); setBenda(bendaBaru); setNamaDesain(d.nama);
      setAsal({ jenis: 'laptop', nama: namaBerkas }); setDasar(ambilKunci(rb, bendaBaru, d.nama));
      riwayat.mulaiBaru({ ruang: rb, benda: bendaBaru });
      setDesainAktif(null); setLihatVersi(null); setPilih(null); setModal(null); setGalat('');
      setPesan(`Dibuka dari laptop: ${d.nama}`);
    };
    //  Gambar layar unggahan dikembalikan sebagai tekstur.
    for (const [id, url] of Object.entries(d.gambar ?? {})) {
      new m.THREE.TextureLoader().load(url, tex => {
        tex.colorSpace = m.THREE.SRGBColorSpace;
        gambarLayar.current.set(id, tex);
        setVersiGambar(v => v + 1);
      });
    }
    //  Model GLB impor: ambil kembali geometrinya dari file yang sama (node ber-id benda itu).
    const adaModel = d.benda.some(b => b.jenis === 'model');
    if (!adaModel) { pasang(d.benda); return; }
    new m.GLTFLoader().parse(buf, '', g => {
      const bendaBaru = d.benda.map(b => {
        if (b.jenis !== 'model') return b;
        let node: T.Object3D | null = null;
        g.scene.traverse(o => { if (!node && o.userData?.id === b.id) node = o; });
        if (!node) return { ...b, modelKunci: undefined };
        const src = (node as T.Object3D).clone(true);
        src.position.set(0, 0, 0); src.rotation.set(0, 0, 0); src.scale.set(1, 1, 1);
        const kunci = idBaru(); modelImpor.current.set(kunci, src);
        return { ...b, modelKunci: kunci };
      });
      pasang(bendaBaru);
    }, () => pasang(d.benda.map(b => (b.jenis === 'model' ? { ...b, modelKunci: undefined } : b))));
  };

  /** Pusatkan isi tiap ruang (benda bebas digeser bersama; yang menempel dinding tetap). */
  const pusatkan = (sumbu: SumbuPusat) => {
    const baru = pusatkanIsi(benda, ruang, sumbu);
    setMenuPusat(false);
    if (baru === benda) { setPesan('Isi ruang sudah di tengah.'); return; }
    setBenda(baru);
    setPesan(`Isi ruang dipusatkan (${sumbu === 'x' ? 'kiri-kanan' : sumbu === 'z' ? 'depan-belakang' : 'kiri-kanan & depan-belakang'}). Undo bila perlu.`);
  };

  /** Lembar cetak A4 (pola Request Design Project), bukan tangkapan tampilan web; juga diekspor sebagai PNG. */
  const lembar3D = (): Lembar => {
    const foto = TAMPAK.map(t => ({ ...t, url: fotoKanvas(t.arah, 1.5)?.toDataURL('image/jpeg', 0.86) ?? '' }));
    const fm = (n: number, d = 2) => f(n, d);
    //  Daftar perangkat: dikelompokkan per kategori, benda bernama sama dijumlah.
    const kategori = (j: Benda['jenis']) =>
      j === 'lampu' ? 'Interior & pencahayaan'
        : DISPLAY.includes(j) || j === 'proyektor' || j === 'bidang' ? 'Display' : j === 'kamera' || j === 'lift' ? 'Kamera & konferensi'
        : ['speaker', 'speaker-plafon', 'mic', 'touchpanel', 'rak'].includes(j) ? 'Audio & kontrol'
          : j === 'meja' || j === 'kursi' || j === 'tribun' || j === 'panggung' ? 'Furnitur' : 'Lainnya';
    const urutKat = ['Display', 'Kamera & konferensi', 'Audio & kontrol', 'Furnitur', 'Interior & pencahayaan', 'Lainnya'];
    const grup = new Map<string, { kat: string; nama: string; ukuran: string; jumlah: number }>();
    for (const b of benda) {
      const nama = b.nama.replace(/\s+\d+\.\d+$/, '');   // "Meja kelas 2.3" -> "Meja kelas"
      const kunci = `${kategori(b.jenis)}|${nama}|${fm(b.w)}x${fm(b.d)}`;
      const ada = grup.get(kunci);
      if (ada) ada.jumlah++;
      else grup.set(kunci, { kat: kategori(b.jenis), nama, ukuran: `${fm(b.w)} × ${fm(b.h)} × ${fm(b.d)} m`, jumlah: 1 });
    }
    const baris = [...grup.values()].sort((a, b) => urutKat.indexOf(a.kat) - urutKat.indexOf(b.kat) || a.nama.localeCompare(b.nama));
    const label = jenisPandang === 'custom' ? `Custom (${faktorCustom}×)` : { detail: 'Detail (4×)', analitis: 'Analitis (6×)', umum: 'Umum (8×)' }[jenisPandang];
    const proyektor = benda.filter(b => b.jenis === 'proyektor').map(p => ({ p, sn: sinarProyektor(p, benda, ruang) }));
    const gambar = (src: string, ket: string) => (src ? `<figure><img src="${src}" alt="${esc(ket)}"/><figcaption>${esc(ket)}</figcaption></figure>` : '');
    const speaker = benda.filter(b => b.jenis === 'speaker' || b.jenis === 'speaker-plafon');
    const NAMA_TIPE: Record<string, string> = { kotak: 'Speaker box', dinding6: 'Speaker dinding 6"', kolom: 'Portable aktif (kolom)', linearray: 'Line array' };
    return {
      judul: 'Desain 3D Ruang AV',
      subjudul: namaDesain || 'Tanpa nama',
      kepala: [['Dibuat oleh', getSession<{ full_name?: string }>()?.full_name ?? '']],
      seksi: [
        { judul: 'Ruangan', jenis: 'tabel', kepala: ['Ruang', 'Panjang', 'Lebar', 'Plafon', 'Luas', ...(duaRuang ? ['Sekat dengan ruang sebelumnya'] : [])], rataKanan: [1, 2, 3, 4],
          isi: kotakRuang.map((k, i) => {
            const s0 = sambunganKe(ruang, i);
            const sekat = !s0 ? '—' : `${({ tembok: 'tembok', jendela: 'tembok + jendela kaca', kaca: 'kaca penuh', terbuka: 'terbuka (menyatu)' } as const)[s0.sekat ?? 'tembok']}${s0.pintu && s0.sekat !== 'terbuka' ? ', pintu penghubung' : ''}`;
            return [`Ruang ${i + 1}`, `${fm(k.p)} m`, `${fm(k.l)} m`, `${fm(k.t)} m`, `${fm(k.p * k.l)} m²`, ...(duaRuang ? [sekat] : [])];
          }) },
        { judul: 'Tampilan desain', jenis: 'html',
          html: `<div class="gambar dua">${foto.map(x => gambar(x.url, x.judul)).join('')}</div>` },
        ...(kabel.length ? [{ judul: 'Jadwal kabel', jenis: 'tabel' as const, kepala: ['Dari', 'Ke', 'Kabel', 'Panjang', 'Lewat'], rataKanan: [3],
          isi: [...kabel.map(k => [k.dari, k.ke, k.kabel.nama, `±${fm(k.panjang)} m`, k.lewat]),
            ...rekapKabel(kabel).map(r => ['TOTAL', '', r.kabel.nama, `±${fm(r.meter)} m`, r.gulungan])] }] : []),
        ...(benda.some(b => b.jenis === 'rak') ? [{ judul: 'Rack elevation', jenis: 'html' as const,
          html: `<div class="gambar dua">${benda.filter(b => b.jenis === 'rak').map(b => `<div>${svgElevasiRak(b)}</div>`).join('')}</div>` }] : []),
        { judul: `Daftar perangkat & furnitur (${benda.length} item)`, jenis: 'tabel', kepala: ['Kategori', 'Item', 'Ukuran (L × T × P)', 'Jumlah'], rataKanan: [3],
          isi: baris.map(r => [r.kat, r.nama, r.ukuran, String(r.jumlah)]) },
        ...(analisis.length ? [{
          judul: `Analisis jarak pandang · konten ${label}`, jenis: 'tabel' as const,
          kepala: ['Display', ...(duaRuang ? ['Ruang'] : []), 'Ukuran gambar', 'Penonton terjauh', 'Tinggi minimal', 'Sudut maks', 'Status'],
          rataKanan: duaRuang ? [3, 4, 5] : [2, 3, 4],
          isi: analisis.map(a => [a.d.nama, ...(duaRuang ? [`Ruang ${a.ri + 1}`] : []), `${fm(a.d.w)} × ${fm(a.d.h)} m`,
            a.jumlah ? `${fm(a.terjauh, 1)} m` : '—', `${fm(a.tinggiPerlu)} m`, `${fm(a.sudutMaks, 0)}°`, a.jumlah ? (a.cukup ? 'Cukup' : 'Kurang') : 'Tanpa penonton']),
        }] : []),
        ...(proyektor.length ? [{
          judul: 'Proyektor & jarak lempar', jenis: 'tabel' as const,
          kepala: ['Proyektor', 'Pemasangan', 'Sasaran', 'Jarak lempar', 'Ukuran gambar', 'Throw ratio', 'TR agar pas', 'Lumen', 'Gambar', 'Lampu di gambar', `Kontras (target ${targetKontras}:1)`],
          rataKanan: [3, 5, 6, 7, 8, 9, 10],
          isi: proyektor.map(({ p, sn }) => {
            const kp = kontrasProyektor(p, benda, ruang, targetKontras);
            return [p.nama, p.pasangProyektor === 'meja' ? 'Portabel di meja' : `Plafon (${fm(p.elev)} m dari lantai)`,
              sn.layar?.nama ?? 'Dinding / permukaan', `${fm(sn.jarak)} m`, `${fm(sn.lebar)} × ${fm(sn.tinggi)} m`, `${fm(throwRatioDari(p))} : 1`, sn.trPas ? `${fm(sn.trPas)} : 1` : '—',
              lumenDari(p).toLocaleString('id-ID'), `${fm(kp.luxGambar, 0)} lux`, `${fm(kp.cahaya.total, 0)} lux${kp.cahaya.dariLampu ? '' : ' (perkiraan)'}`,
              `${fm(kp.kontras, 1)} : 1 ${kp.cukup ? '✓' : `✗ (perlu ±${kp.lumenPerlu.toLocaleString('id-ID')} lm)`}`];
          }),
        }] : []),
        ...(benda.some(b => b.jenis === 'lampu') ? [{
          judul: `Pencahayaan · dimmer semua lampu ${ruang.dimmer ?? 100}%`, jenis: 'tabel' as const,
          kepala: ['Lampu', 'Jumlah', 'Lumen / unit', 'Sudut sinar', 'Dimmer', 'Suhu warna'], rataKanan: [1, 2, 3, 4],
          isi: [...benda.filter(b => b.jenis === 'lampu').reduce((m, b) => {
            const kunci = `${b.tipeLampu}|${lumenLampu(b)}|${sudutLampuDari(b)}|${b.dimmer ?? 100}|${b.kelvin ?? 4000}`;
            const ada = m.get(kunci); if (ada) ada.n++; else m.set(kunci, { b, n: 1 });
            return m;
          }, new Map<string, { b: Benda; n: number }>()).values()].map(({ b, n }) => [SPEK_LAMPU[b.tipeLampu ?? 'downlight'].label, String(n), `${lumenLampu(b).toLocaleString('id-ID')} lm`,
            `${fm(sudutLampuDari(b), 0)}°`, `${b.dimmer ?? 100}%`, `${b.kelvin ?? 4000} K`]).concat(kotakRuang.map((_, i) => {
            const lx = luxBidangKerja(benda, ruang, i);
            return [`Rata-rata di meja${kotakRuang.length > 1 ? ` (Ruang ${i + 1})` : ''}`, '', `±${fm(lx.rata, 0)} lux`, `min ${fm(lx.min, 0)}`, `maks ${fm(lx.maks, 0)}`, ''];
          })),
        }] : []),
        ...(speaker.length ? [{
          judul: `Audio · speaker (${speaker.length})`, jenis: 'tabel' as const,
          kepala: ['Speaker', 'Tipe', 'Pemasangan', 'Sebaran H × V', 'Jangkauan / cakupan'],
          isi: speaker.map(b => [b.nama, b.jenis === 'speaker-plafon' ? 'Speaker plafon' : `${NAMA_TIPE[tipeSpeakerDari(b)] ?? 'Speaker'}${tipeSpeakerDari(b) === 'linearray' ? ` · ${modulLA(b)} modul` : ''}`,
            b.jenis === 'speaker-plafon' ? `Plafon ${fm(b.elev)} m` : `${b.gantung ? 'Gantung' : 'Dinding / stand'} · ${fm(b.elev)} m`,
            `${fm(sebaranSpeaker(b), 0)}° × ${fm(sebaranVSpeaker(b), 0)}°${tipeSpeakerDari(b) === 'linearray' && b.jenis === 'speaker' ? ' / modul' : ''}`,
            b.jenis === 'speaker-plafon' ? `radius ±${fm(cakupanSpeakerPlafon(b), 1)} m di tinggi dengar` : `±${fm(jangkauanDari(b), 0)} m`]),
        }] : []),
      ],
      catatan: 'Aturan 4-6-8: jarak penonton terjauh maksimal 4, 6, atau 8 kali tinggi gambar untuk konten detail, analitis, atau umum. Ukuran produk mengikuti katalog bawaan; sesuaikan dengan datasheet sebelum penawaran.',
      tandaTangan: [{ label: 'Dibuat oleh', nama: getSession<{ full_name?: string }>()?.full_name ?? '' }, { label: 'Disetujui' }],
    };
  };
  const cetak = () => bukaCetak(lembar3D());
  const pngLembar = () => unduhLembarPNG(lembar3D(), namaGambar('lembar'));

  const tulisSimpanan = (daftar: typeof tersimpan) => {
    setTersimpan(daftar);
    try { localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(daftar)); } catch { /* abaikan */ }
  };
  // Gambar layar & model impor hanya ada di memori - disimpan sebagai pola uji / kotak.
  const bendaBersih = (bs: Benda[], ada: Set<string> = new Set()) => bs.map(b => ({ ...b, konten: b.konten === 'gambar' && !ada.has(b.id) ? 'pola' as const : b.konten }));
  /**
   * Gambar konten layar untuk server: JPEG maks 1280 px, kualitas diturunkan sampai <= 150 KB
   * (hemat kuota Supabase); maks 6 gambar per desain. Yang tidak muat tetap jadi pola uji.
   */
  const gambarLayarServer = (bs: Benda[]): Record<string, string> => {
    const hasil: Record<string, string> = {};
    for (const b of bs) {
      if (b.konten !== 'gambar' || Object.keys(hasil).length >= 6) continue;
      const t = gambarLayar.current.get(b.id);
      const img = t?.image as ({ width: number; height: number } & CanvasImageSource) | undefined;
      if (!img?.width) continue;
      try {
        const skala = Math.min(1, 1280 / img.width);
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * skala); cv.height = Math.round(img.height * skala);
        cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
        for (const q of [0.8, 0.68, 0.55, 0.42]) { const u = cv.toDataURL('image/jpeg', q); if (u.length <= 195_000) { hasil[b.id] = u; break; } }
      } catch { /* gambar lintas domain: lewati */ }
    }
    return hasil;
  };

  // ── Desain tim di server ──
  const API_DESAIN = '/api/tools-team/desain';
  const muatDaftarTim = async () => {
    try {
      const r = await fetch(API_DESAIN, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setDaftarTim(j.daftar as DesainTim[]);
      else { setDaftarTim([]); setStatusSimpan({ teks: j?.alasan ?? 'Daftar desain tim tidak bisa dimuat.', nada: 'galat' }); }
    } catch { setDaftarTim([]); setStatusSimpan({ teks: 'Tidak terhubung ke server.', nada: 'galat' }); }
  };
  useEffect(() => { if (modal === 'simpan') void muatDaftarTim(); }, [modal]);
  useEffect(() => {
    if ((sisi || panel) && window.innerWidth < 1024) asideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [sisi, panel]);

  /**
   * Gambar desain dari sudut kamera sekarang tanpa gizmo/sorotan: pratinjau
   * kecil (480 px) untuk daftar, dan versi tajam (±1600 px, dirender 2x) untuk
   * cetak/ZIP Request Design. Kualitas JPEG diturunkan bila melebihi batas.
   */
  const pratinjau = (): { kecil: string | null; hd: string | null } => {
    const m = mesin.current; if (!m) return { kecil: null, hd: null };
    const rasioLama = m.renderer.getPixelRatio();
    const sorot = m.grupBenda.children.filter(o => o.userData.sorot);
    try {
      m.gizmo.detach(); sorot.forEach(o => { o.visible = false; });
      m.renderer.setPixelRatio(Math.min(3, Math.max(2, rasioLama * 2)));
      m.renderer.render(m.scene, m.kamera);
      const src = m.renderer.domElement;
      const jadi = (lebar: number, maks: number) => {
        const w = Math.min(lebar, src.width), h = Math.max(1, Math.round((w * src.height) / Math.max(1, src.width)));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'); if (!g) return null;
        g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
        for (const q of [0.86, 0.74, 0.6, 0.45]) { const u = c.toDataURL('image/jpeg', q); if (u.length <= maks) return u; }
        return null;
      };
      //  Data URL base64 ±1,33x ukuran JPEG; batas di server 80 KB / 560 KB.
      return { kecil: jadi(400, 78_000), hd: jadi(1400, 550_000) };
    } catch { return { kecil: null, hd: null }; } finally {
      m.renderer.setPixelRatio(rasioLama);
      sorot.forEach(o => { o.visible = true; });
      if (pilih) { const o = m.cache.get(pilih)?.obj; if (o) m.gizmo.attach(o); }
    }
  };

  /** Simpan ke server = versi baru. Desain milik orang lain (atau `baru`) disimpan sebagai salinan. */
  const simpanServer = async (baru: boolean, sumber?: { nama: string; ruang: Ruang; benda: Benda[] }) => {
    const nama = (sumber?.nama ?? namaDesain).trim() || 'Tanpa nama';
    const timpa = !sumber && !baru && desainAktif?.bolehUbah ? desainAktif.id : undefined;
    setSibukSimpan(true); setStatusSimpan(null);
    try {
      const layar = sumber ? {} : gambarLayarServer(benda);
      const r = await fetch(API_DESAIN, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: timpa, versi: timpa ? desainAktif?.versi : undefined, nama,
          data: { ruang: sumber?.ruang ?? ruang, benda: bendaBersih(sumber?.benda ?? benda, new Set(Object.keys(layar))), ...(Object.keys(layar).length ? { layar } : {}) },
          ...(sumber ? {} : (({ kecil, hd }) => ({ gambar: kecil ?? undefined, gambar_hd: hd ?? undefined }))(pratinjau())),
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setStatusSimpan({ teks: j?.alasan ?? 'Gagal menyimpan.', nada: 'galat' }); return false; }
      if (!sumber) {
        setDesainAktif({ id: j.desain.id, bolehUbah: true, versi: j.desain.versi });
        setLihatVersi(null);
        setAsal({ jenis: 'baru' }); setDasar(ambilKunci(ruang, benda, namaDesain));
        const salinan = !timpa && !!desainAktif && !baru;
        setStatusSimpan({
          teks: timpa ? `Perubahan tersimpan sebagai v${j.desain.versi}.` : salinan ? 'Desain milik orang lain - disimpan sebagai salinan Anda (v1).' : 'Tersimpan di server (v1).',
          nada: 'ok',
        });
      }
      void muatDaftarTim();
      return true;
    } catch { setStatusSimpan({ teks: 'Tidak terhubung ke server.', nada: 'galat' }); return false; } finally { setSibukSimpan(false); }
  };

  /** Buka desain tim (versi terbaru, atau `versi` tertentu dari riwayat). */
  const bukaTim = async (id: string, versi?: number) => {
    setSibukSimpan(true); setStatusSimpan(null);
    try {
      const r = await fetch(`${API_DESAIN}?id=${encodeURIComponent(id)}${versi ? `&versi=${versi}` : ''}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        const teks = j?.alasan ?? 'Desain tidak bisa dibuka.';
        setStatusSimpan({ teks, nada: 'galat' }); setPesan(teks); return;
      }
      const d = j.desain as { id: string; nama: string; versi: number; versiTerbaru: number; data: { ruang: Ruang; benda: Benda[]; layar?: Record<string, string> }; bolehUbah: boolean };
      const ruangBaru = { ...RUANG_AWAL, ...d.data.ruang };
      //  Gambar konten layar yang ikut tersimpan di server dikembalikan sebagai tekstur.
      const m = mesin.current;
      if (m) for (const [idL, url] of Object.entries(d.data.layar ?? {})) {
        new m.THREE.TextureLoader().load(url, tex => { tex.colorSpace = m.THREE.SRGBColorSpace; gambarLayar.current.set(idL, tex); setVersiGambar(v => v + 1); });
      }
      setRuang(ruangBaru); setBenda(d.data.benda); setNamaDesain(d.nama);
      setAsal({ jenis: 'baru' }); setDasar(ambilKunci(ruangBaru, d.data.benda, d.nama));
      riwayat.mulaiBaru({ ruang: ruangBaru, benda: d.data.benda });
      //  Versi lama: menyimpan membuat versi baru dari isi ini (riwayat tidak diubah).
      setDesainAktif({ id: d.id, bolehUbah: d.bolehUbah, versi: d.versiTerbaru });
      setLihatVersi(d.versi !== d.versiTerbaru ? { versi: d.versi, terbaru: d.versiTerbaru } : null);
      setPilih(null); setModal(null);
    } catch { setStatusSimpan({ teks: 'Tidak terhubung ke server.', nada: 'galat' }); } finally { setSibukSimpan(false); }
  };

  //  Dibuka dari Request Design: /tools-team?alat=3d&desain=<id>&versi=<n>
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const id = sp.get('desain');
      if (id && /^[0-9a-f-]{36}$/i.test(id)) void bukaTim(id, Number(sp.get('versi')) || undefined);
    } catch { /* abaikan */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hapusTim = (d: DesainTim) => setKonfirmasi({
    message: `Hapus desain "${d.nama}" dari server?`, danger: true, confirmLabel: 'Hapus',
    description: 'Seluruh tim tidak bisa membukanya lagi.', onConfirm: () => void hapusTimYa(d),
  });
  const hapusTimYa = async (d: DesainTim) => {
    const r = await fetch(`${API_DESAIN}?id=${encodeURIComponent(d.id)}`, { method: 'DELETE', credentials: 'include' }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok || !j?.ok) { setStatusSimpan({ teks: j?.alasan ?? 'Gagal menghapus.', nada: 'galat' }); return; }
    if (j.diarsipkan) setStatusSimpan({ teks: `"${d.nama}" masih ditautkan ke ${j.tautan} Request Design - diarsipkan (tidak tampil di daftar), versinya tetap tersimpan untuk request itu.`, nada: 'info' });
    if (desainAktif?.id === d.id) { setDesainAktif(null); setLihatVersi(null); setAsal({ jenis: 'baru' }); setDasar(null); }
    void muatDaftarTim();
  };

  /** Pindahkan desain lama yang hanya ada di perangkat ini ke server. */
  const unggahLokal = async (t: { nama: string; ruang: Ruang; benda: Benda[] }) => {
    if (await simpanServer(true, t)) {
      tulisSimpanan(tersimpan.filter(x => x.nama !== t.nama));
      setStatusSimpan({ teks: `"${t.nama}" sekarang tersimpan di server.`, nada: 'ok' });
    }
  };

  const ringkasan = () => [
    `*Desain ruang: ${namaDesain}*`,
    ...kotakRuang.map((k, i) => `Ruang ${i + 1}: ${f(k.p)} × ${f(k.l)} m, plafon ${f(k.t)} m`),
    ...Object.entries(benda.reduce<Record<string, number>>((m, b) => { m[b.nama] = (m[b.nama] ?? 0) + 1; return m; }, {})).map(([n, j]) => `- ${n}: ${j}`),
    ...analisis.map(a => `${a.d.nama}${kotakRuang.length > 1 ? ` (ruang ${a.ri + 1})` : ''}: ${f(a.d.w)} × ${f(a.d.h)} m, penonton terjauh ${f(a.terjauh, 1)} m → tinggi perlu ${f(a.tinggiPerlu)} m (${a.cukup ? 'CUKUP' : 'KURANG'}), sudut maks ${f(a.sudutMaks, 0)}°`),
    ...benda.filter(b => b.jenis === 'proyektor').map(p => {
      const sn = sinarProyektor(p, benda, ruang);
      return `${p.nama}: jarak lempar ${f(sn.jarak)} m → gambar ${f(sn.lebar)} × ${f(sn.tinggi)} m (throw ratio ${f(throwRatioDari(p))}${sn.layar && sn.trPas ? `; pas ${sn.layar.nama} perlu ${f(sn.trPas)}` : ''})`;
    }),
  ].join('\n');

  /** Panel proyektor: jarak lempar, ukuran gambar, & tombol mengepaskan ke layar. */
  /** Kontras gambar proyektor terhadap lampu ruangan + saran lumen / dimmer. */
  const blokKontras = (p: Benda, kePermukaan: boolean) => {
    const kp = kontrasProyektor(p, benda, ruang, targetKontras);
    const warna = kp.cukup ? 'text-emerald-700' : kp.kontras >= targetKontras * 0.6 ? 'text-amber-700' : 'text-rose-700';
    //  Dimmer semua lampu agar target tercapai (lux lampu ~ sebanding dengan dimmer).
    const ambPerlu = kp.luxGambar / Math.max(0.01, targetKontras - 1);
    const dimSekarang = ruang.dimmer ?? 100;
    const luxLampu = kp.cahaya.total - kp.cahaya.siang;
    const dimPerlu = kp.cahaya.dariLampu && luxLampu > 0 ? Math.floor((((ambPerlu - kp.cahaya.siang) / luxLampu) * dimSekarang) / 5) * 5 : null;
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-2 space-y-1.5">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">Kontras vs lampu ruangan</span>
        <select aria-label="Target kontras" value={targetKontras} onChange={e => setTargetKontras(Number(e.target.value))}
          className="block w-full min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11.5px] text-slate-800">
          {TARGET_KONTRAS.map(t => <option key={t.v} value={t.v}>Target {t.l} · {t.ket}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-md bg-slate-50 px-1 py-1"><p className="text-[10.5px] text-slate-500">Gambar</p><p className="text-[13px] font-extrabold text-slate-900 tabular-nums">{f(kp.luxGambar, 0)} lux</p></div>
          <div className="rounded-md bg-slate-50 px-1 py-1"><p className="text-[10.5px] text-slate-500">Lampu di {kePermukaan ? 'permukaan' : 'layar'}</p><p className="text-[13px] font-extrabold text-slate-900 tabular-nums">{f(kp.cahaya.total, 0)} lux</p></div>
          <div className="rounded-md bg-slate-50 px-1 py-1"><p className="text-[10.5px] text-slate-500">Kontras</p><p className={`text-[13px] font-extrabold tabular-nums ${warna}`}>{f(kp.kontras, 1)} : 1</p></div>
        </div>
        <p className="text-[11.5px] text-slate-600 leading-relaxed">
          {kp.cahaya.dariLampu
            ? <>Dari {kp.cahaya.jumlahLampu} lampu (dimmer semua {dimSekarang}%): langsung {f(kp.cahaya.langsung, 0)} + pantulan ruangan {f(kp.cahaya.pantul, 0)} lux{kp.cahaya.siang > 0.5 ? <> + cahaya siang jendela {f(kp.cahaya.siang, 0)} lux</> : null}. Gambar {f(kp.luas, 1)} m² dari {lumenDari(p).toLocaleString('id-ID')} lm.</>
            : <>Belum ada lampu di desain: memakai perkiraan &quot;Cahaya ruangan {ruang.cahaya ?? 'terang'}&quot; ±{LUX_PRESET[ruang.cahaya ?? 'terang']} lux{kp.cahaya.siang > 0.5 ? <> + cahaya siang jendela {f(kp.cahaya.siang, 0)} lux</> : null}. Tambah lampu (Tambah → Interior &amp; pencahayaan) untuk hitungan nyata.</>}
        </p>
        {kp.cukup
          ? <p className="text-[12px] font-semibold text-emerald-700">Memenuhi target {targetKontras} : 1.</p>
          : (
            <div className="space-y-1">
              <p className={`text-[12px] font-semibold ${warna}`}>Di bawah target {targetKontras} : 1 - butuh proyektor ±{kp.lumenPerlu.toLocaleString('id-ID')} lm, atau kurangi cahaya lampu di {kePermukaan ? 'permukaan' : 'layar'} sampai ±{f(ambPerlu, 0)} lux.</p>
              {kp.cahaya.siang > 0.5 && (ruang.tirai ?? 0) < 100 && (
                <button type="button" onClick={() => setRuang(r => ({ ...r, tirai: 100 }))}
                  className="mr-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100">
                  Tutup tirai jendela (−{f(kp.cahaya.siang, 0)} lux)
                </button>
              )}
              {dimPerlu !== null && dimPerlu < dimSekarang && (
                <button type="button" onClick={() => setRuang(r => ({ ...r, dimmer: Math.max(0, dimPerlu) }))}
                  className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100">
                  {dimPerlu <= 0 ? 'Matikan semua lampu' : `Redupkan semua lampu ke ${dimPerlu}%`}
                </button>
              )}
            </div>
          )}
      </div>
    );
  };

  const infoProyektor = (p: Benda) => {
    const sn = sinarProyektor(p, benda, ruang);
    const k = kotakRuang[ruangDari(ruang, p.x)] ?? kotakRuang[0];
    const tombolKecil = 'px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100';
    const lyr = sn.layar;
    if (!lyr) {
      const dekat = layarTerdekat(p, benda, ruang);
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
          <p className="text-[12px] text-slate-700 leading-relaxed">
            Belum menghadap layar proyektor di ruang ini - cahaya jatuh di dinding sejauh {f(sn.jarak)} m (gambar {f(sn.lebar)} × {f(sn.tinggi)} m).
          </p>
          {dekat
            ? <button type="button" className={tombolKecil} onClick={() => gantiBenda(proyektorKeLayar(p, dekat, k, ruang))}>Arahkan ke {dekat.nama}</button>
            : <p className="text-[12px] text-slate-600">Tambahkan Layar proyektor (Tambah → Display) untuk menghitung jarak lempar.</p>}
          {blokKontras(p, true)}
        </div>
      );
    }
    const selisih = (sn.lebar - lyr.w) / lyr.w;
    const pasLebar = Math.abs(selisih) <= 0.03;
    const [zMin, zMax] = zoomLensa(p), trPas = sn.trPas ?? 0;
    const zoomBisa = trPas >= zMin - 0.005 && trPas <= zMax + 0.005;
    const sv = sn.selisihV ?? 0, sh = sn.selisihH ?? 0;
    const pasTinggi = Math.abs(sv) <= 0.03, pasSamping = Math.abs(sh) <= 0.05;
    const cm = (m: number) => `${f(Math.abs(m) * 100, 0)} cm`;
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
        <p className="text-[12px] text-slate-700 leading-relaxed">
          Ke <b>{lyr.nama}</b>: jarak lempar <b>{f(sn.jarak)} m</b>, gambar {f(sn.lebar)} × {f(sn.tinggi)} m, tilt {f(tiltDari(p), 1)}°.
          {' '}Agar pas selebar layar ({f(lyr.w)} m) perlu throw ratio <b>{f(sn.trPas ?? 0)} : 1</b>.
        </p>
        {!pasLebar && (zoomBisa ? (
          <button type="button" className={tombolKecil} onClick={() => gantiBenda({ ...p, throwRatio: Math.round(trPas * 100) / 100 })}>
            Zoom pas ke layar (TR {f(trPas, 2)} : 1)
          </button>
        ) : (
          <p className="text-[12px] font-semibold text-amber-700">
            TR {f(trPas, 2)} di luar rentang zoom lensa ({f(zMin, 2)}–{f(zMax, 2)}): pindahkan lensa ke jarak {f(zMin * lyr.w)}–{f(zMax * lyr.w)} m dari layar, atau ganti lensa.
          </p>
        ))}
        {blokKontras(p, false)}
        <ul className="text-[12px] font-semibold space-y-0.5">
          <li className={pasLebar ? 'text-emerald-700' : 'text-amber-700'}>
            {pasLebar ? 'Lebar gambar pas.' : selisih > 0 ? `Gambar melebihi lebar layar ${f(sn.lebar - lyr.w)} m.` : `Gambar kurang ${f(lyr.w - sn.lebar)} m dari lebar layar.`}
          </li>
          <li className={pasTinggi ? 'text-emerald-700' : 'text-amber-700'}>
            {pasTinggi ? 'Tinggi gambar pas di tengah layar.' : sv > 0 ? `Gambar ${cm(sv)} terlalu tinggi - tilt ke bawah (menunduk).` : `Gambar ${cm(sv)} terlalu rendah - tilt ke atas.`}
          </li>
          {!pasSamping && <li className="text-amber-700">Gambar bergeser {cm(sh)} ke {sh > 0 ? 'kanan' : 'kiri'} - atur pan.</li>}
        </ul>
        {!(pasLebar && pasTinggi && pasSamping) && (
          <div className="flex gap-1.5 flex-wrap">
            {!pasTinggi && <button type="button" className={tombolKecil} onClick={() => gantiBenda(tiltKeLayar(p, lyr, ruang))}>Atur tilt otomatis</button>}
            {!pasLebar && <button type="button" className={tombolKecil} onClick={() => gantiBenda({ ...p, throwRatio: Math.round((sn.trPas ?? 1.5) * 100) / 100 })}>Pakai throw ratio {f(sn.trPas ?? 0)}</button>}
            <button type="button" className={tombolKecil} onClick={() => gantiBenda(proyektorKeLayar(p, lyr, k, ruang))}>Posisikan otomatis ({f(throwRatioDari(p) * lyr.w)} m, pan & tilt)</button>
          </div>
        )}
      </div>
    );
  };

  const tombol = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50';
  const tombolUtama = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-700 hover:bg-blue-800';
  const tombolAktif = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-400 bg-blue-50 text-blue-800';
  const duaRuang = kotakRuang.length > 1;
  const adaProyektor = benda.some(b => b.jenis === 'proyektor');
  const grupNav = 'flex flex-col rounded-xl bg-white/95 border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100';
  const tombolSudut = (aktif: boolean) => `px-2 py-1.5 rounded-lg text-[12px] font-semibold border ${aktif ? 'bg-blue-700 border-blue-700 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`;

  return (
    <div className="space-y-3">
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
        {/* Berkas yang sedang dibuka: nama (bisa diganti langsung) + dari mana asalnya + sudah/belum tersimpan.
            Dulu kanvas tidak memberi tahu desain mana yang sedang terbuka. */}
        {(() => {
          const rinci: { teks: string; nada: 'ok' | 'info' | 'awas' } = desainAktif
            ? (!desainAktif.bolehUbah
              ? { teks: 'Desain tim · hanya lihat (Simpan = salinan Anda)', nada: 'info' }
              : lihatVersi
                ? { teks: `Melihat v${lihatVersi.versi} · terbaru v${lihatVersi.terbaru}`, nada: 'info' }
                : { teks: `Tersimpan di server · v${desainAktif.versi}`, nada: 'ok' })
            : asal.jenis === 'laptop' ? { teks: `Berkas laptop · ${asal.nama ?? '.glb'}`, nada: 'ok' }
            : asal.jenis === 'lokal' ? { teks: 'Salinan di perangkat ini · belum di server', nada: 'info' }
            : asal.jenis === 'template' ? { teks: `🔒 Dari template default "${asal.nama}" (terkunci) · Simpan = file baru milik Anda`, nada: 'info' }
            : { teks: 'Desain baru · belum disimpan', nada: 'awas' };
          const kelas = { ok: 'bg-emerald-50 text-emerald-800 border-emerald-200', info: 'bg-blue-50 text-blue-800 border-blue-200', awas: 'bg-amber-50 text-amber-900 border-amber-200' }[rinci.nada];
          return (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/70 flex-wrap" role="group" aria-label="Berkas yang sedang dibuka">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500"><Ikon nama="🧊" ukuran={14} /> Berkas</span>
              <label className="relative min-w-[160px] flex-1 max-w-[360px]" title="Klik untuk mengganti nama desain">
                <input value={namaDesain} onChange={e => setNamaDesain(e.target.value)} maxLength={80} placeholder="Ketik nama desain..." aria-label="Nama desain"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-2.5 pr-8 py-1.5 text-[14px] font-bold text-slate-900 shadow-sm hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" />
                <Pencil size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden />
              </label>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11.5px] font-semibold ${kelas}`}>{rinci.teks}</span>
              {adaPerubahan && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-900 text-[11.5px] font-semibold" title="Isi kanvas berbeda dari yang terakhir dibuka/disimpan">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Ada perubahan belum disimpan
                </span>
              )}
            </div>
          );
        })()}
        {/* Bilah alat */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => bukaSisi('kategori')} aria-pressed={sisi === 'kategori'} className={sisi === 'kategori' ? tombolAktif : tombol}
              title="Template ruangan: meeting, auditorium, smart classroom, mapping, immersive"><LayoutTemplate size={14} /> <span className="sr-only sm:not-sr-only">Kategori</span></button>
            <button type="button" onClick={() => bukaSisi('tambah')} aria-pressed={sisi === 'tambah'} className={`${tombolUtama} ${sisi === 'tambah' ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}><Ikon nama="➕" ukuran={14} /> Tambah</button>
            <button type="button" onClick={() => bukaSisi('ruang')} aria-pressed={sisi === 'ruang'} className={sisi === 'ruang' ? tombolAktif : tombol}><Ikon nama="🏠" ukuran={14} /> <span className="sr-only sm:not-sr-only">Ruangan</span></button>
            <button type="button" onClick={() => bukaSisi('daftar')} aria-pressed={sisi === 'daftar'} className={sisi === 'daftar' ? tombolAktif : tombol}><Ikon nama="📋" ukuran={14} /> <span className="sr-only sm:not-sr-only">Benda</span> ({benda.length})</button>
            <div className="relative">
              <button type="button" onClick={() => setMenuPusat(v => !v)} aria-expanded={menuPusat} className={menuPusat ? tombolUtama : tombol}
                title="Geser semua benda ke tengah ruang"><AlignCenterVertical size={14} /> <span className="sr-only sm:not-sr-only">Pusatkan isi</span></button>
              {menuPusat && (<>
                <div aria-hidden="true" className="fixed inset-0 z-20" onClick={() => setMenuPusat(false)} />
                <div className="absolute left-0 top-full mt-1.5 z-30 w-64 rounded-xl bg-white border border-slate-200 shadow-xl p-1.5">
                  {([['xz', 'Tengah ruang', 'Kiri-kanan & depan-belakang'], ['x', 'Kiri-kanan saja', 'Jarak ke layar tidak berubah'], ['z', 'Depan-belakang saja', 'Posisi kiri-kanan tetap']] as const).map(([v, l, k]) => (
                    <button key={v} type="button" onClick={() => pusatkan(v)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50">
                      <span className="block text-[13px] font-bold text-slate-900">{l}</span>
                      <span className="block text-[11.5px] text-slate-600">{k}</span>
                    </button>
                  ))}
                  <p className="px-3 pt-1.5 pb-1 text-[11px] text-slate-500 border-t border-slate-100 mt-1">
                    Meja-kursi jadi patokan tengah. Benda yang menempel dinding tetap di dindingnya; proyektor ikut layarnya.
                  </p>
                </div>
              </>)}
            </div>
            <button type="button" onClick={() => setModal('buka')} className={tombol}><FolderOpen size={14} /> <span className="sr-only sm:not-sr-only">Buka</span></button>
            {!hanyaLihat && <button type="button" onClick={() => setModal('simpan')} className={tombol}><Ikon nama="💾" ukuran={14} /> <span className="sr-only sm:not-sr-only">Simpan</span></button>}
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden" role="group" aria-label="Undo dan redo">
              <button type="button" onClick={riwayat.undo} disabled={!riwayat.bisaUndo} title="Undo (Ctrl+Z)" aria-label="Undo"
                className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-transparent"><Undo2 size={15} /></button>
              <button type="button" onClick={riwayat.redo} disabled={!riwayat.bisaRedo} title="Redo (Ctrl+Y)" aria-label="Redo"
                className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 border-l border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent"><Redo2 size={15} /></button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Segmen nilai={tampilan} onUbah={v => pilihSudut(v === 'kursi' ? 'kursi' : v === 'atas' ? 'atas' : 'iso')}
              opsi={[{ v: '3d', l: '3D' }, { v: 'atas', l: 'Atas' }, { v: 'kursi', l: 'Dari kursi' }]} />
            <div className="relative">
              <button type="button" onClick={() => setMenuPng(v => !v)} aria-expanded={menuPng} disabled={sibukPng} className={menuPng ? tombolUtama : tombol}
                title="Unduh gambar PNG (label ukuran ikut tergambar)"><Ikon nama="📷" ukuran={14} /> {sibukPng ? 'Membuat...' : 'PNG ▾'}</button>
              {menuPng && (<>
                <div aria-hidden="true" className="fixed inset-0 z-20" onClick={() => setMenuPng(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-30 w-64 rounded-xl bg-white border border-slate-200 shadow-xl p-1.5" role="menu">
                  {([
                    ['Tampilan sekarang', 'Sudut kamera saat ini', () => unduhFoto('sekarang', 'tampilan')],
                    ['Denah dari atas', 'Tata letak & ukuran', () => unduhFoto('atas', 'denah')],
                    ['Tampak depan', 'Menghadap dinding depan', () => unduhFoto('depan', 'tampak depan')],
                    ['Tampak samping', 'Dari sisi kanan ruang', () => unduhFoto('kiri', 'tampak samping')],
                    ['4 tampak dalam 1 gambar', 'Perspektif, denah, depan, samping', unduhEmpatTampak],
                    ['Lembar lengkap', 'Sama dengan Cetak, sebagai gambar', () => jalankanPng(pngLembar)],
                  ] as const).map(([l, k, aksi]) => (
                    <button key={l} type="button" role="menuitem" onClick={() => void aksi()} className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50">
                      <span className="block text-[13px] font-bold text-slate-900">{l}</span>
                      <span className="block text-[11.5px] text-slate-600">{k}</span>
                    </button>
                  ))}
                  <p className="px-3 pt-1.5 pb-1 text-[11px] text-slate-500 border-t border-slate-100 mt-1">Label yang sedang tampil (ukuran, sudut, sinar) ikut tergambar. Resolusi 2× layar.</p>
                </div>
              </>)}
            </div>
            <button type="button" onClick={unduhGLB} className={tombol} title="Simpan ke laptop (.glb) - bisa dibuka lagi di sini & di SketchUp/Blender, tanpa storage server">
              <HardDriveDownload size={14} /> <span className="sr-only sm:not-sr-only">Simpan .glb</span><span className="sm:hidden">.glb</span>
            </button>
            <TombolSalin teks={ringkasan} onCetak={cetak} />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
        <div ref={wadahRef} className="relative w-full lg:w-auto lg:flex-1 min-w-0 h-[440px] sm:h-[620px] overflow-hidden">
          {!siap && !galat && <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">Memuat tampilan 3D...</div>}
          <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1.5 max-w-[calc(100%-16px)]">
            <button type="button" onClick={() => setChipBuka(v => !v)} aria-expanded={chipBuka}
              className="sm:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/95 border border-slate-200 text-[12px] font-bold text-slate-700 shadow-sm">
              <Settings2 size={14} /> Tampilan {chipBuka ? '▴' : '▾'}
            </button>
            <div className={`${chipBuka ? 'flex' : 'hidden'} sm:flex gap-1.5 flex-wrap`}>
              {[{ v: ukur, s: setUkur, l: 'Ukuran' },
                ...(benda.some(b => DISPLAY.includes(b.jenis)) ? [{ v: garisUkur, s: setGarisUkur, l: 'Garis ukuran (mm)' }] : []),
                { v: labelProduk, s: setLabelProduk, l: 'Label produk' },
                { v: kerucut, s: setKerucut, l: 'Sudut pandang' },
                ...(adaProyektor ? [{ v: sinar, s: setSinar, l: 'Sinar proyektor' }] : []),
                ...(benda.some(b => b.jenis === 'speaker' || b.jenis === 'speaker-plafon') ? [{ v: jangkau, s: setJangkau, l: 'Jangkauan speaker' }] : []),
                ...(kabel.length ? [{ v: tampilKabel, s: setTampilKabel, l: 'Jalur kabel' }] : []),
                { v: bayangan, s: setBayangan, l: 'Bayangan & cahaya' }].map(t => (
                <label key={t.l} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/90 border border-slate-200 text-[11.5px] font-semibold text-slate-700 shadow-sm">
                  <input type="checkbox" checked={t.v} onChange={e => t.s(e.target.checked)} /> {t.l}
                </label>
              ))}
            </div>
            {/* Aksi benda terpilih: kiri-atas, di atas tombol seret/zoom. Ponsel: deret ikon mendatar (hemat tinggi); layar lebar: kolom bertulisan. */}
            {terpilih && (
              <div className="flex flex-row sm:flex-col gap-1 rounded-xl bg-white/95 border border-slate-200 shadow-sm p-1" role="toolbar" aria-label={`Aksi ${terpilih.nama}`}>
                <button type="button" onClick={() => { setSisi(null); setPanel(p => !p); }} aria-pressed={panel} title="Atur ukuran, posisi & pilihan benda"
                  className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-bold ${panel ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
                  <Settings2 size={15} /> <span className="sr-only sm:not-sr-only">Atur</span>
                </button>
                <button type="button" onClick={() => duplikat(terpilih)} title="Duplikat benda ini"
                  className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-slate-700 hover:bg-slate-100">
                  <Copy size={15} /> <span className="sr-only sm:not-sr-only">Duplikat</span>
                </button>
                {duaRuang && (
                  <button type="button" onClick={() => salinKeRuangLain(terpilih)} title={`Salin ke Ruang ${(ruangDari(ruang, terpilih.x) + 1) % kotakRuang.length + 1}`}
                    className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-slate-700 hover:bg-slate-100">
                    <CopyPlus size={15} /> <span className="sr-only sm:not-sr-only">Salin ke Ruang {(ruangDari(ruang, terpilih.x) + 1) % kotakRuang.length + 1}</span>
                  </button>
                )}
                <button type="button" onClick={() => { setBenda(b => b.filter(x => x.id !== terpilih.id)); setPilih(null); }} title="Hapus benda ini"
                  className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-rose-700 hover:bg-rose-50">
                  <Trash2 size={15} /> <span className="sr-only sm:not-sr-only">Hapus</span>
                </button>
              </div>
            )}
          </div>
          {lihatVersi && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-2 z-20 max-w-[calc(100%-120px)] px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[12px] font-semibold shadow text-center">
              Melihat v{lihatVersi.versi} (versi yang ditautkan). Versi terbaru v{lihatVersi.terbaru}. Menyimpan membuat versi baru dari isi ini; riwayat tidak berubah.
            </div>
          )}
          {pesan && (
            <div role="status" className="absolute left-1/2 -translate-x-1/2 top-12 z-20 max-w-[calc(100%-32px)] px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-[12px] font-semibold shadow-lg text-center">{pesan}</div>
          )}
          {siap && (
            <div className="absolute left-2 bottom-2 z-10 flex flex-col gap-1.5" role="toolbar" aria-label="Kontrol kamera">
              <div className={grupNav}>
                <TombolNav judul={modeSeret === 'geser' ? 'Seret = geser bidang (ketuk: ganti ke putar)' : 'Seret = putar kamera (ketuk: ganti ke geser)'}
                  aktif={modeSeret === 'geser'} onClick={() => setModeSeret(v => (v === 'geser' ? 'putar' : 'geser'))}>
                  {modeSeret === 'geser' ? <Move size={17} /> : <Rotate3d size={17} />}
                </TombolNav>
              </div>
              <div className={grupNav}>
                <TombolNav judul="Perbesar" onClick={() => zoom(0.7)}><ZoomIn size={17} /></TombolNav>
                <TombolNav judul="Perkecil" onClick={() => zoom(1.4)}><ZoomOut size={17} /></TombolNav>
              </div>
              <div className={grupNav}>
                <TombolNav judul="Putar kamera 45° ke kiri" onClick={() => putarKamera(-45)}><RotateCcw size={17} /></TombolNav>
                <TombolNav judul="Putar kamera 45° ke kanan" onClick={() => putarKamera(45)}><RotateCw size={17} /></TombolNav>
              </div>
              <div className={grupNav}>
                <TombolNav judul="Tampilkan seluruh ruangan" onClick={() => pasKeLayar()}><Maximize2 size={17} /></TombolNav>
                {terpilih && <TombolNav judul={`Fokus ke ${terpilih.nama}`} onClick={fokusBenda}><Crosshair size={17} /></TombolNav>}
                <TombolNav judul="Arah pandang" aktif={menuSudut} onClick={() => setMenuSudut(v => !v)}><Video size={17} /></TombolNav>
              </div>
            </div>
          )}
          {siap && menuSudut && (
            <div className="absolute left-14 bottom-2 z-20 w-[236px] max-w-[calc(100%-64px)] rounded-xl bg-white/95 backdrop-blur border border-slate-200 shadow-xl p-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Arah pandang</p>
              <div className="grid grid-cols-3 gap-1">
                {([['iso', '3D'], ['atas', 'Atas'], ['kursi', 'Dari kursi']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => { pilihSudut(v); setMenuSudut(false); }}
                    className={tombolSudut(v === 'iso' ? tampilan === '3d' && sudutRef.current === 'iso' : tampilan === v)}>{l}</button>
                ))}
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mt-2 mb-1.5">Menghadap dinding</p>
              <div className="grid grid-cols-2 gap-1">
                {(['depan', 'belakang', 'kiri', 'kanan'] as const).map(v => (
                  <button key={v} type="button" onClick={() => { pilihSudut(v); setMenuSudut(false); }}
                    className={`${tombolSudut(sudutRef.current === v)} capitalize`}>{v}</button>
                ))}
              </div>
              {duaRuang && (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mt-2 mb-1.5">Fokus</p>
                  <div className={`grid gap-1 ${kotakRuang.length > 2 ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-3'}`}>
                    {([['semua', 'Semua'], ...kotakRuang.map((_, i) => [i, `Ruang ${i + 1}`])] as ['semua' | number, string][]).map(([v, l]) => (
                      <button key={String(v)} type="button" onClick={() => { setFokusRuang(v); pasKeLayar(v); }}
                        className={tombolSudut(fokusRuang === v)}>{l}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {/* Panel kanan: menempel di samping kanvas (layar lebar) atau di bawahnya (ponsel/tablet), jadi tampilan 3D tidak tertutup. */}
        {(sisi || (terpilih && panel)) && (
          <aside ref={asideRef} aria-label={sisi ? JUDUL_SISI[sisi].judul : 'Atur benda'}
            className="flex flex-col min-h-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white w-full lg:w-[360px] lg:shrink-0 max-h-[70vh] lg:max-h-none h-auto lg:h-[620px]">
            {sisi ? (
              <>
                <div className="flex items-start gap-2 px-3 py-2.5 border-b border-slate-100">
                  <span className="mt-0.5 shrink-0"><Ikon nama={JUDUL_SISI[sisi].ikon} ukuran={17} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-slate-900">{JUDUL_SISI[sisi].judul}</p>
                    {JUDUL_SISI[sisi].ket && <p className="text-[11.5px] text-slate-600 leading-snug mt-0.5">{JUDUL_SISI[sisi].ket}</p>}
                  </div>
                  <button type="button" onClick={() => setSisi(null)} aria-label="Tutup panel" className="w-8 h-8 shrink-0 grid place-items-center rounded-lg text-slate-600 hover:bg-slate-100">
                    <Ikon nama="❌" ukuran={16} />
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3">
                  {sisi === 'tambah' && (
                    <>
                      {duaRuang && (
                        <div className="mb-3 max-w-xs">
                          <Segmen label="Tambah ke" nilai={targetRuang} onUbah={setTargetRuang} opsi={kotakRuang.map((_, i) => ({ v: String(i), l: `Ruang ${i + 1}` }))} />
                        </div>
                      )}
                      <div className="space-y-4">
                        {/* Produk saya: template produk yang disimpan engineer, dipakai seluruh tim. */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">⭐ Produk saya (tim)</p>
                            {produkTim && produkTim.daftar.length > 6 && (
                              <input value={cariProduk} onChange={e => setCariProduk(e.target.value)} placeholder="Cari..." aria-label="Cari produk saya"
                                className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-[12px]" />
                            )}
                          </div>
                          {galatProduk && <p className="text-[12px] font-semibold text-rose-700 mb-1">{galatProduk}</p>}
                          {!produkTim ? <p className="text-[12px] text-slate-500">Memuat...</p>
                            : produkTim.daftar.length === 0 ? (
                              <p className="text-[12px] text-slate-600 leading-relaxed">Belum ada. Atur ukuran/warna/spesifikasi sebuah benda, lalu di panel Atur pilih <b>Simpan ke Produk saya</b>.</p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
                                {produkTim.daftar.filter(p => !cariProduk.trim() || `${p.label} ${p.ket} ${p.oleh}`.toLowerCase().includes(cariProduk.trim().toLowerCase())).map(p => (
                                  <div key={p.id} className="relative">
                                    <button type="button" onClick={() => tambahProduk(p)}
                                      className="w-full h-full text-left rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-2.5 pr-7 hover:border-violet-400 hover:bg-violet-100/60">
                                      <span className="block text-[13px] font-bold text-slate-900 break-words">{p.label}</span>
                                      <span className="block text-[11.5px] text-slate-600">{p.ket || LABEL[p.jenis]}</span>
                                      <span className="block text-[10.5px] text-slate-500 mt-0.5">
                                        {typeof p.atur.w === 'number' && typeof p.atur.h === 'number' ? `${Math.round((p.atur.w as number) * 1000)} × ${Math.round((p.atur.h as number) * 1000)} mm · ` : ''}{p.oleh}
                                      </span>
                                    </button>
                                    {p.bolehHapus && (
                                      <button type="button" onClick={() => void hapusProduk(p)} aria-label={`Hapus ${p.label} dari Produk saya`} title="Hapus dari Produk saya"
                                        className="absolute top-1 right-1 w-6 h-6 grid place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700">
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                        {KATALOG.map(g => (
                          <div key={g.grup}>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">{g.grup}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
                              {g.item.map(it => (
                                <button key={it.kunci} type="button" onClick={() => (it.kunci === 'set-kelas' ? setBukaKelas(v => !v) : tambah(it))}
                                  aria-expanded={it.kunci === 'set-kelas' ? bukaKelas : undefined}
                                  className={`text-left rounded-xl border px-3 py-2.5 hover:border-blue-400 hover:bg-blue-50/60 ${it.kunci === 'set-kelas' && bukaKelas ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200'}`}>
                                  <span className="block text-[13px] font-bold text-slate-900">{it.label}</span>
                                  <span className="block text-[11.5px] text-slate-600">{it.ket}</span>
                                </button>
                              ))}
                            </div>
                            {g.item.some(it => it.kunci === 'set-kelas') && bukaKelas && (() => {
                              const k = kotakRuang[Number(targetRuang)] ?? kotakRuang[0];
                              const u = ukuranSetKelas(k, opsiKelas);
                              const setO = (x: Partial<OpsiKelas>) => setOpsiKelas(o => ({ ...o, ...x }));
                              return (
                                <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50/40 p-2.5 space-y-2">
                                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Set ruang kelas</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Angka label="Kolom meja" nilai={u.kolom} step={1} onUbah={v => v >= 1 && v <= 12 && setO({ kolom: Math.round(v) })} />
                                    <Angka label="Baris" nilai={u.baris} step={1} onUbah={v => v >= 1 && v <= 20 && setO({ baris: Math.round(v) })} />
                                    <Angka label="Jarak baris" nilai={u.jarakBaris} satuan="m" step={0.05} onUbah={v => v >= 0.8 && v <= 4 && setO({ jarakBaris: v })} />
                                    <Angka label="Celah antar meja" nilai={u.celah} satuan="m" step={0.05} onUbah={v => v >= 0.2 && v <= 3 && setO({ celah: v })} />
                                  </div>
                                  <Segmen label="Kursi per meja" nilai={String(u.perMeja)} onUbah={v => setO({ kursiPerMeja: Number(v) })}
                                    opsi={[{ v: '1', l: '1' }, { v: '2', l: '2' }, { v: '3', l: '3' }]} />
                                  <label className="flex items-center gap-2 text-[12.5px] text-slate-700">
                                    <input type="checkbox" className="w-4 h-4" checked={opsiKelas.pengajar !== false} onChange={e => setO({ pengajar: e.target.checked })} /> Meja pengajar
                                  </label>
                                  <div className="flex gap-2">
                                    <button type="button" onClick={tambahSetKelas}
                                      className="flex-1 px-3 py-2 rounded-lg text-[12.5px] font-bold text-white bg-blue-700 hover:bg-blue-800">
                                      Tambahkan {u.kolom * u.baris} meja & {u.kolom * u.baris * u.perMeja} kursi
                                    </button>
                                    <button type="button" onClick={() => setOpsiKelas({})} title="Kembali ke hitungan otomatis dari ukuran ruang"
                                      className="px-3 py-2 rounded-lg text-[12.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Otomatis</button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Model produk sendiri</p>
                          <button type="button" onClick={() => inputModel.current?.click()}
                            className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-left hover:bg-violet-100">
                            <span className="block text-[13px] font-bold text-violet-900">Impor model .glb</span>
                            <span className="block text-[11.5px] text-violet-800">Dari produsen atau Sketchfab, maks 25 MB · hanya selama halaman terbuka</span>
                          </button>
                          <input ref={inputModel} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={e => { void imporModel(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                        </div>
                      </div>
                    </>
                  )}
                  {sisi === 'ruang' && (
                    <PanelRuang ruang={ruang} setRuang={setRuang} ubahUkuran={ubahUkuran} benda={benda} kotakRuang={kotakRuang} tambahBukaan={tambahBukaan} ubahBukaan={ubahBukaan} tambahRuang={tambahRuang} hapusRuangTerakhir={hapusRuangTerakhir} ubahSambungan={ubahSambungan} pasangSambungan={pasangSambungan} gantiIsi={gantiIsi} setGantiIsi={setGantiIsi} salinIsiRuang={salinIsiRuang} duaRuang={duaRuang} />
                  )}
                  {sisi === 'kategori' && (
                    <>
                    <p className="mb-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-700 leading-relaxed">
                      <b>🔒 Template default terkunci.</b> Isinya selalu sama untuk semua pengguna - perubahan Anda di kanvas hanya mengubah salinan,
                      lalu <b>Simpan</b> menjadi file baru milik Anda. Pilih template lagi kapan saja untuk kembali ke versi aslinya.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                      {KATEGORI_RUANG.map(k => (
                        <button key={k.id} type="button" onClick={() => pasangKategori(k.id)}
                          className="flex items-start gap-3 text-left rounded-xl border border-slate-200 px-3 py-2.5 hover:border-blue-400 hover:bg-blue-50/60">
                          <span className="text-2xl leading-none mt-0.5" aria-hidden="true">{k.ikon}</span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-bold text-slate-900">{k.judul}</span>
                            <span className="block text-[11.5px] text-slate-600 leading-snug">{k.ket}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    </>
                  )}
                  {sisi === 'daftar' && (
                    <>
                      {kotakRuang.map((k, i) => {
                        const isi = benda.filter(b => ruangDari(ruang, b.x) === i);
                        return (
                          <div key={i} className="mb-3 last:mb-0">
                            {duaRuang && (
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Ruang {i + 1} · {f(k.p)} × {f(k.l)} m</p>
                                {isi.length > 0 && (
                                  <button type="button" onClick={() => salinIsiRuang(i, false)} className="inline-flex items-center gap-1 text-[12px] font-bold text-blue-700 hover:underline">
                                    <Copy size={13} /> Salin isi ke Ruang {(i + 1) % kotakRuang.length + 1}
                                  </button>
                                )}
                              </div>
                            )}
                            {isi.length === 0 ? <p className="text-sm text-slate-600">Belum ada benda.</p> : (
                              <ul className="space-y-0.5">
                                {isi.map(b => (
                                  <li key={b.id}>
                                    <button type="button" onClick={() => { setPilih(b.id); }}
                                      className={`w-full text-left px-2 py-1.5 rounded-md text-[13px] ${b.id === pilih ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-slate-800 hover:bg-slate-50'}`}>
                                      {b.nama} <span className="text-slate-500">· {f(b.x, 1)}, {f(b.z, 1)} m{b.elev > 0.05 ? ` · ${f(b.elev)} m dari lantai` : ''}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </>
            ) : terpilih && (
              <PanelBenda b={terpilih} plafon={plafonDi(terpilih.x)} batas={batas} onUbah={gantiBenda}
                onGambar={() => inputGambar.current?.click()} onTutup={() => setPanel(false)}
                ekstra={terpilih.jenis === 'proyektor' ? infoProyektor(terpilih) : undefined}
                onSimpanProduk={hanyaLihat || produkTim?.bolehTambah === false ? undefined : (label, ket) => simpanProduk(terpilih, label, ket)} />
            )}
          </aside>
        )}
        </div>
        <input ref={inputGambar} type="file" accept="image/*" className="hidden" onChange={e => { unggahGambar(e.target.files?.[0] ?? null); e.target.value = ''; }} />
        <input ref={inputLaptop} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={e => { void bukaDariLaptop(e.target.files?.[0] ?? null); e.target.value = ''; }} />

        {/* Bilah benda terpilih */}
        {terpilih ? (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100 flex-wrap bg-blue-50/50">
            <p className="text-[13px] font-bold text-slate-900 mr-1 truncate max-w-[200px]">{terpilih.nama}</p>
            <Segmen nilai={modeGizmo} onUbah={setModeGizmo} opsi={[{ v: 'translate', l: 'Geser' }, { v: 'rotate', l: 'Putar' }]} />
            {BISA_TEMPEL.includes(terpilih.jenis) && (
              <div className="flex items-center gap-1" role="group" aria-label="Tempel ke dinding">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Dinding</span>
                {(['depan', 'belakang', 'kiri', 'kanan'] as Sisi[]).map(s => (
                  <button key={s} type="button" onClick={() => tempel(s)} className="px-2 py-1 rounded-md text-[12px] font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 capitalize">{s}</button>
                ))}
              </div>
            )}
          </div>
        ) : null}
        {galat && <p className="px-3 py-2 text-[12px] font-semibold text-rose-700 border-t border-rose-100 bg-rose-50">{galat}</p>}
        <p className="px-3 py-2 text-[11.5px] text-slate-600 border-t border-slate-100">
          Klik benda untuk memilih (tombol Atur, Duplikat & Hapus muncul di kiri-atas kanvas; panel Tambah, Ruangan, Benda & Atur terbuka di samping kanan) · seret panah gizmo untuk geser (panah hijau = naik/turun) atau cincin untuk putar · tombol Dinding menempelkan benda ke sisi ruang.
          {' '}Kamera: seret = putar (tombol kiri-bawah mengganti ke geser) · klik kanan/Shift + seret = geser · roda/pinch = zoom ke titik yang ditunjuk · dua jari = zoom & geser · klik/ketuk dua kali = pusatkan ke titik itu
        </p>
      </div>

      <Kartu judul="Analisis tampilan">
        <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl">
          <div className="col-span-2">
            <Pilih label="Jenis konten" nilai={jenisPandang} onUbah={setJenisPandang} opsi={[
              { v: 'umum', l: 'Umum (video, presentasi) · 8×' }, { v: 'analitis', l: 'Analitis (dokumen) · 6×' }, { v: 'detail', l: 'Detail (gambar teknik) · 4×' },
              { v: 'custom', l: 'Custom (isi faktor sendiri)' },
            ]} />
          </div>
          {jenisPandang === 'custom' && (
            <Angka label="Faktor jarak" nilai={faktorCustom} satuan="×" step={0.1} bantuan="jarak terjauh ÷ tinggi gambar"
              onUbah={v => v >= 1 && v <= 20 && setFaktorCustom(v)} />
          )}
          <Angka label="Sudut nyaman" nilai={sudutNyaman} satuan="°" step={1} bantuan="dari sumbu layar"
            onUbah={v => v >= 5 && v <= 85 && setSudutNyaman(v)} />
        </div>
        {analisis.length === 0 ? <p className="text-sm text-slate-600">Tambahkan display (videowall/LED/layar/interactive) untuk dianalisis.</p>
          : analisis.map(a => (
            <div key={a.d.id} className="mb-3 last:mb-0">
              <p className="text-sm font-semibold text-slate-800 mb-1.5">{a.d.nama}{duaRuang ? ` · Ruang ${a.ri + 1}` : ''} · {f(a.d.w)} × {f(a.d.h)} m</p>
              {a.jumlah === 0 ? <p className="text-[12.5px] text-slate-600">Tambahkan meja atau kursi di ruang ini sebagai posisi penonton.</p> : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Nilai label="Penonton terjauh" nilai={f(a.terjauh, 1)} satuan="m" />
                  <Nilai label="Tinggi layar perlu" nilai={f(a.tinggiPerlu)} satuan="m"
                    ket={a.cukup ? 'ukuran layar cukup' : `kurang ${f((a.tinggiPerlu - a.d.h) * 100, 0)} cm`} nada={a.cukup ? 'baik' : 'buruk'} />
                  <Nilai label="Sudut pandang maks" nilai={f(a.sudutMaks, 0)} satuan="°" ket={a.sudutMaks > sudutNyaman ? 'ada kursi terlalu menyamping' : `nyaman (≤${sudutNyaman}°)`} nada={a.sudutMaks > sudutNyaman ? 'awas' : 'baik'} />
                  {a.d.jenis === 'led' && a.d.pitch
                    ? <Nilai label="Penonton terdekat" nilai={f(a.terdekat, 1)} satuan="m" ket={a.terdekat < a.d.pitch ? `di bawah jarak min P${a.d.pitch} (${a.d.pitch} m)` : 'aman untuk pitch ini'} nada={a.terdekat < a.d.pitch ? 'buruk' : 'baik'} />
                    : <Nilai label="Penonton terdekat" nilai={f(a.terdekat, 1)} satuan="m" />}
                </div>
              )}
            </div>
          ))}
        <Catatan>Posisi penonton diambil dari kursi (atau sekeliling meja bila belum ada kursi) di ruang yang sama dengan display. Aturan 4-6-8: jarak terjauh maksimal 4/6/8× tinggi gambar untuk konten detail/analitis/umum - atau faktor custom sesuai standar proyek.</Catatan>
      </Kartu>

      {(benda.some(b => b.jenis === 'rak') || kabel.length > 0) && (
        <Kartu judul="Jalur & panjang kabel" aksi={kabel.length ? <TombolSalin teks={() => [
          `*Jadwal kabel ${namaDesain || 'desain'}*`,
          ...rekapKabel(kabel).map(r => `- ${r.kabel.nama}: ${r.tarikan} tarikan, ±${f(r.meter, 1)} m (${r.gulungan})`),
          '', ...kabel.map(k => `${k.dari} → ${k.ke}: ${k.kabel.nama} ±${f(k.panjang, 1)} m lewat ${k.lewat}`),
        ].join('\n')} /> : undefined}>
          {!kabel.length ? <p className="text-sm text-slate-600">Belum ada perangkat ber-kabel (display, proyektor, kamera, speaker, mic, touch panel).</p> : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                {rekapKabel(kabel).map(r => (
                  <div key={r.kabel.kunci} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: `#${r.kabel.warna.toString(16).padStart(6, '0')}` }} />{r.kabel.nama}</p>
                    <p className="text-lg font-extrabold text-slate-900 tabular-nums">±{f(r.meter, 0)} m</p>
                    <p className="text-[11px] text-slate-500">{r.tarikan} tarikan · {r.gulungan}</p>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0"><tr>
                    <th className="text-left font-bold px-3 py-2">Dari</th><th className="text-left font-bold px-3 py-2">Ke</th>
                    <th className="text-left font-bold px-3 py-2">Kabel</th><th className="text-right font-bold px-3 py-2">Panjang</th><th className="text-left font-bold px-3 py-2">Lewat</th>
                  </tr></thead>
                  <tbody>{kabel.map(k => (
                    <tr key={k.id} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-semibold text-slate-800">{k.dari}</td><td className="px-3 py-1.5 text-slate-600">{k.ke}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap"><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle" style={{ background: `#${k.kabel.warna.toString(16).padStart(6, '0')}` }} />{k.kabel.nama}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">±{f(k.panjang, 1)} m</td><td className="px-3 py-1.5 text-slate-600">{k.lewat}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <Catatan>Rute siku-siku ke rack terdekat di ruang yang sama: perangkat dinding/plafon lewat tray plafon, perangkat meja/lantai lewat lantai (floor box). Panjang = rute + 10% lekukan + 1,5 m service loop. Video &gt; {HDMI_MAKS} m otomatis HDBaseT (CAT6A). Nyalakan &quot;Jalur kabel&quot; untuk melihat rutenya di 3D.</Catatan>
            </>
          )}
        </Kartu>
      )}

      {/* ── Modal: Buka desain tersimpan (seluruh tim) + riwayat versi ── */}
      <ModalBukaDesain buka={modal === 'buka'} onTutup={() => setModal(null)} aktifId={desainAktif?.id ?? null}
        onBuka={(id, versi) => void bukaTim(id, versi)} onLaptop={() => inputLaptop.current?.click()} />

      {/* ── Modal: Simpan / buka (server, dibagikan ke tim) ── */}
      <Modal buka={modal === 'simpan'} onTutup={() => setModal(null)} judul="Simpan & buka desain" ukuran="md" ikon={<Ikon nama="💾" ukuran={18} />}
        keterangan="Ke server: bisa dibuka seluruh tim; gambar layar unggahan ikut (dikompres, maks 6). Ke laptop: semuanya ikut termasuk model .glb impor, tanpa storage server.">
        {benda.some(b => b.jenis === 'model') && (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            Desain ini memuat <b>model 3D impor (.glb)</b>. Model tidak dikirim ke server (ukurannya besar &amp; menghabiskan kuota) - di server akan tampil sebagai kotak. Simpan juga ke laptop supaya modelnya tidak hilang.
          </p>
        )}
        <button type="button" onClick={() => { simpanKeLaptop(); }}
          className="w-full mb-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-left hover:bg-emerald-100">
          <HardDriveDownload size={20} className="text-emerald-700 flex-shrink-0" />
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-emerald-900">Simpan ke laptop (.glb)</span>
            <span className="block text-[11.5px] text-emerald-800">Termasuk gambar layar & model impor. Buka lagi lewat Buka → Dari laptop; juga bisa dibuka di SketchUp/Blender.</span>
          </span>
        </button>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Simpan ke server (tim)</p>
        <div className="flex gap-2 flex-wrap">
          <input value={namaDesain} onChange={e => setNamaDesain(e.target.value)} placeholder="Nama desain" aria-label="Nama desain"
            className="flex-1 min-w-[160px] rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
          <button type="button" disabled={sibukSimpan} onClick={() => void simpanServer(false)}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50">
            {desainAktif?.bolehUbah ? 'Simpan perubahan' : 'Simpan'}
          </button>
          {desainAktif && (
            <button type="button" disabled={sibukSimpan} onClick={() => void simpanServer(true)}
              className="px-3 py-2 rounded-xl text-sm font-bold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-50">Simpan sebagai baru</button>
          )}
        </div>
        {desainAktif && !desainAktif.bolehUbah && (
          <p className="mt-2 text-[12px] text-slate-600">Desain ini milik anggota lain. Menyimpan akan membuat salinan atas nama Anda.</p>
        )}
        {statusSimpan && (
          <p className={`mt-2 text-[12.5px] font-semibold ${statusSimpan.nada === 'galat' ? 'text-rose-700' : statusSimpan.nada === 'ok' ? 'text-emerald-700' : 'text-slate-600'}`}>{statusSimpan.teks}</p>
        )}

        <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-600">Desain tim</p>
        {daftarTim === null ? (
          <p className="mt-2 text-[12.5px] text-slate-500">Memuat...</p>
        ) : daftarTim.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-slate-500">Belum ada desain tersimpan di server.</p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-100">
            {daftarTim.map(d => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                <span className="min-w-0">
                  <button type="button" disabled={sibukSimpan} onClick={() => void bukaTim(d.id)}
                    className="block text-blue-700 font-semibold hover:underline truncate text-left max-w-full">
                    {d.nama}{desainAktif?.id === d.id && <span className="ml-1.5 text-[11px] font-bold text-emerald-700">· terbuka</span>}
                  </button>
                  <span className="block text-[11.5px] text-slate-500 truncate">
                    v{d.versi ?? 1} · {d.ruang ? `${d.ruang.p}×${d.ruang.l} m${d.ruang.r2?.aktif ? ` + ${1 + (d.ruang.lain ?? []).filter(x => x?.aktif).length} ruang` : ''} · ` : ''}{d.jumlah_benda} benda · {d.dibuat_oleh_nama || '—'}
                    {' · '}{new Date(d.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </span>
                {d.bolehUbah && (
                  <button type="button" aria-label={`Hapus ${d.nama}`} onClick={() => void hapusTim(d)}
                    className="w-7 h-7 flex-shrink-0 grid place-items-center rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50"><Ikon nama="🗑" ukuran={14} /></button>
                )}
              </li>
            ))}
          </ul>
        )}

        {tersimpan.length > 0 && (
          <>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-600">Di perangkat ini (belum di server)</p>
            <ul className="mt-1 divide-y divide-slate-100">
              {tersimpan.map(t => (
                <li key={t.nama} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                  <button type="button" onClick={() => { const rb = { ...RUANG_AWAL, ...t.ruang }; setRuang(rb); setBenda(t.benda); riwayat.mulaiBaru({ ruang: rb, benda: t.benda }); setNamaDesain(t.nama); setDesainAktif(null); setLihatVersi(null); setAsal({ jenis: 'lokal', nama: t.nama }); setDasar(ambilKunci(rb, t.benda, t.nama)); setPilih(null); setModal(null); }}
                    className="text-blue-700 font-semibold hover:underline truncate text-left">{t.nama}</button>
                  <span className="flex items-center gap-2 flex-shrink-0 text-slate-600">
                    <button type="button" disabled={sibukSimpan} onClick={() => void unggahLokal(t)}
                      className="text-[12px] font-bold text-blue-800 px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 disabled:opacity-50">Unggah ke server</button>
                    <button type="button" aria-label={`Hapus ${t.nama}`} onClick={() => tulisSimpanan(tersimpan.filter(x => x.nama !== t.nama))}
                      className="w-7 h-7 grid place-items-center rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50"><Ikon nama="🗑" ukuran={14} /></button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
    </div>
  );
}
