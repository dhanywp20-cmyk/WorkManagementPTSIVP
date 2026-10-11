/**
 * uji/desain3d-tekstur.ts - tekstur gambar sendiri untuk lantai & dinding Desain 3D: kunci & ubin yang sah,
 * gambar mana yang ikut disimpan, dan validasi server (lib/tools-team.ts periksaDesain).
 *
 * Jalankan: npm test -- desain3d-tekstur
 */
import {
  kunciTeksturBaru, kunciTeksturDipakai, POLA_KUNCI_TEKSTUR, teksturSah, UBIN_MAKS, UBIN_MIN, ubinSah, ulangTekstur,
} from '../app/(portal)/tools-team/_components/desain3d/inti';
import { MAKS_TEKSTUR_RUANG, periksaDesain } from '../lib/tools-team';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\n1. Kunci & ubin');
const k = kunciTeksturBaru();
cek('kunci baru sesuai pola server', POLA_KUNCI_TEKSTUR.test(k));
cek('kunci baru unik', kunciTeksturBaru() !== kunciTeksturBaru());
cek('kunci asing ditolak (teksturSah -> undefined)', teksturSah({ kunci: '../etc', ubin: 1 }) === undefined && teksturSah(null) === undefined);
cek(`ubin dijepit ${UBIN_MIN}..${UBIN_MAKS} m`, ubinSah(0) === UBIN_MIN && ubinSah(999) === UBIN_MAKS && ubinSah('x', 2) === 2);
const [rx, ry] = ulangTekstur(8, 6, 2);
cek('lantai 8 × 6 m, ubin 2 m -> diulang 4 × 3', rx === 4 && ry === 3);

console.log('\n2. Gambar yang ikut disimpan');
cek('lantai & dinding memakai gambar berbeda -> 2 kunci', kunciTeksturDipakai({ teksturLantai: { kunci: k, ubin: 1 }, teksturDinding: { kunci: 'tx-abcdef12', ubin: 2 } }).length === 2);
cek('gambar yang sama dipakai keduanya -> 1 kunci', kunciTeksturDipakai({ teksturLantai: { kunci: k, ubin: 1 }, teksturDinding: { kunci: k, ubin: 3 } }).length === 1);
cek('tanpa tekstur -> tidak ada yang disimpan', kunciTeksturDipakai({}).length === 0);

console.log('\n3. Validasi server');
const jpeg = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
const dasar = { ruang: { p: 8, l: 6, t: 3, lantai: 'kayu', teksturLantai: { kunci: k, ubin: 1 } }, benda: [] };
const ok = periksaDesain({ ...dasar, tekstur: { [k]: jpeg } });
cek('tekstur sah ikut tersimpan', ok.ok && ok.data.tekstur?.[k] === jpeg);
cek('kunci tidak sesuai pola ditolak', !periksaDesain({ ...dasar, tekstur: { 'bebas': jpeg } }).ok);
cek('bukan gambar JPEG/WebP ditolak (mis. SVG berskrip)', !periksaDesain({ ...dasar, tekstur: { [k]: 'data:image/svg+xml;base64,PHN2Zz4=' } }).ok);
cek('gambar terlalu besar ditolak', !periksaDesain({ ...dasar, tekstur: { [k]: 'data:image/jpeg;base64,' + 'A'.repeat(300_000) } }).ok);
const banyak = Object.fromEntries(Array.from({ length: MAKS_TEKSTUR_RUANG + 1 }, (_, i) => [`tx-abcdef${i}0`, jpeg]));
cek(`lebih dari ${MAKS_TEKSTUR_RUANG} tekstur ditolak`, !periksaDesain({ ...dasar, tekstur: banyak }).ok);
cek('tekstur tidak dihitung ke batas ukuran JSON desain', periksaDesain({ ...dasar, tekstur: { [k]: 'data:image/jpeg;base64,' + 'A'.repeat(190_000), 'tx-bbbbbb11': 'data:image/jpeg;base64,' + 'A'.repeat(190_000), 'tx-cccccc11': 'data:image/jpeg;base64,' + 'A'.repeat(190_000) } }).ok);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
