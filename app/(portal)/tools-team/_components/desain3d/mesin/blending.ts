import type * as T from 'three';
import { hitungBlending, keGambar, type Benda, type Blending, type Lensa, type Titik } from '../inti';
import type { Mesin } from './tipe';
import { gambarUkurBlending } from './ukurBlending';

export interface DataBlend {
  p: Benda; L: Lensa; O: T.Vector3;
   sasaran: T.Object3D[];
  zona: number[];
   zonaN: number[];
   zonaMesh: string[];
  baris: (Titik | null)[]; kolom: (Titik | null)[];
}

interface Simpul { p: T.Vector3; f: number[] }

function potong(poli: Simpul[], c: number): Simpul[] {
  const hasil: Simpul[] = [];
  for (let i = 0; i < poli.length; i++) {
    const P = poli[i], Q = poli[(i + 1) % poli.length];
    const pIn = P.f[c] >= 0, qIn = Q.f[c] >= 0;
    if (pIn) hasil.push(P);
    if (pIn !== qIn) {
      const t = P.f[c] / (P.f[c] - Q.f[c]);
      hasil.push({ p: P.p.clone().lerp(Q.p, t), f: P.f.map((v, k) => v + (Q.f[k] - v) * t) });
    }
  }
  return hasil;
}

const COS_MIN = 0.08;

const pendek = (n: string) => n.replace(/\s*\(blending\)\s*/i, '').replace(/^Proyektor\s*(?=\d)/i, 'P').trim() || n;

const kunci = (h: Blending[]) => JSON.stringify(h.map(b => [b.a, b.b, b.namaA, b.namaB, b.arah, b.lebarM.toFixed(3), b.persenA.toFixed(1), b.persenB.toFixed(1)]));

export function gambarBlending(
  m: Mesin, data: DataBlend[],
  setInfo: (f: (v: Blending[]) => Blending[]) => void,
   detail: boolean,
   gambar = true,
): Blending[] {
  const { THREE, grupBantu } = m;
  const ray = new THREE.Raycaster(); ray.near = 0.03; ray.far = 80;
  const arah = new THREE.Vector3(), X = new THREE.Vector3();

  const terlihat = (i: number, t: Titik, abaikan?: string) => {
    const d = data[i];
    X.set(t[0], t[1], t[2]);
    const jarak = X.distanceTo(d.O);
    ray.set(d.O, arah.copy(X).sub(d.O).normalize());
    const hit = ray.intersectObjects(d.sasaran, true).find(h => {
      const o = h.object as T.Mesh;
      if (!o.isMesh || o.uuid === abaikan) return false;
      const mt = (Array.isArray(o.material) ? o.material[0] : o.material) as T.Material & { opacity?: number };
      return !(mt?.transparent && (mt.opacity ?? 1) < 0.6);
    });
    return !hit || hit.distance >= jarak - 0.05;
  };

  const hasil = hitungBlending(data.map(d => ({ p: d.p, L: d.L, baris: d.baris, kolom: d.kolom })), terlihat);
  setInfo(v => (kunci(v) === kunci(hasil) ? v : hasil));
  if (!gambar) return hasil;

  const bahan = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.FrontSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const b of hasil) {
    const iA = data.findIndex(d => d.p.id === b.a), iB = data.findIndex(d => d.p.id === b.b);
    const A = data[iA], B = data[iB];
    if (!A || !B) continue;
    const pos: number[] = [], z = A.zona, zn = A.zonaN;
    for (let s = 0; s + 8 < z.length; s += 9) {
      let poli: Simpul[] = [];
      for (let k = 0; k < 9; k += 3) {
        const p = new THREE.Vector3(z[s + k], z[s + k + 1], z[s + k + 2]);
        const g = keGambar(B.L, [p.x, p.y, p.z]);
        if (!g) { poli = []; break; }
        const cos = (O: T.Vector3) => { const r = O.clone().sub(p).normalize(); return r.x * zn[s + k] + r.y * zn[s + k + 1] + r.z * zn[s + k + 2]; };
        poli.push({ p, f: [0.5 - g.u, 0.5 + g.u, 0.5 - g.v, 0.5 + g.v, cos(A.O) - COS_MIN, cos(B.O) - COS_MIN] });
      }
      for (let c = 0; c < 6 && poli.length; c++) poli = potong(poli, c);
      if (poli.length < 3) continue;
      const pusat = poli.reduce((t, x) => t.add(x.p), new THREE.Vector3()).divideScalar(poli.length);
      if (!terlihat(iB, [pusat.x, pusat.y, pusat.z], A.zonaMesh[s / 9])) continue;
      for (let k = 1; k + 1 < poli.length; k++) {
        const [a0, a1, a2] = [poli[0].p, poli[k].p, poli[k + 1].p];
        pos.push(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, a2.x, a2.y, a2.z);
      }
    }
    if (pos.length) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const zona = new THREE.Mesh(geo, bahan.clone()); zona.renderOrder = 3; grupBantu.add(zona);
    }
    gambarUkurBlending(m, b, A.O, A.L, pendek, detail);
  }
  bahan.dispose();
  return hasil;
}
