import { ReviewForm, PIE_COLORS } from './shared';

export function hitungPieReview(reviews: ReviewForm[]) {
  const categoryPieData = (() => {
    const map: Record<string, number> = {};
    reviews.forEach(r => { map[r.reminder_category] = (map[r.reminder_category] || 0) + 1; });
    return Object.entries(map).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const salesDivisionPieData = (() => {
    const map: Record<string, number> = {};
    reviews.forEach(r => { if (r.sales_division) map[r.sales_division] = (map[r.sales_division] || 0) + 1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const handlerPieData = (() => {
    const map: Record<string, number> = {};
    reviews.forEach(r => { if (r.assign_name) map[r.assign_name] = (map[r.assign_name] || 0) + 1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();

  const productPieData = (() => {
    const map: Record<string, number> = {};
    reviews.forEach(r => {
      const prod = r.review_category === 'Demo Product' ? r.product_demo : r.product_bast;
      if (prod) map[prod] = (map[prod] || 0) + 1;
    });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  })();
  return { categoryPieData, salesDivisionPieData, handlerPieData, productPieData };
}
