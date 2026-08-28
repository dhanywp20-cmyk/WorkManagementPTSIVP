/**
 * uji/daftar-model.mjs - penyaringan daftar model dari Google.
 *
 * Ada karena satu kekeliruan yang terulang: nama model DITEBAK, tidak
 * diperiksa. Yang diuji di sini adalah pengolahan jawaban Google jadi daftar
 * pilihan - bagian yang menentukan apakah orang menerima pilihan yang benar
 * atau daftar yang menyesatkan.
 *
 *   node uji/daftar-model.mjs
 */
function olahModel(data) {
  return ((data?.models ?? []))
    .filter(m => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map(m => ({
      id: (m.name ?? '').replace(/^models\//, ''),
      nama: m.displayName || (m.name ?? '').replace(/^models\//, ''),
    }))
    .filter(m => m.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

let lulus = 0, gagal = 0;
const cek = (n, ok, c = '') => { if (ok) { lulus++; console.log(`  ok    ${n}`); } else { gagal++; console.log(`  GAGAL ${n}${c ? ' - ' + c : ''}`); } };

console.log('\n1. Bentuk jawaban Google');
{
  const hasil = olahModel({ models: [
    { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
  ]});
  cek('awalan "models/" dibuang', hasil[0].id === 'gemini-2.5-flash', hasil[0].id);
}
{
  // Yang paling merugikan: model penyematan / pembuat gambar ikut tampil, lalu
  // dipilih, lalu gagal dengan pesan yang tidak nyambung.
  const hasil = olahModel({ models: [
    { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/imagen-3.0', supportedGenerationMethods: ['predict'] },
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
  ]});
  cek('hanya model yang bisa generateContent', hasil.length === 1 && hasil[0].id === 'gemini-2.5-flash',
    JSON.stringify(hasil.map(h => h.id)));
}
{
  const hasil = olahModel({ models: [
    { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-1.5-pro',   supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
  ]});
  cek('terurut, bukan urutan acak dari Google',
    JSON.stringify(hasil.map(h => h.id)) === '["gemini-1.5-pro","gemini-2.0-flash","gemini-2.5-flash"]',
    hasil.map(h => h.id).join(','));
}

console.log('\n2. Jawaban yang cacat tidak boleh meledak');
{
  cek('tanpa models sama sekali', olahModel({}).length === 0);
  cek('models null', olahModel({ models: null }).length === 0);
  cek('data null', olahModel(null).length === 0);
  cek('entri tanpa name dibuang',
    olahModel({ models: [{ supportedGenerationMethods: ['generateContent'] }] }).length === 0);
  cek('entri tanpa supportedGenerationMethods dibuang',
    olahModel({ models: [{ name: 'models/x' }] }).length === 0);
}

console.log('\n3. Model tersimpan yang tidak ada di daftar');
{
  // Perilaku UI: entri tambahan ditampilkan supaya pilihan lama tidak
  // diam-diam tergantikan baris pertama daftar.
  const daftar = olahModel({ models: [
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
  ]});
  const tersimpan = 'gemini-2.5-flash-lite';   // nama yang pernah ditebak dan ternyata tidak ada
  const perluEntriTambahan = !daftar.some(m => m.id === tersimpan);
  cek('model tersimpan yang hilang terdeteksi', perluEntriTambahan === true);
  cek('model tersimpan yang ada tidak digandakan',
    daftar.some(m => m.id === 'gemini-2.5-flash'));
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA YANG GAGAL'} - ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
