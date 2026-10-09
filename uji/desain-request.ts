/**
 * uji/desain-request.ts - Design 3D (Tools Team) sebagai tautan OPSIONAL di
 * Request Design Project: ringkasan desain, aturan siapa boleh menautkan,
 * dan seksi cetak/ZIP yang hanya muncul bila ada tautan.
 *
 * Jalankan: npx tsx uji/desain-request.ts
 */
import { periksaDesain, ringkasanDesain, bolehUbahTautan, statusRuangan, bersihkanGambar, kategoriBenda, periksaIsianLED, bersihkanRingkasanLED, bersihkanReferensiLED, urlGambarDesain, MAKS_BYTE_GAMBAR_HD } from '../lib/tools-team';
import { htmlSeksiDesain3D, ukuranRuang, type TautanDesain3D } from '../app/(portal)/form-require-project/_components/desain-3d-request';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}

console.log('\n1. Ringkasan desain (tanpa data 3D penuh)');
{
  const r = ringkasanDesain({
    ruang: { p: 8, l: 6, t: 3, r2: { aktif: true, p: 6, l: 5, t: 2.8 } },
    benda: [
      { jenis: 'videowall', nama: 'Videowall 55" 2×2' }, { jenis: 'kursi', nama: 'Kursi' }, { jenis: 'kursi', nama: 'Kursi' },
      { jenis: 'meja', nama: 'Meja kelas 1.1' }, { jenis: 'meja', nama: 'Meja kelas 2.3' }, { jenis: 'proyektor', nama: 'Proyektor plafon' },
    ],
  });
  cek('dua ruang tercatat dengan ukurannya', r.ruang.length === 2 && r.ruang[1].l === 5 && r.ruang[1].t === 2.8);
  cek('benda bernama sama dijumlah', r.perangkat.find(p => p.nama === 'Kursi')?.jumlah === 2);
  cek('"Meja kelas 1.1" & "2.3" dihitung satu jenis', r.perangkat.find(p => p.nama === 'Meja kelas')?.jumlah === 2);
  cek('urut per kategori: Display dulu', r.perangkat[0].kategori === 'Display' && r.jumlah === 6);
  cek('proyektor masuk Display', kategoriBenda('proyektor') === 'Display');
  cek('ruang 2 nonaktif tidak ikut', ringkasanDesain({ ruang: { p: 4, l: 4, t: 3, r2: { aktif: false, p: 9, l: 9, t: 9 } }, benda: [] }).ruang.length === 1);
}

console.log('\n2. Siapa boleh menautkan / melepas');
{
  cek('tim PTS di ruangan In Progress: boleh', bolehUbahTautan('team_pts', 'in_progress').ok);
  cek('admin di ruangan Approved: boleh', bolehUbahTautan('admin', 'approved').ok);
  cek('sales: ditolak', !bolehUbahTautan('sales', 'in_progress').ok);
  cek('role kosong: ditolak', !bolehUbahTautan(null, 'in_progress').ok);
  cek('ruangan Pending/Rejected: ditolak (sama dengan aturan unggah SLD/BOQ)', !bolehUbahTautan('team', 'pending').ok && !bolehUbahTautan('team', 'rejected').ok);
  const c = bolehUbahTautan('admin', 'completed');
  cek('ruangan Completed: terkunci, alasannya jelas', !c.ok && /Completed/.test((c as { alasan: string }).alasan));
  const req = { status: 'completed', rooms: [{ status: 'in_progress' }, {}] };
  cek('status per ruangan: ruangan 2 punya status sendiri, ruangan 3 ikut request', statusRuangan(req, 0) === 'completed' && statusRuangan(req, 1) === 'in_progress' && statusRuangan(req, 2) === 'completed');
}

console.log('\n3. Pratinjau gambar');
{
  cek('data URL JPEG kecil diterima', bersihkanGambar('data:image/jpeg;base64,QUJD') === 'data:image/jpeg;base64,QUJD');
  cek('bukan gambar ditolak', bersihkanGambar('javascript:alert(1)') === null && bersihkanGambar('data:image/svg+xml;base64,QUJD') === null);
  cek('terlalu besar ditolak', bersihkanGambar('data:image/jpeg;base64,' + 'A'.repeat(130_000)) === null);
  cek('gambar HD punya batas sendiri yang lebih besar', bersihkanGambar('data:image/jpeg;base64,' + 'A'.repeat(300_000), MAKS_BYTE_GAMBAR_HD) !== null);
  cek('alamat gambar per versi (bisa di-cache selamanya)', urlGambarDesain('abc', 3) === '/api/tools-team/desain/gambar?id=abc&v=3' && urlGambarDesain('abc', 3, true).endsWith('&hd=1'));
}

console.log('\n4. Cetak & ZIP: seksi Design 3D hanya bila ada tautan');
{
  const nama = (i: number) => `Ruang ${i + 1}`;
  cek('tanpa tautan: tidak ada seksi sama sekali', htmlSeksiDesain3D([], nama) === '');
  const t: TautanDesain3D = {
    id: 't1', room_idx: 1, desain_id: 'd1', versi: 2, dilampirkan_oleh_nama: 'Dhany <script>', created_at: '2026-10-05T00:00:00Z', updated_at: '2026-10-05T00:00:00Z',
    snapshot: { nama: 'Boardroom', ringkasan: { ruang: [{ p: 4.5, l: 7, t: 3 }], perangkat: [{ kategori: 'Display', nama: 'TV', jumlah: 2 }], jumlah: 2 }, created_at: '2026-10-05T00:00:00Z', dibuat_oleh_nama: 'X' },
    sumber: { nama: 'Boardroom', versi: 3, diarsipkan_at: null },
  };
  const html = htmlSeksiDesain3D([t], nama);
  cek('memuat nama, versi yang ditautkan, ruangan & ukuran', html.includes('Boardroom') && html.includes('v2') && html.includes('Ruang 2') && html.includes(ukuranRuang(t.snapshot!.ringkasan)));
  cek('menyebut versi terbaru tanpa menggantinya', html.includes('Versi terbaru di Tools Team: v3') && html.includes('memakai v2'));
  cek('teks pengguna di-escape', !html.includes('<script>') && html.includes('&lt;script&gt;'));
  cek('label estimasi engineering', /estimasi/.test(html));
  cek('tanpa asal URL: tidak ada gambar (tidak ada data gambar di JSON)', !html.includes('<img'));
  const cetakHd = htmlSeksiDesain3D([t], nama, 'https://contoh.app');
  cek('lembar cetak memakai gambar HD versi yang ditautkan', cetakHd.includes('https://contoh.app/api/tools-team/desain/gambar?id=d1&amp;v=2&amp;hd=1'));
  const arsip = htmlSeksiDesain3D([{ ...t, sumber: { nama: 'Boardroom', versi: 5, diarsipkan_at: '2026-10-06' } }], nama);
  cek('sumber diarsipkan: snapshot tetap tercetak, tanpa ajakan versi baru', arsip.includes('Boardroom') && !arsip.includes('Versi terbaru'));
  const tanpaSumber = htmlSeksiDesain3D([{ ...t, sumber: null }], nama);
  cek('sumber hilang: snapshot tetap tercetak', tanpaSumber.includes('Boardroom') && tanpaSumber.includes('v2'));
}

console.log('\n5. Kalkulator LED tersimpan');
{
  cek('isian objek wajar diterima', periksaIsianLED({ pitch: 2.5, project: 'BPKP', pxIn: null }).ok);
  cek('bukan objek / array ditolak', !periksaIsianLED(null).ok && !periksaIsianLED([1, 2]).ok && !periksaIsianLED('x').ok);
  cek('terlalu besar ditolak (batas termasuk kabel manual Screen Connection)', !periksaIsianLED({ catatan: 'x'.repeat(125_000) }).ok && periksaIsianLED({ catatan: 'x'.repeat(60_000) }).ok);
  const r = bersihkanRingkasanLED({ project: 'P'.repeat(200), lebarM: 4, resX: '1600', screen: 0, liar: 'abc' });
  cek('ringkasan: teks dipotong, angka palsu jadi 0, field asing dibuang, screen minimal 1',
    r.project.length === 120 && r.lebarM === 4 && r.resX === 0 && r.screen === 1 && !('liar' in r));
}

console.log('\nReferensi LED per brand');
{
  const modul = { kode: 'P2.5', pitch: 2.5, w: 320, h: 160, pxW: 128, pxH: 64, tipe: 'Indoor', guna: '' };
  const lama = bersihkanReferensiLED({ modul: [modul], kartu: [], vp: [] });
  cek('referensi lama tanpa brand tetap sah', !!lama && lama.brand === undefined && lama.modul[0].brand === undefined);
  const baru = bersihkanReferensiLED({ modul: [{ ...modul, brand: ' Absen ', model: 'A27', unit: 'cabinet' }], kartu: [], vp: [],
    brand: [{ nama: 'Absen', sendiri: false }, { nama: 'Absen', sendiri: true }, { nama: '  ' }, { nama: 'IVP Vision', sendiri: true }] });
  cek('brand, model & unit disimpan; nama brand dobel / kosong dibuang', !!baru && baru.modul[0].brand === 'Absen' && baru.modul[0].model === 'A27'
    && baru.modul[0].unit === 'cabinet' && baru.brand?.length === 2 && baru.brand[1].sendiri === true);
  cek('modul > 500 ditolak', bersihkanReferensiLED({ modul: Array(501).fill(modul), kartu: [], vp: [] }) === null);
  cek('brand bukan array ditolak', bersihkanReferensiLED({ modul: [modul], kartu: [], vp: [], brand: 'Absen' }) === null);
}

console.log('\nGambar layar ikut desain di server');
{
  const benda = [{ id: 'b1', jenis: 'videowall' }];
  const jpg = 'data:image/jpeg;base64,QUJD';
  const ok = periksaDesain({ ruang: {}, benda, layar: { b1: jpg } });
  cek('gambar layar untuk benda yang ada diterima', ok.ok && ok.data.layar?.b1 === jpg);
  cek('gambar untuk benda yang tidak ada ditolak', !periksaDesain({ ruang: {}, benda, layar: { zz: jpg } }).ok);
  cek('gambar terlalu besar ditolak', !periksaDesain({ ruang: {}, benda, layar: { b1: 'data:image/jpeg;base64,' + 'A'.repeat(210_000) } }).ok);
  cek('lebih dari 6 gambar ditolak', !periksaDesain({ ruang: {}, benda: Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, jenis: 'tv' })), layar: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`b${i}`, jpg])) }).ok);
  cek('tanpa gambar layar: data tetap sama seperti dulu', (() => { const r = periksaDesain({ ruang: {}, benda }); return r.ok && r.data.layar === undefined; })());
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
