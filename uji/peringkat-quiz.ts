/**
 * uji/peringkat-quiz.ts - hitungPeringkat() (lib/learning-rank.ts).
 *
 * Fungsi ini menggantikan "Top Performers" lama yang (a) mengirim nama & skor
 * SELURUH peserta ke browser lalu cuma disamarkan CSS blur() - bukan proteksi
 * sungguhan, dan (b) selalu kosong untuk Guest/Sales karena RLS lc_quiz_attempts
 * menahan mereka membaca baris siapa pun selain dirinya. hitungPeringkat cuma
 * mengembalikan ANGKA milik si pemanggil - tidak pernah nama/skor orang lain.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy \
 *   NEXT_PUBLIC_SUPABASE_SERVICES_URL=https://y.supabase.co \
 *   NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY=dummy \
 *   npx tsx uji/peringkat-quiz.ts
 */
import { hitungPeringkat, type BarisAttempt } from '../lib/learning-rank';

let lulus = 0, gagal = 0;
function ok(nama: string, syarat: boolean, ket = '') {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${ket ? ' — ' + ket : ''}`); }
}
function sama(nama: string, dapat: unknown, harap: unknown) {
  ok(nama, JSON.stringify(dapat) === JSON.stringify(harap), `dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);
}

function baris(user_id: string, score: number, role: string, divisi: string | null, status: string | null = 'graded'): BarisAttempt {
  return { user_id, score, grading_status: status, role, sales_division: divisi };
}

console.log('\n1. Kasus dasar: 5 sesama Guest, satu di antaranya si pemanggil');
{
  const rows = [
    baris('u1', 95, 'guest', 'Jakarta'),
    baris('u2', 90, 'guest', 'Jakarta'),
    baris('u3', 85, 'guest', 'Bandung'),
    baris('u4', 80, 'guest', 'Jakarta'),
    baris('u5', 70, 'guest', 'Bandung'),
  ];
  const hasil = hitungPeringkat(rows, { id: 'u3', role: 'guest', sales_division: 'Bandung' });
  sama('Global: peringkat 3 dari 5', [hasil.globalRank, hasil.globalTotal], [3, 5]);
  sama('Divisi Bandung: peringkat 1 dari 2 (u3=85, u5=70)', [hasil.divisiRank, hasil.divisiTotal], [1, 2]);
}

console.log('\n2. Role lain TIDAK ikut tercampur ke peer group');
{
  const rows = [
    baris('u1', 99, 'guest', null),
    baris('t1', 100, 'team', null),   // skor tertinggi, tapi beda role - tidak boleh menggeser peringkat guest
    baris('t2', 95, 'team', null),
  ];
  const hasil = hitungPeringkat(rows, { id: 'u1', role: 'guest', sales_division: null });
  sama('u1 tetap peringkat 1 dari 1 di kelompok guest', [hasil.globalRank, hasil.globalTotal], [1, 1]);
}

console.log('\n3. "guest" dan "sales" TIDAK digabung (sesuai label lama "Top Performers — Guest")');
{
  const rows = [
    baris('g1', 90, 'guest', null),
    baris('s1', 95, 'sales', null),
  ];
  const hasilGuest = hitungPeringkat(rows, { id: 'g1', role: 'guest', sales_division: null });
  sama('Guest g1 peringkat 1 dari 1 (sales tidak ikut)', [hasilGuest.globalRank, hasilGuest.globalTotal], [1, 1]);
  const hasilSales = hitungPeringkat(rows, { id: 's1', role: 'sales', sales_division: null });
  sama('Sales s1 peringkat 1 dari 1 (guest tidak ikut)', [hasilSales.globalRank, hasilSales.globalTotal], [1, 1]);
}

console.log('\n4. Attempt pending_review (belum dinilai) tidak ikut dihitung');
{
  const rows = [
    baris('u1', 60, 'guest', null),
    baris('u2', 200, 'guest', null, 'pending_review'), // skor mentah tinggi tapi belum final
  ];
  const hasil = hitungPeringkat(rows, { id: 'u1', role: 'guest', sales_division: null });
  sama('u2 (pending) tidak ikut peer group', hasil.globalTotal, 1);
  sama('u1 tetap peringkat 1', hasil.globalRank, 1);
}

console.log('\n5. Rata-rata dari beberapa attempt per orang, bukan attempt terakhir saja');
{
  const rows = [
    baris('u1', 100, 'guest', null), baris('u1', 50, 'guest', null),   // avg 75
    baris('u2', 60, 'guest', null), baris('u2', 60, 'guest', null),    // avg 60
  ];
  const hasil = hitungPeringkat(rows, { id: 'u2', role: 'guest', sales_division: null });
  sama('u2 (avg 60) di bawah u1 (avg 75) -> peringkat 2', hasil.globalRank, 2);
}

console.log('\n6. Belum pernah quiz sama sekali -> null, bukan 0 atau error');
{
  const rows = [baris('u1', 80, 'guest', null)];
  const hasil = hitungPeringkat(rows, { id: 'tidak-ada', role: 'guest', sales_division: null });
  sama('globalRank null (bukan 0)', hasil.globalRank, null);
  sama('globalTotal tetap menghitung yang lain', hasil.globalTotal, 1);
}

console.log('\n7. Tidak punya sales_division (mis. Team) -> divisiRank null, bukan 0');
{
  const rows = [baris('t1', 80, 'team', null)];
  const hasil = hitungPeringkat(rows, { id: 't1', role: 'team', sales_division: null });
  sama('divisiRank null karena caller tidak punya divisi', hasil.divisiRank, null);
  sama('divisiTotal 0', hasil.divisiTotal, 0);
}

console.log('\n8. Baris yatim (user tidak ditemukan / role null) tidak ikut & tidak meledak');
{
  const rows: BarisAttempt[] = [
    baris('u1', 80, 'guest', null),
    { user_id: 'hantu', score: 999, grading_status: 'graded', role: null, sales_division: null },
  ];
  const hasil = hitungPeringkat(rows, { id: 'u1', role: 'guest', sales_division: null });
  sama('Baris yatim tidak ikut peer group', hasil.globalTotal, 1);
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
