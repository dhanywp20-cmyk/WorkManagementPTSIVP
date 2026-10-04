/**
 * uji/desain-request.ts - Design 3D (Tools Team) sebagai tautan OPSIONAL di
 * Request Design Project: ringkasan desain, aturan siapa boleh menautkan,
 * dan seksi cetak/ZIP yang hanya muncul bila ada tautan.
 *
 * Jalankan: npx tsx uji/desain-request.ts
 */
import { ringkasanDesain, bolehUbahTautan, statusRuangan, bersihkanGambar, kategoriBenda } from '../lib/tools-team';
import { htmlSeksiDesain3D, ukuranRuang, bytePratinjau, type TautanDesain3D } from '../app/form-require-project/_components/desain-3d-request';

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
  const b = bytePratinjau('data:image/jpeg;base64,QUJD');
  cek('pratinjau jadi byte untuk ZIP', !!b && b.length === 3 && b[0] === 65);
}

console.log('\n4. Cetak & ZIP: seksi Design 3D hanya bila ada tautan');
{
  const nama = (i: number) => `Ruang ${i + 1}`;
  cek('tanpa tautan: tidak ada seksi sama sekali', htmlSeksiDesain3D([], nama) === '');
  const t: TautanDesain3D = {
    id: 't1', room_idx: 1, desain_id: 'd1', versi: 2, dilampirkan_oleh_nama: 'Dhany <script>', created_at: '2026-10-05T00:00:00Z', updated_at: '2026-10-05T00:00:00Z',
    snapshot: { nama: 'Boardroom', ringkasan: { ruang: [{ p: 4.5, l: 7, t: 3 }], perangkat: [{ kategori: 'Display', nama: 'TV', jumlah: 2 }], jumlah: 2 }, gambar: null, created_at: '2026-10-05T00:00:00Z', dibuat_oleh_nama: 'X' },
    sumber: { nama: 'Boardroom', versi: 3, diarsipkan_at: null },
  };
  const html = htmlSeksiDesain3D([t], nama);
  cek('memuat nama, versi yang ditautkan, ruangan & ukuran', html.includes('Boardroom') && html.includes('v2') && html.includes('Ruang 2') && html.includes(ukuranRuang(t.snapshot!.ringkasan)));
  cek('menyebut versi terbaru tanpa menggantinya', html.includes('Versi terbaru di Tools Team: v3') && html.includes('memakai v2'));
  cek('teks pengguna di-escape', !html.includes('<script>') && html.includes('&lt;script&gt;'));
  cek('label estimasi engineering', /estimasi/.test(html));
  const arsip = htmlSeksiDesain3D([{ ...t, sumber: { nama: 'Boardroom', versi: 5, diarsipkan_at: '2026-10-06' } }], nama);
  cek('sumber diarsipkan: snapshot tetap tercetak, tanpa ajakan versi baru', arsip.includes('Boardroom') && !arsip.includes('Versi terbaru'));
  const tanpaSumber = htmlSeksiDesain3D([{ ...t, sumber: null }], nama);
  cek('sumber hilang: snapshot tetap tercetak', tanpaSumber.includes('Boardroom') && tanpaSumber.includes('v2'));
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
