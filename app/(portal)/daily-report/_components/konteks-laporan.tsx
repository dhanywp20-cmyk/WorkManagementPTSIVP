'use client';

import { createContext, useContext } from 'react';
import { type DailyReport } from './shared';
import { type FlatRow } from './bantu-halaman';
import { type TeamUser } from '@/app/(portal)/reminder-schedule/_components/shared';
import type { Ekspor } from '@/lib/ekspor-tabel';

export interface NilaiKonteksLaporan {
  sesi: {
    judulKelompokPTS: string;
    lihatSemua: boolean;
    pimpinan: boolean;
    teamUsers: TeamUser[];
  };
  izin: {
    bolehHapus: (row: any) => boolean;
  };
  data: {
    belumLaporHariIni: TeamUser[];
    dataEkspor: () => Ekspor<FlatRow>;
    filteredRows: FlatRow[];
    hal: import("@/components/shared/Paginasi").HasilPaginasi<FlatRow>;
    liveLoading: boolean;
    loadLiveData: () => Promise<void>;
    loadReports: () => Promise<void>;
    reports: DailyReport[];
  };
  ringkasan: {
    catPieData: { label: string; value: number; color: string; }[];
    divisionPieData: { label: string; value: number; color: string; }[];
    handlerPieData: { label: string; value: number; color: string; }[];
    productPieData: { label: string; value: number; color: string; }[];
    stats: { total: number; pending: number; selesai: number; hariIni: number; fromTicket: number; fromReminder: number; fromManual: number; };
  };
  filter: {
    filterCategory: string | null;
    filterDate: string;
    filterDivision: string | null;
    filterHandler: string | null;
    filterProduct: string | null;
    filterSource: string;
    filterStatus: string;
    filterUser: string;
    searchProject: string;
    setFilterCategory: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    setFilterDate: import("react").Dispatch<import("react").SetStateAction<string>>;
    setFilterDivision: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    setFilterHandler: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    setFilterProduct: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    setFilterSource: import("react").Dispatch<import("react").SetStateAction<string>>;
    setFilterStatus: import("react").Dispatch<import("react").SetStateAction<string>>;
    setFilterUser: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSearchProject: import("react").Dispatch<import("react").SetStateAction<string>>;
  };
  aksi: {
    mintaHapus: (row: any) => void;
    openEditForm: (report: DailyReport) => Promise<void>;
    setModalRow: import("react").Dispatch<any>;
  };
}

export const KonteksLaporan = createContext<NilaiKonteksLaporan | null>(null);

export function useKonteksLaporan(): NilaiKonteksLaporan {
  const k = useContext(KonteksLaporan);
  if (!k) throw new Error('useKonteksLaporan harus di dalam <KonteksLaporan.Provider>');
  return k;
}
