'use client';

import { managerUtama } from '@/lib/penerima-admin';
import { IncentiveProjectRow, IncentiveTranche, IncentiveSplit, ambilSumberSupport, supportUntukProyek } from './calc';
import { type CurrentUser } from './aturan-halaman';

export interface EksporInsentifKonteks {
  allUsers: CurrentUser[];
  currentUser: CurrentUser | null;
  filterBastYear: number | null;
  mySplitsInYear: IncentiveSplit[];
  notify: (type: "success" | "error", msg: string) => void;
  projects: IncentiveProjectRow[];
  setExporting: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setExportingSaya: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  summaryExportYear: number | null;
  tahunAktif: number;
  trancheById: Map<string, IncentiveTranche & { project: IncentiveProjectRow; }>;
  tranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
}

export function useEksporInsentif(k: EksporInsentifKonteks) {
  const { allUsers, currentUser, filterBastYear, mySplitsInYear, notify, projects, setExporting, setExportingSaya, summaryExportYear, tahunAktif, trancheById, tranches } = k;
  const siapkanDataExport = async () => {
    const mgr = await managerUtama();
    const managerUserId = (mgr?.id || '') as string;
    const managerName   = (mgr?.full_name || 'Manager') as string;
    const { data: sumberSupport } = await ambilSumberSupport();
    const supportsMap = new Map<string, { user_id: string; user_name: string }[]>();
    for (const p of projects) {
      supportsMap.set(p.project_name, supportUntukProyek(sumberSupport, p));
    }
    return { managerUserId, managerName, supportsMap };
  };

  const handleExportSummary = async () => {
    setExporting(true);
    try {
      const { managerUserId, managerName, supportsMap } = await siapkanDataExport();
      const projectsAktif = projects.filter(p => tranches.some(t => t.project_id === p.id));
      await (await import('./exportPengajuan')).exportSummaryIncentive({
        projects: projectsAktif, allUsers: allUsers as { id?: string; full_name?: string; jabatan?: string; atasan_id?: string | null }[],
        supportsMap, managerName, managerUserId, year: summaryExportYear,
      });
      notify('success', summaryExportYear != null
        ? `Export summary tahun ${summaryExportYear} berhasil! (${projectsAktif.length} project dengan tahapan aktif)`
        : `Export summary semua tahun berhasil! (${projectsAktif.length} project dengan tahapan aktif)`);
    } catch (err: unknown) { notify('error', 'Export gagal: ' + (err as Error).message); }
    setExporting(false);
  };

  const handleExportInsentifSaya = async () => {
    if (!currentUser) return;
    setExportingSaya(true);
    try {
      const projectById = new Map(projects.map(p => [p.id, p]));
      await (await import('./exportInsentifSaya')).exportInsentifSaya({
        splits: mySplitsInYear,
        trancheById,
        projectById,
        userName: currentUser.full_name || currentUser.username || 'Saya',
        year: filterBastYear,
      });
      notify('success', 'Export Insentif Saya berhasil!');
    } catch (err: unknown) { notify('error', 'Export gagal: ' + (err as Error).message); }
    setExportingSaya(false);
  };

  const handleExportBatch = async () => {
    setExporting(true);
    try {
      const { managerUserId, managerName, supportsMap } = await siapkanDataExport();
      const idsBatch = [...new Set(tranches.filter(t => t.payment_year === tahunAktif).map(t => t.project_id))];
      const projectsBatch = projects.filter(p => idsBatch.includes(p.id));
      await (await import('./exportPengajuan')).exportSummaryIncentive({
        projects: projectsBatch, allUsers: allUsers as { id?: string; full_name?: string; jabatan?: string; atasan_id?: string | null }[],
        supportsMap, managerName, managerUserId, projectIds: idsBatch, batchYearLabel: tahunAktif,
      });
      notify('success', `Export batch tahun bayar ${tahunAktif} berhasil! (${projectsBatch.length} project)`);
    } catch (err: unknown) { notify('error', 'Export gagal: ' + (err as Error).message); }
    setExporting(false);
  };
  return { siapkanDataExport, handleExportSummary, handleExportInsentifSaya, handleExportBatch };
}
