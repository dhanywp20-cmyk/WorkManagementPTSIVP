import type * as T from 'three';
import { tinggiOrangSah } from '../inti/orang';
import { type Konteks, mat } from './dasar';

type Profil = [number, number][];

const TORSO_BAWAH: Profil = [[0.445, 0], [0.45, 0.035], [0.468, 0.072], [0.492, 0.09], [0.52, 0.096], [0.55, 0.097], [0.58, 0.093], [0.6, 0.09], [0.612, 0.089]];
const TORSO_ATAS: Profil = [
  [0.603, 0.0895], [0.62, 0.088], [0.65, 0.09], [0.69, 0.096], [0.73, 0.102], [0.77, 0.108], [0.795, 0.11],
  [0.81, 0.104], [0.822, 0.086], [0.832, 0.058], [0.84, 0.034], [0.846, 0],
];
const DALAM_TORSO: Profil = [[0.47, 0.7], [0.54, 0.68], [0.61, 0.62], [0.7, 0.68], [0.75, 0.66], [0.8, 0.56], [0.83, 0.72], [0.846, 1]];
const KERAH: Profil = [[0.828, 0.028], [0.831, 0.035], [0.842, 0.034], [0.853, 0.0315], [0.855, 0.027]];
const LEHER: Profil = [[0.826, 0], [0.828, 0.029], [0.85, 0.027], [0.872, 0.026], [0.876, 0]];
const KEPALA: Profil = [
  [0.862, 0], [0.864, 0.012], [0.87, 0.026], [0.882, 0.036], [0.898, 0.041], [0.918, 0.044], [0.94, 0.0455],
  [0.962, 0.0438], [0.98, 0.037], [0.992, 0.026], [0.999, 0.012], [1, 0],
];
const RAMBUT: Profil = [[0.922, 0.0442], [0.932, 0.0466], [0.945, 0.0482], [0.964, 0.0466], [0.982, 0.0395], [0.995, 0.0282], [1.003, 0.014], [1.006, 0]];
const TENGKUK: Profil = [[0.886, 0.0405], [0.9, 0.0438], [0.915, 0.046], [0.932, 0.0475], [0.945, 0.0482]];
const PAHA: Profil = [[0, 0], [0.004, 0.048], [0.05, 0.056], [0.14, 0.05], [0.21, 0.041], [0.235, 0.039], [0.3, 0.039], [0.37, 0.034], [0.43, 0.032], [0.445, 0.032], [0.446, 0]];
const LENGAN: Profil = [[0, 0], [0.012, 0.018], [0.04, 0.027], [0.1, 0.029], [0.3, 0.027], [0.47, 0.023], [0.56, 0.024], [0.75, 0.022], [0.96, 0.0185], [1, 0.0185], [1.002, 0]];

function nilaiDi(p: Profil, y: number) {
  if (y <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][0]) return p[i - 1][1] + ((p[i][1] - p[i - 1][1]) * (y - p[i - 1][0])) / (p[i][0] - p[i - 1][0]);
  }
  return p[p.length - 1][1];
}

function lathe(THREE: typeof T, p: Profil, H: number, opsi: { sudut?: [number, number]; dalam?: Profil | number } = {}) {
  const kurva = new THREE.SplineCurve(p.map(([y, r]) => new THREE.Vector2(r * H, y * H)));
  const [awal, panjang] = opsi.sudut ?? [Math.PI, Math.PI * 2];
  const geo = new THREE.LatheGeometry(kurva.getPoints(72), 48, awal, panjang);
  const d = opsi.dalam ?? 1;
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const k = typeof d === 'number' ? d : nilaiDi(d, pos.getY(i) / H);
    pos.setZ(i, pos.getZ(i) * k);
    const n = new THREE.Vector3(nor.getX(i), nor.getY(i), nor.getZ(i) / k).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return geo;
}

function ruas(THREE: typeof T, p: Profil, a: T.Vector3, b: T.Vector3, pipih: number, m: T.Material) {
  const L = a.distanceTo(b);
  const geo = new THREE.LatheGeometry(new THREE.SplineCurve([...p].reverse().map(([t, r]) => new THREE.Vector2(r, -t * L))).getPoints(64), 36, Math.PI);
  geo.scale(1, 1, pipih);
  const o = new THREE.Mesh(geo, m);
  o.position.copy(a);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), b.clone().sub(a).normalize());
  return o;
}

function sepatu(THREE: typeof T, H: number, m: T.Material, sol: T.Material) {
  const s = new THREE.Shape();
  const P = (z: number, y: number) => [z * H, y * H] as const;
  s.moveTo(...P(-0.034, 0.006));
  s.lineTo(...P(0.1, 0.006));
  s.quadraticCurveTo(...P(0.124, 0.008), ...P(0.121, 0.022));
  s.quadraticCurveTo(...P(0.11, 0.034), ...P(0.07, 0.04));
  s.quadraticCurveTo(...P(0.03, 0.052), ...P(0.012, 0.062));
  s.lineTo(...P(-0.026, 0.06));
  s.quadraticCurveTo(...P(-0.04, 0.05), ...P(-0.039, 0.026));
  s.quadraticCurveTo(...P(-0.038, 0.01), ...P(-0.034, 0.006));
  const lebar = 0.04 * H, bevel = 0.007 * H;
  const geo = new THREE.ExtrudeGeometry(s, { depth: lebar, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 4, curveSegments: 14 });
  geo.translate(0, 0, -lebar / 2);
  geo.rotateY(-Math.PI / 2);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, m));
  const alas = new THREE.Mesh(new THREE.BoxGeometry(lebar + bevel * 1.6, 0.008 * H, 0.158 * H), sol);
  alas.position.set(0, 0.004 * H, 0.043 * H);
  g.add(alas);
  return g;
}

function tangan(THREE: typeof T, H: number, s: number, m: T.Material) {
  const g = new THREE.Group();
  const telapak = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), m);
  telapak.scale.set(0.012 * H, 0.034 * H, 0.024 * H);
  telapak.position.y = -0.03 * H;
  const jari = new THREE.Mesh(new THREE.CapsuleGeometry(0.0115 * H, 0.03 * H, 6, 16), m);
  jari.scale.set(0.85, 1, 1.75);
  jari.position.set(0, -0.068 * H, 0.002 * H);
  jari.rotation.x = 0.12;
  const jempol = new THREE.Mesh(new THREE.CapsuleGeometry(0.0062 * H, 0.026 * H, 6, 12), m);
  jempol.position.set(-s * 0.006 * H, -0.04 * H, 0.022 * H);
  jempol.rotation.set(0.35, 0, s * 0.25);
  g.add(telapak, jari, jempol);
  return g;
}

export function bangunOrang({ THREE, g, b, W }: Konteks) {
  const H = tinggiOrangSah(b.h);
  const V = (x: number, y: number, z = 0) => new THREE.Vector3(x * H, y * H, z * H);
  const kulit = mat(THREE, 0xc69a7c, { roughness: 0.62, metalness: 0 });
  const baju = mat(THREE, W(0x3f5d86), { roughness: 0.82, metalness: 0 });
  const celana = mat(THREE, 0x2b2f36, { roughness: 0.86, metalness: 0 });
  const kulitSepatu = mat(THREE, 0x2a1c14, { roughness: 0.38, metalness: 0.05 });
  const sol = mat(THREE, 0x151515, { roughness: 0.7, metalness: 0 });
  const rambut = mat(THREE, 0x1d1712, { roughness: 0.95, metalness: 0 });
  const ikat = mat(THREE, 0x161616, { roughness: 0.45, metalness: 0.2 });
  const tambah = (geo: T.BufferGeometry, m: T.Material, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.z = z * H;
    g.add(o);
    return o;
  };

  tambah(lathe(THREE, TORSO_BAWAH, H, { dalam: DALAM_TORSO }), celana);
  tambah(lathe(THREE, TORSO_ATAS, H, { dalam: DALAM_TORSO }), baju);
  const sabuk = new THREE.Mesh(new THREE.TorusGeometry(0.0895 * H, 0.0042 * H, 10, 48), ikat);
  sabuk.rotation.x = Math.PI / 2; sabuk.scale.set(1, 0.63, 1); sabuk.position.y = 0.604 * H; g.add(sabuk);
  tambah(lathe(THREE, LEHER, H, { dalam: 1.05 }), kulit, -0.004);
  tambah(lathe(THREE, KERAH, H, { dalam: 1.1 }), baju, -0.004);
  tambah(lathe(THREE, KEPALA, H, { dalam: 1.2 }), kulit, 0.004);
  const rambutGeo = lathe(THREE, RAMBUT, H, { dalam: 1.21 }).translate(0, -0.95 * H, 0).rotateX(-0.2).translate(0, 0.95 * H, 0.003 * H);
  tambah(rambutGeo, rambut);
  tambah(lathe(THREE, TENGKUK, H, { sudut: [Math.PI * 0.42, Math.PI * 1.16], dalam: 1.2 }), rambut, 0.003);
  const hidung = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), kulit);
  hidung.scale.set(0.0062 * H, 0.012 * H, 0.008 * H); hidung.position.set(0, 0.918 * H, 0.0575 * H); hidung.rotation.x = -0.2; g.add(hidung);

  for (const s of [-1, 1]) {
    const kaki = lathe(THREE, PAHA.map(([y, r]) => [0.5 - y, r] as [number, number]).reverse(), H, { dalam: 0.98 });
    g.add(new THREE.Mesh(kaki.translate(s * 0.05 * H, 0, 0), celana));
    const kakiSepatu = sepatu(THREE, H, kulitSepatu, sol);
    kakiSepatu.position.set(s * 0.052 * H, 0, 0.004 * H); kakiSepatu.rotation.y = s * 0.06; g.add(kakiSepatu);
    const telinga = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), kulit);
    telinga.scale.set(0.0055 * H, 0.015 * H, 0.0105 * H); telinga.position.set(s * 0.0445 * H, 0.924 * H, -0.002 * H); g.add(telinga);

    const bahu = V(s * 0.11, 0.805, -0.004), pergelangan = V(s * 0.119, 0.49, 0.012);
    g.add(ruas(THREE, LENGAN.map(([t, r]) => [t, r * H] as [number, number]), bahu, pergelangan, 0.96, baju));
    const manset = new THREE.Mesh(new THREE.TorusGeometry(0.0185 * H, 0.0024 * H, 8, 28), baju);
    manset.position.copy(pergelangan).add(V(0, 0.007)); manset.rotation.x = Math.PI / 2; manset.scale.set(1, 0.96, 1); g.add(manset);
    const t = tangan(THREE, H, s, kulit);
    t.position.copy(pergelangan); t.rotation.z = s * 0.04; g.add(t);
  }
}
