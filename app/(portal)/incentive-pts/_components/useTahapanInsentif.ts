'use client';

import { simpanNominal } from '@/lib/incentive-nominal-api';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { IncentiveProjectRow, IncentiveTranche, insertTranches, processYearlyBatch, batalkanBatchTahun, hapusTahapanProyek, type SkemaInsentif, formatRupiah } from './calc';
import { managerUtama } from '@/lib/penerima-admin';
import { type CurrentUser } from './aturan-halaman';

export interface TahapanInsentifKonteks {
  batalBatch: number | null;
  batchYear: number;
  bulkGenerateConfirm: IncentiveProjectRow[] | null;
  currentUser: CurrentUser | null;
  filterBastYear: number | null;
  filteredProjects: IncentiveProjectRow[];
  generateProject: IncentiveProjectRow | null;
  hapusTahapan: IncentiveProjectRow | null;
  loadAll: () => Promise<void>;
  nominalBast: string;
  nominalProject: IncentiveProjectRow | null;
  nominalValue: string;
  notify: (type: "success" | "error", msg: string) => void;
  setBatalBatch: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setBatchConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setBatchProcessing: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setBulkGenerateConfirm: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow[] | null>>;
  setBulkGenerateResult: import("react").Dispatch<import("react").SetStateAction<{ tahun: number; berhasil: string[]; gagal: { nama: string; alasan: string; }[]; dilewati: string[]; } | null>>;
  setBulkGenerating: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setGenerateProject: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setGenerating: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setHapusTahapan: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setKetikBatalBatch: import("react").Dispatch<import("react").SetStateAction<string>>;
  setKetikHapusTahapan: import("react").Dispatch<import("react").SetStateAction<string>>;
  setMembatalkan: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setNominalBast: import("react").Dispatch<import("react").SetStateAction<string>>;
  setNominalProject: import("react").Dispatch<import("react").SetStateAction<IncentiveProjectRow | null>>;
  setNominalValue: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSavingNominal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowGenerateModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  skema: SkemaInsentif | null;
  tranches: (IncentiveTranche & { project: IncentiveProjectRow; })[];
}

export function useTahapanInsentif(k: TahapanInsentifKonteks) {
  const { batalBatch, batchYear, bulkGenerateConfirm, currentUser, filterBastYear, filteredProjects, generateProject, hapusTahapan, loadAll, nominalBast, nominalProject, nominalValue, notify, setBatalBatch, setBatchConfirm, setBatchProcessing, setBulkGenerateConfirm, setBulkGenerateResult, setBulkGenerating, setGenerateProject, setGenerating, setHapusTahapan, setKetikBatalBatch, setKetikHapusTahapan, setMembatalkan, setNominalBast, setNominalProject, setNominalValue, setSavingNominal, setShowGenerateModal, skema, tranches } = k;
  const handleSaveNominal = async () => {
    if (!nominalProject) return;
    if (!nominalValue || Number(nominalValue) <= 0) { notify('error', 'Nominal incentive harus > 0'); return; }
    setSavingNominal(true);

    const simpan = await simpanNominal(nominalProject.id, Number(nominalValue));
    if (simpan.error) { notify('error', simpan.error.message); setSavingNominal(false); return; }

    const bastBerubah = (nominalProject.bast_date ?? '') !== nominalBast;
    if (bastBerubah) {
      const isiBast = { bast_date: nominalBast || null, updated_at: new Date().toISOString() };
      const { error } = await (nominalProject.batch_id
        ? supabase.from('reminders').update(isiBast).eq('batch_id', nominalProject.batch_id)
        : supabase.from('reminders').update(isiBast).eq('id', nominalProject.id));
      if (error) { notify('error', 'Nominal tersimpan, tetapi tanggal BAST gagal: ' + error.message); setSavingNominal(false); return; }
    }

    if (bastBerubah) {
      logAudit({
        user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
        action: 'update', module: 'incentive',
        target_id: nominalProject.id, target_name: nominalProject.project_name,
        old_value: nominalProject.bast_date ?? '(kosong)', new_value: nominalBast || '(kosong)',
        notes: 'Tanggal BAST dibetulkan dari layar Incentive',
      }).catch(() => {});
    }
    const bastMasihKosong = !(nominalBast || nominalProject.bast_date);
    if (bastMasihKosong) {
      notify('error', `Nominal ${formatRupiah(Number(nominalValue))} tersimpan, tapi BAST masih kosong — `
        + 'isi Tanggal BAST di atas dulu, baru tombol Generate Tahapan akan muncul.');
    } else {
      notify('success', bastBerubah
        ? `Nominal ${formatRupiah(Number(nominalValue))} & tanggal BAST tersimpan!`
        : `Nominal ${formatRupiah(Number(nominalValue))} berhasil disimpan!`);
    }
    setSavingNominal(false); setNominalProject(null); setNominalValue(''); setNominalBast('');
    loadAll();
  };

  const handleGenerateTranches = async () => {
    if (!generateProject?.bast_date) { notify('error', 'BAST belum ada — isi lewat tombol 💲 Input Nominal pada proyek ini.'); return; }
    setGenerating(true);

    const { data: sudahAda } = await supabase
      .from('incentive_tranches').select('id').eq('project_id', generateProject.id).limit(1);
    if (sudahAda && sudahAda.length > 0) {
      notify('error', 'Tahapan untuk proyek ini sudah pernah dibuat. Hapus dulu yang lama bila ingin dibuat ulang.');
      setGenerating(false); setShowGenerateModal(false); setGenerateProject(null);
      return;
    }

    if (!skema) { notify('error', 'Skema insentif belum termuat, coba lagi sesaat lagi.'); setGenerating(false); return; }
    const { error } = await insertTranches(skema, generateProject.id, generateProject.bast_date, generateProject.mode_penyelesaian);
    if (error) { notify('error', 'Gagal: ' + error.message); } else { notify('success', 'Tranche berhasil di-generate!'); }
    setGenerating(false); setShowGenerateModal(false); setGenerateProject(null);
    loadAll();
  };

  const kandidatBulkGenerate = (tahun: number): IncentiveProjectRow[] => {
    const punyaTahapan = new Set(tranches.map(t => t.project_id));
    return filteredProjects.filter(p =>
      p.bast_date && new Date(p.bast_date).getFullYear() === tahun
      && (p.incentive_value || 0) > 0
      && !punyaTahapan.has(p.id));
  };

  const jalankanBulkGenerate = async () => {
    if (!bulkGenerateConfirm || !bulkGenerateConfirm.length || !skema || filterBastYear == null) return;
    setBulkGenerating(true);
    const tahun = filterBastYear;
    const ids = bulkGenerateConfirm.map(p => p.id);
    const { data: sudahAdaRows } = await supabase
      .from('incentive_tranches').select('project_id').in('project_id', ids);
    const sudahAdaSet = new Set((sudahAdaRows ?? []).map((t: { project_id: string }) => t.project_id));

    const berhasil: string[] = [];
    const gagal: { nama: string; alasan: string }[] = [];
    const dilewati: string[] = [];
    for (const p of bulkGenerateConfirm) {
      if (sudahAdaSet.has(p.id)) { dilewati.push(p.project_name); continue; }
      if (!p.bast_date) { gagal.push({ nama: p.project_name, alasan: 'BAST kosong' }); continue; }
      const { error } = await insertTranches(skema, p.id, p.bast_date, p.mode_penyelesaian);
      if (error) { gagal.push({ nama: p.project_name, alasan: error.message }); continue; }
      berhasil.push(p.project_name);
      void logAudit({
        user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
        action: 'create', module: 'incentive-pts',
        target_id: p.id, target_name: p.project_name,
        new_value: 'tahapan dibuat',
        notes: `Dibuat lewat Generate Tahapan Massal · Tahun BAST ${tahun}`,
      });
    }
    setBulkGenerateResult({ tahun, berhasil, gagal, dilewati });
    setBulkGenerating(false);
    setBulkGenerateConfirm(null);
    loadAll();
  };

  const handleBatchProcess = async () => {
    if (!currentUser) return;
    setBatchProcessing(true);
    const mgrData = await managerUtama();
    const managerId = (mgrData?.id || currentUser.id || '') as string;
    const managerName = (mgrData?.full_name || currentUser.full_name || 'Manager') as string;
    const result = await processYearlyBatch(batchYear, managerId, managerName);
    if (result.error) { notify('error', 'Batch error: ' + (result.error as { message: string }).message); }
    else {
      let msg = `Batch ${batchYear}: ${result.processed}/${result.total} tranche diproses.`;
      if (result.errors?.length) msg += ` Errors: ${result.errors.join('; ')}`;
      notify(result.errors?.length ? 'error' : 'success', msg);
    }
    setBatchProcessing(false); setBatchConfirm(false); loadAll();
  };

  const jalankanBatalBatch = async () => {
    if (batalBatch === null) return;
    setMembatalkan(true);
    const hasil = await batalkanBatchTahun(batalBatch);
    setMembatalkan(false);
    if (hasil.error) { notify('error', 'Gagal membatalkan: ' + hasil.error.message); return; }
    void logAudit({
      user_id: (currentUser?.id as string) ?? '', user_name: (currentUser?.full_name as string) ?? '',
      module: 'incentive', action: 'delete',
      target_name: `Batch ${batalBatch}`,
      old_value: `${hasil.jumlah} tahapan processed`,
      new_value: `${hasil.jumlah} tahapan kembali pending`,
      notes: `Pembatalan Process Batch ${batalBatch}. Baris pembagiannya dihapus. `
        + `${hasil.dilewati} tahapan berstatus Paid tidak disentuh.`,
    });
    notify(hasil.jumlah > 0 ? 'success' : 'error',
      hasil.jumlah > 0
        ? `Batch ${batalBatch} dibatalkan: ${hasil.jumlah} tahapan kembali Pending`
          + (hasil.dilewati ? `, ${hasil.dilewati} dilewati karena sudah Paid.` : '.')
        : `Tidak ada yang bisa dibatalkan di ${batalBatch}`
          + (hasil.dilewati ? ` — ${hasil.dilewati} tahapan sudah berstatus Paid.` : '.'));
    setBatalBatch(null); setKetikBatalBatch('');
    loadAll();
  };

  const jalankanHapusTahapan = async () => {
    if (!hapusTahapan) return;
    setMembatalkan(true);
    const hasil = await hapusTahapanProyek(hapusTahapan.id);
    setMembatalkan(false);
    if (hasil.error) { notify('error', hasil.error.message); return; }
    void logAudit({
      user_id: (currentUser?.id as string) ?? '', user_name: (currentUser?.full_name as string) ?? '',
      module: 'incentive', action: 'delete',
      target_id: hapusTahapan.id, target_name: hapusTahapan.project_name ?? '',
      old_value: `${hasil.jumlah} tahapan pencairan`,
      new_value: 'tanpa tahapan',
      notes: 'Tahapan dihapus lewat tombol Hapus Tahapan — nominal proyek kembali bisa disunting.',
    });
    notify('success', `${hasil.jumlah} tahapan "${hapusTahapan.project_name}" dihapus. Nominal terbuka lagi.`);
    setHapusTahapan(null); setKetikHapusTahapan('');
    loadAll();
  };
  return { handleSaveNominal, handleGenerateTranches, kandidatBulkGenerate, jalankanBulkGenerate, handleBatchProcess, jalankanBatalBatch, jalankanHapusTahapan };
}
