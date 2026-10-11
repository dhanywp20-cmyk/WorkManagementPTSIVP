'use client';

/** useSelesaiTicket - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { sendWANotif, User, Ticket } from './shared';
import { supabase } from '@/lib/supabase';
import { appLink } from '@/lib/app-url';
import { createNotification } from '@/lib/notifications';

export interface SelesaiTicketKonteks {
  currentUser: User | null;
  notify: (type: "success" | "error", msg: string) => void;
}

export function useSelesaiTicket(k: SelesaiTicketKonteks) {
  const { currentUser, notify } = k;
  const kabarkanTicketSelesai = async (t: Ticket, catatan: string) => {
    try {
      const penutup = currentUser?.full_name || t.assign_name || 'Tim';

      //  Semua pihak dikumpulkan dulu, lalu dicari sekali - bukan satu query
      //  per orang. Nama & username dipakai berdampingan karena tabel ticket
      //  menyimpan sebagian pihak sebagai nama dan sebagian sebagai username.
      const nama = [t.sales_name, t.assign_name].filter(Boolean) as string[];
      const username = [t.created_by].filter(Boolean) as string[];
      const idOrang = [t.assigned_supervisor_id, t.internal_sales_id, t.internal_sales_id_2]
        .filter(Boolean) as string[];

      const [resNama, resUser, resId] = await Promise.all([
        nama.length ? supabase.from('users').select('id,full_name,username,phone_number').in('full_name', nama)
                    : Promise.resolve({ data: [] as any[] }),
        username.length ? supabase.from('users').select('id,full_name,username,phone_number').in('username', username)
                        : Promise.resolve({ data: [] as any[] }),
        idOrang.length ? supabase.from('users').select('id,full_name,username,phone_number').in('id', idOrang)
                       : Promise.resolve({ data: [] as any[] }),
      ]);

      const semua = new Map<string, { id: string; full_name: string; username: string; phone_number: string | null }>();
      for (const u of [...(resNama.data ?? []), ...(resUser.data ?? []), ...(resId.data ?? [])]) {
        if (u?.id) semua.set(u.id, u);
      }

      const garis = '━━━━━━━━━━━━━━━━━━';
      const ringkas = [
        `📌 *Project :* ${t.project_name}`,
        `⚠️ *Issue   :* ${t.issue_case}`,
        `🙋 *Ditangani:* ${t.assign_name || penutup}`,
        catatan ? `📝 *Catatan :* ${catatan}` : '',
      ].filter(Boolean).join('\n');

      for (const u of semua.values()) {
        const dia = u.id === currentUser?.id;
        const pesan = dia
          ? ['🎉 *Terima Kasih!*', garis,
             `Halo *${u.full_name}*, ticket ini sudah kamu tutup sebagai *Solved*.`,
             ringkas, garis,
             'Terima kasih atas kerja kerasnya! 🙌',
             `🔗 ${appLink()}`].join('\n')
          : ['✅ *Ticket Selesai*', garis,
             `Halo *${u.full_name}*, ticket berikut sudah diselesaikan oleh *${penutup}*:`,
             ringkas, garis,
             'Silakan dicek bila masih ada yang perlu ditindaklanjuti.',
             `🔗 ${appLink()}`].join('\n');

        //  sendWANotif mengirim ke WhatsApp DAN Telegram sekaligus (lihat
        //  lib/wa.ts) - jadi tidak perlu dipanggil dua kali di sini.
        if (u.phone_number) void sendWANotif({ type: 'reminder_wa', target: u.phone_number, message: pesan });
        void createNotification({
          user_id: u.id, type: 'ticket',
          title: dia ? '🎉 Terima kasih — ticket selesai' : '✅ Ticket selesai',
          body: `${t.project_name} — ${t.issue_case}`,
          action_url: '/ticketing', ref_id: t.id,
          created_by: penutup,
        });
      }
    } catch {
      //  Kabar yang gagal tidak boleh membatalkan penyelesaian ticketnya -
      //  pekerjaannya sudah benar-benar selesai, apa pun nasib notifikasinya.
    }
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
    try {
      //  Lewat RPC, bukan UPDATE langsung: RLS reminders (rm_update) hanya
      //  mengizinkan PEMILIK barisnya, sehingga reminder yang dibuat Admin
      //  lalu dikerjakan handler lain tidak tersentuh - 0 baris berubah TANPA
      //  galat, dan layar mengira berhasil. RPC menurunkan izinnya dari
      //  ticket-nya (lihat migrasi 021).
      const { data: jumlah, error } = await supabase.rpc('tutup_jadwal_ticket', {
        p_ticket_id: t.id,
        p_status: jadi,
      });

      if (error) {
        notify('error', 'Ticket tersimpan, tapi jadwal di Reminder Schedule gagal ditutup. Mohon tutup manual.');
        return;
      }

      //  Tidak ada jadwal terkait yang perlu disentuh - itu keadaan normal
      //  (ticket yang tidak pernah lewat status Onsite), bukan kegagalan.
      const n = Number(jumlah ?? 0);
      if (n === 0) return;

      notify('success', jadi === 'done'
        ? `Jadwal di Reminder Schedule ikut ditutup (${n}).`
        : `Jadwal di Reminder Schedule ikut dibatalkan (${n}).`);
    } catch {
      /* Ticketnya sendiri sudah tersimpan - kegagalan menutup jadwal tidak
         boleh membatalkannya. */
    }
  };
  return { kabarkanTicketSelesai, tutupJadwalTicket };
}
