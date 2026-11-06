import type { SupabaseClient } from '@supabase/supabase-js';
import { appLink } from '@/lib/app-url';
import { tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';
import type { ReminderSnapshot } from '@/lib/checklist/sinkron-progress';
import type { EfekSamping } from '@/lib/efek-samping';
import { barisJadwalWA, formatDate, newBatchId, pesanJadwalBaru } from '@/lib/jadwal/aturan';

export interface IsianJadwal {
  project_name: string;
  description: string;
  assigned_to: string;
  due_date: string;
  due_time: string;
  category: string;
  sales_name: string;
  sales_division: string;
  address: string;
  pic_name: string;
  pic_phone: string;
  product?: string;
  notes?: string;
  [kolom: string]: unknown;
}

export interface OrangTim {
  id: string;
  username: string;
  full_name: string;
  phone_number?: string | null;
}

export const KOLOM_SNAPSHOT = 'id, project_name, address, sales_name, sales_division, assign_name, due_date, category, progress_start_date, progress_target_date';

export async function tandaiGrupInsentif(
  db: SupabaseClient, sumber: readonly { id: string; incentive_group_id?: string | null }[],
): Promise<{ grup: string; sebagianGagal: boolean }> {
  const adaGrup = sumber.find(r => r.incentive_group_id)?.incentive_group_id;
  const grup = adaGrup ?? crypto.randomUUID();
  if (adaGrup) return { grup, sebagianGagal: false };
  const idLama = sumber.map(r => r.id);
  const { data: terubah, error } = await db.from('reminders')
    .update({ incentive_group_id: grup }).in('id', idLama).select('id');
  return { grup, sebagianGagal: !!error || !terubah || terubah.length < idLama.length };
}

export type HasilBuatJadwal =
  | { ok: false; galat: string }
  | { ok: true; baris: { id: string; project_name: string | null }[]; waPelaksana: { ok: boolean; nama: string } | null };

export async function buatJadwal(db: SupabaseClient, efek: EfekSamping, p: {
  isian: IsianJadwal;
  tanggal: string[];
  timeline: { progress_start_date: string | null; progress_target_date: string | null };
  grupInsentif?: string | null;
  pelaksana: OrangTim | null | undefined;
  alihKeSupervisor: string[] | null;
  supervisor: OrangTim | null | undefined;
  salesUserId: string | null;
  pelaku: { username?: string | null; full_name?: string | null; id?: string | null } | null;
  sinkronProgress: (rows: ReminderSnapshot[]) => Promise<void>;
  lapor?: { tersimpan?: (jumlah: number) => void };
}): Promise<HasilBuatJadwal> {
  const { isian: formData, tanggal: allDates, pelaksana: assignee, alihKeSupervisor } = p;
  const oleh = p.pelaku?.full_name ?? 'Admin';
  const batchId = allDates.length > 1 ? newBatchId() : null;

  const payloads = allDates.map(d => ({
    ...formData,
    due_date: d,
    ...p.timeline,
    batch_id: batchId,
    ...(p.grupInsentif ? { incentive_group_id: p.grupInsentif } : {}),
    assign_name: assignee?.full_name ?? formData.assigned_to,
    sales_user_id: p.salesUserId,
    assign_user_id: assignee?.id ?? null,
    created_by: p.pelaku?.username ?? 'system',
    ...(alihKeSupervisor ? {
      assigned_to: '', assign_name: '', assign_user_id: null,
      routing_status: 'supervisor_assign',
      assigned_supervisor_id: alihKeSupervisor[1],
    } : {}),
  }));
  const insRes = await cobaIdentitas(async pakaiUuid =>
    await db.from('reminders').insert(pakaiUuid ? payloads : payloads.map(tanpaIdentitas)).select(KOLOM_SNAPSHOT));
  if (insRes.error) return { ok: false, galat: 'Gagal menyimpan: ' + insRes.error.message };
  const barisBaru = (insRes.data ?? []) as unknown as (ReminderSnapshot & { id: string; project_name: string | null })[];

  const latar: Promise<unknown>[] = [p.sinkronProgress(barisBaru)];
  for (const row of barisBaru) {
    latar.push(efek.audit({
      user_id: p.pelaku?.id ?? '', user_name: p.pelaku?.full_name ?? '',
      action: 'create', module: 'reminder',
      target_id: row.id, target_name: row.project_name ?? formData.project_name,
      notes: `Dibuat langsung oleh admin — kategori ${formData.category}`,
    }));
  }
  p.lapor?.tersimpan?.(allDates.length);

  if (alihKeSupervisor) {
    const supUser = p.supervisor;
    if (supUser?.phone_number) {
      latar.push(efek.wa(supUser.phone_number, [
        '🎯 *Jadwal Perlu Di-assign ke Tim*',
        '━━━━━━━━━━━━━━━━━━',
        `Halo *${supUser.full_name}*, kamu dapat jadwal dari *${oleh}*:`,
        `📌 *Project :* ${formData.project_name}`,
        `🏷️ *Kategori:* ${formData.category}`,
        `📍 *Lokasi  :* ${formData.address || '-'}`,
        `🗓️ *Tanggal :* ${formatDate(formData.due_date)} ${formData.due_time || ''}`,
        '━━━━━━━━━━━━━━━━━━',
        'Mohon tentukan anggota tim yang mengerjakan.',
        `🔗 ${appLink('/reminder-schedule')}`,
      ].join('\n'), 'reminder.routed_supervisor'));
    }
    if (supUser?.id) {
      latar.push(efek.inApp({
        user_id: supUser.id, type: 'reminder',
        title: '🎯 Jadwal perlu kamu assign',
        body: `${formData.project_name} — dari ${oleh}`,
        action_url: '/reminder-schedule',
        ref_id: barisBaru[0]?.id,
        created_by: oleh,
      }));
    }
  }

  let waPelaksana: { ok: boolean; nama: string } | null = null;
  if (assignee?.phone_number) {
    const nama = assignee.full_name ?? formData.assigned_to;
    const r = await efek.wa(assignee.phone_number,
      pesanJadwalBaru(nama, formData, barisJadwalWA(allDates, formData.due_time), appLink()), 'reminder.assigned');
    waPelaksana = { ok: r.ok, nama };
  }
  await Promise.allSettled(latar);
  return { ok: true, baris: barisBaru.map(b => ({ id: b.id, project_name: b.project_name })), waPelaksana };
}
