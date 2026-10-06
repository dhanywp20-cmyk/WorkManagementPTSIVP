/**
 * desain3d/bangun/display.ts - Display & proyektor: videowall, TV / signage, IFP, LED videotron, layar & proyektor, beserta pemasangannya (bracket pop-up, struktur hollow, standfloor).
 * Model dibangun dengan alas di y = 0; ketinggian (elev) diterapkan lewat posisi grup.
 */
import type * as T from 'three';
import { engselProyektor, lensaDatar, pasangDari, spekVideowall, tiltDari, type Benda } from '../inti';
import { teksturGrid } from './tekstur';
import { batang, blok, diLantai, type Konteks, kotak, mat, papan, pelatAntara, tiangAntara } from './dasar';
import { teksturBerlubang, teksturGril } from './permukaan';

/**
 * Bracket pop-out videowall (mengikuti foto referensi owner): rangka dinding = rel atas & bawah
 * berlubang + dua tegak samping; rangka depan (menempel punggung display) = dua tiang tegak
 * berlubang, palang atas & bawah lebar berlubang, palang tengah berpelat, blok pengunci di
 * atas tiang; di kiri & kanan lengan gunting X (dengan baut poros) menghubungkan keduanya;
 * kenop T penyetel di atas palang atas dan di ujung palang bawah. Semua hitam.
 * Celah punggung display ke dinding = CELAH_PASANG.dinding (10 cm).
 */
function bracketPopOut(THREE: typeof T, lebar: number, tinggi: number, x: number, yTengah: number, zPunggung: number): T.Group {
  const g = new THREE.Group();
  const hitam = mat(THREE, 0x1a1d22, { metalness: 0.55, roughness: 0.45 });
  const kenop = mat(THREE, 0x0b0c0f, { roughness: 0.6 });
  const baut = mat(THREE, 0x9ca3af, { metalness: 0.85, roughness: 0.3 });
  const berlubang = (tegak: boolean, panjang: number) =>
    new THREE.MeshStandardMaterial({ map: teksturBerlubang(THREE, tegak, panjang), metalness: 0.55, roughness: 0.45 });
  const zDinding = zPunggung - 0.1;
  const W = Math.max(0.24, Math.min(0.62, lebar * 0.55)), H = Math.max(0.2, Math.min(0.5, tinggi * 0.62));
  const yA = yTengah + H / 2, yB = yTengah - H / 2;
  //  Rangka dinding.
  for (const y of [yA - 0.025, yB + 0.025]) g.add(kotak(THREE, W + 0.06, 0.05, 0.008, berlubang(false, W + 0.06), x, y, zDinding + 0.004));
  for (const sx of [-1, 1]) g.add(kotak(THREE, 0.035, H, 0.012, berlubang(true, H), x + sx * (W / 2 - 0.018), yTengah, zDinding + 0.01));
  //  Rangka depan.
  const xT = W * 0.36, zD = zPunggung - 0.011;
  for (const sx of [-1, 1]) {
    g.add(kotak(THREE, 0.05, H + 0.1, 0.022, berlubang(true, H + 0.1), x + sx * xT, yTengah, zD));
    g.add(kotak(THREE, 0.075, 0.04, 0.034, hitam, x + sx * xT, yA - 0.03, zD - 0.02));          // blok pengunci
  }
  const lebarDepan = W + 0.12;
  g.add(kotak(THREE, lebarDepan, 0.045, 0.01, berlubang(false, lebarDepan), x, yA + 0.025, zPunggung - 0.005));
  g.add(kotak(THREE, lebarDepan, 0.045, 0.01, berlubang(false, lebarDepan), x, yB - 0.025, zPunggung - 0.005));
  g.add(kotak(THREE, xT * 2, 0.05, 0.012, hitam, x, yTengah + H * 0.06, zD - 0.016));                 // palang tengah
  g.add(kotak(THREE, 0.12, 0.085, 0.01, hitam, x, yTengah + H * 0.06, zD - 0.024));                   // pelat tengah
  //  Lengan gunting X kiri & kanan (bidang y-z, di sisi dalam tiang depan).
  for (const sx of [-1, 1]) {
    const xa = x + sx * (xT - 0.04);
    const atasD = new THREE.Vector3(xa, yA - 0.05, zDinding + 0.02), bawahD = new THREE.Vector3(xa, yB + 0.05, zDinding + 0.02);
    const atasP = new THREE.Vector3(xa, yA - 0.05, zD - 0.016), bawahP = new THREE.Vector3(xa, yB + 0.05, zD - 0.016);
    g.add(pelatAntara(THREE, atasD, bawahP, 0.028, 0.008, hitam));
    g.add(pelatAntara(THREE, bawahD, atasP.clone().setX(xa + sx * 0.01), 0.028, 0.008, hitam));
    const poros = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 12), baut);
    poros.rotation.z = Math.PI / 2; poros.position.set(xa + sx * 0.005, yTengah, (zDinding + zD) / 2); g.add(poros);
  }
  //  Kenop T: dua di atas palang atas (tegak), dua di ujung palang bawah (mendatar).
  const kenopT = (px: number, py: number, pz: number, mendatar: number) => {
    const k = new THREE.Group();
    k.add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 10), baut).translateY(0.015));
    k.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 14), kenop).translateY(0.034));
    const gagang = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.014), kenop); gagang.position.y = 0.046; k.add(gagang);
    k.position.set(px, py, pz); if (mendatar) k.rotation.z = -mendatar * Math.PI / 2; g.add(k);
  };
  for (const sx of [-1, 1]) {
    kenopT(x + sx * W * 0.24, yA + 0.047, zPunggung - 0.02, 0);
    kenopT(x + sx * (lebarDepan / 2 - 0.01), yB - 0.025, zPunggung - 0.02, sx);
  }
  return g;
}

/**
 * Wall bracket + struktur hollow (videowall, LED, signage): rangka besi hollow 40×40 di belakang
 * display - tiang tegak tiap ±0,6 m, palang mendatar atas-bawah (+ tengah untuk display tinggi) -
 * diikat ke dinding dengan plat siku berbaut. Mengisi celah punggung display sampai dinding.
 */
function strukturHollow(THREE: typeof T, lebar: number, tinggi: number, zPunggung: number): T.Group {
  const g = new THREE.Group();
  const besi = mat(THREE, 0x3b4048, { metalness: 0.6, roughness: 0.45 });
  const plat = mat(THREE, 0x8b9099, { metalness: 0.75, roughness: 0.35 });
  const baut = mat(THREE, 0xc7cbd1, { metalness: 0.9, roughness: 0.25 });
  const s = 0.04, celah = 0.1;
  const zDinding = zPunggung - celah;
  const zRangka = zDinding + 0.035 + s / 2;
  const nTiang = Math.max(2, Math.ceil(lebar / 0.6) + 1);
  const xs = Array.from({ length: nTiang }, (_, i) => -lebar / 2 + s / 2 + ((lebar - s) * i) / (nTiang - 1));
  const lebih = Math.min(0.08, tinggi * 0.05);
  for (const x of xs) g.add(kotak(THREE, s, tinggi + lebih * 2, s, besi, x, tinggi / 2, zRangka));
  const nPalang = tinggi > 1.4 ? Math.ceil(tinggi / 0.7) + 1 : 2;
  for (let i = 0; i < nPalang; i++) {
    const y = 0.06 + ((tinggi - 0.12) * i) / (nPalang - 1);
    g.add(kotak(THREE, lebar + 0.04, s, s, besi, 0, y, zRangka + s));   // palang di depan tiang, menempel punggung display
  }
  //  Plat siku ke dinding (atas & bawah tiap tiang) dengan dua baut.
  for (const x of xs) for (const y of [tinggi + lebih - 0.05, -lebih + 0.05]) {
    g.add(kotak(THREE, 0.09, 0.07, 0.006, plat, x, y, zDinding + 0.003));
    g.add(kotak(THREE, 0.006, 0.07, 0.035, plat, x - s / 2 - 0.003, y, zDinding + 0.02));
    for (const dx of [-0.028, 0.028]) {
      const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.008, 10), baut);
      bt.rotation.x = Math.PI / 2; bt.position.set(x + dx, y, zDinding + 0.008); g.add(bt);
    }
  }
  return g;
}

/**
 * Standfloor portable beroda (mengikuti foto referensi owner): DUA tiang bulat abu-abu di kiri &
 * kanan yang turun sampai ±60 cm dari lantai, lalu masing-masing terbelah menjadi kaki "A" (satu
 * ke depan, satu ke belakang) berujung roda kastor; baki/rak abu-abu di ketinggian percabangan;
 * dudukan display hitam = rel atas & bawah dengan dua batang tegak di antaranya, menempel punggung
 * display. Tidak ada tiang tengah - display lebar tetap dua tiang.
 */
export function standfloor(THREE: typeof T, g: T.Group, b: Benda, tinggiTiang: number) {
  const abu = mat(THREE, 0x5f646b, { metalness: 0.55, roughness: 0.4 });
  const hitam = mat(THREE, 0x15171a, { metalness: 0.45, roughness: 0.45 });
  const karet = mat(THREE, 0x0b0c0e, { roughness: 0.8 });
  const xT = Math.max(0.28, Math.min(b.w / 2 - 0.08, Math.max(0.36, b.w * 0.36)));
  const zT = -b.d / 2 - 0.035, jari = 0.026;
  const CABANG = 0.6;   // tinggi percabangan kaki dari lantai (m)
  //  Tiang tegak: dari percabangan (lantai + 60 cm) sampai atas dudukan, ikut ketinggian display.
  for (const sx of [-1, 1]) {
    const t = batang(THREE, jari * 2, jari * 2, abu, sx * xT, zT, 'kaki', tinggiTiang, true);
    t.userData.bawah = CABANG; g.add(t);
    const tutup = new THREE.Mesh(new THREE.CylinderGeometry(jari, jari, 0.012, 14), abu);
    tutup.position.set(sx * xT, tinggiTiang + 0.006, zT); g.add(tutup);
  }
  //  Dudukan display: rel atas & bawah + dua batang tegak, menempel punggung display.
  const yAtas = Math.min(tinggiTiang - 0.03, b.h * 0.74), yBawah = Math.max(0.1, b.h * 0.42);
  const zRel = -b.d / 2 - 0.012, lebarRel = xT * 2 + jari * 2;
  for (const y of [yAtas, yBawah]) g.add(kotak(THREE, lebarRel, 0.06, 0.022, hitam, 0, y, zRel));
  for (const fx of [-1 / 3, 1 / 3]) g.add(kotak(THREE, 0.05, yAtas - yBawah, 0.02, hitam, fx * xT * 1.15, (yAtas + yBawah) / 2, zRel));
  //  Bagian lantai (tinggi absolut): kaki A, roda, dan baki di percabangan.
  const alas = new THREE.Group();
  for (const sx of [-1, 1]) {
    const x = sx * xT;
    const pangkal = new THREE.Vector3(x, CABANG, zT);
    for (const dz of [0.4, -0.36]) {
      const lutut = new THREE.Vector3(x + sx * 0.025, 0.14, zT + dz * 0.9);
      const ujung = new THREE.Vector3(x + sx * 0.03, 0.085, zT + dz);
      alas.add(tiangAntara(THREE, pangkal, lutut, jari * 0.9, abu, jari * 0.85));
      alas.add(tiangAntara(THREE, lutut, ujung, jari * 0.85, abu));
      const sendi = new THREE.Mesh(new THREE.SphereGeometry(jari * 0.86, 12, 8), abu); sendi.position.copy(lutut); alas.add(sendi);
      const rumah = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.03, 12), hitam);
      rumah.position.set(ujung.x, 0.07, ujung.z); alas.add(rumah);
      const roda = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.026, 18), karet);
      roda.rotation.z = Math.PI / 2; roda.position.set(ujung.x, 0.035, ujung.z); alas.add(roda);
    }
    const bonggol = new THREE.Mesh(new THREE.SphereGeometry(jari * 1.1, 14, 10), abu); bonggol.position.copy(pangkal); alas.add(bonggol);
  }
  //  Baki di percabangan: menjorok ke depan (untuk kamera / laptop), bibir depan menekuk turun.
  const kedalaman = 0.34, zBaki = zT + kedalaman / 2 - 0.03;
  alas.add(kotak(THREE, xT * 2 + 0.02, 0.014, kedalaman, abu, 0, CABANG + 0.01, zBaki));
  alas.add(kotak(THREE, xT * 2 + 0.02, 0.03, 0.012, abu, 0, CABANG - 0.005, zBaki + kedalaman / 2));
  g.add(diLantai(alas));
}

/** Pemasangan display sesuai pilihan: bracket pop-up per sel (kol × bar), struktur hollow, atau standfloor. */
function pasangDisplay(THREE: typeof T, g: T.Group, b: Benda, kol: number, bar: number, faktorTiang: number) {
  const ps = pasangDari(b);
  if (ps === 'standfloor') { standfloor(THREE, g, b, b.h * faktorTiang); return; }
  if (ps === 'hollow') { g.add(strukturHollow(THREE, b.w, b.h, -b.d / 2)); return; }
  const pw = b.w / kol, ph = b.h / bar;
  for (let i = 0; i < kol; i++) for (let j = 0; j < bar; j++) {
    g.add(bracketPopOut(THREE, pw, ph, -b.w / 2 + pw * (i + 0.5), ph * (j + 0.5), -b.d / 2));
  }
}

/** videowall */
export function bangunVideowall({ THREE, g, b, muka, W }: Konteks) {
  const kol = b.kol ?? 2, bar = b.bar ?? 2;
  const spek = spekVideowall(b);
  g.add(kotak(THREE, b.w, b.h, b.d, mat(THREE, W(0x0a0a0a), { roughness: 0.35, metalness: 0.5 }), 0, b.h / 2, 0));
  g.add(muka(b.w, b.h, b.d / 2 + 0.001, b.h / 2));
  //  Bezel 3,5 mm sisi ke sisi: tebal garis proporsional terhadap lebar tekstur 1024 px.
  const tebal = Math.max(2, (spek.bezelMm / 1000) * (1024 / b.w));
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h),
    new THREE.MeshBasicMaterial({ map: teksturGrid(THREE, kol, bar, tebal, 'rgba(8,8,8,0.95)'), transparent: true, toneMapped: false }));
  grid.position.set(0, b.h / 2, b.d / 2 + 0.002); g.add(grid);
  pasangDisplay(THREE, g, b, kol, bar, 0.8);
}

/** tv, ifp */
export function bangunTvIfp({ THREE, g, b, muka, W }: Konteks) {
  const ifp = b.jenis === 'ifp';
  const bezel = mat(THREE, W(ifp ? 0x1f2937 : 0x111111), { roughness: 0.35, metalness: 0.5 });
  g.add(kotak(THREE, b.w, b.h, b.d, bezel, 0, b.h / 2, 0));
  const tepi = ifp ? 0.03 : 0.012;
  g.add(muka(b.w - tepi * 2, b.h - tepi * 2, b.d / 2 + 0.001, b.h / 2));
  if (ifp) {
    g.add(kotak(THREE, b.w * 0.25, 0.012, 0.03, mat(THREE, 0x9ca3af, { metalness: 0.6 }), 0, -0.006, b.d / 2 - 0.01)); // baki pena
    g.add(kotak(THREE, 0.12, 0.012, 0.012, mat(THREE, 0xe5e7eb), -b.w * 0.06, 0.006, b.d / 2));
  }
  pasangDisplay(THREE, g, b, 1, 1, 0.78);
}

/** led */
export function bangunLed({ THREE, g, b, muka, W }: Konteks) {
  const rangka = mat(THREE, W(0x1f2937), { metalness: 0.6, roughness: 0.4 });
  g.add(kotak(THREE, b.w, b.h, b.d, rangka, 0, b.h / 2, 0));
  g.add(muka(b.w, b.h, b.d / 2 + 0.001, b.h / 2));
  const kol = Math.max(1, Math.round((b.w * 1000) / (b.cabW ?? 500)));
  const bar = Math.max(1, Math.round((b.h * 1000) / (b.cabH ?? 500)));
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h),
    new THREE.MeshBasicMaterial({ map: teksturGrid(THREE, kol, bar), transparent: true, toneMapped: false }));
  grid.position.set(0, b.h / 2, b.d / 2 + 0.002); g.add(grid);
  //  Bracket pop-up per ±1 m (cabinet LED berat), struktur hollow, atau standfloor beroda.
  pasangDisplay(THREE, g, b, Math.max(1, Math.round(b.w)), Math.max(1, Math.round(b.h)), 0.8);
}

/** layar */
export function bangunLayar({ THREE, g, b, bahan, W }: Konteks) {
  g.add(kotak(THREE, b.w + 0.12, b.h + 0.12, b.d, mat(THREE, W(0x111827)), 0, b.h / 2, 0));
  const tex = bahan.layar(b);
  const m = tex ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : mat(THREE, 0xf8fafc, { roughness: 0.9 });
  const kain = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), m);
  kain.position.set(0, b.h / 2, b.d / 2 + 0.001); g.add(kain);
  g.add(kotak(THREE, b.w + 0.3, 0.12, 0.14, mat(THREE, 0xe5e7eb), 0, b.h + 0.12, 0)); // casing gulung
}

/** proyektor */
export function bangunProyektor({ THREE, g, b, W }: Konteks) {
  //  Badan cangkang plastik membulat (tampak atas) bertepi bevel lebar,
  //  muka gelap berisi lensa menyamping + gril ventilasi, panel tombol di
  //  atas. Plafon: bracket laba-laba + pipa ke plafon + pelat plafon.
  //  Meja: empat kaki karet.
  const meja = b.pasangProyektor === 'meja';
  //  Badan (beserta lensa & kaki) dibangun di grup `badan` yang diputar di
  //  engselnya untuk tilt; bracket plafon tetap tegak di grup utama.
  const utama = g;
  const badan = new THREE.Group();
  {
  const g = badan;
  const putih = mat(THREE, W(0xf1f2f4), { roughness: 0.42, metalness: 0.05 });
  const abu = mat(THREE, 0x2f343b, { roughness: 0.45, metalness: 0.3 });
  const hitamKilap = mat(THREE, 0x0a0b0d, { roughness: 0.15, metalness: 0.4 });
  const kaca = new THREE.MeshPhysicalMaterial({ color: 0x1b2a44, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0xc7d6ff, emissiveIntensity: 0.35 });
  const kaki = meja ? Math.min(0.012, b.h * 0.12) : 0;
  const tb = b.h - kaki;
  g.add(papan(THREE, b.w, b.d, tb, Math.min(b.w, b.d) * 0.16, putih, Math.min(0.02, tb * 0.28)).translateY(kaki));
  const zMuka = b.d / 2;
  g.add(blok(THREE, b.w * 0.84, tb * 0.62, 0.004, Math.min(0.012, tb * 0.2), abu, 0.0015).translateY(kaki + tb * 0.19).translateZ(zMuka + 0.001));
  //  Gril ventilasi di sisi kiri muka.
  const gril = new THREE.MeshStandardMaterial({ map: teksturGril(THREE, '#3a3f47', 'rgba(0,0,0,0.9)', 5), roughness: 0.6, metalness: 0.3 });
  g.add(blok(THREE, b.w * 0.34, tb * 0.44, 0.003, Math.min(0.008, tb * 0.12), gril, 0.001).translateX(-b.w * 0.2).translateY(kaki + tb * 0.28).translateZ(zMuka + 0.004));
  //  Lensa: laras menonjol, cincin fokus, kaca bercahaya.
  const [lx, ly] = lensaDatar(b);
  const rL = Math.min(0.05, tb * 0.36);
  const laras = new THREE.Mesh(new THREE.CylinderGeometry(rL, rL * 1.08, 0.03, 32), hitamKilap);
  laras.rotation.x = Math.PI / 2; laras.position.set(lx, ly, zMuka + 0.015); g.add(laras);
  for (const [dz, rr] of [[0.006, 1.14], [0.024, 1.02]] as const) {
    const cincin = new THREE.Mesh(new THREE.TorusGeometry(rL * rr, Math.max(0.002, rL * 0.08), 8, 36), abu);
    cincin.position.set(lx, ly, zMuka + dz); g.add(cincin);
  }
  const kubah = new THREE.Mesh(new THREE.SphereGeometry(rL * 0.82, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), kaca);
  kubah.rotation.x = Math.PI / 2; kubah.scale.set(1, 0.45, 1); kubah.position.set(lx, ly, zMuka + 0.03); g.add(kubah);
  //  Celah ventilasi samping.
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      g.add(kotak(THREE, 0.003, tb * 0.07, b.d * 0.34, hitamKilap, sx * (b.w / 2 + 0.0005), kaki + tb * (0.3 + i * 0.1), -b.d * 0.05));
    }
  }
  //  Panel tombol & lampu daya di atas.
  g.add(papan(THREE, b.w * 0.26, b.d * 0.2, 0.003, 0.01, abu, 0.001).translateX(-b.w * 0.24).translateY(b.h - 0.0005).translateZ(b.d * 0.18));
  const lampu = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8), mat(THREE, 0x60a5fa, { emissive: 0x60a5fa, emissiveIntensity: 1.4 }));
  lampu.position.set(-b.w * 0.33, b.h + 0.002, b.d * 0.18); g.add(lampu);
  if (meja) {
    const karet = mat(THREE, 0x15171b, { roughness: 0.8 });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, kaki, 16), karet).translateX(sx * (b.w / 2 - 0.045)).translateY(kaki / 2).translateZ(sz * (b.d / 2 - 0.04)));
    }
  } else {
    //  Pelat & lengan laba-laba menempel di badan, ikut miring bersamanya.
    const besi = mat(THREE, 0x25282e, { metalness: 0.75, roughness: 0.35 });
    const hub = new THREE.Vector3(0, b.h + 0.022, 0);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.016, 24), besi).translateY(b.h + 0.016));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const ujung = new THREE.Vector3(sx * b.w * 0.3, b.h + 0.004, sz * b.d * 0.28);
      g.add(tiangAntara(THREE, hub, ujung, 0.006, besi));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 12), besi).translateX(ujung.x).translateY(b.h + 0.003).translateZ(ujung.z));
    }
  }
  }
  const [, ey, ez] = engselProyektor(b);
  const pivot = new THREE.Group(); pivot.position.set(0, ey, ez);
  badan.position.set(0, -ey, -ez); pivot.add(badan);
  pivot.rotation.x = -(tiltDari(b) * Math.PI) / 180;
  utama.add(pivot);
  if (!meja) {
    const g = utama;
    const besi = mat(THREE, 0x25282e, { metalness: 0.75, roughness: 0.35 });
    //  Sendi bola (engsel tilt), pipa sampai plafon, pelat plafon - tetap tegak.
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), besi).translateY(b.h + 0.04));
    g.add(batang(THREE, 0.04, 0.04, besi, 0, 0, 'tiang', 0, true));
    const geoPelat = new THREE.CylinderGeometry(0.08, 0.08, 0.012, 32); geoPelat.translate(0, -0.006, 0);
    const pelat = new THREE.Mesh(geoPelat, besi); pelat.userData.peran = 'plafon'; g.add(pelat);
  }
}
