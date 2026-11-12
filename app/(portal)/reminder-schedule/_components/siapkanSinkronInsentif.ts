'use client';

import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { Reminder, TeamUser, diluarIncentive } from './shared';

export interface KonteksSinkronInsentif {
  setSyncing: Dispatch<SetStateAction<string | null>>;
  notify: (type: "success" | "error", msg: string) => void;
  fetchRemindersQuiet: (user?: TeamUser | null) => Promise<void>;
  currentUser: TeamUser | null;
}

export function siapkanSinkronInsentif(k: KonteksSinkronInsentif) {
  const { setSyncing, notify, fetchRemindersQuiet, currentUser } = k;
  async function syncKeIncentive(r: Reminder) {
    const memangDiluar = diluarIncentive(r);
    setSyncing(r.id);
    const { error } = await supabase.from('reminders')
      .update({ incentive_excluded: false }).eq('id', r.id);
    setSyncing(null);
    if (error) {
      notify('error', /does not exist/i.test(error.message)
        ? 'Fitur ini belum aktif — Admin perlu menjalankan sql/incentive-keluarkan-proyek.sql lebih dulu.'
        : 'Gagal sync: ' + error.message);
      return;
    }
    if (!memangDiluar) {
      notify('success', `"${r.project_name}" memang sudah masuk daftar Incentive PTS.`);
      await fetchRemindersQuiet();
      return;
    }
    void logAudit({
      user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
      module: 'reminder-schedule', action: 'update',
      target_id: r.id, target_name: r.project_name,
      old_value: 'dikeluarkan dari Incentive',
      new_value: 'ikut dihitung di Incentive',
      notes: 'Dikembalikan lewat tombol Sync ke Incentive PTS',
    });
    notify(r.bast_date ? 'success' : 'error',
      r.bast_date
        ? `"${r.project_name}" kembali masuk daftar Incentive PTS.`
        : `"${r.project_name}" kembali masuk daftar Incentive PTS, tapi BAST-nya masih kosong — `
          + 'tahapan pencairan tidak akan bisa dibuat sampai Tanggal BAST diisi lewat '
          + '💲 Input Nominal di layar Incentive PTS.');
    await fetchRemindersQuiet();
  }
  return { syncKeIncentive };
}
