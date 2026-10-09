/**
 * desain3d/bangun/dongle.ts - Dongle share layar nirkabel WyreStorm, mengikuti foto produk
 * (depan, atas & samping):
 *   - tampak atas: leher menyatu LEBAR ke puck, menyempit cekung, menebal sedikit sebelum USB-C
 *   - puck bertingkat (tampak samping): kaki kecil menjorok, pita ventilasi gelap berlubang kecil,
 *     dinding samping bertekstur pasir bertulisan "WyreStorm", tepi atas miring (chamfer)
 *   - muka atas: cincin luar abu, cincin perak tipis, cakram tengah bertekstur, logo merah
 *     (sayap + tiga bilah tegak), ikon share layar di sambungan leher menimpa cincin
 * Tergeletak di meja: puck di +z, colokan di -z, alas y = 0. Panjang L (± 0,17 m), Ø puck ± 7 cm.
 */
import type * as T from 'three';
import { lempeng, mat, papan, persegiBulat } from './dasar';

/** Kanvas bertekstur pasir (bintik halus) - opsional tulisan / lubang ventilasi berulang di sekeliling. */
function teksturSisi(THREE: typeof T, isi: 'tulisan' | 'ventilasi' | 'polos', ulang: number): T.Texture {
  const W = 1024, H = isi === 'polos' ? 256 : 96;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = isi === 'ventilasi' ? '#232428' : '#393b40'; g.fillRect(0, 0, W, H);
  //  Bintik pasir: titik terang & gelap acak (benih tetap supaya sama tiap kali dibangun).
  let s = 7;
  const acak = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < W * H * 0.06; i++) { g.fillStyle = acak() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.18)'; g.fillRect(acak() * W, acak() * H, 1.4, 1.4); }
  if (isi === 'tulisan') {
    g.fillStyle = '#c9ccd2'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `italic 900 ${H * 0.62}px Arial Black, Arial, sans-serif`;
    g.fillText('WyreStorm', W / 2, H * 0.52);
  } else if (isi === 'ventilasi') {
    //  Tiga kelompok lubang tetes kecil per putaran tekstur.
    g.fillStyle = '#0d0e10';
    for (let k = 0; k < 3; k++) for (let i = 0; i < 9; i++) {
      const x = W * (k / 3 + 0.04) + i * (W / 3 * 0.1);
      g.beginPath(); g.ellipse(x, H * 0.5, W * 0.0045, H * 0.24, 0, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(ulang, 1); t.anisotropy = 4;
  //  Tulisan (tengah kanvas) tepat di depan (+z) & belakang dinding.
  if (isi === 'tulisan') t.offset.x = 0.5;
  return t;
}

export function modelDongle(THREE: typeof T, L = 0.17, warnaBadan?: number) {
  const g = new THREE.Group();
  const r = Math.min(0.036, L * 0.21), zPuck = L / 2 - r;
  const tLeher = 0.0095;
  const warna = warnaBadan ?? 0xffffff;
  const badan = new THREE.MeshPhysicalMaterial({ color: warnaBadan ?? 0x34363b, roughness: 0.5, metalness: 0.08, clearcoat: 0.3, clearcoatRoughness: 0.5 });
  const pasir = (isi: 'tulisan' | 'ventilasi' | 'polos', ulang: number) =>
    new THREE.MeshStandardMaterial({ color: warna, map: teksturSisi(THREE, isi, ulang), roughness: 0.82, metalness: 0.05 });
  const perak = mat(THREE, 0xe2e5ea, { metalness: 1, roughness: 0.14 });

  //  1) Tampak atas: leher menyatu lebar, menyempit, menebal lagi dekat colokan. Lingkaran dasarnya
  //     seukuran KAKI puck (tersembunyi di bawahnya) - hanya leher & lengkung sambungannya yang terlihat.
  const zUjung = -L / 2 + 0.0075;
  const a = (40 * Math.PI) / 180, rD = r * 0.8;
  const sx = rD * Math.sin(a), sz = zPuck - rD * Math.cos(a);
  const wUjung = 0.0068, wTebal = 0.0074, wRamping = 0.0056;
  const zTebal = zUjung + 0.012, zRamping = zUjung + (sz - zUjung) * 0.42;
  const tx = Math.cos(a), tz = Math.sin(a);
  const s = new THREE.Shape();
  s.moveTo(wUjung, zUjung);
  s.quadraticCurveTo(wTebal, zUjung + 0.005, wTebal, zTebal);
  s.quadraticCurveTo(wRamping, zTebal + 0.012, wRamping, zRamping);
  s.bezierCurveTo(wRamping, zRamping + (sz - zRamping) * 0.55, sx - tx * 0.018, sz - tz * 0.018, sx, sz);
  s.absarc(0, zPuck, rD, -Math.PI / 2 + a, -Math.PI / 2 - a + Math.PI * 2, false);
  s.bezierCurveTo(-sx + tx * 0.018, sz - tz * 0.018, -wRamping, zRamping + (sz - zRamping) * 0.55, -wRamping, zRamping);
  s.quadraticCurveTo(-wRamping, zTebal + 0.012, -wTebal, zTebal);
  s.quadraticCurveTo(-wTebal, zUjung + 0.005, -wUjung, zUjung);
  s.closePath();
  g.add(lempeng(THREE, s, tLeher, 0.0038, badan, 48));

  //  2) Puck bertingkat (tampak samping), dari bawah: kaki menjorok, pita ventilasi, dinding bertulisan, chamfer.
  const yKaki = 0.0016, yVent = 0.0046, yDinding = 0.0145, yAtas = 0.0172;
  const cincinTingkat = (rAtas: number, rBawah: number, y0: number, y1: number, m: T.Material) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(rAtas, rBawah, y1 - y0, 72, 1, true), m);
    o.position.set(0, (y0 + y1) / 2, zPuck); g.add(o);
  };
  cincinTingkat(r * 0.8, r * 0.8, 0, yKaki, mat(THREE, 0x2b2d31, { roughness: 0.6 }));
  cincinTingkat(r * 0.955, r * 0.955, yKaki, yVent, pasir('ventilasi', 1));
  cincinTingkat(r, r, yVent, yDinding, pasir('tulisan', 2));
  //  Chamfer: kerucut terpancung dari tepi dinding ke muka atas.
  cincinTingkat(r * 0.9, r, yDinding, yAtas, pasir('polos', 3));
  //  Alas bawah & tepi bawah dinding (menutup tingkat), muka atas pasir.
  for (const [rr, y, m] of [[r * 0.8, 0.0001, badan], [r, yVent, badan]] as const) {
    const tutup = new THREE.Mesh(new THREE.RingGeometry(rr === r ? r * 0.955 : 0, rr, 72), m);
    tutup.rotation.x = Math.PI / 2; tutup.position.set(0, y, zPuck); g.add(tutup);
  }
  const muka = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 72), pasir('polos', 1));
  muka.rotation.x = -Math.PI / 2; muka.position.set(0, yAtas, zPuck); g.add(muka);

  //  3) Cincin perak tipis & cakram tengah sedikit cembung (tekstur halus, sedikit lebih terang).
  const rCincin = r * 0.68;
  const cincin = new THREE.Mesh(new THREE.TorusGeometry(rCincin, 0.0012, 12, 80), perak);
  cincin.rotation.x = Math.PI / 2; cincin.position.set(0, yAtas + 0.0002, zPuck); g.add(cincin);
  const cakram = new THREE.Mesh(new THREE.SphereGeometry(rCincin - 0.001, 56, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: teksturSisi(THREE, 'polos', 1), roughness: 0.9 }));
  cakram.scale.y = 0.04; cakram.position.set(0, yAtas - 0.0002, zPuck); g.add(cakram);

  //  4) Logo merah: sayap kiri melengkung + tiga bilah tegak yang memendek ke kanan (bentuk 2D: y ke arah leher).
  //  Tanpa tone mapping supaya merahnya pekat seperti foto (bukan merah muda pucat).
  const merah = new THREE.MeshBasicMaterial({ color: 0xd3121e, toneMapped: false, side: THREE.DoubleSide });
  const u = rCincin / 0.0245;
  const bentuk: T.Shape[] = [];
  const sayap = new THREE.Shape();
  sayap.moveTo(-0.0125 * u, 0.0062 * u);
  sayap.quadraticCurveTo(-0.0068 * u, -0.0004 * u, -0.0042 * u, -0.0072 * u);
  sayap.lineTo(-0.0006 * u, -0.0072 * u);
  sayap.lineTo(-0.0006 * u, 0.0018 * u);
  sayap.quadraticCurveTo(-0.0055 * u, 0.0032 * u, -0.0125 * u, 0.0062 * u);
  bentuk.push(sayap);
  for (let i = 0; i < 3; i++) {
    const x = 0.0006 * u + i * 0.0036 * u, atas = 0.0012 * u - i * 0.0024 * u;
    const bilah = new THREE.Shape();
    bilah.moveTo(x, -0.0072 * u); bilah.lineTo(x + 0.0026 * u, -0.0072 * u);
    bilah.lineTo(x + 0.0026 * u, atas - 0.0016 * u); bilah.lineTo(x, atas); bilah.closePath();
    bentuk.push(bilah);
  }
  const logo = new THREE.Mesh(new THREE.ShapeGeometry(bentuk, 16), merah);
  logo.rotation.x = -Math.PI / 2; logo.position.set(0, yAtas + 0.0011, zPuck + 0.001); g.add(logo);

  //  5) Ikon share layar di sambungan leher (jam 12), menimpa cincin perak.
  const zIkon = zPuck - rCincin;
  const tab = papan(THREE, 0.0095, 0.0082, 0.0008, 0.0024, badan, 0.0003);
  tab.position.set(0, yAtas - 0.0002, zIkon); g.add(tab);
  const garis = new THREE.MeshBasicMaterial({ color: 0xc3c7cd });
  const layar = new THREE.Mesh(new THREE.RingGeometry(0.0021, 0.0026, 4, 1, Math.PI / 4), garis);
  layar.scale.set(1.15, 0.85, 1); layar.rotation.x = -Math.PI / 2; layar.position.set(0, yAtas + 0.0008, zIkon); g.add(layar);
  const orang = new THREE.Mesh(new THREE.CircleGeometry(0.0007, 12), garis);
  orang.rotation.x = -Math.PI / 2; orang.position.set(0, yAtas + 0.0009, zIkon + 0.0002); g.add(orang);

  //  6) Colokan USB-C: cangkang perak membulat + celah hitam.
  const cangkang = new THREE.Mesh(new THREE.ExtrudeGeometry(persegiBulat(THREE, 0.0084, 0.0026, 0.0013), { depth: 0.0072, bevelEnabled: false, curveSegments: 8 }), perak);
  cangkang.position.set(0, tLeher / 2, -L / 2); g.add(cangkang);
  const celah = new THREE.Mesh(new THREE.PlaneGeometry(0.0066, 0.0011), new THREE.MeshBasicMaterial({ color: 0x0b0c0e }));
  celah.rotation.y = Math.PI; celah.position.set(0, tLeher / 2, -L / 2 - 0.0001); g.add(celah);
  return g;
}
