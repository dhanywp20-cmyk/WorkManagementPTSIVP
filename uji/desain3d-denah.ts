/**
 * uji/desain3d-denah.ts - Denah 2D (inti/denah.ts) & formatnya (inti/denahFormat.ts): dinding dengan
 * pintu / jendela, tapak benda ikut rotasi, benda plafon putus-putus, garis ukur, skala cetak, SVG & DXF.
 *
 * Jalankan: npm test -- desain3d-denah
 */
import {
  type Benda, denahDari, dxfDenah, KATEGORI_RUANG, type Ruang, skalaDenah, sudutTapak, svgDenah, templateRuang,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const dekat = (a: number, b: number, t = 1e-6) => Math.abs(a - b) < t;

console.log('\n1. Tapak benda');
const s0 = sudutTapak({ x: 2, z: 3, w: 2, d: 1, rot: 0 });
cek('tanpa rotasi: lebar di x, dalam di z', dekat(Math.min(...s0.map(p => p[0])), 1) && dekat(Math.max(...s0.map(p => p[1])), 3.5));
const s90 = sudutTapak({ x: 2, z: 3, w: 2, d: 1, rot: 90 });
cek('rotasi 90°: lebar pindah ke z', dekat(Math.max(...s90.map(p => p[1])) - Math.min(...s90.map(p => p[1])), 2));

console.log('\n2. Dinding, pintu, jendela');
const ruang: Ruang = { p: 6, l: 5, t: 3, lantai: 'kayu', r2: null, bukaan: [
  { id: 'p', ruang: 0, sisi: 'belakang', jenis: 'pintu', posisi: 1, lebar: 0.9, tinggi: 2.1, ambang: 0 },
  { id: 'j', ruang: 0, sisi: 'kiri', jenis: 'jendela', posisi: 2, lebar: 1.5, tinggi: 1.2, ambang: 0.9 },
] };
const kosong = denahDari({ ...ruang, bukaan: [] }, []);
const panjangDinding = (d: ReturnType<typeof denahDari>) => d.garis.filter(g => g.lapis === 'DINDING').reduce((n, g) => n + Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]), 0);
cek('ruang kosong: keliling dinding 22 m', dekat(panjangDinding(kosong), 22, 1e-3));
const d = denahDari(ruang, []);
cek('pintu & jendela memotong dinding (22 - 0,9 - 1,5)', dekat(panjangDinding(d), 22 - 0.9 - 1.5, 1e-3));
cek('pintu punya busur ayun 90°', d.busur.length === 1 && dekat((((d.busur[0].a1 - d.busur[0].a0) % 360) + 360) % 360, 90, 1e-6));
const busur = d.busur[0];
cek('pintu dinding belakang berpusat di x = 6 - 1 (dilihat dari dalam), engsel di 5,45 m', dekat(busur.c[0], 5.45) && dekat(busur.c[1], 5) && dekat(busur.r, 0.9));

console.log('\n3. Benda, teks, ukuran');
const benda: Benda[] = [
  { id: 'vw', jenis: 'videowall', nama: 'Videowall', x: 3, z: 0.06, w: 2, h: 1.2, d: 0.1, elev: 1, rot: 0 },
  { id: 'sp', jenis: 'speaker-plafon', nama: 'Speaker plafon', x: 2, z: 2, w: 0.2, h: 0.1, d: 0.2, elev: 2.9, rot: 0 },
  { id: 'tx', jenis: 'teks', nama: 'Keterangan', teks: 'Area tamu', x: 4, z: 4, w: 1, h: 0.01, d: 0.3, elev: 0, rot: 0, hadapTeks: 'lantai' },
];
const db = denahDari(ruang, benda);
cek('benda plafon digambar putus-putus', db.garis.filter(g => g.lapis === 'PLAFON').every(g => g.putus) && db.garis.some(g => g.lapis === 'PLAFON'));
cek('teks jadi tulisan, bukan kotak', db.tulisan.some(t => t.teks === 'Area tamu') && !db.tulisan.some(t => t.teks.startsWith('Keterangan')));
cek('label benda dinding menyebut elevasi', db.tulisan.some(t => t.teks === 'Videowall · el. +1.000'));
cek('ukuran ruang 6.000 & 5.000 mm', db.tulisan.some(t => t.teks === '6.000') && db.tulisan.some(t => t.teks === '5.000'));
cek('rantai ukur display: 2.000 / 2.000 / 2.000', db.tulisan.filter(t => t.lapis === 'UKURAN' && t.teks === '2.000').length === 3);

console.log('\n4. Skala & format');
cek('ruang 6 × 5 m muat A4 di 1:50', skalaDenah(d) === 50);
cek('ruang 40 m pakai skala lebih kecil', skalaDenah(denahDari({ ...ruang, p: 40, l: 30 }, [])) >= 250);
const svg = svgDenah(db, 50);
cek('SVG lebar dalam mm sesuai skala', /width="[\d.]+mm"/.test(svg) && svg.includes('Skala 1:50'));
cek('SVG aman (teks di-escape)', !svgDenah(denahDari(ruang, [{ ...benda[0], nama: '<script>' }])).includes('<script>'));
const dxf = dxfDenah(db, 50);
cek('DXF diawali SECTION & diakhiri EOF', dxf.startsWith('  0\r\nSECTION') && dxf.trimEnd().endsWith('EOF'));
cek('DXF punya lapis & satuan mm', dxf.includes('\r\nLAYER\r\n') && dxf.includes('$INSUNITS\r\n 70\r\n4'));
cek('DXF: karakter non-ASCII jadi \\U+XXXX', dxfDenah(denahDari(ruang, [{ ...benda[0], nama: 'Layar 2×2' }])).includes('Layar 2\\U+00D7'));
cek('DXF dalam mm (dinding 6.000 mm)', dxf.includes('\r\n6000\r\n'));

console.log('\n5. Semua template pabrik');
for (const k of KATEGORI_RUANG) {
  const t = templateRuang(k.id);
  const dd = denahDari(t.ruang, t.benda);
  cek(`${k.id}: denah & DXF jadi`, dd.garis.length > 4 && Number.isFinite(dd.batas.x1) && dxfDenah(dd).length > 1000);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
