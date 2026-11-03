'use client';

import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { IncentiveProjectRow, formatRupiah } from './calc';
import { useState } from 'react';
import { setAksesIncentive, setBrandScopeIncentive } from '@/lib/incentive-akses-api';
import { LABEL_AKSES, type TingkatAkses } from '@/lib/incentive-akses';
import { type ConfirmState } from '@/components/shared';
import { type CurrentUser } from './aturan-halaman';

export interface PengaturanInsentifKonteks {
  currentUser: CurrentUser | null;
  detailProject: IncentiveProjectRow | null;
  loadAll: () => Promise<void>;
  notify: (type: "success" | "error", msg: string) => void;
  openProjectDetail: (p: IncentiveProjectRow) => Promise<void>;
  setAllUsers: import("react").Dispatch<import("react").SetStateAction<CurrentUser[]>>;
  setConfirmState: import("react").Dispatch<import("react").SetStateAction<ConfirmState | null>>;
  setMarkingPaid: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setProjects: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow[]>>;
}

export function usePengaturanInsentif(k: PengaturanInsentifKonteks) {
  const { currentUser, detailProject, loadAll, notify, openProjectDetail, setAllUsers, setConfirmState, setMarkingPaid, setProjects } = k;
  const handleMarkPaid = async (trancheId: string, projectName: string, trancheNumber: number) => {
    setMarkingPaid(trancheId);
    const { data: terubah, error } = await supabase.from('incentive_tranches')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', trancheId).eq('status', 'processed').select('id');
    setMarkingPaid(null);
    if (error || !terubah || terubah.length === 0) {
      notify('error', error ? error.message : 'Gagal menandai Paid (mungkin sudah ditandai orang lain, atau akses tidak cukup).');
      return;
    }
    void logAudit({
      user_id: (currentUser?.id as string) ?? '', user_name: (currentUser?.full_name as string) ?? '',
      module: 'incentive', action: 'update',
      target_id: trancheId, target_name: `${projectName} — Tahap ${trancheNumber}`,
      old_value: 'processed', new_value: 'paid',
      notes: 'Ditandai Paid manual dari tabel Tranche Schedule.',
    });
    notify('success', 'Tranche ditandai Paid!'); loadAll();
    if (detailProject) openProjectDetail(detailProject);

    try {
      const { data: splits } = await supabase.from('incentive_splits')
        .select('user_id, user_name, amount').eq('tranche_id', trancheId);
      for (const s of (splits ?? []) as { user_id: string; user_name: string; amount: number }[]) {
        if (!s.user_id) continue;
        void createNotification({
          user_id: s.user_id, type: 'system',
          title: `💰 Insentif Tahap ${trancheNumber} cair`,
          body: `${projectName} — bagian kamu ${formatRupiah(Math.round(s.amount))}`,
          action_url: '/incentive-pts',
          created_by: currentUser?.full_name ?? 'System',
        });
      }
    } catch {  }
  };

  const konfirmasiMarkPaid = (trancheId: string, projectName: string, trancheNumber: number) => {
    setConfirmState({
      message: `Tandai tahap ${trancheNumber} "${projectName}" sebagai Paid?`,
      description: 'Menandakan uang sudah keluar. Tidak ada tombol untuk membatalkannya kembali dari sini.',
      danger: true, confirmLabel: 'Ya, Tandai Paid',
      onConfirm: () => handleMarkPaid(trancheId, projectName, trancheNumber),
    });
  };

  const [cariUser, setCariUser] = useState('');

  const handleSetBrandScope = async (userId: string, scope: string | null) => {
    const { error } = await setBrandScopeIncentive(userId, scope);
    if (error) { notify('error', 'Gagal: ' + error.message); return; }
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, incentive_brand_scope: scope } : u));
    notify('success', scope ? `Lingkup diset ke ${scope}.` : 'Lingkup dilepas — petugas ini melihat semua brand.');
  };

  const handleSetAkses = async (userId: string, nilai: TingkatAkses) => {
    const { error } = await setAksesIncentive(userId, nilai);
    if (error) { notify('error', 'Gagal: ' + error.message); return; }
    setAllUsers(prev => prev.map(u => u.id === userId
      ? { ...u, incentive_akses: nilai, allow_incentive_input: nilai !== 'lihat' }
      : u));
    notify('success', `Akses diset: ${LABEL_AKSES[nilai]}.`);
  };

  const handleSetProjectBrand = async (projectId: string, brand: 'MVI' | 'IVP' | 'BOTH') => {
    const { data, error } = await supabase.from('reminders').update({ brand }).eq('id', projectId).select('id');
    if (error || !data || data.length === 0) {
      notify('error', 'Gagal set brand: ' + (error?.message ?? 'tidak ada baris yang berubah'));
      return;
    }
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, brand } : p));
    notify('success', `Brand diset ke ${brand}.`);
  };
  return { handleMarkPaid, konfirmasiMarkPaid, cariUser, setCariUser, handleSetBrandScope, handleSetAkses, handleSetProjectBrand };
}
