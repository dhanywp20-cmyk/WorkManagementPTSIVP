'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type * as T from 'three';
import { FAKTOR_PANDANG, type JenisPandang } from '@/lib/av-hitung';
import { Angka, Pilih, Segmen, Kartu, Nilai, TombolSalin, Catatan, f } from './ui';
import { Ikon } from '@/components/shared/Ikon';
import { Modal } from '@/components/shared/Modal';
import {
  type Benda, type Ruang, type Kotak, type ItemKatalog, DISPLAY, BISA_TEMPEL, KATALOG, idBaru, bendaBaru, contohAwal,
  daftarRuang, ruangDari, titikPenonton, tandaBentuk, buatModel, sesuaikanTinggi, teksturLantai, teksturPolaUji,
} from './desain3d/model';
import { PanelBenda } from './desain3d/PanelBenda';
import { bukaCetak, esc } from './cetak';
import { getSession } from '@/lib/auth';

/**
 * Desain 3D Ruang AV - dibangun di atas three.js (threejs.org) + add-on resminya:
 *   - RoomEnvironment + PMREM  : pencahayaan PBR realistis tanpa berkas HDR luar
 *   - bayangan & tone mapping   : DirectionalLight shadow, ACES Filmic
 *   - OrbitControls             : putar / zoom / geser kamera
 *   - TransformControls         : gizmo geser (X/Z + naik-turun) & putar benda terpilih
 *   - CSS2DRenderer             : label ukuran & jarak di ruang 3D
 *   - GLTFLoader / GLTFExporter : impor model produk (.glb) & ekspor desain (.glb)
 * Model benda prosedural (desain3d/model.ts); maksimal 2 ruang bersebelahan.
 * three.js dimuat dinamis hanya saat alat ini dibuka.
 */

const KUNCI_SIMPAN = 'wm_desain3d';

interface DesainTim {
  id: string; nama: string; jumlah_benda: number; dibuat_oleh_nama: string; diubah_oleh_nama: string;
  updated_at: string; ruang: Ruang | null; bolehUbah: boolean;
}
const RUANG_AWAL: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null };
const R2_AWAL = { aktif: true, p: 6, l: 6, t: 3, lantai: 'karpet' as const, pintu: true };

type Mesin = {
  THREE: typeof T; renderer: T.WebGLRenderer; labelRenderer: { render: (s: T.Scene, c: T.Camera) => void; setSize: (w: number, h: number) => void; domElement: HTMLElement };
  scene: T.Scene; kamera: T.PerspectiveCamera;
  orbit: { target: T.Vector3; update: () => void; enabled: boolean; dispose: () => void };
  gizmo: T.Object3D & { attach: (o: T.Object3D) => void; detach: () => void; setMode: (m: 'translate' | 'rotate') => void; showX: boolean; showY: boolean; showZ: boolean; dragging: boolean; dispose: () => void; object?: T.Object3D };
  grupRuang: T.Group; grupBenda: T.Group; grupBantu: T.Group;
  CSS2DObject: new (el: HTMLElement) => T.Object3D;
  GLTFExporter: new () => { parse: (o: T.Object3D, ok: (r: ArrayBuffer | object) => void, err: (e: unknown) => void, opsi: object) => void };
  GLTFLoader: new () => { parse: (data: ArrayBuffer, path: string, ok: (g: { scene: T.Group }) => void, err: (e: unknown) => void) => void };
  cache: Map<string, { obj: T.Object3D; tanda: string }>;
};

type Sisi = 'depan' | 'belakang' | 'kiri' | 'kanan';

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
  const [modal, setModal] = useState<'ruang' | 'tambah' | 'daftar' | 'simpan' | null>(null);
  const [targetRuang, setTargetRuang] = useState<'0' | '1'>('0');
  const [tampilan, setTampilan] = useState<'3d' | 'atas' | 'kursi'>('3d');
  const [modeGizmo, setModeGizmo] = useState<'translate' | 'rotate'>('translate');
  const [ukur, setUkur] = useState(true);
  const [kerucut, setKerucut] = useState(true);
  const [jenisPandang, setJenisPandang] = useState<JenisPandang>('analitis');
  const [namaDesain, setNamaDesain] = useState('Ruang Meeting');
  const [tersimpan, setTersimpan] = useState<{ nama: string; ruang: Ruang; benda: Benda[] }[]>([]);
  /** Desain tim di server (/api/tools-team/desain) & desain server yang sedang dibuka. */
  const [daftarTim, setDaftarTim] = useState<DesainTim[] | null>(null);
  const [desainAktif, setDesainAktif] = useState<{ id: string; bolehUbah: boolean } | null>(null);
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
  const bendaRef = useRef(benda); bendaRef.current = benda;
  const ruangRef = useRef(ruang); ruangRef.current = ruang;

  const kotakRuang = useMemo(() => daftarRuang(ruang), [ruang]);
  const batas = useMemo(() => batasDunia(ruang), [ruang]);
  const plafonDi = (x: number) => kotakRuang[ruangDari(ruang, x)]?.t ?? ruang.t;

  useEffect(() => {
    try { const s = localStorage.getItem(KUNCI_SIMPAN); if (s) setTersimpan(JSON.parse(s)); } catch { /* abaikan */ }
  }, []);

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
        orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI / 2 - 0.02;

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
        const turun = (e: PointerEvent) => { turunDi = { x: e.clientX, y: e.clientY }; };
        const naik = (e: PointerEvent) => {
          if (!turunDi || Math.hypot(e.clientX - turunDi.x, e.clientY - turunDi.y) > 5 || (gizmo as unknown as { dragging: boolean }).dragging) { turunDi = null; return; }
          turunDi = null;
          const r = renderer.domElement.getBoundingClientRect();
          ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
          ray.setFromCamera(ptr, kamera);
          const kena = ray.intersectObjects(grupBenda.children, true)[0];
          let o: T.Object3D | null = kena?.object ?? null;
          while (o && !o.userData.id) o = o.parent;
          setPilih((o?.userData.id as string | undefined) ?? null);
        };
        renderer.domElement.addEventListener('pointerdown', turun);
        renderer.domElement.addEventListener('pointerup', naik);

        let jalan = true;
        const putar = () => {
          if (!jalan) return;
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

  // ── Ruangan: lantai bertekstur + 4 dinding per ruang ──
  //  Dinding hanya terlihat dari sisi dalam (FrontSide), jadi dinding yang
  //  membelakangi kamera otomatis "tembus" seperti denah rumah boneka.
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const { THREE, grupRuang } = m;
    grupRuang.clear();
    const daftar = daftarRuang(ruang);
    const lantaiDari = (i: number) => (i === 0 ? ruang.lantai : ruang.r2?.lantai ?? 'kayu');
    const bahanDinding = new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.95, side: THREE.FrontSide });
    const garis = new THREE.LineBasicMaterial({ color: 0xa8a29e });
    const pintuDi = daftar.length > 1 && ruang.r2?.pintu ? Math.max(0.6, Math.min(daftar[0].l, daftar[1].l) - 1.0) : null;

    /** Dinding sepanjang `panjang`, tengah (x,z), opsional lubang pintu (pusat lokal). */
    const dinding = (panjang: number, tinggi: number, x: number, z: number, rotY: number, lubang: number | null) => {
      const gw = new THREE.Group(); gw.position.set(x, 0, z); gw.rotation.y = rotY;
      const bidang = (x0: number, x1: number, y0: number, y1: number) => {
        if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
        const d = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), bahanDinding);
        d.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); d.receiveShadow = true; gw.add(d);
      };
      if (lubang === null) bidang(-panjang / 2, panjang / 2, 0, tinggi);
      else {
        const lp = 0.9, tp = Math.min(2.1, tinggi - 0.1);
        bidang(-panjang / 2, lubang - lp / 2, 0, tinggi); bidang(lubang + lp / 2, panjang / 2, 0, tinggi); bidang(lubang - lp / 2, lubang + lp / 2, tp, tinggi);
        const kusen = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(lp, tp)), garis);
        kusen.position.set(lubang, tp / 2, 0.002); gw.add(kusen);
      }
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(panjang, tinggi)), garis);
      e.position.y = tinggi / 2; gw.add(e);
      grupRuang.add(gw);
    };

    daftar.forEach((k, i) => {
      const jenis = lantaiDari(i);
      const lantai = new THREE.Mesh(new THREE.PlaneGeometry(k.p, k.l),
        new THREE.MeshStandardMaterial({ map: teksturLantai(THREE, jenis, k.p, k.l), roughness: jenis === 'keramik' ? 0.35 : 0.8 }));
      lantai.rotation.x = -Math.PI / 2; lantai.position.set(k.x0 + k.p / 2, 0, k.l / 2); lantai.receiveShadow = true;
      grupRuang.add(lantai);
      dinding(k.p, k.t, k.x0 + k.p / 2, 0, 0, null);                    // depan
      dinding(k.p, k.t, k.x0 + k.p / 2, k.l, Math.PI, null);            // belakang
      //  Kiri (rotY +90°: sumbu lokal x = -z dunia) & kanan (-90°: lokal x = +z dunia).
      dinding(k.l, k.t, k.x0, k.l / 2, Math.PI / 2, i === 1 && pintuDi !== null ? -(pintuDi - k.l / 2) : null);
      dinding(k.l, k.t, k.x0 + k.p, k.l / 2, -Math.PI / 2, i === 0 && daftar.length > 1 && pintuDi !== null ? pintuDi - k.l / 2 : null);
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
      const tinggiPerlu = terjauh / FAKTOR_PANDANG[jenisPandang];
      return { d, ri, jumlah: data.length, terjauh, terjauhP, terdekat, sudutMaks, tinggiPerlu, cukup: d.h >= tinggiPerlu };
    });
  }, [benda, jenisPandang, ruang]);

  // ── Alat bantu: label ukuran, garis jarak terjauh, kerucut sudut pandang ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const { THREE, grupBantu, CSS2DObject } = m;
    grupBantu.traverse(o => { if ((o as { element?: HTMLElement }).element) (o as unknown as { element: HTMLElement }).element.remove(); });
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
        // Kerucut nyaman ±45° di lantai, sejauh penonton terjauh (min 3 m), dipotong di dinding ruangnya.
        const k = kotakRuang[a.ri] ?? kotakRuang[0];
        const panjang = Math.max(3, a.terjauh + 0.5);
        const potong = [
          new THREE.Plane(new THREE.Vector3(1, 0, 0), -k.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), k.x0 + k.p),
          new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), k.l),
        ];
        const kipas = new THREE.Mesh(new THREE.CircleGeometry(panjang, 32, Math.PI / 2 - Math.PI / 4, Math.PI / 2),
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
  }, [analisis, ukur, kerucut, siap, kotakRuang]);

  // ── Kamera ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const c = new m.THREE.Vector3(batas.x / 2, 0.8, batas.z / 2);
    if (tampilan === 'kursi') {
      // Mata penonton (1,2 m) di kursi terpilih atau penonton terjauh, menatap display di ruang yang sama.
      const sel = benda.find(b => b.id === pilih && b.jenis === 'kursi');
      const ri = sel ? ruangDari(ruang, sel.x) : 0;
      const a = analisis.find(x => x.ri === ri) ?? analisis[0];
      const k = kotakRuang[ri] ?? kotakRuang[0];
      const p = sel ? { x: sel.x, z: sel.z } : a?.terjauhP ?? { x: k.x0 + k.p / 2, z: k.l - 0.5 };
      const target = a ? new m.THREE.Vector3(a.d.x, a.d.elev + a.d.h / 2, a.d.z) : c;
      m.kamera.position.set(p.x, 1.2, p.z);
      m.orbit.target.copy(target);
    } else {
      m.orbit.target.copy(c);
      if (tampilan === 'atas') {
        //  Jarak dihitung dari sudut lensa & rasio kanvas supaya denah
        //  memenuhi kanvas (margin 12%) - bukan tinggi tetap yang membuat
        //  denah kecil di tengah kanvas lebar.
        const tanSetengah = Math.tan(((m.kamera.fov * Math.PI) / 180) / 2);
        const jarak = (Math.max(batas.z / 2, batas.x / (2 * Math.max(0.3, m.kamera.aspect))) * 1.12) / tanSetengah;
        m.kamera.position.set(batas.x / 2, c.y + jarak, batas.z / 2 + 0.01);
      } else {
        //  Mundur sebanding ukuran gabungan ruang, dari depan-kanan atas.
        const arah = new m.THREE.Vector3(0.2, 0.75, 0.95).normalize();
        m.kamera.position.copy(c).addScaledVector(arah, Math.max(batas.x, batas.z) * 0.85 + 3);
      }
    }
    m.orbit.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tampilan, batas.x, batas.z, batas.t, siap]);

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
    const b = bendaBaru(it.jenis, k, it.atur);
    setBenda(bs => [...bs, b]); setPilih(b.id); setModal(null);
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

  const aturRuang2 = (aktif: boolean) => {
    if (aktif) { setRuang(r => ({ ...r, r2: { ...R2_AWAL, ...(r.r2 ?? {}), aktif: true } })); return; }
    const diR2 = benda.filter(b => b.x > ruang.p);
    if (diR2.length && !window.confirm(`Matikan ruang 2? ${diR2.length} benda di ruang 2 ikut dihapus.`)) return;
    setBenda(bs => bs.filter(b => b.x <= ruang.p));
    setRuang(r => ({ ...r, r2: r.r2 ? { ...r.r2, aktif: false } : null }));
    setTargetRuang('0');
  };

  const unggahGambar = (file: File | null) => {
    const m = mesin.current; if (!file || !m || !terpilih) return;
    const url = URL.createObjectURL(file);
    const id = terpilih.id;
    new m.THREE.TextureLoader().load(url, tex => {
      //  Gambar sudah terunggah ke GPU - URL objeknya tidak dipakai lagi.
      URL.revokeObjectURL(url);
      tex.colorSpace = m.THREE.SRGBColorSpace;
      gambarLayar.current.get(id)?.dispose();
      gambarLayar.current.set(id, tex);
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

  const unduhGLB = () => {
    const m = mesin.current; if (!m) return;
    const isi = new m.THREE.Group();
    isi.add(m.grupRuang.clone(true), m.grupBenda.clone(true));
    isi.traverse(o => { if (o.userData.sorot) o.visible = false; });
    new m.GLTFExporter().parse(isi, hasil => {
      const blob = new Blob([hasil as ArrayBuffer], { type: 'model/gltf-binary' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `${(namaDesain || 'desain-av').replace(/[^\w-]+/g, '-')}.glb`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, () => setGalat('Ekspor GLB gagal.'), { binary: true });
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
      const tanSetengah = Math.tan(((m.kamera.fov * Math.PI) / 180) / 2);
      const jarak = (Math.max(batas.z / 2, batas.x / (2 * Math.max(0.3, m.kamera.aspect))) * 1.12) / tanSetengah;
      m.orbit.target.set(batas.x / 2, 0.8, batas.z / 2);
      m.kamera.position.set(batas.x / 2, 0.8 + jarak, batas.z / 2 + 0.01);
      m.kamera.lookAt(m.orbit.target);
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
      DISPLAY.includes(j) ? 'Display' : j === 'kamera' || j === 'lift' ? 'Kamera & konferensi'
        : ['speaker', 'speaker-plafon', 'mic', 'touchpanel', 'proyektor', 'rak'].includes(j) ? 'Audio & kontrol'
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
    const label = { detail: 'Detail (4×)', analitis: 'Analitis (6×)', umum: 'Umum (8×)' }[jenisPandang];
    const gambar = (src: string, ket: string) => (src ? `<figure><img src="${src}" alt="${esc(ket)}"/><figcaption>${esc(ket)}</figcaption></figure>` : '');
    bukaCetak({
      judul: 'Desain 3D Ruang AV',
      subjudul: namaDesain || 'Tanpa nama',
      kepala: [['Dibuat oleh', getSession<{ full_name?: string }>()?.full_name ?? '']],
      seksi: [
        { judul: 'Ruangan', jenis: 'tabel', kepala: ['Ruang', 'Panjang', 'Lebar', 'Plafon', 'Luas'], rataKanan: [1, 2, 3, 4],
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

  /** Simpan ke server. Desain milik orang lain (atau `baru`) disimpan sebagai salinan. */
  const simpanServer = async (baru: boolean, sumber?: { nama: string; ruang: Ruang; benda: Benda[] }) => {
    const nama = (sumber?.nama ?? namaDesain).trim() || 'Tanpa nama';
    const timpa = !sumber && !baru && desainAktif?.bolehUbah ? desainAktif.id : undefined;
    setSibukSimpan(true); setStatusSimpan(null);
    try {
      const r = await fetch(API_DESAIN, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: timpa, nama, data: { ruang: sumber?.ruang ?? ruang, benda: bendaBersih(sumber?.benda ?? benda) } }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setStatusSimpan({ teks: j?.alasan ?? 'Gagal menyimpan.', nada: 'galat' }); return false; }
      if (!sumber) {
        setDesainAktif({ id: j.desain.id, bolehUbah: true });
        const salinan = !timpa && !!desainAktif && !baru;
        setStatusSimpan({ teks: timpa ? 'Perubahan tersimpan.' : salinan ? 'Desain milik orang lain - disimpan sebagai salinan Anda.' : 'Tersimpan di server.', nada: 'ok' });
      }
      void muatDaftarTim();
      return true;
    } catch { setStatusSimpan({ teks: 'Tidak terhubung ke server.', nada: 'galat' }); return false; } finally { setSibukSimpan(false); }
  };

  const bukaTim = async (id: string) => {
    setSibukSimpan(true); setStatusSimpan(null);
    try {
      const r = await fetch(`${API_DESAIN}?id=${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setStatusSimpan({ teks: j?.alasan ?? 'Desain tidak bisa dibuka.', nada: 'galat' }); return; }
      const d = j.desain as { id: string; nama: string; data: { ruang: Ruang; benda: Benda[] }; bolehUbah: boolean };
      setRuang({ ...RUANG_AWAL, ...d.data.ruang }); setBenda(d.data.benda); setNamaDesain(d.nama);
      setDesainAktif({ id: d.id, bolehUbah: d.bolehUbah }); setPilih(null); setModal(null);
    } catch { setStatusSimpan({ teks: 'Tidak terhubung ke server.', nada: 'galat' }); } finally { setSibukSimpan(false); }
  };

  const hapusTim = async (d: DesainTim) => {
    if (!window.confirm(`Hapus desain "${d.nama}" dari server? Seluruh tim tidak bisa membukanya lagi.`)) return;
    const r = await fetch(`${API_DESAIN}?id=${encodeURIComponent(d.id)}`, { method: 'DELETE', credentials: 'include' }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok || !j?.ok) { setStatusSimpan({ teks: j?.alasan ?? 'Gagal menghapus.', nada: 'galat' }); return; }
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
  ].join('\n');

  const tombol = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50';
  const tombolUtama = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-700 hover:bg-blue-800';
  const duaRuang = kotakRuang.length > 1;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
        {/* Bilah alat */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => setModal('tambah')} className={tombolUtama}><Ikon nama="➕" ukuran={14} /> Tambah</button>
            <button type="button" onClick={() => setModal('ruang')} className={tombol}><Ikon nama="🏠" ukuran={14} /> Ruangan</button>
            <button type="button" onClick={() => setModal('daftar')} className={tombol}><Ikon nama="📋" ukuran={14} /> Benda ({benda.length})</button>
            <button type="button" onClick={() => setModal('simpan')} className={tombol}><Ikon nama="💾" ukuran={14} /> Simpan</button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Segmen nilai={tampilan} onUbah={setTampilan} opsi={[{ v: '3d', l: '3D' }, { v: 'atas', l: 'Atas' }, { v: 'kursi', l: 'Dari kursi' }]} />
            <button type="button" onClick={unduhPNG} className={tombol}><Ikon nama="📷" ukuran={14} /> PNG</button>
            <button type="button" onClick={unduhGLB} className={tombol}><Ikon nama="🧊" ukuran={14} /> GLB</button>
            <TombolSalin teks={ringkasan} onCetak={cetak} />
          </div>
        </div>

        <div ref={wadahRef} className="relative w-full h-[440px] sm:h-[620px] overflow-hidden">
          {!siap && !galat && <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">Memuat tampilan 3D...</div>}
          <div className="absolute left-2 top-2 z-10 flex gap-1.5">
            {[{ v: ukur, s: setUkur, l: 'Ukuran' }, { v: kerucut, s: setKerucut, l: 'Sudut pandang' }].map(t => (
              <label key={t.l} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/90 border border-slate-200 text-[11.5px] font-semibold text-slate-700 shadow-sm">
                <input type="checkbox" checked={t.v} onChange={e => t.s(e.target.checked)} /> {t.l}
              </label>
            ))}
          </div>
          {terpilih && panel && (
            <PanelBenda b={terpilih} plafon={plafonDi(terpilih.x)} batas={batas} onUbah={gantiBenda}
              onGambar={() => inputGambar.current?.click()} onTutup={() => setPanel(false)} />
          )}
        </div>
        <input ref={inputGambar} type="file" accept="image/*" className="hidden" onChange={e => { unggahGambar(e.target.files?.[0] ?? null); e.target.value = ''; }} />

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
            <div className="flex items-center gap-1.5 ml-auto">
              <button type="button" onClick={() => setPanel(p => !p)} className={panel ? tombolUtama : tombol}><Ikon nama="⚙" ukuran={14} /> Atur</button>
              <button type="button" onClick={() => {
                const c = { ...terpilih, id: idBaru(), x: Math.min(batas.x, terpilih.x + 0.6) }; setBenda(b => [...b, c]); setPilih(c.id);
              }} className={tombol}>Duplikat</button>
              <button type="button" onClick={() => { setBenda(b => b.filter(x => x.id !== terpilih.id)); setPilih(null); }}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-200 text-rose-700 hover:bg-rose-50">Hapus</button>
            </div>
          </div>
        ) : null}
        {galat && <p className="px-3 py-2 text-[12px] font-semibold text-rose-700 border-t border-rose-100 bg-rose-50">{galat}</p>}
        <p className="px-3 py-2 text-[11.5px] text-slate-600 border-t border-slate-100">
          Klik benda untuk memilih · seret panah gizmo untuk geser (panah hijau = naik/turun) atau cincin untuk putar · tombol Dinding menempelkan benda ke sisi ruang · seret area kosong untuk memutar kamera
        </p>
      </div>

      <Kartu judul="Analisis tampilan">
        <div className="mb-3 max-w-xs">
          <Pilih label="Jenis konten" nilai={jenisPandang} onUbah={setJenisPandang} opsi={[
            { v: 'umum', l: 'Umum (video, presentasi)' }, { v: 'analitis', l: 'Analitis (dokumen)' }, { v: 'detail', l: 'Detail (gambar teknik)' },
          ]} />
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
                  <Nilai label="Sudut pandang maks" nilai={f(a.sudutMaks, 0)} satuan="°" ket={a.sudutMaks > 45 ? 'ada kursi terlalu menyamping' : 'nyaman (≤45°)'} nada={a.sudutMaks > 45 ? 'awas' : 'baik'} />
                  {a.d.jenis === 'led' && a.d.pitch
                    ? <Nilai label="Penonton terdekat" nilai={f(a.terdekat, 1)} satuan="m" ket={a.terdekat < a.d.pitch ? `di bawah jarak min P${a.d.pitch} (${a.d.pitch} m)` : 'aman untuk pitch ini'} nada={a.terdekat < a.d.pitch ? 'buruk' : 'baik'} />
                    : <Nilai label="Penonton terdekat" nilai={f(a.terdekat, 1)} satuan="m" />}
                </div>
              )}
            </div>
          ))}
        <Catatan>Posisi penonton diambil dari kursi (atau sekeliling meja bila belum ada kursi) di ruang yang sama dengan display. Aturan 4-6-8: jarak terjauh maksimal 4/6/8× tinggi gambar untuk konten detail/analitis/umum.</Catatan>
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
        keterangan="Maksimal 2 ruang bersebelahan. Ruang 2 berada di sisi kanan ruang 1."
        footer={<button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-700 hover:bg-blue-800">Selesai</button>}>
        <div className="space-y-4">
          <div>
            <p className="text-[12.5px] font-bold text-slate-800 mb-1.5">Ruang 1</p>
            <div className="grid grid-cols-3 gap-2">
              <Angka label="Panjang" nilai={ruang.p} onUbah={v => v >= 2 && v <= 30 && setRuang(r => ({ ...r, p: v }))} satuan="m" />
              <Angka label="Lebar" nilai={ruang.l} onUbah={v => v >= 2 && v <= 30 && setRuang(r => ({ ...r, l: v }))} satuan="m" />
              <Angka label="Plafon" nilai={ruang.t} onUbah={v => v >= 2 && v <= 15 && setRuang(r => ({ ...r, t: v }))} satuan="m" />
            </div>
            <div className="mt-2">
              <Segmen label="Lantai" nilai={ruang.lantai} onUbah={v => setRuang(r => ({ ...r, lantai: v }))}
                opsi={[{ v: 'kayu', l: 'Kayu' }, { v: 'karpet', l: 'Karpet' }, { v: 'keramik', l: 'Keramik' }]} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input type="checkbox" className="w-4 h-4" checked={!!ruang.r2?.aktif} onChange={e => aturRuang2(e.target.checked)} /> Ruang ke-2 bersebelahan
          </label>
          {ruang.r2?.aktif && (
            <div>
              <div className="grid grid-cols-3 gap-2">
                <Angka label="Panjang" nilai={ruang.r2.p} onUbah={v => v >= 2 && v <= 30 && setRuang(r => ({ ...r, r2: r.r2 && { ...r.r2, p: v } }))} satuan="m" />
                <Angka label="Lebar" nilai={ruang.r2.l} onUbah={v => v >= 2 && v <= 30 && setRuang(r => ({ ...r, r2: r.r2 && { ...r.r2, l: v } }))} satuan="m" />
                <Angka label="Plafon" nilai={ruang.r2.t} onUbah={v => v >= 2 && v <= 15 && setRuang(r => ({ ...r, r2: r.r2 && { ...r.r2, t: v } }))} satuan="m" />
              </div>
              <div className="mt-2">
                <Segmen label="Lantai" nilai={ruang.r2.lantai} onUbah={v => setRuang(r => ({ ...r, r2: r.r2 && { ...r.r2, lantai: v } }))}
                  opsi={[{ v: 'kayu', l: 'Kayu' }, { v: 'karpet', l: 'Karpet' }, { v: 'keramik', l: 'Keramik' }]} />
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="w-4 h-4" checked={ruang.r2.pintu} onChange={e => setRuang(r => ({ ...r, r2: r.r2 && { ...r.r2, pintu: e.target.checked } }))} /> Pintu penghubung
              </label>
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
              {duaRuang && <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Ruang {i + 1} · {f(k.p)} × {f(k.l)} m</p>}
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

      {/* ── Modal: Simpan / buka (server, dibagikan ke tim) ── */}
      <Modal buka={modal === 'simpan'} onTutup={() => setModal(null)} judul="Simpan & buka desain" ukuran="md" ikon={<Ikon nama="💾" ukuran={18} />}
        keterangan="Desain tersimpan di server dan bisa dibuka seluruh tim. Gambar unggahan di layar & model GLB impor tidak ikut tersimpan.">
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
                    {d.ruang ? `${d.ruang.p}×${d.ruang.l} m${d.ruang.r2?.aktif ? ' + 1 ruang' : ''} · ` : ''}{d.jumlah_benda} benda · {d.dibuat_oleh_nama || '—'}
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
                  <button type="button" onClick={() => { setRuang({ ...RUANG_AWAL, ...t.ruang }); setBenda(t.benda); setNamaDesain(t.nama); setDesainAktif(null); setPilih(null); setModal(null); }}
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
