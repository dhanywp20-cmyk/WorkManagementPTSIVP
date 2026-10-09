/**
 * desain3d/bangun/perangkat.ts - Perangkat sumber presentasi: PC (monitor berkaki, CPU tower,
 * keyboard, mouse), HP & tablet; laptop di laptop.ts, dongle WyreStorm di dongle.ts. Bentuk membulat, bukan kotak.
 * Alas di y = 0, +z = arah hadap (sisi pengguna). Ukuran mengikuti b.w / b.h / b.d.
 */
import { tipePerangkatDari } from '../inti';
import { blok, type Konteks, mat, papan } from './dasar';
import { modelDongle } from './dongle';
import { bidangBulat, layar, tuts } from './bantuPerangkat';
import { laptop } from './laptop';
import { teksturDesktop, teksturHomeScreen } from './teksturPerangkat';

function pc({ THREE, g, b, W }: Konteks) {
  const { w, d } = b, mati = b.konten === 'mati';
  const gelap = mat(THREE, W(0x24272c), { roughness: 0.45, metalness: 0.35 });
  const hitam = mat(THREE, 0x0d0f12, { roughness: 0.3, metalness: 0.2 });
  //  Monitor 24": alas oval, tiang, panel tipis berlayar.
  const xM = -w / 2 + 0.29, zM = -d / 2 + 0.11;
  g.add(papan(THREE, 0.24, 0.17, 0.008, 0.07, gelap, 0.003).translateX(xM).translateZ(zM));
  g.add(blok(THREE, 0.045, 0.2, 0.022, 0.01, gelap, 0.004).translateX(xM).translateY(0.006).translateZ(zM - 0.03));
  const panel = new THREE.Group();
  panel.add(blok(THREE, 0.545, 0.33, 0.02, 0.006, hitam, 0.003));
  panel.add(layar(THREE, 0.528, 0.297, 0.002, mati, () => teksturDesktop(THREE, 0.528 / 0.297)).translateY(0.175).translateZ(0.0105));
  panel.position.set(xM, 0.125, zM - 0.008); panel.rotation.x = -0.06; g.add(panel);
  //  CPU tower di kanan: badan gelap, muka kaca hitam, lampu daya.
  const xT = w / 2 - 0.1, dT = Math.min(0.38, d * 0.76), zT = -d / 2 + dT / 2;
  g.add(blok(THREE, 0.19, 0.42, dT, 0.012, gelap, 0.004).translateX(xT).translateZ(zT));
  g.add(bidangBulat(THREE, 0.17, 0.4, 0.01, hitam).translateX(xT).translateY(0.21).translateZ(zT + dT / 2 + 0.0008));
  const lampu = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0012, 8, 24), mat(THREE, 0x22d3ee, { emissive: 0x22d3ee, emissiveIntensity: 1.2 }));
  lampu.position.set(xT, 0.38, zT + dT / 2 + 0.0015); g.add(lampu);
  //  Keyboard & mouse di depan monitor.
  const zK = d / 2 - 0.09;
  g.add(papan(THREE, 0.44, 0.135, 0.012, 0.01, gelap, 0.003).translateX(xM).translateZ(zK));
  g.add(tuts(THREE, 0.42, 0.115, 18, 6, 0.012, zK, mat(THREE, 0x15171a, { roughness: 0.8 })).translateX(xM));
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), gelap);
  mouse.scale.set(0.031, 0.02, 0.054); mouse.position.set(xM + 0.3, 0, zK + 0.01); g.add(mouse);
}

/** HP / tablet tergeletak di meja, layar menghadap ke atas. */
function genggam({ THREE, g, b, W }: Konteks, tablet: boolean) {
  const { w, d, h } = b, mati = b.konten === 'mati';
  const r = tablet ? 0.014 : 0.011;
  g.add(papan(THREE, w, d, h, r, mat(THREE, W(0x2a2d33), { metalness: 0.8, roughness: 0.3 }), Math.min(0.002, h / 3)));
  const kaca = bidangBulat(THREE, w - 0.002, d - 0.002, r - 0.001, mat(THREE, 0x050608, { roughness: 0.08, metalness: 0.3 }));
  kaca.rotation.x = -Math.PI / 2; kaca.position.y = h + 0.0002; g.add(kaca);
  const tepi = tablet ? 0.012 : 0.003;
  const lw = w - 2 * tepi, ld = d - 2 * tepi - (tablet ? 0 : 0.004);
  //  Atas layar ke arah -z: HP tegak (portrait), tablet mendatar (landscape, rasio > 1).
  const isi = layar(THREE, lw, ld, r - tepi * 0.6, mati, () => teksturHomeScreen(THREE, lw / ld));
  isi.rotation.x = -Math.PI / 2; isi.position.y = h + 0.0004; g.add(isi);
  const kam = new THREE.Mesh(new THREE.CircleGeometry(tablet ? 0.0025 : 0.0018, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  kam.rotation.x = -Math.PI / 2;
  kam.position.set(0, h + 0.0006, -d / 2 + (tablet ? tepi / 2 : 0.008));
  g.add(kam);
}

/** perangkat */
export function bangunPerangkat(k: Konteks) {
  const t = tipePerangkatDari(k.b);
  if (t === 'pc') pc(k);
  else if (t === 'laptop') laptop(k);
  else if (t === 'dongle') k.g.add(modelDongle(k.THREE, k.b.d, k.warnaB ? k.W(0x3a3c41) : undefined));
  else genggam(k, t === 'tablet');
}
