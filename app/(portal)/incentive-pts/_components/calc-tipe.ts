/** calc-tipe.ts - dipecah dari calc.ts (scripts/pecah-modul.mjs); calc.ts tetap mengekspor ulang semuanya. */
import { SkemaInsentif } from '@/lib/incentive-scheme';

// Types

export interface IncentiveProjectRow {
  id: string;
  project_name: string;
  category: string;
  assigned_to: string;
  assign_name: string;
  status: string;
  requires_controller_automation: boolean;
  controller_automation_brand: string | null;
  /** 'MVI' | 'IVP' | 'BOTH' — menentukan petugas Finance mana yang boleh melihatnya. */
  brand?: string | null;
  /** true = sengaja dikeluarkan dari perhitungan insentif; jadwalnya tetap ada. */
  incentive_excluded?: boolean | null;
  /**
   * Pengikat jadwal multi-tanggal: lima hari berturut-turut = lima baris
   * reminder dengan batch_id yang sama, tapi SATU proyek insentif.
   * Lihat gabungkanPerBatch().
   */
  batch_id?: string | null;
  /**
   * Beberapa jadwal terpisah yang merupakan SATU proyek (mis. Konfigurasi
   * Senin + Training tiga hari kemudian). Hanya diisi lewat keputusan manusia -
   * lihat lib/kelompok-insentif.ts dan sql/incentive-kelompok-proyek.sql.
   */
  incentive_group_id?: string | null;
  pic_type: 'standard' | 'manager_pic';
  pic_id: string | null;
  domain_owner: string | null;
  mode_penyelesaian: 'onsite' | 'remote' | null;
  installer_name: string | null;
  installer_daerah: string | null;
  /** Akun PTS Cabang yang dipilih dari dropdown - null bila diketik manual. */
  installer_user_id: string | null;
  bast_date: string | null;
  incentive_value: number;
  sales_name: string;
  sales_division: string;
  address: string;
  product: string;
  created_at: string;
  due_date: string;
}

export interface IncentiveTranche {
  id: string;
  project_id: string;
  tranche_number: number;
  percentage: number;
  payment_year: number;
  status: 'pending' | 'processed' | 'paid';
  processed_at: string | null;
  paid_at: string | null;
  created_at: string;
  project?: IncentiveProjectRow;
  /** Salinan skema saat tahapan ini dibuat. Lihat sql/incentive-skema-versi.sql. */
  scheme_snapshot?: SkemaInsentif | null;
  scheme_label?: string | null;
}

export interface IncentiveSplit {
  id: string;
  project_id: string;
  tranche_id: string | null;
  /** Kunci peran; bebas karena peran baru bisa ditambah lewat Pengaturan. */
  role: string;
  user_id: string;
  user_name: string;
  percentage: number;
  amount: number;
  source_ticket_id: string | null;
  created_at: string;
}

export interface SupportAssignment {
  id: string;
  ticket_id: string | null;
  project_id: string;
  user_id: string;
  user_name: string;
  domain: string;
  assigned_by: string | null;
  assigned_at: string;
}

export interface LateTicketLink {
  id: string;
  late_ticket_id: string;
  parent_project_id: string;
  attached_tranche_number: number;
  attached_at: string;
  note: string | null;
  ticket_value: number;
  is_sunset: boolean;
}

export interface SplitResult {
  /** Kunci peran; bukan union tertutup karena peran baru bisa ditambah admin. */
  role: string;
  user_id: string;
  user_name: string;
  percentage: number;
  amount: number;
}
