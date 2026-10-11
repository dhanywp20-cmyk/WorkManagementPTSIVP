'use client';
/**
 * Engine three.js: renderer, adegan, lampu, kamera orbit, gizmo, klik-pilih, putaran render; mode seret.
 * Bagian dari Desain3D.tsx (Tools Team) - lihat struktur di desain3d/README.md.
 */
import { useEffect } from 'react';
import { sesuaikanTinggi } from '../bangun';
import { daftarRuang, ikutUtama, ruangDari, togglePilih } from '../inti';
import type * as T from 'three';
import type { KeadaanDesain } from '../useKeadaanDesain';
import type { Mesin } from './tipe';
import { batasDunia, terbangKe } from './kamera';
import { hindariTumpuk } from './label';


export function useMesin(K: KeadaanDesain) {
  const { bendaRef, dariToggle, gambarLayar, klikUkurRef, mesin, modeBanyakRef, modeSeret, pilihLainRef, pilihRef, ruangRef, setBenda, setGalat, setPilih, setPilihLain, setSiap, siap, wadahRef } = K;
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
          const id = o.userData.id as string;
          setBenda(bs => {
            const lama = bs.find(b => b.id === id); if (!lama) return bs;
            const satu = bs.map(b => (b.id === id ? { ...b, x, z, rot, elev } : b));
            //  Pilih banyak: benda lain ikut tergeser / berputar mengelilingi benda utama.
            return pilihLainRef.current.length ? ikutUtama(satu, pilihLainRef.current, lama, { x, z, rot, elev }) : satu;
          });
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
          //  Mode penggaris: klik = titik ukur di permukaan pertama yang kena (benda atau ruangan), bukan memilih benda.
          if (klikUkurRef.current) {
            const p = ray.intersectObjects([...grupBenda.children.filter(o => !o.userData.sorot), ...grupRuang.children], true)[0]?.point;
            if (p) klikUkurRef.current([p.x, p.y, p.z]);
            return;
          }
          //  Kotak sorotan (garis) dikecualikan: ambang raycast garis 1 m membuat
          //  klik di dekat benda terpilih justru membatalkan pilihan.
          const kena = ray.intersectObjects(grupBenda.children.filter(o => !o.userData.sorot), true)[0];
          let o: T.Object3D | null = kena?.object ?? null;
          while (o && !o.userData.id) o = o.parent;
          const idKena = (o?.userData.id as string | undefined) ?? null;
          if (e.shiftKey || e.ctrlKey || e.metaKey || modeBanyakRef.current) {
            //  Tambah / lepas dari pilihan; klik ruang kosong tidak melepas pilihan.
            if (idKena) {
              const r = togglePilih(pilihRef.current, pilihLainRef.current, idKena);
              if (r.pilih !== pilihRef.current) dariToggle.current = true;
              setPilih(r.pilih); setPilihLain(r.lain);
            }
          } else setPilih(idKena);
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

}
