'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminBukaKunci, adminDaftarKunci } from '@/lib/admin-users';
import { logAudit } from '@/lib/audit';
import { getSession } from '@/lib/auth/sesi';

type Notify = (type: 'success' | 'error', msg: string) => void;

export function useKunciLogin(notify: Notify) {
  const [terkunci, setTerkunci] = useState<Record<string, string>>({});
  const [membuka, setMembuka] = useState<string | null>(null);

  const muat = useCallback(async () => {
    const { terkunci: t, error } = await adminDaftarKunci();
    if (!error) setTerkunci(t);
  }, []);

  useEffect(() => { void muat(); }, [muat]);

  const kunciSampai = (username: string | null | undefined): string | null => {
    const s = terkunci[(username ?? '').trim().toLowerCase()];
    return s && new Date(s).getTime() > Date.now() ? s : null;
  };

  const bukaKunci = async (user: { id: string; username: string; full_name: string }) => {
    setMembuka(user.id);
    const { error } = await adminBukaKunci(user.username);
    setMembuka(null);
    if (error) { notify('error', 'Gagal membuka kunci login: ' + error.message); return; }
    notify('success', `Kunci login ${user.full_name} dibuka. Bisa login lagi sekarang.`);
    const admin = getSession<{ id: string; full_name: string }>();
    void logAudit({ user_id: admin?.id ?? '', user_name: admin?.full_name ?? '', action: 'update', module: 'user', target_id: user.id, target_name: user.full_name, notes: 'Buka kunci login' });
    await muat();
  };

  return { kunciSampai, bukaKunci, membuka, muatKunci: muat };
}
