'use client';

/** useModePenyelesaian - dipecah dari app/(portal)/reminder-schedule/_components/useAksiStatus.ts (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { Status, Reminder, TeamUser } from './shared';
import { supabase } from '@/lib/supabase';

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
    if (!detailReminder || !modePenyelesaian) {
      notify('error', 'Pilih mode penyelesaian terlebih dahulu!');
      return;
    }
    if (!bastDate) { notify('error', 'Tanggal BAST wajib diisi!'); return; }
    if (!displayType) { notify('error', 'Tipe Display wajib dipilih (LED / LCD / Mix)!'); return; }
    if (requiresControllerAuto && !controllerBrand) { notify('error', 'Pilih brand Controller Automation (Cue / Extron / Wyrestorm)!'); return; }
    if (modePenyelesaian === 'remote') {
      if (!installerName.trim()) { notify('error', 'PTS Daerah wajib diisi untuk mode Remote!'); return; }
      if (!installerDaerah.trim()) { notify('error', 'Daerah wajib diisi untuk mode Remote!'); return; }
    }
    const snap = detailReminder;
    const reminderId = snap.id;
    const modeVal = modePenyelesaian;
    const installerNameVal = installerName.trim();
    const installerDaerahVal = installerDaerah.trim();
    const bastDateVal = bastDate || null;

    setSavingMode(true);
    // Auto: kalau handler ber-jabatan Manager (dari Struktur Organisasi), skema
    // Manager-as-PIC berlaku otomatis - tidak perlu dipilih manual.
    const { data: handlerUser } = await supabase.from('users').select('jabatan').eq('username', snap.assigned_to).maybeSingle();
    const autoPicType: 'standard' | 'manager_pic' = handlerUser?.jabatan === 'Manager' ? 'manager_pic' : 'standard';
    const isiPenyelesaian = {
      mode_penyelesaian: modeVal,
      installer_name: modeVal === 'remote' ? installerNameVal : null,
      installer_daerah: modeVal === 'remote' ? installerDaerahVal : null,
      installer_user_id: modeVal === 'remote' ? installerUserId : null,
      bast_date: bastDateVal,
      display_type: displayType,
      requires_middleware: requiresMiddleware,
      requires_controller_automation: requiresControllerAuto,
      controller_automation_brand: requiresControllerAuto ? controllerBrand : null,
      pic_type: autoPicType,
    };
    /*
      Ditulis ke SELURUH baris sebatch, bukan hanya baris yang sedang dibuka.

      Jadwal berhari-hari tersimpan sebagai beberapa baris yang diikat batch_id,
      dan penandaan statusnya memang sudah mengenai semuanya (lihat
      handleStatusChange). Tapi BAST/mode/installer dulu hanya menempel di SATU
      baris - baris yang kebetulan dibuka dari daftar, yaitu tanggal paling
      AWAL. Sementara itu layar Incentive memilih wakil proyeknya lewat
      gabungkanProyek(), yang sengaja mengambil tanggal paling AKHIR (lihat
      lib/kelompok-insentif.ts) - baris yang justru tidak pernah diisi.

      Akibatnya proyek dari jadwal multi-tanggal muncul di Incentive dengan
      BAST "Belum diisi" walau formulirnya sudah diisi lengkap, dan tombol
      Generate Tahapan tidak pernah muncul karena syaratnya adalah adanya BAST.
      Satu pekerjaan = satu tanggal BAST, jadi seluruh barisnya harus membawa
      keterangan yang sama - bukan hanya salah satunya.
    */
    const { data: barisTerisi, error: galatIsi } = await (snap.batch_id
      ? supabase.from('reminders').update(isiPenyelesaian).eq('batch_id', snap.batch_id).select('id')
      : supabase.from('reminders').update(isiPenyelesaian).eq('id', reminderId).select('id'));
    setSavingMode(false);
    //  select('id') + cek baris: RLS yang menolak diam-diam (0 baris, tanpa
    //  galat) dulu tidak terlihat sama sekali di sini - panel tertutup, semua
    //  tampak berhasil, padahal detailnya tidak pernah tersimpan. Persis
    //  kejadian yang membuat jadwal Completed berakhir tanpa detail.
    //  Panel sengaja TIDAK ditutup saat gagal: isian yang sudah diketik tidak
    //  boleh ikut hilang hanya karena penyimpanannya ditolak.
    if (galatIsi || !barisTerisi || barisTerisi.length === 0) {
      notify('error', galatIsi
        ? 'Gagal menyimpan detail pelaksanaan: ' + galatIsi.message
        : 'Gagal menyimpan detail pelaksanaan: akun ini bukan aktor pada jadwal ini (RLS menolak).');
      return;
    }
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
