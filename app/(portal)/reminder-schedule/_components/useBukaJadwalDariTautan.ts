'use client';

import type { ReadonlyURLSearchParams } from 'next/navigation';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useEffect, useRef } from 'react';
import { Reminder, TeamUser } from './shared';

export interface BukaJadwalDariTautanKonteks {
  currentUser: TeamUser | null;
  searchParams: ReadonlyURLSearchParams;
  pintasanTerpakai: RefObject<boolean>;
  isGuest: boolean;
  jumlahReviewSiap: boolean;
  pendingReviewCount: number;
  mulaiRequestJadwal: () => void;
  setToast: Dispatch<SetStateAction<{ type: "success" | "error"; msg: string; } | null>>;
  canAddReminder: boolean;
  mulaiBuatReminder: () => void;
  reminders: Reminder[];
  setDetailReminder: Dispatch<SetStateAction<Reminder | null>>;
}

export function useBukaJadwalDariTautan(k: BukaJadwalDariTautanKonteks) {
  const { currentUser, searchParams, pintasanTerpakai, isGuest, jumlahReviewSiap, pendingReviewCount, mulaiRequestJadwal, setToast,
    canAddReminder, mulaiBuatReminder, reminders, setDetailReminder } = k;
  useEffect(() => {
    if (!currentUser || searchParams.get('buat') !== '1' || pintasanTerpakai.current) return;
    if (isGuest) {
      if (!jumlahReviewSiap) return;
      pintasanTerpakai.current = true;
      if (pendingReviewCount === 0) { mulaiRequestJadwal(); return; }
      setToast({ type: 'error', msg: `Selesaikan dulu ${pendingReviewCount} form review Demo/BAST yang belum dinilai.` });
      setTimeout(() => setToast(null), 5000);
      return;
    }
    if (canAddReminder) {
      pintasanTerpakai.current = true;
      mulaiBuatReminder();
    }
  }, [searchParams, currentUser, isGuest, jumlahReviewSiap, pendingReviewCount, canAddReminder]);

  const sudahBukaDariNotif = useRef(false);
  useEffect(() => {
    if (sudahBukaDariNotif.current) return;
    const openId = searchParams.get('open');
    if (!openId || reminders.length === 0) return;
    const target = reminders.find(r => r.id === openId);
    if (target) {
      sudahBukaDariNotif.current = true;
      setDetailReminder(target);
    }
  }, [searchParams, reminders]);
}
