// ─── Incentive PTS — Types ────────────────────────────────────────────────────

export interface User {
  id?: string;
  username: string;
  full_name: string;
  role: string;
  team_type?: string;
  jabatan?: string;
  allow_incentive_input?: boolean;
  allowed_menus?: string[];
}

export interface IncentiveSetting {
  id: string;
  handler_pct: number;
  backup_pct: number;
  updated_by?: string;
  updated_at?: string;
}

export interface IncentiveProject {
  id: string;
  reminder_id?: string;
  project_name: string;
  category: string;
  sales_name?: string;
  sales_division?: string;
  due_date?: string;
  handler_name: string;
  handler_username?: string;
  backup_names: string[];
  biaya_cadangan: number;
  biaya_input_by?: string;
  biaya_input_at?: string;
  periode?: string;
  status: 'pending' | 'paid';
  paid_at?: string;
  paid_by?: string;
  created_at: string;
  cos_project_no?: string;
  description?: string;
  notes?: string;
  address?: string;
  pic_name?: string;
  pic_phone?: string;
  product?: string;
}

export interface IncentiveDisbursement {
  id: string;
  project_id: string;
  person_name: string;
  person_username?: string;
  role_type: 'handler' | 'backup';
  pct: number;
  amount_rp: number;
  periode?: string;
}

export interface ReminderRow {
  id: string;
  project_name: string;
  category: string;
  assign_name?: string;
  assigned_to?: string;
  sales_name?: string;
  sales_division?: string;
  due_date?: string;
  status?: string;
  description?: string;
  notes?: string;
  address?: string;
  pic_name?: string;
  pic_phone?: string;
  product?: string;
}

export interface RekapItem {
  person_name: string;
  total_rp: number;
  count: number;
  handler_count: number;
  backup_count: number;
}
