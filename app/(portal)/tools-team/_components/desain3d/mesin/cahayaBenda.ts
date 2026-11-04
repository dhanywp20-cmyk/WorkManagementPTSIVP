import type * as T from 'three';
import { keGambar, type Lensa } from '../inti';
import type { Mesin } from './tipe';

export interface SumberCahaya {
  O: T.Vector3; L: Lensa; sasaran: T.Object3D[];
   kuat: number;
   warna: [number, number, number];
}

const MAKS_SEGITIGA = 6000, MAKS_SEGITIGA_KASAR = 1200, MAKS_RAYCAST = 15000;

export function gambarCahayaBenda(m: Mesin, sumber: SumberCahaya[], akar: T.Object3D[], kasar: boolean) {
  const { THREE, grupBantu } = m;
  if (!sumber.length || !akar.length) return;
  const ray = new THREE.Raycaster(); ray.near = 0.03;
  const arah = new THREE.Vector3(), keLensa = new THREE.Vector3();
  let sisaRaycast = kasar ? 0 : MAKS_RAYCAST;
  const cacheTerlihat = new Map<string, boolean>();

  const terlihat = (si: number, P: T.Vector3, jarak: number) => {
    const kunci = `${si}|${P.x.toFixed(3)}|${P.y.toFixed(3)}|${P.z.toFixed(3)}`;
    const ada = cacheTerlihat.get(kunci);
    if (ada !== undefined) return ada;
    if (sisaRaycast <= 0) return true;
    sisaRaycast--;
    const s = sumber[si];
    ray.set(s.O, arah.copy(P).sub(s.O).divideScalar(jarak)); ray.far = jarak + 0.1;
    const hit = ray.intersectObjects(s.sasaran, true).find(h => {
      const o = h.object as T.Mesh;
      if (!o.isMesh) return false;
      const mt = (Array.isArray(o.material) ? o.material[0] : o.material) as T.Material & { opacity?: number };
      return !(mt?.transparent && (mt.opacity ?? 1) < 0.6);
    });
    const hasil = !hit || hit.distance >= jarak - (0.02 + jarak * 0.004);
    cacheTerlihat.set(kunci, hasil);
    return hasil;
  };
  const terang = (P: T.Vector3, N: T.Vector3): [number, number, number] => {
    const t: [number, number, number] = [0, 0, 0];
    sumber.forEach((s, si) => {
      const k = keGambar(s.L, [P.x, P.y, P.z]);
      if (!k || Math.abs(k.u) > 0.5 || Math.abs(k.v) > 0.5) return;
      const jarak = keLensa.copy(s.O).sub(P).length();
      const cos = keLensa.dot(N) / jarak;
      if (cos <= 0.02 || !terlihat(si, P, jarak)) return;
      const c = s.kuat * (0.35 + 0.65 * cos);
      for (let i = 0; i < 3; i++) t[i] += s.warna[i] * c;
    });
    return [Math.min(1.3, t[0]), Math.min(1.3, t[1]), Math.min(1.3, t[2])];
  };

  const pos: number[] = [], warna: number[] = [];
  const OPASITAS = 0.34;
  const nm = new THREE.Matrix3();
  for (const a of akar) {
    a.traverse(o => {
      const mesh = o as T.Mesh;
      if (!mesh.isMesh || !mesh.visible || mesh.userData.kabel) return;
      const mt = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as T.Material & { opacity?: number };
      if (mt?.transparent && (mt.opacity ?? 1) < 0.6) return;
      const g0 = mesh.geometry as T.BufferGeometry;
      if (!g0?.attributes?.position) return;
      let g = g0.index ? g0.toNonIndexed() : g0;
      if (!g.attributes.normal) { if (g === g0) g = g0.clone(); g.computeVertexNormals(); }
      nm.getNormalMatrix(mesh.matrixWorld);
      const P = g.attributes.position, Nn = g.attributes.normal;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const skala = mesh.matrixWorld.getMaxScaleOnAxis();
      const maksSisi = Math.min(0.3, Math.max(0.04, ((g.boundingSphere?.radius ?? 0.5) * skala * 2) / 12));
      type Sg = [T.Vector3, T.Vector3, T.Vector3, T.Vector3, T.Vector3, T.Vector3];
      const antre: Sg[] = [];
      for (let i = 0; i + 2 < P.count; i += 3) {
        const v = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(P, i + k).applyMatrix4(mesh.matrixWorld));
        const n = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(Nn, i + k).applyMatrix3(nm).normalize());
        antre.push([v[0], v[1], v[2], n[0], n[1], n[2]]);
      }
      if (g !== g0) g.dispose();
      const anggaran = kasar ? MAKS_SEGITIGA_KASAR : MAKS_SEGITIGA;
      const jadi: Sg[] = [];
      while (antre.length) {
        const s = antre.pop()!;
        const sisi = [s[0].distanceTo(s[1]), s[1].distanceTo(s[2]), s[2].distanceTo(s[0])];
        const e = sisi.indexOf(Math.max(...sisi));
        if (sisi[e] <= maksSisi || jadi.length + antre.length >= anggaran) { jadi.push(s); continue; }
        const a1 = e, b1 = (e + 1) % 3;
        const tv = s[a1].clone().lerp(s[b1], 0.5), tn = s[a1 + 3].clone().add(s[b1 + 3]).normalize();
        const satu: Sg = [s[0], s[1], s[2], s[3], s[4], s[5]], dua: Sg = [s[0], s[1], s[2], s[3], s[4], s[5]];
        satu[b1] = tv; satu[b1 + 3] = tn; dua[a1] = tv; dua[a1 + 3] = tn;
        antre.push(satu, dua);
      }
      for (const s of jadi) {
        const t = [0, 1, 2].map(k => terang(s[k], s[k + 3]));
        if (t.every(x => x[0] + x[1] + x[2] <= 0)) continue;
        for (let k = 0; k < 3; k++) {
          pos.push(s[k].x + s[k + 3].x * 0.003, s[k].y + s[k + 3].y * 0.003, s[k].z + s[k + 3].z * 0.003);
          warna.push(t[k][0] * OPASITAS, t[k][1] * OPASITAS, t[k][2] * OPASITAS);
        }
      }
    });
  }
  if (!pos.length) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(warna, 3));
  const lapis = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  lapis.renderOrder = 2; grupBantu.add(lapis);
}
