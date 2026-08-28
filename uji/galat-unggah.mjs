/**
 * uji/galat-unggah.mjs - penerjemahan galat unggah jawaban bergambar.
 *
 * Yang dijaga: pesan mentah Postgres/Storage tidak sampai ke peserta apa
 * adanya, dan galat yang BUKAN soal pemasangan tidak ikut tertelan jadi
 * kalimat generik.
 *
 *   node uji/galat-unggah.mjs
 */
function terjemahkanGalatUnggah(pesan) {
  const p = pesan ?? 'Gagal mengunggah.';
  if (/row-level security|violates row/i.test(p)) {
    return 'Penyimpanan gambar belum diizinkan di server. Ini bukan kesalahan kamu — '
      + 'hubungi admin untuk menjalankan sql/perbaikan-unggah-jawaban-gambar.sql. '
      + 'Jawaban lain yang sudah kamu isi tetap tersimpan.';
  }
  if (/bucket not found|not found/i.test(p)) {
    return 'Tempat penyimpanan gambar belum dibuat di server. Hubungi admin — '
      + 'jalankan sql/learning-center-essay-gambar.sql.';
  }
  if (/exceeded the maximum allowed size|payload too large|413/i.test(p)) {
    return 'Fotonya terlalu besar walau sudah dikecilkan. Coba foto ulang dari jarak '
      + 'lebih dekat, atau potong bagian yang tidak perlu.';
  }
  if (/mime type|not supported/i.test(p)) {
    return 'Jenis berkasnya tidak didukung. Pakai foto biasa (JPG atau PNG).';
  }
  return p;
}

let lulus = 0, gagal = 0;
const cek = (nama, syarat, catatan = '') => {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
};

console.log('\n1. Galat pemasangan disebut berikut berkas SQL-nya');
{
  // Persis pesan yang muncul di layar peserta.
  const h = terjemahkanGalatUnggah('new row violates row-level security policy');
  cek('RLS menyebut berkas perbaikannya', h.includes('perbaikan-unggah-jawaban-gambar.sql'));
  cek('RLS tidak menyalahkan peserta', h.includes('bukan kesalahan kamu'));
  cek('RLS menenangkan soal jawaban lain', h.includes('tetap tersimpan'));
  cek('teks mentah tidak bocor', !h.includes('row-level security policy'), h.slice(0, 40));
}
{
  const h = terjemahkanGalatUnggah('Bucket not found');
  cek('bucket hilang menyebut berkas SQL-nya', h.includes('learning-center-essay-gambar.sql'));
}

console.log('\n2. Galat yang bisa ditindaklanjuti peserta sendiri');
{
  const h = terjemahkanGalatUnggah('The object exceeded the maximum allowed size');
  cek('ukuran: memberi langkah nyata', h.includes('foto ulang'));
  cek('ukuran: tidak menyuruh hubungi admin', !h.includes('admin'));
}
{
  const h = terjemahkanGalatUnggah('mime type image/heic is not supported');
  cek('tipe berkas: menyebut format yang dipakai', h.includes('JPG'));
}

console.log('\n3. Yang TIDAK boleh tertelan');
{
  const asli = 'Failed to fetch';
  cek('galat jaringan diteruskan apa adanya', terjemahkanGalatUnggah(asli) === asli);
}
{
  const asli = 'JWT expired';
  cek('sesi kedaluwarsa diteruskan apa adanya', terjemahkanGalatUnggah(asli) === asli);
}
{
  cek('tanpa pesan tetap ada kalimatnya', terjemahkanGalatUnggah(undefined).length > 0);
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA YANG GAGAL'} - ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
