/**
 * desain3d/bangun/furnitur.ts - Furnitur: meja (rapat, bundar, kelas, dosen, podium, kredensa, operator) & kursi.
 * Model dibangun dengan alas di y = 0; ketinggian (elev) diterapkan lewat posisi grup.
 */
import type * as T from 'three';
import { type Finish } from '../inti';
import { teksturMonitor } from './tekstur';
import { bevelAman, blok, type Konteks, kotak, lempeng, lengkungkan, mat, papan, pipa, tiangAntara } from './dasar';
import { teksturKain, teksturKayu } from './permukaan';

/**
 * Sandaran melengkung: pita busur selebar `lebar`, cekung ke +z (ke arah
 * yang duduk), tinggi ke atas dari y = 0, bagian tengah pita di z = 0.
 */
export function sandaran(THREE: typeof T, lebar: number, tinggi: number, tebal: number, R: number, m: T.Material) {
  const sud = Math.asin(Math.min(0.95, lebar / (2 * R)));
  const s = new THREE.Shape();
  s.absarc(0, 0, R, Math.PI / 2 + sud, Math.PI / 2 - sud, true);
  s.absarc(0, 0, R - tebal, Math.PI / 2 - sud, Math.PI / 2 + sud, false);
  const bv = bevelAman(0.012, tebal, tinggi);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.001, tinggi - 2 * bv), bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv * 0.6,
    bevelSegments: 3, curveSegments: 24,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bv, R - tebal / 2);
  return new THREE.Mesh(geo, m);
}

/** meja */
export function bangunMeja({ THREE, g, b, warnaB, W }: Konteks) {
  const bentuk = b.bentukMeja ?? 'rapat';
  const fin: Finish = b.finish ?? (bentuk === 'kelas' ? 'oak' : 'walnut');
  const panjangZ = b.d >= b.w;
  const atas = new THREE.MeshPhysicalMaterial({
    //  Warna custom = laminasi polos: tekstur 'putih' (nyaris rata) dikalikan warna pilihan.
    map: teksturKayu(THREE, warnaB ? 'putih' : fin, panjangZ), color: warnaB ? new THREE.Color(warnaB) : 0xffffff,
    roughness: fin === 'putih' || warnaB ? 0.5 : 0.42,
    clearcoat: fin === 'putih' || warnaB ? 0.15 : 0.55, clearcoatRoughness: 0.3,
  });
  const logam = mat(THREE, 0x2a2e35, { metalness: 0.75, roughness: 0.3 });
  if (bentuk === 'bulat') {
    //  Bundar/oval (w x d) dengan kaki tunggal: piring alas melebar,
    //  tiang ramping, dudukan atas - satu profil putar (LatheGeometry).
    const tebal = 0.04, bv = 0.008;
    const s = new THREE.Shape(); s.absellipse(0, 0, b.w / 2 - bv, b.d / 2 - bv, 0, Math.PI * 2, false, 0);
    g.add(lempeng(THREE, s, tebal, bv, atas, 64).translateY(b.h - tebal));
    const r0 = Math.min(b.w, b.d) * 0.3, yAtas = b.h - tebal, rAtas = Math.min(0.2, r0 * 0.8);
    const profil: [number, number][] = [[0.001, 0], [r0, 0], [r0, 0.012], [r0 * 0.6, 0.03], [0.07, 0.075], [0.042, 0.15],
      [0.038, yAtas - 0.14], [0.06, yAtas - 0.06], [rAtas, yAtas - 0.02], [rAtas, yAtas], [0.001, yAtas]];
    g.add(new THREE.Mesh(new THREE.LatheGeometry(profil.map(([x, y]) => new THREE.Vector2(x, y)), 48), logam));
  } else if (bentuk === 'kelas') {
    //  Meja siswa: papan laminasi, rangka pipa ditekuk di kedua sisi,
    //  panel penutup di depan (menghadap papan tulis) & rak buku.
    const tebal = 0.025;
    g.add(papan(THREE, b.w, b.d, tebal, 0.035, atas, 0.005).translateY(b.h - tebal));
    const rangka = mat(THREE, 0x3f454f, { metalness: 0.7, roughness: 0.35 });
    for (const sx of [-1, 1]) {
      const x = sx * (b.w / 2 - 0.06);
      g.add(pipa(THREE, [[x, 0.014, -b.d / 2 + 0.05], [x, 0.014, b.d / 2 - 0.05], [x, b.h - tebal - 0.012, b.d / 2 - 0.07], [x, b.h - tebal - 0.012, -b.d / 2 + 0.07]], 0.013, 0.06, rangka, true));
    }
    g.add(blok(THREE, b.w - 0.16, 0.28, 0.012, 0.01, mat(THREE, 0xcbd5e1, { roughness: 0.6 }), 0.003).translateY(b.h - tebal - 0.3).translateZ(-b.d / 2 + 0.06));
    g.add(papan(THREE, b.w - 0.16, b.d * 0.62, 0.012, 0.01, mat(THREE, 0x94a3b8, { roughness: 0.6 }), 0.003).translateY(b.h - 0.15).translateZ(-b.d * 0.12));
  } else if (bentuk === 'dosen') {
    //  Meja dosen: daun meja kayu, panel depan (menghadap mahasiswa) & panel samping, laci di kanan.
    const tebal = 0.03, panel = mat(THREE, warnaB ? 0xe5e7eb : 0xd6d9de, { roughness: 0.55 });
    g.add(papan(THREE, b.w, b.d, tebal, 0.02, atas, 0.004).translateY(b.h - tebal));
    g.add(kotak(THREE, b.w - 0.04, b.h - tebal - 0.06, 0.02, panel, 0, (b.h - tebal) / 2 + 0.03, b.d / 2 - 0.05));
    for (const sx of [-1, 1]) g.add(kotak(THREE, 0.03, b.h - tebal, b.d - 0.04, panel, sx * (b.w / 2 - 0.015), (b.h - tebal) / 2, 0));
    const laci = Math.min(0.42, b.w * 0.28);
    g.add(kotak(THREE, laci, b.h - tebal - 0.1, b.d - 0.12, panel, b.w / 2 - 0.03 - laci / 2, (b.h - tebal) / 2 + 0.03, -0.02));
    for (let i = 0; i < 3; i++) g.add(kotak(THREE, laci * 0.4, 0.012, 0.012, logam, b.w / 2 - 0.03 - laci / 2, 0.16 + i * 0.2, -b.d / 2 + 0.04));
  } else if (bentuk === 'podium') {
    //  Podium / mimbar: alas, badan meruncing, bidang baca miring ke arah pembicara (-z), panel logo & mic gooseneck.
    const kayu = new THREE.MeshPhysicalMaterial({ map: teksturKayu(THREE, warnaB ? 'putih' : fin, false), color: warnaB ? new THREE.Color(warnaB) : 0xffffff, roughness: 0.45, clearcoat: 0.4 });
    const tAlas = 0.06, tBaca = b.h - 0.06;
    g.add(papan(THREE, b.w, b.d, tAlas, 0.02, logam, 0.006));
    g.add(blok(THREE, b.w * 0.86, tBaca - tAlas, b.d * 0.82, 0.04, kayu, 0.008).translateY(tAlas));
    g.add(blok(THREE, b.w * 0.6, (tBaca - tAlas) * 0.35, 0.006, 0.01, mat(THREE, 0xe7e5e4, { roughness: 0.4 }), 0.002).translateY(tAlas + (tBaca - tAlas) * 0.45).translateZ(b.d * 0.41 + 0.004));
    const baca = papan(THREE, b.w, b.d * 0.9, 0.035, 0.02, kayu, 0.006);
    baca.position.set(0, tBaca, 0); baca.rotation.x = -0.22; g.add(baca);
    const hitamMic = mat(THREE, 0x111827, { metalness: 0.5, roughness: 0.4 });
    const kurva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(b.w * 0.3, tBaca + 0.03, b.d * 0.3), new THREE.Vector3(b.w * 0.3, tBaca + 0.2, b.d * 0.22), new THREE.Vector3(b.w * 0.26, tBaca + 0.33, b.d * 0.02),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(kurva, 20, 0.005, 8, false), hitamMic));
    const kepala = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), hitamMic);
    kepala.scale.set(1, 1.5, 1); kepala.position.set(b.w * 0.25, tBaca + 0.35, -b.d * 0.02); g.add(kepala);
  } else if (bentuk === 'kredensa') {
    //  Kredensa: badan lemari gelap, pintu berpanel dengan handle, plint tersembunyi, daun atas.
    const badan = mat(THREE, W(0x1d2026), { roughness: 0.5 });
    const pegangan = mat(THREE, 0x9ca3af, { metalness: 0.9, roughness: 0.25 });
    const tebal = 0.025, plint = 0.06;
    g.add(papan(THREE, b.w, b.d, tebal, 0.01, warnaB ? badan : atas, 0.003).translateY(b.h - tebal));
    g.add(kotak(THREE, b.w - 0.08, plint, b.d - 0.08, mat(THREE, 0x0b0c0f), 0, plint / 2, -0.01));
    g.add(kotak(THREE, b.w, b.h - tebal - plint, b.d - 0.02, badan, 0, plint + (b.h - tebal - plint) / 2, -0.01));
    const nPintu = Math.max(2, Math.round(b.w / 0.6)), lebarPintu = (b.w - 0.02) / nPintu;
    for (let i = 0; i < nPintu; i++) {
      const x = -b.w / 2 + 0.01 + lebarPintu * (i + 0.5);
      g.add(blok(THREE, lebarPintu - 0.006, b.h - tebal - plint - 0.012, 0.018, 0.004, badan, 0.002).translateX(x).translateY(plint + 0.006).translateZ(b.d / 2 - 0.02));
      const sisi = i % 2 === 0 ? 1 : -1;
      g.add(kotak(THREE, 0.012, Math.min(0.22, (b.h - plint) * 0.35), 0.02, pegangan, x + sisi * (lebarPintu / 2 - 0.04), plint + (b.h - tebal - plint) * 0.62, b.d / 2 + 0.002));
    }
  } else if (bentuk === 'operator') {
    //  Meja operator control room: daun hitam, panel kaki putih (ujung & tengah), panel penutup
    //  di sisi depan (-z, ke arah videowall), monitor berderet di lengan, keyboard per 2 monitor.
    const daun = mat(THREE, W(0x15171b), { roughness: 0.4 });
    const panel = mat(THREE, 0xe5e7eb, { roughness: 0.5 });
    const tebal = 0.03;
    g.add(papan(THREE, b.w, b.d, tebal, 0.015, daun, 0.004).translateY(b.h - tebal));
    const nKaki = Math.max(2, Math.ceil(b.w / 1.8) + 1);
    for (let i = 0; i < nKaki; i++) g.add(kotak(THREE, 0.04, b.h - tebal, b.d - 0.06, panel, -b.w / 2 + 0.03 + (i * (b.w - 0.06)) / (nKaki - 1), (b.h - tebal) / 2, 0));
    g.add(kotak(THREE, b.w - 0.1, (b.h - tebal) * 0.55, 0.02, panel, 0, (b.h - tebal) * 0.6, -b.d / 2 + 0.05));
    const n = Math.max(0, Math.min(12, Math.round(b.monitorMeja ?? 4)));
    const hitam = mat(THREE, 0x0f1115, { roughness: 0.35, metalness: 0.3 });
    const ruas = (b.w - 0.1) / Math.max(1, n), lebarMon = Math.min(0.55, ruas - 0.02), tinggiMon = lebarMon * 0.6;
    const layarA = teksturMonitor(THREE, false, n * 3 + 1), layarB = teksturMonitor(THREE, true, n * 5 + 2);
    for (let i = 0; i < n; i++) {
      const mon = new THREE.Group();
      mon.add(kotak(THREE, 0.2, 0.01, 0.16, hitam, 0, 0.005, 0));
      mon.add(kotak(THREE, 0.03, 0.14, 0.02, hitam, 0, 0.08, -0.04));
      const badanMon = blok(THREE, lebarMon, tinggiMon, 0.02, 0.006, hitam, 0.002);
      badanMon.position.set(0, 0.12, -0.03); mon.add(badanMon);
      const kaca = new THREE.Mesh(new THREE.PlaneGeometry(lebarMon * 0.96, tinggiMon * 0.92), new THREE.MeshBasicMaterial({ map: i % 2 ? layarB : layarA, toneMapped: false }));
      kaca.position.set(0, 0.12 + tinggiMon / 2, -0.019); mon.add(kaca);
      mon.position.set(-b.w / 2 + 0.05 + ruas * (i + 0.5), b.h, -b.d / 2 + 0.2);
      mon.rotation.y = ((i + 0.5) / n - 0.5) * -0.3;
      g.add(mon);
    }
    const nKey = Math.max(1, Math.round(n / 2));
    for (let i = 0; i < nKey; i++) {
      const x = -b.w / 2 + (b.w / nKey) * (i + 0.5);
      g.add(kotak(THREE, 0.44, 0.018, 0.14, mat(THREE, 0x2b3038, { roughness: 0.6 }), x - 0.04, b.h + 0.009, b.d / 2 - 0.25));
      g.add(kotak(THREE, 0.06, 0.02, 0.1, mat(THREE, 0x2b3038, { roughness: 0.6 }), x + 0.27, b.h + 0.01, b.d / 2 - 0.25));
    }
  } else {
    //  Meja rapat: papan sudut membulat bertepi bevel + dua kaki panel,
    //  balok penghubung, dan kotak kabel rata permukaan.
    const tebal = 0.045;
    g.add(papan(THREE, b.w, b.d, tebal, Math.min(0.3, Math.min(b.w, b.d) * 0.3), atas, 0.008).translateY(b.h - tebal));
    const panjang = Math.max(b.w, b.d), lebar = Math.min(b.w, b.d);
    const jarakKaki = Math.max(0.15, panjang / 2 - Math.min(0.45, panjang * 0.16));
    const tinggiKaki = b.h - tebal;
    for (const sisi of [-1, 1]) {
      const kaki = blok(THREE, lebar * 0.62, tinggiKaki, 0.055, 0.02, logam, 0.006);
      if (panjangZ) kaki.position.z = sisi * jarakKaki;
      else { kaki.rotation.y = Math.PI / 2; kaki.position.x = sisi * jarakKaki; }
      g.add(kaki);
    }
    g.add(panjangZ
      ? kotak(THREE, 0.08, 0.05, jarakKaki * 2, logam, 0, tinggiKaki - 0.08, 0)
      : kotak(THREE, jarakKaki * 2, 0.05, 0.08, logam, 0, tinggiKaki - 0.08, 0));
    const kabel = papan(THREE, 0.26, 0.12, 0.006, 0.02, mat(THREE, 0xb8bec7, { metalness: 0.85, roughness: 0.25 }), 0.002);
    if (panjangZ) kabel.rotation.y = Math.PI / 2;
    g.add(kabel.translateY(b.h));
  }
}

/** kursi */
export function bangunKursi({ THREE, g, b, W, WS }: Konteks) {
  const krom = mat(THREE, 0xc9ced6, { metalness: 0.95, roughness: 0.18 });
  if ((b.tipeKursi ?? 'kantor') === 'kelas') {
    const cangkang = mat(THREE, W(0x334155), { roughness: 0.5 });
    const yDuduk = 0.45;
    g.add(papan(THREE, b.w * 0.92, b.d * 0.82, 0.03, 0.06, cangkang, 0.01).translateY(yDuduk - 0.03));
    const s = sandaran(THREE, b.w * 0.9, 0.28, 0.022, 0.55, cangkang);
    s.position.set(0, yDuduk + 0.09, -b.d * 0.38); s.rotation.x = -0.12; g.add(s);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      g.add(tiangAntara(THREE, new THREE.Vector3(sx * (b.w / 2 - 0.02), 0, sz * (b.d / 2 - 0.03)),
        new THREE.Vector3(sx * (b.w / 2 - 0.07), yDuduk - 0.03, sz * (b.d / 2 - 0.1)), 0.011, krom));
    }
    for (const sx of [-1, 1]) {
      g.add(tiangAntara(THREE, new THREE.Vector3(sx * (b.w / 2 - 0.07), yDuduk - 0.03, -b.d / 2 + 0.1),
        new THREE.Vector3(sx * b.w * 0.3, yDuduk + 0.13, -b.d * 0.39), 0.009, krom));
    }
    return;
  }
  const kain = new THREE.MeshStandardMaterial({ map: teksturKain(THREE, WS('#30353d'), 0.12), roughness: 0.95 });
  const plastik = mat(THREE, 0x1b1e23, { roughness: 0.5 });
  const yDuduk = 0.48;
  //  Kaki bintang lima beroda + tabung gas.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 10;
    const ujung = new THREE.Vector3(Math.cos(a) * 0.3, 0.058, Math.sin(a) * 0.3);
    g.add(tiangAntara(THREE, new THREE.Vector3(0, 0.085, 0), ujung, 0.02, krom, 0.013));
    const roda = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), plastik);
    roda.position.set(ujung.x, 0.026, ujung.z); g.add(roda);
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 20), krom).translateY(0.085));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 16), plastik).translateY(0.18));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 16), krom).translateY(0.32));
  g.add(kotak(THREE, 0.22, 0.045, 0.24, plastik, 0, yDuduk - 0.06, 0));
  //  Dudukan empuk (bevel besar = tepi bantalan) & sandaran melengkung.
  g.add(papan(THREE, b.w * 0.9, b.d * 0.86, 0.085, 0.1, kain, 0.03).translateY(yDuduk - 0.04));
  //  Sandaran: bantalan kain bersudut membulat (bevel besar = empuk) yang
  //  dilengkungkan memeluk punggung, cangkang plastik di belakangnya.
  const tinggiS = Math.max(0.3, b.h - yDuduk - 0.1);
  const grupS = new THREE.Group();
  const bantal = blok(THREE, b.w * 0.84, tinggiS, 0.06, 0.11, kain, 0.022);
  lengkungkan(bantal.geometry, 0.5); grupS.add(bantal);
  const cangkang = blok(THREE, b.w * 0.8, tinggiS * 0.96, 0.016, 0.1, plastik, 0.005);
  lengkungkan(cangkang.geometry, 0.5); cangkang.position.set(0, tinggiS * 0.02, -0.036); grupS.add(cangkang);
  grupS.position.set(0, yDuduk + 0.1, -b.d * 0.4); grupS.rotation.x = -0.14; g.add(grupS);
  g.add(blok(THREE, 0.07, 0.26, 0.025, 0.02, plastik).translateY(yDuduk - 0.02).translateZ(-b.d * 0.43));
  for (const sx of [-1, 1]) {
    const x = sx * (b.w / 2 - 0.035);
    g.add(pipa(THREE, [[x, yDuduk, -0.12], [x, yDuduk + 0.2, -0.1], [x, yDuduk + 0.2, 0.1]], 0.011, 0.04, plastik));
    g.add(papan(THREE, 0.06, 0.24, 0.022, 0.025, plastik, 0.008).translateX(x).translateY(yDuduk + 0.205).translateZ(0.0));
  }
}
