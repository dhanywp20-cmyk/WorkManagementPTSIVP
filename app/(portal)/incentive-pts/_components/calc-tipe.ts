import { SkemaInsentif } from '@/lib/incentive-scheme';

export interface IncentiveProjectRow {
  id: string;
  project_name: string;
  category: string;
  assigned_to: string;
  assign_name: string;
  status: string;
  requires_controller_automation: boolean;
  controller_automation_brand: string | null;
  brand?: string | null;
  incentive_excluded?: boolean | null;
  batch_id?: string | null;
  incentive_group_id?: string | null;
  pic_type: 'standard' | 'manager_pic';
  pic_id: string | null;
  domain_owner: string | null;
  mode_penyelesaian: 'onsite' | 'remote' | null;
  installer_name: string | null;
  installer_daerah: string | null;
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
  scheme_snapshot?: SkemaInsentif | null;
  scheme_label?: string | null;
}

export interface IncentiveSplit {
  id: string;
  project_id: string;
  tranche_id: string | null;
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
  role: string;
  user_id: string;
  user_name: string;
  percentage: number;
  amount: number;
}
