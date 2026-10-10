/**
 * uji/objek-saya.ts - "Objek saya" Desain 3D (lib/objek-saya.ts): penyaring isi (berkas impor bisa dari siapa
 * saja), syarat simpan, model 3D, dan ekspor -> impor bolak-balik antar akun.
 *
 * Jalankan: npm test -- objek-saya
 */
import {
  bacaBerkasObjekSaya, berkasObjekSaya, bersihkanAturObjek, JENIS_OBJEK, MAKS_BYTE_MODEL, MAKS_IMPOR_SEKALI, periksaObjekSaya,
} from '../lib/objek-saya';
import { bendaBaru, LABEL } from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const K = { x0: 0, p: 8, l: 6, t: 3 };
const GLB = 'data:model/gltf-binary;base64,' + 'Z2xURg'.repeat(50);

console.log('\n1. Jenis selaras dengan Desain 3D');
cek('JENIS_OBJEK = semua jenis di inti/tipe.ts', JENIS_OBJEK.length === Object.keys(LABEL).length && Object.keys(LABEL).every(j => (JENIS_OBJEK as readonly string[]).includes(j)));

console.log('\n2. Penyaring atur');
const a = bersihkanAturObjek({
  id: 'x', x: 3, z: 4, rot: 90, modelKunci: 'k', asing: 'buang', w: 1.2, h: 0.5, d: 0.3, warna: '#ABCDEF', latarTeks: 'red',
  tipeSpeaker: '"><img src=x onerror=alert(1)>', konten: 'gambar', nama: '  Rak tamu  ', teks: 'Baris 1\nBaris 2', naik: 'ya',
  kontur: [{ l: [0, 0, 1, 0, 0.5, 1], h: [[0.2, 0.2, 0.3, 0.2, 0.25, 0.3], ['x']] }, { l: [5, 5] }],
});
cek('posisi, id & kunci model dibuang', !('x' in a) && !('z' in a) && !('rot' in a) && !('id' in a) && !('modelKunci' in a));
cek('bidang asing dibuang', !('asing' in a));
cek('warna dirapikan; warna tidak sah dibuang', a.warna === '#abcdef' && !('latarTeks' in a));
cek('nilai pilihan berisi HTML dibuang', !('tipeSpeaker' in a));
cek('konten "gambar" (foto di memori) dibuang', !('konten' in a));
cek('tipe salah dibuang (naik = "ya" bukan boolean)', !('naik' in a));
cek('nama dirapikan, teks beberapa baris dipertahankan', a.nama === 'Rak tamu' && a.teks === 'Baris 1\nBaris 2');
cek('kontur: titik di luar 0..1 & lubang rusak dibuang', Array.isArray(a.kontur) && (a.kontur as unknown[]).length === 1 && ((a.kontur as { h: unknown[] }[])[0].h.length === 1));
cek('angka raksasa / NaN dibuang', !('w' in bersihkanAturObjek({ w: 1e9 })) && !('h' in bersihkanAturObjek({ h: NaN })));

console.log('\n3. Syarat simpan');
const teks = bendaBaru('teks', K, { teks: 'Area tamu', hadapTeks: 'lantai' });
const { id: _i, x: _x, z: _z, rot: _r, ...aturTeks } = teks; void _i; void _x; void _z; void _r;
const ok = periksaObjekSaya({ nama: 'Penanda area', ket: 'Lantai', jenis: 'teks', atur: aturTeks });
cek('teks lantai bisa disimpan', ok.ok && ok.data.atur.teks === 'Area tamu' && ok.data.atur.hadapTeks === 'lantai');
cek('nama kosong ditolak', !periksaObjekSaya({ nama: ' ', jenis: 'teks', atur: aturTeks }).ok);
cek('jenis tak dikenal ditolak', !periksaObjekSaya({ nama: 'X', jenis: 'roket', atur: aturTeks }).ok);
cek('tanpa ukuran ditolak', !periksaObjekSaya({ nama: 'X', jenis: 'meja', atur: {} }).ok);
const ukur = { w: 1, h: 1, d: 1 };
cek('model 3D wajib membawa berkasnya', !periksaObjekSaya({ nama: 'Patung', jenis: 'model', atur: ukur }).ok);
cek('model 3D dengan GLB sah diterima', periksaObjekSaya({ nama: 'Patung', jenis: 'model', atur: ukur, model: GLB }).ok);
cek('berkas model di benda bukan model ditolak', !periksaObjekSaya({ nama: 'Meja', jenis: 'meja', atur: ukur, model: GLB }).ok);
cek('model bukan GLB (mis. HTML) ditolak', !periksaObjekSaya({ nama: 'P', jenis: 'model', atur: ukur, model: 'data:text/html;base64,PHNjcmlwdD4=' }).ok);
cek(`model > ${MAKS_BYTE_MODEL / 1e6} MB (data URL) ditolak`, !periksaObjekSaya({ nama: 'P', jenis: 'model', atur: ukur, model: 'data:model/gltf-binary;base64,' + 'A'.repeat(MAKS_BYTE_MODEL) }).ok);

console.log('\n4. Ekspor -> impor (akun lain)');
const objek = [ok.ok ? ok.data : null, { nama: 'Patung', ket: '', jenis: 'model' as const, atur: ukur, model: GLB }].filter(Boolean) as Parameters<typeof berkasObjekSaya>[0];
const baca = bacaBerkasObjekSaya(JSON.parse(JSON.stringify(berkasObjekSaya(objek, 'Budi'))));
cek('berkas ekspor terbaca utuh oleh impor', baca.ok && baca.objek.length === 2 && baca.ditolak.length === 0 && baca.objek[1].model === GLB);
cek('berkas lain (bukan ekspor Objek saya) ditolak', !bacaBerkasObjekSaya({ objek: [] }).ok && !bacaBerkasObjekSaya('teks').ok);
const campur = bacaBerkasObjekSaya({ ...berkasObjekSaya(objek), objek: [...objek, { nama: '', jenis: 'meja', atur: ukur }] });
cek('objek rusak dilewati, yang sah tetap diimpor', campur.ok && campur.objek.length === 2 && campur.ditolak.length === 1);
cek(`lebih dari ${MAKS_IMPOR_SEKALI} objek per impor ditolak`, !bacaBerkasObjekSaya(berkasObjekSaya(Array(MAKS_IMPOR_SEKALI + 1).fill(objek[0]))).ok);
const pasang = baca.ok ? bendaBaru('teks', K, baca.objek[0].atur) : null;
cek('objek impor bisa dipasang lagi sebagai benda yang sama', pasang?.teks === 'Area tamu' && pasang.hadapTeks === 'lantai');

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
