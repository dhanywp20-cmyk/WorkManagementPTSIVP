'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type * as T from 'three';
import { ukuranDariDiagonal, FAKTOR_PANDANG, type JenisPandang } from '@/lib/av-hitung';
import { Angka, Pilih, Segmen, Kartu, Nilai, TombolSalin, Catatan, f } from './ui';
import { Ikon } from '@/components/shared/Ikon';
import {
  type Benda, type Jenis, type Ruang, LABEL, DISPLAY, DAPAT_DITAMBAH, idBaru, bendaBaru, contohAwal,
  titikPenonton, tandaBentuk, buatModel, tiangPlafon, teksturLantai, teksturPolaUji,
} from './desain3d/model';

/**
 * Desain 3D Ruang AV - dibangun di atas three.js (threejs.org) + add-on resminya:
 *   - RoomEnvironment + PMREM  : pencahayaan PBR realistis tanpa berkas HDR luar
 *   - bayangan & tone mapping   : DirectionalLight shadow, ACES Filmic
 *   - OrbitControls             : putar / zoom / geser kamera
 *   - TransformControls         : gizmo geser & putar benda terpilih
 *   - CSS2DRenderer             : label ukuran & jarak di ruang 3D
 *   - GLTFLoader / GLTFExporter : impor model produk (.glb) & ekspor desain (.glb)
 * Model benda prosedural (desain3d/model.ts); konten layar bisa pola uji atau
 * gambar unggahan. three.js dimuat dinamis hanya saat alat ini dibuka.
 */

const KUNCI_SIMPAN = 'wm_desain3d';
const RUANG_AWAL: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu' };

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

export default function Desain3D() {
  const [ruang, setRuang] = useState<Ruang>(RUANG_AWAL);
  const [benda, setBenda] = useState<Benda[]>(() => contohAwal(RUANG_AWAL));
  const [pilih, setPilih] = useState<string | null>(null);
  const [tampilan, setTampilan] = useState<'3d' | 'atas' | 'kursi'>('3d');
  const [modeGizmo, setModeGizmo] = useState<'translate' | 'rotate'>('translate');
  const [ukur, setUkur] = useState(true);
  const [kerucut, setKerucut] = useState(true);
  const [jenisPandang, setJenisPandang] = useState<JenisPandang>('analitis');
  const [namaDesain, setNamaDesain] = useState('Ruang Meeting');
  const [tersimpan, setTersimpan] = useState<{ nama: string; ruang: Ruang; benda: Benda[] }[]>([]);
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
        matahari.position.set(4, 9, 7);
        matahari.castShadow = true;
        matahari.shadow.mapSize.set(2048, 2048);
        matahari.shadow.camera.left = -15; matahari.shadow.camera.right = 15;
        matahari.shadow.camera.top = 15; matahari.shadow.camera.bottom = -15;
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
          const x = Math.round(Math.min(r.p, Math.max(0, o.position.x)) * 100) / 100;
          const z = Math.round(Math.min(r.l, Math.max(0, o.position.z)) * 100) / 100;
          const rot = ((Math.round((o.rotation.y * 180) / Math.PI) % 360) + 360) % 360;
          o.position.set(x, 0, z);
          setBenda(bs => bs.map(b => (b.id === o.userData.id ? { ...b, x, z, rot } : b)));
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
          jalan = false; ro.disconnect(); gizmo.dispose(); orbit.dispose(); pmrem.dispose(); renderer.dispose();
          renderer.domElement.remove(); labelRenderer.domElement.remove();
        };
      } catch (e) {
        setGalat('Perangkat/peramban ini tidak mendukung WebGL untuk tampilan 3D. ' + ((e as Error).message ?? ''));
      }
    })();
    return () => { hidup = false; bersihkan(); };
  }, []);

  // ── Ruangan: lantai bertekstur + 3 dinding ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const { THREE, grupRuang } = m;
    grupRuang.clear();
    const lantai = new THREE.Mesh(new THREE.PlaneGeometry(ruang.p, ruang.l),
      new THREE.MeshStandardMaterial({ map: teksturLantai(THREE, ruang.lantai, ruang.p, ruang.l), roughness: ruang.lantai === 'keramik' ? 0.35 : 0.8 }));
    lantai.rotation.x = -Math.PI / 2; lantai.position.set(ruang.p / 2, 0, ruang.l / 2); lantai.receiveShadow = true;
    grupRuang.add(lantai);
    const bahanDinding = new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.95, side: THREE.DoubleSide });
    const dinding = (w: number, x: number, z: number, rotY: number) => {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(w, ruang.t), bahanDinding);
      d.position.set(x, ruang.t / 2, z); d.rotation.y = rotY; d.receiveShadow = true; grupRuang.add(d);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, ruang.t)), new THREE.LineBasicMaterial({ color: 0xa8a29e }));
      e.position.copy(d.position); e.rotation.y = rotY; grupRuang.add(e);
    };
    dinding(ruang.p, ruang.p / 2, 0, 0);
    dinding(ruang.l, 0, ruang.l / 2, Math.PI / 2);
    dinding(ruang.l, ruang.p, ruang.l / 2, -Math.PI / 2);
    const plinth = new THREE.MeshStandardMaterial({ color: 0x78716c });
    const lis = new THREE.Mesh(new THREE.BoxGeometry(ruang.p, 0.08, 0.015), plinth);
    lis.position.set(ruang.p / 2, 0.04, 0.008); grupRuang.add(lis);
  }, [ruang, siap]);

  // ── Benda: bangun ulang hanya yang bentuknya berubah ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const { THREE, grupBenda, cache } = m;
    const ada = new Set(benda.map(b => b.id));
    for (const [id, c] of cache) if (!ada.has(id)) { grupBenda.remove(c.obj); cache.delete(id); }
    for (const b of benda) {
      const tanda = `${tandaBentuk(b)}|${ruang.t}|${versiGambar}`;
      let c = cache.get(b.id);
      if (!c || c.tanda !== tanda) {
        if (c) grupBenda.remove(c.obj);
        const obj = buatModel(b, {
          THREE,
          layar: x => (x.konten === 'mati' ? null : x.konten === 'gambar' ? gambarLayar.current.get(x.id) ?? null : teksturPolaUji(THREE, x.nama, x.w / Math.max(0.01, x.h))),
          model: k => modelImpor.current.get(k) ?? null,
        });
        const tiang = tiangPlafon(THREE, b, ruang.t); if (tiang) obj.add(tiang);
        obj.userData.id = b.id;
        grupBenda.add(obj);
        c = { obj, tanda }; cache.set(b.id, c);
      }
      c.obj.position.set(b.x, 0, b.z);
      c.obj.rotation.y = (b.rot * Math.PI) / 180;
    }
    // Sorotan benda terpilih (kotak batas tipis).
    grupBenda.children.filter(o => o.userData.sorot).forEach(o => grupBenda.remove(o));
    const terpilih = pilih ? cache.get(pilih)?.obj : null;
    if (terpilih) {
      const s = new THREE.BoxHelper(terpilih, 0x2563eb); s.userData.sorot = true; grupBenda.add(s);
    }
  }, [benda, pilih, siap, ruang.t, versiGambar]);

  // ── Gizmo menempel ke benda terpilih ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const o = pilih ? m.cache.get(pilih)?.obj : null;
    if (o && tampilan !== 'kursi') {
      m.gizmo.attach(o);
      m.gizmo.setMode(modeGizmo);
      m.gizmo.showX = modeGizmo === 'translate'; m.gizmo.showZ = modeGizmo === 'translate'; m.gizmo.showY = modeGizmo === 'rotate';
    } else m.gizmo.detach();
  }, [pilih, modeGizmo, siap, tampilan, benda]);

  // ── Analisis tampilan ──
  const analisis = useMemo(() => {
    const penonton = titikPenonton(benda);
    return benda.filter(b => DISPLAY.includes(b.jenis)).map(d => {
      const r = (d.rot * Math.PI) / 180;
      const hadap = { x: Math.sin(r), z: Math.cos(r) };
      const data = penonton.map(p => {
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
      return { d, jumlah: data.length, terjauh, terjauhP, terdekat, sudutMaks, tinggiPerlu, cukup: d.h >= tinggiPerlu };
    });
  }, [benda, jenisPandang]);

  // ── Alat bantu: label ukuran, garis jarak terjauh, kerucut sudut pandang ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const { THREE, grupBantu, CSS2DObject } = m;
    grupBantu.traverse(o => { if ((o as { element?: HTMLElement }).element) (o as unknown as { element: HTMLElement }).element.remove(); });
    grupBantu.clear();
    const label = (teks: string, pos: T.Vector3, nada: 'biru' | 'hijau' | 'merah' = 'biru') => {
      const el = document.createElement('div');
      el.textContent = teks;
      el.style.cssText = `font:600 11px system-ui,sans-serif;padding:2px 6px;border-radius:6px;white-space:nowrap;color:#fff;background:${nada === 'hijau' ? '#047857' : nada === 'merah' ? '#b91c1c' : '#1d4ed8'};box-shadow:0 1px 3px rgba(0,0,0,.3)`;
      const o = new CSS2DObject(el); o.position.copy(pos); grupBantu.add(o);
    };
    for (const a of analisis) {
      const d = a.d;
      const r = (d.rot * Math.PI) / 180;
      const pusat = new THREE.Vector3(d.x, d.elev + d.h / 2, d.z);
      if (kerucut) {
        // Kerucut nyaman ±45° di lantai, sejauh penonton terjauh (min 3 m).
        const panjang = Math.max(3, a.terjauh + 0.5);
        const kipas = new THREE.Mesh(new THREE.CircleGeometry(panjang, 32, Math.PI / 2 - Math.PI / 4, Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: a.cukup ? 0x22c55e : 0xef4444, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
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
      label(`${f(ruang.p)} m`, new THREE.Vector3(ruang.p / 2, 0.05, ruang.l + 0.25));
      label(`${f(ruang.l)} m`, new THREE.Vector3(ruang.p + 0.3, 0.05, ruang.l / 2));
    }
  }, [analisis, ukur, kerucut, siap, ruang]);

  // ── Kamera ──
  useEffect(() => {
    const m = mesin.current; if (!m || !siap) return;
    const c = new m.THREE.Vector3(ruang.p / 2, 0.8, ruang.l / 2);
    if (tampilan === 'kursi') {
      // Mata penonton (1,2 m) di kursi terpilih atau penonton terjauh, menatap display.
      const a = analisis[0];
      const sel = benda.find(b => b.id === pilih && b.jenis === 'kursi');
      const p = sel ? { x: sel.x, z: sel.z } : a?.terjauhP ?? { x: ruang.p / 2, z: ruang.l - 0.5 };
      const target = a ? new m.THREE.Vector3(a.d.x, a.d.elev + a.d.h / 2, a.d.z) : c;
      m.kamera.position.set(p.x, 1.2, p.z);
      m.orbit.target.copy(target);
    } else {
      m.orbit.target.copy(c);
      if (tampilan === 'atas') m.kamera.position.set(ruang.p / 2, Math.max(ruang.p, ruang.l) * 1.5, ruang.l / 2 + 0.01);
      else m.kamera.position.set(ruang.p * 1.05, ruang.t * 1.9, ruang.l * 1.6);
    }
    m.orbit.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tampilan, ruang.p, ruang.l, ruang.t, siap]);

  const terpilih = benda.find(b => b.id === pilih) ?? null;
  const ubah = (x: Partial<Benda>) => setBenda(bs => bs.map(b => (b.id === pilih ? { ...b, ...x } : b)));
  const tambah = (j: Jenis) => { const b = bendaBaru(j, ruang); setBenda(bs => [...bs, b]); setPilih(b.id); };

  const unggahGambar = (file: File | null) => {
    const m = mesin.current; if (!file || !m || !terpilih) return;
    const url = URL.createObjectURL(file);
    const id = terpilih.id;
    new m.THREE.TextureLoader().load(url, tex => {
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
        const b: Benda = { ...bendaBaru('model', ruang), nama: file.name.replace(/\.(glb|gltf)$/i, ''), w: k.x * skala || 1, h: k.y * skala || 1, d: k.z * skala || 1, modelKunci: kunci };
        setBenda(bs => [...bs, b]); setPilih(b.id); setGalat('');
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

  const simpan = () => {
    // Gambar layar & model impor hanya ada di memori - disimpan sebagai pola uji / kotak.
    const bersih = benda.map(b => ({ ...b, konten: b.konten === 'gambar' ? 'pola' as const : b.konten }));
    const daftar = [{ nama: namaDesain || 'Tanpa nama', ruang, benda: bersih }, ...tersimpan.filter(t => t.nama !== namaDesain)].slice(0, 12);
    setTersimpan(daftar);
    try { localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(daftar)); } catch { /* abaikan */ }
  };

  const ringkasan = () => [
    `*Desain ruang: ${namaDesain}*`,
    `Ruang ${ruang.p} × ${ruang.l} m, plafon ${ruang.t} m, lantai ${ruang.lantai}`,
    ...Object.entries(benda.reduce<Record<string, number>>((m, b) => { m[b.nama] = (m[b.nama] ?? 0) + 1; return m; }, {})).map(([n, j]) => `- ${n}: ${j}`),
    ...analisis.map(a => `${a.d.nama}: ${f(a.d.w)} × ${f(a.d.h)} m, penonton terjauh ${f(a.terjauh, 1)} m → tinggi perlu ${f(a.tinggiPerlu)} m (${a.cukup ? 'CUKUP' : 'KURANG'}), sudut maks ${f(a.sudutMaks, 0)}°`),
  ].join('\n');

  const tombol = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50';

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] items-start">
      <div className="space-y-3 min-w-0">
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 flex-wrap">
            <Segmen nilai={tampilan} onUbah={setTampilan} opsi={[{ v: '3d', l: '3D' }, { v: 'atas', l: 'Atas' }, { v: 'kursi', l: 'Dari kursi' }]} />
            <div className="flex gap-2 flex-wrap">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700"><input type="checkbox" checked={ukur} onChange={e => setUkur(e.target.checked)} /> Ukuran</label>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700"><input type="checkbox" checked={kerucut} onChange={e => setKerucut(e.target.checked)} /> Sudut pandang</label>
              <button type="button" onClick={unduhPNG} className={tombol}><Ikon nama="📷" ukuran={14} /> PNG</button>
              <button type="button" onClick={unduhGLB} className={tombol}><Ikon nama="🧊" ukuran={14} /> GLB</button>
              <TombolSalin teks={ringkasan} />
            </div>
          </div>
          <div ref={wadahRef} className="relative w-full h-[380px] sm:h-[560px] overflow-hidden">
            {!siap && !galat && <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">Memuat tampilan 3D...</div>}
          </div>
          {galat && <p className="px-3 py-2 text-[12px] font-semibold text-rose-700 border-t border-rose-100 bg-rose-50">{galat}</p>}
          <p className="px-3 py-2 text-[11.5px] text-slate-500 border-t border-slate-100">
            Klik benda untuk memilih, lalu seret panah gizmo untuk menggeser / cincin untuk memutar · seret area kosong untuk memutar kamera · scroll/cubit untuk zoom
          </p>
        </div>

        <Kartu judul="Analisis tampilan">
          <div className="mb-3 max-w-xs">
            <Pilih label="Jenis konten" nilai={jenisPandang} onUbah={setJenisPandang} opsi={[
              { v: 'umum', l: 'Umum (video, presentasi)' }, { v: 'analitis', l: 'Analitis (dokumen)' }, { v: 'detail', l: 'Detail (gambar teknik)' },
            ]} />
          </div>
          {analisis.length === 0 ? <p className="text-sm text-slate-500">Tambahkan display (LED/TV/layar) untuk dianalisis.</p>
            : analisis.map(a => (
              <div key={a.d.id} className="mb-3 last:mb-0">
                <p className="text-sm font-semibold text-slate-800 mb-1.5">{a.d.nama} · {f(a.d.w)} × {f(a.d.h)} m</p>
                {a.jumlah === 0 ? <p className="text-[12.5px] text-slate-500">Tambahkan meja atau kursi sebagai posisi penonton.</p> : (
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
          <Catatan>Posisi penonton diambil dari kursi (atau sekeliling meja bila belum ada kursi). Aturan 4-6-8: jarak terjauh maksimal 4/6/8× tinggi gambar untuk konten detail/analitis/umum. Tampilan &quot;Dari kursi&quot; menunjukkan pandangan penonton terjauh, atau kursi yang dipilih.</Catatan>
        </Kartu>
      </div>

      <div className="space-y-3 min-w-0">
        <Kartu judul="Ruangan">
          <div className="grid grid-cols-3 gap-2">
            <Angka label="Panjang" nilai={ruang.p} onUbah={v => v >= 2 && v <= 60 && setRuang(r => ({ ...r, p: v }))} satuan="m" />
            <Angka label="Lebar" nilai={ruang.l} onUbah={v => v >= 2 && v <= 60 && setRuang(r => ({ ...r, l: v }))} satuan="m" />
            <Angka label="Plafon" nilai={ruang.t} onUbah={v => v >= 2 && v <= 20 && setRuang(r => ({ ...r, t: v }))} satuan="m" />
          </div>
          <div className="mt-2">
            <Segmen label="Lantai" nilai={ruang.lantai} onUbah={v => setRuang(r => ({ ...r, lantai: v }))}
              opsi={[{ v: 'kayu', l: 'Kayu' }, { v: 'karpet', l: 'Karpet' }, { v: 'keramik', l: 'Keramik' }]} />
          </div>
        </Kartu>

        <Kartu judul="Tambah benda">
          <div className="flex flex-wrap gap-1.5">
            {DAPAT_DITAMBAH.map(j => (
              <button key={j} type="button" onClick={() => tambah(j)}
                className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50">+ {LABEL[j]}</button>
            ))}
            <button type="button" onClick={() => inputModel.current?.click()}
              className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-violet-200 text-violet-800 bg-violet-50 hover:bg-violet-100">+ Impor model .glb</button>
            <input ref={inputModel} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={e => { void imporModel(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          </div>
          <Catatan>Model .glb (mis. dari produsen produk atau Sketchfab) bisa dimasukkan dan diskalakan ke ukuran sebenarnya. Model impor & gambar layar hanya ada selama halaman terbuka.</Catatan>
        </Kartu>

        <Kartu judul={terpilih ? `Ubah: ${terpilih.nama}` : 'Benda terpilih'}>
          {!terpilih ? <p className="text-sm text-slate-500">Klik benda di tampilan 3D atau pilih dari daftar.</p> : (
            <div className="space-y-2.5">
              <Segmen nilai={modeGizmo} onUbah={setModeGizmo} opsi={[{ v: 'translate', l: 'Geser' }, { v: 'rotate', l: 'Putar' }]} />
              <label className="block">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Nama</span>
                <input value={terpilih.nama} onChange={e => ubah({ nama: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Angka label="X" nilai={terpilih.x} onUbah={v => ubah({ x: Math.min(ruang.p, Math.max(0, v)) })} satuan="m" />
                <Angka label="Z" nilai={terpilih.z} onUbah={v => ubah({ z: Math.min(ruang.l, Math.max(0, v)) })} satuan="m" />
                <Angka label="Putar" nilai={terpilih.rot} onUbah={v => ubah({ rot: ((v % 360) + 360) % 360 })} satuan="°" />
              </div>
              {terpilih.jenis === 'tv' ? (
                <Angka label="Diagonal TV" nilai={terpilih.diag ?? 86} onUbah={v => { if (v >= 20) { const u = ukuranDariDiagonal(v); ubah({ diag: v, w: u.lebarM, h: u.tinggiM }); } }} satuan="inci" />
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <Angka label="Lebar" nilai={Math.round(terpilih.w * 100) / 100} onUbah={v => v > 0 && ubah({ w: v })} satuan="m" />
                  <Angka label="Tinggi" nilai={Math.round(terpilih.h * 100) / 100} onUbah={v => v > 0 && ubah({ h: v })} satuan="m" />
                  <Angka label="Tebal" nilai={Math.round(terpilih.d * 100) / 100} onUbah={v => v > 0 && ubah({ d: v })} satuan="m" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Angka label="Tinggi dari lantai" nilai={Math.round(terpilih.elev * 100) / 100} onUbah={v => v >= 0 && ubah({ elev: Math.min(ruang.t, v) })} satuan="m" />
                {terpilih.jenis === 'led' && <Angka label="Pixel pitch" nilai={terpilih.pitch ?? 2.5} onUbah={v => v > 0 && ubah({ pitch: v })} satuan="mm" />}
              </div>
              {terpilih.jenis === 'led' && (
                <div className="grid grid-cols-2 gap-2">
                  <Angka label="Lebar cabinet" nilai={terpilih.cabW ?? 500} onUbah={v => v >= 100 && ubah({ cabW: v })} satuan="mm" />
                  <Angka label="Tinggi cabinet" nilai={terpilih.cabH ?? 500} onUbah={v => v >= 100 && ubah({ cabH: v })} satuan="mm" />
                </div>
              )}
              {DISPLAY.includes(terpilih.jenis) && (
                <div>
                  <Segmen label="Konten layar" nilai={terpilih.konten ?? 'pola'} onUbah={v => (v === 'gambar' ? inputGambar.current?.click() : ubah({ konten: v }))}
                    opsi={[{ v: 'pola', l: 'Pola uji' }, { v: 'gambar', l: 'Gambar...' }, { v: 'mati', l: 'Mati' }]} />
                  <input ref={inputGambar} type="file" accept="image/*" className="hidden" onChange={e => { unggahGambar(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => { const c = { ...terpilih, id: idBaru(), x: Math.min(ruang.p, terpilih.x + 0.6) }; setBenda(b => [...b, c]); setPilih(c.id); }}
                  className="flex-1 py-2 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">Duplikat</button>
                <button type="button" onClick={() => { setBenda(b => b.filter(x => x.id !== terpilih.id)); setPilih(null); }}
                  className="flex-1 py-2 rounded-lg text-xs font-bold border border-rose-200 text-rose-700 hover:bg-rose-50">Hapus</button>
              </div>
            </div>
          )}
          {benda.length > 0 && (
            <ul className="mt-3 pt-3 border-t border-slate-100 max-h-40 overflow-y-auto space-y-0.5">
              {benda.map(b => (
                <li key={b.id}>
                  <button type="button" onClick={() => setPilih(b.id)}
                    className={`w-full text-left px-2 py-1 rounded-md text-[12.5px] ${b.id === pilih ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>
                    {b.nama} <span className="text-slate-500">· {f(b.x, 1)}, {f(b.z, 1)} m</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Kartu>

        <Kartu judul="Simpan desain">
          <div className="flex gap-2">
            <input value={namaDesain} onChange={e => setNamaDesain(e.target.value)} placeholder="Nama desain"
              className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
            <button type="button" onClick={simpan} className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800">Simpan</button>
          </div>
          {tersimpan.length > 0 && (
            <ul className="mt-2 space-y-1">
              {tersimpan.map(t => (
                <li key={t.nama} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <button type="button" onClick={() => { setRuang({ ...RUANG_AWAL, ...t.ruang }); setBenda(t.benda); setNamaDesain(t.nama); setPilih(null); }}
                    className="text-blue-700 font-semibold hover:underline truncate">{t.nama}</button>
                  <span className="text-slate-500 flex-shrink-0">{t.ruang.p}×{t.ruang.l} m · {t.benda.length} benda</span>
                </li>
              ))}
            </ul>
          )}
          <Catatan>Disimpan di perangkat ini. Untuk dibagikan: unduh PNG (presentasi) atau GLB (dibuka di SketchUp/Blender/three.js editor), lalu lampirkan di Request Design Project.</Catatan>
        </Kartu>
      </div>
    </div>
  );
}
