import type * as T from 'three';

export type PermukaanAnalitik =
  | { jenis: 'bola'; R: number; cy: number; cz: number; a0: number; tb: number; fiA: number; fiB: number }
  | { jenis: 'silinder'; R: number; cz: number; h: number; a0: number; tb: number }
  | { jenis: 'datar'; w: number; h: number };

export interface Tembakan { jarak: number; titik: T.Vector3; normal: T.Vector3 | null; mesh: T.Mesh }

const SEL = 1e-6;
const DUA_PI = 2 * Math.PI;
const dalamBusur = (x: number, z: number, a0: number, tb: number) => {
  if (tb >= DUA_PI - SEL) return true;
  const a = (((Math.atan2(x, z) - a0) % DUA_PI) + DUA_PI) % DUA_PI;
  return a <= tb + SEL;
};

export function kenaAnalitik(a: PermukaanAnalitik, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, dekat: number): { s: number; nx: number; ny: number; nz: number } | null {
  if (a.jenis === 'datar') {
    if (Math.abs(dz) < 1e-12) return null;
    const s = -oz / dz;
    if (s <= dekat) return null;
    const x = ox + dx * s, y = oy + dy * s;
    return Math.abs(x) <= a.w / 2 + SEL && Math.abs(y) <= a.h / 2 + SEL ? { s, nx: 0, ny: 0, nz: 1 } : null;
  }
  const bola = a.jenis === 'bola';
  const px = ox, py = bola ? oy - a.cy : 0, pz = oz - a.cz, ey = bola ? dy : 0;
  const A = dx * dx + ey * ey + dz * dz, B = 2 * (px * dx + py * ey + pz * dz), C = px * px + py * py + pz * pz - a.R * a.R, disk = B * B - 4 * A * C;
  if (A < 1e-14 || disk < 0) return null;
  const akar = Math.sqrt(disk);
  for (const s of [(-B - akar) / (2 * A), (-B + akar) / (2 * A)]) {
    if (s <= dekat) continue;
    const x = px + dx * s, z = pz + dz * s;
    if (!dalamBusur(x, z, a.a0, a.tb)) continue;
    if (bola) {
      const y = py + dy * s;
      if (y > a.R * Math.sin(a.fiA) + SEL || y < -a.R * Math.sin(a.fiB) - SEL) continue;
      return { s, nx: x / a.R, ny: y / a.R, nz: z / a.R };
    }
    const y = oy + dy * s;
    if (y < -SEL || y > a.h + SEL) continue;
    return { s, nx: x / a.R, ny: 0, nz: z / a.R };
  }
  return null;
}

const POTONG = 32, KELOMPOK = 16;
interface Segitiga { v: Float64Array; n: number; kotak: Float64Array; grup: Float64Array; buang: 0 | 1 | 2 }
const simpanan = new WeakMap<T.Mesh, { kunci: string; s: Segitiga }>();

function kotakDari(v: Float64Array, dari: number, sampai: number, ke: Float64Array, o: number) {
  ke[o] = ke[o + 1] = ke[o + 2] = Infinity; ke[o + 3] = ke[o + 4] = ke[o + 5] = -Infinity;
  for (let i = dari * 9; i < sampai * 9; i += 3) for (let k = 0; k < 3; k++) {
    const x = v[i + k];
    if (x < ke[o + k]) ke[o + k] = x;
    if (x > ke[o + 3 + k]) ke[o + 3 + k] = x;
  }
}

function segitigaDunia(THREE: typeof T, mesh: T.Mesh): Segitiga | null {
  const g = mesh.geometry, pos = g.attributes.position as T.BufferAttribute | undefined, mt = mesh.material;
  if (!pos || !mt || Array.isArray(mt) || (mesh as T.SkinnedMesh).isSkinnedMesh || (mesh as T.InstancedMesh).isInstancedMesh || Object.keys(g.morphAttributes).length) return null;
  const e = mesh.matrixWorld.elements, idx = g.index;
  const kunci = `${g.uuid}|${pos.version}|${idx?.version ?? -1}|${g.drawRange.start}|${g.drawRange.count}|${mt.side}|${e.join(',')}`;
  const ada = simpanan.get(mesh);
  if (ada?.kunci === kunci) return ada.s;
  const mulai = Math.max(0, g.drawRange.start), akhir = Math.min(idx ? idx.count : pos.count, g.drawRange.start + g.drawRange.count);
  const n = Math.max(0, Math.floor((akhir - mulai) / 3)), v = new Float64Array(n * 9);
  for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) {
    const i = idx ? idx.getX(mulai + t * 3 + k) : mulai + t * 3 + k, x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), o = t * 9 + k * 3;
    v[o] = e[0] * x + e[4] * y + e[8] * z + e[12]; v[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; v[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
  }
  const nK = Math.ceil(n / POTONG), nG = Math.ceil(nK / KELOMPOK), kotak = new Float64Array(nK * 6), grup = new Float64Array(nG * 6);
  for (let c = 0; c < nK; c++) kotakDari(v, c * POTONG, Math.min(n, (c + 1) * POTONG), kotak, c * 6);
  for (let q = 0; q < nG; q++) kotakDari(v, q * POTONG * KELOMPOK, Math.min(n, (q + 1) * POTONG * KELOMPOK), grup, q * 6);
  const cermin = mesh.matrixWorld.determinant() < 0, depan = mt.side === THREE.FrontSide, belakang = mt.side === THREE.BackSide;
  const s: Segitiga = { v, n, kotak, grup, buang: depan ? (cermin ? 2 : 1) : belakang ? (cermin ? 1 : 2) : 0 };
  simpanan.set(mesh, { kunci, s });
  return s;
}

function masukKotak(b: Float64Array, o: number, ox: number, oy: number, oz: number, ix: number, iy: number, iz: number, batas: number): boolean {
  let t0 = 0, t1 = batas;
  const ta = (b[o] - ox) * ix, tb = (b[o + 3] - ox) * ix;
  t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
  const ua = (b[o + 1] - oy) * iy, ub = (b[o + 4] - oy) * iy;
  t0 = Math.max(t0, Math.min(ua, ub)); t1 = Math.min(t1, Math.max(ua, ub));
  const wa = (b[o + 2] - oz) * iz, wb = (b[o + 5] - oz) * iz;
  t0 = Math.max(t0, Math.min(wa, wb)); t1 = Math.min(t1, Math.max(wa, wb));
  return t0 <= t1;
}

function kenaSegitiga(s: Segitiga, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, dekat: number, jauh: number): { t: number; i: number } | null {
  const ix = 1 / (dx || 1e-30), iy = 1 / (dy || 1e-30), iz = 1 / (dz || 1e-30), v = s.v;
  let best = jauh, bi = -1;
  for (let q = 0; q * 6 < s.grup.length; q++) {
    if (!masukKotak(s.grup, q * 6, ox, oy, oz, ix, iy, iz, best)) continue;
    const cAkhir = Math.min(s.kotak.length / 6, (q + 1) * KELOMPOK);
    for (let c = q * KELOMPOK; c < cAkhir; c++) {
      if (!masukKotak(s.kotak, c * 6, ox, oy, oz, ix, iy, iz, best)) continue;
      const tAkhir = Math.min(s.n, (c + 1) * POTONG);
      for (let t = c * POTONG; t < tAkhir; t++) {
        const o = t * 9, ax = v[o], ay = v[o + 1], az = v[o + 2];
        const e1x = v[o + 3] - ax, e1y = v[o + 4] - ay, e1z = v[o + 5] - az, e2x = v[o + 6] - ax, e2y = v[o + 7] - ay, e2z = v[o + 8] - az;
        const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
        let DdN = dx * nx + dy * ny + dz * nz, tanda: number;
        if (DdN > 0) { if (s.buang === 1) continue; tanda = 1; } else if (DdN < 0) { if (s.buang === 2) continue; tanda = -1; DdN = -DdN; } else continue;
        const qx = ox - ax, qy = oy - ay, qz = oz - az;
        const u = tanda * (dx * (qy * e2z - qz * e2y) + dy * (qz * e2x - qx * e2z) + dz * (qx * e2y - qy * e2x));
        if (u < 0) continue;
        const w = tanda * (dx * (e1y * qz - e1z * qy) + dy * (e1z * qx - e1x * qz) + dz * (e1x * qy - e1y * qx));
        if (w < 0 || u + w > DdN) continue;
        const jarak = (-tanda * (qx * nx + qy * ny + qz * nz)) / DdN;
        if (jarak < dekat || jarak >= best) continue;
        best = jarak; bi = t;
      }
    }
  }
  return bi < 0 ? null : { t: best, i: bi };
}

interface Calon { mesh: T.Mesh; kotak: T.Box3; analitik: PermukaanAnalitik | null; balik: T.Matrix4 | null; nm: T.Matrix3; segitiga: Segitiga | null }

const tembus = (o: T.Mesh) => {
  const mt = (Array.isArray(o.material) ? o.material[0] : o.material) as T.Material & { opacity?: number };
  return !!o.userData.tanpaBayangan || (!!mt?.transparent && (mt.opacity ?? 1) < 0.6);
};

export type Penembak = (O: T.Vector3, arah: T.Vector3, kecuali?: string) => Tembakan | null;

export function buatPenembak(THREE: typeof T, akar: T.Object3D[], dekat = 0.03, jauh = 80): Penembak {
  const calon: Calon[] = [];
  for (const a of akar) a.traverseVisible(x => {
    const mesh = x as T.Mesh;
    if (!mesh.isMesh || !mesh.geometry || tembus(mesh)) return;
    const analitik = (mesh.userData.analitik as PermukaanAnalitik | undefined) ?? null;
    calon.push({ mesh, kotak: new THREE.Box3().setFromObject(mesh), analitik, balik: analitik ? mesh.matrixWorld.clone().invert() : null, nm: new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld), segitiga: analitik ? null : segitigaDunia(THREE, mesh) });
  });
  const ray = new THREE.Raycaster(); ray.near = dekat; ray.far = jauh;
  const sinar = new THREE.Ray(), o = new THREE.Vector3(), dl = new THREE.Vector3(), masuk = new THREE.Vector3();
  const urut: { c: Calon; t: number }[] = [], hasil: T.Intersection[] = [];
  return (O, arah, kecuali) => {
    sinar.set(O, arah);
    urut.length = 0;
    for (const c of calon) {
      if (kecuali && c.mesh.uuid === kecuali) continue;
      const t = c.kotak.containsPoint(O) ? 0 : sinar.intersectBox(c.kotak, masuk) ? masuk.distanceTo(O) : -1;
      if (t >= 0 && t <= jauh) urut.push({ c, t });
    }
    urut.sort((a, b) => a.t - b.t);
    let terbaik: Tembakan | null = null;
    for (const { c, t } of urut) {
      if (terbaik && t > terbaik.jarak) break;
      if (c.analitik) {
        o.copy(O).applyMatrix4(c.balik!);
        dl.copy(O).add(arah).applyMatrix4(c.balik!).sub(o);
        const k = kenaAnalitik(c.analitik, o.x, o.y, o.z, dl.x, dl.y, dl.z, 0);
        if (!k || k.s < dekat || k.s > jauh || (terbaik && k.s >= terbaik.jarak)) continue;
        terbaik = { jarak: k.s, titik: O.clone().addScaledVector(arah, k.s), normal: new THREE.Vector3(k.nx, k.ny, k.nz).applyMatrix3(c.nm).normalize(), mesh: c.mesh };
        continue;
      }
      if (c.segitiga) {
        const k = kenaSegitiga(c.segitiga, O.x, O.y, O.z, arah.x, arah.y, arah.z, dekat, terbaik ? terbaik.jarak : jauh);
        if (!k) continue;
        const v = c.segitiga.v, b = k.i * 9;
        const e1 = new THREE.Vector3(v[b + 3] - v[b], v[b + 4] - v[b + 1], v[b + 5] - v[b + 2]), e2 = new THREE.Vector3(v[b + 6] - v[b], v[b + 7] - v[b + 1], v[b + 8] - v[b + 2]);
        terbaik = { jarak: k.t, titik: O.clone().addScaledVector(arah, k.t), normal: e1.cross(e2).normalize(), mesh: c.mesh };
        continue;
      }
      hasil.length = 0;
      ray.set(O, arah);
      c.mesh.raycast(ray, hasil);
      for (const h of hasil) {
        if (h.distance < dekat || h.distance > jauh || (terbaik && h.distance >= terbaik.jarak)) continue;
        const nl = (h as { normal?: T.Vector3 }).normal ?? h.face?.normal;
        terbaik = { jarak: h.distance, titik: h.point.clone(), normal: nl ? nl.clone().applyMatrix3(c.nm).normalize() : null, mesh: c.mesh };
      }
    }
    return terbaik;
  };
}
