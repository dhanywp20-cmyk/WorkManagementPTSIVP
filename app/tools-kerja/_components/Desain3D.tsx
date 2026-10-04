'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type * as THREEType from 'three';
import { ukuranDariDiagonal, FAKTOR_PANDANG, type JenisPandang } from '@/lib/av-hitung';
import { Angka, Pilih, Segmen, Kartu, Nilai, TombolSalin, Catatan, f } from './ui';
import { Ikon } from '@/components/shared/Ikon';

/**
 * Desain 3D Ruang AV - tata letak cepat untuk survey / presentasi solusi:
 * ruangan, display (LED / TV / layar proyektor), meja, kursi, speaker,
 * kamera, proyektor. Benda digeser langsung di lantai (atau lewat angka),
 * kamera bisa diputar. Analisis otomatis memakai aturan 4-6-8 dan sudut
 * pandang. Desain disimpan di perangkat ini (localStorage) dan bisa
 * diekspor jadi PNG untuk lampiran Request Design / penawaran.
 *
 * three.js dimuat dinamis saat alat ini dibuka - tidak membebani halaman lain.
 */

type Jenis = 'led' | 'tv' | 'layar' | 'meja' | 'kursi' | 'speaker' | 'speaker-plafon' | 'kamera' | 'proyektor';

interface Benda {
  id: string; jenis: Jenis; nama: string;
  x: number; z: number; /** derajat, 0 = menghadap +z (ke dalam ruangan) */ rot: number;
  /** m */ w: number; h: number; d: number; /** tinggi sisi bawah dari lantai */ elev: number;
  /** khusus TV: diagonal inci; LED: pitch mm */ diag?: number; pitch?: number;
}

const WARNA: Record<Jenis, number> = {
  led: 0x0f172a, tv: 0x111827, layar: 0xf8fafc, meja: 0xa16207, kursi: 0x475569,
  speaker: 0x1f2937, 'speaker-plafon': 0x64748b, kamera: 0x1d4ed8, proyektor: 0x64748b,
};
const LABEL: Record<Jenis, string> = {
  led: 'LED Videotron', tv: 'TV / Display', layar: 'Layar proyektor', meja: 'Meja', kursi: 'Kursi',
  speaker: 'Speaker dinding', 'speaker-plafon': 'Speaker plafon', kamera: 'Kamera PTZ', proyektor: 'Proyektor',
};
const DISPLAY: Jenis[] = ['led', 'tv', 'layar'];

let nomor = 0;
const idBaru = () => `b${Date.now().toString(36)}${(nomor++).toString(36)}`;

function bendaBaru(jenis: Jenis, ruang: { p: number; l: number; t: number }): Benda {
  const tengah = ruang.p / 2;
  const dasar = { id: idBaru(), jenis, nama: LABEL[jenis], x: tengah, z: ruang.l / 2, rot: 0 };
  switch (jenis) {
    case 'led': return { ...dasar, z: 0.08, w: 4, h: 2.25, d: 0.1, elev: 0.6, pitch: 2.5 };
    case 'tv': { const u = ukuranDariDiagonal(86); return { ...dasar, z: 0.05, w: u.lebarM, h: u.tinggiM, d: 0.07, elev: 1.0, diag: 86 }; }
    case 'layar': return { ...dasar, z: 0.03, w: 3, h: 1.875, d: 0.02, elev: 0.8 };
    case 'meja': return { ...dasar, z: ruang.l * 0.55, w: 1.2, h: 0.75, d: 3.6, elev: 0 };
    case 'kursi': return { ...dasar, z: ruang.l * 0.8, w: 0.5, h: 0.9, d: 0.5, elev: 0, rot: 180 };
    case 'speaker': return { ...dasar, x: 0.4, z: 0.15, w: 0.25, h: 0.4, d: 0.25, elev: 2.0 };
    case 'speaker-plafon': return { ...dasar, w: 0.24, h: 0.05, d: 0.24, elev: ruang.t - 0.05 };
    case 'kamera': return { ...dasar, z: 0.15, w: 0.17, h: 0.17, d: 0.17, elev: 0.4 };
    case 'proyektor': return { ...dasar, z: 4, w: 0.45, h: 0.15, d: 0.38, elev: ruang.t - 0.45, rot: 180 };
  }
}

function contohAwal(ruang: { p: number; l: number; t: number }): Benda[] {
  const tv = bendaBaru('tv', ruang);
  const meja = bendaBaru('meja', ruang);
  const kam = { ...bendaBaru('kamera', ruang), x: ruang.p / 2, elev: tv.elev - 0.3 };
  return [tv, meja, kam, { ...bendaBaru('speaker-plafon', ruang), x: ruang.p / 2, z: ruang.l / 3 }, { ...bendaBaru('speaker-plafon', ruang), x: ruang.p / 2, z: (ruang.l * 2) / 3 }];
}

/** Titik penonton: kursi, dan kursi di sekeliling meja (tepi meja + 0,4 m). */
function titikPenonton(b: Benda[]): { x: number; z: number; dari: string }[] {
  const hasil: { x: number; z: number; dari: string }[] = [];
  for (const x of b) {
    if (x.jenis === 'kursi') hasil.push({ x: x.x, z: x.z, dari: x.nama });
    if (x.jenis === 'meja') {
      const r = (x.rot * Math.PI) / 180;
      const lokal = [[-x.w / 2 - 0.4, -x.d / 2 + 0.3], [x.w / 2 + 0.4, -x.d / 2 + 0.3], [-x.w / 2 - 0.4, x.d / 2 - 0.3], [x.w / 2 + 0.4, x.d / 2 - 0.3], [0, x.d / 2 + 0.4]];
      for (const [lx, lz] of lokal) hasil.push({ x: x.x + lx * Math.cos(r) + lz * Math.sin(r), z: x.z - lx * Math.sin(r) + lz * Math.cos(r), dari: x.nama });
    }
  }
  return hasil;
}

const KUNCI_SIMPAN = 'wm_desain3d';

export default function Desain3D() {
  const [ruang, setRuang] = useState({ p: 8, l: 6, t: 3 });
  const [benda, setBenda] = useState<Benda[]>(() => contohAwal({ p: 8, l: 6, t: 3 }));
  const [pilih, setPilih] = useState<string | null>(null);
  const [tampilan, setTampilan] = useState<'3d' | 'atas'>('3d');
  const [jenisPandang, setJenisPandang] = useState<JenisPandang>('analitis');
  const [namaDesain, setNamaDesain] = useState('Ruang Meeting');
  const [tersimpan, setTersimpan] = useState<{ nama: string; ruang: typeof ruang; benda: Benda[] }[]>([]);
  const [siap, setSiap] = useState(false);
  const wadahRef = useRef<HTMLDivElement>(null);
  const tiga = useRef<{
    THREE: typeof THREEType; renderer: THREEType.WebGLRenderer; scene: THREEType.Scene;
    kamera: THREEType.PerspectiveCamera; kontrol: { target: THREEType.Vector3; update: () => void; enabled: boolean; dispose: () => void };
    grupRuang: THREEType.Group; grupBenda: THREEType.Group;
  } | null>(null);
  const bendaRef = useRef(benda); bendaRef.current = benda;
  const ruangRef = useRef(ruang); ruangRef.current = ruang;

  useEffect(() => {
    try { const s = localStorage.getItem(KUNCI_SIMPAN); if (s) setTersimpan(JSON.parse(s)); } catch { /* abaikan */ }
  }, []);

  // ── Inisialisasi three.js (sekali) ──
  useEffect(() => {
    let hidup = true;
    let bersihkan = () => {};
    (async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      const wadah = wadahRef.current;
      if (!hidup || !wadah) return;
      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      renderer.setClearColor(0xf1f5f9);
      wadah.appendChild(renderer.domElement);
      renderer.domElement.style.touchAction = 'none';
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.1));
      const mat = new THREE.DirectionalLight(0xffffff, 1.1); mat.position.set(6, 10, 8); scene.add(mat);
      const kamera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
      const kontrol = new OrbitControls(kamera, renderer.domElement);
      kontrol.enableDamping = true; kontrol.maxPolarAngle = Math.PI / 2 - 0.02;
      const grupRuang = new THREE.Group(); const grupBenda = new THREE.Group();
      scene.add(grupRuang, grupBenda);
      tiga.current = { THREE, renderer, scene, kamera, kontrol, grupRuang, grupBenda };

      const ukur = () => {
        const w = wadah.clientWidth, h = wadah.clientHeight;
        renderer.setSize(w, h, false); kamera.aspect = w / Math.max(1, h); kamera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(ukur); ro.observe(wadah); ukur();

      // ── Geser benda di lantai ──
      const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2();
      const lantai = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      let geser: { id: string; dx: number; dz: number } | null = null;
      const keNdc = (e: PointerEvent) => {
        const r = renderer.domElement.getBoundingClientRect();
        ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ptr, kamera);
      };
      const titikLantai = () => { const v = new THREE.Vector3(); return ray.ray.intersectPlane(lantai, v) ? v : null; };
      const turun = (e: PointerEvent) => {
        keNdc(e);
        const kena = ray.intersectObjects(grupBenda.children, true)[0];
        let o: THREEType.Object3D | null = kena?.object ?? null;
        while (o && !o.userData.id) o = o.parent;
        if (o?.userData.id) {
          const id = o.userData.id as string;
          setPilih(id);
          const b = bendaRef.current.find(x => x.id === id); const t = titikLantai();
          if (b && t) { geser = { id, dx: b.x - t.x, dz: b.z - t.z }; kontrol.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); }
        }
      };
      const gerak = (e: PointerEvent) => {
        if (!geser) return;
        keNdc(e); const t = titikLantai(); if (!t) return;
        const r = ruangRef.current; const g = geser;
        const x = Math.round(Math.min(r.p, Math.max(0, t.x + g.dx)) * 20) / 20;
        const z = Math.round(Math.min(r.l, Math.max(0, t.z + g.dz)) * 20) / 20;
        setBenda(bs => bs.map(b => (b.id === g.id ? { ...b, x, z } : b)));
      };
      const naik = () => { geser = null; kontrol.enabled = true; };
      renderer.domElement.addEventListener('pointerdown', turun);
      renderer.domElement.addEventListener('pointermove', gerak);
      renderer.domElement.addEventListener('pointerup', naik);
      renderer.domElement.addEventListener('pointercancel', naik);

      let jalan = true;
      const putar = () => { if (!jalan) return; kontrol.update(); renderer.render(scene, kamera); requestAnimationFrame(putar); };
      putar();
      setSiap(true);
      bersihkan = () => {
        jalan = false; ro.disconnect(); kontrol.dispose(); renderer.dispose();
        renderer.domElement.remove();
      };
    })();
    return () => { hidup = false; bersihkan(); };
  }, []);

  // ── Bangun ulang ruang ──
  useEffect(() => {
    const t = tiga.current; if (!t || !siap) return;
    const { THREE, grupRuang } = t;
    grupRuang.clear();
    const lantai = new THREE.Mesh(new THREE.PlaneGeometry(ruang.p, ruang.l), new THREE.MeshStandardMaterial({ color: 0xe7e5e4 }));
    lantai.rotation.x = -Math.PI / 2; lantai.position.set(ruang.p / 2, 0, ruang.l / 2); grupRuang.add(lantai);
    const grid = new THREE.GridHelper(Math.max(ruang.p, ruang.l), Math.max(ruang.p, ruang.l), 0xa8a29e, 0xd6d3d1);
    grid.position.set(ruang.p / 2, 0.002, ruang.l / 2); grupRuang.add(grid);
    /*  Tiga dinding saja (belakang, kiri, kanan) - dinding depan dibiarkan
        terbuka supaya isi ruangan terlihat. Bukan kotak tertutup: alas kotak
        berimpit dengan lantai dan menimbulkan garis-garis (z-fighting). */
    const bahanDinding = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const dinding = (w: number, x: number, z: number, rotY: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, ruang.t), bahanDinding);
      m.position.set(x, ruang.t / 2, z); m.rotation.y = rotY; grupRuang.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, ruang.t)), new THREE.LineBasicMaterial({ color: 0x94a3b8 }));
      e.position.copy(m.position); e.rotation.y = rotY; grupRuang.add(e);
    };
    dinding(ruang.p, ruang.p / 2, 0, 0);
    dinding(ruang.l, 0, ruang.l / 2, Math.PI / 2);
    dinding(ruang.l, ruang.p, ruang.l / 2, -Math.PI / 2);
  }, [ruang, siap]);

  // ── Bangun ulang benda ──
  useEffect(() => {
    const t = tiga.current; if (!t || !siap) return;
    const { THREE, grupBenda } = t;
    grupBenda.clear();
    for (const b of benda) {
      const g = new THREE.Group(); g.userData.id = b.id;
      const terpilih = b.id === pilih;
      const bahan = new THREE.MeshStandardMaterial({ color: WARNA[b.jenis], emissive: terpilih ? 0x1d4ed8 : 0x000000, emissiveIntensity: terpilih ? 0.35 : 0 });
      let m: THREEType.Mesh;
      if (b.jenis === 'speaker-plafon') m = new THREE.Mesh(new THREE.CylinderGeometry(b.w / 2, b.w / 2, b.h, 24), bahan);
      else if (b.jenis === 'kamera') m = new THREE.Mesh(new THREE.SphereGeometry(b.w / 2, 20, 16), bahan);
      else m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), bahan);
      m.position.y = b.elev + b.h / 2;
      g.add(m);
      if (DISPLAY.includes(b.jenis)) {
        // Muka layar (biru gelap untuk LED/TV) supaya arah hadap terlihat.
        const muka = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 0.97, b.h * 0.95),
          new THREE.MeshBasicMaterial({ color: b.jenis === 'layar' ? 0xffffff : 0x1e3a8a }));
        muka.position.set(0, b.elev + b.h / 2, b.d / 2 + 0.002); g.add(muka);
      }
      if (b.jenis === 'kursi') {
        const sandaran = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.45, 0.06), bahan);
        sandaran.position.set(0, 0.68, -b.d / 2 + 0.03); m.scale.y = 0.5; m.position.y = 0.23; g.add(sandaran);
      }
      if (b.jenis === 'meja') {
        m.scale.y = 0.06; m.position.y = b.h;
        const bahanKaki = new THREE.MeshStandardMaterial({ color: 0x57534e });
        for (const [kx, kz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const kaki = new THREE.Mesh(new THREE.BoxGeometry(0.05, b.h, 0.05), bahanKaki);
          kaki.position.set(kx * (b.w / 2 - 0.08), b.h / 2, kz * (b.d / 2 - 0.08)); g.add(kaki);
        }
      }
      g.position.set(b.x, 0, b.z);
      g.rotation.y = (b.rot * Math.PI) / 180;
      grupBenda.add(g);
    }
  }, [benda, pilih, siap]);

  // ── Posisi kamera ──
  useEffect(() => {
    const t = tiga.current; if (!t || !siap) return;
    const c = new t.THREE.Vector3(ruang.p / 2, 0.8, ruang.l / 2);
    t.kontrol.target.copy(c);
    if (tampilan === 'atas') t.kamera.position.set(ruang.p / 2, Math.max(ruang.p, ruang.l) * 1.5, ruang.l / 2 + 0.01);
    else t.kamera.position.set(ruang.p * 1.1, ruang.t * 1.9, ruang.l * 1.55);
    t.kontrol.update();
  }, [tampilan, ruang.p, ruang.l, ruang.t, siap]);

  const terpilih = benda.find(b => b.id === pilih) ?? null;
  const ubah = (x: Partial<Benda>) => setBenda(bs => bs.map(b => (b.id === pilih ? { ...b, ...x } : b)));
  const tambah = (j: Jenis) => { const b = bendaBaru(j, ruang); setBenda(bs => [...bs, b]); setPilih(b.id); };

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
        return { jarak, sudut };
      });
      const terjauh = data.reduce((m, x) => Math.max(m, x.jarak), 0);
      const terdekat = data.reduce((m, x) => Math.min(m, x.jarak), Infinity);
      const sudutMaks = data.reduce((m, x) => Math.max(m, x.sudut), 0);
      const tinggiPerlu = terjauh / FAKTOR_PANDANG[jenisPandang];
      return { d, jumlah: data.length, terjauh, terdekat, sudutMaks, tinggiPerlu, cukup: d.h >= tinggiPerlu };
    });
  }, [benda, jenisPandang]);

  const simpan = () => {
    const daftar = [{ nama: namaDesain || 'Tanpa nama', ruang, benda }, ...tersimpan.filter(t => t.nama !== namaDesain)].slice(0, 12);
    setTersimpan(daftar);
    try { localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(daftar)); } catch { /* abaikan */ }
  };
  const unduhPNG = () => {
    const t = tiga.current; if (!t) return;
    t.renderer.render(t.scene, t.kamera);
    const a = document.createElement('a');
    a.href = t.renderer.domElement.toDataURL('image/png');
    a.download = `${(namaDesain || 'desain-av').replace(/[^\w-]+/g, '-')}.png`;
    a.click();
  };
  const ringkasan = () => [
    `*Desain ruang: ${namaDesain}*`,
    `Ruang ${ruang.p} × ${ruang.l} m, plafon ${ruang.t} m`,
    ...Object.entries(benda.reduce<Record<string, number>>((m, b) => { m[b.nama] = (m[b.nama] ?? 0) + 1; return m; }, {})).map(([n, j]) => `- ${n}: ${j}`),
    ...analisis.map(a => `${a.d.nama}: ${f(a.d.w)} × ${f(a.d.h)} m, penonton terjauh ${f(a.terjauh, 1)} m → tinggi perlu ${f(a.tinggiPerlu)} m (${a.cukup ? 'CUKUP' : 'KURANG'}), sudut maks ${f(a.sudutMaks, 0)}°`),
  ].join('\n');

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] items-start">
      <div className="space-y-3 min-w-0">
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 flex-wrap">
            <Segmen nilai={tampilan} onUbah={setTampilan} opsi={[{ v: '3d', l: '3D' }, { v: 'atas', l: 'Atas' }]} />
            <div className="flex gap-2">
              <button type="button" onClick={unduhPNG} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">
                <Ikon nama="📷" ukuran={14} /> Unduh PNG
              </button>
              <TombolSalin teks={ringkasan} />
            </div>
          </div>
          <div ref={wadahRef} className="relative w-full h-[360px] sm:h-[520px]">
            {!siap && <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">Memuat tampilan 3D...</div>}
          </div>
          <p className="px-3 py-2 text-[11.5px] text-slate-500 border-t border-slate-100">
            Klik & geser benda untuk memindahkan · geser area kosong untuk memutar · scroll/cubit untuk zoom
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
          <Catatan>Posisi penonton diambil dari kursi dan sekeliling meja. Aturan 4-6-8: jarak terjauh maksimal 4/6/8× tinggi gambar untuk konten detail/analitis/umum.</Catatan>
        </Kartu>
      </div>

      <div className="space-y-3 min-w-0">
        <Kartu judul="Ruangan">
          <div className="grid grid-cols-3 gap-2">
            <Angka label="Panjang" nilai={ruang.p} onUbah={v => v >= 2 && v <= 60 && setRuang(r => ({ ...r, p: v }))} satuan="m" />
            <Angka label="Lebar" nilai={ruang.l} onUbah={v => v >= 2 && v <= 60 && setRuang(r => ({ ...r, l: v }))} satuan="m" />
            <Angka label="Plafon" nilai={ruang.t} onUbah={v => v >= 2 && v <= 20 && setRuang(r => ({ ...r, t: v }))} satuan="m" />
          </div>
        </Kartu>

        <Kartu judul="Tambah benda">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(LABEL) as Jenis[]).map(j => (
              <button key={j} type="button" onClick={() => tambah(j)}
                className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50">+ {LABEL[j]}</button>
            ))}
          </div>
        </Kartu>

        <Kartu judul={terpilih ? `Ubah: ${terpilih.nama}` : 'Benda terpilih'}>
          {!terpilih ? <p className="text-sm text-slate-500">Klik benda di tampilan 3D atau pilih dari daftar.</p> : (
            <div className="space-y-2.5">
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
                  <button type="button" onClick={() => { setRuang(t.ruang); setBenda(t.benda); setNamaDesain(t.nama); setPilih(null); }}
                    className="text-blue-700 font-semibold hover:underline truncate">{t.nama}</button>
                  <span className="text-slate-500 flex-shrink-0">{t.ruang.p}×{t.ruang.l} m · {t.benda.length} benda</span>
                </li>
              ))}
            </ul>
          )}
          <Catatan>Disimpan di perangkat ini. Untuk dibagikan, unduh PNG lalu lampirkan di Request Design Project.</Catatan>
        </Kartu>
      </div>
    </div>
  );
}
