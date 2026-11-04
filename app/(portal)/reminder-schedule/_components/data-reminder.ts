import { supabase } from '@/lib/supabase';
import { isPimpinan } from '@/lib/pimpinan';
import { hasFullAccess } from '@/lib/constants';
import { kutipNilai, cobaIdentitas } from '@/lib/identitas';
import type { Reminder, TeamUser } from './shared';

export async function ambilReminderUntuk(
  activeUser: TeamUser | null,
  managerUserId: string | null | undefined,
): Promise<Reminder[]> {
  const perlakukanSebagaiGuest = (activeUser?.role === 'guest' || activeUser?.role === 'sales') && !isPimpinan(activeUser);
  if (!activeUser || !perlakukanSebagaiGuest) {
    const MAKS_REMINDERS = 5000;
    const { data, error, count } = await supabase.from('reminders').select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).limit(MAKS_REMINDERS);
    if (error) throw new Error(error.message);
    if ((count ?? 0) > MAKS_REMINDERS) {
      console.error(`[reminder-schedule] total reminders (${count}) melebihi batas aman ${MAKS_REMINDERS} - sebagian data terlama tidak ikut termuat.`);
    }
    const all = (data as Reminder[]) ?? [];
    if (!activeUser) return all;
    const roleLc = (activeUser.role ?? '').toLowerCase();
    const isAdminUser = roleLc === 'admin' || roleLc === 'superadmin';
    const isManagerUser = hasFullAccess(activeUser) || (roleLc === 'team' && !!managerUserId && activeUser.id === managerUserId);
    if (isAdminUser || isManagerUser || isPimpinan(activeUser)) return all;
    return all.filter(r =>
      !!r.assigned_to ||
      (!!r.assigned_supervisor_id && r.assigned_supervisor_id === activeUser.id)
    );
  }
  const [bySales, byCreator, awaitingMyReview, awaitingMyReview2, approvedByMe] = await Promise.all([
    cobaIdentitas(async pakaiUuid => await supabase.from('reminders').select('*')
      .or(pakaiUuid
        ? `sales_user_id.eq.${activeUser.id},sales_name.eq.${kutipNilai(activeUser.full_name)}`
        : `sales_name.eq.${kutipNilai(activeUser.full_name)}`)
      .order('created_at', { ascending: false })),
    supabase.from('reminders').select('*').eq('created_by', activeUser.username).order('created_at', { ascending: false }),
    supabase.from('reminders').select('*').eq('internal_sales_id', activeUser.id).eq('routing_status', 'internal_review').order('created_at', { ascending: false }),
    supabase.from('reminders').select('*').eq('internal_sales_id_2', activeUser.id).eq('routing_status', 'internal_review').order('created_at', { ascending: false }),
    supabase.from('reminders').select('*').eq('internal_approved_by', activeUser.id).order('created_at', { ascending: false }),
  ]);
  const combined = [...(bySales.data ?? []), ...(byCreator.data ?? []), ...(awaitingMyReview.data ?? []), ...(awaitingMyReview2.data ?? []), ...(approvedByMe.data ?? [])];
  const seen = new Set<string>();
  return (combined as Reminder[])
    .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}
