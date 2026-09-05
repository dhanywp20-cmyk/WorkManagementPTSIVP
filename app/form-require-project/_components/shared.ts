import { supabase } from '@/lib/supabase';

// Types

export interface User {
  id: string;
  username: string;
  password: string;
  full_name: string;
  role: string;
  team_type?: string;
  sales_division?: string;
  phone_number?: string;
  allowed_menus?: string[];
}

export interface ProjectRequest {
  id: string;
  created_at: string;
  project_name: string;
  room_name: string;
  project_location?: string;
  sales_name: string;
  sales_division?: string;
  requester_id: string;
  requester_name: string;
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  kebutuhan: string[];
  kebutuhan_other: string;
  solution_product: string[];
  solution_other: string;
  layout_signage: string[];
  jaringan_cms: string[];
  jumlah_input: string;
  jumlah_output: string;
  source: string[];
  source_other: string;
  camera_conference: string;
  camera_jumlah: string;
  camera_tracking: string[];
  audio_system: string;
  audio_mixer: string;
  audio_detail: string[];
  wallplate_input: string;
  wallplate_jumlah: string;
  tabletop_input: string;
  tabletop_jumlah: string;
  wireless_presentation: string;
  wireless_mode: string[];
  wireless_dongle: string;
  controller_automation: string;
  controller_type: string[];
  ukuran_ruangan: string;
  suggest_tampilan: string;
  keterangan_lain: string;
  assign_name?: string;
  /**
   * Identitas berupa uuid, hidup berdampingan dengan sales_name/assign_name.
   * uuid menjawab SIAPA; nama tetap menjawab TERCATAT SEBAGAI SIAPA. Boleh
   * kosong - lihat sql/identitas-uuid.sql.
   */
  sales_user_id?: string | null;
  assign_user_id?: string | null;
  ivp_assignee?: string;
  approved_by?: string;
  approved_at?: string;
  due_date?: string;
  rooms?: RoomDetail[];
  brand_display?: string;
  brand_display_pic_id?: string;
  brand_display_pic_name?: string;
  /**
   * Display KEDUA untuk Ruangan 1. Disimpan di kolom tabel (bukan di `rooms`),
   * karena Ruangan 1 memang tidak ikut JSONB - lihat
   * sql/design-project-brand-display-2.sql.
   */
  brand_display_2?: string;
  brand_display_2_pic_id?: string;
  brand_display_2_pic_name?: string;
  brand_middleware?: string;
  brand_middleware_pic_id?: string;
  brand_middleware_pic_name?: string;
  rejection_reason?: string;
  routing_status?: string | null;      // 'internal_review' | 'admin_review' | 'supervisor_assign' | null
  internal_sales_id?: string | null;   // Sales Internal reviewer utama / MVI saat brand BOTH
  internal_approved_by?: string | null;
  internal_approved_at?: string | null;
  brand?: string | null;               // 'MVI' | 'IVP' | 'BOTH' - Marketing Brand pilihan Sales External
  internal_sales_id_2?: string | null; // reviewer kedua (IVP) saat brand BOTH
  internal_approved_at_2?: string | null; // approve reviewer kedua
  assigned_supervisor_id?: string | null; // Supervisor yg wajib assign lanjut ke tim (tahap supervisor_assign)
}

export interface RoomDetail {
  id: string;
  room_name: string;
  kebutuhan: string[];
  kebutuhan_other: string;
  solution_product: string[];
  solution_other: string;
  brand_display: string;
  /** Display kedua - satu ruangan bisa memakai dua brand display dengan PIC berbeda. */
  brand_display_2?: string;
  brand_display_2_pic_id?: string;
  brand_display_2_pic_name?: string;
  brand_display_pic_id: string;
  brand_display_pic_name: string;
  brand_middleware: string;
  brand_middleware_pic_id: string;
  brand_middleware_pic_name: string;
  layout_signage: string[];
  jaringan_cms: string[];
  jumlah_input: string;
  jumlah_output: string;
  source: string[];
  source_other: string;
  source_laptop_qty: string;
  source_pc_qty: string;
  camera_conference: string;
  camera_jumlah: string;
  camera_tracking: string[];
  audio_system: string;
  audio_mixer: string;
  audio_detail: string[];
  wallplate_input: string;
  wallplate_jumlah: string;
  tabletop_input: string;
  tabletop_jumlah: string;
  wireless_presentation: string;
  wireless_mode: string[];
  wireless_dongle: string;
  controller_automation: string;
  controller_type: string[];
  ukuran_ruangan: string;
  suggest_tampilan: string;
  keterangan_lain: string;
  survey_photos_count?: number;
  /**
   * Status tahap kerja RUANGAN INI SENDIRI - satu request bisa punya beberapa
   * ruangan yang progresnya beda-beda (mis. Smart ClassRoom sudah selesai,
   * Command Center masih dikerjakan). Ruangan pertama TIDAK punya field ini -
   * ia memakai status di level request langsung (project_requests.status),
   * karena field teknisnya juga sudah di situ, bukan di JSONB rooms[].
   *
   * Ruangan lama yang belum pernah disentuh lewat alur assign/status baru
   * TIDAK punya field ini sama sekali (undefined) - tampilannya jatuh
   * kembali ke status request supaya data lama tidak tiba-tiba terlihat
   * "Pending" padahal sudah lama selesai. Lihat getRoomStatus() di page.tsx.
   */
  status?: 'pending' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  assign_name?: string | null;
  assign_user_id?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
}

export interface BrandPicMapping {
  id: string;
  brand_type: 'display' | 'middleware';
  brand_name: string;
  pic_user_id: string;
  pic_user_name: string;
}

export interface ProjectMessage {
  id: string;
  request_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
  attachments?: ProjectAttachment[];
}

export interface ProjectAttachment {
  id: string;
  message_id?: string;
  request_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  attachment_category?: 'general' | 'sld' | 'boq' | 'design3d';
  revision_version?: number;
}

// Constants


// WA notif terpusat di lib/wa.ts - re-export agar call-site lama tetap jalan.
export { sendWANotif } from '@/lib/wa';

// Hierarki jabatan & aturan CC - satu sumber kebenaran di lib/jabatan.ts,
// diimpor (bukan cuma re-export) karena JABATAN_CC_RULES juga dipakai
// langsung di fetchWACCTargets di bawah ini. Dilonggarkan ke Record<string,...>
// di sini karena diindeks dengan jabatan dinamis (kolom users.jabatan, tipe
// string biasa) - lib/jabatan.ts sendiri tetap ketat (Record<JabatanType,...>).
import { JABATAN_TIER, JABATAN_CC_RULES as JABATAN_CC_RULES_KETAT } from '@/lib/jabatan';
const JABATAN_CC_RULES: Record<string, string[]> = JABATAN_CC_RULES_KETAT;
export { JABATAN_TIER, JABATAN_CC_RULES };

// CC ke atasan berdasarkan jabatan tier + IVP handler
export async function fetchWACCTargets(
  userId: string,
  salesDiv: string
): Promise<{ phone: string; name: string; relation: string }[]> {
  const targets: { phone: string; name: string; relation: string }[] = [];
  try {
    const { data: userData } = await supabase.from('users').select('jabatan').eq('id', userId).maybeSingle();
    const jabatan = userData?.jabatan as string | undefined;

    if (jabatan && JABATAN_CC_RULES[jabatan]) {
      const ccJabatanList = JABATAN_CC_RULES[jabatan];
      if (ccJabatanList.length > 0) {
        const { data: supMaps } = await supabase
          .from('division_supervisor_mappings').select('supervisor_id').eq('sales_division', salesDiv);
        if (supMaps?.length) {
          const { data: sups } = await supabase.from('users')
            .select('full_name, phone_number, jabatan')
            .in('id', supMaps.map((m: any) => m.supervisor_id))
            .not('phone_number', 'is', null).neq('phone_number', '');
          sups?.forEach((s: any) => {
            if (s.jabatan && ccJabatanList.includes(s.jabatan)) {
              targets.push({ phone: s.phone_number, name: s.full_name, relation: 'supervisor' });
            }
          });
        }
        const { data: userSupMaps } = await supabase
          .from('user_supervisor_mappings').select('supervisor_id').eq('user_id', userId);
        if (userSupMaps?.length) {
          const { data: manualSups } = await supabase.from('users')
            .select('full_name, phone_number, jabatan')
            .in('id', userSupMaps.map((m: any) => m.supervisor_id))
            .not('phone_number', 'is', null).neq('phone_number', '');
          manualSups?.forEach((s: any) => {
            if (!targets.find(t => t.phone === s.phone_number)) {
              targets.push({ phone: s.phone_number, name: s.full_name, relation: 'supervisor' });
            }
          });
        }
      }
    }

    if (salesDiv && salesDiv !== 'IVP') {
      const { data: ivpRes } = await supabase
        .from('division_ivp_mappings').select('ivp_id').eq('sales_division', salesDiv);
      if (ivpRes?.length) {
        const { data: ivps } = await supabase.from('users').select('full_name, phone_number')
          .in('id', ivpRes.map((s: any) => s.ivp_id))
          .not('phone_number', 'is', null).neq('phone_number', '');
        ivps?.forEach((s: any) => {
          if (!targets.find(t => t.phone === s.phone_number)) {
            targets.push({ phone: s.phone_number, name: s.full_name, relation: 'ivp_handler' });
          }
        });
      }
    }
  } catch (e) { console.warn('[fetchWACCTargets]', e); }
  return targets;
}

/**
 * Daftar divisi sales - HANYA nilai bawaan, bukan lagi sumber kebenaran.
 *
 * Daftar yang benar-benar berlaku disimpan di database dan dibaca lewat
 * useDivisiSales() (lihat lib/merek.ts), supaya divisi baru bisa ditambahkan
 * dari Admin Panel tanpa deploy. Nama ini dipertahankan untuk pemakaian di
 * luar React dan sebagai cadangan saat pengaturannya belum termuat.
 *
 * Sebelumnya daftar yang sama disalin di lima berkas shared.ts: menambah satu
 * divisi berarti menyunting kelimanya, dan satu yang terlewat membuat divisi
 * itu muncul di sebagian menu saja.
 */
export { DIVISI_BAWAAN as SALES_DIVISIONS } from '@/lib/merek';

export const DISPLAY_BRANDS = ['Microvision', 'Philips', 'Panasonic', 'Newline', 'Promethean', 'Maxhub', 'Ledman', 'Taniled', 'Vivitek'] as const;
export const MIDDLEWARE_BRANDS = ['Tricolor', 'Wyrestorm', 'Extron', 'Crestron', 'AVCiT', 'Brightsign', 'Cue'] as const;
export const BRAND_PIC_DIVISIONS = ['IVP', 'MVI', 'MLDS', 'UMP', 'OSS'];

/**
 * Status tahap kerja untuk SATU ruangan tertentu (roomIdx: 0 = ruangan
 * pertama/req.room_name, 1+ = req.rooms[roomIdx-1]).
 *
 * Ruangan pertama selalu memakai status request langsung. Ruangan lain
 * memakai status miliknya sendiri KALAU sudah pernah di-assign/di-update
 * lewat alur baru; kalau belum (room.status undefined - data lama), jatuh
 * kembali ke status request supaya tidak tiba-tiba terlihat berbeda dari
 * sebelumnya.
 */
export function getRoomStatus(req: ProjectRequest, roomIdx: number): ProjectRequest['status'] {
  if (roomIdx === 0) return req.status;
  return req.rooms?.[roomIdx - 1]?.status ?? req.status;
}
export function getRoomAssignName(req: ProjectRequest, roomIdx: number): string | undefined {
  if (roomIdx === 0) return req.assign_name;
  return req.rooms?.[roomIdx - 1]?.assign_name ?? req.assign_name ?? undefined;
}
export function getRoomAssignUserId(req: ProjectRequest, roomIdx: number): string | null | undefined {
  if (roomIdx === 0) return req.assign_user_id;
  return req.rooms?.[roomIdx - 1]?.assign_user_id ?? req.assign_user_id ?? undefined;
}

/**
 * true kalau request ini punya lebih dari satu ruangan DAN progresnya sudah
 * tidak seragam lagi (mis. Smart ClassRoom completed, Command Center masih
 * in_progress). Dipakai di listing supaya admin tahu status di kolom itu
 * cuma mewakili ruangan pertama - buka detailnya untuk lihat per-ruangan.
 */
export function hasDivergentRoomStatus(req: ProjectRequest): boolean {
  if (!req.rooms || req.rooms.length === 0) return false;
  const totalRooms = 1 + req.rooms.length;
  const semua = Array.from({ length: totalRooms }, (_, i) => getRoomStatus(req, i));
  return new Set(semua).size > 1;
}

export const emptyRoom = (): RoomDetail => ({
  id: Math.random().toString(36).slice(2, 10),
  room_name: '', kebutuhan: [], kebutuhan_other: '', solution_product: [], solution_other: '',
  brand_display: '', brand_display_pic_id: '', brand_display_pic_name: '',
  brand_display_2: '', brand_display_2_pic_id: '', brand_display_2_pic_name: '',
  brand_middleware: '', brand_middleware_pic_id: '', brand_middleware_pic_name: '',
  layout_signage: [], jaringan_cms: [], jumlah_input: '', jumlah_output: '',
  source: [], source_other: '', source_laptop_qty: '', source_pc_qty: '',
  camera_conference: 'No', camera_jumlah: '', camera_tracking: [],
  audio_system: 'No', audio_mixer: '', audio_detail: [],
  wallplate_input: 'No', wallplate_jumlah: '', tabletop_input: 'No', tabletop_jumlah: '',
  wireless_presentation: 'No', wireless_mode: [], wireless_dongle: 'No',
  controller_automation: 'No', controller_type: [],
  ukuran_ruangan: '', suggest_tampilan: '', keterangan_lain: '',
});


export const PIE_COLORS = ['#7c3aed','#0ea5e9','#10b981','#e11d48','#f59e0b','#6366f1','#14b8a6','#f97316','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

export const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:     { label: '⏳ Pending',     color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-400' },
  approved:    { label: '✅ Approved',    color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-400' },
  in_progress: { label: '🔄 In Progress', color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-400' },
  completed:   { label: '🏆 Completed',   color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-400' },
  rejected:    { label: '❌ Rejected',    color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-400' },
};
