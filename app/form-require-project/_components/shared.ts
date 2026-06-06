import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  ivp_assignee?: string;
  approved_by?: string;
  approved_at?: string;
  due_date?: string;
  rooms?: RoomDetail[];
  brand_display?: string;
  brand_display_pic_id?: string;
  brand_display_pic_name?: string;
  brand_middleware?: string;
  brand_middleware_pic_id?: string;
  brand_middleware_pic_name?: string;
}

export interface RoomDetail {
  id: string;
  room_name: string;
  kebutuhan: string[];
  kebutuhan_other: string;
  solution_product: string[];
  solution_other: string;
  brand_display: string;
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

// ─── Constants ───────────────────────────────────────────────────────────────


// ── WA via direct fetch ke Edge Function (sama seperti reminder-schedule) ─────
export async function sendWANotif(body: Record<string, unknown>): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const res = await fetch(`${supabaseUrl}/functions/v1/swift-responder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log('[sendWANotif] response:', data);
  } catch (err: any) {
    console.error('[sendWANotif] error:', err.message);
  }
}

// ── Hierarki jabatan (bawah → atas) ──────────────────────────────────────────
export const JABATAN_TIER: Record<string, number> = {
  'Staff': 1, 'Supervisor': 2, 'Manager': 3,
  'Deputy General Manager': 4, 'General Manager': 5, 'Direktur': 6,
};
export const JABATAN_CC_RULES: Record<string, string[]> = {
  'Staff':                   ['Supervisor', 'Manager', 'Deputy General Manager', 'General Manager'],
  'Supervisor':              ['Manager', 'Deputy General Manager', 'General Manager'],
  'Manager':                 ['General Manager', 'Deputy General Manager', 'Direktur'],
  'Deputy General Manager':  ['General Manager', 'Direktur'],
  'General Manager':         ['Direktur'],
  'Direktur':                [],
};

// ── CC ke atasan berdasarkan jabatan tier + IVP handler ──────────────────────
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

export const SALES_DIVISIONS = [
  'IVP', 'MVI', 'MLDS', 'HAVS', 'Enterprise', 'DEC', 'ICS', 'POJ', 'VOJ', 'LOCOS',
  'VISIONMEDIA', 'UMP', 'BISOL', 'KIMS', 'IDC', 'IOCMEDAN', 'IOCPekanbaru',
  'IOCBandung', 'IOCJATENG', 'IOCSEMARANG', 'POSSurabaya', 'IOCSurabaya',
  'IOCBali', 'SGP', 'SGP 1', 'SGP 2', 'OSS',
] as const;

export const DISPLAY_BRANDS = ['Microvision', 'Philips', 'Panasonic', 'Newline', 'Promethean', 'Maxhub', 'Ledman', 'Taniled', 'Vivitek'] as const;
export const MIDDLEWARE_BRANDS = ['Tricolor', 'Wyrestorm', 'Extron', 'Crestron', 'AVCiT', 'Brightsign', 'Cue'] as const;
export const BRAND_PIC_DIVISIONS = ['IVP', 'MVI', 'MLDS', 'UMP', 'OSS'];

export const emptyRoom = (): RoomDetail => ({
  id: Math.random().toString(36).slice(2, 10),
  room_name: '', kebutuhan: [], kebutuhan_other: '', solution_product: [], solution_other: '',
  brand_display: '', brand_display_pic_id: '', brand_display_pic_name: '',
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
