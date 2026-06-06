import { supabase } from '@/lib/supabase';

// ── WA via direct fetch ke Edge Function (sama seperti reminder-schedule) ─────
export async function sendWANotif(body: Record<string, unknown>): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const res = await fetch(`${supabaseUrl}/functions/v1/swift-responder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log("[sendWANotif] response:", data);
  } catch (err: any) {
    console.error("[sendWANotif] error:", err.message);
  }
}

// ── Hierarki jabatan (bawah → atas) ──────────────────────────────────────────
export const JABATAN_TIER: Record<string, number> = {
  'Staff': 1, 'Supervisor': 2, 'Manager': 3,
  'Deputy General Manager': 4, 'General Manager': 5, 'Direktur': 6,
};
// Rules CC otomatis: jabatan sender → list jabatan yang wajib di-CC
export const JABATAN_CC_RULES: Record<string, string[]> = {
  'Staff':                   ['Supervisor', 'Manager', 'Deputy General Manager', 'General Manager'],
  'Supervisor':              ['Manager', 'Deputy General Manager', 'General Manager'],
  'Manager':                 ['General Manager', 'Deputy General Manager', 'Direktur'],
  'Deputy General Manager':  ['General Manager', 'Direktur'],
  'General Manager':         ['Direktur'],
  'Direktur':                [],
};

// ── CC ke atasan berdasarkan jabatan tier + IVP handler ──────────────────────
// userId  = id user yang trigger event (untuk lookup jabatan mereka)
// salesDiv = sales_division user (untuk lookup IVP handler)
export async function fetchWACCTargets(
  userId: string,
  salesDiv: string
): Promise<{ phone: string; name: string; relation: string }[]> {
  const targets: { phone: string; name: string; relation: string }[] = [];
  try {
    // 1. Ambil jabatan user ybs
    const { data: userData } = await supabase.from("users").select("jabatan").eq("id", userId).maybeSingle();
    const jabatan = userData?.jabatan as string | undefined;

    if (jabatan && JABATAN_CC_RULES[jabatan]) {
      const ccJabatanList = JABATAN_CC_RULES[jabatan];
      if (ccJabatanList.length > 0) {
        // 2. Ambil user dengan jabatan yang masuk list CC, dari divisi yang sama
        //    Prioritas: div_supervisor_mappings → semua atasan yang terdaftar untuk divisi ini
        const { data: supMaps } = await supabase
          .from("division_supervisor_mappings")
          .select("supervisor_id")
          .eq("sales_division", salesDiv);
        if (supMaps?.length) {
          const supIds = supMaps.map((m: any) => m.supervisor_id);
          const { data: sups } = await supabase.from("users")
            .select("full_name, phone_number, jabatan")
            .in("id", supIds)
            .not("phone_number", "is", null)
            .neq("phone_number", "");
          sups?.forEach((s: any) => {
            if (s.jabatan && ccJabatanList.includes(s.jabatan)) {
              targets.push({ phone: s.phone_number, name: s.full_name, relation: "supervisor" });
            }
          });
        }

        // 3. Juga ambil dari user_supervisor_mappings (per-user mapping manual)
        const { data: userSupMaps } = await supabase
          .from("user_supervisor_mappings")
          .select("supervisor_id")
          .eq("user_id", userId);
        if (userSupMaps?.length) {
          const manualSupIds = userSupMaps.map((m: any) => m.supervisor_id);
          const { data: manualSups } = await supabase.from("users")
            .select("full_name, phone_number, jabatan")
            .in("id", manualSupIds)
            .not("phone_number", "is", null)
            .neq("phone_number", "");
          manualSups?.forEach((s: any) => {
            if (!targets.find(t => t.phone === s.phone_number)) {
              targets.push({ phone: s.phone_number, name: s.full_name, relation: "supervisor" });
            }
          });
        }
      }
    }

    // 4. IVP handler untuk divisi ini
    if (salesDiv && salesDiv !== "IVP") {
      const { data: ivpRes } = await supabase
        .from("division_ivp_mappings").select("ivp_id").eq("sales_division", salesDiv);
      if (ivpRes?.length) {
        const { data: ivps } = await supabase.from("users").select("full_name, phone_number")
          .in("id", ivpRes.map((s: any) => s.ivp_id))
          .not("phone_number", "is", null).neq("phone_number", "");
        ivps?.forEach((s: any) => {
          if (!targets.find(t => t.phone === s.phone_number)) {
            targets.push({ phone: s.phone_number, name: s.full_name, relation: "ivp_handler" });
          }
        });
      }
    }
  } catch (e) { console.warn("[fetchWACCTargets]", e); }
  return targets;
}

// ── Status list khusus Team Services ─────────────────────────────────────────
export const SERVICES_STATUSES = [
  "Waiting Approval",
  "Pending",
  "Warranty",
  "Out Of Warranty",
  "Waiting PO from Sales",
  "Submit RMA",
  "Waiting sparepart",
  "Process Repair",
  "Solved",
] as const;
export type ServicesStatus = (typeof SERVICES_STATUSES)[number];

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

export interface TeamMember {
  id: string;
  name: string;
  username: string;
  photo_url: string;
  role: string;
  team_type: string;
}

export interface ActivityLog {
  id: string;
  ticket_id?: string;
  handler_name: string;
  handler_username: string;
  action_taken: string;
  notes: string;
  file_url: string;
  file_name: string;
  photo_url?: string;
  photo_name?: string;
  new_status: string;
  team_type: string;
  assigned_to_services?: boolean;
  created_at: string;
}

export interface Ticket {
  id: string;
  project_name: string;
  address?: string;
  customer_phone: string;
  sales_name: string;
  issue_case: string;
  description: string;
  sn_unit?: string;
  product?: string;
  assign_name: string;
  status: string;
  date: string;
  created_at: string;
  created_by?: string;
  current_team: string;
  services_status?: string;
  sales_division?: string;
  photo_url?: string;
  photo_name?: string;
  activity_logs?: ActivityLog[];
}

export interface OverdueSetting {
  id: string;
  ticket_id: string;
  due_date: string | null;
  due_hours: number | null;
  set_by: string;
  created_at: string;
}

export const SALES_DIVISIONS = [
  'IVP', 'MVI', 'MLDS', 'HAVS', 'Enterprise', 'DEC', 'ICS', 'POJ', 'VOJ', 'LOCOS',
  'VISIONMEDIA', 'UMP', 'BISOL', 'KIMS', 'IDC', 'IOCMEDAN', 'IOCPekanbaru',
  'IOCBandung', 'IOCJATENG', 'IOCSEMARANG', 'POSSurabaya', 'IOCSurabaya',
  'IOCBali', 'SGP', 'SGP 1', 'SGP 2', 'OSS',
] as const;

// ── Helper Functions ─────────────────────────────────────────────────────────
export function formatDateTime(dateString: string) {
  if (!dateString) return "-";
  let normalized = dateString;
  if (!dateString.endsWith("Z") && !dateString.includes("+") && !(dateString.indexOf("-", 10) > -1)) {
    normalized = dateString + "Z";
  }
  const utcDate = new Date(normalized);
  if (isNaN(utcDate.getTime())) return dateString;
  const jakartaTime = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000);
  const day = String(jakartaTime.getUTCDate()).padStart(2, "0");
  const month = String(jakartaTime.getUTCMonth() + 1).padStart(2, "0");
  const year = jakartaTime.getUTCFullYear();
  const hours = String(jakartaTime.getUTCHours()).padStart(2, "0");
  const minutes = String(jakartaTime.getUTCMinutes()).padStart(2, "0");
  const seconds = String(jakartaTime.getUTCSeconds()).padStart(2, "0");
  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
}
