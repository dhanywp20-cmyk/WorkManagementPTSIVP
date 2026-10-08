/**
 * uji/led-banding.ts - bandingkan pitch LED (konsisten dengan hitungLED), saran pitch dari jarak
 * penonton terdekat, batas kanvas & garis cabinet pola uji.
 *
 * Jalankan: npx tsx uji/led-banding.ts
 */
import { MODUL_LED } from '../lib/av-hitung';
import { bandingPitch, garisCabinet, labelCabinet, polaUjiBisa, saranPitch } from '../lib/led-banding';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

const pilih = MODUL_LED.filter(m => ['P1.86', 'P2.5', 'P3.84'].includes(m.kode));
const o = { lebarM: 4, tinggiM: 2.25, bulat: 'round' as const, perM2: () => ({ daya: 600, berat: 30 }), faktorRata: 0.33, refresh: 60 as const, bit: 8 as const, tegangan: 220, faktorDaya: 0.95 };
const b = bandingPitch(pilih, o);
const p25 = b.find(x => x.modul.kode === 'P2.5')!;

console.log('\nBandingkan pitch');
cek('P2.5 modul 320×160 untuk 4 × 2,25 m -> 13 × 14 modul (round)', p25.kolom === 13 && p25.baris === 14);
cek('resolusi P2.5 = 1664 × 896 (13×128, 14×64)', p25.h.resX === 1664 && p25.h.resY === 896);
cek('pitch lebih halus = resolusi lebih tinggi', b.find(x => x.modul.kode === 'P1.86')!.h.totalPx > p25.h.totalPx && p25.h.totalPx > b.find(x => x.modul.kode === 'P3.84')!.h.totalPx);
cek('daya dari W/m²: luas nyata × 600 W', Math.abs(p25.h.dayaMaksW - p25.h.luasM2 * 600) < 1);
cek('selisih ukuran = nyata − target', Math.abs(p25.selisihLebarM - (p25.h.lebarM - 4)) < 1e-9);

console.log('\nSaran pitch');
cek('penonton terdekat 8 m -> P2.5 nyaman (ideal 7,5 m), bukan P3.84 (ideal 11,5 m)', (() => { const x = saranPitch(b, 8); return x?.modul.kode === 'P2.5' && x.nyaman; })());
cek('penonton terdekat 4 m -> P3.84 cukup (min 3,84 m) tapi belum nyaman', (() => { const x = saranPitch(b, 4); return x?.modul.kode === 'P3.84' && !x.nyaman; })());
cek('penonton terdekat 1 m -> tidak ada yang cukup', saranPitch(b, 1) === null);

console.log('\nPola uji');
cek('4K boleh, 20000 px lebar tidak', polaUjiBisa(3840, 2160) && !polaUjiBisa(20000, 1000));
const g = garisCabinet(3, 2, 128, 64);
cek('garis cabinet 3 × 2 @128×64: x 0..384, y 0..128', g.x.join() === '0,128,256,384' && g.y.join() === '0,64,128');
cek('label cabinet kiri-atas K1B1, (2,1) -> K3B2', labelCabinet(0, 0) === 'K1B1' && labelCabinet(2, 1) === 'K3B2');

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
