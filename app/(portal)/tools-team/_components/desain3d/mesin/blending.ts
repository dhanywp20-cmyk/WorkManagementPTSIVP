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
  /**
   * Segitiga permukaan yang benar-benar tersinari proyektor ini (9 angka per segitiga, sisi depan menghadap
   * lensa) - potongan sel yang sama dengan bidang cahayanya (mesin/sinar.ts), jadi tepi zona ikut tepat di tepi
   * layar, pojok ruangan & bayangan benda, bukan bertangga selebar sel grid.
   */
  zona: number[];
  /** Normal tiap titik zona (menghadap lensa) - batas "permukaan mulai membelakangi lensa lawan" dipotong halus. */ zonaN: number[];
  /** Mesh permukaan tiap segitiga zona - permukaan itu sendiri tidak dihitung menghalangi sinar lensa lawan. */ zonaMesh: string[];
  baris: (Titik | null)[]; kolom: (Titik | null)[];
}

/** Titik sudut poligon zona + nilai batas (>= 0 = di dalam): 4 sisi bingkai lawan & sudut datang dari kedua lensa. */
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

/**
 * Cahaya yang datang sangat miring (cos sudut datang < 0,08, ±85°) praktis tidak menerangi (< 8% terang tegak
 * lurus) dan batas bayangannya meloncat-loncat menyusuri permukaan - di zona blending dianggap tidak menyinari.
 */
const COS_MIN = 0.08;

/** Nama ringkas untuk label: tanpa akhiran "(blending)" template, "Proyektor 2" -> "P2". */
const pendek = (n: string) => n.replace(/\s*\(blending\)\s*/i, '').replace(/^Proyektor\s*(?=\d)/i, 'P').trim() || n;

/** Hasil sama (diabaikan titik label) -> keadaan tidak diperbarui, kanvas tidak digambar ulang berulang. */
const kunci = (h: Blending[]) => JSON.stringify(h.map(b => [b.a, b.b, b.namaA, b.namaB, b.arah, b.lebarM.toFixed(3), b.persenA.toFixed(1), b.persenB.toFixed(1)]));

export function gambarBlending(
  m: Mesin, data: DataBlend[],
  setInfo: (f: (v: Blending[]) => Blending[]) => void,
  /** Kartu keterangan detail (persen & piksel) ikut digambar. */ detail: boolean,
  /** Zona ungu & garis ukur digambar (false = hanya dihitung, mis. untuk ramp blending Sinar nyata). */ gambar = true,
): Blending[] {
  const { THREE, grupBantu } = m;
  const ray = new THREE.Raycaster(); ray.near = 0.03; ray.far = 80;
  const arah = new THREE.Vector3(), X = new THREE.Vector3();

  //  Titik permukaan benar-benar disinari proyektor ke-i: sinar dari lensanya tidak terhalang
  //  benda lain sebelum sampai ke titik itu (toleransi 5 cm). `abaikan` = mesh permukaan titik itu sendiri.
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

  //  FrontSide: zona hanya di sisi permukaan yang menghadap lensa (ikut tembus bersama dinding yang disembunyikan).
  const bahan = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.FrontSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const b of hasil) {
    const iA = data.findIndex(d => d.p.id === b.a), iB = data.findIndex(d => d.p.id === b.b);
    const A = data[iA], B = data[iB];
    if (!A || !B) continue;
    //  Zona: tiap segitiga yang tersinari A dipotong (Sutherland-Hodgman) oleh bingkai gambar B - fungsi batas
    //  |u| <= 0,5 & |v| <= 0,5 di koordinat lensa B - dan oleh cos sudut datang dari lensa A & B >= COS_MIN
    //  (ujung layar cembung membelakangi lensa / disinari sangat miring), semuanya diinterpolasi linear antar
    //  sudut sehingga tepinya halus. Terakhir hanya yang tidak terhalang benda lain dari lensa B.
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
