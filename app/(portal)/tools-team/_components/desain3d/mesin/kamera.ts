/** Perhitungan kamera murni: posisi pas memuat kotak, animasi terbang, batas dunia. */
import { daftarRuang, type Ruang } from '../inti';
import type * as T from 'three';
import type { Mesin } from './tipe';

/**
 * Posisi kamera searah `arah` dari `target` yang memuat seluruh `kotak` di
 * kanvas. Tepat untuk perspektif: tiap pojok kotak harus masuk kerucut
 * pandang, yaitu jarak >= (kedalaman pojok ke arah kamera) + (simpangan
 * kanan/atas pojok ÷ tan setengah FOV).
 */
export function posisiPas(m: Mesin, target: T.Vector3, arah: T.Vector3, kotak: T.Box3, longgar = 1.06) {
  const { THREE, kamera } = m;
  const maju = arah.clone().negate();
  const kanan = new THREE.Vector3().crossVectors(maju, kamera.up).normalize();
  const atas = new THREE.Vector3().crossVectors(kanan, maju).normalize();
  const tanV = Math.tan((kamera.fov * Math.PI) / 360), tanH = tanV * Math.max(0.3, kamera.aspect);
  let jarak = 0;
  for (const x of [kotak.min.x, kotak.max.x]) for (const y of [kotak.min.y, kotak.max.y]) for (const z of [kotak.min.z, kotak.max.z]) {
    const v = new THREE.Vector3(x, y, z).sub(target);
    jarak = Math.max(jarak, v.dot(arah) + Math.max(Math.abs(v.dot(kanan)) / tanH, Math.abs(v.dot(atas)) / tanV) * longgar);
  }
  return target.clone().addScaledVector(arah, Math.max(1, jarak));
}

/** Pindahkan kamera (beranimasi, kecuali `langsung`). */
export function terbangKe(m: Mesin, pos: T.Vector3, target: T.Vector3, langsung = false) {
  if (langsung) {
    m.terbang = null; m.kamera.position.copy(pos); m.orbit.target.copy(target); m.orbit.update();
    return;
  }
  const { Spherical } = m.THREE;
  m.terbang = {
    t0: m.orbit.target.clone(), t1: target.clone(),
    s0: new Spherical().setFromVector3(m.kamera.position.clone().sub(m.orbit.target)),
    s1: new Spherical().setFromVector3(pos.clone().sub(target)),
    mulai: performance.now(), durasi: 600,
  };
}

/** Batas dunia (gabungan ruang). */
export function batasDunia(r: Ruang) {
  const k = daftarRuang(r);
  return { x: k.reduce((m, x) => Math.max(m, x.x0 + x.p), 0), z: k.reduce((m, x) => Math.max(m, x.l), 0), t: k.reduce((m, x) => Math.max(m, x.t), 0) };
}
