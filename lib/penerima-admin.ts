
import { supabase } from './supabase';

export const SARING_PENERIMA_ADMIN = 'role.in.(admin,superadmin),access_level.eq.full';

export interface PenerimaAdmin {
  id: string;
  full_name: string;
  username: string | null;
  phone_number: string | null;
}

export async function penerimaAdmin(): Promise<PenerimaAdmin[]> {
  const kolom = 'id, full_name, username, phone_number';
  const { data, error } = await supabase.from('users').select(kolom).or(SARING_PENERIMA_ADMIN);
  if (!error) return (data ?? []) as PenerimaAdmin[];

  const { data: mundur } = await supabase.from('users').select(kolom).in('role', ['admin', 'superadmin']);
  return (mundur ?? []) as PenerimaAdmin[];
}

export async function penerimaAdminBernomor(): Promise<PenerimaAdmin[]> {
  return (await penerimaAdmin()).filter(u => !!(u.phone_number ?? '').trim());
}

export async function managerUtama(): Promise<PenerimaAdmin | null> {
  try {
    const { data: setelan } = await supabase.from('app_settings')
      .select('value').eq('key', 'manager_user_id').maybeSingle();
    const id = setelan?.value ? String(setelan.value).replace(/^"|"$/g, '') : '';
    if (id) {
      const { data } = await supabase.from('users')
        .select('id, full_name, username, phone_number').eq('id', id).maybeSingle();
      if (data) return data as PenerimaAdmin;
    }
  } catch {  }

  try {
    const { data } = await supabase.from('users')
      .select('id, full_name, username, phone_number')
      .eq('access_level', 'full').order('full_name').limit(1).maybeSingle();
    return (data as PenerimaAdmin) ?? null;
  } catch {
    return null;
  }
}
