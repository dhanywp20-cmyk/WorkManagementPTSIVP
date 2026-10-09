/**
 * uji/desain3d-pustaka.ts - benda Desain 3D diisi dari Pustaka Tools Team: entri yang cocok per
 * jenis benda, proyektor (lumen & zoom), panel videowall (ukuran set = area aktif + bezel), TV, speaker.
 *
 * Jalankan: npx tsx uji/desain3d-pustaka.ts
 */
import { bendaBaru, cocokPustaka, isiDariPustaka, spekVideowall, terapkanUkuran } from '../app/(portal)/tools-team/_components/desain3d/inti';
import type { EntriPustaka } from '../lib/pustaka';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const e = (jenis: string, nama: string, data: Record<string, string | number>): EntriPustaka => ({ id: nama, jenis, nama, data });
const kotak = { x0: 0, p: 8, l: 6, t: 3 };
const dekat = (a: number, b: number, t = 1e-3) => Math.abs(a - b) < t;

const proy = e('proyektor', 'Laser 7.000', { lumen: 7000, throwMin: 1.2, throwMaks: 1.8, resolusi: 'WUXGA' });
const panel = e('display', 'Panel 55 0,88', { diagonal: 55, bezel: 0.88, resolusi: 'FHD', watt: 200 });
const tv = e('display', 'TV 86', { diagonal: 86, bezel: 0 });
const spkPlafon = e('speaker', 'Plafon 6', { tipe: 'plafon', sensitivitas: 89, sudut: 110 });
const spkDinding = e('speaker', 'Dinding 8', { tipe: 'dinding', sensitivitas: 91, sudut: 90 });

console.log('\nEntri yang cocok');
cek('panel videowall (bezel > 0) hanya untuk videowall', cocokPustaka('videowall', panel) && !cocokPustaka('tv', panel));
cek('display tunggal untuk TV / IFP, bukan videowall', cocokPustaka('tv', tv) && cocokPustaka('ifp', tv) && !cocokPustaka('videowall', tv));
cek('speaker plafon hanya untuk speaker plafon', cocokPustaka('speaker-plafon', spkPlafon) && !cocokPustaka('speaker', spkPlafon) && cocokPustaka('speaker', spkDinding));
cek('jenis lain tidak cocok (meja, proyektor ← display)', !cocokPustaka('meja', tv) && !cocokPustaka('proyektor', tv));

console.log('\nProyektor');
const p0 = { ...bendaBaru('proyektor', kotak), throwRatio: 2.4 };
const xp = isiDariPustaka(p0, proy)!;
cek('lumen, rentang zoom & nama dari pustaka', xp.lumen === 7000 && xp.trMin === 1.2 && xp.trMax === 1.8 && xp.nama === 'Laser 7.000');
cek('posisi zoom 2,4 dijepit ke TR terpanjang 1,8', xp.throwRatio === 1.8);

console.log('\nVideowall');
const v0 = bendaBaru('videowall', kotak, { kol: 3, bar: 2 });
const v1 = terapkanUkuran({ ...v0, ...isiDariPustaka(v0, panel)! });
const sp = spekVideowall(v1);
cek('menjadi panel custom dengan bezel 0,88 mm, FHD, 200 W', v1.vw === 'custom' && sp.bezelMm === 0.88 && sp.resX === 1920 && sp.wTipikal === 200);
cek('ukuran set 55" = 1218,5 × 685,8 mm (aktif 16:9 1217,6 × 684,9 + bezel 0,88)', dekat(sp.w, 1.2185, 2e-4) && dekat(sp.h, 0.6858, 2e-4));
cek('ukuran dinding ikut 3 × 2 panel', dekat(v1.w, sp.w * 3) && dekat(v1.h, sp.h * 2) && v1.kol === 3);

console.log('\nTV & speaker');
const t0 = bendaBaru('tv', kotak);
const t1 = terapkanUkuran({ ...t0, ...isiDariPustaka(t0, tv)! });
cek('TV 86": diagonal & lebar ikut (±1,93 m)', t1.diag === 86 && t1.w > 1.9 && t1.w < 1.96);
const s0 = bendaBaru('speaker-plafon', kotak);
cek('speaker plafon: sebaran 110°', isiDariPustaka(s0, spkPlafon)?.sebaran === 110);
cek('entri tidak cocok -> null (speaker dinding ke speaker plafon)', isiDariPustaka(s0, spkDinding) === null);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
