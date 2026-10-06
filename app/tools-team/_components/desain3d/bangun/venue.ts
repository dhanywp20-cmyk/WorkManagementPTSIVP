/**
 * desain3d/bangun/venue.ts - Venue: tribun bertingkat & panggung.
 * Model dibangun dengan alas di y = 0; ketinggian (elev) diterapkan lewat posisi grup.
 */
import type * as T from 'three';
import { barisTribun, kursiTribunPerBaris, type Benda } from '../inti';
import { type Konteks, kotak, mat, papan } from './dasar';
import { teksturKain, teksturKayu } from './permukaan';

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

/** tribun */
export function bangunTribun({ THREE, g, b, WS }: Konteks) {
  tribunModel(THREE, g, b, WS('#8b1e2b'));
}

/** panggung */
export function bangunPanggung({ THREE, g, b, warnaB }: Konteks) {
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
}
