/**
 * desain3d/bangun/laptop.ts - Laptop tipis aluminium bergaya ultrabook (acuan foto owner):
 * alas tipis bertepi membulat halus, area keyboard terbenam abu gelap + tuts hitam (baris fungsi
 * pendek), grill speaker berlubang di kiri-kanan keyboard, trackpad besar, cekungan jempol di depan,
 * tutup tipis berkaca hitam & bingkai tipis, engsel gelap, terbuka ±112°. Dongle WyreStorm opsional.
 * Alas di y = 0, +z = sisi pengguna; ukuran dari b.w x b.d.
 */
import type * as T from 'three';
import type { Konteks } from './dasar';
import { blok, mat, papan } from './dasar';
import { bidangBulat, layar, tuts } from './bantuPerangkat';
import { modelDongle } from './dongle';
import { teksturDesktop } from './teksturPerangkat';

/** Grill speaker: titik-titik lubang kecil rapat. */
function teksturGrill(THREE: typeof T): T.Texture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#9a9da3'; g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#2b2d31';
  for (let y = 4; y < 256; y += 8) for (let x = (y / 8) % 2 ? 8 : 4; x < 64; x += 8) { g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function laptop({ THREE, g, b, W }: Konteks) {
  const { w, d } = b, tb = 0.0145, mati = b.konten === 'mati';
  const alu = new THREE.MeshPhysicalMaterial({ color: W(0xcfd2d7), metalness: 0.82, roughness: 0.3, clearcoat: 0.25, clearcoatRoughness: 0.35 });
  const aluGelap = mat(THREE, W(0xb4b7bd), { metalness: 0.7, roughness: 0.32 });
  const hitam = new THREE.MeshPhysicalMaterial({ color: 0x08090b, roughness: 0.08, metalness: 0.2, clearcoat: 1 });

  //  Alas: tepi membulat halus (bevel bersegmen banyak).
  g.add(papan(THREE, w, d, tb, 0.011, alu, 0.0045, 8));

  //  Area keyboard terbenam + tuts: baris fungsi pendek, lima baris penuh, spasi panjang.
  const lKb = w * 0.79, dKb = d * 0.42, zKb = -d / 2 + 0.016 + dKb / 2;
  g.add(papan(THREE, lKb, dKb, 0.0005, 0.004, mat(THREE, 0x56595f, { roughness: 0.6 }), 0.0001).translateY(tb - 0.0004).translateZ(zKb));
  const tutsHitam = mat(THREE, 0x16171a, { roughness: 0.7 });
  const dFungsi = dKb * 0.11;
  g.add(tuts(THREE, lKb * 0.97, dFungsi, 14, 1, tb - 0.0002, zKb - dKb / 2 + dFungsi / 2 + dKb * 0.02, tutsHitam));
  const dUtama = dKb * 0.84;
  g.add(tuts(THREE, lKb * 0.97, dUtama, 14, 5, tb - 0.0002, zKb + dKb / 2 - dUtama / 2 - dKb * 0.02, tutsHitam));

  //  Grill speaker di kiri & kanan keyboard.
  const grill = new THREE.MeshStandardMaterial({ map: teksturGrill(THREE), roughness: 0.6, metalness: 0.4 });
  for (const sx of [-1, 1]) {
    const p = bidangBulat(THREE, w * 0.06, dKb, 0.003, grill);
    p.rotation.x = -Math.PI / 2; p.position.set(sx * (lKb / 2 + w * 0.045), tb + 0.0002, zKb); g.add(p);
  }

  //  Trackpad besar, rata dengan permukaan.
  const lTp = w * 0.46, dTp = d * 0.34;
  g.add(papan(THREE, lTp, dTp, 0.0004, 0.008, aluGelap, 0.0001).translateY(tb - 0.0002).translateZ(d / 2 - 0.011 - dTp / 2));

  //  Cekungan jempol di tepi depan tengah: lekukan tipis rata di muka depan (bukan tonjolan).
  const cekung = bidangBulat(THREE, 0.034, 0.0042, 0.0021, mat(THREE, 0x9ea2a9, { metalness: 0.7, roughness: 0.35 }));
  cekung.position.set(0, tb * 0.62, d / 2 + 0.0003); g.add(cekung);

  //  Engsel gelap di belakang.
  const engsel = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, w * 0.8, 24), mat(THREE, 0x2a2b2f, { roughness: 0.4, metalness: 0.6 }));
  engsel.rotation.z = Math.PI / 2; engsel.position.set(0, tb + 0.0012, -d / 2 + 0.006); g.add(engsel);

  //  Tutup: punggung aluminium, muka kaca hitam, layar dengan bingkai tipis (dagu bawah sedikit lebih lebar).
  const lh = d * 0.97, tebal = 0.0048, tutup = new THREE.Group();
  tutup.add(blok(THREE, w, lh, tebal, 0.011, alu, 0.0018, 6));
  tutup.add(bidangBulat(THREE, w - 0.0016, lh - 0.0016, 0.0102, hitam).translateY(lh / 2).translateZ(tebal / 2 + 0.0002));
  const lL = w * 0.955, hL = lh * 0.9;
  tutup.add(layar(THREE, lL, hL, 0.0025, mati, () => teksturDesktop(THREE, lL / hL)).translateY(lh * 0.53).translateZ(tebal / 2 + 0.0004));
  tutup.position.set(0, tb + 0.0012, -d / 2 + 0.006); tutup.rotation.x = -0.39; g.add(tutup);

  if (b.pakaiDongle) {
    //  Dongle WyreStorm tertancap di port USB-C sisi kanan, tergeletak di meja.
    const dg = modelDongle(THREE);
    dg.rotation.y = Math.PI / 2; dg.position.set(w / 2 + 0.085 - 0.007, 0, -d * 0.12); g.add(dg);
  }
}
