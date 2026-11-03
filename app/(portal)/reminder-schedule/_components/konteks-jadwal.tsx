'use client';

/**
 * konteks-jadwal.tsx - SATU sumber keadaan & aksi halaman Request Schedule untuk komponen di bawahnya.
 *
 * Dulu page meneruskan semuanya sebagai props satu per satu: page -> IsiJadwal (71 props) -> ReminderListBody (~50)
 * dan page -> PopupDetailJadwal (64, perantara murni) -> ReminderDetailPopup. Kini page mengisi konteks ini SEKALI,
 * dikelompokkan per irisan, dan tiap komponen mengambil irisan yang ia perlukan (lihat docs/audit/struktur-kode.md §3).
 *
 * Keadaan TETAP milik page (useState di page / hook-nya) - konteks hanya jalur antar, bukan penyimpanan baru,
 * jadi perilaku & urutan render sama dengan sebelumnya.
 */
import { createContext, useContext } from 'react';
import { Status, Reminder, TeamUser, GuestUser } from './shared';

export interface NilaiKonteksJadwal {
  /** Siapa yang membuka halaman. */
  sesi: {
    currentUser: TeamUser | null;
    isAdmin: boolean;
    isGuest: boolean;
    isManager: boolean;
  };
  /** Boleh tidaknya aksi - cermin UI dari RLS. */
  izin: {
    bolehEditReminder: (r: Reminder) => boolean;
    canApproveAssign: boolean;
    canInternalApprove: (r: Reminder) => boolean;
    isMyReviewStage: (r: Reminder) => boolean;
  };
  /** Data jadwal & status muat. */
  data: {
    fetchError: string | null;
    fetchReminders: () => Promise<void>;
    filteredReminders: Reminder[];
    groupedReminders: Reminder[][];
    guestUsers: GuestUser[];
    listLoading: boolean;
    reminders: Reminder[];
    setFetchError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  };
  /** Angka & donat kartu statistik. */
  ringkasan: {
    doneCount: number;
    pendingCount: number;
    productPieData: import("@/app/(portal)/reminder-schedule/_components/olah-data").IrisPie[];
    projectPieData: import("@/app/(portal)/reminder-schedule/_components/olah-data").IrisPie[];
    salesPieData: import("@/app/(portal)/reminder-schedule/_components/olah-data").IrisPie[];
    teamPtsPieData: import("@/app/(portal)/reminder-schedule/_components/olah-data").IrisPie[];
    todayCount: number;
    totalCount: number;
  };
  /** Penyaring & pencarian daftar. */
  filter: {
    availableYears: string[];
    filterCategory: string;
    filterStatus: Status | "all";
    filterYear: string;
    productFilter: string | null;
    searchDivisionSales: string;
    searchProduct: string;
    searchProject: string;
    searchSales: string;
    searchTeamHandler: string;
    selectedCalDay: string | null;
    setFilterCategory: import("react").Dispatch<import("react").SetStateAction<string>>;
    setFilterStatus: import("react").Dispatch<import("react").SetStateAction<Status | "all">>;
    setFilterYear: import("react").Dispatch<import("react").SetStateAction<string>>;
    setProductFilter: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    setSearchDivisionSales: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSearchProduct: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSearchProject: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSearchSales: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSearchTeamHandler: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSelectedCalDay: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  };
  /** Mode tampilan & kalender mini. */
  tampilan: {
    calOnlyDay: string | null;
    calendarMonth: Date;
    setCalOnlyDay: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    setCalendarMonth: import("react").Dispatch<import("react").SetStateAction<Date>>;
    view: "list" | "form";
  };
  /** Pilih banyak & hapus massal. */
  pilih: {
    bulkDeleting: boolean;
    selectMode: boolean;
    selectedIds: Set<string>;
    setBulkConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    setSelectMode: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    setSelectedIds: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
    toggleSelectAll: () => void;
  };
  /** Aksi per jadwal (approve, tolak, edit, WA, ...). */
  aksi: {
    handleAdminReject: (r: Reminder) => void;
    handleExportExcel: () => void;
    handleInternalReject: (r: Reminder) => void;
    openDeleteModal: (r: Reminder) => void;
    openSupervisorAssign: (r: Reminder, group: Reminder[]) => void;
    setApproveAssignTo: import("react").Dispatch<import("react").SetStateAction<string>>;
    setApproveBatchSiblings: import("react").Dispatch<import("react").SetStateAction<Reminder[]>>;
    setApproveDate: import("react").Dispatch<import("react").SetStateAction<string>>;
    setApproveTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
    setApproveTime: import("react").Dispatch<import("react").SetStateAction<string>>;
    setDetailReminder: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
    setInternalApproveTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
    setRescheduleTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
    syncKeIncentive: (r: Reminder) => Promise<void>;
    syncing: string | null;
    handleResendFormReview: (r: Reminder) => Promise<void>;
    handleSendWA: (r: Reminder) => Promise<void>;
    openEdit: (r: Reminder) => void;
    resendingFormReview: boolean;
    sendingWA: string | null;
  };
  /** Popup detail: ubah status & mode penyelesaian. */
  detail: {
    bastDate: string;
    bukaEditDetailPelaksanaan: (r: Reminder) => void;
    controllerBrand: "cue" | "extron" | "wyrestorm" | null;
    displayType: "led" | "lcd" | "mix" | null;
    handleConfirmStatusUpdate: () => Promise<void>;
    handleModeConfirm: () => Promise<void>;
    installerDaerah: string;
    installerName: string;
    installerUserId: string | null;
    modeEditSaja: boolean;
    modePenyelesaian: "onsite" | "remote" | null;
    pendingStatus: Status | null;
    daftarCabang: { id: string; full_name: string; pts_daerah: string | null; }[];
    requiresControllerAuto: boolean;
    requiresMiddleware: boolean;
    savingMode: boolean;
    setBastDate: import("react").Dispatch<import("react").SetStateAction<string>>;
    setControllerBrand: import("react").Dispatch<import("react").SetStateAction<"cue" | "extron" | "wyrestorm" | null>>;
    setDisplayType: import("react").Dispatch<import("react").SetStateAction<"led" | "lcd" | "mix" | null>>;
    setInstallerDaerah: import("react").Dispatch<import("react").SetStateAction<string>>;
    setInstallerName: import("react").Dispatch<import("react").SetStateAction<string>>;
    setInstallerUserId: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    setModeEditSaja: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    setModePenyelesaian: import("react").Dispatch<import("react").SetStateAction<"onsite" | "remote" | null>>;
    setPendingPhotoUrl: import("react").Dispatch<import("react").SetStateAction<string | undefined>>;
    setPendingStatus: (v: Status | null) => void;
    setRequiresControllerAuto: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    setRequiresMiddleware: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    setShowModeModal: (v: boolean) => void;
    setShowRiwayat: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    setStatusPhoto: import("react").Dispatch<import("react").SetStateAction<File | null>>;
    setStatusPhotoPreview: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    showModeModal: boolean;
    showRiwayat: boolean;
    statusPhoto: File | null;
    statusPhotoPreview: string | null;
    statusPhotoRef: import("react").RefObject<HTMLInputElement | null>;
    updatingStatus: boolean;
  };
}

export const KonteksJadwal = createContext<NilaiKonteksJadwal | null>(null);

export function useKonteksJadwal(): NilaiKonteksJadwal {
  const k = useContext(KonteksJadwal);
  if (!k) throw new Error('useKonteksJadwal dipakai di luar <KonteksJadwal.Provider> (reminder-schedule/page.tsx).');
  return k;
}
