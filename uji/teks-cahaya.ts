import { blokTerlihat, geserKeTerlihat, kotakTerlihat, type BlokTeks } from '../app/(portal)/tools-team/_components/desain3d/mesin/teksCahaya';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

const quad = (u0: number, u1: number, v0: number, v1: number) => [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1];
const uv: number[] = [];
for (let i = 0; i < 10; i++) for (let j = 0; j < 9; j++) uv.push(...quad(i / 10, (i + 1) / 10, j / 10, (j + 1) / 10));
const kotak = kotakTerlihat(uv);
const info: BlokTeks = { x: 0.01, y: 0.01, w: 0.24, h: 0.1, baris: ['a'] };

console.log('\nTeks di cahaya proyektor');
cek('gambar melewati tepi atas permukaan: teks di pojok atas tidak terlihat utuh', !blokTerlihat(info, kotak));
const geser = geserKeTerlihat(info, kotak, 1, 1);
cek('teks digeser turun ke bagian yang mengenai permukaan dan terlihat utuh', !!geser && geser.y >= 0.1 && blokTerlihat(geser, kotak));
const penuh = kotakTerlihat(quad(0, 1, 0, 1));
cek('gambar utuh di permukaan: posisi teks tidak berubah', geserKeTerlihat(info, penuh, 1, 1)?.y === info.y && geserKeTerlihat(info, penuh, 1, 1)?.x === info.x);
cek('tidak ada bagian yang terlihat: teks tidak digambar', geserKeTerlihat(info, [], 1, 1) === null);

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
