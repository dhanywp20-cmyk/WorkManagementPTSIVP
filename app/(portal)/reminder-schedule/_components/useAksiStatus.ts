'use client';

/** useAksiStatus - dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { Status, Reminder, TeamUser, GuestUser, REVIEW_TRIGGER_CATEGORIES, INCENTIVE_TRIGGER_CATEGORIES, formatDate, sendFonnteWA } from './shared';
import { tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';
import { appLink } from '@/lib/app-url';
import { compressImage } from '@/lib/image-compress';
import { useModePenyelesaian } from './useModePenyelesaian';
import { useUbahStatus } from './useUbahStatus';

export interface AksiStatusKonteks {
  bastDate: string;
  controllerBrand: "cue" | "extron" | "wyrestorm" | null;
  currentUser: TeamUser | null;
  deleteTarget: Reminder | null;
  detailReminder: Reminder | null;
  displayType: "led" | "lcd" | "mix" | null;
  fetchRemindersQuiet: (user?: TeamUser | null) => Promise<void>;
  guestUsers: GuestUser[];
  installerDaerah: string;
  installerName: string;
  installerUserId: string | null;
  modeEditSaja: boolean;
  modePenyelesaian: "onsite" | "remote" | null;
  notify: (type: "success" | "error", msg: string) => void;
  pendingPhotoUrl: string | undefined;
  pendingStatus: Status | null;
  reminders: Reminder[];
  requiresControllerAuto: boolean;
  requiresMiddleware: boolean;
  setBastDate: import("react").Dispatch<import("react").SetStateAction<string>>;
  setControllerBrand: import("react").Dispatch<import("react").SetStateAction<"cue" | "extron" | "wyrestorm" | null>>;
  setDeleteConfirmText: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDeleteTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
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
  setResendingFormReview: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSavingMode: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowDeleteModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowModeModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setStatusPhoto: import("react").Dispatch<import("react").SetStateAction<File | null>>;
  setStatusPhotoPreview: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setUpdatingStatus: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  statusPhoto: File | null;
}

export function useAksiStatus(k: AksiStatusKonteks) {
  const { bastDate, controllerBrand, currentUser, deleteTarget, detailReminder, displayType, fetchRemindersQuiet, guestUsers, installerDaerah, installerName, installerUserId, modeEditSaja, modePenyelesaian, notify, pendingPhotoUrl, pendingStatus, reminders, requiresControllerAuto, requiresMiddleware, setBastDate, setControllerBrand, setDeleteConfirmText, setDeleteTarget, setDetailReminder, setDisplayType, setInstallerDaerah, setInstallerName, setInstallerUserId, setModeEditSaja, setModePenyelesaian, setPendingPhotoUrl, setPendingStatus, setRequiresControllerAuto, setRequiresMiddleware, setResendingFormReview, setSavingMode, setShowDeleteModal, setShowModeModal, setStatusPhoto, setStatusPhotoPreview, setUpdatingStatus, statusPhoto } = k;
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('reminders').delete().eq('id', deleteTarget.id);
    if (error) { notify('error', 'Gagal menghapus: ' + error.message); return; }
    logAudit({
      user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
      action: 'delete', module: 'reminder',
      target_id: deleteTarget.id, target_name: deleteTarget.project_name,
      notes: `Dihapus — jadwal ${formatDate(deleteTarget.due_date)}, status ${deleteTarget.status}`,
    }).catch(() => {});
    notify('success', 'Reminder dihapus.');
    setDetailReminder(null);
    setShowDeleteModal(false);
    setDeleteTarget(null);
    setDeleteConfirmText('');
    fetchRemindersQuiet();
  };

  const openDeleteModal = (r: Reminder) => {
    setDeleteTarget(r);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const { handleStatusChange, handleConfirmStatusUpdate } = useUbahStatus({ currentUser, detailReminder, fetchRemindersQuiet, guestUsers, notify, pendingStatus, reminders, setBastDate, setControllerBrand, setDetailReminder, setDisplayType, setInstallerDaerah, setInstallerName, setInstallerUserId, setModeEditSaja, setModePenyelesaian, setPendingPhotoUrl, setPendingStatus, setRequiresControllerAuto, setRequiresMiddleware, setShowModeModal, setStatusPhoto, setStatusPhotoPreview, setUpdatingStatus, statusPhoto });

  /**
   * Buka panel Mode untuk jadwal yang statusnya SUDAH Completed - mengisi
   * detail yang belum pernah diisi, atau membetulkan yang salah. Nilai lama
   * dimuat ulang lebih dulu supaya yang tinggal dibetulkan cukup satu field,
   * bukan mengetik ulang semuanya.
   */
  const { bukaEditDetailPelaksanaan, handleModeConfirm } = useModePenyelesaian({ bastDate, controllerBrand, detailReminder, displayType, fetchRemindersQuiet, handleStatusChange, installerDaerah, installerName, installerUserId, modeEditSaja, modePenyelesaian, notify, pendingPhotoUrl, requiresControllerAuto, requiresMiddleware, setBastDate, setControllerBrand, setDetailReminder, setDisplayType, setInstallerDaerah, setInstallerName, setInstallerUserId, setModeEditSaja, setModePenyelesaian, setPendingPhotoUrl, setPendingStatus, setRequiresControllerAuto, setRequiresMiddleware, setSavingMode, setShowModeModal, setStatusPhoto, setStatusPhotoPreview });

  // Resend / Manual Send Form Review ke Guest
  const handleResendFormReview = async (r: Reminder) => {
    if (!r.sales_name?.trim()) {
      notify('error', 'Reminder ini tidak memiliki Sales yang terpilih!');
      return;
    }
    const isTrigger = (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(r.category);
    if (!isTrigger) {
      notify('error', `Kategori "${r.category}" tidak memerlukan form review.`);
      return;
    }
    if (r.status !== 'done') {
      notify('error', 'Status reminder harus Completed untuk mengirim form review!');
      return;
    }

    setResendingFormReview(true);
    try {
      const salesName = r.sales_name.trim();

      // Selalu fetch guest terbaru dari DB berdasarkan full_name === sales_name
      const { data: guestFromDb } = await supabase
        .from('users')
        .select('id, username, full_name, role, phone_number, sales_division')
        .eq('role', 'guest')
        .eq('full_name', salesName)
        .maybeSingle();

      const resolvedGuest = guestFromDb ?? guestUsers.find(g => g.full_name === salesName) ?? null;

      if (!resolvedGuest) {
        notify('error', `Guest dengan nama "${salesName}" tidak ditemukan di database!`);
        setResendingFormReview(false);
        return;
      }

      // Cek apakah form_review sudah ada - batch-aware (lihat catatan di handleStatusChange)
      let existingQueryResend = supabase.from('form_reviews').select('id, guest_username').eq('sales_name', salesName);
      existingQueryResend = r.batch_id
        ? existingQueryResend.eq('batch_id', r.batch_id)
        : existingQueryResend.eq('reminder_id', r.id);
      const { data: existingReview } = await existingQueryResend.maybeSingle();

      if (existingReview) {
        // Patch guest_username jika masih kosong (data lama)
        if (!existingReview.guest_username && resolvedGuest.username) {
          await supabase.from('form_reviews')
            .update({ guest_username: resolvedGuest.username })
            .eq('id', existingReview.id);
        }
        // Form sudah ada - hanya kirim ulang WA
      } else {
        // Buat form_review baru
        const reviewCategory = r.category === 'Demo Product' ? 'Demo Product' : 'BAST';
        const productValue = r.product?.trim() || '';
        const barisReview = {
          reminder_id: r.id,
          batch_id: r.batch_id ?? null,
          project_name: r.project_name,
          address: r.address || '',
          sales_name: salesName,
          sales_user_id: r.sales_user_id ?? resolvedGuest.id ?? null,
          guest_user_id: resolvedGuest.id ?? null,
          sales_division: r.sales_division || '',
          assign_name: r.assign_name,
          assigned_to: r.assigned_to,
          reminder_category: r.category,
          review_category: reviewCategory,
          // Auto-insert product ke kolom yang sesuai berdasarkan review_category
          ...(reviewCategory === 'Demo Product'
            ? { product_demo: productValue }
            : { product_bast: productValue }),
          // guest_fullname = full_name Guest (= sales_name), wajib NOT NULL
          guest_fullname: resolvedGuest.full_name ?? salesName,
          // guest_username untuk filter di Form Review page
          guest_username: resolvedGuest.username,
        };
        const { error: reviewErr } = await cobaIdentitas(async pakaiUuid =>
          await supabase.from('form_reviews').insert([pakaiUuid ? barisReview : tanpaIdentitas(barisReview)]));
        if (reviewErr) {
          notify('error', 'Gagal membuat form review: ' + reviewErr.message);
          setResendingFormReview(false);
          return;
        }
      }

      // Kirim / kirim ulang WA notif ke Guest
      if (resolvedGuest.phone_number) {
        const guestMsg =
          `⭐ *FORM REVIEW — PTS IVP*\n\n` +
          `Halo *${resolvedGuest.full_name}*!\n\n` +
          `Jadwal *${r.category}* untuk project:\n` +
          `*Kategori: ${r.category}*\n` +
          `*Team kami: ${r.assign_name}*\n` +
          `📋 *${r.project_name}*\n` +
          `📦 *Product: ${r.product ?? '-'}*\n` +
          `📍 ${r.address || '-'}\n\n` +
          (r.notes ? `📝 Catatan: ${r.notes}\n` : '') +
          `telah selesai dilaksanakan oleh tim kami.\n\n` +
          `Mohon berikan penilaian / review Anda melalui dashboard:\n` +
          `🔗 ${appLink()}\n\n` +
          `Terima kasih! 🙏`;
        const waResult = await sendFonnteWA(resolvedGuest.phone_number, guestMsg, undefined, 'reminder.form_review_sent');
        if (waResult.ok) notify('success', `Form review & WA berhasil dikirim ke ${resolvedGuest.full_name}!`);
        else notify('success', `Form review OK. WA gagal: ${waResult.reason ?? 'unknown'}`);
      } else {
        notify('success', `Form review dibuat untuk ${resolvedGuest.full_name}. (Nomor WA tidak ada)`);
      }
    } catch (ex: any) {
      notify('error', 'Terjadi kesalahan: ' + ex.message);
    }
    setResendingFormReview(false);
  };
  return { handleDelete, openDeleteModal, handleStatusChange, handleConfirmStatusUpdate, bukaEditDetailPelaksanaan, handleModeConfirm, handleResendFormReview };
}
