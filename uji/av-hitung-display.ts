/**
 * uji/av-hitung-display.ts - BOM videowall LCD & interactive flat panel (lib/av-hitung-display.ts).
 * Angka pembanding dihitung manual.
 *
 * Jalankan: npx tsx uji/av-hitung-display.ts
 */
import { totalPenawaran } from '../lib/av-hitung-bom';
import { bomIFP, bomVideowall, dayaVideowall, type MasukanIFP, type MasukanVideowall, saranIFP } from '../lib/av-hitung-display';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const qty = (b: { kunci: string; qty: number }[], k: string) => b.find(x => x.kunci === k)?.qty ?? 0;

const vw: MasukanVideowall = { namaPanel: '55" 1,8 mm', kolom: 3, baris: 3, screen: 1, cadanganPanel: 0, pasang: 'pop-out',
  sinyal: 'controller', input: 2, panjangSinyal: 10, wattPanel: 180, mediaPlayer: 1 };

console.log('\nVideowall 3 × 3, controller');
const b1 = bomVideowall(vw);
cek('9 panel, 9 bracket pop-out', qty(b1, 'panel') === 9 && qty(b1, 'pasang') === 9);
cek('1 controller 2 input × 9 output', qty(b1, 'controller') === 1 && b1.find(x => x.kunci === 'controller')!.item.includes('2 input × 9 output'));
cek('9 kabel HDMI controller ke panel', qty(b1, 'kabel-sinyal') === 9);
cek('8 kabel kontrol daisy chain', qty(b1, 'kontrol') === 8);
cek('spare 0% tidak muncul sebagai baris', !b1.some(x => x.kunci === 'panel-cadangan'));
//  9 × 180 + 150 + 60 = 1830 W; / 0,9 / 220 = 9,24 A -> 1 jalur MCB 16 A (12,8 A).
const d1 = dayaVideowall(vw);
cek('daya 1830 W, 9,24 A, 1 jalur MCB 16 A', d1.totalW === 1830 && Math.abs(d1.arusA - 9.242) < 0.01 && d1.sirkuit === 1);
cek('stop kontak: (9 panel + 1 player + 1 controller) / 8 = 2', qty(b1, 'stop-kontak') === 2);
cek('kunci baris unik (harga per baris)', new Set(b1.map(x => x.kunci)).size === b1.length);

console.log('\nVideowall 4 × 4 × 2, loop-through, floor stand, spare 5%');
const b2 = bomVideowall({ ...vw, kolom: 4, baris: 4, screen: 2, sinyal: 'loop', pasang: 'standfloor', cadanganPanel: 5, wattPanel: 300 });
cek('32 panel, spare ceil(1,6) = 2', qty(b2, 'panel') === 32 && qty(b2, 'panel-cadangan') === 2);
cek('floor stand 1 set per videowall (2), bukan per panel', qty(b2, 'pasang') === 2);
cek('tanpa controller; 2 kabel HDMI ke panel pertama; 30 kabel loop', qty(b2, 'controller') === 0 && qty(b2, 'kabel-sinyal') === 2 && qty(b2, 'loop') === 30);
//  16 × 300 + 60 = 4860 W -> 24,5 A -> 2 jalur per videowall, 4 total.
cek('4860 W / videowall -> 2 jalur, 4 total', qty(b2, 'sirkuit') === 4);
cek('kunci baris unik', new Set(b2.map(x => x.kunci)).size === b2.length);

console.log('\nVideowall matrix');
const b3 = bomVideowall({ ...vw, kolom: 2, baris: 2, sinyal: 'matrix', input: 6, panjangSinyal: 20 });
cek('matrix dibulatkan ke ukuran standar 8 × 4', b3.find(x => x.kunci === 'controller')!.item.includes('8 × 4'));
cek('kabel > 15 m diberi saran extender', b3.find(x => x.kunci === 'kabel-sinyal')!.ket.includes('extender'));

console.log('\nIFP');
cek('6 m analitis: tinggi 1 m, diagonal ±80,3" -> 86"', (() => { const s = saranIFP(6, 'analitis', [65, 75, 86, 98]); return Math.abs(s.diagonalMin - 80.3) < 0.1 && s.saran === 86; })());
cek('15 m detail (tinggi 3,75 m) melebihi 110" -> tidak ada saran', saranIFP(15, 'detail', [65, 75, 86, 98, 110]).saran === null);
const ifp: MasukanIFP = { namaUnit: '86"', diagonal: 86, ruang: 3, pasang: 'dinding', ops: true, kamera: true, mic: false, dongle: 2, panjangMeja: 4, wattUnit: 350 };
const b4 = bomIFP(ifp);
cek('3 ruang: 3 IFP, 3 bracket, 3 OPS, 3 kamera, tanpa mic', qty(b4, 'ifp') === 3 && qty(b4, 'pasang') === 3 && qty(b4, 'ops') === 3 && qty(b4, 'kamera') === 3 && qty(b4, 'mic') === 0);
cek('dongle 2 / ruang = 6', qty(b4, 'dongle') === 6);
cek('meja 4 m: kabel USB sentuh pasif', b4.find(x => x.kunci === 'usb')!.item.startsWith('Kabel USB'));
cek('meja 8 m: USB extender aktif', bomIFP({ ...ifp, panjangMeja: 8 }).find(x => x.kunci === 'usb')!.item.includes('extender'));
cek('troli menggantikan bracket', bomIFP({ ...ifp, pasang: 'troli' }).find(x => x.kunci === 'pasang')!.item.includes('troli'));

console.log('\nPenawaran');
const t = totalPenawaran(b4, { ifp: 50_000_000, pasang: 1_500_000 }, 11);
cek('3 × 50 jt + 3 × 1,5 jt = 154,5 jt; PPN 11% = 16.995.000', t.subtotal === 154_500_000 && t.ppn === 16_995_000 && t.total === 171_495_000);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
