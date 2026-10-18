'use client';

/** useModePenyelesaian - dipecah dari app/(portal)/reminder-schedule/_components/useAksiStatus.ts (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { Status, Reminder, TeamUser } from './shared';
import { supabase } from '@/lib/supabase';
import { galatPelaksanaan, simpanDetailPelaksanaan, type IsianPelaksanaan } from '@/lib/jadwal-status';

export interface ModePenyelesaianKonteks {
  bastDate: string;
  controllerBrand: "cue" | "extron" | "wyrestorm" | null;
  detailReminder: Reminder | null;
  displayType: "led" | "lcd" | "mix" | null;
  fetchRemindersQuiet: (user?: TeamUser | null) => Promise<void>;
  handleStatusChange: (id: string, status: Status, photoUrl?: string) => Promise<void>;
  installerDaerah: string;
  installerName: string;
  installerUserId: string | null;
  modeEditSaja: boolean;
  modePenyelesaian: "onsite" | "remote" | null;
  notify: (type: "success" | "error", msg: string) => void;
  pendingPhotoUrl: string | undefined;
  requiresControllerAuto: boolean;
  requiresMiddleware: boolean;
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
  setSavingMode: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowModeModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setStatusPhoto: import("react").Dispatch<import("react").SetStateAction<File | null>>;
  setStatusPhotoPreview: import("react").Dispatch<import("react").SetStateAction<string | null>>;
}

export function useModePenyelesaian(k: ModePenyelesaianKonteks) {
  const { bastDate, controllerBrand, detailReminder, displayType, fetchRemindersQuiet, handleStatusChange, installerDaerah, installerName, installerUserId, modeEditSaja, modePenyelesaian, notify, pendingPhotoUrl, requiresControllerAuto, requiresMiddleware, setBastDate, setControllerBrand, setDetailReminder, setDisplayType, setInstallerDaerah, setInstallerName, setInstallerUserId, setModeEditSaja, setModePenyelesaian, setPendingPhotoUrl, setPendingStatus, setRequiresControllerAuto, setRequiresMiddleware, setSavingMode, setShowModeModal, setStatusPhoto, setStatusPhotoPreview } = k;
  const bukaEditDetailPelaksanaan = (r: Reminder) => {
    setModeEditSaja(true);
    setPendingStatus(null);
    setPendingPhotoUrl(undefined);
    setModePenyelesaian(r.mode_penyelesaian ?? null);
    setInstallerName(r.installer_name ?? '');
    setInstallerUserId(r.installer_user_id ?? null);
    setInstallerDaerah(r.installer_daerah ?? '');
    setBastDate(r.bast_date ?? new Date().toISOString().split('T')[0]);
    setDisplayType(r.display_type ?? null);
    setRequiresMiddleware(r.requires_middleware === true);
    setRequiresControllerAuto(r.requires_controller_automation === true);
    setControllerBrand(r.controller_automation_brand ?? null);
    setShowModeModal(true);
  };

  const handleModeConfirm = async () => {
    if (!detailReminder) { notify('error', 'Pilih mode penyelesaian terlebih dahulu!'); return; }
    const isian: IsianPelaksanaan = {
      mode: modePenyelesaian, installerName, installerUserId, installerDaerah, bastDate,
      displayType, requiresMiddleware, requiresControllerAuto, controllerBrand,
    };
    //  Validasi dulu (panel tetap terbuka, tanpa spinner) - pesannya dari lib/jadwal-status.ts.
    const salah = galatPelaksanaan(isian);
    if (salah) { notify('error', salah); return; }
    const snap = detailReminder;
    const reminderId = snap.id;

    setSavingMode(true);
    /*
      Ditulis ke SELURUH baris sebatch, bukan hanya baris yang sedang dibuka -
      satu pekerjaan = satu tanggal BAST. pic_type Manager otomatis, cek 0 baris
      (RLS menolak diam-diam): semuanya di lib/jadwal-status.ts, dipakai juga DIWAYPI.
    */
    const simpan = await simpanDetailPelaksanaan(supabase, snap, isian);
    setSavingMode(false);
    //  Panel sengaja TIDAK ditutup saat gagal: isian yang sudah diketik tidak
    //  boleh ikut hilang hanya karena penyimpanannya ditolak.
    if (!simpan.ok) { notify('error', simpan.galat); return; }
    const isiPenyelesaian = simpan.isi;
    setShowModeModal(false);

    if (modeEditSaja) {
      //  Jadwal ini SUDAH Completed - yang diperbarui hanya detailnya, status
      //  tidak disentuh sama sekali (kalau lewat handleStatusChange, WA
      //  "jadwal selesai" akan terkirim ulang ke handler untuk kedua kalinya).
      setModeEditSaja(false);
      notify('success', 'Detail pelaksanaan tersimpan!');
      await fetchRemindersQuiet();
      setDetailReminder(prev => prev ? { ...prev, ...isiPenyelesaian } as Reminder : null);
    } else {
      await handleStatusChange(reminderId, 'done', pendingPhotoUrl);
    }

    /*
      Tulisan ke tabel `incentive_projects` DIHAPUS dari sini - kode zombie
      sisa arsitektur lama sebelum Incentive PTS pindah membaca langsung dari
      `reminders` (lihat fetchIncentiveProjects di
      app/incentive-pts/_components/calc.ts: category+status+incentive_excluded
      langsung dari tabel ini, TANPA pernah menyentuh `incentive_projects`).

      Tabel itu ditulis di sini setiap proyek ditandai Done, tapi TIDAK ADA
      satu query SELECT pun ke sana di seluruh kode - baris yang ditulis
      tidak pernah dibaca siapa pun. Kalau insert-nya gagal (skema kolom
      beda, RLS berubah, dll), muncul toast "Gagal sync ke Incentive PTS" -
      padahal sinkronisasi Incentive PTS yang SUNGGUHAN (baca `reminders`
      langsung) sama sekali tidak terganggu. Itu kepanikan palsu, bukan
      peringatan yang berarti.
    */

    setPendingStatus(null);
    setStatusPhoto(null);
    setStatusPhotoPreview(null);
    setModePenyelesaian(null);
    setInstallerName('');
    setInstallerUserId(null);
    setInstallerDaerah('');
    setDisplayType(null);
    setRequiresMiddleware(false);
    setRequiresControllerAuto(false);
    setControllerBrand(null);
    setPendingPhotoUrl(undefined);
  };
  return { bukaEditDetailPelaksanaan, handleModeConfirm };
}
