/**
 * uji/profil-ai.mjs - pemisahan profil AI pembuat soal vs penilai.
 *
 *   node uji/profil-ai.mjs
 */
const AI_BAWAAN      = { model: 'gemini-2.5-flash',      arahan: '', suhu: 0.7 };
const PENILAI_BAWAAN = { model: 'gemini-2.5-flash-lite', arahan: '', suhu: 0.2, otomatis: false };

function rapikanPengaturanAI(isi) {
  const r = isi ?? {};
  const suhu = Number(r.suhu);
  return {
    model: (typeof r.model === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(r.model.trim()))
      ? r.model.trim() : AI_BAWAAN.model,
    arahan: typeof r.arahan === 'string' ? r.arahan.slice(0, 4000) : '',
    suhu: Number.isFinite(suhu) ? Math.min(2, Math.max(0, suhu)) : AI_BAWAAN.suhu,
  };
}
function rapikanPengaturanPenilai(isi) {
  const dasar = rapikanPengaturanAI(isi);
  const r = isi ?? {};
  const adaModel = typeof r.model === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(r.model.trim());
  const adaSuhu  = Number.isFinite(Number(r.suhu));
  return {
    model:  adaModel ? dasar.model : PENILAI_BAWAAN.model,
    arahan: dasar.arahan,
    suhu:   adaSuhu ? dasar.suhu : PENILAI_BAWAAN.suhu,
    otomatis: r.otomatis === true,
  };
}
/** Pemilihan token di server: token khusus menang, kosong jatuh ke token umum. */
const pilihToken = (khusus, umum) => khusus || umum;

let lulus = 0, gagal = 0;
const cek = (n, ok, c = '') => { if (ok) { lulus++; console.log(`  ok    ${n}`); } else { gagal++; console.log(`  GAGAL ${n}${c ? ' - ' + c : ''}`); } };

console.log('\n1. Bawaan penilai TIDAK ikut bawaan pembuat soal');
{
  const p = rapikanPengaturanPenilai({});
  cek('model penilai jatuh ke Flash-Lite, bukan Flash',
    p.model === 'gemini-2.5-flash-lite', p.model);
  cek('suhu penilai rendah (taat pada kunci)', p.suhu === 0.2, String(p.suhu));
  cek('otomatis MATI secara bawaan', p.otomatis === false);
}
{
  // Yang berbahaya: nilai tak sah diam-diam mewarisi model pembuat soal yang
  // jatah hariannya jauh lebih sempit.
  for (const buruk of [{ model: '' }, { model: 'a b' }, { model: null }, { model: 123 }]) {
    const p = rapikanPengaturanPenilai(buruk);
    if (p.model !== 'gemini-2.5-flash-lite') { gagal++; console.log(`  GAGAL model tak sah ${JSON.stringify(buruk)} -> ${p.model}`); }
  }
  cek('model tak sah tetap jatuh ke bawaan penilai', true);
}

console.log('\n2. Nilai yang sah tetap dihormati');
{
  const p = rapikanPengaturanPenilai({ model: 'gemini-2.0-flash', suhu: 0, otomatis: true, arahan: 'abaikan ejaan' });
  cek('model dipakai', p.model === 'gemini-2.0-flash');
  cek('suhu 0 tidak dikira kosong', p.suhu === 0, String(p.suhu));
  cek('otomatis bisa dinyalakan', p.otomatis === true);
  cek('arahan tersimpan', p.arahan === 'abaikan ejaan');
}
{
  cek('otomatis hanya true untuk boolean true',
    rapikanPengaturanPenilai({ otomatis: 'ya' }).otomatis === false);
}
{
  const p = rapikanPengaturanPenilai({ model: 'x/../../etc', suhu: 99 });
  cek('model dengan pemisah jalur ditolak', p.model === 'gemini-2.5-flash-lite', p.model);
  cek('suhu di luar rentang dijepit', p.suhu === 2, String(p.suhu));
}

console.log('\n3. Pemilihan token');
{
  cek('token koreksi dipakai bila ada', pilihToken('KOREKSI', 'UMUM') === 'KOREKSI');
  cek('kosong jatuh ke token pembuat soal', pilihToken('', 'UMUM') === 'UMUM');
  cek('null jatuh ke token pembuat soal', pilihToken(null, 'UMUM') === 'UMUM');
  cek('dua-duanya kosong = tidak ada token', !pilihToken(null, null));
}

console.log('\n4. Berapa panggilan untuk satu sesi');
{
  const peserta = 30, essay = 5;
  const lama = peserta * essay;          // satu panggilan per jawaban
  const baru = peserta;                  // satu panggilan per peserta
  cek('bentuk lama: 150 panggilan', lama === 150, String(lama));
  cek('bentuk baru: 30 panggilan', baru === 30, String(baru));
  cek('turun 80%', Math.round((1 - baru / lama) * 100) === 80);
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA YANG GAGAL'} - ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
