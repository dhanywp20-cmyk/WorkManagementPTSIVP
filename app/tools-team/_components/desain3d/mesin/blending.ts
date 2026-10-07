/**
 * desain3d/mesin/blending.ts - Area blending antar proyektor di kanvas: zona ungu di permukaan yang
 * disinari dua proyektor + garis ukur berpanah & kartu keterangan (mesin/ukurBlending.ts). Ukurannya
 * dihitung murni di inti/blending.ts; di sini hanya raycast keterhalangan & zonanya. Hasil dikirim ke
 * keadaan untuk panel proyektor & lembar cetak.
 */
import type * as T from 'three';
import { hitungBlending, keGambar, type Benda, type Blending, type Lensa, type Titik } from '../inti';
import type { Mesin } from './tipe';
import { gambarUkurBlending } from './ukurBlending';

export interface DataBlend {
  p: Benda; L: Lensa; O: T.Vector3;
  /** Benda & ruang yang bisa disinari proyektor ini (dirinya sendiri dikecualikan). */ sasaran: T.Object3D[];
  /** Grid titik gambar NX x NY (baris demi baris) dari raycast sinar. */ kena: (T.Vector3 | null)[];
  baris: (Titik | null)[]; kolom: (Titik | null)[];
}

/** Titik sudut poligon zona + nilai batas bingkai lawan (>= 0 = di dalam). */
interface Simpul { p: T.Vector3; f: number[] }

/** Potong poligon cembung oleh satu batas f[c] >= 0 (Sutherland-Hodgman, interpolasi linear). */
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

/** Nama ringkas untuk label: tanpa akhiran "(blending)" template, "Proyektor 2" -> "P2". */
const pendek = (n: string) => n.replace(/\s*\(blending\)\s*/i, '').replace(/^Proyektor\s*(?=\d)/i, 'P').trim() || n;

/** Hasil sama (diabaikan titik label) -> keadaan tidak diperbarui, kanvas tidak digambar ulang berulang. */
const kunci = (h: Blending[]) => JSON.stringify(h.map(b => [b.a, b.b, b.namaA, b.namaB, b.arah, b.lebarM.toFixed(3), b.persenA.toFixed(1), b.persenB.toFixed(1)]));

export function gambarBlending(
  m: Mesin, data: DataBlend[], NX: number, NY: number,
  setInfo: (f: (v: Blending[]) => Blending[]) => void,
) {
  const { THREE, grupBantu } = m;
  const ray = new THREE.Raycaster(); ray.near = 0.03; ray.far = 80;
  const arah = new THREE.Vector3(), X = new THREE.Vector3();

  //  Titik permukaan benar-benar disinari proyektor ke-i: sinar dari lensanya tidak terhalang
  //  benda lain sebelum sampai ke titik itu (toleransi 5 cm).
  const terlihat = (i: number, t: Titik) => {
    const d = data[i];
    X.set(t[0], t[1], t[2]);
    const jarak = X.distanceTo(d.O);
    ray.set(d.O, arah.copy(X).sub(d.O).normalize());
    const hit = ray.intersectObjects(d.sasaran, true).find(h => {
      const o = h.object as T.Mesh;
      if (!o.isMesh) return false;
      const mt = (Array.isArray(o.material) ? o.material[0] : o.material) as T.Material & { opacity?: number };
      return !(mt?.transparent && (mt.opacity ?? 1) < 0.6);
    });
    return !hit || hit.distance >= jarak - 0.05;
  };

  const hasil = hitungBlending(data.map(d => ({ p: d.p, L: d.L, baris: d.baris, kolom: d.kolom })), terlihat);
  setInfo(v => (kunci(v) === kunci(hasil) ? v : hasil));

  const bahan = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  for (const b of hasil) {
    const A = data.find(d => d.p.id === b.a), B = data.find(d => d.p.id === b.b);
    if (!A || !B) continue;
    //  Zona: tiap sel grid gambar A dipotong (Sutherland-Hodgman) oleh bingkai gambar B - fungsi batas
    //  |u| <= 0,5 & |v| <= 0,5 di koordinat lensa B, diinterpolasi linear antar sudut sel - jadi tepi zona
    //  mengikuti tepi gambar B dengan halus, bukan bergerigi per sel.
    const sel = (i: number, j: number) => A.kena[j * NX + i];
    const pos: number[] = [];
    for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
      const sudut = [sel(i, j), sel(i + 1, j), sel(i + 1, j + 1), sel(i, j + 1)];
      if (sudut.some(x => !x)) continue;
      //  Sel yang "melompat" (tepi benda ke dinding di belakangnya) dilewati - aturan yang sama dengan sinar.
      const jarak = (sudut[0]!.distanceTo(A.O) + sudut[2]!.distanceTo(A.O)) / 2;
      const batas = ((jarak * A.L.w1) / (NX - 1)) * 6 + 0.05;
      if (sudut.some((x, k) => x!.distanceTo(sudut[(k + 1) % 4]!) > batas)) continue;
      let poli: Simpul[] = [];
      for (const x of sudut) {
        const k = keGambar(B.L, [x!.x, x!.y, x!.z]);
        if (!k) { poli = []; break; }
        poli.push({ p: x!.clone(), f: [0.5 - k.u, 0.5 + k.u, 0.5 - k.v, 0.5 + k.v] });
      }
      for (let c = 0; c < 4 && poli.length; c++) poli = potong(poli, c);
      for (let k = 1; k + 1 < poli.length; k++) {
        const [a0, a1, a2] = [poli[0].p, poli[k].p, poli[k + 1].p];
        pos.push(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, a2.x, a2.y, a2.z);
      }
    }
    if (pos.length) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const zona = new THREE.Mesh(geo, bahan.clone()); zona.renderOrder = 3; grupBantu.add(zona);
    }
    gambarUkurBlending(m, b, A.O, A.L, pendek);
  }
  bahan.dispose();
}
