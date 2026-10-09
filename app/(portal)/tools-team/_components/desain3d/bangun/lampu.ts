/**
 * desain3d/bangun/lampu.ts - Lampu plafon: downlight, spot, panel, linear, gantung dekoratif.
 * Model dibangun dengan alas di y = 0; ketinggian (elev) diterapkan lewat posisi grup.
 */
import type * as T from 'three';
import { sudutLampuDari, warnaKelvin } from '../inti';
import { teksturKolamCahaya } from './tekstur';
import { batang, type Konteks, kotak, mat } from './dasar';

/** lampu */
export function bangunLampu({ THREE, g, b, W }: Konteks) {
  //  Lampu plafon: rumah lampu + permukaan menyala (emisif, ikut dimmer) + kolam cahaya di lantai.
  const tipe = b.tipeLampu ?? 'downlight', warnaC = warnaKelvin(b.kelvin);
  const nyala = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: warnaC, emissiveIntensity: 1.6, roughness: 0.4 });
  nyala.userData.dasar = 1.6;
  const rumah = mat(THREE, W(tipe === 'linear' ? 0x2b2f36 : 0xf4f5f7), { metalness: tipe === 'linear' ? 0.6 : 0.2, roughness: 0.4 });
  const tandai = (m: T.Mesh) => { m.userData.cahaya = true; return m; };
  if (tipe === 'downlight' || tipe === 'spot') {
    const rr = b.w / 2;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.012, 32), rumah).translateY(b.h - 0.006));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.78, rr * 0.7, b.h - 0.012, 32), mat(THREE, tipe === 'spot' ? 0x111318 : 0xe5e7eb, { roughness: 0.5 })).translateY((b.h - 0.012) / 2));
    const muka = tandai(new THREE.Mesh(new THREE.CircleGeometry(rr * (tipe === 'spot' ? 0.4 : 0.66), 32), nyala));
    muka.rotation.x = Math.PI / 2; muka.position.y = 0.002; g.add(muka);
  } else if (tipe === 'panel') {
    g.add(kotak(THREE, b.w, b.h, b.d, rumah, 0, b.h / 2, 0));
    const muka = tandai(new THREE.Mesh(new THREE.PlaneGeometry(b.w - 0.03, b.d - 0.03), nyala));
    muka.rotation.x = Math.PI / 2; muka.position.y = -0.001; g.add(muka);
  } else if (tipe === 'gantung') {
    //  Pendant dekoratif: kap kubah logam gelap (dalam keemasan), bohlam menyala, kabel ke plafon.
    const kap = mat(THREE, W(0x1f2328), { metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide });
    const dalam = mat(THREE, 0xd4a35a, { metalness: 0.8, roughness: 0.3, side: THREE.BackSide });
    const rr = b.w / 2, profil: [number, number][] = [];
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * (Math.PI / 2); profil.push([Math.max(0.012, rr * Math.sin(a)), b.h * Math.cos(a) * 0.85 + 0.03]); }
    const bentuk = profil.map(([x, y]) => new THREE.Vector2(x, y));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(bentuk, 40), kap));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(bentuk, 40), dalam));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.05, 16), kap).translateY(b.h * 0.85 + 0.05));
    const bohlam = tandai(new THREE.Mesh(new THREE.SphereGeometry(rr * 0.22, 20, 12), nyala));
    bohlam.position.y = 0.06; g.add(bohlam);
    g.add(batang(THREE, 0.006, 0.006, mat(THREE, 0x111111), 0, 0, 'tiang', 0, true));
  } else {
    g.add(kotak(THREE, b.w, b.h, b.d, rumah, 0, b.h / 2, 0));
    const muka = tandai(new THREE.Mesh(new THREE.PlaneGeometry(b.w - 0.02, b.d * 0.6), nyala));
    muka.rotation.x = Math.PI / 2; muka.position.y = -0.001; g.add(muka);
    const kawat = mat(THREE, 0x9ca3af, { metalness: 0.9, roughness: 0.3 });
    for (const sx of [-1, 1]) g.add(batang(THREE, 0.004, 0.004, kawat, sx * (b.w / 2 - 0.1), 0, 'tiang', 0, true));
  }
  //  Kolam cahaya di lantai (aditif, tidak menghalangi sinar proyektor).
  const jari = Math.max(0.3, Math.min(3, b.elev * Math.tan((sudutLampuDari(b) / 2) * (Math.PI / 180))));
  const kolamTex = teksturKolamCahaya(THREE);
  const kolam = new THREE.Mesh(new THREE.PlaneGeometry(jari * 2 + (tipe === 'linear' ? b.w : 0), jari * 2),
    new THREE.MeshBasicMaterial({ map: kolamTex, color: warnaC, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  kolam.rotation.x = -Math.PI / 2; kolam.position.y = 0.006;
  kolam.userData.cahaya = true; (kolam.material as T.MeshBasicMaterial).userData.dasar = 0.16;
  const lantai = new THREE.Group(); lantai.userData.peran = 'lantai'; lantai.add(kolam); g.add(lantai);
}
