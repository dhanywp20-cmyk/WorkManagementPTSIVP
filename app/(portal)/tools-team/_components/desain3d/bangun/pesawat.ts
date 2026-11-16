import type * as T from 'three';
import { type Benda, PESAWAT_ACUAN } from '../inti';
import { mat } from './dasar';

const PROFIL_BADAN: [number, number][] = [
  [0.02, -1.38], [0.2, -1.32], [0.34, -1.2], [0.45, -1.0], [0.52, -0.68], [0.55, -0.3], [0.54, 0.2], [0.48, 0.6], [0.36, 1.0], [0.22, 1.3], [0.08, 1.47], [0.01, 1.5],
];
const SUMBU_Y = 0.8;

function papan(THREE: typeof T, titik: [number, number][], tebal: number, m: T.Material) {
  const s = new THREE.Shape(titik.map(([a, b]) => new THREE.Vector2(a, b)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: tebal, bevelEnabled: false });
  geo.translate(0, 0, -tebal / 2);
  return new THREE.Mesh(geo, m);
}

export function bangunPesawat(THREE: typeof T, g: T.Group, b: Benda, warna: number) {
  const A = PESAWAT_ACUAN;
  const akar = new THREE.Group();
  akar.scale.set(b.w / A.w, b.h / A.h, b.d / A.d);
  g.add(akar);
  const badan = new THREE.MeshStandardMaterial({ color: warna, roughness: 0.45, metalness: 0.15 });
  const aksen = mat(THREE, 0x1e3a8a, { roughness: 0.5, metalness: 0.2 });
  const gelap = mat(THREE, 0x1f2937, { roughness: 0.7, metalness: 0.3 });
  const kaca = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.38, depthWrite: false });

  const alas = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 2.2), gelap);
  alas.position.set(0, 0.125, 0.1); akar.add(alas);

  const lathe = new THREE.LatheGeometry(PROFIL_BADAN.map(([r, z]) => new THREE.Vector2(r, z)), 40);
  lathe.rotateX(Math.PI / 2); lathe.translate(0, SUMBU_Y, 0);
  akar.add(new THREE.Mesh(lathe, badan));

  const kanopi = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), kaca);
  kanopi.scale.set(0.84, 0.86, 1.25); kanopi.position.set(0, SUMBU_Y + 0.42, -0.25);
  kanopi.userData.tanpaBayangan = true; akar.add(kanopi);
  const rangka = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 6, 24, Math.PI), gelap);
  rangka.position.set(0, SUMBU_Y + 0.42, -0.25); akar.add(rangka);

  for (const sisi of [-1, 1]) {
    const sayap = papan(THREE, [[0, -0.05], [0.9, 0.12], [0.9, 0.42], [0, 0.55]], 0.06, badan);
    sayap.rotation.x = Math.PI / 2; sayap.scale.x = sisi; sayap.position.set(0, 0.6, 0); akar.add(sayap);
    const ujung = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.3), aksen);
    ujung.position.set(sisi * 0.88, 0.6, 0.27); akar.add(ujung);
    const ekor = papan(THREE, [[0, 1.12], [0.45, 1.26], [0.45, 1.42], [0, 1.46]], 0.04, badan);
    ekor.rotation.x = Math.PI / 2; ekor.scale.x = sisi; ekor.position.set(0, SUMBU_Y + 0.06, 0); akar.add(ekor);
  }
  const sirip = papan(THREE, [[0.85, 0.3], [1.48, 0], [1.48, 0.95], [1.25, 0.95]], 0.05, aksen);
  sirip.rotation.y = -Math.PI / 2; sirip.position.set(0, SUMBU_Y, 0); akar.add(sirip);

  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.18, 24), gelap);
  spinner.rotation.x = -Math.PI / 2; spinner.position.set(0, SUMBU_Y, -1.4); akar.add(spinner);
  const baling = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.025), gelap);
  baling.rotation.z = Math.PI / 5; baling.position.set(0, SUMBU_Y, -1.38); akar.add(baling);
}
