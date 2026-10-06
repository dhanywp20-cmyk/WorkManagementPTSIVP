/**
 * desain3d/bangun/dasar.ts - Primitif bersama (bahan, kotak, papan, pipa, batang, ekstrusi) & konteks pembangun.
 * Model dibangun dengan alas di y = 0; ketinggian (elev) diterapkan lewat posisi grup.
 */
import type * as T from 'three';
import type { Benda } from '../inti';

// ── Pembuat model ──────────────────────────────────────────────────────────

export interface Bahan { THREE: typeof T; layar: (b: Benda) => T.Texture | null; model: (kunci: string) => T.Object3D | null }

/** Yang dibutuhkan fungsi pembangun satu jenis benda (lihat bangun/index.ts). */
export interface Konteks {
  THREE: typeof T; g: T.Group; b: Benda; bahan: Bahan;
  /** Permukaan layar (konten / pola / gambar unggahan) seukuran w x h. */ muka: (w: number, h: number, z: number, y: number) => T.Mesh;
  /** Warna utama pilihan engineer (#rrggbb) bila diisi. */ warnaB: string | undefined;
  /** Warna utama atau warna bawaan model (angka / teks). */ W: (bawaan: number) => number; WS: (bawaan: string) => string;
}

export function mat(THREE: typeof T, warna: number, opsi: Partial<T.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color: warna, roughness: 0.6, metalness: 0.1, ...opsi });
}

export function kotak(THREE: typeof T, w: number, h: number, d: number, m: T.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o;
}

// ── Bentuk halus: sudut membulat & tepi bevel (bukan kotak tajam) ──────────

/** Persegi panjang bersudut membulat di bidang XY, berpusat di (0, 0). */
export function persegiBulat(THREE: typeof T, w: number, h: number, r: number): T.Shape {
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
export const bevelAman = (bevel: number, ...ukuran: number[]) => Math.max(0, Math.min(bevel, ...ukuran.map(u => u / 2 - 0.0006)));

function ekstrusi(THREE: typeof T, bentuk: T.Shape, tebal: number, bv: number, lengkung = 14) {
  return new THREE.ExtrudeGeometry(bentuk, {
    depth: Math.max(0.0005, tebal - 2 * bv), bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv,
    bevelSegments: bv > 0 ? 3 : 1, curveSegments: lengkung,
  });
}

/** Lempeng mendatar dari bentuk tampak atas (bentuk x -> x, bentuk y -> z); y = 0 .. tebal. */
export function lempeng(THREE: typeof T, bentuk: T.Shape, tebal: number, bv: number, m: T.Material, lengkung = 14) {
  const geo = ekstrusi(THREE, bentuk, tebal, bv, lengkung);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, tebal - bv, 0);
  return new THREE.Mesh(geo, m);
}

/** Papan tampak atas bersudut membulat: w (x) x d (z), tebal ke atas dari y = 0. */
export function papan(THREE: typeof T, w: number, d: number, tebal: number, r: number, m: T.Material, bevel = 0.006) {
  const bv = bevelAman(bevel, tebal, w, d);
  return lempeng(THREE, persegiBulat(THREE, w - 2 * bv, d - 2 * bv, r - bv), tebal, bv, m);
}

/** Blok tampak depan bersudut membulat: w (x) x h (y), tebal d berpusat di z = 0, alas y = 0. */
export function blok(THREE: typeof T, w: number, h: number, d: number, r: number, m: T.Material, bevel = 0.004) {
  const bv = bevelAman(bevel, d, w, h);
  const geo = ekstrusi(THREE, persegiBulat(THREE, w - 2 * bv, h - 2 * bv, r - bv), d, bv, 12);
  geo.translate(0, h / 2, -(d - 2 * bv) / 2);
  return new THREE.Mesh(geo, m);
}

/** Pipa melalui titik-titik dengan sudut tertekuk membulat (rangka meja, sandaran tangan). */
export function pipa(THREE: typeof T, titik: [number, number, number][], jari: number, tekuk: number, m: T.Material, tutup = false) {
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
export function lengkungkan(geo: T.BufferGeometry, R: number) {
  const pos = geo.attributes.position as T.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + (pos.getX(i) ** 2) / (2 * R));
  pos.needsUpdate = true; geo.computeVertexNormals();
  return geo;
}

/** Silinder dari titik a ke b (kaki miring, lengan kaki bintang). */
export function tiangAntara(THREE: typeof T, a: T.Vector3, b: T.Vector3, jari: number, m: T.Material, jariUjung = jari) {
  const arah = b.clone().sub(a);
  const o = new THREE.Mesh(new THREE.CylinderGeometry(jariUjung, jari, arah.length(), 12), m);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arah.normalize());
  return o;
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
export function diLantai(o: T.Object3D) { o.userData.peran = 'lantai'; return o; }

/** Pelat pipih dari titik a ke b (lebar di sumbu x lokal, tebal di z lokal) - untuk lengan gunting. */
export function pelatAntara(THREE: typeof T, a: T.Vector3, b: T.Vector3, lebar: number, tebal: number, m: T.Material) {
  const arah = b.clone().sub(a);
  const o = new THREE.Mesh(new THREE.BoxGeometry(tebal, arah.length(), lebar), m);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arah.normalize());
  return o;
}
