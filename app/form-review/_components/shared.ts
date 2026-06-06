// ── Types ────────────────────────────────────────────────────────────────────

export type ReviewCategory = 'Demo Product' | 'BAST';

export interface ReviewForm {
  id: string;
  reminder_id: string;
  project_name: string;
  address: string;
  sales_name: string;
  sales_division: string;
  assign_name: string;
  assigned_to: string;
  reminder_category: string;
  review_category: ReviewCategory;
  // Demo Product fields
  product_demo?: string;
  grade_product_knowledge?: number;
  catatan_grade_product_knowledge?: string;
  // BAST fields
  product_bast?: string;
  grade_training_customer?: number;
  catatan_grade_training_customer?: string;
  grade_product_knowledge_bast?: number;
  catatan_grade_product_knowledge_bast?: string;
  // Shared
  foto_dokumentasi_url?: string;
  // Meta
  guest_username: string;
  created_at: string;
  updated_at?: string;
}

export interface Reminder {
  id: string;
  project_name: string;
  address: string;
  sales_name: string;
  sales_division: string;
  assign_name: string;
  assigned_to: string;
  category: string;
  status: string;
  due_date: string;
  due_time?: string;
}

export interface GuestUser {
  id: string;
  username: string;
  full_name: string;
  role: string;
  team_type?: string;
  sales_division?: string;
  phone_number?: string;
  allowed_menus?: string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

export const PIE_COLORS = ['#7c3aed','#0ea5e9','#10b981','#e11d48','#f59e0b','#6366f1','#14b8a6','#f97316','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

export const REVIEW_TRIGGER_CATEGORIES = ['Demo Product', 'Konfigurasi & Training', 'Training'];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getCategoryType(reminderCategory: string): ReviewCategory {
  if (reminderCategory === 'Demo Product') return 'Demo Product';
  return 'BAST';
}

export function formatDate(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDatetime(dt: string) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
