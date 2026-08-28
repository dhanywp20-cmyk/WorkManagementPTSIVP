/**
 * uji/banding-model.mjs - aturan fitur "Bandingkan 2 model".
 *
 *   node uji/banding-model.mjs
 */
/** Validasi model yang dikirim peramban - SALINAN aturan di app/api/ai/generate. */
const POLA = /^[A-Za-z0-9._-]{1,80}$/;
const pilihModel = (dariPermintaan, tersimpan) => {
  const m = typeof dariPermintaan === 'string' && POLA.test(dariPermintaan.trim())
    ? dariPermintaan.trim() : '';
  return m || tersimpan;
};
/** Syarat tombol Bandingkan boleh ditekan. */
const bolehBanding = (a, b) => !!a.trim() && !!b.trim() && a.trim() !== b.trim();

let lulus = 0, gagal = 0;
const cek = (n, ok, c = '') => { if (ok) { lulus++; console.log(`  ok    ${n}`); } else { gagal++; console.log(`  GAGAL ${n}${c ? ' - ' + c : ''}`); } };

console.log('\n1. Model dari peramban tidak boleh mengubah alamat yang dipanggil');
{
  // Nilainya masuk ke URL. Ini yang paling penting dijaga.
  const jahat = [
    '../../../v1beta/models/x',
    'gemini?key=BOCOR',
    'gemini/../../admin',
    'gemini 2.5',
    'https://lain.example/v1/models/x',
    'gemini\n:generateContent',
    'a'.repeat(81),
    '',
  ];
  let semua = true;
  for (const j of jahat) {
    const hasil = pilihModel(j, 'gemini-2.5-flash');
    if (hasil !== 'gemini-2.5-flash') { semua = false; console.log(`        bocor: ${JSON.stringify(j)} -> ${hasil}`); }
  }
  cek(`${jahat.length} bentuk menyimpang jatuh ke model tersimpan`, semua);
}
{
  cek('nama sah dipakai', pilihModel('gemini-3.1-flash-lite', 'gemini-2.5-flash') === 'gemini-3.1-flash-lite');
  cek('spasi di tepi dirapikan', pilihModel('  gemini-2.0-flash  ', 'x') === 'gemini-2.0-flash');
  cek('titik dan garis diterima', pilihModel('gemini-1.5-pro-002', 'x') === 'gemini-1.5-pro-002');
  cek('bukan string jatuh ke tersimpan', pilihModel(null, 'x') === 'x' && pilihModel(42, 'x') === 'x');
}

console.log('\n2. Syarat membandingkan');
{
  cek('dua model berbeda: boleh', bolehBanding('gemini-2.5-flash', 'gemini-3.1-flash-lite'));
  // Membandingkan model dengan dirinya sendiri menghabiskan dua panggilan untuk
  // tidak memberi tahu apa pun.
  cek('model yang sama: ditolak', !bolehBanding('gemini-2.5-flash', 'gemini-2.5-flash'));
  cek('sama walau beda spasi: ditolak', !bolehBanding('gemini-2.5-flash', ' gemini-2.5-flash '));
  cek('salah satu kosong: ditolak', !bolehBanding('gemini-2.5-flash', ''));
  cek('dua-duanya kosong: ditolak', !bolehBanding('', ''));
}

console.log('\n3. Satu sisi gagal, sisi lain tetap terpakai');
{
  // Meniru Promise.allSettled: kegagalan satu model tidak boleh membuang hasil
  // model satunya - yang berhasil tetap bisa disimpan.
  const olah = (ra, rb) => ({
    a: { rows: ra.status === 'fulfilled' ? ra.value : [], galat: ra.status === 'rejected' ? String(ra.reason) : '' },
    b: { rows: rb.status === 'fulfilled' ? rb.value : [], galat: rb.status === 'rejected' ? String(rb.reason) : '' },
  });
  const h = olah({ status: 'rejected', reason: 'jatah habis' }, { status: 'fulfilled', value: [1, 2, 3] });
  cek('sisi gagal menyimpan pesannya', h.a.galat === 'jatah habis');
  cek('sisi gagal tidak punya baris', h.a.rows.length === 0);
  cek('sisi berhasil utuh', h.b.rows.length === 3 && h.b.galat === '');

  const dua = olah({ status: 'rejected', reason: 'x' }, { status: 'rejected', reason: 'y' });
  cek('dua-duanya gagal tidak meledak', dua.a.galat === 'x' && dua.b.galat === 'y');
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA YANG GAGAL'} - ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
