import type * as T from 'three';
import { tinggiOrangSah } from '../inti/orang';
import { type Konteks, mat } from './dasar';

function kapsul(THREE: typeof T, r: number, panjang: number, m: T.Material, x: number, y: number, z = 0) {
  const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, panjang), 6, 16), m);
  o.position.set(x, y, z);
  return o;
}

export function bangunOrang({ THREE, g, b, W }: Konteks) {
  const H = tinggiOrangSah(b.h);
  const baju = mat(THREE, W(0x5b7aa6), { roughness: 0.8 });
  const celana = mat(THREE, 0x334155, { roughness: 0.85 });
  const kulit = mat(THREE, 0xd8b190, { roughness: 0.7 });
  const sepatu = mat(THREE, 0x111827, { roughness: 0.5 });
  const rambut = mat(THREE, 0x1f2937, { roughness: 0.9 });

  const kepala = new THREE.Mesh(new THREE.SphereGeometry(H * 0.062, 24, 18), kulit);
  kepala.scale.set(0.9, 1.08, 0.98); kepala.position.set(0, H * 0.932, 0); g.add(kepala);
  const topi = new THREE.Mesh(new THREE.SphereGeometry(H * 0.064, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), rambut);
  topi.scale.set(0.92, 1.08, 1); topi.position.set(0, H * 0.938, -H * 0.004); g.add(topi);
  g.add(kapsul(THREE, H * 0.024, H * 0.03, kulit, 0, H * 0.862));

  const badan = kapsul(THREE, H * 0.072, H * 0.17, baju, 0, H * 0.7);
  badan.scale.set(1.62, 1, 0.92); g.add(badan);
  const pinggul = kapsul(THREE, H * 0.07, H * 0.04, celana, 0, H * 0.535);
  pinggul.scale.set(1.45, 1, 0.9); g.add(pinggul);

  for (const s of [-1, 1]) {
    g.add(kapsul(THREE, H * 0.043, H * 0.4, celana, s * H * 0.056, H * 0.29));
    const kaki = new THREE.Mesh(new THREE.BoxGeometry(H * 0.058, H * 0.035, H * 0.15), sepatu);
    kaki.position.set(s * H * 0.058, H * 0.018, H * 0.03); g.add(kaki);
    const lengan = kapsul(THREE, H * 0.031, H * 0.26, baju, s * H * 0.148, H * 0.645);
    lengan.rotation.z = s * 0.07; g.add(lengan);
    const tangan = new THREE.Mesh(new THREE.SphereGeometry(H * 0.03, 14, 10), kulit);
    tangan.scale.set(0.8, 1.15, 0.7); tangan.position.set(s * H * 0.158, H * 0.47, 0); g.add(tangan);
  }
}
