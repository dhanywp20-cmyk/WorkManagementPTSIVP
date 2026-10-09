/**
 * uji/form-review.ts - aturan Form Review Demo/BAST:
 *  - kategori reminder mana yang memicu review, dan jenis review-nya;
 *  - review "menggantung" (belum dinilai sama sekali) menahan Request Schedule baru.
 *
 * Tidak ada jaringan: fetch diganti mata-mata yang mencatat URL dan
 * mengembalikan baris palsu.
 *
 * Jalankan: npx tsx uji/form-review.ts
 */
import { getCategoryType, REVIEW_TRIGGER_CATEGORIES } from '@/app/(portal)/form-review/_components/shared';
import { hitungReviewMenggantung } from '@/lib/form-review-gate';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

const url: string[] = [];
let baris: Record<string, unknown>[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  url.push(decodeURIComponent(String(input instanceof Request ? input.url : input)).replace(/\+/g, ' '));
  return new Response(JSON.stringify(baris), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

async function jalan() {
  console.log('\n1. Kategori');
  cek('Demo Product -> review Demo Product', getCategoryType('Demo Product') === 'Demo Product');
  cek('Training & Konfigurasi & Training -> BAST', getCategoryType('Training') === 'BAST' && getCategoryType('Konfigurasi & Training') === 'BAST');
  cek('pemicu review: Demo Product, Konfigurasi & Training, Training',
    ['Demo Product', 'Konfigurasi & Training', 'Training'].every(k => REVIEW_TRIGGER_CATEGORIES.includes(k)));
  cek('Konfigurasi saja TIDAK memicu review', !REVIEW_TRIGGER_CATEGORIES.includes('Konfigurasi'));

  console.log('\n2. Review menggantung menahan jadwal baru');
  cek('tanpa nama Sales: 0 dan tidak ada kueri', (await hitungReviewMenggantung(null)) === 0 && url.length === 0);

  baris = [
    { id: 1, grade_product_knowledge: null, grade_product_knowledge_bast: null, grade_training_customer: null }, // menggantung
    { id: 2, grade_product_knowledge: 'A', grade_product_knowledge_bast: null, grade_training_customer: null },
    { id: 3, grade_product_knowledge: null, grade_product_knowledge_bast: 'B', grade_training_customer: null },
    { id: 4, grade_product_knowledge: null, grade_product_knowledge_bast: null, grade_training_customer: 'C' },
    { id: 5, grade_product_knowledge: '', grade_product_knowledge_bast: '', grade_training_customer: '' },      // menggantung
  ];
  const n = await hitungReviewMenggantung("Fajar O'Neil");
  cek('hanya review tanpa SATU pun nilai yang dihitung (2 dari 5)', n === 2);
  cek('kueri ke form_reviews', url[0]?.includes('/rest/v1/form_reviews'));
  cek("disaring per nama Sales, tanda kutip tidak memecah filter", url[0]?.includes("sales_name=eq.Fajar O'Neil"));

  baris = [];
  cek('tanpa review: 0', (await hitungReviewMenggantung('Budi')) === 0);

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
}
jalan();
