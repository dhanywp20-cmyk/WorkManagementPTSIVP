'use client';

/** useUbahStatus - dipecah dari app/(portal)/reminder-schedule/_components/useAksiStatus.ts (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { Status, Reminder, TeamUser, GuestUser, REVIEW_TRIGGER_CATEGORIES, INCENTIVE_TRIGGER_CATEGORIES, formatDate, sendFonnteWA } from './shared';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';
import { appLink } from '@/lib/app-url';
import { compressImage } from '@/lib/image-compress';

export interface UbahStatusKonteks {
  currentUser: TeamUser | null;
  detailReminder: Reminder | null;
  fetchRemindersQuiet: (user?: TeamUser | null) => Promise<void>;
  guestUsers: GuestUser[];
  notify: (type: "success" | "error", msg: string) => void;
  pendingStatus: Status | null;
  reminders: Reminder[];
  setBastDate: import("react").Dispatch<import("react").SetStateAction<string>>;
  setControllerBrand: import("react").Dispatch<import("react").SetStateAction<"cue" | "extron" | "wyrestorm" | null>>;
  setDetailReminder: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setDisplayType: import("react").Dispatch<import("react").SetStateAction<"led" | "lcd" | "mix" | null>>;
  setInstallerDaerah: import("react").Dispatch<import("react").SetStateAction<string>>;
  setInstallerName: import("react").Dispatch<import("react").SetStateAction<string>>;
  setInstallerUserId: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setModeEditSaja: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setModePenyelesaian: import("react").Dispatch<import("react").SetStateAction<"onsite" | "remote" | null>>;
  setPendingPhotoUrl: import("react").Dispatch<import("react").SetStateAction<string | undefined>>;
  setPendingStatus: import("react").Dispatch<import("react").SetStateAction<Status | null>>;
  setRequiresControllerAuto: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setRequiresMiddleware: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowModeModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setStatusPhoto: import("react").Dispatch<import("react").SetStateAction<File | null>>;
  setStatusPhotoPreview: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setUpdatingStatus: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  statusPhoto: File | null;
}

export function useUbahStatus(k: UbahStatusKonteks) {
  const { currentUser, detailReminder, fetchRemindersQuiet, guestUsers, notify, pendingStatus, reminders, setBastDate, setControllerBrand, setDetailReminder, setDisplayType, setInstallerDaerah, setInstallerName, setInstallerUserId, setModeEditSaja, setModePenyelesaian, setPendingPhotoUrl, setPendingStatus, setRequiresControllerAuto, setRequiresMiddleware, setShowModeModal, setStatusPhoto, setStatusPhotoPreview, setUpdatingStatus, statusPhoto } = k;
  const handleStatusChange = async (id: string, status: Status, photoUrl?: string) => {
    const sebelum = reminders.find(r => r.id === id);

    /*
      Satu jadwal multi-tanggal = SATU pekerjaan, bukan lima.

      Jadwal 5 hari berturut-turut tersimpan sebagai lima baris (satu per
      tanggal) yang diikat batch_id. Daftar sudah menggabungkannya jadi satu
      baris - lihat groupedReminders - tapi penandaan statusnya dulu hanya
      mengenai satu baris. Akibatnya penangan harus menekan "Completed" lima
      kali untuk satu pekerjaan yang sudah selesai, dan sebelum tekanan kelima
      jadwalnya masih tampak menggantung.

      Yang lebih merugikan ada di hilirnya: Incentive Project membaca baris
      reminder, jadi satu pekerjaan Konfigurasi 2 hari terhitung DUA proyek.

      Sekarang seluruh baris sebatch diperbarui sekaligus. Tidak ada layar yang
      bisa menunjuk satu tanggal saja - daftarnya memang sudah satu baris -
      jadi tidak ada perilaku yang hilang karenanya.
    */
    const updatePayload: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (photoUrl) updatePayload['completion_photo_url'] = photoUrl;
    const sebatch = sebelum?.batch_id
      ? reminders.filter(r => r.batch_id === sebelum.batch_id)
      : [];
    //  select('id') supaya RLS yang diam-diam menolak (0 baris, tanpa galat)
    //  ikut terlihat - status "Completed" yang sebetulnya tidak tersimpan
    //  akan tampak berhasil di layar tanpa ini.
    const { data: terubah, error } = sebelum?.batch_id
      ? await supabase.from('reminders').update(updatePayload).eq('batch_id', sebelum.batch_id).select('id')
      : await supabase.from('reminders').update(updatePayload).eq('id', id).select('id');
    if (error || !terubah || terubah.length === 0) {
      // M6 (docs/UX-WORKFLOW-AUDIT.md): dulu tidak menyebut penyebab sama
      // sekali - padahal ini aksi paling rutin (tandai Completed tiap hari),
      // dan 0-baris di sini biasanya berarti RLS menolak diam-diam (akun
      // belum jadi aktor sah di baris ini), bukan galat jaringan.
      notify('error', error ? 'Gagal update status: ' + error.message : 'Gagal update status: akun ini bukan aktor pada jadwal ini (RLS menolak).');
      return;
    }
    logAudit({
      user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
      action: 'status_change', module: 'reminder',
      target_id: id, target_name: sebelum?.project_name ?? '',
      old_value: sebelum?.status, new_value: status,
      // Jumlah tanggal ikut dicatat: tanpa itu, catatan audit untuk jadwal
      // lima hari tidak bisa dibedakan dari jadwal sehari.
      notes: [
        photoUrl ? 'Disertai foto penyelesaian' : '',
        sebatch.length > 1 ? `Berlaku untuk ${sebatch.length} tanggal dalam jadwal ini` : '',
      ].filter(Boolean).join(' · ') || undefined,
    }).catch(() => {});
    notify('success', sebatch.length > 1
      ? `Status diperbarui untuk ${sebatch.length} tanggal sekaligus.`
      : 'Status diperbarui!');
    // WA ke handler saat status Done
    if (status === 'done') {
      try {
        const reminder = reminders.find(r => r.id === id);
        if (reminder) {
          // JANGAN filter team_type: assigned_to (username) sudah unik per user,
          // dan handler bisa dari Team PTS IVP/UMP/MVI mana pun. Menyaring ke
          // satu tim membuat handlerUser null dan WA "selesai" tidak terkirim.
          const { data: handlerUser } = await supabase
            .from('users').select('phone_number, full_name')
            .eq('username', reminder.assigned_to)
            .maybeSingle();
          if (handlerUser?.phone_number) {
            const msg =
              `✅ *JADWAL SELESAI*\n\n` +
              `Terima kasih *${handlerUser.full_name}*!\n` +
              `Jadwal *${reminder.project_name}* sudah *Selesai*.\n` +
              `📦 *Product: ${reminder.product ?? '-'}*\n` +
              `🏷️ ${reminder.category} · ${formatDate(reminder.due_date)}\n` +
              `\nTetap semangat! 💪`;
            await sendFonnteWA(handlerUser.phone_number, msg, undefined, 'reminder.updated');
          }

          // Auto-insert ke form_reviews jika kategori trigger & ada sales_name
          const isTriggerCategory = (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(reminder.category);
          const salesName = reminder.sales_name?.trim();
          if (isTriggerCategory && salesName) {
            try {
              // Selalu fetch guest dari DB (tidak andalkan state guestUsers yang bisa saja belum terisi)
              const { data: guestFromDb } = await supabase
                .from('users')
                .select('id, username, full_name, role, phone_number, sales_division')
                .eq('role', 'guest')
                .eq('full_name', salesName)
                .maybeSingle();

              // Fallback ke guestUsers state jika DB tidak return
              const resolvedGuest = guestFromDb ?? guestUsers.find(g => g.full_name === salesName) ?? null;

              // Cek apakah sudah ada form_review untuk reminder ini - kalau reminder ini
              // bagian dari batch multi-tanggal, cek per BATCH (bukan per tanggal) supaya
              // menyelesaikan tanggal ke-2/3 dst di batch yang sama tidak bikin review dobel.
              let existingQuery = supabase.from('form_reviews').select('id').eq('sales_name', salesName);
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
                  await supabase.from('form_reviews').insert([pakaiUuid ? barisReview : tanpaIdentitas(barisReview)]));

                if (!reviewErr) {
                  notify('success', `Form review otomatis dibuat untuk ${salesName}!`);

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
                    await sendFonnteWA(resolvedGuest.phone_number, guestMsg, undefined, 'reminder.form_review_sent');
                  }
                }
              }
            } catch (err: any) {
              console.warn('[reminder] form-review creation/WA to guest failed:', err?.message);
            }
          }
        }
      } catch (err: any) {
        console.warn('[reminder] WA to handler failed:', err?.message);
        notify('error', 'WA ke handler gagal dikirim. Status berhasil disimpan.');
      }
    }
    fetchRemindersQuiet();
    if (detailReminder?.id === id) setDetailReminder(prev => prev ? { ...prev, status } : null);
  };

  const handleConfirmStatusUpdate = async () => {
    if (!detailReminder || !pendingStatus) return;
    setUpdatingStatus(true);
    let photoUrl: string | undefined;
    if (statusPhoto) {
      const compressed = await compressImage(statusPhoto);
      const ext = compressed.name.split('.').pop();
      const fileName = `completion_${detailReminder.id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('reminder-photos')
        .upload(fileName, compressed, { upsert: true, cacheControl: '31536000' });
      if (upErr) {
        notify('error', 'Gagal upload foto: ' + upErr.message);
        setUpdatingStatus(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('reminder-photos').getPublicUrl(fileName);
      photoUrl = urlData?.publicUrl;
    }

    // Jika kategori incentive-trigger dan status Completed  tampilkan mode modal
    const isIncentiveCat = (INCENTIVE_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category);
    if (pendingStatus === 'done' && isIncentiveCat) {
      setModeEditSaja(false);
      setPendingPhotoUrl(photoUrl);
      setModePenyelesaian(null);
      setInstallerName('');
      setInstallerUserId(null);
      setInstallerDaerah('');
      setBastDate(new Date().toISOString().split('T')[0]);
      setDisplayType(null);
      setRequiresMiddleware(false);
      setRequiresControllerAuto(false);
      setControllerBrand(null);
      setUpdatingStatus(false);
      setShowModeModal(true);
      return;
    }

    await handleStatusChange(detailReminder.id, pendingStatus, photoUrl);
    setPendingStatus(null);
    setStatusPhoto(null);
    setStatusPhotoPreview(null);
    setUpdatingStatus(false);
  };
  return { handleStatusChange, handleConfirmStatusUpdate };
}
