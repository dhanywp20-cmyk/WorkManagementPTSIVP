'use client';

/** useUbahStatus - dipecah dari app/(portal)/reminder-schedule/_components/useAksiStatus.ts (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { Status, Reminder, TeamUser, GuestUser, INCENTIVE_TRIGGER_CATEGORIES } from './shared';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/image-compress';
import { efekPeramban } from '@/lib/efek-peramban';
import { ubahStatusJadwal } from '@/lib/jadwal-status';

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
    const sebatch = sebelum?.batch_id
      ? reminders.filter(r => r.batch_id === sebelum.batch_id)
      : [];
    //  Baris yang ditulis, WA handler, form review otomatis + WA guest: lib/jadwal-status.ts
    //  (dipakai juga DIWAYPI). Toast tetap di sini, pada saat yang sama seperti dulu.
    const hasil = await ubahStatusJadwal(supabase, efekPeramban, {
      id, status, sebelum, photoUrl,
      pelaku: currentUser, jumlahSebatch: sebatch.length, cadanganGuest: guestUsers,
      lapor: {
        tersimpan: () => notify('success', sebatch.length > 1
          ? `Status diperbarui untuk ${sebatch.length} tanggal sekaligus.`
          : 'Status diperbarui!'),
        formReview: nama => notify('success', `Form review otomatis dibuat untuk ${nama}!`),
      },
    });
    if (!hasil.ok) { notify('error', hasil.galat); return; }
    if (hasil.galatKabarHandler) notify('error', 'WA ke handler gagal dikirim. Status berhasil disimpan.');
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
        .upload(fileName, compressed, { upsert: false, cacheControl: '31536000' });
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
