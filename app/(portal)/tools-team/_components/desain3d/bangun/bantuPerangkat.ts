/** desain3d/bangun/bantuPerangkat.ts - Bagian bersama model perangkat: bidang layar membulat (UV 0..1), deret tuts, layar menyala/mati. */
import type * as T from 'three';
import { persegiBulat } from './dasar';

/** Bidang bersudut membulat (tampak depan, menghadap +z) dengan UV 0..1 - layar perangkat. */
export function bidangBulat(THREE: typeof T, w: number, h: number, r: number, m: T.Material) {
  const geo = new THREE.ShapeGeometry(persegiBulat(THREE, w, h, r), 10);
  const uv = geo.attributes.uv as T.BufferAttribute, pos = geo.attributes.position as T.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return new THREE.Mesh(geo, m);
}

/** Deret tuts (InstancedMesh) di bidang w x d, alas y. */
export function tuts(THREE: typeof T, w: number, d: number, kol: number, bar: number, y: number, z: number, m: T.Material) {
  const sx = w / kol, sz = d / bar;
  const geo = new THREE.BoxGeometry(sx * 0.82, 0.0018, sz * 0.8);
  geo.translate(0, 0.0009, 0);
  const n = new THREE.InstancedMesh(geo, m, kol * bar), mx = new THREE.Matrix4();
  for (let j = 0; j < bar; j++) for (let i = 0; i < kol; i++) {
    //  Baris terdepan: spasi panjang di tengah (tuts lain tetap).
    mx.makeTranslation(-w / 2 + sx * (i + 0.5), y, z - d / 2 + sz * (j + 0.5));
    if (j === bar - 1 && i > kol * 0.3 && i < kol * 0.7) mx.scale(new THREE.Vector3(i === Math.round(kol / 2) ? kol * 0.4 / 0.82 : 0, 1, 1));
    n.setMatrixAt(j * kol + i, mx);
  }
  return n;
}

/** Layar menyala (atau mati) seukuran w x h menghadap +z. */
export function layar(THREE: typeof T, w: number, h: number, r: number, mati: boolean, tex: () => T.Texture) {
  const m = mati ? new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.15, metalness: 0.2 })
    : new THREE.MeshBasicMaterial({ map: tex(), toneMapped: false });
  return bidangBulat(THREE, w, h, r, m);
}
