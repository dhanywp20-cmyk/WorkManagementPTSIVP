import type { AdminField } from '@/lib/admin-edit';
import { supabase } from '@/lib/supabase';
import { KUNCI_PENGATURAN } from '@/lib/kunci-pengaturan';
import { sendWA } from '@/lib/wa/inti';
import { adalahKategoriInsentif } from '@/lib/incentive/scheme';
import { CATEGORIES, REVIEW_TRIGGER_CATEGORIES, INCENTIVE_TRIGGER_CATEGORIES, formatDate, newBatchId, type StatusJadwal } from '@/lib/jadwal/aturan';
export { CATEGORIES, REVIEW_TRIGGER_CATEGORIES, INCENTIVE_TRIGGER_CATEGORIES, formatDate, newBatchId };
import { PRODUCT_TYPES, DAILY_REPORT_CATEGORIES, CATEGORY_CONFIG, PIE_COLORS, formatDatetime, type Priority, type RepeatType, type TeamUser,
  type GuestUser } from '@/lib/jadwal/tampilan';
export { PRODUCT_TYPES, DAILY_REPORT_CATEGORIES, CATEGORY_CONFIG, PIE_COLORS, formatDatetime };
export type { Priority, RepeatType, TeamUser, GuestUser };

export const DEFAULT_REQUEST_NOTE = 'Menunggu assignment dari Admin';

export function cleanRequestNotes(notes: string | null | undefined): string {
  const stripped = (notes ?? '').replace('[REQUEST SALES] ', '').replace('[REQUEST SALES]', '').trim();
  return stripped === DEFAULT_REQUEST_NOTE ? '' : stripped;
}

export type Status = StatusJadwal;
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
  progress_start_date?: string;
  progress_target_date?: string;
  mode_penyelesaian?: 'onsite' | 'remote' | null;
  installer_name?: string | null;
  installer_daerah?: string | null;
  installer_user_id?: string | null;
  display_type?: 'led' | 'lcd' | 'mix' | null;
  requires_middleware?: boolean;
  requires_controller_automation?: boolean;
  controller_automation_brand?: ControllerBrand | null;
  pic_type?: PicType;
  pic_id?: string | null;
  incentive_value?: number;
  bast_date?: string | null;
  incentive_excluded?: boolean | null;
  product_type?: string;
  batch_id?: string | null;
  incentive_group_id?: string | null;
  routing_status?: string | null;
  internal_sales_id?: string | null;
  internal_approved_by?: string | null;
  internal_approved_at?: string | null;
  brand?: string | null;
  internal_sales_id_2?: string | null;
  internal_approved_at_2?: string | null;
  rejection_reason?: string | null;
  assigned_supervisor_id?: string | null;
  sales_user_id?: string | null;
  assign_user_id?: string | null;
}

export const CONTROLLER_CATEGORIES = ['Konfigurasi', 'Konfigurasi & Training', 'Training'] as const;

export const CONTROLLER_BRANDS: { value: ControllerBrand; label: string }[] = [
  { value: 'cue', label: 'Cue System' },
  { value: 'extron', label: 'Extron' },
  { value: 'wyrestorm', label: 'Wyrestorm' },
];

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

export const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'none',    label: 'Tidak Berulang' },
  { value: 'daily',   label: 'Setiap Hari' },
  { value: 'weekly',  label: 'Setiap Minggu' },
  { value: 'monthly', label: 'Setiap Bulan' },
];

export { DIVISI_BAWAAN as SALES_DIVISIONS } from '@/lib/merek/inti';

export interface SupervisorCandidate {
  id: string;
  full_name: string;
  phone_number: string | null;
  team_type: string;
}

export async function resolveSupervisorsForProductType(productType: string | null | undefined): Promise<SupervisorCandidate[]> {
  if (!productType) return [];
  const { data: map } = await supabase.from('product_team_map').select('team_types').eq('product_type', productType).maybeSingle();
  const teamTypes: string[] = (map?.team_types as string[] | null) ?? [];
  if (teamTypes.length === 0) return [];
  const { data: sups } = await supabase.from('users')
    .select('id, full_name, phone_number, team_type')
    .in('team_type', teamTypes)
    .eq('jabatan', 'Supervisor');
  return (sups ?? []) as SupervisorCandidate[];
}

export async function fetchManagerTargets(): Promise<{ id: string; full_name: string; phone_number: string | null }[]> {
  const [{ data: mgrSetting }, { data: fullAccessTeam }] = await Promise.all([
    supabase.from('app_settings').select('value').eq('key', KUNCI_PENGATURAN.MANAGER).maybeSingle(),
    supabase.from('users').select('id, full_name, phone_number').eq('role', 'team').eq('access_level', 'full'),
  ]);
  const targets = new Map<string, { id: string; full_name: string; phone_number: string | null }>();
  for (const u of (fullAccessTeam ?? []) as { id: string; full_name: string; phone_number: string | null }[]) {
    targets.set(u.id, u);
  }
  const managerId = mgrSetting?.value ? String(mgrSetting.value).replace(/^"|"$/g, '') : '';
  if (managerId && !targets.has(managerId)) {
    const { data: mgr } = await supabase.from('users').select('id, full_name, phone_number').eq('id', managerId).maybeSingle();
    if (mgr) targets.set(mgr.id, mgr as { id: string; full_name: string; phone_number: string | null });
  }
  return [...targets.values()];
}

export function isDueToday(due_date: string) {
  return due_date === new Date().toISOString().split('T')[0];
}

export async function sendFonnteWA(
  target: string,
  message: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _meta?: Record<string, unknown>,
  event?: string,
): Promise<{ ok: boolean; reason?: string }> {
  return sendWA(target, message, 'reminder_wa', event);
}

export function layakIncentive(r: Reminder): boolean {
  return adalahKategoriInsentif(r.category) && r.status === 'done';
}

export function diluarIncentive(r: Reminder): boolean {
  return r.incentive_excluded === true;
}

export const REMINDER_FIELDS: AdminField[] = [
  { key: 'project_name', label: 'Nama Project' },
  { key: 'description',  label: 'Deskripsi' },
  { key: 'assigned_to',  label: 'Ditugaskan ke' },
  { key: 'due_date',     label: 'Tanggal' },
  { key: 'due_time',     label: 'Jam' },
  { key: 'priority',     label: 'Prioritas' },
  { key: 'status',       label: 'Status' },
  { key: 'category',     label: 'Kategori' },
  { key: 'sales_name',   label: 'Sales' },
  { key: 'sales_division', label: 'Divisi Sales' },
  { key: 'address',      label: 'Alamat' },
  { key: 'pic_name',     label: 'PIC' },
  { key: 'pic_phone',    label: 'Telepon PIC' },
  { key: 'product',      label: 'Produk' },
  { key: 'product_type', label: 'Tipe Produk' },
  { key: 'notes',        label: 'Catatan' },
  { key: 'warranty_years', label: 'Garansi (tahun)' },
  { key: 'progress_start_date',  label: 'Mulai Pengerjaan' },
  { key: 'progress_target_date', label: 'Target Selesai' },
];
