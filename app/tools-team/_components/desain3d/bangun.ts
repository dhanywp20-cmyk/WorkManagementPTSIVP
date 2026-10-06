/** Pembuat model 3D three.js untuk tiap jenis benda (dipisah dari model.ts). */
import type * as T from 'three';
import { pasangDari, type Benda, type Finish, barisTribun, engselProyektor, kursiTribunPerBaris, lensaDatar, modulLA, spekVideowall, sudutLampuDari, sudutModulLA, tiltDari, tiltLADari, tipeSpeakerDari, ukuranBidang, warnaKelvin } from './model';
import { acak, kanvas, teksturGrid, teksturIsiRak, teksturKolamCahaya, teksturMonitor, teksturPanel, warnaSah } from './tekstur';

// ── Pembuat model ──────────────────────────────────────────────────────────

interface Bahan { THREE: typeof T; layar: (b: Benda) => T.Texture | null; model: (kunci: string) => T.Object3D | null }

function mat(THREE: typeof T, warna: number, opsi: Partial<T.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color: warna, roughness: 0.6, metalness: 0.1, ...opsi });
}

export function kotak(THREE: typeof T, w: number, h: number, d: number, m: T.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o;
}

// ── Bentuk halus: sudut membulat & tepi bevel (bukan kotak tajam) ──────────

/** Persegi panjang bersudut membulat di bidang XY, berpusat di (0, 0). */
function persegiBulat(THREE: typeof T, w: number, h: number, r: number): T.Shape {
  const a = Math.max(0.001, w / 2), b = Math.max(0.001, h / 2);
  const R = Math.max(0.0005, Math.min(r, a - 0.0002, b - 0.0002));
  const s = new THREE.Shape();
  s.moveTo(-a + R, -b);
  s.lineTo(a - R, -b); s.absarc(a - R, -b + R, R, -Math.PI / 2, 0, false);
  s.lineTo(a, b - R); s.absarc(a - R, b - R, R, 0, Math.PI / 2, false);
  s.lineTo(-a + R, b); s.absarc(-a + R, b - R, R, Math.PI / 2, Math.PI, false);
  s.lineTo(-a, -b + R); s.absarc(-a + R, -b + R, R, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Bevel yang muat: tidak lebih dari separuh ukuran terkecil. */
const bevelAman = (bevel: number, ...ukuran: number[]) => Math.max(0, Math.min(bevel, ...ukuran.map(u => u / 2 - 0.0006)));

function ekstrusi(THREE: typeof T, bentuk: T.Shape, tebal: number, bv: number, lengkung = 14) {
  return new THREE.ExtrudeGeometry(bentuk, {
    depth: Math.max(0.0005, tebal - 2 * bv), bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv,
    bevelSegments: bv > 0 ? 3 : 1, curveSegments: lengkung,
  });
}

/** Lempeng mendatar dari bentuk tampak atas (bentuk x -> x, bentuk y -> z); y = 0 .. tebal. */
function lempeng(THREE: typeof T, bentuk: T.Shape, tebal: number, bv: number, m: T.Material, lengkung = 14) {
  const geo = ekstrusi(THREE, bentuk, tebal, bv, lengkung);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, tebal - bv, 0);
  return new THREE.Mesh(geo, m);
}

/** Papan tampak atas bersudut membulat: w (x) x d (z), tebal ke atas dari y = 0. */
function papan(THREE: typeof T, w: number, d: number, tebal: number, r: number, m: T.Material, bevel = 0.006) {
  const bv = bevelAman(bevel, tebal, w, d);
  return lempeng(THREE, persegiBulat(THREE, w - 2 * bv, d - 2 * bv, r - bv), tebal, bv, m);
}

/** Blok tampak depan bersudut membulat: w (x) x h (y), tebal d berpusat di z = 0, alas y = 0. */
function blok(THREE: typeof T, w: number, h: number, d: number, r: number, m: T.Material, bevel = 0.004) {
  const bv = bevelAman(bevel, d, w, h);
  const geo = ekstrusi(THREE, persegiBulat(THREE, w - 2 * bv, h - 2 * bv, r - bv), d, bv, 12);
  geo.translate(0, h / 2, -(d - 2 * bv) / 2);
  return new THREE.Mesh(geo, m);
}

/** Pipa melalui titik-titik dengan sudut tertekuk membulat (rangka meja, sandaran tangan). */
function pipa(THREE: typeof T, titik: [number, number, number][], jari: number, tekuk: number, m: T.Material, tutup = false) {
  const p = titik.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const n = p.length;
  const sudut = (i: number) => {
    const sblm = p[(i - 1 + n) % n], ini = p[i], ssdh = p[(i + 1) % n];
    return [
      ini.clone().add(sblm.clone().sub(ini).setLength(Math.min(tekuk, sblm.distanceTo(ini) / 2))),
      ini.clone().add(ssdh.clone().sub(ini).setLength(Math.min(tekuk, ssdh.distanceTo(ini) / 2))),
    ] as const;
  };
  const jalur = new THREE.CurvePath<T.Vector3>();
  if (tutup) {
    let mulai = sudut(0)[1];
    for (let i = 1; i <= n; i++) {
      const [a, b] = sudut(i % n);
      jalur.add(new THREE.LineCurve3(mulai, a));
      jalur.add(new THREE.QuadraticBezierCurve3(a, p[i % n], b));
      mulai = b;
    }
  } else {
    let mulai = p[0];
    for (let i = 1; i < n - 1; i++) {
      const [a, b] = sudut(i);
      jalur.add(new THREE.LineCurve3(mulai, a));
      jalur.add(new THREE.QuadraticBezierCurve3(a, p[i], b));
      mulai = b;
    }
    jalur.add(new THREE.LineCurve3(mulai, p[n - 1]));
  }
  return new THREE.Mesh(new THREE.TubeGeometry(jalur, Math.max(24, n * 14), jari, 10, tutup), m);
}

/**
 * Lengkungkan geometri menjadi cekung ke +z: tiap verteks maju sebanding x^2
 * (busur berjari R). Dipakai sandaran kursi supaya memeluk punggung, bukan
 * papan datar.
 */
function lengkungkan(geo: T.BufferGeometry, R: number) {
  const pos = geo.attributes.position as T.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + (pos.getX(i) ** 2) / (2 * R));
  pos.needsUpdate = true; geo.computeVertexNormals();
  return geo;
}

/** Silinder dari titik a ke b (kaki miring, lengan kaki bintang). */
function tiangAntara(THREE: typeof T, a: T.Vector3, b: T.Vector3, jari: number, m: T.Material, jariUjung = jari) {
  const arah = b.clone().sub(a);
  const o = new THREE.Mesh(new THREE.CylinderGeometry(jariUjung, jari, arah.length(), 12), m);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arah.normalize());
  return o;
}

/**
 * Sandaran melengkung: pita busur selebar `lebar`, cekung ke +z (ke arah
 * yang duduk), tinggi ke atas dari y = 0, bagian tengah pita di z = 0.
 */
export function sandaran(THREE: typeof T, lebar: number, tinggi: number, tebal: number, R: number, m: T.Material) {
  const sud = Math.asin(Math.min(0.95, lebar / (2 * R)));
  const s = new THREE.Shape();
  s.absarc(0, 0, R, Math.PI / 2 + sud, Math.PI / 2 - sud, true);
  s.absarc(0, 0, R - tebal, Math.PI / 2 - sud, Math.PI / 2 + sud, false);
  const bv = bevelAman(0.012, tebal, tinggi);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.001, tinggi - 2 * bv), bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv * 0.6,
    bevelSegments: 3, curveSegments: 24,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bv, R - tebal / 2);
  return new THREE.Mesh(geo, m);
}

// ── Tekstur material: kayu, kain, gril, layar lift ─────────────────────────

const WARNA_KAYU: Record<Finish, [string, string, string]> = {
  walnut: ['#583824', '#6c452b', '#2a170b'],
  oak: ['#c49a65', '#d5ad79', '#6e4b28'],
  putih: ['#f3f4f6', '#e9ebef', '#ffffff'],
};

/**
 * Serat kayu prosedural yang menyambung mulus (frekuensi gelombang = jumlah
 * siklus bulat sepanjang ubin), searah sisi panjang meja. Satu ubin = 1,6 m
 * searah serat x 0,4 m melintang; UV ekstrusi dalam meter.
 */
function teksturKayu(THREE: typeof T, fin: Finish, sepanjangZ: boolean): T.Texture {
  const P = 1024, L = 256;
  const c = kanvas(sepanjangZ ? L : P, sepanjangZ ? P : L, g => {
    const [a, b, serat] = WARNA_KAYU[fin];
    if (sepanjangZ) { g.translate(L, 0); g.rotate(Math.PI / 2); }
    const gr = g.createLinearGradient(0, 0, 0, L);
    gr.addColorStop(0, a); gr.addColorStop(0.5, b); gr.addColorStop(1, a);
    g.fillStyle = gr; g.fillRect(0, 0, P, L);
    if (fin === 'putih') return;
    g.strokeStyle = serat;
    for (let i = 0; i < 90; i++) {
      const y0 = Math.random() * L, amp = 1.5 + Math.random() * 5, fase = Math.random() * 6.3;
      const fr = (2 * Math.PI * (1 + Math.floor(Math.random() * 4))) / P;
      g.globalAlpha = 0.05 + Math.random() * 0.16; g.lineWidth = 0.5 + Math.random() * 1.8;
      g.beginPath();
      for (let x = 0; x <= P; x += 8) {
        const y = y0 + Math.sin(x * fr + fase) * amp + Math.sin(x * fr * 3 + fase) * amp * 0.25;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(sepanjangZ ? 1 / 0.4 : 1 / 1.6, sepanjangZ ? 1 / 1.6 : 1 / 0.4);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/**
 * Tekstur feature wall: marmer putih berurat abu (slab 1,2 × 2,4 m dengan nat tipis) atau panel
 * kayu walnut. Satu ubin tekstur = satu slab; UV bidang dinding dihitung dalam meter (repeat).
 */
export function teksturDindingAksen(THREE: typeof T, jenis: 'marmer' | 'kayu'): { tex: T.Texture; ubinW: number; ubinH: number } {
  if (jenis === 'kayu') {
    const tex = teksturKayu(THREE, 'walnut', true);
    tex.repeat.set(1, 1);
    return { tex, ubinW: 0.4, ubinH: 1.6 };
  }
  const W = 512, H = 1024;
  const c = kanvas(W, H, g => {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#f4f2ee'); gr.addColorStop(0.5, '#ebe8e2'); gr.addColorStop(1, '#f6f4f0');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const r = acak(77);
    for (let i = 0; i < 14; i++) {
      let x = r() * W, y = 0;
      g.strokeStyle = r() > 0.6 ? 'rgba(120,120,125,0.55)' : 'rgba(160,158,155,0.4)';
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath(); g.moveTo(x, y);
      while (y < H) { x += (r() - 0.5) * 60; y += 20 + r() * 50; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(90,90,90,0.35)'; g.fillRect(0, 0, W, 2); g.fillRect(0, 0, 2, H);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, ubinW: 1.2, ubinH: 2.4 };
}

/** Anyaman kain (jok kursi, soundbar). `ubin` = ukuran satu ubin dalam meter. */
function teksturKain(THREE: typeof T, dasar: string, ubin: number): T.Texture {
  const c = kanvas(128, 128, g => {
    g.fillStyle = dasar; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 2) { g.fillStyle = (y / 2) % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.07)'; g.fillRect(0, y, 128, 1); }
    for (let x = 1; x < 128; x += 2) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(x, 0, 1, 128); }
    for (let i = 0; i < 700; i++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1); }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / ubin, 1 / ubin); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Gril logam berlubang (speaker). `ulang` = jumlah ubin pada UV 0..1. */
function teksturGril(THREE: typeof T, dasar: string, lubang: string, ulang: number): T.Texture {
  const c = kanvas(128, 128, g => {
    g.fillStyle = dasar; g.fillRect(0, 0, 128, 128); g.fillStyle = lubang;
    for (let r = 0; r < 16; r++) {
      for (let q = 0; q < 16; q++) {
        const x = q * 8 + (r % 2 ? 4 : 0), y = r * 8 + 4;
        for (const dx of [-128, 0, 128]) { g.beginPath(); g.arc(x + dx, y, 2.3, 0, Math.PI * 2); g.fill(); }
      }
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(ulang, ulang); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/**
 * Mic boundary cakram bundar (kain abu-abu berpola konsentris + cincin LED hijau + ikon mic).
 * 'kain' = tutup atas yang berkain; 'ikon' = lapisan transparan cincin & ikon yang menyala.
 * Keduanya dipetakan ke lingkaran: pusat tekstur = pusat cakram, sisi kanvas = tepi cakram.
 */
function teksturMicBoundary(THREE: typeof T, bagian: 'kain' | 'ikon', dasar = '#6d6e72'): T.Texture {
  const U = 512, C = U / 2;
  const c = kanvas(U, U, g => {
    if (bagian === 'kain') {
      g.fillStyle = dasar; g.fillRect(0, 0, U, U);   // gelap sedikit: pencahayaan adegan menerangkan ~1,4x
      //  Anyaman melingkar: ratusan lingkaran tipis berselang-seling terang/gelap -> pola moire seperti kain asli.
      for (let r = 3; r < C * 1.45; r += 2.1) {
        g.strokeStyle = Math.round(r / 2.1) % 2 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)';
        g.lineWidth = 1; g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke();
      }
      for (let i = 0; i < 1800; i++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'; g.fillRect(Math.random() * U, Math.random() * U, 1.4, 1.4); }
      return;
    }
    const hijau = '#6bf2b0';
    g.shadowColor = '#2dff9a'; g.shadowBlur = 16; g.strokeStyle = hijau; g.fillStyle = hijau;
    g.lineWidth = 13; g.beginPath(); g.arc(C, C, 88, 0, Math.PI * 2); g.stroke();   // cincin LED
    g.shadowBlur = 8; g.lineWidth = 7; g.lineCap = 'round';
    const w = 17;                                                       // ikon mic: kapsul + busur + tiang + dasar
    g.beginPath(); g.moveTo(C - w, C - 22); g.arc(C, C - 22, w, Math.PI, 0); g.lineTo(C + w, C + 4); g.arc(C, C + 4, w, 0, Math.PI); g.closePath(); g.fill();
    g.beginPath(); g.arc(C, C + 4, w + 13, 0.12 * Math.PI, 0.88 * Math.PI); g.stroke();
    g.beginPath(); g.moveTo(C, C + 4 + w + 13); g.lineTo(C, C + 52); g.moveTo(C - 17, C + 52); g.lineTo(C + 17, C + 52); g.stroke();
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/** Layar paperless display lift: halaman masuk sistem rapat. */
function teksturLift(THREE: typeof T): T.Texture {
  const c = kanvas(512, 300, g => {
    const gr = g.createLinearGradient(0, 0, 512, 300);
    gr.addColorStop(0, '#0b2a5b'); gr.addColorStop(1, '#0e6f8f');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 300);
    g.fillStyle = '#ffffff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center';
    g.fillText('PAPERLESS', 256, 74);
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillRect(166, 108, 180, 26); g.fillRect(166, 146, 180, 26);
    g.fillStyle = '#38bdf8'; g.fillRect(166, 190, 180, 30);
    g.fillStyle = '#ffffff'; g.font = '17px sans-serif'; g.fillText('Masuk', 256, 211);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/**
 * Batang setinggi 1 m yang alasnya di y = 0; skala-y diatur sesuaikanTinggi().
 * peran 'kaki' = dari lantai sampai `atas` (lokal); 'tiang' = dari puncak benda ke plafon.
 */
export function batang(THREE: typeof T, w: number, d: number, m: T.Material, x: number, z: number, peran: 'kaki' | 'tiang', atas = 0, bulat = false) {
  const geo = bulat ? new THREE.CylinderGeometry(w / 2, w / 2, 1, 12) : new THREE.BoxGeometry(w, 1, d);
  geo.translate(0, 0.5, 0);
  const o = new THREE.Mesh(geo, m); o.position.set(x, 0, z);
  o.userData.peran = peran; o.userData.atas = atas;
  return o;
}

/** Bagian yang selalu di lantai (alas troli, roda). */
function diLantai(o: T.Object3D) { o.userData.peran = 'lantai'; return o; }

/**
 * Tribun: baris bertingkat (baris 0 di lantai, depan = +z), kursi teater per baris digambar
 * dengan InstancedMesh (ratusan kursi tetap ringan), lis tangga terang di tiap tepi anak tangga.
 */
function tribunModel(THREE: typeof T, g: T.Group, b: Benda, warnaKain: string) {
  const n = barisTribun(b), m = kursiTribunPerBaris(b);
  const tD = b.d / n, riser = n > 1 ? Math.max(0, (b.h - 0.95) / (n - 1)) : 0, pitch = (b.w - 0.6) / m;
  const beton = mat(THREE, 0x4b5058, { roughness: 0.9 });
  const lis = mat(THREE, 0xfef3c7, { emissive: 0xfde68a, emissiveIntensity: 0.5 });
  for (let i = 1; i < n; i++) {
    const z = b.d / 2 - tD * (i + 0.5), tinggi = i * riser;
    g.add(kotak(THREE, b.w, tinggi, tD, beton, 0, tinggi / 2, z));
    g.add(kotak(THREE, b.w, 0.012, 0.02, lis, 0, tinggi + 0.006, z + tD / 2 - 0.012));
  }
  const kain = new THREE.MeshStandardMaterial({ map: teksturKain(THREE, warnaKain, 0.08), roughness: 0.95 });
  const rangka = mat(THREE, 0x1f2227, { roughness: 0.5, metalness: 0.3 });
  const geoDuduk = new THREE.BoxGeometry(pitch * 0.82, 0.08, 0.44), geoSandar = new THREE.BoxGeometry(pitch * 0.86, 0.56, 0.07);
  const geoLengan = new THREE.BoxGeometry(0.05, 0.62, 0.5);
  const duduk = new THREE.InstancedMesh(geoDuduk, kain, n * m), sandar = new THREE.InstancedMesh(geoSandar, kain, n * m);
  const lengan = new THREE.InstancedMesh(geoLengan, rangka, n * (m + 1));
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3();
  const miring = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.18), lurus = new THREE.Quaternion();
  let k = 0;
  for (let i = 0; i < n; i++) {
    const y0 = i * riser, z0 = b.d / 2 - tD * (i + 0.5) + tD * 0.12;
    for (let j = 0; j < m; j++, k++) {
      const x = -b.w / 2 + 0.3 + (j + 0.5) * pitch;
      duduk.setMatrixAt(k, M.compose(P.set(x, y0 + 0.42, z0 + 0.02), lurus, S));
      sandar.setMatrixAt(k, M.compose(P.set(x, y0 + 0.72, z0 - 0.22), miring, S));
    }
    for (let j = 0; j <= m; j++) lengan.setMatrixAt(i * (m + 1) + j, M.compose(P.set(-b.w / 2 + 0.3 + j * pitch, y0 + 0.31, z0 - 0.02), Q.identity(), S));
  }
  for (const im of [duduk, sandar, lengan]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); g.add(im); }
}

/**
 * Bidang mapping: potongan silinder tegak (jari-jari R, busur). Lengkung = cekung, pusat
 * kelengkungan di depan (sisi penonton, +z); cembung = pusat di belakang; busur 360 = pilar.
 * Permukaan putih doff dua sisi, lis atas-bawah, tiang penyangga dari lantai bila melayang.
 */
function bidangMapping(THREE: typeof T, g: T.Group, b: Benda, warna: number) {
  const lis = mat(THREE, 0x1f2227, { metalness: 0.4, roughness: 0.5 });
  if (b.bentukBidang === 'datar') {
    //  Screen datar: permukaan doff + bingkai tipis + dua kaki penyangga di belakang.
    const { w } = ukuranBidang(b), muka = new THREE.Mesh(new THREE.PlaneGeometry(w, b.h), new THREE.MeshStandardMaterial({ color: warna, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }));
    muka.position.set(0, b.h / 2, 0.02); g.add(muka);
    const r = 0.02;
    for (const [x, y, lw, lh] of [[0, 0, w, r], [0, b.h, w, r], [-w / 2, b.h / 2, r, b.h], [w / 2, b.h / 2, r, b.h]] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(lw + r, lh + r, 0.04), lis); m.position.set(x, y, 0); g.add(m);
    }
    for (const x of [-w * 0.35, w * 0.35]) g.add(batang(THREE, 0.05, 0.05, lis, x, -0.05, 'kaki', b.h * 0.5));
    return;
  }
  const { R, busur, d } = ukuranBidang(b);
  const t = (busur * Math.PI) / 180, cembung = b.bentukBidang === 'cembung';
  const mulai = cembung ? -t / 2 : Math.PI - t / 2, zPusat = cembung ? d / 2 - R : R - d / 2;
  const seg = Math.max(24, Math.round(busur / 2.5));
  const geo = new THREE.CylinderGeometry(R, R, b.h, seg, 1, true, mulai, t);
  geo.translate(0, b.h / 2, zPusat);
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: warna, roughness: 0.92, metalness: 0, side: THREE.DoubleSide })));
  const busurTitik = (y: number) => {
    const n = Math.max(8, Math.round(busur / 4)), p: T.Vector3[] = [];
    for (let i = 0; i <= n; i++) { const a = mulai + (t * i) / n; p.push(new THREE.Vector3(R * Math.sin(a), y, zPusat + R * Math.cos(a))); }
    return p;
  };
  for (const y of [0, b.h]) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(busurTitik(y), busur >= 360), Math.max(16, Math.round(busur / 3)), 0.02, 6, busur >= 360), lis));
  if (busur >= 360) {
    const tutup = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshStandardMaterial({ color: warna, roughness: 0.9 }));
    tutup.rotation.x = -Math.PI / 2; tutup.position.set(0, b.h, zPusat); g.add(tutup);
  }
  //  Tiang penyangga di belakang permukaan (sisi luar lengkung) bila tidak berdiri di lantai.
  if (busur < 360) {
    for (const f of [0.08, 0.5, 0.92]) {
      const a = mulai + t * f, luar = cembung ? -0.06 : 0.06;
      const x = (R + luar) * Math.sin(a), z = zPusat + (R + luar) * Math.cos(a);
      g.add(batang(THREE, 0.05, 0.05, lis, x, z, 'kaki', b.h * 0.5));
    }
  }
}

/**
 * Badan meruncing ke belakang: penampang persegi membulat di muka (w x h, z = 0) mengecil
 * ke belakang (skala, z = -panjang). Tutup belakang ikut; muka dibiarkan terbuka untuk gril.
 */
function badanRuncing(THREE: typeof T, w: number, h: number, r: number, panjang: number, skala: number, m: T.Material, yBelakang = 0): T.Mesh {
  const titik = persegiBulat(THREE, w, h, r).getPoints(8);
  if (titik.length > 1 && titik[0].distanceTo(titik[titik.length - 1]) < 1e-6) titik.pop();
  const n = titik.length, pos: number[] = [], idx: number[] = [];
  for (const t of titik) pos.push(t.x, t.y, 0);
  for (const t of titik) pos.push(t.x * skala, t.y * skala + yBelakang, -panjang);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, n + i, j, j, n + i, n + j); }
  const pusat = pos.length / 3; pos.push(0, yBelakang, -panjang);
  for (let i = 0; i < n; i++) idx.push(pusat, n + (i + 1) % n, n + i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo, m);
}

/** Muka gril bersudut membulat (ShapeGeometry, UV = meter) menghadap +z. */
function mukaGril(THREE: typeof T, w: number, h: number, r: number, dasar: string, lubang: string, ulang: number) {
  const geo = new THREE.ShapeGeometry(persegiBulat(THREE, w, h, r), 10);
  const t = teksturGril(THREE, dasar, lubang, ulang);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.3 }));
}

/**
 * Speaker dinding 6": kabinet membulat yang meruncing ke belakang, gril logam penuh di muka
 * (bayangan woofer & tweeter di baliknya), bracket putar: pelat dinding + lengan + kenop + tali pengaman.
 */
function speakerDinding6(THREE: typeof T, g: T.Group, b: Benda, warna: number, warnaGril: string) {
  const badan = mat(THREE, warna, { roughness: 0.62, metalness: 0.12 });
  const besi = mat(THREE, 0x1d2025, { metalness: 0.55, roughness: 0.4 });
  const dBadan = Math.max(0.06, b.d - 0.06), zMuka = b.d / 2, r = Math.min(b.w, b.h) * 0.2;
  const yT = b.h / 2;
  const kab = badanRuncing(THREE, b.w, b.h, r, dBadan, 0.72, badan, b.h * 0.04);
  kab.position.set(0, yT, zMuka - 0.006); g.add(kab);
  //  Bibir muka sedikit menonjol + gril.
  const bibir = new THREE.Mesh(new THREE.ShapeGeometry(persegiBulat(THREE, b.w, b.h, r), 10), badan);
  bibir.position.set(0, yT, zMuka - 0.006); g.add(bibir);
  const gril = mukaGril(THREE, b.w - 0.012, b.h - 0.012, r * 0.9, warnaGril, 'rgba(4,4,6,0.9)', 1 / 0.045);
  gril.position.set(0, yT, zMuka); g.add(gril);
  const bayang = mat(THREE, 0x0f1012, { roughness: 0.6, metalness: 0.3 });
  for (const [fy, fr] of [[0.36, 0.36], [0.78, 0.1]] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(b.w * fr, 0.0035, 8, 40), bayang);
    ring.position.set(0, b.h * fy, zMuka + 0.003); g.add(ring);
  }
  //  Bracket putar di punggung: pelat dinding tegak, lengan ke kabinet, kenop engsel, tali pengaman.
  const zDinding = -b.d / 2, zPunggung = zMuka - 0.006 - dBadan, yB = b.h * 0.55;
  g.add(blok(THREE, 0.075, 0.17, 0.014, 0.012, besi, 0.003).translateY(yB - 0.085).translateZ(zDinding + 0.007));
  const panjangLengan = Math.max(0.01, zPunggung - (zDinding + 0.014) + 0.01);
  g.add(kotak(THREE, 0.034, 0.05, panjangLengan, besi, 0, yB, zDinding + 0.014 + panjangLengan / 2));
  for (const sx of [-1, 1]) {
    const kenop = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 14), besi);
    kenop.rotation.z = Math.PI / 2; kenop.position.set(sx * 0.024, yB, zDinding + 0.04); g.add(kenop);
  }
  const tali = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, yB - 0.07, zDinding + 0.016), new THREE.Vector3(0.05, yB - 0.13, zDinding + 0.05),
    new THREE.Vector3(0.03, yB - 0.06, zPunggung + 0.004),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(tali, 20, 0.0016, 6, false), mat(THREE, 0xd1d5db, { metalness: 0.8, roughness: 0.3 })));
}

/**
 * Speaker portable aktif: subwoofer di lantai, tiang, dan kolom ramping di atasnya
 * (tinggi total = b.h, lebar/kedalaman subwoofer = b.w x b.d).
 */
function speakerKolom(THREE: typeof T, g: T.Group, b: Benda, warna: number, warnaGril: string) {
  const badan = mat(THREE, warna, { roughness: 0.6, metalness: 0.12 });
  const besi = mat(THREE, 0x1b1d21, { metalness: 0.65, roughness: 0.35 });
  const hSub = Math.min(0.6, Math.max(0.25, b.h * 0.27));
  const hKol = Math.min(0.85, Math.max(0.3, b.h * 0.36));
  const wKol = Math.min(0.13, Math.max(0.06, b.w * 0.27)), dKol = Math.min(0.14, Math.max(0.07, b.d * 0.28));
  g.add(blok(THREE, b.w, hSub, b.d, 0.02, badan, 0.008));
  const gSub = mukaGril(THREE, b.w * 0.9, hSub * 0.86, 0.012, warnaGril, 'rgba(3,3,5,0.9)', 1 / 0.06);
  gSub.position.set(0, hSub * 0.5, b.d / 2 + 0.002); g.add(gSub);
  g.add(kotak(THREE, 0.05, 0.016, 0.004, mat(THREE, 0xe5e7eb), b.w * 0.36, hSub * 0.12, b.d / 2 + 0.004)); // logo
  //  Cangkir tiang + tiang ke kolom.
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.03, 20), besi).translateY(hSub + 0.015));
  const yKol = b.h - hKol, panjangTiang = Math.max(0.05, yKol - hSub);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, panjangTiang, 16), besi).translateY(hSub + panjangTiang / 2));
  g.add(blok(THREE, wKol, hKol, dKol, wKol * 0.25, badan, 0.004).translateY(yKol));
  const gKol = mukaGril(THREE, wKol * 0.84, hKol * 0.95, wKol * 0.2, warnaGril, 'rgba(3,3,5,0.9)', 1 / 0.04);
  gKol.position.set(0, yKol + hKol / 2, dKol / 2 + 0.002); g.add(gKol);
}

/**
 * Line array: n modul berpenampang trapesium bertumpuk dari atas ke bawah, tiap modul
 * menunduk (kemiringan atas + i x sudut antar modul) pada engsel di tepi depan-atasnya.
 * Pelat rigging & pin di kedua sisi; digantung = bumper di atas + dua tali ke plafon.
 */
function lineArray(THREE: typeof T, g: T.Group, b: Benda, warna: number, warnaGril: string) {
  const badan = mat(THREE, warna, { roughness: 0.66, metalness: 0.1 });
  const plat = mat(THREE, 0x3a3f47, { metalness: 0.75, roughness: 0.35 });
  const n = modulLA(b), hm = b.h / n, W = b.w, D = b.d;
  //  Penampang samping trapesium (belakang lebih pendek supaya bisa menekuk), diekstrusi selebar W.
  const bentuk = new THREE.Shape();
  bentuk.moveTo(0, 0); bentuk.lineTo(0, -hm); bentuk.lineTo(D, -hm * 0.88); bentuk.lineTo(D, -hm * 0.12); bentuk.lineTo(0, 0);
  const geoModul = new THREE.ExtrudeGeometry(bentuk, { depth: W, bevelEnabled: false });
  geoModul.rotateY(Math.PI / 2); geoModul.translate(-W / 2, 0, 0);   // x: -W/2..W/2, z: 0..-D
  let y = b.h, z = D / 2;
  for (let i = 0; i < n; i++) {
    const a = ((tiltLADari(b) + i * sudutModulLA(b)) * Math.PI) / 180;
    const engsel = new THREE.Group(); engsel.position.set(0, y, z); engsel.rotation.x = a;
    engsel.add(new THREE.Mesh(geoModul, badan));
    const gril = mukaGril(THREE, W * 0.9, hm * 0.84, 0.006, warnaGril, 'rgba(2,2,4,0.92)', 1 / 0.08);
    gril.position.set(0, -hm / 2, 0.002); engsel.add(gril);
    for (const sx of [-1, 1]) {
      engsel.add(kotak(THREE, 0.008, hm * 0.8, D * 0.42, plat, sx * (W / 2 + 0.004), -hm / 2, -D * 0.7));
      for (const fy of [0.2, 0.8]) {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 10), plat);
        pin.rotation.z = Math.PI / 2; pin.position.set(sx * (W / 2 + 0.014), -hm * fy, -D * 0.12); engsel.add(pin);
      }
      engsel.add(kotak(THREE, 0.004, hm * 0.28, D * 0.22, mat(THREE, 0x070809), sx * (W / 2 + 0.001), -hm * 0.55, -D * 0.4)); // pegangan
    }
    g.add(engsel);
    y -= hm * Math.cos(a); z -= hm * Math.sin(a);
  }
  if (b.gantung) {
    g.add(kotak(THREE, W * 1.08, 0.04, D * 0.95, plat, 0, b.h + 0.02, 0));                         // bumper / frame
    for (const sx of [-0.35, 0.35]) g.add(batang(THREE, 0.008, 0.008, plat, sx * W, -D * 0.1, 'tiang', 0, true)); // tali ke plafon
  }
}

/** Tekstur pelat besi hitam berlubang oval (bracket videowall), satu ubin = 16 cm, 4 lubang. */
let lubangCache: { h: T.Texture; v: T.Texture } | null = null;
function teksturBerlubang(THREE: typeof T, tegak: boolean, panjang: number): T.Texture {
  if (!lubangCache) {
    const buat = (v: boolean) => {
      const W = v ? 32 : 128, H = v ? 128 : 32;
      const c = kanvas(W, H, g => {
        g.fillStyle = '#1d2025'; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(255,255,255,0.06)'; if (v) g.fillRect(0, 0, 3, H); else g.fillRect(0, 0, W, 3);
        g.fillStyle = '#040506';
        for (let k = 0; k < 4; k++) {
          const t = k * 32 + 16;
          g.beginPath();
          const [rx, ry, rw, rh] = v ? [11, t - 8, 10, 16] : [t - 8, 11, 16, 10];
          if (typeof g.roundRect === 'function') g.roundRect(rx, ry, rw, rh, 5); else g.rect(rx, ry, rw, rh);
          g.fill();
        }
      });
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return t;
    };
    lubangCache = { h: buat(false), v: buat(true) };
  }
  const t = (tegak ? lubangCache.v : lubangCache.h).clone();
  const n = Math.max(1, panjang / 0.16);
  t.repeat.set(tegak ? 1 : n, tegak ? n : 1);
  return t;
}

/** Pelat pipih dari titik a ke b (lebar di sumbu x lokal, tebal di z lokal) - untuk lengan gunting. */
function pelatAntara(THREE: typeof T, a: T.Vector3, b: T.Vector3, lebar: number, tebal: number, m: T.Material) {
  const arah = b.clone().sub(a);
  const o = new THREE.Mesh(new THREE.BoxGeometry(tebal, arah.length(), lebar), m);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arah.normalize());
  return o;
}

/**
 * Bracket pop-out videowall (mengikuti foto referensi owner): rangka dinding = rel atas & bawah
 * berlubang + dua tegak samping; rangka depan (menempel punggung display) = dua tiang tegak
 * berlubang, palang atas & bawah lebar berlubang, palang tengah berpelat, blok pengunci di
 * atas tiang; di kiri & kanan lengan gunting X (dengan baut poros) menghubungkan keduanya;
 * kenop T penyetel di atas palang atas dan di ujung palang bawah. Semua hitam.
 * Celah punggung display ke dinding = CELAH_PASANG.dinding (10 cm).
 */
function bracketPopOut(THREE: typeof T, lebar: number, tinggi: number, x: number, yTengah: number, zPunggung: number): T.Group {
  const g = new THREE.Group();
  const hitam = mat(THREE, 0x1a1d22, { metalness: 0.55, roughness: 0.45 });
  const kenop = mat(THREE, 0x0b0c0f, { roughness: 0.6 });
  const baut = mat(THREE, 0x9ca3af, { metalness: 0.85, roughness: 0.3 });
  const berlubang = (tegak: boolean, panjang: number) =>
    new THREE.MeshStandardMaterial({ map: teksturBerlubang(THREE, tegak, panjang), metalness: 0.55, roughness: 0.45 });
  const zDinding = zPunggung - 0.1;
  const W = Math.max(0.24, Math.min(0.62, lebar * 0.55)), H = Math.max(0.2, Math.min(0.5, tinggi * 0.62));
  const yA = yTengah + H / 2, yB = yTengah - H / 2;
  //  Rangka dinding.
  for (const y of [yA - 0.025, yB + 0.025]) g.add(kotak(THREE, W + 0.06, 0.05, 0.008, berlubang(false, W + 0.06), x, y, zDinding + 0.004));
  for (const sx of [-1, 1]) g.add(kotak(THREE, 0.035, H, 0.012, berlubang(true, H), x + sx * (W / 2 - 0.018), yTengah, zDinding + 0.01));
  //  Rangka depan.
  const xT = W * 0.36, zD = zPunggung - 0.011;
  for (const sx of [-1, 1]) {
    g.add(kotak(THREE, 0.05, H + 0.1, 0.022, berlubang(true, H + 0.1), x + sx * xT, yTengah, zD));
    g.add(kotak(THREE, 0.075, 0.04, 0.034, hitam, x + sx * xT, yA - 0.03, zD - 0.02));          // blok pengunci
  }
  const lebarDepan = W + 0.12;
  g.add(kotak(THREE, lebarDepan, 0.045, 0.01, berlubang(false, lebarDepan), x, yA + 0.025, zPunggung - 0.005));
  g.add(kotak(THREE, lebarDepan, 0.045, 0.01, berlubang(false, lebarDepan), x, yB - 0.025, zPunggung - 0.005));
  g.add(kotak(THREE, xT * 2, 0.05, 0.012, hitam, x, yTengah + H * 0.06, zD - 0.016));                 // palang tengah
  g.add(kotak(THREE, 0.12, 0.085, 0.01, hitam, x, yTengah + H * 0.06, zD - 0.024));                   // pelat tengah
  //  Lengan gunting X kiri & kanan (bidang y-z, di sisi dalam tiang depan).
  for (const sx of [-1, 1]) {
    const xa = x + sx * (xT - 0.04);
    const atasD = new THREE.Vector3(xa, yA - 0.05, zDinding + 0.02), bawahD = new THREE.Vector3(xa, yB + 0.05, zDinding + 0.02);
    const atasP = new THREE.Vector3(xa, yA - 0.05, zD - 0.016), bawahP = new THREE.Vector3(xa, yB + 0.05, zD - 0.016);
    g.add(pelatAntara(THREE, atasD, bawahP, 0.028, 0.008, hitam));
    g.add(pelatAntara(THREE, bawahD, atasP.clone().setX(xa + sx * 0.01), 0.028, 0.008, hitam));
    const poros = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 12), baut);
    poros.rotation.z = Math.PI / 2; poros.position.set(xa + sx * 0.005, yTengah, (zDinding + zD) / 2); g.add(poros);
  }
  //  Kenop T: dua di atas palang atas (tegak), dua di ujung palang bawah (mendatar).
  const kenopT = (px: number, py: number, pz: number, mendatar: number) => {
    const k = new THREE.Group();
    k.add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 10), baut).translateY(0.015));
    k.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 14), kenop).translateY(0.034));
    const gagang = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.014), kenop); gagang.position.y = 0.046; k.add(gagang);
    k.position.set(px, py, pz); if (mendatar) k.rotation.z = -mendatar * Math.PI / 2; g.add(k);
  };
  for (const sx of [-1, 1]) {
    kenopT(x + sx * W * 0.24, yA + 0.047, zPunggung - 0.02, 0);
    kenopT(x + sx * (lebarDepan / 2 - 0.01), yB - 0.025, zPunggung - 0.02, sx);
  }
  return g;
}

/**
 * Wall bracket + struktur hollow (videowall, LED, signage): rangka besi hollow 40×40 di belakang
 * display - tiang tegak tiap ±0,6 m, palang mendatar atas-bawah (+ tengah untuk display tinggi) -
 * diikat ke dinding dengan plat siku berbaut. Mengisi celah punggung display sampai dinding.
 */
function strukturHollow(THREE: typeof T, lebar: number, tinggi: number, zPunggung: number): T.Group {
  const g = new THREE.Group();
  const besi = mat(THREE, 0x3b4048, { metalness: 0.6, roughness: 0.45 });
  const plat = mat(THREE, 0x8b9099, { metalness: 0.75, roughness: 0.35 });
  const baut = mat(THREE, 0xc7cbd1, { metalness: 0.9, roughness: 0.25 });
  const s = 0.04, celah = 0.1;
  const zDinding = zPunggung - celah;
  const zRangka = zDinding + 0.035 + s / 2;
  const nTiang = Math.max(2, Math.ceil(lebar / 0.6) + 1);
  const xs = Array.from({ length: nTiang }, (_, i) => -lebar / 2 + s / 2 + ((lebar - s) * i) / (nTiang - 1));
  const lebih = Math.min(0.08, tinggi * 0.05);
  for (const x of xs) g.add(kotak(THREE, s, tinggi + lebih * 2, s, besi, x, tinggi / 2, zRangka));
  const nPalang = tinggi > 1.4 ? Math.ceil(tinggi / 0.7) + 1 : 2;
  for (let i = 0; i < nPalang; i++) {
    const y = 0.06 + ((tinggi - 0.12) * i) / (nPalang - 1);
    g.add(kotak(THREE, lebar + 0.04, s, s, besi, 0, y, zRangka + s));   // palang di depan tiang, menempel punggung display
  }
  //  Plat siku ke dinding (atas & bawah tiap tiang) dengan dua baut.
  for (const x of xs) for (const y of [tinggi + lebih - 0.05, -lebih + 0.05]) {
    g.add(kotak(THREE, 0.09, 0.07, 0.006, plat, x, y, zDinding + 0.003));
    g.add(kotak(THREE, 0.006, 0.07, 0.035, plat, x - s / 2 - 0.003, y, zDinding + 0.02));
    for (const dx of [-0.028, 0.028]) {
      const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.008, 10), baut);
      bt.rotation.x = Math.PI / 2; bt.position.set(x + dx, y, zDinding + 0.008); g.add(bt);
    }
  }
  return g;
}

/**
 * Standfloor portable beroda (mengikuti foto referensi owner): DUA tiang bulat abu-abu di kiri &
 * kanan yang turun sampai ±60 cm dari lantai, lalu masing-masing terbelah menjadi kaki "A" (satu
 * ke depan, satu ke belakang) berujung roda kastor; baki/rak abu-abu di ketinggian percabangan;
 * dudukan display hitam = rel atas & bawah dengan dua batang tegak di antaranya, menempel punggung
 * display. Tidak ada tiang tengah - display lebar tetap dua tiang.
 */
export function standfloor(THREE: typeof T, g: T.Group, b: Benda, tinggiTiang: number) {
  const abu = mat(THREE, 0x5f646b, { metalness: 0.55, roughness: 0.4 });
  const hitam = mat(THREE, 0x15171a, { metalness: 0.45, roughness: 0.45 });
  const karet = mat(THREE, 0x0b0c0e, { roughness: 0.8 });
  const xT = Math.max(0.28, Math.min(b.w / 2 - 0.08, Math.max(0.36, b.w * 0.36)));
  const zT = -b.d / 2 - 0.035, jari = 0.026;
  const CABANG = 0.6;   // tinggi percabangan kaki dari lantai (m)
  //  Tiang tegak: dari percabangan (lantai + 60 cm) sampai atas dudukan, ikut ketinggian display.
  for (const sx of [-1, 1]) {
    const t = batang(THREE, jari * 2, jari * 2, abu, sx * xT, zT, 'kaki', tinggiTiang, true);
    t.userData.bawah = CABANG; g.add(t);
    const tutup = new THREE.Mesh(new THREE.CylinderGeometry(jari, jari, 0.012, 14), abu);
    tutup.position.set(sx * xT, tinggiTiang + 0.006, zT); g.add(tutup);
  }
  //  Dudukan display: rel atas & bawah + dua batang tegak, menempel punggung display.
  const yAtas = Math.min(tinggiTiang - 0.03, b.h * 0.74), yBawah = Math.max(0.1, b.h * 0.42);
  const zRel = -b.d / 2 - 0.012, lebarRel = xT * 2 + jari * 2;
  for (const y of [yAtas, yBawah]) g.add(kotak(THREE, lebarRel, 0.06, 0.022, hitam, 0, y, zRel));
  for (const fx of [-1 / 3, 1 / 3]) g.add(kotak(THREE, 0.05, yAtas - yBawah, 0.02, hitam, fx * xT * 1.15, (yAtas + yBawah) / 2, zRel));
  //  Bagian lantai (tinggi absolut): kaki A, roda, dan baki di percabangan.
  const alas = new THREE.Group();
  for (const sx of [-1, 1]) {
    const x = sx * xT;
    const pangkal = new THREE.Vector3(x, CABANG, zT);
    for (const dz of [0.4, -0.36]) {
      const lutut = new THREE.Vector3(x + sx * 0.025, 0.14, zT + dz * 0.9);
      const ujung = new THREE.Vector3(x + sx * 0.03, 0.085, zT + dz);
      alas.add(tiangAntara(THREE, pangkal, lutut, jari * 0.9, abu, jari * 0.85));
      alas.add(tiangAntara(THREE, lutut, ujung, jari * 0.85, abu));
      const sendi = new THREE.Mesh(new THREE.SphereGeometry(jari * 0.86, 12, 8), abu); sendi.position.copy(lutut); alas.add(sendi);
      const rumah = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.03, 12), hitam);
      rumah.position.set(ujung.x, 0.07, ujung.z); alas.add(rumah);
      const roda = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.026, 18), karet);
      roda.rotation.z = Math.PI / 2; roda.position.set(ujung.x, 0.035, ujung.z); alas.add(roda);
    }
    const bonggol = new THREE.Mesh(new THREE.SphereGeometry(jari * 1.1, 14, 10), abu); bonggol.position.copy(pangkal); alas.add(bonggol);
  }
  //  Baki di percabangan: menjorok ke depan (untuk kamera / laptop), bibir depan menekuk turun.
  const kedalaman = 0.34, zBaki = zT + kedalaman / 2 - 0.03;
  alas.add(kotak(THREE, xT * 2 + 0.02, 0.014, kedalaman, abu, 0, CABANG + 0.01, zBaki));
  alas.add(kotak(THREE, xT * 2 + 0.02, 0.03, 0.012, abu, 0, CABANG - 0.005, zBaki + kedalaman / 2));
  g.add(diLantai(alas));
}

/** Pemasangan display sesuai pilihan: bracket pop-up per sel (kol × bar), struktur hollow, atau standfloor. */
function pasangDisplay(THREE: typeof T, g: T.Group, b: Benda, kol: number, bar: number, faktorTiang: number) {
  const ps = pasangDari(b);
  if (ps === 'standfloor') { standfloor(THREE, g, b, b.h * faktorTiang); return; }
  if (ps === 'hollow') { g.add(strukturHollow(THREE, b.w, b.h, -b.d / 2)); return; }
  const pw = b.w / kol, ph = b.h / bar;
  for (let i = 0; i < kol; i++) for (let j = 0; j < bar; j++) {
    g.add(bracketPopOut(THREE, pw, ph, -b.w / 2 + pw * (i + 0.5), ph * (j + 0.5), -b.d / 2));
  }
}

/**
 * Model satu benda. Titik asal = tengah tapak, alas di y = 0; sumbu +z = arah
 * hadap. Semua mesh memberi & menerima bayangan.
 */
export function buatModel(b: Benda, bahan: Bahan): T.Group {
  const { THREE } = bahan;
  const g = new THREE.Group();
  const muka = (w: number, h: number, z: number, y: number) => {
    const tex = bahan.layar(b);
    const m = tex
      ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.25, metalness: 0.4 });
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(0, y, z); return o;
  };
  //  Warna utama pilihan engineer (badan/bezel/rangka/kain/permukaan); tanpa pilihan = warna bawaan model.
  const warnaB = warnaSah(b.warna);
  const W = (bawaan: number) => (warnaB ? new THREE.Color(warnaB).getHex() : bawaan);
  const WS = (bawaan: string) => warnaB ?? bawaan;

  switch (b.jenis) {
    case 'videowall': {
      const kol = b.kol ?? 2, bar = b.bar ?? 2;
      const spek = spekVideowall(b);
      g.add(kotak(THREE, b.w, b.h, b.d, mat(THREE, W(0x0a0a0a), { roughness: 0.35, metalness: 0.5 }), 0, b.h / 2, 0));
      g.add(muka(b.w, b.h, b.d / 2 + 0.001, b.h / 2));
      //  Bezel 3,5 mm sisi ke sisi: tebal garis proporsional terhadap lebar tekstur 1024 px.
      const tebal = Math.max(2, (spek.bezelMm / 1000) * (1024 / b.w));
      const grid = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h),
        new THREE.MeshBasicMaterial({ map: teksturGrid(THREE, kol, bar, tebal, 'rgba(8,8,8,0.95)'), transparent: true, toneMapped: false }));
      grid.position.set(0, b.h / 2, b.d / 2 + 0.002); g.add(grid);
      pasangDisplay(THREE, g, b, kol, bar, 0.8);
      break;
    }
    case 'tv': case 'ifp': {
      const ifp = b.jenis === 'ifp';
      const bezel = mat(THREE, W(ifp ? 0x1f2937 : 0x111111), { roughness: 0.35, metalness: 0.5 });
      g.add(kotak(THREE, b.w, b.h, b.d, bezel, 0, b.h / 2, 0));
      const tepi = ifp ? 0.03 : 0.012;
      g.add(muka(b.w - tepi * 2, b.h - tepi * 2, b.d / 2 + 0.001, b.h / 2));
      if (ifp) {
        g.add(kotak(THREE, b.w * 0.25, 0.012, 0.03, mat(THREE, 0x9ca3af, { metalness: 0.6 }), 0, -0.006, b.d / 2 - 0.01)); // baki pena
        g.add(kotak(THREE, 0.12, 0.012, 0.012, mat(THREE, 0xe5e7eb), -b.w * 0.06, 0.006, b.d / 2));
      }
      pasangDisplay(THREE, g, b, 1, 1, 0.78);
      break;
    }
    case 'led': {
      const rangka = mat(THREE, W(0x1f2937), { metalness: 0.6, roughness: 0.4 });
      g.add(kotak(THREE, b.w, b.h, b.d, rangka, 0, b.h / 2, 0));
      g.add(muka(b.w, b.h, b.d / 2 + 0.001, b.h / 2));
      const kol = Math.max(1, Math.round((b.w * 1000) / (b.cabW ?? 500)));
      const bar = Math.max(1, Math.round((b.h * 1000) / (b.cabH ?? 500)));
      const grid = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h),
        new THREE.MeshBasicMaterial({ map: teksturGrid(THREE, kol, bar), transparent: true, toneMapped: false }));
      grid.position.set(0, b.h / 2, b.d / 2 + 0.002); g.add(grid);
      //  Bracket pop-up per ±1 m (cabinet LED berat), struktur hollow, atau standfloor beroda.
      pasangDisplay(THREE, g, b, Math.max(1, Math.round(b.w)), Math.max(1, Math.round(b.h)), 0.8);
      break;
    }
    case 'layar': {
      g.add(kotak(THREE, b.w + 0.12, b.h + 0.12, b.d, mat(THREE, W(0x111827)), 0, b.h / 2, 0));
      const tex = bahan.layar(b);
      const m = tex ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : mat(THREE, 0xf8fafc, { roughness: 0.9 });
      const kain = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), m);
      kain.position.set(0, b.h / 2, b.d / 2 + 0.001); g.add(kain);
      g.add(kotak(THREE, b.w + 0.3, 0.12, 0.14, mat(THREE, 0xe5e7eb), 0, b.h + 0.12, 0)); // casing gulung
      break;
    }
    case 'meja': {
      const bentuk = b.bentukMeja ?? 'rapat';
      const fin: Finish = b.finish ?? (bentuk === 'kelas' ? 'oak' : 'walnut');
      const panjangZ = b.d >= b.w;
      const atas = new THREE.MeshPhysicalMaterial({
        //  Warna custom = laminasi polos: tekstur 'putih' (nyaris rata) dikalikan warna pilihan.
        map: teksturKayu(THREE, warnaB ? 'putih' : fin, panjangZ), color: warnaB ? new THREE.Color(warnaB) : 0xffffff,
        roughness: fin === 'putih' || warnaB ? 0.5 : 0.42,
        clearcoat: fin === 'putih' || warnaB ? 0.15 : 0.55, clearcoatRoughness: 0.3,
      });
      const logam = mat(THREE, 0x2a2e35, { metalness: 0.75, roughness: 0.3 });
      if (bentuk === 'bulat') {
        //  Bundar/oval (w x d) dengan kaki tunggal: piring alas melebar,
        //  tiang ramping, dudukan atas - satu profil putar (LatheGeometry).
        const tebal = 0.04, bv = 0.008;
        const s = new THREE.Shape(); s.absellipse(0, 0, b.w / 2 - bv, b.d / 2 - bv, 0, Math.PI * 2, false, 0);
        g.add(lempeng(THREE, s, tebal, bv, atas, 64).translateY(b.h - tebal));
        const r0 = Math.min(b.w, b.d) * 0.3, yAtas = b.h - tebal, rAtas = Math.min(0.2, r0 * 0.8);
        const profil: [number, number][] = [[0.001, 0], [r0, 0], [r0, 0.012], [r0 * 0.6, 0.03], [0.07, 0.075], [0.042, 0.15],
          [0.038, yAtas - 0.14], [0.06, yAtas - 0.06], [rAtas, yAtas - 0.02], [rAtas, yAtas], [0.001, yAtas]];
        g.add(new THREE.Mesh(new THREE.LatheGeometry(profil.map(([x, y]) => new THREE.Vector2(x, y)), 48), logam));
      } else if (bentuk === 'kelas') {
        //  Meja siswa: papan laminasi, rangka pipa ditekuk di kedua sisi,
        //  panel penutup di depan (menghadap papan tulis) & rak buku.
        const tebal = 0.025;
        g.add(papan(THREE, b.w, b.d, tebal, 0.035, atas, 0.005).translateY(b.h - tebal));
        const rangka = mat(THREE, 0x3f454f, { metalness: 0.7, roughness: 0.35 });
        for (const sx of [-1, 1]) {
          const x = sx * (b.w / 2 - 0.06);
          g.add(pipa(THREE, [[x, 0.014, -b.d / 2 + 0.05], [x, 0.014, b.d / 2 - 0.05], [x, b.h - tebal - 0.012, b.d / 2 - 0.07], [x, b.h - tebal - 0.012, -b.d / 2 + 0.07]], 0.013, 0.06, rangka, true));
        }
        g.add(blok(THREE, b.w - 0.16, 0.28, 0.012, 0.01, mat(THREE, 0xcbd5e1, { roughness: 0.6 }), 0.003).translateY(b.h - tebal - 0.3).translateZ(-b.d / 2 + 0.06));
        g.add(papan(THREE, b.w - 0.16, b.d * 0.62, 0.012, 0.01, mat(THREE, 0x94a3b8, { roughness: 0.6 }), 0.003).translateY(b.h - 0.15).translateZ(-b.d * 0.12));
      } else if (bentuk === 'dosen') {
        //  Meja dosen: daun meja kayu, panel depan (menghadap mahasiswa) & panel samping, laci di kanan.
        const tebal = 0.03, panel = mat(THREE, warnaB ? 0xe5e7eb : 0xd6d9de, { roughness: 0.55 });
        g.add(papan(THREE, b.w, b.d, tebal, 0.02, atas, 0.004).translateY(b.h - tebal));
        g.add(kotak(THREE, b.w - 0.04, b.h - tebal - 0.06, 0.02, panel, 0, (b.h - tebal) / 2 + 0.03, b.d / 2 - 0.05));
        for (const sx of [-1, 1]) g.add(kotak(THREE, 0.03, b.h - tebal, b.d - 0.04, panel, sx * (b.w / 2 - 0.015), (b.h - tebal) / 2, 0));
        const laci = Math.min(0.42, b.w * 0.28);
        g.add(kotak(THREE, laci, b.h - tebal - 0.1, b.d - 0.12, panel, b.w / 2 - 0.03 - laci / 2, (b.h - tebal) / 2 + 0.03, -0.02));
        for (let i = 0; i < 3; i++) g.add(kotak(THREE, laci * 0.4, 0.012, 0.012, logam, b.w / 2 - 0.03 - laci / 2, 0.16 + i * 0.2, -b.d / 2 + 0.04));
      } else if (bentuk === 'podium') {
        //  Podium / mimbar: alas, badan meruncing, bidang baca miring ke arah pembicara (-z), panel logo & mic gooseneck.
        const kayu = new THREE.MeshPhysicalMaterial({ map: teksturKayu(THREE, warnaB ? 'putih' : fin, false), color: warnaB ? new THREE.Color(warnaB) : 0xffffff, roughness: 0.45, clearcoat: 0.4 });
        const tAlas = 0.06, tBaca = b.h - 0.06;
        g.add(papan(THREE, b.w, b.d, tAlas, 0.02, logam, 0.006));
        g.add(blok(THREE, b.w * 0.86, tBaca - tAlas, b.d * 0.82, 0.04, kayu, 0.008).translateY(tAlas));
        g.add(blok(THREE, b.w * 0.6, (tBaca - tAlas) * 0.35, 0.006, 0.01, mat(THREE, 0xe7e5e4, { roughness: 0.4 }), 0.002).translateY(tAlas + (tBaca - tAlas) * 0.45).translateZ(b.d * 0.41 + 0.004));
        const baca = papan(THREE, b.w, b.d * 0.9, 0.035, 0.02, kayu, 0.006);
        baca.position.set(0, tBaca, 0); baca.rotation.x = -0.22; g.add(baca);
        const hitamMic = mat(THREE, 0x111827, { metalness: 0.5, roughness: 0.4 });
        const kurva = new THREE.CatmullRomCurve3([
          new THREE.Vector3(b.w * 0.3, tBaca + 0.03, b.d * 0.3), new THREE.Vector3(b.w * 0.3, tBaca + 0.2, b.d * 0.22), new THREE.Vector3(b.w * 0.26, tBaca + 0.33, b.d * 0.02),
        ]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(kurva, 20, 0.005, 8, false), hitamMic));
        const kepala = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), hitamMic);
        kepala.scale.set(1, 1.5, 1); kepala.position.set(b.w * 0.25, tBaca + 0.35, -b.d * 0.02); g.add(kepala);
      } else if (bentuk === 'kredensa') {
        //  Kredensa: badan lemari gelap, pintu berpanel dengan handle, plint tersembunyi, daun atas.
        const badan = mat(THREE, W(0x1d2026), { roughness: 0.5 });
        const pegangan = mat(THREE, 0x9ca3af, { metalness: 0.9, roughness: 0.25 });
        const tebal = 0.025, plint = 0.06;
        g.add(papan(THREE, b.w, b.d, tebal, 0.01, warnaB ? badan : atas, 0.003).translateY(b.h - tebal));
        g.add(kotak(THREE, b.w - 0.08, plint, b.d - 0.08, mat(THREE, 0x0b0c0f), 0, plint / 2, -0.01));
        g.add(kotak(THREE, b.w, b.h - tebal - plint, b.d - 0.02, badan, 0, plint + (b.h - tebal - plint) / 2, -0.01));
        const nPintu = Math.max(2, Math.round(b.w / 0.6)), lebarPintu = (b.w - 0.02) / nPintu;
        for (let i = 0; i < nPintu; i++) {
          const x = -b.w / 2 + 0.01 + lebarPintu * (i + 0.5);
          g.add(blok(THREE, lebarPintu - 0.006, b.h - tebal - plint - 0.012, 0.018, 0.004, badan, 0.002).translateX(x).translateY(plint + 0.006).translateZ(b.d / 2 - 0.02));
          const sisi = i % 2 === 0 ? 1 : -1;
          g.add(kotak(THREE, 0.012, Math.min(0.22, (b.h - plint) * 0.35), 0.02, pegangan, x + sisi * (lebarPintu / 2 - 0.04), plint + (b.h - tebal - plint) * 0.62, b.d / 2 + 0.002));
        }
      } else if (bentuk === 'operator') {
        //  Meja operator control room: daun hitam, panel kaki putih (ujung & tengah), panel penutup
        //  di sisi depan (-z, ke arah videowall), monitor berderet di lengan, keyboard per 2 monitor.
        const daun = mat(THREE, W(0x15171b), { roughness: 0.4 });
        const panel = mat(THREE, 0xe5e7eb, { roughness: 0.5 });
        const tebal = 0.03;
        g.add(papan(THREE, b.w, b.d, tebal, 0.015, daun, 0.004).translateY(b.h - tebal));
        const nKaki = Math.max(2, Math.ceil(b.w / 1.8) + 1);
        for (let i = 0; i < nKaki; i++) g.add(kotak(THREE, 0.04, b.h - tebal, b.d - 0.06, panel, -b.w / 2 + 0.03 + (i * (b.w - 0.06)) / (nKaki - 1), (b.h - tebal) / 2, 0));
        g.add(kotak(THREE, b.w - 0.1, (b.h - tebal) * 0.55, 0.02, panel, 0, (b.h - tebal) * 0.6, -b.d / 2 + 0.05));
        const n = Math.max(0, Math.min(12, Math.round(b.monitorMeja ?? 4)));
        const hitam = mat(THREE, 0x0f1115, { roughness: 0.35, metalness: 0.3 });
        const ruas = (b.w - 0.1) / Math.max(1, n), lebarMon = Math.min(0.55, ruas - 0.02), tinggiMon = lebarMon * 0.6;
        const layarA = teksturMonitor(THREE, false, n * 3 + 1), layarB = teksturMonitor(THREE, true, n * 5 + 2);
        for (let i = 0; i < n; i++) {
          const mon = new THREE.Group();
          mon.add(kotak(THREE, 0.2, 0.01, 0.16, hitam, 0, 0.005, 0));
          mon.add(kotak(THREE, 0.03, 0.14, 0.02, hitam, 0, 0.08, -0.04));
          const badanMon = blok(THREE, lebarMon, tinggiMon, 0.02, 0.006, hitam, 0.002);
          badanMon.position.set(0, 0.12, -0.03); mon.add(badanMon);
          const kaca = new THREE.Mesh(new THREE.PlaneGeometry(lebarMon * 0.96, tinggiMon * 0.92), new THREE.MeshBasicMaterial({ map: i % 2 ? layarB : layarA, toneMapped: false }));
          kaca.position.set(0, 0.12 + tinggiMon / 2, -0.019); mon.add(kaca);
          mon.position.set(-b.w / 2 + 0.05 + ruas * (i + 0.5), b.h, -b.d / 2 + 0.2);
          mon.rotation.y = ((i + 0.5) / n - 0.5) * -0.3;
          g.add(mon);
        }
        const nKey = Math.max(1, Math.round(n / 2));
        for (let i = 0; i < nKey; i++) {
          const x = -b.w / 2 + (b.w / nKey) * (i + 0.5);
          g.add(kotak(THREE, 0.44, 0.018, 0.14, mat(THREE, 0x2b3038, { roughness: 0.6 }), x - 0.04, b.h + 0.009, b.d / 2 - 0.25));
          g.add(kotak(THREE, 0.06, 0.02, 0.1, mat(THREE, 0x2b3038, { roughness: 0.6 }), x + 0.27, b.h + 0.01, b.d / 2 - 0.25));
        }
      } else {
        //  Meja rapat: papan sudut membulat bertepi bevel + dua kaki panel,
        //  balok penghubung, dan kotak kabel rata permukaan.
        const tebal = 0.045;
        g.add(papan(THREE, b.w, b.d, tebal, Math.min(0.3, Math.min(b.w, b.d) * 0.3), atas, 0.008).translateY(b.h - tebal));
        const panjang = Math.max(b.w, b.d), lebar = Math.min(b.w, b.d);
        const jarakKaki = Math.max(0.15, panjang / 2 - Math.min(0.45, panjang * 0.16));
        const tinggiKaki = b.h - tebal;
        for (const sisi of [-1, 1]) {
          const kaki = blok(THREE, lebar * 0.62, tinggiKaki, 0.055, 0.02, logam, 0.006);
          if (panjangZ) kaki.position.z = sisi * jarakKaki;
          else { kaki.rotation.y = Math.PI / 2; kaki.position.x = sisi * jarakKaki; }
          g.add(kaki);
        }
        g.add(panjangZ
          ? kotak(THREE, 0.08, 0.05, jarakKaki * 2, logam, 0, tinggiKaki - 0.08, 0)
          : kotak(THREE, jarakKaki * 2, 0.05, 0.08, logam, 0, tinggiKaki - 0.08, 0));
        const kabel = papan(THREE, 0.26, 0.12, 0.006, 0.02, mat(THREE, 0xb8bec7, { metalness: 0.85, roughness: 0.25 }), 0.002);
        if (panjangZ) kabel.rotation.y = Math.PI / 2;
        g.add(kabel.translateY(b.h));
      }
      break;
    }
    case 'kursi': {
      const krom = mat(THREE, 0xc9ced6, { metalness: 0.95, roughness: 0.18 });
      if ((b.tipeKursi ?? 'kantor') === 'kelas') {
        const cangkang = mat(THREE, W(0x334155), { roughness: 0.5 });
        const yDuduk = 0.45;
        g.add(papan(THREE, b.w * 0.92, b.d * 0.82, 0.03, 0.06, cangkang, 0.01).translateY(yDuduk - 0.03));
        const s = sandaran(THREE, b.w * 0.9, 0.28, 0.022, 0.55, cangkang);
        s.position.set(0, yDuduk + 0.09, -b.d * 0.38); s.rotation.x = -0.12; g.add(s);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          g.add(tiangAntara(THREE, new THREE.Vector3(sx * (b.w / 2 - 0.02), 0, sz * (b.d / 2 - 0.03)),
            new THREE.Vector3(sx * (b.w / 2 - 0.07), yDuduk - 0.03, sz * (b.d / 2 - 0.1)), 0.011, krom));
        }
        for (const sx of [-1, 1]) {
          g.add(tiangAntara(THREE, new THREE.Vector3(sx * (b.w / 2 - 0.07), yDuduk - 0.03, -b.d / 2 + 0.1),
            new THREE.Vector3(sx * b.w * 0.3, yDuduk + 0.13, -b.d * 0.39), 0.009, krom));
        }
        break;
      }
      const kain = new THREE.MeshStandardMaterial({ map: teksturKain(THREE, WS('#30353d'), 0.12), roughness: 0.95 });
      const plastik = mat(THREE, 0x1b1e23, { roughness: 0.5 });
      const yDuduk = 0.48;
      //  Kaki bintang lima beroda + tabung gas.
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 10;
        const ujung = new THREE.Vector3(Math.cos(a) * 0.3, 0.058, Math.sin(a) * 0.3);
        g.add(tiangAntara(THREE, new THREE.Vector3(0, 0.085, 0), ujung, 0.02, krom, 0.013));
        const roda = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), plastik);
        roda.position.set(ujung.x, 0.026, ujung.z); g.add(roda);
      }
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 20), krom).translateY(0.085));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 16), plastik).translateY(0.18));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 16), krom).translateY(0.32));
      g.add(kotak(THREE, 0.22, 0.045, 0.24, plastik, 0, yDuduk - 0.06, 0));
      //  Dudukan empuk (bevel besar = tepi bantalan) & sandaran melengkung.
      g.add(papan(THREE, b.w * 0.9, b.d * 0.86, 0.085, 0.1, kain, 0.03).translateY(yDuduk - 0.04));
      //  Sandaran: bantalan kain bersudut membulat (bevel besar = empuk) yang
      //  dilengkungkan memeluk punggung, cangkang plastik di belakangnya.
      const tinggiS = Math.max(0.3, b.h - yDuduk - 0.1);
      const grupS = new THREE.Group();
      const bantal = blok(THREE, b.w * 0.84, tinggiS, 0.06, 0.11, kain, 0.022);
      lengkungkan(bantal.geometry, 0.5); grupS.add(bantal);
      const cangkang = blok(THREE, b.w * 0.8, tinggiS * 0.96, 0.016, 0.1, plastik, 0.005);
      lengkungkan(cangkang.geometry, 0.5); cangkang.position.set(0, tinggiS * 0.02, -0.036); grupS.add(cangkang);
      grupS.position.set(0, yDuduk + 0.1, -b.d * 0.4); grupS.rotation.x = -0.14; g.add(grupS);
      g.add(blok(THREE, 0.07, 0.26, 0.025, 0.02, plastik).translateY(yDuduk - 0.02).translateZ(-b.d * 0.43));
      for (const sx of [-1, 1]) {
        const x = sx * (b.w / 2 - 0.035);
        g.add(pipa(THREE, [[x, yDuduk, -0.12], [x, yDuduk + 0.2, -0.1], [x, yDuduk + 0.2, 0.1]], 0.011, 0.04, plastik));
        g.add(papan(THREE, 0.06, 0.24, 0.022, 0.025, plastik, 0.008).translateX(x).translateY(yDuduk + 0.205).translateZ(0.0));
      }
      break;
    }
    case 'speaker': {
      const tipe = tipeSpeakerDari(b);
      if (tipe === 'dinding6') { speakerDinding6(THREE, g, b, W(0x17191d), WS('#26292e')); break; }
      if (tipe === 'kolom') { speakerKolom(THREE, g, b, W(0x16181b), WS('#2a2d33')); break; }
      if (tipe === 'linearray') { lineArray(THREE, g, b, W(0x141619), WS('#25282d')); break; }
      const badan = mat(THREE, W(0x16181c), { roughness: 0.55, metalness: 0.15 });
      const gril = new THREE.MeshStandardMaterial({ map: teksturGril(THREE, WS('#3a3e45'), 'rgba(5,5,8,0.85)', 1 / 0.05), roughness: 0.65, metalness: 0.35 });
      const besi = mat(THREE, 0x22252a, { metalness: 0.6, roughness: 0.4 });
      const dBadan = b.d * 0.82, belakangBadan = b.d / 2 - dBadan;
      g.add(blok(THREE, b.w, b.h, dBadan, b.w * 0.16, badan, 0.012).translateZ(b.d / 2 - dBadan / 2));
      g.add(blok(THREE, b.w * 0.9, b.h * 0.93, 0.008, b.w * 0.13, gril, 0.003).translateY(b.h * 0.035).translateZ(b.d / 2 + 0.002));
      //  Bayangan woofer & tweeter di balik gril (seperti foto produk).
      const bayang = mat(THREE, 0x1c1e22, { roughness: 0.6, metalness: 0.3 });
      for (const [fy, fr] of [[0.34, 0.33], [0.78, 0.11]] as const) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(b.w * fr, 0.003, 8, 40), bayang);
        ring.position.set(0, b.h * fy, b.d / 2 + 0.0065); g.add(ring);
      }
      //  Bracket: pelat dinding di sisi belakang + lengan ke punggung kabinet.
      g.add(blok(THREE, 0.07, 0.11, 0.012, 0.012, besi).translateY(b.h / 2 - 0.055).translateZ(-b.d / 2 + 0.006));
      const panjangLengan = Math.max(0.01, belakangBadan - (-b.d / 2 + 0.012));
      g.add(kotak(THREE, 0.028, 0.028, panjangLengan, besi, 0, b.h / 2, -b.d / 2 + 0.012 + panjangLengan / 2));
      break;
    }
    case 'lampu': {
      //  Lampu plafon: rumah lampu + permukaan menyala (emisif, ikut dimmer) + kolam cahaya di lantai.
      const tipe = b.tipeLampu ?? 'downlight', warnaC = warnaKelvin(b.kelvin);
      const nyala = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: warnaC, emissiveIntensity: 1.6, roughness: 0.4 });
      nyala.userData.dasar = 1.6;
      const rumah = mat(THREE, W(tipe === 'linear' ? 0x2b2f36 : 0xf4f5f7), { metalness: tipe === 'linear' ? 0.6 : 0.2, roughness: 0.4 });
      const tandai = (m: T.Mesh) => { m.userData.cahaya = true; return m; };
      if (tipe === 'downlight' || tipe === 'spot') {
        const rr = b.w / 2;
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.012, 32), rumah).translateY(b.h - 0.006));
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.78, rr * 0.7, b.h - 0.012, 32), mat(THREE, tipe === 'spot' ? 0x111318 : 0xe5e7eb, { roughness: 0.5 })).translateY((b.h - 0.012) / 2));
        const muka = tandai(new THREE.Mesh(new THREE.CircleGeometry(rr * (tipe === 'spot' ? 0.4 : 0.66), 32), nyala));
        muka.rotation.x = Math.PI / 2; muka.position.y = 0.002; g.add(muka);
      } else if (tipe === 'panel') {
        g.add(kotak(THREE, b.w, b.h, b.d, rumah, 0, b.h / 2, 0));
        const muka = tandai(new THREE.Mesh(new THREE.PlaneGeometry(b.w - 0.03, b.d - 0.03), nyala));
        muka.rotation.x = Math.PI / 2; muka.position.y = -0.001; g.add(muka);
      } else if (tipe === 'gantung') {
        //  Pendant dekoratif: kap kubah logam gelap (dalam keemasan), bohlam menyala, kabel ke plafon.
        const kap = mat(THREE, W(0x1f2328), { metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide });
        const dalam = mat(THREE, 0xd4a35a, { metalness: 0.8, roughness: 0.3, side: THREE.BackSide });
        const rr = b.w / 2, profil: [number, number][] = [];
        for (let i = 0; i <= 16; i++) { const a = (i / 16) * (Math.PI / 2); profil.push([Math.max(0.012, rr * Math.sin(a)), b.h * Math.cos(a) * 0.85 + 0.03]); }
        const bentuk = profil.map(([x, y]) => new THREE.Vector2(x, y));
        g.add(new THREE.Mesh(new THREE.LatheGeometry(bentuk, 40), kap));
        g.add(new THREE.Mesh(new THREE.LatheGeometry(bentuk, 40), dalam));
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.05, 16), kap).translateY(b.h * 0.85 + 0.05));
        const bohlam = tandai(new THREE.Mesh(new THREE.SphereGeometry(rr * 0.22, 20, 12), nyala));
        bohlam.position.y = 0.06; g.add(bohlam);
        g.add(batang(THREE, 0.006, 0.006, mat(THREE, 0x111111), 0, 0, 'tiang', 0, true));
      } else {
        g.add(kotak(THREE, b.w, b.h, b.d, rumah, 0, b.h / 2, 0));
        const muka = tandai(new THREE.Mesh(new THREE.PlaneGeometry(b.w - 0.02, b.d * 0.6), nyala));
        muka.rotation.x = Math.PI / 2; muka.position.y = -0.001; g.add(muka);
        const kawat = mat(THREE, 0x9ca3af, { metalness: 0.9, roughness: 0.3 });
        for (const sx of [-1, 1]) g.add(batang(THREE, 0.004, 0.004, kawat, sx * (b.w / 2 - 0.1), 0, 'tiang', 0, true));
      }
      //  Kolam cahaya di lantai (aditif, tidak menghalangi sinar proyektor).
      const jari = Math.max(0.3, Math.min(3, b.elev * Math.tan((sudutLampuDari(b) / 2) * (Math.PI / 180))));
      const kolamTex = teksturKolamCahaya(THREE);
      const kolam = new THREE.Mesh(new THREE.PlaneGeometry(jari * 2 + (tipe === 'linear' ? b.w : 0), jari * 2),
        new THREE.MeshBasicMaterial({ map: kolamTex, color: warnaC, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
      kolam.rotation.x = -Math.PI / 2; kolam.position.y = 0.006;
      kolam.userData.cahaya = true; (kolam.material as T.MeshBasicMaterial).userData.dasar = 0.16;
      const lantai = new THREE.Group(); lantai.userData.peran = 'lantai'; lantai.add(kolam); g.add(lantai);
      break;
    }
    case 'speaker-plafon': {
      const putih = mat(THREE, W(0xf4f5f7), { roughness: 0.45 });
      const gril = new THREE.MeshStandardMaterial({ map: teksturGril(THREE, WS('#eef0f3'), 'rgba(70,75,85,0.55)', b.w / 0.048), roughness: 0.6 });
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(b.w / 2 - 0.01, b.w / 2 - 0.01, Math.max(0.01, b.h - 0.012), 32), mat(THREE, 0x1f2125)).translateY(0.012 + (b.h - 0.012) / 2));
      const cincin = new THREE.Mesh(new THREE.TorusGeometry(b.w / 2 + 0.006, 0.008, 10, 48), putih);
      cincin.rotation.x = Math.PI / 2; cincin.position.y = 0.008; g.add(cincin);
      const muka = new THREE.Mesh(new THREE.CircleGeometry(b.w / 2, 48), gril);
      muka.rotation.x = Math.PI / 2; muka.position.y = 0.004; g.add(muka);
      break;
    }
    case 'kamera': {
      const tipe = b.tipeKamera ?? 'ptz';
      const kaca = new THREE.MeshPhysicalMaterial({ color: 0x0c1730, metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 });
      const hitamKilap = mat(THREE, 0x0a0b0d, { roughness: 0.18, metalness: 0.35 });
      /** Lensa: cincin hitam mengilap + kubah kaca, menghadap +z. */
      const lensa = (r: number, x: number, y: number, z: number) => {
        const l = new THREE.Group();
        const cincin = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.012, 32), hitamKilap); cincin.rotation.x = Math.PI / 2; l.add(cincin);
        const kubah = new THREE.Mesh(new THREE.SphereGeometry(r * 0.78, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), kaca);
        kubah.rotation.x = Math.PI / 2; kubah.position.z = 0.004; l.add(kubah);
        l.position.set(x, y, z); return l;
      };
      if (tipe === 'xbar') {
        //  Video bar: batang berlapis kain, modul kamera hitam di tengah.
        const kain = new THREE.MeshStandardMaterial({ map: teksturKain(THREE, WS('#4a4e55'), 0.05), roughness: 0.95 });
        g.add(blok(THREE, b.w, b.h, b.d, b.h * 0.42, kain, 0.01));
        const lebarModul = Math.min(0.16, b.w * 0.2);
        g.add(blok(THREE, lebarModul, b.h * 0.5, 0.012, b.h * 0.22, hitamKilap, 0.003).translateY(b.h * 0.25).translateZ(b.d / 2 + 0.001));
        for (const [x, r] of [[-0.03, 0.0075], [0, 0.011], [0.03, 0.0075]] as const) g.add(lensa(r, x * (lebarModul / 0.16), b.h / 2, b.d / 2 + 0.008));
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 8, 6), mat(THREE, 0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 1 }));
        led.position.set(lebarModul * 0.38, b.h * 0.66, b.d / 2 + 0.008); g.add(led);
      } else if (tipe === 'ptz-ai') {
        //  PTZ AI: bar sensor di bawah, lengan L, kepala kotak membulat.
        const badan = mat(THREE, W(0x25282d), { roughness: 0.4, metalness: 0.35 });
        const tAlas = b.h * 0.26, sKepala = Math.min(0.09, b.h * 0.55);
        g.add(blok(THREE, b.w, tAlas, b.d, tAlas * 0.3, badan, 0.004));
        g.add(lensa(0.009, 0, tAlas / 2, b.d / 2 + 0.002));
        for (const fx of [-0.36, -0.18, 0.18, 0.36]) {
          const titik = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.004, 10), hitamKilap);
          titik.rotation.x = Math.PI / 2; titik.position.set(fx * b.w, tAlas / 2, b.d / 2 + 0.001); g.add(titik);
        }
        g.add(blok(THREE, 0.03, Math.max(0.02, b.h - tAlas - sKepala * 0.5), 0.035, 0.012, badan, 0.004).translateX(sKepala * 0.78).translateY(tAlas));
        g.add(kotak(THREE, sKepala * 0.5, 0.024, 0.03, badan, sKepala * 0.62, b.h - sKepala * 0.5, 0));
        g.add(blok(THREE, sKepala, sKepala, sKepala * 0.95, sKepala * 0.22, badan, 0.006).translateY(b.h - sKepala).translateZ(0.005));
        g.add(lensa(sKepala * 0.32, 0, b.h - sKepala / 2, sKepala * 0.475 + 0.008));
      } else {
        //  PTZ: alas kotak (strip depan hitam), garpu, kepala membulat, lensa besar.
        const abu = mat(THREE, W(0x50555d), { metalness: 0.55, roughness: 0.36 });
        const tAlas = b.h * 0.22, yKepala = tAlas + 0.03 + b.h * 0.08;
        g.add(blok(THREE, b.w, tAlas, b.d, 0.012, abu, 0.004));
        g.add(blok(THREE, b.w * 0.9, tAlas * 0.42, 0.004, 0.004, hitamKilap, 0.0015).translateY(tAlas * 0.25).translateZ(b.d / 2 + 0.0015));
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(b.w * 0.36, b.w * 0.38, 0.014, 32), abu).translateY(tAlas + 0.007));
        for (const sx of [-1, 1]) g.add(blok(THREE, b.w * 0.13, b.h * 0.56, b.d * 0.5, b.w * 0.05, abu, 0.004).translateX(sx * b.w * 0.36).translateY(tAlas + 0.01));
        g.add(blok(THREE, b.w * 0.56, b.h * 0.46, b.d * 0.82, b.w * 0.16, abu, 0.008).translateY(yKepala));
        g.add(lensa(b.w * 0.21, 0, yKepala + b.h * 0.23, b.d * 0.41 + 0.006));
      }
      break;
    }
    case 'proyektor': {
      //  Badan cangkang plastik membulat (tampak atas) bertepi bevel lebar,
      //  muka gelap berisi lensa menyamping + gril ventilasi, panel tombol di
      //  atas. Plafon: bracket laba-laba + pipa ke plafon + pelat plafon.
      //  Meja: empat kaki karet.
      const meja = b.pasangProyektor === 'meja';
      //  Badan (beserta lensa & kaki) dibangun di grup `badan` yang diputar di
      //  engselnya untuk tilt; bracket plafon tetap tegak di grup utama.
      const utama = g;
      const badan = new THREE.Group();
      {
      const g = badan;
      const putih = mat(THREE, W(0xf1f2f4), { roughness: 0.42, metalness: 0.05 });
      const abu = mat(THREE, 0x2f343b, { roughness: 0.45, metalness: 0.3 });
      const hitamKilap = mat(THREE, 0x0a0b0d, { roughness: 0.15, metalness: 0.4 });
      const kaca = new THREE.MeshPhysicalMaterial({ color: 0x1b2a44, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0xc7d6ff, emissiveIntensity: 0.35 });
      const kaki = meja ? Math.min(0.012, b.h * 0.12) : 0;
      const tb = b.h - kaki;
      g.add(papan(THREE, b.w, b.d, tb, Math.min(b.w, b.d) * 0.16, putih, Math.min(0.02, tb * 0.28)).translateY(kaki));
      const zMuka = b.d / 2;
      g.add(blok(THREE, b.w * 0.84, tb * 0.62, 0.004, Math.min(0.012, tb * 0.2), abu, 0.0015).translateY(kaki + tb * 0.19).translateZ(zMuka + 0.001));
      //  Gril ventilasi di sisi kiri muka.
      const gril = new THREE.MeshStandardMaterial({ map: teksturGril(THREE, '#3a3f47', 'rgba(0,0,0,0.9)', 5), roughness: 0.6, metalness: 0.3 });
      g.add(blok(THREE, b.w * 0.34, tb * 0.44, 0.003, Math.min(0.008, tb * 0.12), gril, 0.001).translateX(-b.w * 0.2).translateY(kaki + tb * 0.28).translateZ(zMuka + 0.004));
      //  Lensa: laras menonjol, cincin fokus, kaca bercahaya.
      const [lx, ly] = lensaDatar(b);
      const rL = Math.min(0.05, tb * 0.36);
      const laras = new THREE.Mesh(new THREE.CylinderGeometry(rL, rL * 1.08, 0.03, 32), hitamKilap);
      laras.rotation.x = Math.PI / 2; laras.position.set(lx, ly, zMuka + 0.015); g.add(laras);
      for (const [dz, rr] of [[0.006, 1.14], [0.024, 1.02]] as const) {
        const cincin = new THREE.Mesh(new THREE.TorusGeometry(rL * rr, Math.max(0.002, rL * 0.08), 8, 36), abu);
        cincin.position.set(lx, ly, zMuka + dz); g.add(cincin);
      }
      const kubah = new THREE.Mesh(new THREE.SphereGeometry(rL * 0.82, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), kaca);
      kubah.rotation.x = Math.PI / 2; kubah.scale.set(1, 0.45, 1); kubah.position.set(lx, ly, zMuka + 0.03); g.add(kubah);
      //  Celah ventilasi samping.
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          g.add(kotak(THREE, 0.003, tb * 0.07, b.d * 0.34, hitamKilap, sx * (b.w / 2 + 0.0005), kaki + tb * (0.3 + i * 0.1), -b.d * 0.05));
        }
      }
      //  Panel tombol & lampu daya di atas.
      g.add(papan(THREE, b.w * 0.26, b.d * 0.2, 0.003, 0.01, abu, 0.001).translateX(-b.w * 0.24).translateY(b.h - 0.0005).translateZ(b.d * 0.18));
      const lampu = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8), mat(THREE, 0x60a5fa, { emissive: 0x60a5fa, emissiveIntensity: 1.4 }));
      lampu.position.set(-b.w * 0.33, b.h + 0.002, b.d * 0.18); g.add(lampu);
      if (meja) {
        const karet = mat(THREE, 0x15171b, { roughness: 0.8 });
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, kaki, 16), karet).translateX(sx * (b.w / 2 - 0.045)).translateY(kaki / 2).translateZ(sz * (b.d / 2 - 0.04)));
        }
      } else {
        //  Pelat & lengan laba-laba menempel di badan, ikut miring bersamanya.
        const besi = mat(THREE, 0x25282e, { metalness: 0.75, roughness: 0.35 });
        const hub = new THREE.Vector3(0, b.h + 0.022, 0);
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.016, 24), besi).translateY(b.h + 0.016));
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          const ujung = new THREE.Vector3(sx * b.w * 0.3, b.h + 0.004, sz * b.d * 0.28);
          g.add(tiangAntara(THREE, hub, ujung, 0.006, besi));
          g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 12), besi).translateX(ujung.x).translateY(b.h + 0.003).translateZ(ujung.z));
        }
      }
      }
      const [, ey, ez] = engselProyektor(b);
      const pivot = new THREE.Group(); pivot.position.set(0, ey, ez);
      badan.position.set(0, -ey, -ez); pivot.add(badan);
      pivot.rotation.x = -(tiltDari(b) * Math.PI) / 180;
      utama.add(pivot);
      if (!meja) {
        const g = utama;
        const besi = mat(THREE, 0x25282e, { metalness: 0.75, roughness: 0.35 });
        //  Sendi bola (engsel tilt), pipa sampai plafon, pelat plafon - tetap tegak.
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), besi).translateY(b.h + 0.04));
        g.add(batang(THREE, 0.04, 0.04, besi, 0, 0, 'tiang', 0, true));
        const geoPelat = new THREE.CylinderGeometry(0.08, 0.08, 0.012, 32); geoPelat.translate(0, -0.006, 0);
        const pelat = new THREE.Mesh(geoPelat, besi); pelat.userData.peran = 'plafon'; g.add(pelat);
      }
      break;
    }
    case 'mic': {
      const hitam = mat(THREE, W(0x111827), { metalness: 0.5, roughness: 0.4 });
      if (b.mic === 'boundary') {
        //  Cakram bundar berkain abu-abu dengan cincin LED hijau + ikon mic di tengah (mic konferensi puck).
        const R = b.w / 2, alas = 0.004;
        const kain = new THREE.MeshStandardMaterial({ map: teksturMicBoundary(THREE, 'kain', WS('#6d6e72')), roughness: 1, metalness: 0 });
        const sisi = new THREE.MeshStandardMaterial({ color: W(0x66676b), roughness: 0.95 });
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.93, R * 0.93, alas, 48), mat(THREE, 0x2a2d31, { roughness: 0.8 })).translateY(alas / 2));
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.97, R, b.h - alas, 64), [sisi, kain, sisi]).translateY(alas + (b.h - alas) / 2));
        const ikon = new THREE.Mesh(new THREE.CircleGeometry(R * 0.97, 48),
          new THREE.MeshBasicMaterial({ map: teksturMicBoundary(THREE, 'ikon'), transparent: true, toneMapped: false, depthWrite: false }));
        ikon.rotation.x = -Math.PI / 2; ikon.position.y = b.h + 0.0006; g.add(ikon);
      } else {
        g.add(kotak(THREE, b.w, 0.03, b.d * 0.9, hitam, 0, 0.015, 0)); // dasar + tombol
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 12), mat(THREE, 0xef4444, { emissive: 0xef4444, emissiveIntensity: 0.9 })).translateY(0.032).translateZ(b.d * 0.25));
        const kurva = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.03, -b.d * 0.2), new THREE.Vector3(0, b.h * 0.55, -b.d * 0.15),
          new THREE.Vector3(0, b.h * 0.9, b.d * 0.15), new THREE.Vector3(0, b.h * 0.95, b.d * 0.45),
        ]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(kurva, 24, 0.006, 8, false), hitam));
        const kapsul = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.06, 16), hitam);
        kapsul.rotation.x = Math.PI / 2 - 0.3; kapsul.position.set(0, b.h * 0.94, b.d * 0.5); g.add(kapsul);
      }
      break;
    }
    case 'touchpanel': {
      const perak = mat(THREE, W(0xc7ccd3), { metalness: 0.85, roughness: 0.28 });
      const hitam = mat(THREE, 0x0b0d10, { roughness: 0.2, metalness: 0.3 });
      g.add(blok(THREE, b.w * 0.5, 0.035, b.d * 0.55, 0.012, perak, 0.006).translateZ(-b.d * 0.05));
      const layar = new THREE.Group();
      layar.add(blok(THREE, b.w, b.h, 0.014, 0.012, perak, 0.004).translateY(-b.h / 2));
      layar.add(blok(THREE, b.w * 0.965, b.h * 0.94, 0.004, 0.008, hitam, 0.0015).translateY(-b.h * 0.47).translateZ(0.007));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 0.86, b.h * 0.8), new THREE.MeshBasicMaterial({ map: teksturPanel(THREE), toneMapped: false }));
      m.position.z = 0.0095; layar.add(m);
      layar.rotation.x = -0.95; layar.position.set(0, b.h * 0.45, 0); g.add(layar);
      break;
    }
    case 'rak': {
      //  Rack 19": rangka & panel besi, rel depan, isi perangkat (tekstur per U) di belakang pintu.
      //  Kaca = isi terlihat; tertutup = pintu besi berlubang; open frame = tanpa pintu & panel samping.
      const tipe = b.tipeRak ?? 'kaca';
      const besi = mat(THREE, W(0x15171b), { metalness: 0.55, roughness: 0.45 });
      const U = Math.max(4, b.rakU ?? 20), u = 0.04445, yRel = 0.08, tinggiRel = U * u;
      const tiang = 0.035, sisi = 0.012;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(kotak(THREE, tiang, b.h, tiang, besi, sx * (b.w / 2 - tiang / 2), b.h / 2, sz * (b.d / 2 - tiang / 2)));
      for (const y of [0.04, b.h - 0.02]) g.add(kotak(THREE, b.w, y < 0.1 ? 0.08 : 0.04, b.d, besi, 0, y, 0));
      if (tipe !== 'open') {
        for (const sx of [-1, 1]) g.add(kotak(THREE, sisi, b.h - 0.12, b.d - 0.04, besi, sx * (b.w / 2 - sisi / 2), b.h / 2, 0));
        g.add(kotak(THREE, b.w - 0.04, b.h - 0.12, sisi, besi, 0, b.h / 2, -b.d / 2 + sisi / 2));
        //  Ventilasi atas.
        for (let i = 0; i < 2; i++) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.004, 24), mat(THREE, 0x0a0b0d)).translateX((i - 0.5) * b.w * 0.4).translateY(b.h + 0.001));
      }
      //  Rel 19" & isi perangkat.
      const lebarIsi = Math.min(0.4826, b.w - 0.08), zIsi = b.d / 2 - 0.09;
      const rel = mat(THREE, 0x9ca3af, { metalness: 0.85, roughness: 0.3 });
      for (const sx of [-1, 1]) g.add(kotak(THREE, 0.018, tinggiRel, 0.02, rel, sx * (lebarIsi / 2 + 0.006), yRel + tinggiRel / 2, zIsi));
      const isi = new THREE.Mesh(new THREE.PlaneGeometry(lebarIsi, tinggiRel), new THREE.MeshStandardMaterial({ map: teksturIsiRak(THREE, b), roughness: 0.55, metalness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.08 }));
      isi.position.set(0, yRel + tinggiRel / 2, zIsi + 0.006); g.add(isi);
      g.add(kotak(THREE, lebarIsi, tinggiRel, 0.004, mat(THREE, 0x08090b), 0, yRel + tinggiRel / 2, zIsi - 0.004));
      //  Pintu depan.
      if (tipe !== 'open') {
        const zPintu = b.d / 2 - 0.01, lebarRangka = 0.035;
        const rangka = mat(THREE, W(0x15171b), { metalness: 0.5, roughness: 0.4 });
        g.add(kotak(THREE, b.w - 0.01, lebarRangka, 0.02, rangka, 0, b.h - 0.06, zPintu));
        g.add(kotak(THREE, b.w - 0.01, lebarRangka, 0.02, rangka, 0, 0.1, zPintu));
        for (const sx of [-1, 1]) g.add(kotak(THREE, lebarRangka, b.h - 0.16, 0.02, rangka, sx * (b.w / 2 - 0.0225), b.h / 2 + 0.02, zPintu));
        const lebarDaun = b.w - 0.08, tinggiDaun = b.h - 0.2;
        if (tipe === 'kaca') {
          g.add(kotak(THREE, lebarDaun, tinggiDaun, 0.005, new THREE.MeshPhysicalMaterial({ color: 0x1e293b, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, clearcoat: 1 }), 0, b.h / 2 + 0.02, zPintu));
        } else {
          const lubang = kanvas(256, 512, gg => {
            gg.fillStyle = '#16181c'; gg.fillRect(0, 0, 256, 512);
            gg.fillStyle = '#050607';
            for (let y = 6; y < 512; y += 9) for (let x = (y / 9) % 2 ? 6 : 10.5; x < 256; x += 9) { gg.beginPath(); gg.arc(x, y, 2.6, 0, Math.PI * 2); gg.fill(); }
          });
          const tl = new THREE.CanvasTexture(lubang); tl.colorSpace = THREE.SRGBColorSpace;
          g.add(new THREE.Mesh(new THREE.BoxGeometry(lebarDaun, tinggiDaun, 0.006), new THREE.MeshStandardMaterial({ map: tl, metalness: 0.5, roughness: 0.45 })).translateY(b.h / 2 + 0.02).translateZ(zPintu));
        }
        g.add(kotak(THREE, 0.015, 0.16, 0.025, mat(THREE, 0xb8bec7, { metalness: 0.9, roughness: 0.2 }), b.w / 2 - 0.06, b.h * 0.55, zPintu + 0.018));
      }
      //  Kaki / roda.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 14), mat(THREE, 0x0a0b0d)).translateX(sx * (b.w / 2 - 0.05)).translateY(0.01).translateZ(sz * (b.d / 2 - 0.05)));
      break;
    }
    case 'lift': {
      const hitam = mat(THREE, W(0x15171b), { metalness: 0.6, roughness: 0.32 });
      const hitamKilap = mat(THREE, 0x0a0b0d, { roughness: 0.15, metalness: 0.3 });
      g.add(papan(THREE, b.w, b.d, 0.008, 0.01, hitam, 0.002));
      const lebarMon = Math.min(0.36, b.w * 0.66), xMon = -b.w / 2 + lebarMon / 2 + 0.03;
      g.add(kotak(THREE, lebarMon + 0.01, 0.0015, 0.014, hitamKilap, xMon, 0.0085, -b.d * 0.18));
      if (b.naik !== false) {
        const tinggiMon = lebarMon * 0.6;
        const mon = new THREE.Group();
        mon.add(blok(THREE, lebarMon, tinggiMon, 0.012, 0.008, hitam, 0.003));
        const layar = new THREE.Mesh(new THREE.PlaneGeometry(lebarMon * 0.95, tinggiMon * 0.86), new THREE.MeshBasicMaterial({ map: teksturLift(THREE), toneMapped: false }));
        layar.position.set(0, tinggiMon * 0.53, 0.0065); mon.add(layar);
        mon.add(blok(THREE, lebarMon + 0.012, 0.03, 0.03, 0.01, hitam, 0.004));
        mon.position.set(xMon, 0.008, -b.d * 0.18); mon.rotation.x = -0.16; g.add(mon);
      }
      const xMic = b.w / 2 - 0.06;
      if (b.naik !== false) {
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.008, 20), hitam).translateX(xMic).translateY(0.012).translateZ(b.d * 0.15));
        const kurva = new THREE.CatmullRomCurve3([
          new THREE.Vector3(xMic, 0.012, b.d * 0.15), new THREE.Vector3(xMic, b.h * 0.6, b.d * 0.12), new THREE.Vector3(xMic, b.h * 0.88, b.d * 0.02),
        ]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(kurva, 24, 0.005, 8, false), hitam));
        const kepala = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 14), hitamKilap);
        kepala.scale.set(1, 1.5, 1); kepala.position.set(xMic, b.h * 0.92, -b.d * 0.02); g.add(kepala);
      } else {
        //  Layar turun = mic gooseneck ikut masuk ke meja (hide); tinggal lubang/tutup rata di tempatnya.
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.0015, 24), hitamKilap).translateX(xMic).translateY(0.0085).translateZ(b.d * 0.15));
      }
      break;
    }
    case 'tribun': { tribunModel(THREE, g, b, WS('#8b1e2b')); break; }
    case 'panggung': {
      //  Platform: lantai panggung kayu gelap, rok depan hitam, tangga di sisi kiri depan.
      const lantaiP = new THREE.MeshStandardMaterial({ map: teksturKayu(THREE, 'walnut', false), color: warnaB ? new THREE.Color(warnaB) : 0x6b6b6b, roughness: 0.6 });
      const rok = mat(THREE, 0x0d0e10, { roughness: 0.9 });
      g.add(kotak(THREE, b.w, b.h - 0.03, b.d, rok, 0, (b.h - 0.03) / 2, 0));
      g.add(papan(THREE, b.w, b.d, 0.03, 0.005, lantaiP, 0.003).translateY(b.h - 0.03));
      g.add(kotak(THREE, b.w, 0.012, 0.01, mat(THREE, 0xf5f5f4, { emissive: 0xf5f5f4, emissiveIntensity: 0.25 }), 0, b.h - 0.006, b.d / 2 + 0.002)); // tepi terang
      const nAnak = Math.max(1, Math.round(b.h / 0.18)), tAnak = b.h / (nAnak + 0), lebarT = Math.min(1.2, b.w * 0.2);
      for (let i = 0; i < nAnak; i++) {
        const tinggi = tAnak * (i + 1) - 0.0001;
        g.add(kotak(THREE, lebarT, tinggi, 0.28, rok, -b.w / 2 + lebarT / 2 + 0.3, tinggi / 2, b.d / 2 + 0.28 * (nAnak - i) - 0.14));
      }
      break;
    }
    case 'bidang': { bidangMapping(THREE, g, b, W(0xf3f4f6)); break; }
    case 'model': {
      const asli = b.modelKunci ? bahan.model(b.modelKunci) : null;
      if (asli) {
        const salinan = asli.clone(true);
        //  Skala agar muat di kotak w×h×d, alas di y = 0.
        const kotakB = new THREE.Box3().setFromObject(salinan);
        const s = kotakB.getSize(new THREE.Vector3());
        const k = Math.min(b.w / Math.max(1e-3, s.x), b.h / Math.max(1e-3, s.y), b.d / Math.max(1e-3, s.z));
        salinan.scale.multiplyScalar(k);
        const k2 = new THREE.Box3().setFromObject(salinan); const c = k2.getCenter(new THREE.Vector3());
        salinan.position.sub(new THREE.Vector3(c.x, k2.min.y, c.z));
        g.add(salinan);
      } else {
        g.add(kotak(THREE, b.w, b.h, b.d, mat(THREE, 0xa855f7, { transparent: true, opacity: 0.5 }), 0, b.h / 2, 0));
      }
      break;
    }
  }
  g.traverse(o => { if ((o as T.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/**
 * Terapkan ketinggian: grup di y = elev; kaki memanjang ke lantai, tiang ke
 * plafon, alas troli tetap di lantai. Murah - dipanggil tiap frame seret.
 */
export function sesuaikanTinggi(g: T.Object3D, b: Benda, plafon: number) {
  g.position.y = b.elev;
  for (const o of g.children) {
    const peran = o.userData.peran as string | undefined;
    if (!peran) continue;
    if (peran === 'lantai') { o.position.y = -b.elev; o.visible = b.elev > 0.05; continue; }
    if (peran === 'kaki') {
      //  userData.bawah = pangkal kaki di atas lantai (mis. tiang standfloor mulai dari percabangan kaki A).
      const bawah = Math.min((o.userData.bawah as number | undefined) ?? 0, b.elev + (o.userData.atas as number) - 0.05);
      const panjang = b.elev + (o.userData.atas as number) - Math.max(0, bawah);
      o.position.y = -b.elev + Math.max(0, bawah); o.scale.y = Math.max(0.001, panjang); o.visible = b.elev > 0.05 || bawah > 0;
    } else if (peran === 'tiang') {
      const panjang = plafon - b.elev - b.h;
      o.position.y = b.h; o.scale.y = Math.max(0.001, panjang); o.visible = panjang > 0.02;
    } else if (peran === 'plafon') {
      //  Pelat yang menempel di plafon (bracket proyektor).
      o.position.y = plafon - b.elev; o.visible = plafon - b.elev - b.h > 0.02;
    }
  }
}
