'use client';

/** useSelesaiTicket - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
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
  //  Isi kabar & penerimanya di lib/tiket-selesai.ts - dipakai juga DIWAYPI (server).
  const kabarkanTicketSelesai = async (t: Ticket, catatan: string) => {
    await kabarkan(supabase, efekPeramban, t, catatan, currentUser);
  };

  /**
   * Tutup jadwal Reminder Schedule yang lahir dari ticket ini.
   *
   * KENAPA SEARAH SAJA (ticket -> reminder, bukan sebaliknya)
   *
   * Ticket adalah sumber kebenaran pekerjaan troubleshooting; reminder yang
   * dibuat otomatis saat status Onsite hanyalah bayangan jadwalnya. Kalau
   * dibuat dua arah, menutup reminder akan ikut menutup ticket - padahal
   * ticket punya syarat penyelesaiannya sendiri (catatan aktivitas, lampiran,
   * serah terima Team Services) yang akan terlewati begitu saja.
   *
   * KENAPA HANYA KATEGORI TROUBLESHOOTING
   *
   * Menyelesaikan reminder kategori Konfigurasi/Training memicu Form Review
   * dan perhitungan insentif, dan menuntut tanggal BAST diisi lebih dulu.
   * Menutupnya dari sini akan melewati langkah-langkah itu diam-diam - uang
   * dan dokumen serah terima bukan hal yang boleh dilewati program. Reminder
   * yang lahir dari Ticketing selalu berkategori Troubleshooting, yang tidak
   * memicu keduanya, jadi penjaga ini sekaligus memastikan hanya jadwal
   * bawaan Ticketing yang tersentuh.
   */
  const tutupJadwalTicket = async (t: Ticket, jadi: 'done' | 'cancelled') => {
    //  RPC tutup_jadwal_ticket (bukan UPDATE langsung) - alasannya di lib/tiket-selesai.ts.
    const { ok, jumlah: n } = await tutupJadwal(supabase, t.id, jadi);
    if (!ok) {
      notify('error', 'Ticket tersimpan, tapi jadwal di Reminder Schedule gagal ditutup. Mohon tutup manual.');
      return;
    }
    //  Tidak ada jadwal terkait yang perlu disentuh - itu keadaan normal
    //  (ticket yang tidak pernah lewat status Onsite), bukan kegagalan.
    if (n === 0) return;
    notify('success', jadi === 'done'
      ? `Jadwal di Reminder Schedule ikut ditutup (${n}).`
      : `Jadwal di Reminder Schedule ikut dibatalkan (${n}).`);
  };
  return { kabarkanTicketSelesai, tutupJadwalTicket };
}
