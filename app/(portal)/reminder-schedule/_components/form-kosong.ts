import type { Reminder } from './shared';

export type FormJadwal = Omit<Reminder, 'id' | 'created_at' | 'created_by' | 'wa_sent_h1'>;

export function buatFormKosong(): FormJadwal {
  return {
    project_name: '', description: '', assigned_to: '', assign_name: '',
    sales_user_id: null, assign_user_id: null,
    due_date: new Date().toISOString().split('T')[0],
    due_time: '09:00', priority: 'medium', status: 'pending',
    repeat: 'none', category: 'Demo Product',
    sales_name: '', sales_division: '', address: '', pic_name: '', pic_phone: '',
    progress_start_date: '', progress_target_date: '',
    notes: '', product: '', warranty_years: null,
    requires_controller_automation: false, controller_automation_brand: null,
    pic_type: 'standard', pic_id: null, incentive_value: 0, bast_date: null,
    product_type: '',
  };
}
