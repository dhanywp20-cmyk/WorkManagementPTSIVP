/**
 * desain3d/bangun/audio.ts - Audio & kontrol: speaker (dinding, kolom, line array, plafon), mic, touch panel, rack server.
 * Model dibangun dengan alas di y = 0; ketinggian (elev) diterapkan lewat posisi grup.
 */
import type * as T from 'three';
import { type Benda, modulLA, sudutModulLA, tiltLADari, tipeSpeakerDari } from '../inti';
import { kanvas, teksturPanel } from './tekstur';
import { teksturIsiRak } from './rak';
import { batang, blok, type Konteks, kotak, mat, persegiBulat } from './dasar';
import { teksturGril, teksturMicBoundary } from './permukaan';

/**
 * Badan meruncing ke belakang: penampang persegi membulat di muka (w x h, z = 0) mengecil
 * ke belakang (skala, z = -panjang). Tutup belakang ikut; muka dibiarkan terbuka untuk gril.
 */
function badanRuncing(THREE: typeof T, w: number, h: number, r: number, panjang: number, skala: number, m: T.Material, yBelakang = 0): T.Mesh {
  const titik = persegiBulat(THREE, w, h, r).getPoints(8);
  if (titik.length > 1 && titik[0].distanceTo(titik[titik.length - 1]) < 1e-6) titik.pop();
  const n = titik.length, pos: number[] = [], idx: number[] = [];
  for (const t of titik) pos.push(t.x, t.y, 0);
  for (const t of titik) pos.push(t.x * skala, t.y * skala + yBelakang, -panjang);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, n + i, j, j, n + i, n + j); }
  const pusat = pos.length / 3; pos.push(0, yBelakang, -panjang);
  for (let i = 0; i < n; i++) idx.push(pusat, n + (i + 1) % n, n + i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo, m);
}

/** Muka gril bersudut membulat (ShapeGeometry, UV = meter) menghadap +z. */
function mukaGril(THREE: typeof T, w: number, h: number, r: number, dasar: string, lubang: string, ulang: number) {
  const geo = new THREE.ShapeGeometry(persegiBulat(THREE, w, h, r), 10);
  const t = teksturGril(THREE, dasar, lubang, ulang);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.3 }));
}

/**
 * Speaker dinding 6": kabinet membulat yang meruncing ke belakang, gril logam penuh di muka
 * (bayangan woofer & tweeter di baliknya), bracket putar: pelat dinding + lengan + kenop + tali pengaman.
 */
function speakerDinding6(THREE: typeof T, g: T.Group, b: Benda, warna: number, warnaGril: string) {
  const badan = mat(THREE, warna, { roughness: 0.62, metalness: 0.12 });
  const besi = mat(THREE, 0x1d2025, { metalness: 0.55, roughness: 0.4 });
  const dBadan = Math.max(0.06, b.d - 0.06), zMuka = b.d / 2, r = Math.min(b.w, b.h) * 0.2;
  const yT = b.h / 2;
  const kab = badanRuncing(THREE, b.w, b.h, r, dBadan, 0.72, badan, b.h * 0.04);
  kab.position.set(0, yT, zMuka - 0.006); g.add(kab);
  //  Bibir muka sedikit menonjol + gril.
  const bibir = new THREE.Mesh(new THREE.ShapeGeometry(persegiBulat(THREE, b.w, b.h, r), 10), badan);
  bibir.position.set(0, yT, zMuka - 0.006); g.add(bibir);
  const gril = mukaGril(THREE, b.w - 0.012, b.h - 0.012, r * 0.9, warnaGril, 'rgba(4,4,6,0.9)', 1 / 0.045);
  gril.position.set(0, yT, zMuka); g.add(gril);
  const bayang = mat(THREE, 0x0f1012, { roughness: 0.6, metalness: 0.3 });
  for (const [fy, fr] of [[0.36, 0.36], [0.78, 0.1]] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(b.w * fr, 0.0035, 8, 40), bayang);
    ring.position.set(0, b.h * fy, zMuka + 0.003); g.add(ring);
  }
  //  Bracket putar di punggung: pelat dinding tegak, lengan ke kabinet, kenop engsel, tali pengaman.
  const zDinding = -b.d / 2, zPunggung = zMuka - 0.006 - dBadan, yB = b.h * 0.55;
  g.add(blok(THREE, 0.075, 0.17, 0.014, 0.012, besi, 0.003).translateY(yB - 0.085).translateZ(zDinding + 0.007));
  const panjangLengan = Math.max(0.01, zPunggung - (zDinding + 0.014) + 0.01);
  g.add(kotak(THREE, 0.034, 0.05, panjangLengan, besi, 0, yB, zDinding + 0.014 + panjangLengan / 2));
  for (const sx of [-1, 1]) {
    const kenop = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 14), besi);
    kenop.rotation.z = Math.PI / 2; kenop.position.set(sx * 0.024, yB, zDinding + 0.04); g.add(kenop);
  }
  const tali = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, yB - 0.07, zDinding + 0.016), new THREE.Vector3(0.05, yB - 0.13, zDinding + 0.05),
    new THREE.Vector3(0.03, yB - 0.06, zPunggung + 0.004),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(tali, 20, 0.0016, 6, false), mat(THREE, 0xd1d5db, { metalness: 0.8, roughness: 0.3 })));
}

/**
 * Speaker portable aktif: subwoofer di lantai, tiang, dan kolom ramping di atasnya
 * (tinggi total = b.h, lebar/kedalaman subwoofer = b.w x b.d).
 */
function speakerKolom(THREE: typeof T, g: T.Group, b: Benda, warna: number, warnaGril: string) {
  const badan = mat(THREE, warna, { roughness: 0.6, metalness: 0.12 });
  const besi = mat(THREE, 0x1b1d21, { metalness: 0.65, roughness: 0.35 });
  const hSub = Math.min(0.6, Math.max(0.25, b.h * 0.27));
  const hKol = Math.min(0.85, Math.max(0.3, b.h * 0.36));
  const wKol = Math.min(0.13, Math.max(0.06, b.w * 0.27)), dKol = Math.min(0.14, Math.max(0.07, b.d * 0.28));
  g.add(blok(THREE, b.w, hSub, b.d, 0.02, badan, 0.008));
  const gSub = mukaGril(THREE, b.w * 0.9, hSub * 0.86, 0.012, warnaGril, 'rgba(3,3,5,0.9)', 1 / 0.06);
  gSub.position.set(0, hSub * 0.5, b.d / 2 + 0.002); g.add(gSub);
  g.add(kotak(THREE, 0.05, 0.016, 0.004, mat(THREE, 0xe5e7eb), b.w * 0.36, hSub * 0.12, b.d / 2 + 0.004)); // logo
  //  Cangkir tiang + tiang ke kolom.
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.03, 20), besi).translateY(hSub + 0.015));
  const yKol = b.h - hKol, panjangTiang = Math.max(0.05, yKol - hSub);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, panjangTiang, 16), besi).translateY(hSub + panjangTiang / 2));
  g.add(blok(THREE, wKol, hKol, dKol, wKol * 0.25, badan, 0.004).translateY(yKol));
  const gKol = mukaGril(THREE, wKol * 0.84, hKol * 0.95, wKol * 0.2, warnaGril, 'rgba(3,3,5,0.9)', 1 / 0.04);
  gKol.position.set(0, yKol + hKol / 2, dKol / 2 + 0.002); g.add(gKol);
}

/**
 * Line array: n modul berpenampang trapesium bertumpuk dari atas ke bawah, tiap modul
 * menunduk (kemiringan atas + i x sudut antar modul) pada engsel di tepi depan-atasnya.
 * Pelat rigging & pin di kedua sisi; digantung = bumper di atas + dua tali ke plafon.
 */
function lineArray(THREE: typeof T, g: T.Group, b: Benda, warna: number, warnaGril: string) {
  const badan = mat(THREE, warna, { roughness: 0.66, metalness: 0.1 });
  const plat = mat(THREE, 0x3a3f47, { metalness: 0.75, roughness: 0.35 });
  const n = modulLA(b), hm = b.h / n, W = b.w, D = b.d;
  //  Penampang samping trapesium (belakang lebih pendek supaya bisa menekuk), diekstrusi selebar W.
  const bentuk = new THREE.Shape();
  bentuk.moveTo(0, 0); bentuk.lineTo(0, -hm); bentuk.lineTo(D, -hm * 0.88); bentuk.lineTo(D, -hm * 0.12); bentuk.lineTo(0, 0);
  const geoModul = new THREE.ExtrudeGeometry(bentuk, { depth: W, bevelEnabled: false });
  geoModul.rotateY(Math.PI / 2); geoModul.translate(-W / 2, 0, 0);   // x: -W/2..W/2, z: 0..-D
  let y = b.h, z = D / 2;
  for (let i = 0; i < n; i++) {
    const a = ((tiltLADari(b) + i * sudutModulLA(b)) * Math.PI) / 180;
    const engsel = new THREE.Group(); engsel.position.set(0, y, z); engsel.rotation.x = a;
    engsel.add(new THREE.Mesh(geoModul, badan));
    const gril = mukaGril(THREE, W * 0.9, hm * 0.84, 0.006, warnaGril, 'rgba(2,2,4,0.92)', 1 / 0.08);
    gril.position.set(0, -hm / 2, 0.002); engsel.add(gril);
    for (const sx of [-1, 1]) {
      engsel.add(kotak(THREE, 0.008, hm * 0.8, D * 0.42, plat, sx * (W / 2 + 0.004), -hm / 2, -D * 0.7));
      for (const fy of [0.2, 0.8]) {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 10), plat);
        pin.rotation.z = Math.PI / 2; pin.position.set(sx * (W / 2 + 0.014), -hm * fy, -D * 0.12); engsel.add(pin);
      }
      engsel.add(kotak(THREE, 0.004, hm * 0.28, D * 0.22, mat(THREE, 0x070809), sx * (W / 2 + 0.001), -hm * 0.55, -D * 0.4)); // pegangan
    }
    g.add(engsel);
    y -= hm * Math.cos(a); z -= hm * Math.sin(a);
  }
  if (b.gantung) {
    g.add(kotak(THREE, W * 1.08, 0.04, D * 0.95, plat, 0, b.h + 0.02, 0));                         // bumper / frame
    for (const sx of [-0.35, 0.35]) g.add(batang(THREE, 0.008, 0.008, plat, sx * W, -D * 0.1, 'tiang', 0, true)); // tali ke plafon
  }
}

/** speaker */
export function bangunSpeaker({ THREE, g, b, W, WS }: Konteks) {
  const tipe = tipeSpeakerDari(b);
  if (tipe === 'dinding6') { speakerDinding6(THREE, g, b, W(0x17191d), WS('#26292e')); return; }
  if (tipe === 'kolom') { speakerKolom(THREE, g, b, W(0x16181b), WS('#2a2d33')); return; }
  if (tipe === 'linearray') { lineArray(THREE, g, b, W(0x141619), WS('#25282d')); return; }
  const badan = mat(THREE, W(0x16181c), { roughness: 0.55, metalness: 0.15 });
  const gril = new THREE.MeshStandardMaterial({ map: teksturGril(THREE, WS('#3a3e45'), 'rgba(5,5,8,0.85)', 1 / 0.05), roughness: 0.65, metalness: 0.35 });
  const besi = mat(THREE, 0x22252a, { metalness: 0.6, roughness: 0.4 });
  const dBadan = b.d * 0.82, belakangBadan = b.d / 2 - dBadan;
  g.add(blok(THREE, b.w, b.h, dBadan, b.w * 0.16, badan, 0.012).translateZ(b.d / 2 - dBadan / 2));
  g.add(blok(THREE, b.w * 0.9, b.h * 0.93, 0.008, b.w * 0.13, gril, 0.003).translateY(b.h * 0.035).translateZ(b.d / 2 + 0.002));
  //  Bayangan woofer & tweeter di balik gril (seperti foto produk).
  const bayang = mat(THREE, 0x1c1e22, { roughness: 0.6, metalness: 0.3 });
  for (const [fy, fr] of [[0.34, 0.33], [0.78, 0.11]] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(b.w * fr, 0.003, 8, 40), bayang);
    ring.position.set(0, b.h * fy, b.d / 2 + 0.0065); g.add(ring);
  }
  //  Bracket: pelat dinding di sisi belakang + lengan ke punggung kabinet.
  g.add(blok(THREE, 0.07, 0.11, 0.012, 0.012, besi).translateY(b.h / 2 - 0.055).translateZ(-b.d / 2 + 0.006));
  const panjangLengan = Math.max(0.01, belakangBadan - (-b.d / 2 + 0.012));
  g.add(kotak(THREE, 0.028, 0.028, panjangLengan, besi, 0, b.h / 2, -b.d / 2 + 0.012 + panjangLengan / 2));
}

/** speaker-plafon */
export function bangunSpeakerPlafon({ THREE, g, b, W, WS }: Konteks) {
  const putih = mat(THREE, W(0xf4f5f7), { roughness: 0.45 });
  const gril = new THREE.MeshStandardMaterial({ map: teksturGril(THREE, WS('#eef0f3'), 'rgba(70,75,85,0.55)', b.w / 0.048), roughness: 0.6 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(b.w / 2 - 0.01, b.w / 2 - 0.01, Math.max(0.01, b.h - 0.012), 32), mat(THREE, 0x1f2125)).translateY(0.012 + (b.h - 0.012) / 2));
  const cincin = new THREE.Mesh(new THREE.TorusGeometry(b.w / 2 + 0.006, 0.008, 10, 48), putih);
  cincin.rotation.x = Math.PI / 2; cincin.position.y = 0.008; g.add(cincin);
  const muka = new THREE.Mesh(new THREE.CircleGeometry(b.w / 2, 48), gril);
  muka.rotation.x = Math.PI / 2; muka.position.y = 0.004; g.add(muka);
}

/** mic */
export function bangunMic({ THREE, g, b, W, WS }: Konteks) {
  const hitam = mat(THREE, W(0x111827), { metalness: 0.5, roughness: 0.4 });
  if (b.mic === 'boundary') {
    //  Cakram bundar berkain abu-abu dengan cincin LED hijau + ikon mic di tengah (mic konferensi puck).
    const R = b.w / 2, alas = 0.004;
    const kain = new THREE.MeshStandardMaterial({ map: teksturMicBoundary(THREE, 'kain', WS('#6d6e72')), roughness: 1, metalness: 0 });
    const sisi = new THREE.MeshStandardMaterial({ color: W(0x66676b), roughness: 0.95 });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.93, R * 0.93, alas, 48), mat(THREE, 0x2a2d31, { roughness: 0.8 })).translateY(alas / 2));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.97, R, b.h - alas, 64), [sisi, kain, sisi]).translateY(alas + (b.h - alas) / 2));
    const ikon = new THREE.Mesh(new THREE.CircleGeometry(R * 0.97, 48),
      new THREE.MeshBasicMaterial({ map: teksturMicBoundary(THREE, 'ikon'), transparent: true, toneMapped: false, depthWrite: false }));
    ikon.rotation.x = -Math.PI / 2; ikon.position.y = b.h + 0.0006; g.add(ikon);
  } else {
    g.add(kotak(THREE, b.w, 0.03, b.d * 0.9, hitam, 0, 0.015, 0)); // dasar + tombol
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 12), mat(THREE, 0xef4444, { emissive: 0xef4444, emissiveIntensity: 0.9 })).translateY(0.032).translateZ(b.d * 0.25));
    const kurva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.03, -b.d * 0.2), new THREE.Vector3(0, b.h * 0.55, -b.d * 0.15),
      new THREE.Vector3(0, b.h * 0.9, b.d * 0.15), new THREE.Vector3(0, b.h * 0.95, b.d * 0.45),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(kurva, 24, 0.006, 8, false), hitam));
    const kapsul = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.06, 16), hitam);
    kapsul.rotation.x = Math.PI / 2 - 0.3; kapsul.position.set(0, b.h * 0.94, b.d * 0.5); g.add(kapsul);
  }
}

/** touchpanel */
export function bangunTouchpanel({ THREE, g, b, W }: Konteks) {
  const perak = mat(THREE, W(0xc7ccd3), { metalness: 0.85, roughness: 0.28 });
  const hitam = mat(THREE, 0x0b0d10, { roughness: 0.2, metalness: 0.3 });
  g.add(blok(THREE, b.w * 0.5, 0.035, b.d * 0.55, 0.012, perak, 0.006).translateZ(-b.d * 0.05));
  const layar = new THREE.Group();
  layar.add(blok(THREE, b.w, b.h, 0.014, 0.012, perak, 0.004).translateY(-b.h / 2));
  layar.add(blok(THREE, b.w * 0.965, b.h * 0.94, 0.004, 0.008, hitam, 0.0015).translateY(-b.h * 0.47).translateZ(0.007));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 0.86, b.h * 0.8), new THREE.MeshBasicMaterial({ map: teksturPanel(THREE), toneMapped: false }));
  m.position.z = 0.0095; layar.add(m);
  layar.rotation.x = -0.95; layar.position.set(0, b.h * 0.45, 0); g.add(layar);
}

/** rak */
export function bangunRak({ THREE, g, b, W }: Konteks) {
  //  Rack 19": rangka & panel besi, rel depan, isi perangkat (tekstur per U) di belakang pintu.
  //  Kaca = isi terlihat; tertutup = pintu besi berlubang; open frame = tanpa pintu & panel samping.
  const tipe = b.tipeRak ?? 'kaca';
  const besi = mat(THREE, W(0x15171b), { metalness: 0.55, roughness: 0.45 });
  const U = Math.max(4, b.rakU ?? 20), u = 0.04445, yRel = 0.08, tinggiRel = U * u;
  const tiang = 0.035, sisi = 0.012;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(kotak(THREE, tiang, b.h, tiang, besi, sx * (b.w / 2 - tiang / 2), b.h / 2, sz * (b.d / 2 - tiang / 2)));
  for (const y of [0.04, b.h - 0.02]) g.add(kotak(THREE, b.w, y < 0.1 ? 0.08 : 0.04, b.d, besi, 0, y, 0));
  if (tipe !== 'open') {
    for (const sx of [-1, 1]) g.add(kotak(THREE, sisi, b.h - 0.12, b.d - 0.04, besi, sx * (b.w / 2 - sisi / 2), b.h / 2, 0));
    g.add(kotak(THREE, b.w - 0.04, b.h - 0.12, sisi, besi, 0, b.h / 2, -b.d / 2 + sisi / 2));
    //  Ventilasi atas.
    for (let i = 0; i < 2; i++) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.004, 24), mat(THREE, 0x0a0b0d)).translateX((i - 0.5) * b.w * 0.4).translateY(b.h + 0.001));
  }
  //  Rel 19" & isi perangkat.
  const lebarIsi = Math.min(0.4826, b.w - 0.08), zIsi = b.d / 2 - 0.09;
  const rel = mat(THREE, 0x9ca3af, { metalness: 0.85, roughness: 0.3 });
  for (const sx of [-1, 1]) g.add(kotak(THREE, 0.018, tinggiRel, 0.02, rel, sx * (lebarIsi / 2 + 0.006), yRel + tinggiRel / 2, zIsi));
  const isi = new THREE.Mesh(new THREE.PlaneGeometry(lebarIsi, tinggiRel), new THREE.MeshStandardMaterial({ map: teksturIsiRak(THREE, b), roughness: 0.55, metalness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.08 }));
  isi.position.set(0, yRel + tinggiRel / 2, zIsi + 0.006); g.add(isi);
  g.add(kotak(THREE, lebarIsi, tinggiRel, 0.004, mat(THREE, 0x08090b), 0, yRel + tinggiRel / 2, zIsi - 0.004));
  //  Pintu depan.
  if (tipe !== 'open') {
    const zPintu = b.d / 2 - 0.01, lebarRangka = 0.035;
    const rangka = mat(THREE, W(0x15171b), { metalness: 0.5, roughness: 0.4 });
    g.add(kotak(THREE, b.w - 0.01, lebarRangka, 0.02, rangka, 0, b.h - 0.06, zPintu));
    g.add(kotak(THREE, b.w - 0.01, lebarRangka, 0.02, rangka, 0, 0.1, zPintu));
    for (const sx of [-1, 1]) g.add(kotak(THREE, lebarRangka, b.h - 0.16, 0.02, rangka, sx * (b.w / 2 - 0.0225), b.h / 2 + 0.02, zPintu));
    const lebarDaun = b.w - 0.08, tinggiDaun = b.h - 0.2;
    if (tipe === 'kaca') {
      g.add(kotak(THREE, lebarDaun, tinggiDaun, 0.005, new THREE.MeshPhysicalMaterial({ color: 0x1e293b, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, clearcoat: 1 }), 0, b.h / 2 + 0.02, zPintu));
    } else {
      const lubang = kanvas(256, 512, gg => {
        gg.fillStyle = '#16181c'; gg.fillRect(0, 0, 256, 512);
        gg.fillStyle = '#050607';
        for (let y = 6; y < 512; y += 9) for (let x = (y / 9) % 2 ? 6 : 10.5; x < 256; x += 9) { gg.beginPath(); gg.arc(x, y, 2.6, 0, Math.PI * 2); gg.fill(); }
      });
      const tl = new THREE.CanvasTexture(lubang); tl.colorSpace = THREE.SRGBColorSpace;
      g.add(new THREE.Mesh(new THREE.BoxGeometry(lebarDaun, tinggiDaun, 0.006), new THREE.MeshStandardMaterial({ map: tl, metalness: 0.5, roughness: 0.45 })).translateY(b.h / 2 + 0.02).translateZ(zPintu));
    }
    g.add(kotak(THREE, 0.015, 0.16, 0.025, mat(THREE, 0xb8bec7, { metalness: 0.9, roughness: 0.2 }), b.w / 2 - 0.06, b.h * 0.55, zPintu + 0.018));
  }
  //  Kaki / roda.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 14), mat(THREE, 0x0a0b0d)).translateX(sx * (b.w / 2 - 0.05)).translateY(0.01).translateZ(sz * (b.d / 2 - 0.05)));
}
