/**
 * Lapisan data Reminder Schedule (dipisah dari page.tsx): aturan SIAPA MELIHAT JADWAL APA.
 *
 *   - Admin, Manager (Full Access / manager_user_id) & Pimpinan: semua jadwal.
 *   - Anggota tim biasa: hanya yang sudah di-assign (siapa pun) atau di-route ke dirinya sebagai Supervisor.
 *   - Guest/Sales: jadwal atas namanya, yang ia ajukan, yang menunggu review Sales Internal-nya,
 *     dan yang sudah ia approve.
 *
 * Isi dipindahkan APA ADANYA dari ReminderSchedulePageInner.fetchRemindersForUser; satu-satunya
 * perubahan: `managerUserId` (dulu state komponen) kini parameter.
 */
import { supabase } from '@/lib/supabase';
import { isPimpinan } from '@/lib/pimpinan';
import { hasFullAccess } from '@/lib/constants';
import { kutipNilai, cobaIdentitas } from '@/lib/identitas';
import type { Reminder, TeamUser } from './shared';

export async function ambilReminderUntuk(
  activeUser: TeamUser | null,
  managerUserId: string | null | undefined,
): Promise<Reminder[]> {
// Helper: fetch reminders dengan filter guest - ambil yg sales_name = full_name ATAU created_by = username
  /*
    role === 'sales' dulu TIDAK diperlakukan sama dengan 'guest' di sini,
    walau di seluruh halaman ini keduanya sudah disatukan sebagai "akun
    eksternal" (lihat isGuest = role==='guest' || role==='sales'). Akibatnya
    akun ber-role 'sales' akan jatuh ke cabang tim biasa - yang mengambil
    SELURUH baris reminders dari server sebelum menyaring, bukan hanya
    miliknya sendiri. Belum ada akun nyata memakai role ini (diperiksa: tidak
    ada satu pun tempat yang membuat akun dengan role itu), tapi cabangnya
    tetap dibetulkan sekarang, sebelum ada yang memakainya.
  */
  //  Pimpinan (lib/pimpinan.ts) bukan "akun eksternal": ia melihat SEMUA jadwal, hanya baca.
  const perlakukanSebagaiGuest = (activeUser?.role === 'guest' || activeUser?.role === 'sales') && !isPimpinan(activeUser);
  if (!activeUser || !perlakukanSebagaiGuest) {
    /*
      H1 (audit): dulu limit(500) TANPA batas tanggal apa pun - begitu total
      baris reminders lewat 500, sisanya diam-diam tidak pernah terambil.
      Beda dengan Ticketing (jendela bergulir 12 bulan), halaman ini
      menyaring Filter Tahun di client dari SELURUH baris yang sudah
      ter-fetch - membatasi query ke jendela tanggal akan membuat tahun lama
      tampak kosong padahal datanya ada. Jadi dihitung dulu total barisnya
      supaya limit fetch selalu cukup (dibatasi MAKS_REMINDERS supaya tidak
      menarik data tak terbatas kalau suatu saat membengkak jauh - kalau
      sampai kejadian, dicatat lewat console, bukan diam-diam terpotong
      seperti sebelumnya).
    */
    const { count } = await supabase.from('reminders').select('id', { count: 'exact', head: true });
    const MAKS_REMINDERS = 5000;
    const batasAmbil = Math.min(Math.max(500, count ?? 0), MAKS_REMINDERS);
    if ((count ?? 0) > MAKS_REMINDERS) {
      console.error(`[reminder-schedule] total reminders (${count}) melebihi batas aman ${MAKS_REMINDERS} - sebagian data terlama tidak ikut termuat.`);
    }
    const { data, error } = await supabase.from('reminders').select('*').order('created_at', { ascending: false }).limit(batasAmbil);
    if (error) throw new Error(error.message);
    const all = (data as Reminder[]) ?? [];
    if (!activeUser) return all;
    // Admin & Manager: lihat SEMUA (termasuk yg masih proses approval / belum di-assign).
    const roleLc = (activeUser.role ?? '').toLowerCase();
    const isAdminUser = roleLc === 'admin' || roleLc === 'superadmin';
    const isManagerUser = hasFullAccess(activeUser) || (roleLc === 'team' && !!managerUserId && activeUser.id === managerUserId);
    if (isAdminUser || isManagerUser || isPimpinan(activeUser)) return all;
    // Anggota tim biasa: HANYA item yg sudah di-assign (ke siapa pun) ATAU yg
    // di-route ke dirinya sbg Supervisor utk di-assign. Item yg masih pending
    // approval / belum di-assign TIDAK boleh muncul di list mereka (catatan spec).
    return all.filter(r =>
      !!r.assigned_to ||
      (!!r.assigned_supervisor_id && r.assigned_supervisor_id === activeUser.id)
    );
  }
  // Guest: ambil schedule yg atas nama dia (dibuat admin) + yg dia request sendiri (created_by)
  // + request Sales External yang menunggu REVIEW dia (Sales Internal, Fase 2 routing).
  const [bySales, byCreator, awaitingMyReview, awaitingMyReview2, approvedByMe] = await Promise.all([
    // Dicocokkan lewat uuid ATAU nama. Klausa namanya belum boleh dicabut:
    // baris lama yang namanya ambigu sengaja tidak dipetakan saat backfill,
    // dan mencabutnya sekarang akan menghilangkan jadwal orang dari layarnya.
    cobaIdentitas(async pakaiUuid => await supabase.from('reminders').select('*')
      .or(pakaiUuid
        ? `sales_user_id.eq.${activeUser.id},sales_name.eq.${kutipNilai(activeUser.full_name)}`
        : `sales_name.eq.${kutipNilai(activeUser.full_name)}`)
      .order('created_at', { ascending: false })),
    supabase.from('reminders').select('*').eq('created_by', activeUser.username).order('created_at', { ascending: false }),
    supabase.from('reminders').select('*').eq('internal_sales_id', activeUser.id).eq('routing_status', 'internal_review').order('created_at', { ascending: false }),
    // Reviewer KEDUA (brand IVP saat "Kedua Brand") - juga perlu lihat & approve.
    supabase.from('reminders').select('*').eq('internal_sales_id_2', activeUser.id).eq('routing_status', 'internal_review').order('created_at', { ascending: false }),
    // Item yang SUDAH dia approve sebagai Sales Internal - tetap tampil
    // supaya bisa dilacak walau routing_status sudah pindah ke admin_review.
    supabase.from('reminders').select('*').eq('internal_approved_by', activeUser.id).order('created_at', { ascending: false }),
  ]);
  const combined = [...(bySales.data ?? []), ...(byCreator.data ?? []), ...(awaitingMyReview.data ?? []), ...(awaitingMyReview2.data ?? []), ...(approvedByMe.data ?? [])];
  // Deduplicate by id, sort by created_at desc
  const seen = new Set<string>();
  return (combined as Reminder[])
    .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}
