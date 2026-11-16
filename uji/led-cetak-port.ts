import { ringkasPort, teksRentang } from '../app/(portal)/tools-team/_components/led/koneksi/ringkasPort';
import type { Susunan } from '../app/(portal)/tools-team/_components/led/koneksi/data';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };
const port = (n: number, isi: (i: number) => [number, number, number]) => Array.from({ length: n }, (_, i) => { const [jumlah, px, beban] = isi(i + 1); return { port: i + 1, jumlah, px, beban, mulai: null }; });
const susun = (p: ReturnType<typeof port>, x: Partial<Susunan>) => ({ ppk: 48, controller: 1, lanKartu: 16, ...x, hasil: { port: p } }) as unknown as Susunan;

console.log('\n1. H5: 3 kartu x 16 port');
const t = susun(port(48, i => (i === 16 || i === 32 || i > 44 ? [0, 0, 0] : [2, 460800, 71])), {});
const b = ringkasPort(t);
cek('digabung per kartu (3 baris)', b.length === 3);
cek('kartu 1 port 1-15', b[0].unit === 'Kartu 1' && b[0].dari === 1 && b[0].sampai === 15 && teksRentang(b[0]) === 'port 1\u201315 (15 port)');
cek('kartu 3 port 1-12', b[2].unit === 'Kartu 3' && b[2].sampai === 12);
cek('port kosong tidak dicetak', b.every(x => x.jumlah > 0));

console.log('\n2. Beban berbeda dipisah');
const b2 = ringkasPort(susun(port(4, i => (i <= 3 ? [2, 460800, 71] : [1, 230400, 35])), { lanKartu: 0, ppk: 4 }));
cek('dua baris, unit Controller', b2.length === 2 && b2[0].unit === 'Controller' && b2[0].sampai === 3 && teksRentang(b2[1]) === 'port 4');

console.log('\n3. Banyak controller');
const b3 = ringkasPort(susun(port(8, () => [1, 100000, 20]), { lanKartu: 0, ppk: 4, controller: 2 }));
cek('per controller', b3.length === 2 && b3[0].unit === 'Controller 1' && b3[1].unit === 'Controller 2' && b3[1].dari === 1 && b3[1].sampai === 4);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
