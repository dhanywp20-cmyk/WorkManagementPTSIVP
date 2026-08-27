// Replika rapikanPengaturanAI - menjaga isian admin tidak bisa mengubah alamat
// yang dipanggil server lewat nama model.
const BAWAAN = { model: 'gemini-2.5-flash', arahan: '', suhu: 0.7 };
const rapikan = (r = {}) => {
  const suhu = Number(r.suhu);
  return {
    model: (typeof r.model === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(r.model.trim())) ? r.model.trim() : BAWAAN.model,
    arahan: typeof r.arahan === 'string' ? r.arahan.slice(0, 4000) : '',
    suhu: Number.isFinite(suhu) ? Math.min(2, Math.max(0, suhu)) : BAWAAN.suhu,
  };
};
let gagal = 0;
const cek = (s, l) => { console.log(`${s ? 'OK  ' : 'GAGAL'}  ${l}`); if (!s) gagal++; };

cek(rapikan({ model: 'gemini-3-pro' }).model === 'gemini-3-pro', 'Nama model wajar diterima');
cek(rapikan({ model: '  gemini-2.5-flash  ' }).model === 'gemini-2.5-flash', 'Spasi di tepi dirapikan');
for (const jahat of [
  'x:generateContent?key=BOCOR',
  '../../../v1/models/x',
  'a/b',
  'x?key=1',
  'x#y',
  'model dengan spasi',
  'a'.repeat(200),
  '',
]) cek(rapikan({ model: jahat }).model === BAWAAN.model, `Model ditolak, kembali ke bawaan: ${JSON.stringify(jahat.slice(0,34))}`);

cek(rapikan({ suhu: 99 }).suhu === 2, 'Suhu di atas batas dijepit ke 2');
cek(rapikan({ suhu: -5 }).suhu === 0, 'Suhu negatif dijepit ke 0');
cek(rapikan({ suhu: 'abc' }).suhu === 0.7, 'Suhu bukan angka kembali ke bawaan');
cek(rapikan({ arahan: 'x'.repeat(9999) }).arahan.length === 4000, 'Arahan dipotong di 4000 karakter');
cek(rapikan(undefined).model === BAWAAN.model, 'Tanpa isi sama sekali tetap aman');

console.log(gagal === 0 ? '\nLULUS' : `\n${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
