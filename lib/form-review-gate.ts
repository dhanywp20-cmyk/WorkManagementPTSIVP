import { supabase } from './supabase';

/**
 * Form Review Demo/BAST yang belum dinilai menahan pembuatan Request Schedule.
 *
 * ── Kenapa terpusat ─────────────────────────────────────────────────────────
 * Aturan ini semula hanya hidup di dalam halaman Request Schedule. Begitu
 * pintasan "buat" muncul juga di dashboard, aturannya terancam diturunkan
 * ulang di sana — dan dua salinan aturan berarti suatu saat salah satunya
 * ketinggalan diperbarui, lalu Sales bisa membuat jadwal baru lewat pintasan
 * padahal lewat halamannya sendiri ia ditahan.
 *
 * Sebuah review dianggap menggantung bila TIDAK ADA satu pun nilai yang
 * terisi — persis kriteria yang dipakai halaman Request Schedule sejak awal.
 */
export async function hitungReviewMenggantung(namaSales: string | null | undefined): Promise<number> {
  if (!namaSales) return 0;
  const { data } = await supabase
    .from('form_reviews')
    .select('id, grade_product_knowledge, grade_product_knowledge_bast, grade_training_customer')
    .eq('sales_name', namaSales);
  type Baris = {
    grade_product_knowledge: unknown;
    grade_product_knowledge_bast: unknown;
    grade_training_customer: unknown;
  };
  return (data ?? []).filter((r: Baris) =>
    !r.grade_product_knowledge && !r.grade_product_knowledge_bast && !r.grade_training_customer
  ).length;
}
