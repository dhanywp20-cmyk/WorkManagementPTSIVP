/**
 * lib/tiket-selesai.ts - efek berantai tiket Solved, dipakai BERSAMA oleh peramban
 * (ticketing/_components/useSelesaiTicket.ts) dan DIWAYPI (lib/integrasi-aksi.ts).
 *
 * Dipindah dari useSelesaiTicket apa adanya: isi pesan, penerima, dan urutannya sama.
 * Yang berubah hanya asal klien & pengirimnya - kini parameter (lib/efek-samping.ts).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appLink } from '@/lib/app-url';
import type { EfekSamping } from '@/lib/efek-samping';

/** Kolom tiket yang dibaca untuk mengabari - bagian dari Ticket ticketing. */
export interface TiketUntukKabar {
  id: string;
  project_name: string;
  issue_case: string;
  assign_name?: string | null;
  sales_name?: string | null;
  created_by?: string | null;
  assigned_supervisor_id?: string | null;
  internal_sales_id?: string | null;
  internal_sales_id_2?: string | null;
}

/** Kolom select untuk TiketUntukKabar (dipakai pemanggil server). */
export const KOLOM_KABAR_TIKET = 'id, project_name, issue_case, assign_name, sales_name, created_by, assigned_supervisor_id, internal_sales_id, internal_sales_id_2';

interface Orang { id: string; full_name: string; username: string; phone_number: string | null }

/**
 * Kabari Sales, handler, pembuat, Supervisor, dan Sales Internal bahwa tiket selesai -
 * WA (+Telegram) dan notifikasi in-app. Mengembalikan jumlah orang yang dikabari.
 * Tidak pernah melempar: pekerjaannya sudah selesai, apa pun nasib notifikasinya.
 */
export async function kabarkanTicketSelesai(
  db: SupabaseClient, efek: EfekSamping, t: TiketUntukKabar, catatan: string,
  penutupAkun: { id?: string | null; full_name?: string | null } | null,
): Promise<number> {
  try {
    const penutup = penutupAkun?.full_name || t.assign_name || 'Tim';

    //  Semua pihak dikumpulkan dulu, lalu dicari sekali - bukan satu query
    //  per orang. Nama & username dipakai berdampingan karena tabel ticket
    //  menyimpan sebagian pihak sebagai nama dan sebagian sebagai username.
    const nama = [t.sales_name, t.assign_name].filter(Boolean) as string[];
    const username = [t.created_by].filter(Boolean) as string[];
    const idOrang = [t.assigned_supervisor_id, t.internal_sales_id, t.internal_sales_id_2]
      .filter(Boolean) as string[];

    const kosong = Promise.resolve({ data: [] as Orang[] });
    const kolom = 'id,full_name,username,phone_number';
    const [resNama, resUser, resId] = await Promise.all([
      nama.length ? db.from('users').select(kolom).in('full_name', nama) : kosong,
      username.length ? db.from('users').select(kolom).in('username', username) : kosong,
      idOrang.length ? db.from('users').select(kolom).in('id', idOrang) : kosong,
    ]);

    const semua = new Map<string, Orang>();
    for (const u of [...((resNama.data ?? []) as Orang[]), ...((resUser.data ?? []) as Orang[]), ...((resId.data ?? []) as Orang[])]) {
      if (u?.id) semua.set(u.id, u);
    }

    const garis = '━━━━━━━━━━━━━━━━━━';
    const ringkas = [
      `📌 *Project :* ${t.project_name}`,
      `⚠️ *Issue   :* ${t.issue_case}`,
      `🙋 *Ditangani:* ${t.assign_name || penutup}`,
      catatan ? `📝 *Catatan :* ${catatan}` : '',
    ].filter(Boolean).join('\n');

    const kirim: Promise<unknown>[] = [];
    for (const u of semua.values()) {
      const dia = u.id === penutupAkun?.id;
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

      //  efek.wa mengirim ke WhatsApp DAN Telegram sekaligus (lihat lib/wa.ts) -
      //  jadi tidak perlu dipanggil dua kali di sini. Semua kabar berangkat
      //  bersamaan, lalu ditunggu bersama (server bisa mati sebelum selesai).
      if (u.phone_number) kirim.push(efek.wa(u.phone_number, pesan));
      kirim.push(efek.inApp({
        user_id: u.id, type: 'ticket',
        title: dia ? '🎉 Terima kasih — ticket selesai' : '✅ Ticket selesai',
        body: `${t.project_name} — ${t.issue_case}`,
        action_url: '/ticketing', ref_id: t.id,
        created_by: penutup,
      }));
    }
    await Promise.allSettled(kirim);
    return semua.size;
  } catch {
    //  Kabar yang gagal tidak boleh membatalkan penyelesaian ticketnya.
    return 0;
  }
}

/**
 * Tutup jadwal Reminder Schedule yang lahir dari ticket ini (searah: ticket -> reminder;
 * hanya kategori Troubleshooting - alasannya di useSelesaiTicket.ts).
 *
 * Lewat RPC, bukan UPDATE langsung: RLS reminders (rm_update) hanya mengizinkan PEMILIK
 * barisnya, sehingga reminder yang dibuat Admin lalu dikerjakan handler lain tidak
 * tersentuh - 0 baris berubah TANPA galat. RPC menurunkan izinnya dari ticket-nya
 * (migrasi 021). `jumlah` 0 = tidak ada jadwal terkait (normal), bukan kegagalan.
 */
export async function tutupJadwalTicket(
  db: SupabaseClient, ticketId: string, jadi: 'done' | 'cancelled',
): Promise<{ ok: boolean; jumlah: number }> {
  try {
    const { data: jumlah, error } = await db.rpc('tutup_jadwal_ticket', { p_ticket_id: ticketId, p_status: jadi });
    if (error) return { ok: false, jumlah: 0 };
    return { ok: true, jumlah: Number(jumlah ?? 0) };
  } catch {
    //  Ticketnya sendiri sudah tersimpan - kegagalan menutup jadwal tidak membatalkannya.
    return { ok: true, jumlah: 0 };
  }
}
