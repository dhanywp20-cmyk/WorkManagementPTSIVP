import { supabase } from '@/lib/supabase';
import { sendWA } from '@/lib/wa';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Status = 'pending' | 'done' | 'cancelled';
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly';
export type PicType = 'standard' | 'manager_pic';
export type ControllerBrand = 'cue' | 'extron' | 'wyrestorm';

export interface Reminder {
  id: string;
  title?: string;
  project_name: string;
  description: string;
  assigned_to: string;
  assign_name: string;
  due_date: string;
  due_time: string;
  priority: Priority;
  status: Status;
  repeat: RepeatType;
  category: string;
  sales_name: string;
  sales_division: string;
  address: string;
  pic_name: string;
  pic_phone: string;
  created_by: string;
  created_at: string;
  notes?: string;
  wa_sent_h1?: boolean;
  completion_photo_url?: string;
  product?: string;
  updated_at?: string;
  warranty_years?: 1 | 2 | 3 | null;
  mode_penyelesaian?: 'onsite' | 'remote' | null;
  installer_name?: string | null;
  installer_daerah?: string | null;
  display_type?: 'led' | 'lcd' | 'mix' | null;
  requires_middleware?: boolean;
  requires_controller_automation?: boolean;
  controller_automation_brand?: ControllerBrand | null;
  pic_type?: PicType;
  pic_id?: string | null;
  incentive_value?: number;
  bast_date?: string | null;
}

export interface TeamUser {
  id: string;
  username: string;
  full_name: string;
  role: string;
  team_type?: string;
  sales_division?: string;
  phone_number?: string;
  allowed_menus?: string[];
}

export interface GuestUser {
  id: string;
  username: string;
  full_name: string;
  role: string;
  phone_number?: string;
  sales_division?: string;
}

// Kategori yang men-trigger auto form_review ke Guest
export const REVIEW_TRIGGER_CATEGORIES = ['Demo Product', 'Konfigurasi & Training', 'Training'] as const;

// Kategori yang wajib memilih Onsite/Remote saat status → Completed
export const INCENTIVE_TRIGGER_CATEGORIES = ['Konfigurasi', 'Konfigurasi & Training', 'Training'] as const;

// Kategori yang mendukung Controller Automation (subset dari INCENTIVE_TRIGGER_CATEGORIES)
export const CONTROLLER_CATEGORIES = ['Konfigurasi', 'Konfigurasi & Training', 'Training'] as const;

export const CONTROLLER_BRANDS: { value: ControllerBrand; label: string }[] = [
  { value: 'cue', label: 'Cue System' },
  { value: 'extron', label: 'Extron' },
  { value: 'wyrestorm', label: 'Wyrestorm' },
];

// PTS IVP user yang boleh handle Controller Automation (standard pic_type)
export const CONTROLLER_AUTOMATION_ELIGIBLE = ['yoga', 'farhan'] as const;

// Manager/PIC fixed user (Dhany)
export const MANAGER_PIC_USERNAME = 'dhany';

// ─── Constants ────────────────────────────────────────────────────────────────
export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; border: string; dot: string }> = {
  low:    { label: 'Low',    color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.4)', dot: '#94a3b8' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)',  dot: '#f59e0b' },
  high:   { label: 'High',   color: '#f97316', bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.4)',  dot: '#f97316' },
  urgent: { label: 'Urgent', color: '#f43f5e', bg: 'rgba(244,63,94,0.2)',    border: 'rgba(244,63,94,0.5)',   dot: '#f43f5e' },
};

export const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; border: string; icon: string }> = {
  pending:     { label: 'Pending',    color: '#92400e', bg: '#fef3c7', border: '#f59e0b', icon: '⏳' },
  done:        { label: 'Completed',  color: '#065f46', bg: '#d1fae5', border: '#10b981', icon: '✅' },
  cancelled:   { label: 'Cancelled', color: '#374151', bg: '#f3f4f6', border: '#6b7280', icon: '❌' },
};

export const CATEGORIES = ['Demo Product', 'Meeting & Survey', 'Konfigurasi', 'Konfigurasi & Training', 'Troubleshooting', 'Training', 'Internal'];

export const CATEGORY_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string; accent: string }> = {
  'Demo Product':     { icon: '🖥️', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.4)', accent: '#7c3aed' },
  'Meeting & Survey': { icon: '🤝', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)',   border: 'rgba(56,189,248,0.4)',   accent: '#0ea5e9' },
  'Konfigurasi':      { icon: '⚙️', color: '#34d399', bg: 'rgba(52,211,153,0.15)',   border: 'rgba(52,211,153,0.4)',   accent: '#10b981' },
  'Konfigurasi & Training':      { icon: '📌', color: '#34d399', bg: 'rgba(52,211,153,0.15)',   border: 'rgba(52,211,153,0.4)',   accent: '#10b981' },
  'Troubleshooting':  { icon: '🔧', color: '#fb7185', bg: 'rgba(251,113,133,0.15)',   border: 'rgba(251,113,133,0.4)',  accent: '#e11d48' },
  'Training':         { icon: '🎓', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',    border: 'rgba(251,191,36,0.4)',   accent: '#d97706' },
  'Internal':         { icon: '🕵🏻', color: '#16a34a', bg: 'rgba(22,163,74,0.15)',    border: 'rgba(22,163,74,0.4)',   accent: '#16a34a' },
};

export const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'none',    label: 'Tidak Berulang' },
  { value: 'daily',   label: 'Setiap Hari' },
  { value: 'weekly',  label: 'Setiap Minggu' },
  { value: 'monthly', label: 'Setiap Bulan' },
];

export const SALES_DIVISIONS = [
  'IVP', 'MVI', 'MLDS', 'HAVS', 'Enterprise', 'DEC', 'ICS', 'POJ', 'VOJ', 'LOCOS',
  'VISIONMEDIA', 'UMP', 'BISOL', 'KIMS', 'IDC', 'IOCMEDAN', 'IOCPekanbaru',
  'IOCBandung', 'IOCJATENG', 'IOCSEMARANG', 'POSSurabaya', 'IOCSurabaya',
  'IOCBali', 'SGP', 'SGP 1', 'SGP 2', 'OSS',
] as const;

export const PIE_COLORS = ['#7c3aed','#0ea5e9','#10b981','#e11d48','#f59e0b','#6366f1','#14b8a6','#f97316','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatDate(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDatetime(createdAt: string) {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function isDueToday(due_date: string) {
  return due_date === new Date().toISOString().split('T')[0];
}

// Token Fonnte TIDAK lagi diambil di sisi klien — dulu getFonnteToken() menarik
// token rahasia ke browser via app_settings (anon). Pengiriman WA sekarang lewat
// Edge Function swift-responder yang memegang token-nya sendiri di server.

// WA terpusat di lib/wa.ts — wrapper menjaga signature lama (target, message, _meta).
export async function sendFonnteWA(
  target: string,
  message: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _meta?: Record<string, unknown>
): Promise<{ ok: boolean; reason?: string }> {
  return sendWA(target, message);
}
