import { contohVoiceKamar } from '../lib/sld/contoh';
import { bersihkanDok, dokBaru, hapusPerangkat, kabelBaru, perangkatBaru } from '../lib/sld/dok';
import { GAYA_KABEL } from '../lib/sld/gaya';
import { geometri, kodeKabel, sisiOtomatis } from '../lib/sld/geometri';
import { svgLembar1 } from '../lib/sld/lembar1';
import { isiLembar2, svgLembar2 } from '../lib/sld/lembar2';
import { bungkus } from '../lib/sld/teks';
import { barisKoneksi, barisPerangkat, jenisTerpakai, kartuGambar, periksaDok } from '../lib/sld/turunan';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}

const d = contohVoiceKamar('Penguji');

console.log('\n1. Penomoran & tabel');
{
  const kode = kodeKabel(d.kabel);
  const urut = d.kabel.map(c => kode.get(c.id));
  cek('kabel sinyal K1..K10, catu daya P1', urut.join(',') === 'K1,K2,K3,K4,K5,K6,K7,K8,K9,K10,P1', urut.join(','));
  const k = barisKoneksi(d);
  cek('tabel koneksi: K dulu lalu P', k[0].kode === 'K1' && k[k.length - 1].kode === 'P1');
  cek('kolom Dari = nama · port', k[0].dari === 'Speakerphone HALO 80 · USB-C', k[0].dari);
  cek('cabang bus ikut di kolom Ke', k[4].ke.includes('Modul relay 8 #1') && k[4].ke.includes('Modul relay 8 #2'), k[4].ke);
  cek('ujung teks bebas (P1) tetap tertulis', k[k.length - 1].dari === 'MCB panel listrik');
  const p = barisPerangkat(d);
  cek('Daftar Perangkat urut No. BOM, item tanpa No. tidak masuk', p.map(r => r.no).join(',') === '1,2,3,4,5,6,7', p.map(r => r.no).join(','));
  cek('dua modul relay No. sama digabung jadi 2 unit', p.find(r => r.no === '4')?.qty === '2 unit');
  const kartu = kartuGambar(d);
  cek('kartu gambar satu per No. BOM, judul tanpa "#1"', kartu.length === 7 && kartu[3].judul === 'Modul relay 8', kartu[3]?.judul);
  cek('legend hanya jenis kabel yang tergambar', jenisTerpakai(d).join(',') === 'usb,catx,ac', jenisTerpakai(d).join(','));
}

console.log('\n2. Garis kabel');
{
  const kiri = { x: 0, y: 0, w: 20, h: 10 }, kanan = { x: 60, y: 2, w: 20, h: 10 }, bawah = { x: 2, y: 80, w: 20, h: 10 };
  cek('perangkat berjajar mendatar -> sisi kanan', sisiOtomatis(kiri, kanan) === 'kanan');
  cek('perangkat di bawah -> sisi bawah', sisiOtomatis(kiri, bawah) === 'bawah');
  const g = geometri(d);
  cek('P1 (tanpa gambar) tidak digambar', g.length === 10, String(g.length));
  const k5 = g.find(x => x.kode === 'K5')!;
  cek('K5 punya dua garis (bus bercabang), titik awal sekali', k5.garis.length === 2 && k5.garis.filter(x => x.awal).length === 1);
  cek('semua segmen garis lurus mendatar / tegak', g.every(x => x.garis.every(gr => gr.titik.every((t, i) => i === 0 || t.x === gr.titik[i - 1].x || t.y === gr.titik[i - 1].y))));
  const k1 = g.find(x => x.kode === 'K1')!;
  cek('label garis mendatar di atas garis', k1.label.y < k1.garis[0].titik[0].y);
  const geser = { ...d, kabel: d.kabel.map(c => (c.id === d.kabel[1].id ? { ...c, tengah: 120 } : c)) };
  const k2 = geometri(geser).find(x => x.kode === 'K2')!;
  cek('jalur bisa digeser lewat "tengah"', k2.garis[0].titik.some(t => t.y === 120), JSON.stringify(k2.garis[0].titik));
}

console.log('\n3. Template ekspor tetap (acuan SLD final)');
{
  const s1 = svgLembar1(d), s2 = svgLembar2(d);
  cek('A3 landscape 420 x 297 mm', s1.includes('viewBox="0 0 420 297"') && s1.includes('width="420mm" height="297mm"'));
  cek('strip kiri: Legend, PROJECT, Drawn by/Date/Checked by/Approved by, Drawing No., Scale, SHEET, Rev.',
    ['>Legend<', '>PROJECT : Voice Control Kamar Pasien<', '>Drawn by<', '>Date<', '>Checked by<', '>Approved by<', '>Drawing No.<', '>Scale :<', '>SHEET<', '>1 of 2<', '>Rev.<'].every(t => s1.includes(t)));
  cek('warna kabel baku: CATX #13a3e0, USB #111111, 230 VAC #8d5524', GAYA_KABEL.catx.warna === '#13a3e0' && GAYA_KABEL.usb.warna === '#111111' && GAYA_KABEL.ac.warna === '#8d5524');
  cek('legend memakai nama baku', ['>USB Cable<', '>CATX Cable<', '>Power 230 VAC<'].every(t => s1.includes(t)));
  cek('label perangkat: #nama tebal, *peran merah', s1.includes('>#Mini PC Windows 11<') && s1.includes('fill="#e00000" font-weight="700" text-anchor="start">*Server Voice Command<'));
  cek('label garis "K1 · USB-A ↔ USB-C"', s1.includes('>K1 · USB-A ↔ USB-C<'));
  const logo = (s: string) => [(s.match(/<image id="sld-wm" href="\/sld\/watermark.png"/g) ?? []).length, (s.match(/<use href="#sld-wm"/g) ?? []).length].join('/');
  cek('watermark: logo disimpan sekali, diulang 27 kali per lembar', logo(s1) === '1/27' && logo(s2) === '1/27', `${logo(s1)} ${logo(s2)}`);
  const kolom = ['>No<', '>Dari (perangkat · port)<', '>Ke (perangkat · port)<', '>Kabel / media<', '>Fungsi<', '>Catatan<'];
  cek('sheet 2: kolom Daftar Koneksi persis', kolom.every(t => s2.includes(t)));
  cek('sheet 2: kolom Daftar Perangkat persis', ['>Kategori<', '>Merek / model<', '>Qty<'].every(t => s2.includes(t)));
  cek('sheet 2: judul seksi baku', ['DAFTAR KONEKSI (K = sinyal / kontrol, P = catu daya) - nomor K = label kabel di sheet 1', 'GAMBAR PERANGKAT (No. = item BOM Rev1)',
    'DAFTAR PERANGKAT (= BOM Rev1)', '>CATATAN PEMASANGAN<'].every(t => s2.includes(t)));
  cek('sheet 2: blok judul baku', ['>SINGLE LINE DIAGRAM<', '>PROYEK<', '>LINGKUP<', '>ACUAN<', '>NO. GAMBAR<', '>REV<', '>TANGGAL<', '>SKALA<', '>KERTAS<', '>HAL<', '>Tanpa skala<', '>A3<',
    '>2 / 2 · Koneksi &amp; catatan<'].every(t => s2.includes(t)));
  cek('sheet 2: warna tabel baku', s2.includes('fill="#eaeef2" stroke="#8c959f"') && s2.includes('fill="#f6f8fa" stroke="#afb8c1"'));
  cek('teks pengguna di-escape', svgLembar1({ ...d, blok: { ...d.blok, proyek: '<script>' } }).includes('PROJECT : &lt;script&gt;'));
  const banyak = { ...d, kabel: Array.from({ length: 90 }, (_, i) => kabelBaru(d.perangkat[0].id, d.perangkat[1].id, { fungsi: `fungsi ${i}` })) };
  cek('tabel kepanjangan dipotong di batas lembar dan dilaporkan', isiLembar2(banyak).info.terpotongKoneksi > 0);
  cek('bungkus teks memecah baris panjang', bungkus('Pilih HALO 80 di 4-ATUR-MIKROFON.bat & jadikan Output default Windows', 52, 2.3).length === 2);
}

console.log('\n4. Simpan & muat');
{
  const b = bersihkanDok(JSON.parse(JSON.stringify(d)));
  cek('dokumen contoh lolos pembersihan tanpa kehilangan isi', !!b && b.perangkat.length === d.perangkat.length && b.kabel.length === d.kabel.length && b.catatan.length === 3);
  cek('isian rusak ditolak', bersihkanDok(null) === null && bersihkanDok('x') === null);
  const jahat = bersihkanDok({ perangkat: [{ id: 'a', gambar: 'javascript:alert(1)', x: 99999, w: -5 }], kabel: [{ id: 'k', jenis: 'zzz' }] })!;
  cek('gambar non data-URL dibuang, posisi & ukuran dibatasi, jenis kabel tak dikenal -> lain',
    !jahat.perangkat[0].gambar && jahat.perangkat[0].x < 420 && jahat.perangkat[0].w >= 12 && jahat.kabel[0].jenis === 'lain');
  const tanpa = hapusPerangkat(d, d.perangkat[1].id);
  cek('hapus perangkat: kabel tetap di tabel dengan nama teks', tanpa.kabel.length === d.kabel.length && barisKoneksi(tanpa)[0].ke.startsWith('Mini PC Windows 11'));
  const kosong = dokBaru();
  const satu = { ...kosong, perangkat: [perangkatBaru('switch', 50, 50)] };
  cek('pemeriksaan: perangkat tanpa kabel & tanpa No. BOM dilaporkan', periksaDok(satu).length === 2);
}

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
