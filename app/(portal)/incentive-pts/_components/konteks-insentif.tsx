'use client';

import { createContext, useContext } from 'react';
import { IncentiveProjectRow, IncentiveTranche, IncentiveSplit, LateTicketLink, type KandidatGabung, type SkemaInsentif } from './calc';
import { type CurrentUser, type TabKey } from './aturan-halaman';
import { type TingkatAkses } from '@/lib/incentive-akses';

export interface NilaiKonteksInsentif {
  sesi: {
    allUsers: CurrentUser[];
    currentUser: CurrentUser | null;
    loading: boolean;
    notify: (type: "success" | "error", msg: string) => void;
    tab: TabKey;
    tahunAktif: number;
    thCls: "px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200";
  };
  izin: {
    bolehHapus: boolean;
  };
  saya: {
    exportingSaya: boolean;
    handleExportInsentifSaya: () => Promise<void>;
    myPaidInsentif: number;
    myPendingInsentif: number;
    myProjectCount: number;
    mySplitsInYear: IncentiveSplit[];
    myTotalInsentif: number;
  };
  proyek: {
    bastYearsProjects: number[];
    brandEditFor: string | null;
    filterBastYear: number | null;
    filteredProjects: IncentiveProjectRow[];
    hal: import("@/components/shared/Paginasi").HasilPaginasi<IncentiveProjectRow>;
    kandidatBulkGenerate: (tahun: number) => IncentiveProjectRow[];
    kandidatGabung: KandidatGabung[];
    pilihHapus: Set<string>;
    searchProject: string;
    setBrandEditFor: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    setBulkGenerateConfirm: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow[] | null>>;
    setFilterBastYear: import("react").Dispatch<import("react").SetStateAction<number | null>>;
    setKonfirmGabung: import("react").Dispatch<import("react").SetStateAction<KandidatGabung | null>>;
    setPilihHapus: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
    setSearchProject: import("react").Dispatch<import("react").SetStateAction<string>>;
    togglePilih: (id: string) => void;
  };
  tahapan: {
    filteredTranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
    konfirmasiMarkPaid: (trancheId: string, projectName: string, trancheNumber: number) => void;
    lateTickets: LateTicketLink[];
    markingPaid: string | null;
    setBatalBatch: import("react").Dispatch<import("react").SetStateAction<number | null>>;
    setBatchConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    setBatchYear: import("react").Dispatch<import("react").SetStateAction<number>>;
    setFilterYear: import("react").Dispatch<import("react").SetStateAction<number>>;
    setKetikBatalBatch: import("react").Dispatch<import("react").SetStateAction<string>>;
    skema: SkemaInsentif | null;
    totalPool: number;
    tranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
    uniqueYears: number[];
  };
  akses: {
    cariUser: string;
    handleSetAkses: (userId: string, nilai: TingkatAkses) => Promise<void>;
    handleSetBrandScope: (userId: string, scope: string | null) => Promise<void>;
    setCariUser: import("react").Dispatch<import("react").SetStateAction<string>>;
  };
  ekspor: {
    exporting: boolean;
    handleExportBatch: () => Promise<void>;
    handleExportSummary: () => Promise<void>;
    setSummaryExportYear: import("react").Dispatch<import("react").SetStateAction<number | null>>;
    summaryExportYear: number | null;
  };
  aksi: {
    handleSetProjectBrand: (projectId: string, brand: "MVI" | "IVP" | "BOTH") => Promise<void>;
    mintaKonfirmasiHapus: (target: IncentiveProjectRow[]) => Promise<void>;
    openProjectDetail: (p: IncentiveProjectRow) => Promise<void>;
    setGenerateProject: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
    setHapusTahapan: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
    setKetikHapusTahapan: import("react").Dispatch<import("react").SetStateAction<string>>;
    setNominalBast: import("react").Dispatch<import("react").SetStateAction<string>>;
    setNominalProject: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
    setNominalValue: import("react").Dispatch<import("react").SetStateAction<string>>;
    setShowGenerateModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  };
}

export const KonteksInsentif = createContext<NilaiKonteksInsentif | null>(null);

export function useKonteksInsentif(): NilaiKonteksInsentif {
  const k = useContext(KonteksInsentif);
  if (!k) throw new Error('useKonteksInsentif harus di dalam <KonteksInsentif.Provider>');
  return k;
}
