/**
 * lib/jadwal-status.ts - ubah status jadwal Reminder Schedule (termasuk Completed) dan
 * simpan detail pelaksanaan (Onsite/Remote, BAST, display, controller). Dipakai BERSAMA
 * oleh peramban (useUbahStatus.ts, useModePenyelesaian.ts) dan DIWAYPI (lib/integrasi-aksi.ts).
 *
 * Dipindah dari kedua hook itu apa adanya: baris yang ditulis, pesan WA, form review
 * otomatis, dan urutannya sama. Klien & pengirim kini parameter (lib/efek-samping.ts);
 * yang tadinya toast kini dikembalikan sebagai hasil / dilaporkan lewat `lapor`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { appLink } from '@/lib/app-url';
import { tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';
import type { EfekSamping } from '@/lib/efek-samping';
import { REVIEW_TRIGGER_CATEGORIES, formatDate, type JadwalRingkas, type StatusJadwal } from '@/lib/jadwal-aturan';

/** Kolom jadwal yang dibutuhkan ubahStatusJadwal - bagian dari Reminder. */
export interface BarisJadwal extends JadwalRingkas {
  id: string;
  due_date: string;
  assigned_to: string;
  assign_name: string;
  batch_id?: string | null;
  product?: string | null;
  address?: string | null;
  sales_division?: string | null;
  sales_user_id?: string | null;
}

/** Kolom select untuk BarisJadwal (dipakai pemanggil server). */
export const KOLOM_BARIS_JADWAL = 'id, project_name, category, status, due_date, assigned_to, assign_name, sales_name, sales_division, '
  + 'sales_user_id, created_by, batch_id, product, address, is_deleted';

export interface GuestRingkas {
  id: string; username: string; full_name: string; phone_number?: string | null;
}

export type HasilUbahStatus =
  | { ok: false; galat: string }
  | { ok: true; jumlahTanggal: number; formReviewUntuk: string | null; galatKabarHandler: boolean };

/**
 * Ubah status jadwal. Satu jadwal multi-tanggal = SATU pekerjaan: seluruh baris sebatch
 * (batch_id) diperbarui sekaligus - lihat catatan panjang yang dulu di useUbahStatus.
 *
 * Status Completed juga: WA "JADWAL SELESAI" ke handler, lalu - untuk kategori pemicu
 * review yang punya Sales - form_reviews otomatis (sekali per batch) + WA ke guest.
 */
export async function ubahStatusJadwal(db: SupabaseClient, efek: EfekSamping, p: {
  id: string;
  status: StatusJadwal;
  /** Baris jadwal sebelum diubah (null = tidak dikenal: hanya baris `id` yang diubah). */
  sebelum: BarisJadwal | null | undefined;
  photoUrl?: string;
  pelaku: { id?: string | null; full_name?: string | null } | null;
  /** Jumlah tanggal sebatch yang tampak di layar; bawaan = jumlah baris yang berubah. */
  jumlahSebatch?: number;
  /** Cadangan bila guest Sales tidak terbaca dari DB (state guestUsers di peramban). */
  cadanganGuest?: readonly GuestRingkas[];
  lapor?: { tersimpan?: (jumlahTanggal: number) => void; formReview?: (sales: string) => void };
}): Promise<HasilUbahStatus> {
  const { id, status, sebelum, photoUrl } = p;
  const updatePayload: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (photoUrl) updatePayload['completion_photo_url'] = photoUrl;
  //  select('id') supaya RLS yang diam-diam menolak (0 baris, tanpa galat)
  //  ikut terlihat - status "Completed" yang sebetulnya tidak tersimpan
  //  akan tampak berhasil di layar tanpa ini.
  const { data: terubah, error } = sebelum?.batch_id
    ? await db.from('reminders').update(updatePayload).eq('batch_id', sebelum.batch_id).select('id')
    : await db.from('reminders').update(updatePayload).eq('id', id).select('id');
  if (error || !terubah || terubah.length === 0) {
    // M6 (docs/UX-WORKFLOW-AUDIT.md): 0-baris di sini biasanya berarti RLS menolak
    // diam-diam (akun belum jadi aktor sah di baris ini), bukan galat jaringan.
    return { ok: false, galat: error ? 'Gagal update status: ' + error.message : 'Gagal update status: akun ini bukan aktor pada jadwal ini (RLS menolak).' };
  }
  const sebatch = p.jumlahSebatch ?? (sebelum?.batch_id ? terubah.length : 0);
  const latar: Promise<unknown>[] = [efek.audit({
    user_id: p.pelaku?.id ?? '', user_name: p.pelaku?.full_name ?? '',
    action: 'status_change', module: 'reminder',
    target_id: id, target_name: sebelum?.project_name ?? '',
    old_value: sebelum?.status, new_value: status,
    // Jumlah tanggal ikut dicatat: tanpa itu, catatan audit untuk jadwal
    // lima hari tidak bisa dibedakan dari jadwal sehari.
    notes: [
      photoUrl ? 'Disertai foto penyelesaian' : '',
      sebatch > 1 ? `Berlaku untuk ${sebatch} tanggal dalam jadwal ini` : '',
    ].filter(Boolean).join(' · ') || undefined,
  })];
  p.lapor?.tersimpan?.(Math.max(1, sebatch));

  let formReviewUntuk: string | null = null;
  let galatKabarHandler = false;
  // WA ke handler saat status Done
  if (status === 'done') {
    try {
      const reminder = sebelum;
      if (reminder) {
        // JANGAN filter team_type: assigned_to (username) sudah unik per user,
        // dan handler bisa dari Team PTS IVP/UMP/MVI mana pun.
        const { data: handlerUser } = await db
          .from('users').select('phone_number, full_name')
          .eq('username', reminder.assigned_to)
          .maybeSingle();
        const h = handlerUser as { phone_number?: string | null; full_name?: string } | null;
        if (h?.phone_number) {
          const msg =
            `✅ *JADWAL SELESAI*\n\n` +
            `Terima kasih *${h.full_name}*!\n` +
            `Jadwal *${reminder.project_name}* sudah *Selesai*.\n` +
            `📦 *Product: ${reminder.product ?? '-'}*\n` +
            `🏷️ ${reminder.category} · ${formatDate(reminder.due_date)}\n` +
            `\nTetap semangat! 💪`;
          await efek.wa(h.phone_number, msg, 'reminder.updated');
        }

        // Auto-insert ke form_reviews jika kategori trigger & ada sales_name
        const isTriggerCategory = (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(reminder.category);
        const salesName = reminder.sales_name?.trim();
        if (isTriggerCategory && salesName) {
          try {
            // Selalu fetch guest dari DB (tidak andalkan state guestUsers yang bisa saja belum terisi)
            const { data: guestFromDb } = await db
              .from('users')
              .select('id, username, full_name, role, phone_number, sales_division')
              .eq('role', 'guest')
              .eq('full_name', salesName)
              .maybeSingle();

            // Fallback ke guestUsers state jika DB tidak return
            const resolvedGuest = (guestFromDb as GuestRingkas | null)
              ?? p.cadanganGuest?.find(g => g.full_name === salesName) ?? null;

            // Cek apakah sudah ada form_review untuk reminder ini - kalau reminder ini
            // bagian dari batch multi-tanggal, cek per BATCH (bukan per tanggal) supaya
            // menyelesaikan tanggal ke-2/3 dst di batch yang sama tidak bikin review dobel.
            let existingQuery = db.from('form_reviews').select('id').eq('sales_name', salesName);
            existingQuery = reminder.batch_id
              ? existingQuery.eq('batch_id', reminder.batch_id)
              : existingQuery.eq('reminder_id', reminder.id);
            const { data: existingReview } = await existingQuery.maybeSingle();

            if (!existingReview) {
              const reviewCategory = reminder.category === 'Demo Product' ? 'Demo Product' : 'BAST';
              const productValue = reminder.product?.trim() || '';
              const barisReview = {
                reminder_id: reminder.id,
                batch_id: reminder.batch_id ?? null,
                project_name: reminder.project_name,
                address: reminder.address || '',
                sales_name: salesName,
                // uuid berdampingan dengan namanya. sales_user_id diambil dari
                // reminder-nya kalau ada - itu identitas yang sudah dipastikan
                // saat jadwal dibuat, bukan hasil pencocokan nama ulang.
                sales_user_id: reminder.sales_user_id ?? resolvedGuest?.id ?? null,
                guest_user_id: resolvedGuest?.id ?? null,
                sales_division: reminder.sales_division || '',
                assign_name: reminder.assign_name,
                assigned_to: reminder.assigned_to,
                reminder_category: reminder.category,
                review_category: reviewCategory,
                // Auto-insert product ke kolom yang sesuai berdasarkan review_category
                ...(reviewCategory === 'Demo Product'
                  ? { product_demo: productValue }
                  : { product_bast: productValue }),
                // guest_fullname = full_name Guest (= sales_name), wajib NOT NULL
                guest_fullname: resolvedGuest?.full_name ?? salesName,
                // guest_username untuk filter di Form Review page
                guest_username: resolvedGuest?.username ?? '',
              };
              const { error: reviewErr } = await cobaIdentitas(async pakaiUuid =>
                await db.from('form_reviews').insert([pakaiUuid ? barisReview : tanpaIdentitas(barisReview)]));

              if (!reviewErr) {
                formReviewUntuk = salesName;
                p.lapor?.formReview?.(salesName);

                // Kirim WA notifikasi ke guest
                if (resolvedGuest?.phone_number) {
                  const guestMsg =
                    `⭐ *REVIEW DIMINTA — PTS IVP*\n\n` +
                    `Halo *${resolvedGuest.full_name}*!\n\n` +
                    `Jadwal *${reminder.category}* untuk project:\n` +
                    `*Kategori: ${reminder.category}*\n` +
                    `*Team kami: ${reminder.assign_name}*\n` +
                    `📦 *Product: ${reminder.product ?? '-'}*\n` +
                    `📋 *${reminder.project_name}*\n` +
                    `📍 ${reminder.address || '-'}\n\n` +
                    `telah selesai dilaksanakan oleh tim kami.\n\n` +
                    `Mohon berikan penilaian / review Anda melalui dashboard:\n` +
                    `🔗 ${appLink()}\n\n` +
                    `Terima kasih! 🙏`;
                  await efek.wa(resolvedGuest.phone_number, guestMsg, 'reminder.form_review_sent');
                }
              }
            }
          } catch (err) {
            console.warn('[reminder] form-review creation/WA to guest failed:', (err as Error)?.message);
          }
        }
      }
    } catch (err) {
      console.warn('[reminder] WA to handler failed:', (err as Error)?.message);
      galatKabarHandler = true;
    }
  }
  await Promise.allSettled(latar);
  return { ok: true, jumlahTanggal: Math.max(1, sebatch), formReviewUntuk, galatKabarHandler };
}

// ---------------------------------------------------------------- detail pelaksanaan
export type ModePenyelesaian = 'onsite' | 'remote';
export type TipeDisplay = 'led' | 'lcd' | 'mix';
export type MerekController = 'cue' | 'extron' | 'wyrestorm';

export interface IsianPelaksanaan {
  mode: ModePenyelesaian | null;
  installerName: string;
  installerUserId: string | null;
  installerDaerah: string;
  bastDate: string;
  displayType: TipeDisplay | null;
  requiresMiddleware: boolean;
  requiresControllerAuto: boolean;
  controllerBrand: MerekController | null;
}

/** Isian wajib panel Mode Penyelesaian (kategori insentif). null = lengkap. */
export function galatPelaksanaan(i: IsianPelaksanaan): string | null {
  if (!i.mode) return 'Pilih mode penyelesaian terlebih dahulu!';
  if (!i.bastDate) return 'Tanggal BAST wajib diisi!';
  if (!i.displayType) return 'Tipe Display wajib dipilih (LED / LCD / Mix)!';
  if (i.requiresControllerAuto && !i.controllerBrand) return 'Pilih brand Controller Automation (Cue / Extron / Wyrestorm)!';
  if (i.mode === 'remote') {
    if (!i.installerName.trim()) return 'PTS Daerah wajib diisi untuk mode Remote!';
    if (!i.installerDaerah.trim()) return 'Daerah wajib diisi untuk mode Remote!';
  }
  return null;
}

/**
 * Tulis detail pelaksanaan ke SELURUH baris sebatch (satu pekerjaan = satu BAST; layar
 * Incentive memilih baris tanggal paling AKHIR sebagai wakil proyek - lihat
 * lib/kelompok-insentif.ts). Status TIDAK disentuh di sini.
 */
export async function simpanDetailPelaksanaan(
  db: SupabaseClient, snap: { id: string; batch_id?: string | null; assigned_to: string }, i: IsianPelaksanaan,
): Promise<{ ok: true; isi: Record<string, unknown> } | { ok: false; galat: string }> {
  const salah = galatPelaksanaan(i);
  if (salah) return { ok: false, galat: salah };
  const modeVal = i.mode as ModePenyelesaian;
  // Auto: kalau handler ber-jabatan Manager (dari Struktur Organisasi), skema
  // Manager-as-PIC berlaku otomatis - tidak perlu dipilih manual.
  const { data: handlerUser } = await db.from('users').select('jabatan').eq('username', snap.assigned_to).maybeSingle();
  const autoPicType: 'standard' | 'manager_pic' = (handlerUser as { jabatan?: string } | null)?.jabatan === 'Manager' ? 'manager_pic' : 'standard';
  const isi = {
    mode_penyelesaian: modeVal,
    installer_name: modeVal === 'remote' ? i.installerName.trim() : null,
    installer_daerah: modeVal === 'remote' ? i.installerDaerah.trim() : null,
    installer_user_id: modeVal === 'remote' ? i.installerUserId : null,
    bast_date: i.bastDate || null,
    display_type: i.displayType,
    requires_middleware: i.requiresMiddleware,
    requires_controller_automation: i.requiresControllerAuto,
    controller_automation_brand: i.requiresControllerAuto ? i.controllerBrand : null,
    pic_type: autoPicType,
  };
  const { data: barisTerisi, error: galatIsi } = await (snap.batch_id
    ? db.from('reminders').update(isi).eq('batch_id', snap.batch_id).select('id')
    : db.from('reminders').update(isi).eq('id', snap.id).select('id'));
  //  select('id') + cek baris: RLS yang menolak diam-diam (0 baris, tanpa galat)
  //  dulu tidak terlihat sama sekali - semua tampak berhasil, padahal detailnya
  //  tidak pernah tersimpan.
  if (galatIsi || !barisTerisi || barisTerisi.length === 0) {
    return { ok: false, galat: galatIsi
      ? 'Gagal menyimpan detail pelaksanaan: ' + galatIsi.message
      : 'Gagal menyimpan detail pelaksanaan: akun ini bukan aktor pada jadwal ini (RLS menolak).' };
  }
  return { ok: true, isi };
}
