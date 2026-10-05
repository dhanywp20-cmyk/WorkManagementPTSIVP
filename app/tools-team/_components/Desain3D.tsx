'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type * as T from 'three';
import type { OrbitControls as KontrolOrbit } from 'three/examples/jsm/controls/OrbitControls.js';
import { AlignCenterVertical, Copy, CopyPlus, Crosshair, Settings2, Trash2, FolderOpen, HardDriveDownload, HardDriveUpload, History, Maximize2, Move, Redo2, Rotate3d, RotateCcw, RotateCw, Undo2, Video, ZoomIn, ZoomOut } from 'lucide-react';
import { bacaDesainGLB, dataDesainFile, namaFileDesain, KUNCI_DESAIN } from './desain3d/file-glb';
import { useRiwayat } from './riwayat';
import { FAKTOR_PANDANG, type JenisPandang } from '@/lib/av-hitung';
import { Angka, Pilih, Segmen, Kartu, Nilai, TombolSalin, Catatan, f } from './ui';
import { Ikon } from '@/components/shared/Ikon';
import { Modal } from '@/components/shared/Modal';
import {
  type Benda, type Ruang, type Kotak, type ItemKatalog, DISPLAY, BISA_TEMPEL, KATALOG, idBaru, bendaBaru, contohAwal,
  daftarRuang, ruangDari, titikPenonton, tandaBentuk, buatModel, sesuaikanTinggi, teksturLantai, teksturPolaUji,
  salinKeRuang, salinIsi, sesuaikanUkuranRuang, pusatkanIsi, type SumbuPusat, pintuSekat, jendelaSekat, ukuranPintu, warnaSah, JENDELA_AWAL, sinarProyektor, layarTerdekat, proyektorKeLayar, tiltKeLayar, throwRatioDari, tiltDari,
} from './desain3d/model';
import { PanelBenda } from './desain3d/PanelBenda';
import { bukaCetak, esc } from './cetak';
import { getSession } from '@/lib/auth';
import { urlGambarDesain } from '@/lib/tools-team';

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
const R2_AWAL = { aktif: true, p: 6, l: 6, t: 3, lantai: 'karpet' as const, pintu: true };

type Mesin = {
  THREE: typeof T; renderer: T.WebGLRenderer; labelRenderer: { render: (s: T.Scene, c: T.Camera) => void; setSize: (w: number, h: number) => void; domElement: HTMLElement };
  scene: T.Scene; kamera: T.PerspectiveCamera;
  orbit: KontrolOrbit;
  /** Animasi kamera yang sedang berjalan (tombol arah pandang / fokus). */ terbang: Terbang | null;
  gizmo: T.Object3D & { attach: (o: T.Object3D) => void; detach: () => void; setMode: (m: 'translate' | 'rotate') => void; showX: boolean; showY: boolean; showZ: boolean; dragging: boolean; dispose: () => void; object?: T.Object3D };
  grupRuang: T.Group; grupBenda: T.Group; grupBantu: T.Group;
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

export default function Desain3D() {
  const [ruang, setRuang] = useState<Ruang>(RUANG_AWAL);
  const [benda, setBenda] = useState<Benda[]>(() => contohAwal(RUANG_AWAL));
  const [pilih, setPilih] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [modal, setModal] = useState<'ruang' | 'tambah' | 'daftar' | 'simpan' | 'buka' | null>(null);
  const [targetRuang, setTargetRuang] = useState<'0' | '1'>('0');
  const [tampilan, setTampilan] = useState<'3d' | 'atas' | 'kursi'>('3d');
  const [modeGizmo, setModeGizmo] = useState<'translate' | 'rotate'>('translate');
  const [ukur, setUkur] = useState(true);
  const [kerucut, setKerucut] = useState(true);
  const [sinar, setSinar] = useState(true);
  /** Seret satu jari / klik kiri: putar kamera atau geser bidang. */
  const [modeSeret, setModeSeret] = useState<'putar' | 'geser'>('putar');
  const [menuSudut, setMenuSudut] = useState(false);
  const [fokusRuang, setFokusRuang] = useState<'semua' | 0 | 1>('semua');
  const [gantiIsi, setGantiIsi] = useState(false);
  const [pesan, setPesan] = useState('');
  const sudutRef = useRef<Sudut | 'kursi'>('iso');
  const kameraSiap = useRef(false);
  const [jenisPandang, setJenisPandang] = useState<JenisPandang | 'custom'>('analitis');
  /** Aturan jarak custom: jarak terjauh maksimal = faktor × tinggi gambar. */
  const [faktorCustom, setFaktorCustom] = useState(5);
  /** Sudut pandang nyaman dari sumbu layar (derajat), bawaan 45°. */
  const [sudutNyaman, setSudutNyaman] = useState(45);
  const faktorPandang = jenisPandang === 'custom' ? faktorCustom : FAKTOR_PANDANG[jenisPandang];
  const [namaDesain, setNamaDesain] = useState('Ruang Meeting');
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
        scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 0.35));

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

        const grupRuang = new THREE.Group(), grupBenda = new THREE.Group(), grupBantu = new THREE.Group();
        scene.add(grupRuang, grupBenda, grupBantu);

        mesin.current = {
          THREE, renderer, labelRenderer, scene, kamera, orbit,
          gizmo: gizmo as unknown as Mesin['gizmo'], grupRuang, grupBenda, grupBantu,
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
    const lantaiDari = (i: number) => (i === 0 ? ruang.lantai : ruang.r2?.lantai ?? 'kayu');
    const bahanDinding = new THREE.MeshStandardMaterial({ color: warnaSah(ruang.warnaDinding) ?? 0xf5f5f4, roughness: 0.95, side: THREE.FrontSide });
    const garis = new THREE.LineBasicMaterial({ color: 0xa8a29e });
    const pintuDi = pintuSekat(ruang);
    //  Sekat antar ruang: 'tembok' (bawaan), 'kaca' = kaca penuh berangka
    //  aluminium, 'jendela' = tetap tembok dengan SATU jendela kaca persegi untuk
    //  melihat ke ruang sebelah (ruang observasi / sidang).
    const jenisSekat = daftar.length > 1 ? (ruang.r2?.sekat ?? 'tembok') : 'tembok';
    const kaca = jenisSekat === 'kaca';
    const jendela = jendelaSekat(ruang);
    const bahanRangkaGelap = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.4 });
    const bahanKaca = new THREE.MeshPhysicalMaterial({
      color: 0xcfe6f5, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
    });
    const bahanRangka = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7, roughness: 0.35 });

    type Lubang = { x0: number; x1: number; y0: number; y1: number; jenis: 'pintu' | 'jendela' };
    /**
     * Dinding sepanjang `panjang`, tengah (x,z), dengan lubang (koordinat lokal
     * dinding: x sepanjang dinding, y dari lantai). `tembus` = kaca penuh;
     * `pasangKaca` = isi lubang jendela dengan kaca + kusen (cukup di SATU sisi
     * sekat - dua bidang kaca di posisi yang sama akan berkedip).
     */
    const dinding = (panjang: number, tinggi: number, x: number, z: number, rotY: number, lubang: Lubang[] = [], opsi: { tembus?: boolean; pasangKaca?: boolean } = {}) => {
      const tembus = !!opsi.tembus;
      const gw = new THREE.Group(); gw.position.set(x, 0, z); gw.rotation.y = rotY;
      const bidang = (x0: number, x1: number, y0: number, y1: number) => {
        if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
        const d = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), tembus ? bahanKaca : bahanDinding);
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
        if (l.jenis === 'pintu') {
          const kusen = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(l.x1 - l.x0, l.y1 - l.y0)), garis);
          kusen.position.set((l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2, 0.002); gw.add(kusen);
        } else if (opsi.pasangKaca) {
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

    /** Lubang di sekat, dalam koordinat lokal dinding ruang i (z dunia -> x lokal). */
    const lubangSekat = (i: number, k: Kotak): Lubang[] => {
      if (daftar.length < 2) return [];
      //  Ruang 1 dinding kanan (rotY -90°): x lokal = z - l/2. Ruang 2 dinding kiri (rotY +90°): x lokal = -(z - l/2).
      const keLokal = (z0: number, z1: number) => (i === 0 ? [z0 - k.l / 2, z1 - k.l / 2] : [-(z1 - k.l / 2), -(z0 - k.l / 2)]);
      const hasil: Lubang[] = [];
      if (pintuDi !== null) {
        const up = ukuranPintu(ruang);
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
        new THREE.MeshStandardMaterial({ map: teksturLantai(THREE, jenis, k.p, k.l, i === 0 ? ruang.warnaLantai : ruang.r2?.warnaLantai), roughness: jenis === 'keramik' ? 0.35 : 0.8 }));
      lantai.rotation.x = -Math.PI / 2; lantai.position.set(k.x0 + k.p / 2, 0, k.l / 2); lantai.receiveShadow = true;
      grupRuang.add(lantai);
      dinding(k.p, k.t, k.x0 + k.p / 2, 0, 0);                    // depan
      dinding(k.p, k.t, k.x0 + k.p / 2, k.l, Math.PI);            // belakang
      //  Kiri (rotY +90°: sumbu lokal x = -z dunia) & kanan (-90°: lokal x = +z dunia).
      //  Sekat kaca penuh cukup satu bidang (milik ruang 1) - dua bidang tembus pandang di posisi yang sama akan berkedip.
      if (!(kaca && i === 1)) dinding(k.l, k.t, k.x0, k.l / 2, Math.PI / 2, i === 1 ? lubangSekat(1, k) : []);
      dinding(k.l, k.t, k.x0 + k.p, k.l / 2, -Math.PI / 2, i === 0 ? lubangSekat(0, k) : [], { tembus: kaca && i === 0, pasangKaca: i === 0 });
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
          layar: x => (x.konten === 'mati' ? null : x.konten === 'gambar' ? gambarLayar.current.get(x.id) ?? null : teksturPolaUji(THREE, x.nama, x.w / Math.max(0.01, x.h))),
          model: k => modelImpor.current.get(k) ?? null,
        });
        obj.userData.id = b.id;
        grupBenda.add(obj);
        c = { obj, tanda }; cache.set(b.id, c);
      }
      c.obj.position.set(b.x, b.elev, b.z);
      c.obj.rotation.y = (b.rot * Math.PI) / 180;
      sesuaikanTinggi(c.obj, b, plafonDi(b.x));
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
      if (ukur) {
        label(`${d.nama}: ${f(d.w)} × ${f(d.h)} m`, new THREE.Vector3(d.x, d.elev + d.h + 0.18, d.z));
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
    // Sinar proyektor: kerucut cahaya dari lensa ke gambar di layar/dinding,
    // pekat di lensa & memudar ke layar (alpha per verteks). Warna hangat
    // (bukan putih aditif) supaya tetap terlihat di depan dinding terang.
    if (sinar) {
      for (const p of benda) {
        if (p.jenis !== 'proyektor') continue;
        const sn = sinarProyektor(p, benda, ruang);
        const O = new THREE.Vector3(...sn.asal);
        const C = sn.sudut.map(t => new THREE.Vector3(...t));
        const posisi: number[] = [], warna: number[] = [];
        for (let i = 0; i < 4; i++) {
          const a = C[i], b = C[(i + 1) % 4];
          posisi.push(O.x, O.y, O.z, a.x, a.y, a.z, b.x, b.y, b.z);
          warna.push(1, 0.84, 0.36, 0.55, 1, 0.9, 0.55, 0.12, 1, 0.9, 0.55, 0.12);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(posisi, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(warna, 4));
        const cahaya = { transparent: true, depthWrite: false, toneMapped: false };
        const kerucutSinar = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ ...cahaya, vertexColors: true, side: THREE.DoubleSide }));
        kerucutSinar.renderOrder = 2; grupBantu.add(kerucutSinar);
        const tepi: number[] = []; for (const c of C) tepi.push(O.x, O.y, O.z, c.x, c.y, c.z);
        const geoTepi = new THREE.BufferGeometry(); geoTepi.setAttribute('position', new THREE.Float32BufferAttribute(tepi, 3));
        grupBantu.add(new THREE.LineSegments(geoTepi, new THREE.LineBasicMaterial({ ...cahaya, color: 0xf59e0b, opacity: 0.6 })));
        const gambar = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([C[0], C[1], C[2], C[0], C[2], C[3]]),
          new THREE.MeshBasicMaterial({ ...cahaya, color: 0xfff1c2, opacity: sn.layar ? 0.22 : 0.4, side: THREE.DoubleSide }));
        gambar.renderOrder = 2; grupBantu.add(gambar);
        const kilau = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), new THREE.MeshBasicMaterial({ ...cahaya, color: 0xfffbeb, blending: THREE.AdditiveBlending, opacity: 0.95 }));
        kilau.position.copy(O); grupBantu.add(kilau);
        if (ukur) {
          const tengah = C.reduce((v, c) => v.add(c), new THREE.Vector3()).multiplyScalar(0.25);
          label(`${p.nama}: lempar ${f(sn.jarak)} m · gambar ${f(sn.lebar)} × ${f(sn.tinggi)} m`, O.clone().lerp(tengah, 0.3), 'abu');
        }
      }
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
  }, [analisis, ukur, kerucut, sinar, siap, kotakRuang, benda, ruang, sudutNyaman]);

  // ── Kamera ──
  /** Titik pusat & kotak batas untuk dipas ke kanvas: semua ruang atau satu ruang. */
  const fokusKotak = (fk: 'semua' | 0 | 1) => {
    const { THREE } = mesin.current!;
    const k = fk === 'semua' ? null : kotakRuang[fk] ?? null;
    const x0 = k ? k.x0 : 0, x1 = k ? k.x0 + k.p : batas.x, z1 = k ? k.l : batas.z, t = k ? k.t : batas.t;
    return { target: new THREE.Vector3((x0 + x1) / 2, Math.min(1.2, t * 0.4), z1 / 2), kotak: new THREE.Box3(new THREE.Vector3(x0, 0, 0), new THREE.Vector3(x1, t, z1)) };
  };

  const kameraKe = (sudut: Sudut | 'kursi', fk: 'semua' | 0 | 1 = fokusRuang, langsung = false) => {
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

  const pilihSudut = (sudut: Sudut | 'kursi', fk: 'semua' | 0 | 1 = fokusRuang) => {
    setTampilan(sudut === 'kursi' ? 'kursi' : sudut === 'atas' ? 'atas' : '3d');
    kameraKe(sudut, fk);
  };

  /** Pas seluruh ruangan (atau ruang terfokus) ke kanvas dari arah kamera sekarang. */
  const pasKeLayar = (fk: 'semua' | 0 | 1 = fokusRuang) => {
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
    const asal = ruangDari(ruang, b.x), tujuan = asal === 0 ? 1 : 0;
    const kA = kotakRuang[asal], kT = kotakRuang[tujuan]; if (!kA || !kT) return;
    const c = salinKeRuang(b, kA, kT);
    salinGambar(b.id, c.id);
    setBenda(bs => [...bs, c]); setPilih(c.id);
    setPesan(`${b.nama} disalin ke Ruang ${tujuan + 1}.`);
  };

  /** Salin seluruh perangkat & interior satu ruang ke ruang sebelah. */
  const salinIsiRuang = (asal: number, ganti: boolean) => {
    const tujuan = asal === 0 ? 1 : 0;
    const kA = kotakRuang[asal], kT = kotakRuang[tujuan]; if (!kA || !kT) return;
    const isi = benda.filter(b => ruangDari(ruang, b.x) === asal);
    if (!isi.length) { setPesan(`Ruang ${asal + 1} masih kosong.`); return; }
    const lama = benda.filter(b => ruangDari(ruang, b.x) === tujuan);
    if (ganti && lama.length && !window.confirm(`Ganti isi Ruang ${tujuan + 1}? ${lama.length} benda di sana dihapus lalu diganti salinan Ruang ${asal + 1}.`)) return;
    const baru = salinIsi(isi, ruang, kA, kT);
    isi.forEach((b, i) => salinGambar(b.id, baru[i].id));
    setBenda(bs => [...(ganti ? bs.filter(b => ruangDari(ruang, b.x) !== tujuan) : bs), ...baru]);
    setPilih(null);
    setPesan(`${baru.length} benda disalin dari Ruang ${asal + 1} ke Ruang ${tujuan + 1}.`);
  };

  /** Tempel ke dinding ruang tempat benda berada; sisi belakang menyentuh dinding, menghadap ke dalam. */
  const tempel = (sisi: Sisi) => {
    if (!terpilih) return;
    const k: Kotak = kotakRuang[ruangDari(ruang, terpilih.x)] ?? kotakRuang[0];
    const tebal = terpilih.d / 2 + (['videowall', 'tv', 'ifp'].includes(terpilih.jenis) ? 0.06 : 0.02);
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
    gantiBenda({ ...terpilih, ...p, x: bulat(p.x)!, z: bulat(p.z)!, pasang: terpilih.pasang === 'standfloor' && terpilih.jenis !== 'ifp' ? 'dinding' : terpilih.pasang });
  };

  /** Ubah ukuran ruang: isi ruang ikut menyesuaikan, tidak tertinggal di posisi lama. */
  const ubahUkuran = (fn: (r: Ruang) => Ruang) => {
    const lama = ruangRef.current, baru = fn(lama);
    ruangRef.current = baru;
    setBenda(bs => sesuaikanUkuranRuang(bs, lama, baru));
    setRuang(baru);
  };

  const aturRuang2 = (aktif: boolean) => {
    if (aktif) { setRuang(r => ({ ...r, r2: { ...R2_AWAL, ...(r.r2 ?? {}), aktif: true } })); return; }
    const diR2 = benda.filter(b => b.x > ruang.p);
    if (diR2.length && !window.confirm(`Matikan ruang 2? ${diR2.length} benda di ruang 2 ikut dihapus.`)) return;
    setBenda(bs => bs.filter(b => b.x <= ruang.p));
    setRuang(r => ({ ...r, r2: r.r2 ? { ...r.r2, aktif: false } : null }));
    setTargetRuang('0'); setFokusRuang('semua');
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

  const unduhPNG = () => {
    const m = mesin.current; if (!m) return;
    // Render 2× resolusi layar untuk gambar presentasi yang tajam.
    const lama = m.renderer.getPixelRatio();
    m.renderer.setPixelRatio(Math.min(3, lama * 2));
    m.gizmo.detach();
    m.renderer.render(m.scene, m.kamera);
    const a = document.createElement('a');
    a.href = m.renderer.domElement.toDataURL('image/png');
    a.download = `${(namaDesain || 'desain-av').replace(/[^\w-]+/g, '-')}.png`;
    a.click();
    m.renderer.setPixelRatio(lama);
    if (pilih) { const o = m.cache.get(pilih)?.obj; if (o) m.gizmo.attach(o); }
  };

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
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = namaFileDesain(namaDesain); a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setPesan(`Tersimpan di laptop: ${namaFileDesain(namaDesain)} (${(blob.size / 1048576).toFixed(1)} MB)`);
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
      if (window.confirm('File ini bukan desain dari Tools Team (mis. model produk). Tambahkan sebagai model 3D ke ruangan?')) void imporModel(file);
      return;
    }
    const pasang = (bendaBaru: Benda[]) => {
      const rb = { ...RUANG_AWAL, ...d.ruang };
      ruangRef.current = rb;
      setRuang(rb); setBenda(bendaBaru); setNamaDesain(d.nama);
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

  /**
   * Render satu gambar dari kanvas (2x resolusi) tanpa gizmo & kotak sorotan.
   * `atas` = denah dari atas; kamera dikembalikan seperti semula sesudahnya.
   */
  const tangkapGambar = (atas: boolean): string => {
    const m = mesin.current; if (!m) return '';
    const posLama = m.kamera.position.clone(), targetLama = m.orbit.target.clone(), rasioLama = m.renderer.getPixelRatio();
    const sorot = m.grupBenda.children.filter(o => o.userData.sorot);
    m.gizmo.detach(); sorot.forEach(o => { o.visible = false; });
    if (atas) {
      const { target, kotak } = fokusKotak('semua');
      m.orbit.target.copy(target);
      m.kamera.position.copy(posisiPas(m, target, new m.THREE.Vector3(...ARAH_SUDUT.atas).normalize(), kotak));
      m.kamera.lookAt(target);
    }
    m.renderer.setPixelRatio(Math.min(3, rasioLama * 2));
    m.renderer.render(m.scene, m.kamera);
    const url = m.renderer.domElement.toDataURL('image/jpeg', 0.9);
    m.renderer.setPixelRatio(rasioLama);
    m.kamera.position.copy(posLama); m.orbit.target.copy(targetLama); m.orbit.update();
    sorot.forEach(o => { o.visible = true; });
    if (pilih) { const o = m.cache.get(pilih)?.obj; if (o) m.gizmo.attach(o); }
    return url;
  };

  /** Lembar cetak A4 (pola Request Design Project), bukan tangkapan tampilan web. */
  const cetak = () => {
    const perspektif = tangkapGambar(false), denah = tangkapGambar(true);
    const fm = (n: number, d = 2) => f(n, d);
    //  Daftar perangkat: dikelompokkan per kategori, benda bernama sama dijumlah.
    const kategori = (j: Benda['jenis']) =>
      DISPLAY.includes(j) || j === 'proyektor' ? 'Display' : j === 'kamera' || j === 'lift' ? 'Kamera & konferensi'
        : ['speaker', 'speaker-plafon', 'mic', 'touchpanel', 'rak'].includes(j) ? 'Audio & kontrol'
          : j === 'meja' || j === 'kursi' ? 'Furnitur' : 'Lainnya';
    const urutKat = ['Display', 'Kamera & konferensi', 'Audio & kontrol', 'Furnitur', 'Lainnya'];
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
    bukaCetak({
      judul: 'Desain 3D Ruang AV',
      subjudul: namaDesain || 'Tanpa nama',
      kepala: [['Dibuat oleh', getSession<{ full_name?: string }>()?.full_name ?? '']],
      seksi: [
        { judul: duaRuang ? `Ruangan · sekat ${ruang.r2?.sekat === 'jendela' ? 'tembok dengan jendela kaca' : ruang.r2?.sekat === 'kaca' ? 'kaca' : 'tembok'}${ruang.r2?.pintu ? ' dengan pintu penghubung' : ''}` : 'Ruangan',
          jenis: 'tabel', kepala: ['Ruang', 'Panjang', 'Lebar', 'Plafon', 'Luas'], rataKanan: [1, 2, 3, 4],
          isi: kotakRuang.map((k, i) => [`Ruang ${i + 1}`, `${fm(k.p)} m`, `${fm(k.l)} m`, `${fm(k.t)} m`, `${fm(k.p * k.l)} m²`]) },
        { judul: 'Tampilan desain', jenis: 'html',
          html: `<div class="gambar dua">${gambar(perspektif, 'Perspektif')}${gambar(denah, 'Denah dari atas')}</div>` },
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
          kepala: ['Proyektor', 'Pemasangan', 'Sasaran', 'Jarak lempar', 'Ukuran gambar', 'Throw ratio', 'TR agar pas'],
          rataKanan: [3, 5, 6],
          isi: proyektor.map(({ p, sn }) => [p.nama, p.pasangProyektor === 'meja' ? 'Portabel di meja' : `Plafon (${fm(p.elev)} m dari lantai)`,
            sn.layar?.nama ?? 'Dinding (tanpa layar)', `${fm(sn.jarak)} m`, `${fm(sn.lebar)} × ${fm(sn.tinggi)} m`, `${fm(throwRatioDari(p))} : 1`, sn.trPas ? `${fm(sn.trPas)} : 1` : '—']),
        }] : []),
      ],
      catatan: 'Aturan 4-6-8: jarak penonton terjauh maksimal 4, 6, atau 8 kali tinggi gambar untuk konten detail, analitis, atau umum. Ukuran produk mengikuti katalog bawaan; sesuaikan dengan datasheet sebelum penawaran.',
      tandaTangan: [{ label: 'Dibuat oleh', nama: getSession<{ full_name?: string }>()?.full_name ?? '' }, { label: 'Disetujui' }],
    });
  };

  const tulisSimpanan = (daftar: typeof tersimpan) => {
    setTersimpan(daftar);
    try { localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(daftar)); } catch { /* abaikan */ }
  };
  // Gambar layar & model impor hanya ada di memori - disimpan sebagai pola uji / kotak.
  const bendaBersih = (bs: Benda[]) => bs.map(b => ({ ...b, konten: b.konten === 'gambar' ? 'pola' as const : b.konten }));

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
      const r = await fetch(API_DESAIN, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: timpa, versi: timpa ? desainAktif?.versi : undefined, nama,
          data: { ruang: sumber?.ruang ?? ruang, benda: bendaBersih(sumber?.benda ?? benda) },
          ...(sumber ? {} : (({ kecil, hd }) => ({ gambar: kecil ?? undefined, gambar_hd: hd ?? undefined }))(pratinjau())),
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setStatusSimpan({ teks: j?.alasan ?? 'Gagal menyimpan.', nada: 'galat' }); return false; }
      if (!sumber) {
        setDesainAktif({ id: j.desain.id, bolehUbah: true, versi: j.desain.versi });
        setLihatVersi(null);
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
      const d = j.desain as { id: string; nama: string; versi: number; versiTerbaru: number; data: { ruang: Ruang; benda: Benda[] }; bolehUbah: boolean };
      const ruangBaru = { ...RUANG_AWAL, ...d.data.ruang };
      setRuang(ruangBaru); setBenda(d.data.benda); setNamaDesain(d.nama);
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

  const hapusTim = async (d: DesainTim) => {
    if (!window.confirm(`Hapus desain "${d.nama}" dari server? Seluruh tim tidak bisa membukanya lagi.`)) return;
    const r = await fetch(`${API_DESAIN}?id=${encodeURIComponent(d.id)}`, { method: 'DELETE', credentials: 'include' }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok || !j?.ok) { setStatusSimpan({ teks: j?.alasan ?? 'Gagal menghapus.', nada: 'galat' }); return; }
    if (j.diarsipkan) setStatusSimpan({ teks: `"${d.nama}" masih ditautkan ke ${j.tautan} Request Design - diarsipkan (tidak tampil di daftar), versinya tetap tersimpan untuk request itu.`, nada: 'info' });
    if (desainAktif?.id === d.id) setDesainAktif(null);
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
        </div>
      );
    }
    const selisih = (sn.lebar - lyr.w) / lyr.w;
    const pasLebar = Math.abs(selisih) <= 0.03;
    const sv = sn.selisihV ?? 0, sh = sn.selisihH ?? 0;
    const pasTinggi = Math.abs(sv) <= 0.03, pasSamping = Math.abs(sh) <= 0.05;
    const cm = (m: number) => `${f(Math.abs(m) * 100, 0)} cm`;
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
        <p className="text-[12px] text-slate-700 leading-relaxed">
          Ke <b>{lyr.nama}</b>: jarak lempar <b>{f(sn.jarak)} m</b>, gambar {f(sn.lebar)} × {f(sn.tinggi)} m, tilt {f(tiltDari(p), 1)}°.
          {' '}Agar pas selebar layar ({f(lyr.w)} m) perlu throw ratio <b>{f(sn.trPas ?? 0)} : 1</b>.
        </p>
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
  const duaRuang = kotakRuang.length > 1;
  const adaProyektor = benda.some(b => b.jenis === 'proyektor');
  const grupNav = 'flex flex-col rounded-xl bg-white/95 border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100';
  const tombolSudut = (aktif: boolean) => `px-2 py-1.5 rounded-lg text-[12px] font-semibold border ${aktif ? 'bg-blue-700 border-blue-700 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
        {/* Bilah alat */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => setModal('tambah')} className={tombolUtama}><Ikon nama="➕" ukuran={14} /> Tambah</button>
            <button type="button" onClick={() => setModal('ruang')} className={tombol}><Ikon nama="🏠" ukuran={14} /> Ruangan</button>
            <button type="button" onClick={() => setModal('daftar')} className={tombol}><Ikon nama="📋" ukuran={14} /> Benda ({benda.length})</button>
            <div className="relative">
              <button type="button" onClick={() => setMenuPusat(v => !v)} aria-expanded={menuPusat} className={menuPusat ? tombolUtama : tombol}
                title="Geser semua benda ke tengah ruang"><AlignCenterVertical size={14} /> Pusatkan isi</button>
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
            <button type="button" onClick={() => setModal('buka')} className={tombol}><FolderOpen size={14} /> Buka</button>
            <button type="button" onClick={() => setModal('simpan')} className={tombol}><Ikon nama="💾" ukuran={14} /> Simpan</button>
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
            <button type="button" onClick={unduhPNG} className={tombol}><Ikon nama="📷" ukuran={14} /> PNG</button>
            <button type="button" onClick={unduhGLB} className={tombol} title="Simpan ke laptop (.glb) - bisa dibuka lagi di sini & di SketchUp/Blender, tanpa storage server">
              <HardDriveDownload size={14} /> Simpan .glb
            </button>
            <TombolSalin teks={ringkasan} onCetak={cetak} />
          </div>
        </div>

        <div ref={wadahRef} className="relative w-full h-[440px] sm:h-[620px] overflow-hidden">
          {!siap && !galat && <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">Memuat tampilan 3D...</div>}
          <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1.5 max-w-[calc(100%-16px)]">
            <div className="flex gap-1.5 flex-wrap">
              {[{ v: ukur, s: setUkur, l: 'Ukuran' }, { v: kerucut, s: setKerucut, l: 'Sudut pandang' },
                ...(adaProyektor ? [{ v: sinar, s: setSinar, l: 'Sinar proyektor' }] : [])].map(t => (
                <label key={t.l} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/90 border border-slate-200 text-[11.5px] font-semibold text-slate-700 shadow-sm">
                  <input type="checkbox" checked={t.v} onChange={e => t.s(e.target.checked)} /> {t.l}
                </label>
              ))}
            </div>
            {/* Aksi benda terpilih: kiri-atas, di atas tombol seret/zoom. Ponsel: deret ikon mendatar (hemat tinggi); layar lebar: kolom bertulisan. */}
            {terpilih && (
              <div className="flex flex-row sm:flex-col gap-1 rounded-xl bg-white/95 border border-slate-200 shadow-sm p-1" role="toolbar" aria-label={`Aksi ${terpilih.nama}`}>
                <button type="button" onClick={() => setPanel(p => !p)} aria-pressed={panel} title="Atur ukuran, posisi & pilihan benda"
                  className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-bold ${panel ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
                  <Settings2 size={15} /> <span className="hidden sm:inline">Atur</span>
                </button>
                <button type="button" onClick={() => duplikat(terpilih)} title="Duplikat benda ini"
                  className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-slate-700 hover:bg-slate-100">
                  <Copy size={15} /> <span className="hidden sm:inline">Duplikat</span>
                </button>
                {duaRuang && (
                  <button type="button" onClick={() => salinKeRuangLain(terpilih)} title={`Salin ke Ruang ${ruangDari(ruang, terpilih.x) === 0 ? 2 : 1}`}
                    className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-slate-700 hover:bg-slate-100">
                    <CopyPlus size={15} /> <span className="hidden sm:inline">Salin ke Ruang {ruangDari(ruang, terpilih.x) === 0 ? 2 : 1}</span>
                  </button>
                )}
                <button type="button" onClick={() => { setBenda(b => b.filter(x => x.id !== terpilih.id)); setPilih(null); }} title="Hapus benda ini"
                  className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-rose-700 hover:bg-rose-50">
                  <Trash2 size={15} /> <span className="hidden sm:inline">Hapus</span>
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
                  <div className="grid grid-cols-3 gap-1">
                    {([['semua', 'Semua'], [0, 'Ruang 1'], [1, 'Ruang 2']] as const).map(([v, l]) => (
                      <button key={String(v)} type="button" onClick={() => { setFokusRuang(v); pasKeLayar(v); }}
                        className={tombolSudut(fokusRuang === v)}>{l}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {terpilih && panel && (
            <PanelBenda b={terpilih} plafon={plafonDi(terpilih.x)} batas={batas} onUbah={gantiBenda}
              onGambar={() => inputGambar.current?.click()} onTutup={() => setPanel(false)}
              ekstra={terpilih.jenis === 'proyektor' ? infoProyektor(terpilih) : undefined} />
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
          Klik benda untuk memilih (tombol Atur, Duplikat & Hapus muncul di kiri-atas kanvas) · seret panah gizmo untuk geser (panah hijau = naik/turun) atau cincin untuk putar · tombol Dinding menempelkan benda ke sisi ruang.
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

      {/* ── Modal: Tambah benda ── */}
      <Modal buka={modal === 'tambah'} onTutup={() => setModal(null)} judul="Tambah benda" ukuran="lg" ikon={<Ikon nama="➕" ukuran={18} />}
        keterangan="Pilih produk; ukuran, posisi, dan dinding bisa diatur setelah ditambahkan.">
        {duaRuang && (
          <div className="mb-3 max-w-xs">
            <Segmen label="Tambah ke" nilai={targetRuang} onUbah={setTargetRuang} opsi={[{ v: '0', l: 'Ruang 1' }, { v: '1', l: 'Ruang 2' }]} />
          </div>
        )}
        <div className="space-y-4">
          {KATALOG.map(g => (
            <div key={g.grup}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">{g.grup}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {g.item.map(it => (
                  <button key={it.kunci} type="button" onClick={() => tambah(it)}
                    className="text-left rounded-xl border border-slate-200 px-3 py-2.5 hover:border-blue-400 hover:bg-blue-50/60">
                    <span className="block text-[13px] font-bold text-slate-900">{it.label}</span>
                    <span className="block text-[11.5px] text-slate-600">{it.ket}</span>
                  </button>
                ))}
              </div>
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
      </Modal>

      {/* ── Modal: Ruangan ── */}
      <Modal buka={modal === 'ruang'} onTutup={() => setModal(null)} judul="Ruangan" ukuran="md" ikon={<Ikon nama="🏠" ukuran={18} />}
        keterangan="Maksimal 2 ruang bersebelahan. Ruang 2 berada di sisi kanan ruang 1. Saat ukuran diubah, isi ruang ikut menyesuaikan: yang menempel dinding tetap menempel, meja-kursi tetap di tengah."
        footer={<button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-700 hover:bg-blue-800">Selesai</button>}>
        <div className="space-y-4">
          <div>
            <p className="text-[12.5px] font-bold text-slate-800 mb-1.5">Ruang 1</p>
            <div className="grid grid-cols-3 gap-2">
              <Angka label="Panjang" nilai={ruang.p} onUbah={v => v >= 2 && v <= 30 && ubahUkuran(r => ({ ...r, p: v }))} satuan="m" />
              <Angka label="Lebar" nilai={ruang.l} onUbah={v => v >= 2 && v <= 30 && ubahUkuran(r => ({ ...r, l: v }))} satuan="m" />
              <Angka label="Plafon" nilai={ruang.t} onUbah={v => v >= 2 && v <= 15 && ubahUkuran(r => ({ ...r, t: v }))} satuan="m" />
            </div>
            <div className="mt-2">
              <Segmen label="Lantai" nilai={ruang.lantai} onUbah={v => setRuang(r => ({ ...r, lantai: v }))}
                opsi={[{ v: 'kayu', l: 'Kayu' }, { v: 'karpet', l: 'Karpet' }, { v: 'keramik', l: 'Keramik' }, { v: 'polos', l: 'Warna' }]} />
              {ruang.lantai === 'polos' && (
                <PilihWarna label="Warna lantai" nilai={ruang.warnaLantai} awal="#9ca3af" onUbah={w => setRuang(r => ({ ...r, warnaLantai: w }))} />
              )}
            </div>
          </div>
          <PilihWarna label="Warna dinding (semua ruang)" nilai={ruang.warnaDinding} awal="#f5f5f4" onUbah={w => setRuang(r => ({ ...r, warnaDinding: w }))} />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input type="checkbox" className="w-4 h-4" checked={!!ruang.r2?.aktif} onChange={e => aturRuang2(e.target.checked)} /> Ruang ke-2 bersebelahan
          </label>
          {ruang.r2?.aktif && (
            <div>
              <div className="grid grid-cols-3 gap-2">
                <Angka label="Panjang" nilai={ruang.r2.p} onUbah={v => v >= 2 && v <= 30 && ubahUkuran(r => ({ ...r, r2: r.r2 && { ...r.r2, p: v } }))} satuan="m" />
                <Angka label="Lebar" nilai={ruang.r2.l} onUbah={v => v >= 2 && v <= 30 && ubahUkuran(r => ({ ...r, r2: r.r2 && { ...r.r2, l: v } }))} satuan="m" />
                <Angka label="Plafon" nilai={ruang.r2.t} onUbah={v => v >= 2 && v <= 15 && ubahUkuran(r => ({ ...r, r2: r.r2 && { ...r.r2, t: v } }))} satuan="m" />
              </div>
              <div className="mt-2">
                <Segmen label="Lantai" nilai={ruang.r2.lantai} onUbah={v => setRuang(r => ({ ...r, r2: r.r2 && { ...r.r2, lantai: v } }))}
                  opsi={[{ v: 'kayu', l: 'Kayu' }, { v: 'karpet', l: 'Karpet' }, { v: 'keramik', l: 'Keramik' }, { v: 'polos', l: 'Warna' }]} />
                {ruang.r2.lantai === 'polos' && (
                  <PilihWarna label="Warna lantai" nilai={ruang.r2.warnaLantai} awal="#9ca3af" onUbah={w => setRuang(r => ({ ...r, r2: r.r2 && { ...r.r2, warnaLantai: w } }))} />
                )}
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="w-4 h-4" checked={ruang.r2.pintu} onChange={e => setRuang(r => ({ ...r, r2: r.r2 && { ...r.r2, pintu: e.target.checked } }))} /> Pintu penghubung
              </label>
              {ruang.r2.pintu && (() => {
                const up = ukuranPintu(ruang), z = pintuSekat(ruang) ?? 0;
                const setP = (x: Partial<{ lebar: number; tinggi: number; z: number }>) =>
                  setRuang(r => ({ ...r, r2: r.r2 && { ...r.r2, pintuUkuran: { lebar: ukuranPintu(r).lebar, tinggi: ukuranPintu(r).tinggi, z: pintuSekat(r) ?? undefined, ...x } } }));
                return (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Angka label="Lebar pintu" nilai={Math.round(up.lebar * 100) / 100} satuan="m" onUbah={v => v >= 0.5 && v <= 6 && setP({ lebar: v })} />
                    <Angka label="Tinggi pintu" nilai={Math.round(up.tinggi * 100) / 100} satuan="m" onUbah={v => v >= 1.5 && v <= 5 && setP({ tinggi: v })} />
                    <Angka label="Dari depan" nilai={Math.round(z * 100) / 100} satuan="m" onUbah={v => v >= 0 && v <= 30 && setP({ z: v })} />
                  </div>
                );
              })()}
              <div className="mt-2">
                <Segmen label="Sekat antar ruang" nilai={ruang.r2.sekat ?? 'tembok'} onUbah={v => setRuang(r => ({ ...r, r2: r.r2 && { ...r.r2, sekat: v } }))}
                  opsi={[{ v: 'tembok', l: 'Tembok' }, { v: 'jendela', l: 'Tembok + jendela kaca' }, { v: 'kaca', l: 'Kaca penuh' }]} />
                {ruang.r2.sekat === 'jendela' && (() => {
                  const j = { ...JENDELA_AWAL, ...(ruang.r2.jendela ?? {}) };
                  const setJ = (x: Partial<typeof j>) => setRuang(r => ({ ...r, r2: r.r2 && { ...r.r2, jendela: { ...JENDELA_AWAL, ...(r.r2.jendela ?? {}), ...x } } }));
                  return (
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Angka label="Lebar jendela" nilai={j.lebar} satuan="m" onUbah={v => v >= 0.3 && v <= 20 && setJ({ lebar: v })} />
                      <Angka label="Tinggi jendela" nilai={j.tinggi} satuan="m" onUbah={v => v >= 0.2 && v <= 5 && setJ({ tinggi: v })} />
                      <Angka label="Dari lantai" nilai={j.ambang} satuan="m" onUbah={v => v >= 0.1 && v <= 3 && setJ({ ambang: v })} />
                      <Angka label="Geser" nilai={j.geser} satuan="m" min={-20} onUbah={v => v >= -20 && v <= 20 && setJ({ geser: v })} />
                    </div>
                  );
                })()}
                <p className="text-[11px] text-slate-500 mt-1">
                  {ruang.r2.sekat === 'jendela' ? 'Satu jendela kaca persegi di tengah sekat untuk melihat ke ruang sebelah. Geser: + ke belakang, − ke depan; otomatis menghindari pintu.' : 'Kaca penuh: seluruh sekat tembus pandang.'}
                </p>
              </div>
            </div>
          )}
          {ruang.r2?.aktif && (
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[12.5px] font-bold text-slate-800">Salin perangkat & interior ke ruang sebelah</p>
              <p className="text-[12px] text-slate-600 mt-0.5 leading-relaxed">
                Benda yang menempel dinding tetap menempel, perangkat plafon tetap di plafon, susunan meja-kursi tetap di tengah ruang - walau ukuran ruang berbeda.
              </p>
              <label className="mt-2 flex items-center gap-2 text-[12.5px] text-slate-700">
                <input type="checkbox" className="w-4 h-4" checked={gantiIsi} onChange={e => setGantiIsi(e.target.checked)} /> Kosongkan ruang tujuan dulu
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[0, 1].map(i => (
                  <button key={i} type="button" onClick={() => salinIsiRuang(i, gantiIsi)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-bold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100">
                    <Copy size={14} /> Ruang {i + 1} → Ruang {i === 0 ? 2 : 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal: Daftar benda ── */}
      <Modal buka={modal === 'daftar'} onTutup={() => setModal(null)} judul="Daftar benda" ukuran="md" ikon={<Ikon nama="📋" ukuran={18} />}>
        {kotakRuang.map((k, i) => {
          const isi = benda.filter(b => ruangDari(ruang, b.x) === i);
          return (
            <div key={i} className="mb-3 last:mb-0">
              {duaRuang && (
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Ruang {i + 1} · {f(k.p)} × {f(k.l)} m</p>
                  {isi.length > 0 && (
                    <button type="button" onClick={() => salinIsiRuang(i, false)} className="inline-flex items-center gap-1 text-[12px] font-bold text-blue-700 hover:underline">
                      <Copy size={13} /> Salin isi ke Ruang {i === 0 ? 2 : 1}
                    </button>
                  )}
                </div>
              )}
              {isi.length === 0 ? <p className="text-sm text-slate-600">Belum ada benda.</p> : (
                <ul className="space-y-0.5">
                  {isi.map(b => (
                    <li key={b.id}>
                      <button type="button" onClick={() => { setPilih(b.id); setModal(null); }}
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
      </Modal>

      {/* ── Modal: Buka desain tersimpan (seluruh tim) + riwayat versi ── */}
      <ModalBukaDesain buka={modal === 'buka'} onTutup={() => setModal(null)} aktifId={desainAktif?.id ?? null}
        onBuka={(id, versi) => void bukaTim(id, versi)} onLaptop={() => inputLaptop.current?.click()} />

      {/* ── Modal: Simpan / buka (server, dibagikan ke tim) ── */}
      <Modal buka={modal === 'simpan'} onTutup={() => setModal(null)} judul="Simpan & buka desain" ukuran="md" ikon={<Ikon nama="💾" ukuran={18} />}
        keterangan="Ke server: bisa dibuka seluruh tim (gambar unggahan & model GLB impor tidak ikut). Ke laptop: semuanya ikut, tanpa storage server.">
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
                    v{d.versi ?? 1} · {d.ruang ? `${d.ruang.p}×${d.ruang.l} m${d.ruang.r2?.aktif ? ' + 1 ruang' : ''} · ` : ''}{d.jumlah_benda} benda · {d.dibuat_oleh_nama || '—'}
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
                  <button type="button" onClick={() => { const rb = { ...RUANG_AWAL, ...t.ruang }; setRuang(rb); setBenda(t.benda); riwayat.mulaiBaru({ ruang: rb, benda: t.benda }); setNamaDesain(t.nama); setDesainAktif(null); setPilih(null); setModal(null); }}
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

interface BarisDesain {
  id: string; nama: string; versi: number; jumlah_benda: number; dibuat_oleh_nama: string; diubah_oleh_nama: string;
  updated_at: string; ruang: Ruang | null;
}

/** Pratinjau satu versi: dimuat malas & di-cache peramban; placeholder bila belum ada gambar. */
export function GambarVersi({ id, versi, className }: { id: string; versi: number; className: string }) {
  const [gagal, setGagal] = useState(false);
  if (gagal) return <div className={`${className} rounded-lg bg-slate-100 grid place-items-center flex-shrink-0 text-slate-400`}><Ikon nama="🧊" ukuran={18} /></div>;
  return <img src={urlGambarDesain(id, versi)} alt="" loading="lazy" decoding="async" onError={() => setGagal(true)}
    className={`${className} object-cover rounded-lg border border-slate-100 flex-shrink-0 bg-slate-50`} />;
}

/**
 * Daftar desain tersimpan seluruh tim untuk dibuka lagi (cari di server),
 * dengan pratinjau dan riwayat versi - versi lama bisa dibuka; menyimpannya
 * membuat versi baru, riwayat tidak berubah.
 */
function ModalBukaDesain({ buka, onTutup, aktifId, onBuka, onLaptop }: {
  buka: boolean; onTutup: () => void; aktifId: string | null; onBuka: (id: string, versi?: number) => void; onLaptop: () => void;
}) {
  const [q, setQ] = useState('');
  const [daftar, setDaftar] = useState<BarisDesain[] | null>(null);
  const [galat, setGalat] = useState('');
  const [riwayatId, setRiwayatId] = useState<string | null>(null);
  const [versi, setVersi] = useState<{ versi: number; created_at: string; dibuat_oleh_nama: string }[] | null>(null);

  useEffect(() => {
    if (!buka) return;
    let hidup = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/tools-team/desain${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`, { credentials: 'include', cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (!hidup) return;
        if (r.ok && j?.ok) { setDaftar(j.daftar); setGalat(''); } else { setDaftar([]); setGalat(j?.alasan ?? 'Daftar tidak bisa dimuat.'); }
      } catch { if (hidup) { setDaftar([]); setGalat('Tidak terhubung ke server.'); } }
    }, q ? 300 : 0);
    return () => { hidup = false; clearTimeout(t); };
  }, [buka, q]);

  const lihatRiwayat = async (id: string) => {
    if (riwayatId === id) { setRiwayatId(null); return; }
    setRiwayatId(id); setVersi(null);
    try {
      const r = await fetch(`/api/tools-team/desain?id=${encodeURIComponent(id)}&riwayat=1`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      setVersi(r.ok && j?.ok ? j.versi : []);
    } catch { setVersi([]); }
  };
  const tgl = (x: string) => new Date(x).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Modal buka={buka} onTutup={onTutup} judul="Buka desain tersimpan" ukuran="lg" ikon={<Ikon nama="📁" ukuran={18} />}
      keterangan="Dari laptop, atau dari desain yang disimpan anggota tim di server (versi lama bisa dibuka dari riwayat).">
      <button type="button" onClick={onLaptop}
        className="w-full mb-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-left hover:bg-emerald-100">
        <HardDriveUpload size={20} className="text-emerald-700 flex-shrink-0" />
        <span className="min-w-0">
          <span className="block text-[13px] font-bold text-emerald-900">Buka dari laptop (.glb)</span>
          <span className="block text-[11.5px] text-emerald-800">File yang disimpan lewat "Simpan .glb" - tanpa storage server</span>
        </span>
      </button>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Desain tim di server</p>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama desain atau pembuat" aria-label="Cari desain"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm mb-3" />
      {galat && <p className="text-[12.5px] text-rose-700 mb-2">{galat}</p>}
      {daftar === null ? <p className="text-sm text-slate-500">Memuat...</p> : daftar.length === 0 ? (
        <p className="text-sm text-slate-500">{q ? 'Tidak ada desain yang cocok.' : 'Belum ada desain tersimpan. Simpan desain lewat tombol Simpan.'}</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-2">
          {daftar.map(d => (
            <li key={d.id} className={`rounded-xl border p-2 ${aktifId === d.id ? 'border-blue-400 bg-blue-50/40' : 'border-slate-200'}`}>
              <div className="flex gap-2.5">
                <GambarVersi id={d.id} versi={d.versi} className="w-24 h-14" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-900 truncate">{d.nama}{aktifId === d.id && <span className="ml-1 text-[11px] font-bold text-emerald-700">· terbuka</span>}</p>
                  <p className="text-[11.5px] text-slate-600 truncate">v{d.versi} · {d.ruang ? `${d.ruang.p}×${d.ruang.l} m${d.ruang.r2?.aktif ? ' + 1 ruang' : ''} · ` : ''}{d.jumlah_benda} benda</p>
                  <p className="text-[11px] text-slate-500 truncate">{d.diubah_oleh_nama || d.dibuat_oleh_nama || '—'} · {tgl(d.updated_at)}</p>
                </div>
              </div>
              <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={() => onBuka(d.id)} className="flex-1 px-2 py-1.5 rounded-lg text-[12px] font-bold text-white bg-blue-700 hover:bg-blue-800">Buka</button>
                {d.versi > 1 && (
                  <button type="button" onClick={() => void lihatRiwayat(d.id)} aria-expanded={riwayatId === d.id}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">
                    <History size={13} /> Riwayat ({d.versi})
                  </button>
                )}
              </div>
              {riwayatId === d.id && (
                <ul className="mt-2 border-t border-slate-100 pt-1.5 space-y-0.5 max-h-48 overflow-y-auto">
                  {versi === null ? <li className="text-[12px] text-slate-500">Memuat...</li> : versi.map(v => (
                    <li key={v.versi} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="text-slate-700"><b>v{v.versi}</b> · {v.dibuat_oleh_nama || '—'} · {tgl(v.created_at)}</span>
                      <button type="button" onClick={() => onBuka(d.id, v.versi)} className="text-blue-700 font-bold hover:underline">Buka</button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Pemilih warna dengan tombol kembali ke bawaan; `nilai` kosong = warna bawaan. */
function PilihWarna({ label, nilai, awal, onUbah }: { label: string; nilai?: string; awal: string; onUbah: (w: string | undefined) => void }) {
  const sah = warnaSah(nilai);
  return (
    <div className="mt-2">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={label} value={sah ?? awal} onChange={e => onUbah(e.target.value)}
          className="h-9 w-12 rounded-lg border border-slate-200 bg-white p-0.5 cursor-pointer" />
        <span className="text-[12px] font-mono text-slate-700">{sah ?? 'bawaan'}</span>
        {sah && (
          <button type="button" onClick={() => onUbah(undefined)}
            className="ml-auto px-2 py-1 rounded-lg text-[11.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Bawaan</button>
        )}
      </div>
    </div>
  );
}
