/**
 * app/dashboard/_components/koper-adegan.ts
 *
 * Adegan 3D koper untuk halaman login. Modul ini SENGAJA dipisah dari
 * komponen React supaya bisa dimuat secara dinamis — three.js berukuran
 * ratusan kilobyte dan tidak boleh ikut bundel awal halaman login.
 *
 * Semua gerak diturunkan dari SATU profil kecepatan yang diintegrasikan sekali
 * di awal. Konsekuensinya: posisi, putaran kaki, dan reaksi gagang tidak
 * pernah bisa bertentangan satu sama lain. Kaki berputar persis sejauh koper
 * berpindah (mustahil menyeret), dan gagang berayun mengikuti sudut koper
 * terguling dengan jeda, bukan angka yang dikarang per fase.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type OpsiAdegan = { kecil?: boolean; palet?: keyof typeof PALET };
export type Adegan = ReturnType<typeof buatAdegan>;

/* ── Ukuran koper (satuan dunia ≈ meter) ───────────────────────────────── */
const W = 0.82;   // lebar, searah jalan — koper klasik memang mendatar
const H = 0.60;   // tinggi badan koper
const D = 0.26;   // tebal, ke arah kamera
const T = 0.022;  // tebal cangkang
const RJ = 0.027; // jari-jari kaki bulat di keempat sudut bawah

/* ── Waktu (detik) ─────────────────────────────────────────────────────── */
export const WAKTU = {
  mulai: 0.50, gulirSelesai: 2.40,
  dekat: 2.90,        // saat menyentuh penghalang
  jatuhMulai: 3.05, mendarat: 3.55, pantulSelesai: 3.78,
  bukaMulai: 3.70, bukaSelesai: 4.25,
  ungkapMulai: 3.95, ungkapSelesai: 4.60,
  jeda: 5.10, kartu: 5.30, selesai: 6.80,

  /* ── Urutan keluar: login berhasil ──
     Dipicu saat pengguna benar-benar berhasil masuk. Waktunya memakai jam yang
     sama dengan adegan masuk supaya tidak ada dua sumber waktu yang bisa
     berselisih. Diukur dari saat dipicu: kartu mulai kembali +0,25 dtk, tutup
     koper menutup +0,60, mengatup rapat +0,78. */
  keluarMulai: 6.90,
  kartuMasuk: 7.00,
  kartuMasukSelesai: 7.35,
  tutupMulai: 7.35, tutupSelesai: 7.53,
  habis: 7.68,
};

/* ── Lintasan ──────────────────────────────────────────────────────────── */
const X_AWAL = -1.98;
const X_TABRAK = 0.00;

/* Profil kecepatan: pelan → sedang → sedikit lebih cepat → melambat →
   tertahan. Titik-titik ini yang menentukan rasa beratnya. */
const PROFIL = [
  [0.50, 0.00], [0.95, 0.85], [1.45, 1.55], [1.95, 2.05],
  [2.25, 2.15], [2.40, 2.02], [2.62, 1.62], [2.80, 1.30],
  [2.88, 1.05], [2.90, 0.18], [2.98, 0.00], [7.00, 0.00],
];

function kecepatanKasar(t: number): number {
  if (t <= PROFIL[0][0]) return 0;
  for (let i = 0; i < PROFIL.length - 1; i++) {
    const [t0, v0] = PROFIL[i], [t1, v1] = PROFIL[i + 1];
    if (t >= t0 && t <= t1) {
      const u = (t - t0) / (t1 - t0);
      const s = u * u * (3 - 2 * u); // smoothstep: tanpa patahan percepatan
      return v0 + (v1 - v0) * s;
    }
  }
  return 0;
}

/* Integrasi sekali di awal → tabel jarak tempuh, lalu diskalakan supaya
   berhenti tepat di penghalang. */
const DT = 1 / 480;
const TABEL = (() => {
  const n = Math.ceil(7 / DT) + 1;
  const s = new Float32Array(n);
  let akum = 0;
  for (let i = 1; i < n; i++) {
    akum += kecepatanKasar(i * DT) * DT;
    s[i] = akum;
  }
  const skala = (X_TABRAK - X_AWAL) / akum;
  for (let i = 0; i < n; i++) s[i] *= skala;
  return { s, skala, n };
})();

function jarak(t: number) {
  const i = Math.min(TABEL.n - 1, Math.max(0, Math.floor(t / DT)));
  return TABEL.s[i];
}
function kecepatan(t: number) { return kecepatanKasar(t) * TABEL.skala; }
function percepatan(t: number) { return (kecepatan(t + 0.012) - kecepatan(t - 0.012)) / 0.024; }

/* ── Easing ────────────────────────────────────────────────────────────── */
const jepit = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const bagi = (t: number, a: number, b: number) => jepit((t - a) / (b - a), 0, 1);
const keluar3 = (u: number) => 1 - Math.pow(1 - u, 3);
const keluar5 = (u: number) => 1 - Math.pow(1 - u, 5);
const masuk2 = (u: number) => u * u;
const halus = (u: number) => u * u * (3 - 2 * u);

/* Sudut koper terguling pada waktu tertentu. Dipisah menjadi fungsi karena
   gagang jinjing membacanya pada waktu yang sedikit tertinggal — itulah yang
   membuat ayunannya terasa punya massa, bukan menempel kaku pada badan. */
function gulingPada(tt: number): number {
  if (tt < WAKTU.jatuhMulai) return 0;
  const u = bagi(tt, WAKTU.jatuhMulai, WAKTU.mendarat);
  if (tt < WAKTU.mendarat) return -(Math.PI / 2) * (0.12 * u + 0.88 * masuk2(u));
  const p = bagi(tt, WAKTU.mendarat, WAKTU.pantulSelesai);
  return -Math.PI / 2 - 0.055 * Math.sin(p * Math.PI * 2.6) * (1 - p);
}

/* ── Bahan ─────────────────────────────────────────────────────────────── */
const BAHAN = {
  cangkang: new THREE.MeshStandardMaterial(),
  cangkangTutup: new THREE.MeshStandardMaterial(),  // tutup sedikit lebih tua
  cangkangGelap: new THREE.MeshStandardMaterial(),
  /* Tetap netral di kedua palet. Roda dan dudukan gagang berfungsi sebagai
     jangkar gelap; tanpa itu koper merah terbaca sebagai satu blok datar. */
  gelap: new THREE.MeshStandardMaterial({ color: 0x4a2f16, roughness: 0.7, metalness: 0.05 }),
  kulit: new THREE.MeshStandardMaterial(),          // bingkai belah + pegangan sisi
  logam: new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.22, metalness: 0.95 }),
  logamGelap: new THREE.MeshStandardMaterial({ color: 0x8d939b, roughness: 0.32, metalness: 0.9 }),
  karet: new THREE.MeshStandardMaterial({ color: 0x3a250f, roughness: 0.78, metalness: 0.04 }),
  lapisan: new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0.0 }),
};

/* Dua pilihan warna.
   'tan'    — kulit cokelat karamel seperti koper acuan: matte, hampir tanpa
              kilau logam. Bingkai belahnya aluminium, sabuk sudutnya cokelat
              tua. Inilah yang dipakai secara bawaan.
   'merah'  — varian yang mengambil keluarga warna panel kiri halaman login,
              untuk dibandingkan. */
export const PALET = {
  tan: {
    cangkang:      { color: 0xa9682e, roughness: 0.62, metalness: 0.04 },
    cangkangTutup: { color: 0x9c5e28, roughness: 0.64, metalness: 0.04 },
    cangkangGelap: { color: 0x6a3d14, roughness: 0.68, metalness: 0.03 },
    kulit:         { color: 0xd8dde3, roughness: 0.26, metalness: 0.9 },
    lapisan:       { color: 0xe9e2d4 },
  },
  merah: {
    cangkang:      { color: 0xa5143a, roughness: 0.36, metalness: 0.16 },
    cangkangTutup: { color: 0x8d1130, roughness: 0.38, metalness: 0.16 },
    cangkangGelap: { color: 0x6d0c24, roughness: 0.44, metalness: 0.14 },
    kulit:         { color: 0xccd2d9, roughness: 0.26, metalness: 0.88 },
    lapisan:       { color: 0xe6e0d6 },
  },
};

export function pakaiPalet(nama: keyof typeof PALET) {
  const p: Record<string, { color: number; roughness?: number; metalness?: number }> = PALET[nama] || PALET.merah;
  for (const kunci of Object.keys(p)) {
    const m = (BAHAN as Record<string, THREE.MeshStandardMaterial>)[kunci], v = p[kunci];
    m.color.setHex(v.color);
    if (v.roughness !== undefined) m.roughness = v.roughness;
    if (v.metalness !== undefined) m.metalness = v.metalness;
    m.needsUpdate = true;
  }
}
pakaiPalet('merah');

function kotak(w: number, h: number, d: number, bahan: THREE.Material, r = 0.012) {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2.05));
  const m = new THREE.Mesh(g, bahan);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* Satu belahan cangkang: panel dasar + empat bibir + lapisan dalam.
   Dibangun berongga supaya waktu terbuka benar-benar terlihat isinya. */
function belahan(arah: number) {
  const g = new THREE.Group();
  const dz = D / 2;
  const kulitLuar = arah > 0 ? BAHAN.cangkangTutup : BAHAN.cangkang;
  const dasar = kotak(W, H, T, kulitLuar, 0.02);
  dasar.position.z = arah * (dz - T / 2);
  g.add(dasar);

  const bibirTB = () => kotak(W, T, dz - T, kulitLuar, 0.008);
  const atas = bibirTB(); atas.position.set(0, H / 2 - T / 2, arah * (dz - T) / 2); g.add(atas);
  const bawah = bibirTB(); bawah.position.set(0, -H / 2 + T / 2, arah * (dz - T) / 2); g.add(bawah);
  const bibirLR = () => kotak(T, H - 2 * T, dz - T, kulitLuar, 0.008);
  const kiri = bibirLR(); kiri.position.set(-W / 2 + T / 2, 0, arah * (dz - T) / 2); g.add(kiri);
  const kanan = bibirLR(); kanan.position.set(W / 2 - T / 2, 0, arah * (dz - T) / 2); g.add(kanan);

  const lapis = kotak(W - 2.4 * T, H - 2.4 * T, 0.005, BAHAN.lapisan, 0.004);
  lapis.position.z = arah * (dz - T - 0.004);
  lapis.castShadow = false;
  g.add(lapis);

  // Sabuk sudut: dua bilah cokelat tua di kiri dan kanan muka, menonjol
  // sedikit — ciri koper kulit klasik, bukan alur cangkang keras.
  for (const sx of [-1, 1]) {
    const sabuk = kotak(0.062, H + 0.006, dz - T + 0.016, BAHAN.cangkangGelap, 0.014);
    sabuk.position.set(sx * (W / 2 - 0.095), 0, arah * (dz - T + 0.016) / 2);
    g.add(sabuk);
  }
  return g;
}

function buatKoper() {
  const akar = new THREE.Group();

  /* Badan (belakang, z<0) dan tutup (depan, z>0) — cangkang kerang yang
     berengsel di tepi bawah, persis cara koper kaku dibuka. */
  akar.add(belahan(-1));
  const engsel = new THREE.Group();
  engsel.position.set(0, -H / 2, 0);
  const tutup = belahan(+1);
  tutup.position.y = H / 2;
  engsel.add(tutup);
  akar.add(engsel);

  /* Bingkai belah aluminium: empat bilah di tepi, menonjol sedikit dari
     cangkang supaya garis peraknya benar-benar terbaca dari samping. */
  for (const [w, h, x, y] of [
    [W + 0.016, 0.028, 0, H / 2 - 0.014], [W + 0.016, 0.028, 0, -H / 2 + 0.014],
    [0.028, H - 0.030, -W / 2 + 0.014, 0], [0.028, H - 0.030, W / 2 - 0.014, 0],
  ]) {
    const bilah = kotak(w, h, 0.062, BAHAN.kulit, 0.008);
    bilah.position.set(x, y, 0);
    akar.add(bilah);
  }

  /* Dua kunci jepret aluminium di bibir atas. */
  for (const sx of [-1, 1]) {
    const kunci = kotak(0.062, 0.034, 0.044, BAHAN.logam, 0.008);
    kunci.position.set(sx * 0.20, H / 2 - 0.030, 0);
    akar.add(kunci);
  }

  /* Kaki: empat bulatan pipih di sudut bawah. Koper acuan memakai kaki
     seperti ini, bukan roda besar. Karena bentuknya bulat, putarannya tetap
     diturunkan dari jarak tempuh — jadi tidak pernah terlihat menyeret. */
  const kaki = [];
  const gKaki = new THREE.SphereGeometry(RJ, 18, 12);
  gKaki.scale(1, 0.82, 1);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const k = new THREE.Mesh(gKaki, BAHAN.karet);
      k.castShadow = true; k.receiveShadow = true;
      k.position.set(sx * (W / 2 - 0.075), -H / 2 - RJ * 0.72, sz * (D / 2 - 0.055));
      akar.add(k);
      kaki.push(k);
    }
  }

  /* Gagang jinjing melengkung di sisi atas, digantung pada dua braket
     aluminium. Engselnya sejajar sumbu X — sama dengan sumbu koper terguling,
     jadi waktu koper rebah gagangnya ikut berayun seperti bandul sungguhan. */
  const gagang = new THREE.Group();
  gagang.position.set(0, H / 2 + 0.012, 0);
  const lengkung = new THREE.Mesh(
    new THREE.TorusGeometry(0.088, 0.017, 12, 28, Math.PI),
    BAHAN.gelap,
  );
  lengkung.castShadow = true;
  lengkung.scale.set(1, 0.78, 1);      // lebih landai, seperti gagang koper
  gagang.add(lengkung);
  for (const sx of [-1, 1]) {
    const braket = kotak(0.030, 0.026, 0.040, BAHAN.logam, 0.006);
    braket.position.set(sx * 0.088, 0.004, 0);
    gagang.add(braket);
  }
  akar.add(gagang);

  return { akar, engsel, kaki, gagang };
}

/* Tekstur cahaya lembut — dibuat di kanvas, tidak perlu berkas luar. */
function teksturCahaya(kuat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  if (!x) return new THREE.Texture();
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.00, `rgba(255,255,255,${0.95 * kuat})`);
  g.addColorStop(0.28, `rgba(255,248,240,${0.42 * kuat})`);
  g.addColorStop(0.62, `rgba(255,238,225,${0.11 * kuat})`);
  g.addColorStop(1.00, 'rgba(255,235,220,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buatAdegan(canvas: HTMLCanvasElement, opsi: OpsiAdegan = {}) {
  const kecil = !!opsi.kecil;
  pakaiPalet(opsi.palet || 'merah');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearAlpha(0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);

  /* Kamera dikunci. Yang bergerak hanya kopernya. */
  /* Di layar sempit kartu login memakan hampir seluruh tinggi panel, jadi
     garis lantai harus turun jauh lebih ke bawah. Bukan kopernya yang
     digeser — kameranya yang dibidik lebih tinggi. */
  const KAM: { pos: [number, number, number]; bidik: [number, number, number] } = kecil
    ? { pos: [1.75, 3.85, 8.10], bidik: [0, 2.30, 0] }
    : { pos: [2.05, 3.30, 8.10], bidik: [0, 1.72, 0] };
  camera.position.set(...KAM.pos);
  camera.lookAt(...KAM.bidik);

  /* Cahaya: satu kunci berbayang + langit lembut + isian dingin dari belakang. */
  const kunci = new THREE.DirectionalLight(0xfff6ec, 2.35);
  kunci.position.set(1.5, 5.4, 2.9);
  kunci.castShadow = true;
  kunci.shadow.mapSize.set(2048, 2048);
  kunci.shadow.camera.left = -2.2; kunci.shadow.camera.right = 2.2;
  kunci.shadow.camera.top = 2.2; kunci.shadow.camera.bottom = -1.2;
  kunci.shadow.camera.near = 0.5; kunci.shadow.camera.far = 12;
  kunci.shadow.bias = -0.0012;
  kunci.shadow.radius = 5;
  scene.add(kunci);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc7ccd4, 1.35));
  const isian = new THREE.DirectionalLight(0xdce6f5, 0.7);
  isian.position.set(-3.0, 2.0, -3.2);
  scene.add(isian);

  /* Lantai hanya penangkap bayangan — latar halaman tidak boleh tertutup. */
  const lantai = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.ShadowMaterial({ opacity: 0.21 }),
  );
  lantai.rotation.x = -Math.PI / 2;
  lantai.receiveShadow = true;
  scene.add(lantai);

  /* Penghalang: nyaris tidak terlihat, hanya sebagai alasan tabrakan. */
  const penghalang = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.024, 0.44),
    new THREE.MeshStandardMaterial({ color: 0x8b8f96, roughness: 0.7, metalness: 0.2, transparent: true, opacity: 0.26 }),
  );
  penghalang.position.set(X_TABRAK + W / 2 + 0.02, 0.014, -0.05);
  penghalang.receiveShadow = true; penghalang.castShadow = true;
  scene.add(penghalang);

  /* Susunan poros: jalan → sentak (poros roda depan) → guling (poros tepi
     dekat kamera). Dua poros terpisah supaya jatuhnya bukan satu rotasi. */
  const gJalan = new THREE.Group();
  const gSentak = new THREE.Group();
  const gGuling = new THREE.Group();
  const gKoper = new THREE.Group();
  const koper = buatKoper();

  gSentak.position.set(W / 2, 0, 0);
  gGuling.position.set(-W / 2, 0, -D / 2);
  gKoper.position.set(0, H / 2 + 1.54 * RJ, D / 2);
  gKoper.add(koper.akar);
  gGuling.add(gKoper);
  gSentak.add(gGuling);
  gJalan.add(gSentak);
  scene.add(gJalan);

  /* Cahaya yang muncul dari dalam koper. */
  const cahaya = new THREE.Sprite(new THREE.SpriteMaterial({
    map: teksturCahaya(), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0,
  }));
  cahaya.scale.setScalar(0.1);
  scene.add(cahaya);
  const lampuIsi = new THREE.PointLight(0xfff0dc, 0, 1.1, 2);
  scene.add(lampuIsi);

  const BUTIR = 16;
  const butir: THREE.Sprite[] = [];
  const petaButir = teksturCahaya(0.9);
  for (let i = 0; i < BUTIR; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: petaButir, transparent: true, depthWrite: false,
      color: 0xd9536f, opacity: 0,
    }));
    s.userData = {
      fase: i / BUTIR,
      jari: 0.05 + Math.random() * 0.16,
      sudut: Math.random() * Math.PI * 2,
      tinggi: 0.35 + Math.random() * 0.5,
      besar: 0.014 + Math.random() * 0.022,
      laju: 0.75 + Math.random() * 0.6,
    };
    scene.add(s);
    butir.push(s);
  }

  /* Diisi ulang tiap bingkai; dibaca lapisan DOM untuk menautkan titik
     tumbuh kartu login ke mulut koper. */
  const mulut = { x: 52, y: 88 };

  /* ── Pose pada waktu t ─────────────────────────────────────────────── */
  function setWaktu(t: number) {
    const tampil = t >= 0.02;
    gJalan.visible = tampil;

    const s = jarak(t);
    const x = X_AWAL + s;
    gJalan.position.x = x;

    // Kaki bulat: sudut = jarak / jari-jari. Tidak ada peluang selip.
    const sudutKaki = -s / RJ;
    for (const k of koper.kaki) k.rotation.z = sudutKaki;

    // Suspensi: sedikit tenggelam saat melaju, plus getar halus sebelum tabrak.
    const laju = kecepatan(t);
    let turun = -0.004 * jepit(laju / 2.2, 0, 1);
    if (t > 2.55 && t < WAKTU.dekat) {
      const u = bagi(t, 2.55, WAKTU.dekat);
      turun -= 0.012 * u * u + 0.0022 * Math.sin(u * 26);
    }

    /* Sentakan: roda depan tertahan, badan meneruskan momentum. */
    let sentak = 0;
    if (t >= WAKTU.dekat) {
      const u = bagi(t, WAKTU.dekat, WAKTU.jatuhMulai + 0.10);
      sentak = -0.30 * Math.sin(Math.PI * Math.min(1, u * 0.92)) * (1 - 0.35 * u);

    }

    /* Terguling ke arah kamera, mendarat pada punggungnya. */
    const guling = gulingPada(t);
    let pantul = 0, gepeng = 1;
    if (t >= WAKTU.jatuhMulai) {
      sentak *= (1 - halus(bagi(t, WAKTU.jatuhMulai, WAKTU.mendarat)));
      if (t >= WAKTU.mendarat) {
        const p = bagi(t, WAKTU.mendarat, WAKTU.pantulSelesai);
        // Dua pantulan mengecil + sedikit gepeng saat menyentuh lantai.
        pantul = Math.abs(Math.sin(p * Math.PI * 2)) * 0.035 * (1 - p) * (1 - p);
        gepeng = 1 - 0.045 * Math.exp(-p * 9) * Math.abs(Math.cos(p * Math.PI * 3));
        turun = 0;
      }
    }
    gSentak.rotation.z = sentak;
    gGuling.rotation.x = guling;
    // Sentakan kecil badan koper saat daun tutup membentur.
    const sentakTutup = -0.010 * Math.sin(bagi(t, WAKTU.tutupSelesai - 0.03, WAKTU.tutupSelesai + 0.16) * Math.PI)
                        * (1 - bagi(t, WAKTU.tutupSelesai, WAKTU.tutupSelesai + 0.16));
    gKoper.position.y = H / 2 + 1.54 * RJ + turun + pantul + sentakTutup;
    gKoper.scale.set(1, gepeng, 1);

    /* Gagang jinjing = bandul pada engsel sumbu X.
       Tiga sumber gerak, semuanya punya sebab:
       1. koper terguling  → gagang berusaha tetap tegak terhadap dunia, dengan
          jeda 75 ms sehingga terlihat menyusul, bukan menempel;
       2. jalan            → getaran kecil sebanding kecepatan;
       3. tabrakan         → satu sentakan yang lalu mereda.
       Percepatan maju TIDAK menggerakkannya: engsel sejajar arah jalan, dan
       engsel memang tidak bisa bereaksi pada gaya searah porosnya. */
    let ayun = -gulingPada(t - 0.075) * 0.92;
    ayun += Math.sin((t - 0.5) * 9.5) * 0.045 * jepit(laju / 2.2, 0, 1);
    if (t >= WAKTU.dekat) {
      ayun += 0.34 * Math.sin(Math.PI * bagi(t, WAKTU.dekat, WAKTU.dekat + 0.40))
              * Math.exp(-(t - WAKTU.dekat) * 2.0);
    }
    koper.gagang.rotation.x = ayun;

    /* Tutup membuka dari engselnya. */
    const buka = keluar3(bagi(t, WAKTU.bukaMulai, WAKTU.bukaSelesai));
    // Sedikit melewati lalu mapan — pegas engsel.
    const lewat = Math.sin(bagi(t, WAKTU.bukaSelesai - 0.18, WAKTU.bukaSelesai + 0.22) * Math.PI) * 0.06;
    // Positif: setelah koper rebah, sumbu X lokal masih sejajar X dunia, dan
  // hanya arah positif yang mengayun tutup KE ATAS. Negatif menembus lantai.
  /* Menutup kembali saat login berhasil. Daunnya membentur badan lalu
     memantul balik sedikit — tutup koper kaku tidak pernah berhenti mati di
     sentuhan pertama. */
    const tutup = keluar3(bagi(t, WAKTU.tutupMulai, WAKTU.tutupSelesai));
    const pantulTutup = Math.sin(bagi(t, WAKTU.tutupSelesai - 0.02, WAKTU.tutupSelesai + 0.20) * Math.PI)
                        * 0.11 * (1 - bagi(t, WAKTU.tutupSelesai, WAKTU.tutupSelesai + 0.20));
    koper.engsel.rotation.x = (2.38 * buka + lewat) * (1 - tutup) + pantulTutup;

    /* Cahaya yang naik dari dalam koper. */
    const mulutDunia = new THREE.Vector3(0, 0.04, 0.02);
    gKoper.localToWorld(mulutDunia);
    const uu = bagi(t, WAKTU.ungkapMulai, WAKTU.ungkapSelesai);
    const redup = (1 - 0.45 * bagi(t, WAKTU.kartu - 0.1, WAKTU.kartu + 0.7))
                  * (1 - bagi(t, WAKTU.keluarMulai, WAKTU.kartuMasuk + 0.1));
    const naik = keluar5(uu);
    cahaya.position.set(mulutDunia.x + 0.01, 0.085 + naik * 0.10, mulutDunia.z + 0.02);
    cahaya.scale.setScalar(0.11 + naik * 0.20);
    cahaya.material.opacity = (0.10 + 0.72 * halus(uu)) * uu * redup;
    lampuIsi.position.set(mulutDunia.x, 0.16 + naik * 0.4, mulutDunia.z);
    lampuIsi.intensity = 1.0 * uu * redup;

    for (const s of butir) {
      const d = s.userData;
      const f = (uu * d.laju + d.fase) % 1;
      const hidup = uu > 0.02 ? 1 : 0;
      const su = d.sudut + f * 1.6;
      s.position.set(
        mulutDunia.x + Math.cos(su) * d.jari * (0.4 + f),
        0.06 + f * d.tinggi,
        mulutDunia.z + Math.sin(su) * d.jari * (0.4 + f) * 0.6,
      );
      s.scale.setScalar(d.besar * (1 - 0.35 * f));
      s.material.opacity = hidup * Math.sin(f * Math.PI) * 0.30 * redup;
    }

    // Titik tumbuh kartu login: mulut koper, diproyeksikan ke layar.
    const p = mulutDunia.clone().project(camera);
    mulut.x = (p.x * 0.5 + 0.5) * 100;
    mulut.y = (1 - (p.y * 0.5 + 0.5)) * 100;

    penghalang.material.opacity = 0.26 * (1 - 0.55 * bagi(t, WAKTU.mendarat, WAKTU.jeda));
    renderer.render(scene, camera);
  }

  /* Putaran koper saat pengguna berpindah ke form pendaftaran. Sumbunya
     tegak dan melewati pusat koper, jadi ia berputar di tempat. */
  let putar = 0;
  function setPutar(sudut: number) { putar = sudut; gJalan.rotation.y = sudut; }

  /* Melepas seluruh sumber daya GPU. Wajib dipanggil saat komponen dilepas:
     tanpa ini setiap kali pengguna keluar-masuk halaman login akan tertinggal
     satu konteks WebGL, dan browser hanya mengizinkan segelintir. */
  function lepas() {
    scene.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    for (const b of Object.values(BAHAN)) b.dispose();
    cahaya.material.map?.dispose();
    cahaya.material.dispose();
    petaButir.dispose();
    for (const s2 of butir) s2.material.dispose();
    renderer.dispose();
  }

  function ukur() {
    const l = canvas.clientWidth, tg = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(l, tg, false);
    camera.aspect = l / tg;
    // Bingkai tetap sama tinggi berapa pun lebarnya, jadi susunan tidak geser.
    camera.fov = 26 * (kecil ? 1.18 : 1);
    camera.updateProjectionMatrix();
  }

  ukur();
  return { setWaktu, setPutar, ukur, lepas, mulut, WAKTU };
}
