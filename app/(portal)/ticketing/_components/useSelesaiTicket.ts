'use client';

import { User, Ticket } from './shared';
import { supabase } from '@/lib/supabase';
import { efekPeramban } from '@/lib/efek-peramban';
import { kabarkanTicketSelesai as kabarkan, tutupJadwalTicket as tutupJadwal } from '@/lib/tiket-selesai';

export interface SelesaiTicketKonteks {
  currentUser: User | null;
  notify: (type: "success" | "error", msg: string) => void;
}

export function useSelesaiTicket(k: SelesaiTicketKonteks) {
  const { currentUser, notify } = k;
  const kabarkanTicketSelesai = async (t: Ticket, catatan: string) => {
    await kabarkan(supabase, efekPeramban, t, catatan, currentUser);
  };

  const tutupJadwalTicket = async (t: Ticket, jadi: 'done' | 'cancelled') => {
    const { ok, jumlah: n } = await tutupJadwal(supabase, t.id, jadi);
    if (!ok) {
      notify('error', 'Ticket tersimpan, tapi jadwal di Reminder Schedule gagal ditutup. Mohon tutup manual.');
      return;
    }
    if (n === 0) return;
    notify('success', jadi === 'done'
      ? `Jadwal di Reminder Schedule ikut ditutup (${n}).`
      : `Jadwal di Reminder Schedule ikut dibatalkan (${n}).`);
  };
  return { kabarkanTicketSelesai, tutupJadwalTicket };
}
