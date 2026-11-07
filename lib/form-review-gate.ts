import { supabase } from './supabase';

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
