'use client';

/** useEksporInsentif - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
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
    //  Sama seperti Process Batch: lewat managerUtama(), bukan jabatan+tim
    //  yang dipaku - lihat catatan panjang di lib/penerima-admin.ts.
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
      /*
        Hanya project yang SUDAH masuk pipeline tahapan (Generate Tahapan
        sudah dijalankan - punya baris incentive_tranches, apa pun statusnya
        Pending/Processed/Paid) yang diexport - bukan seluruh project
        berstatus done. Project yang nominalnya belum diisi/belum di-generate
        bukan laporan pencairan yang bisa diperiksa Finance, cuma pekerjaan
        yang masih perlu disiapkan Admin di tab Project.
      */
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

  /**
   * Export personal - satu-satunya export yang boleh diakses tier 'lihat'
   * sekalipun, karena isinya cuma baris milik currentUser sendiri (mySplitsInYear
   * sudah difilter by user_id, terlepas dari tingkat akses). Ikut Filter Tahun
   * BAST yang sama dengan kartu "Insentif Saya" supaya berkasnya persis
   * mencerminkan angka yang sedang dilihat, bukan diam-diam lintas tahun.
   */
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

  /**
   * Export dari tab Tranche Schedule - beda sumbu filter dari Export Summary
   * di tab Project (yang menyaring lewat BAST). Di sini yang dipilih adalah
   * TAHUN BAYAR batch (tahunAktif, dropdown "Tahun" di tab ini) - jadi
   * proyeknya persis yang tampil di tabel tranche tahun itu, apa pun tahun
   * BAST masing-masing. Penting begitu banyak tahun sudah ke-record: tombol
   * ini yang dipakai re-export satu batch tahun bayar tertentu saja, tanpa
   * ikut menyeret proyek dari batch tahun lain.
   */
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
