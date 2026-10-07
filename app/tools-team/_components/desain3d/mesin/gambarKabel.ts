import type * as T from 'three';
import type { JalurKabel } from '../inti';

/** Jari-jari tabung kabel di kanvas (m) - cukup tebal untuk terlihat dari jauh & di foto. */
const JARI = 0.014;

/**
 * Gambar jalur kabel sebagai tabung berwarna (warna legend), satu InstancedMesh per warna:
 * tiap ruas lurus = satu instance silinder, sendi = bola kecil supaya belokan tidak bercelah.
 * Bahan tanpa pencahayaan (MeshBasic) supaya warnanya persis sama dengan legend.
 */
export function gambarJalurKabel(THREE: typeof T, grup: T.Group, jalur: JalurKabel[]) {
  const perWarna = new Map<number, { ruas: [T.Vector3, T.Vector3][]; sendi: T.Vector3[] }>();
  for (const j of jalur) {
    const isi = perWarna.get(j.kabel.warna) ?? { ruas: [], sendi: [] };
    const p = j.titik.map(t => new THREE.Vector3(...t));
    for (let i = 1; i < p.length; i++) if (p[i].distanceToSquared(p[i - 1]) > 1e-8) isi.ruas.push([p[i - 1], p[i]]);
    isi.sendi.push(...p);
    perWarna.set(j.kabel.warna, isi);
  }
  const tabung = new THREE.CylinderGeometry(JARI, JARI, 1, 8, 1, true);
  const bola = new THREE.SphereGeometry(JARI, 8, 6);
  const atas = new THREE.Vector3(0, 1, 0), arah = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), mtx = new THREE.Matrix4();
  for (const [warna, { ruas, sendi }] of perWarna) {
    const bahan = new THREE.MeshBasicMaterial({ color: warna });
    const mTabung = new THREE.InstancedMesh(tabung, bahan, ruas.length);
    ruas.forEach(([a, b], i) => {
      arah.subVectors(b, a); const panjang = arah.length();
      q.setFromUnitVectors(atas, arah.normalize());
      mtx.compose(s.addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, panjang, 1));
      mTabung.setMatrixAt(i, mtx);
    });
    const mSendi = new THREE.InstancedMesh(bola, bahan, sendi.length);
    sendi.forEach((p, i) => mSendi.setMatrixAt(i, mtx.makeTranslation(p.x, p.y, p.z)));
    for (const m of [mTabung, mSendi]) { m.userData.kabel = true; m.renderOrder = 1; grup.add(m); }
  }
}
