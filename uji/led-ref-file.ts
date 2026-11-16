import { bacaRefPakai, gabungRef } from '../app/(portal)/tools-team/_components/led/refPakai';
import { cariModul, kunciModul, MODUL_LED, SENDING_CARD, VIDEO_PROCESSOR } from '../lib/av/hitung';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

const ref = { modul: MODUL_LED, kartu: SENDING_CARD, vp: VIDEO_PROCESSOR };
const sky = { brand: 'Umum', model: 'SKYWORTH', kode: 'P 0,9', pitch: 0.9, w: 600, h: 337.5, pxW: 640, pxH: 360, tipe: 'Indoor', guna: 'COB' };
const vp = { nama: 'KLS4C', maksPx: 8_800_000, port: 16, ket: 'Kustom', senderBawaan: true };

console.log('\n1. Spesifikasi dari berkas dibaca');
const p = bacaRefPakai({ modul: sky, vp, kartu: null });
cek('modul & VP kustom terbaca', !!p && p.modul.kode === 'P 0,9' && p.vp?.nama === 'KLS4C' && p.kartu === null);
cek('isian rusak ditolak', bacaRefPakai(null) === null && bacaRefPakai({ modul: { kode: 'x' } }) === null && bacaRefPakai('x') === null);

console.log('\n2. Digabung ke referensi pembuka');
const kunci = kunciModul(p!.modul);
cek('tanpa berkas: modul kustom tidak ditemukan', !cariModul(ref.modul, kunci));
const g = gabungRef(ref, p);
cek('setelah gabung: modul kustom ditemukan dengan spesifikasi berkas', cariModul(g.modul, kunci)?.pxW === 640);
cek('VP kustom ikut', g.vp.some(v => v.nama === 'KLS4C') && g.vp.length === ref.vp.length + 1);
cek('referensi lain tetap', g.modul.length === ref.modul.length + 1 && g.kartu === ref.kartu);
const beda = { ...MODUL_LED[0], pxW: 999 };
const g2 = gabungRef(ref, { modul: beda, vp: null, kartu: null });
cek('spesifikasi berkas menang atas kunci yang sama', cariModul(g2.modul, kunciModul(beda))?.pxW === 999 && g2.modul.length === ref.modul.length);
cek('tanpa refPakai referensi tidak berubah', gabungRef(ref, null) === ref);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
