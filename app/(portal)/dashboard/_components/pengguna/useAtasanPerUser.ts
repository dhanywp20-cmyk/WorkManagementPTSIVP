'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { pesanGalat } from '@/lib/galat/pesan';
import { User, JabatanType, JABATAN_CONFIG, JABATAN_CC_RULES } from '../shared';

type PetaGrup = { id: string; sales_division: string; supervisor_id: string };
type PetaUser = { id: string; user_id: string; supervisor_id: string };

const tierDari = (u?: User | null) => JABATAN_CONFIG[u?.jabatan as JabatanType]?.tier ?? 0;

export function useAtasanPerUser(p: { allUsers: User[]; divSupMaps: PetaGrup[]; userSupMaps: PetaUser[]; notify: (t: 'success' | 'error' | 'info', m: string) => void; fetchAll: () => Promise<void> }) {
  const { allUsers, divSupMaps, userSupMaps, notify, fetchAll } = p;
  const [selectedCCUserId, setSelectedCCUserId] = useState('');
  const [ccChecked, setCcChecked] = useState<Set<string>>(new Set());
  const [ccSaving, setCcSaving] = useState(false);

  useEffect(() => {
    if (!selectedCCUserId) { setCcChecked(new Set()); return; }
    setCcChecked(new Set(userSupMaps.filter(m => m.user_id === selectedCCUserId).map(m => m.supervisor_id)));
  }, [selectedCCUserId, userSupMaps]);

  const getUserById = (id: string) => allUsers.find(u => u.id === id);
  const atasanGrupUntuk = (u?: User | null): User[] => {
    if (!u?.sales_division) return [];
    const ids = divSupMaps.filter(m => m.sales_division === u.sales_division && m.supervisor_id !== u.id).map(m => m.supervisor_id);
    return allUsers.filter(x => ids.includes(x.id));
  };
  const atasanPerUserUntuk = (userId: string): User[] =>
    userSupMaps.filter(m => m.user_id === userId).map(m => getUserById(m.supervisor_id)).filter((x): x is User => !!x);

  const ccEligibleUsers = allUsers
    .filter(u => u.role?.toLowerCase() === 'guest' && u.jabatan && u.sales_division)
    .sort((a, b) => (a.sales_division ?? '').localeCompare(b.sales_division ?? '') || tierDari(a) - tierDari(b) || a.full_name.localeCompare(b.full_name, 'id'));

  const selectedUserObj = selectedCCUserId ? getUserById(selectedCCUserId) : null;
  const ccJabatan = JABATAN_CC_RULES[selectedUserObj?.jabatan as JabatanType] ?? [];
  const autoSuggested = atasanGrupUntuk(selectedUserObj).filter(u => u.jabatan && ccJabatan.includes(u.jabatan as JabatanType)).map(u => u.id);
  const potentialCCTargets = selectedUserObj
    ? allUsers.filter(u => u.id !== selectedCCUserId && !!u.jabatan && tierDari(u) > tierDari(selectedUserObj)).sort((a, b) => tierDari(b) - tierDari(a))
    : [];

  const handleSaveUserCC = async () => {
    if (!selectedCCUserId) return;
    setCcSaving(true);
    try {
      const { error: galatHapus } = await supabase.from('user_supervisor_mappings').delete().eq('user_id', selectedCCUserId).select('id');
      if (galatHapus) { notify('error', 'Gagal menghapus mapping lama: ' + galatHapus.message); setCcSaving(false); return; }
      const toInsert = Array.from(ccChecked).map(supId => ({ user_id: selectedCCUserId, supervisor_id: supId }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('user_supervisor_mappings').insert(toInsert);
        if (error) { notify('error', 'Gagal: ' + error.message); setCcSaving(false); return; }
      }
      notify('success', toInsert.length ? 'Atasan per user disimpan — menggantikan atasan grup.' : 'Atasan per user dikosongkan — kembali ikut atasan grup.');
      await fetchAll();
    } catch (e) { notify('error', pesanGalat(e)); }
    setCcSaving(false);
  };

  return {
    selectedCCUserId, setSelectedCCUserId, ccChecked, setCcChecked, ccSaving, handleSaveUserCC,
    ccEligibleUsers, selectedUserObj, autoSuggested, potentialCCTargets, atasanGrupUntuk, atasanPerUserUntuk,
  };
}
