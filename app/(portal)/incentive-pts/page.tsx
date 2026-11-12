'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getSession, startSessionWatcher } from '@/lib/auth/sesi';
import { IncentiveProjectRow, IncentiveTranche, IncentiveSplit, LateTicketLink, deteksiKandidatGabung, type KandidatGabung, insertSplits, validateSplitTotal, findUpline, resolveUserId, OrgUser, type SkemaInsentif, formatRupiah } from './_components/calc';
import { fetchLateTickets } from './_components/calc';
import { PageHeader, ConfirmDialog, type ConfirmState, usePaginasi } from '@/components/shared';
import { Toast } from '@/components/shared/Toast';
import { ModalKonfirmHapus } from './_components/ModalKonfirmHapus';
import { ModalKonfirmGabung } from './_components/ModalKonfirmGabung';
import { ModalHapusTahapan } from './_components/ModalHapusTahapan';
import { ModalBatalBatch } from './_components/ModalBatalBatch';
import { ModalKonfirmBatch } from './_components/ModalKonfirmBatch';
import { ModalHasilGenerateMassal } from './_components/ModalHasilGenerateMassal';
import { ModalKonfirmGenerateMassal } from './_components/ModalKonfirmGenerateMassal';
import { ModalGenerateTranche } from './_components/ModalGenerateTranche';

void insertSplits; void validateSplitTotal;

import { bolehLihatBrand, bisaKonfig, bisaInput, type CurrentUser, type TabKey } from './_components/aturan-halaman';
import { ModalDetailProyekInsentif } from './_components/ModalDetailProyekInsentif';
import { ModalNominalProyek } from './_components/ModalNominalProyek';
import { usePengaturanInsentif } from './_components/usePengaturanInsentif';
import { useGabungHapusProyek } from './_components/useGabungHapusProyek';
import { useMuatInsentif } from './_components/useMuatInsentif';
import { useEksporInsentif } from './_components/useEksporInsentif';
import { useTahapanInsentif } from './_components/useTahapanInsentif';
import { IsiInsentif } from './_components/IsiInsentif';
import { KonteksInsentif, type NilaiKonteksInsentif } from './_components/konteks-insentif';

export default function IncentivePTSPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [appReady, setAppReady] = useState(false);
  const [tab, setTab] = useState<TabKey>('projects');
  const [skema, setSkema] = useState<SkemaInsentif | null>(null);

  const [projects, setProjects] = useState<IncentiveProjectRow[]>([]);
  const [tranches, setTranches] = useState<(IncentiveTranche & { project: IncentiveProjectRow })[]>([]);
  const [allSplits, setAllSplits] = useState<IncentiveSplit[]>([]);
  const [allUsers, setAllUsers] = useState<CurrentUser[]>([]);
  const [ptsTeamMappings, setPtsTeamMappings] = useState<{ staff_user_id: string; supervisor_user_id: string }[]>([]);
  const [supportMap, setSupportMap] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [searchProject, setSearchProject] = useState('');
  const [brandEditFor, setBrandEditFor] = useState<string | null>(null);

  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [batchYear, setBatchYear] = useState<number>(new Date().getFullYear());

  const [detailProject, setDetailProject] = useState<IncentiveProjectRow | null>(null);
  const [detailSplits, setDetailSplits] = useState<IncentiveSplit[]>([]);
  const [detailTranches, setDetailTranches] = useState<IncentiveTranche[]>([]);
  const [detailSupports, setDetailSupports] = useState<
    { tahunKe: number; dari: string | null; sampai: string | null; orang: { user_id: string; user_name: string }[] }[]
  >([]);

  const [nominalProject, setNominalProject] = useState<IncentiveProjectRow | null>(null);
  const [nominalValue, setNominalValue] = useState('');
  const [nominalBast, setNominalBast] = useState('');
  const [savingNominal, setSavingNominal] = useState(false);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateProject, setGenerateProject] = useState<IncentiveProjectRow | null>(null);

  const [filterBastYear, setFilterBastYear] = useState<number | null>(null);
  const [bulkGenerateConfirm, setBulkGenerateConfirm] = useState<IncentiveProjectRow[] | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkGenerateResult, setBulkGenerateResult] =
    useState<{ tahun: number; berhasil: string[]; gagal: { nama: string; alasan: string }[]; dilewati: string[] } | null>(null);
  const [summaryExportYear, setSummaryExportYear] = useState<number | null>(null);

  const [batalBatch, setBatalBatch] = useState<number | null>(null);
  const [ketikBatalBatch, setKetikBatalBatch] = useState('');
  const [hapusTahapan, setHapusTahapan] = useState<IncentiveProjectRow | null>(null);
  const [ketikHapusTahapan, setKetikHapusTahapan] = useState('');
  const [membatalkan, setMembatalkan] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportingSaya, setExportingSaya] = useState(false);
  const [lateTickets, setLateTickets] = useState<LateTicketLink[]>([]);

  const notify = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    const u = getSession<CurrentUser>();
    if (!u) { const target = window.top !== window ? window.top : window; if (target) target.location.href = '/dashboard'; return; }
    setCurrentUser(u);
    supabase.from('users').select('incentive_akses, allow_incentive_input, incentive_brand_scope').eq('username', u.username as string).single()
      .then(({ data }) => {
        if (data) setCurrentUser(prev => prev ? { ...prev, incentive_akses: data.incentive_akses, allow_incentive_input: data.allow_incentive_input ?? false, incentive_brand_scope: data.incentive_brand_scope } : prev);
      });
    loadAll().then(() => setAppReady(true));
    const cleanup = startSessionWatcher();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { loadAll, openProjectDetail } = useMuatInsentif({ allUsers, setAllSplits, setAllUsers, setDetailProject, setDetailSplits, setDetailSupports, setDetailTranches, setLateTickets, setLoading, setProjects, setPtsTeamMappings, setSkema, setSupportMap, setTranches, skema });

  const bolehHapus = bisaKonfig(currentUser);

  const kandidatGabung = useMemo(() => deteksiKandidatGabung(projects), [projects]);
  const [konfirmGabung, setKonfirmGabung] = useState<KandidatGabung | null>(null);
  const [menggabung, setMenggabung] = useState(false);

  const { jalankanGabung, pilihHapus, setPilihHapus, konfirmHapus, setKonfirmHapus, menghapus, togglePilih, mintaKonfirmasiHapus, jalankanHapus } = useGabungHapusProyek({ currentUser, konfirmGabung, loadAll, notify, setKonfirmGabung, setMenggabung });

  const canSeeAll = bisaInput(currentUser);
  const orgListAll = allUsers as unknown as OrgUser[];
  const mySplitProjectIds = new Set(allSplits.map(s => s.project_id));
  const userInProject = (p: IncentiveProjectRow): boolean => {
    if (!currentUser) return false;
    if (mySplitProjectIds.has(p.id)) return true;
    const uid = currentUser.id;
    const uname = (currentUser.username || '').toLowerCase();
    const ufull = (currentUser.full_name || '').toLowerCase();
    if (uid && p.pic_id && p.pic_id === uid) return true;
    if (uname && (p.assigned_to || '').toLowerCase() === uname) return true;
    if (ufull && (p.assign_name || '').toLowerCase() === ufull) return true;
    const sup = supportMap.get(p.project_name);
    if (sup && ((uname && sup.has(uname)) || (ufull && sup.has(ufull)))) return true;
    const picId = resolveUserId((p.pic_id || p.assigned_to) as string, p.assign_name, orgListAll);
    if (uid && findUpline(picId, 'Supervisor', orgListAll)?.id === uid) return true;
    if (uid && findUpline(picId, 'Manager', orgListAll)?.id === uid) return true;
    return false;
  };
  const filteredProjects = projects.filter(p =>
    (!searchProject || p.project_name.toLowerCase().includes(searchProject.toLowerCase()) || (p.assign_name || '').toLowerCase().includes(searchProject.toLowerCase()))
  ).filter(p => canSeeAll || userInProject(p))
    .filter(p => bolehLihatBrand(currentUser?.incentive_brand_scope, p.brand))
    .filter(p => filterBastYear == null
      || (p.bast_date && new Date(p.bast_date).getFullYear() === filterBastYear));
  const bastYearsProjects = [...new Set(
    projects.filter(p => p.bast_date).map(p => new Date(p.bast_date as string).getFullYear()),
  )].sort((a, b) => b - a);

  const trancheById = new Map(tranches.map(t => [t.id, t]));
  const mySplitsInYear = currentUser
    ? allSplits.filter(s => {
        if (s.user_id !== currentUser.id) return false;
        if (filterBastYear == null) return true;
        const tr = s.tranche_id ? trancheById.get(s.tranche_id) : null;
        return tr ? tr.payment_year === filterBastYear : false;
      })
    : [];
  const myTotalInsentif = mySplitsInYear.reduce((sum, s) => sum + (s.amount || 0), 0);
  const myPaidInsentif = mySplitsInYear
    .filter(s => trancheById.get(s.tranche_id || '')?.status === 'paid')
    .reduce((sum, s) => sum + (s.amount || 0), 0);
  const myPendingInsentif = myTotalInsentif - myPaidInsentif;
  const myProjectCount = new Set(mySplitsInYear.map(s => s.project_id)).size;
  const hal = usePaginasi(filteredProjects);

  const uniqueYears = [...new Set(tranches.map(t => t.payment_year))].sort();
  const tahunAktif = uniqueYears.includes(filterYear)
    ? filterYear
    : (uniqueYears[0] ?? filterYear);
  const filteredTranches = tranches.filter(t => t.payment_year === tahunAktif);
  const totalPool = projects.filter(p => (p.incentive_value || 0) > 0).reduce((s, p) => s + (p.incentive_value || 0), 0);
  const pendingNominal = projects.filter(p => !(p.incentive_value || 0)).length;
  const pendingTranche = tranches.filter(t => t.status === 'pending').length;

  const { handleSaveNominal, handleGenerateTranches, kandidatBulkGenerate, jalankanBulkGenerate, handleBatchProcess, jalankanBatalBatch, jalankanHapusTahapan } = useTahapanInsentif({ batalBatch, batchYear, bulkGenerateConfirm, currentUser, filterBastYear, filteredProjects, generateProject, hapusTahapan, loadAll, nominalBast, nominalProject, nominalValue, notify, setBatalBatch, setBatchConfirm, setBatchProcessing, setBulkGenerateConfirm, setBulkGenerateResult, setBulkGenerating, setGenerateProject, setGenerating, setHapusTahapan, setKetikBatalBatch, setKetikHapusTahapan, setMembatalkan, setNominalBast, setNominalProject, setNominalValue, setSavingNominal, setShowGenerateModal, skema, tranches });

  const { handleExportSummary, handleExportInsentifSaya, handleExportBatch } = useEksporInsentif({ allUsers, currentUser, filterBastYear, mySplitsInYear, notify, projects, setExporting, setExportingSaya, summaryExportYear, tahunAktif, trancheById, tranches });

  const { konfirmasiMarkPaid, cariUser, setCariUser, handleSetBrandScope, handleSetAkses, handleSetProjectBrand } = usePengaturanInsentif({ currentUser, detailProject, loadAll, notify, openProjectDetail, setAllUsers, setConfirmState, setMarkingPaid, setProjects });

  if (!appReady) return (
    <div className="flex items-center justify-center" style={{ minHeight: '100%', background: 'var(--latar-halaman)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="flex flex-col items-center gap-3 bg-white/90 rounded-2xl px-8 py-6 shadow-xl">
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#f43f5e' }} />
        <p className="text-slate-500 text-sm font-semibold">Memuat Incentive PTS...</p>
      </div>
    </div>
  );

  const muatUlangLampiran = async () => {
    const r = await fetchLateTickets();
    if (!r.error) setLateTickets(r.data);
  };

  const thCls = 'px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200';

  const konteksInsentif: NilaiKonteksInsentif = {
    sesi: { allUsers, currentUser, loading, notify, tab, tahunAktif, thCls },
    izin: { bolehHapus },
    saya: { exportingSaya, handleExportInsentifSaya, myPaidInsentif, myPendingInsentif, myProjectCount, mySplitsInYear, myTotalInsentif },
    proyek: { bastYearsProjects, brandEditFor, filterBastYear, filteredProjects, hal, kandidatBulkGenerate, kandidatGabung, pilihHapus, searchProject, setBrandEditFor,
      setBulkGenerateConfirm, setFilterBastYear, setKonfirmGabung, setPilihHapus, setSearchProject, togglePilih },
    tahapan: { allSplits, filteredTranches, konfirmasiMarkPaid, lateTickets, markingPaid, muatUlangLampiran, setBatalBatch, setBatchConfirm, setBatchYear, setFilterYear, setKetikBatalBatch, skema, totalPool,
      tranches, uniqueYears },
    akses: { cariUser, handleSetAkses, handleSetBrandScope, setCariUser },
    ekspor: { exporting, handleExportBatch, handleExportSummary, setSummaryExportYear, summaryExportYear },
    aksi: { handleSetProjectBrand, mintaKonfirmasiHapus, openProjectDetail, setGenerateProject, setHapusTahapan, setKetikHapusTahapan, setNominalBast, setNominalProject,
      setNominalValue, setShowGenerateModal },
  };
  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ fontFamily: "'Inter', sans-serif", background: 'var(--latar-halaman)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>

      <Toast notif={toast} />

      <PageHeader icon="💰" title="Incentive PTS" subtitle="Insentif tim PTS per proyek & tranche pembayaran">
          <div className="hidden sm:flex items-center gap-4 text-right">
            <div><p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Total Pool</p><p className="text-sm font-black text-emerald-700">{formatRupiah(totalPool)}</p></div>
            <div><p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Projects</p><p className="text-sm font-black text-rose-600">{projects.length}</p></div>
            <div><p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Pending Nominal</p><p className="text-sm font-black text-amber-700">{pendingNominal}</p></div>
            <div><p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider">Pending Tranche</p><p className="text-sm font-black text-rose-600">{pendingTranche}</p></div>
          </div>
      </PageHeader>

      <div className="shrink-0 z-40"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
        <div className="w-full px-4 flex gap-1 overflow-x-auto">
          {([
            { id: 'projects', label: '📋 Projects',            show: true },
            { id: 'tranches', label: '📅 Tranche Schedule',    show: bisaInput(currentUser) },
            { id: 'late',     label: '🕐 Late Ticket Queue',   show: bisaInput(currentUser) },
            { id: 'skema',    label: '🧮 Skema Pembagian',    show: bisaKonfig(currentUser) },
            { id: 'settings', label: '⚙️ Pengaturan Akses',   show: bisaKonfig(currentUser) },
          ] as { id: TabKey; label: string; show: boolean }[])
            .filter(t => t.show)
            .map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${tab === t.id ? 'border-rose-500 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
        </div>
      </div>

      <KonteksInsentif.Provider value={konteksInsentif}>

        <IsiInsentif />

      </KonteksInsentif.Provider>

      <ModalNominalProyek
        handleSaveNominal={handleSaveNominal} nominalBast={nominalBast} nominalProject={nominalProject} nominalValue={nominalValue} savingNominal={savingNominal} setNominalBast={setNominalBast} setNominalProject={setNominalProject} setNominalValue={setNominalValue} skema={skema}
      />

      <ModalDetailProyekInsentif
        allUsers={allUsers} currentUser={currentUser} detailProject={detailProject} detailSplits={detailSplits} detailSupports={detailSupports} detailTranches={detailTranches} konfirmasiMarkPaid={konfirmasiMarkPaid} markingPaid={markingPaid} ptsTeamMappings={ptsTeamMappings} setDetailProject={setDetailProject} skema={skema}
      />

      <ModalGenerateTranche
        generateProject={generateProject} generating={generating} handleGenerateTranches={handleGenerateTranches} setGenerateProject={setGenerateProject} setShowGenerateModal={setShowGenerateModal} showGenerateModal={showGenerateModal} skema={skema}
      />

      <ModalKonfirmGenerateMassal
        bulkGenerateConfirm={bulkGenerateConfirm} bulkGenerating={bulkGenerating} filterBastYear={filterBastYear} jalankanBulkGenerate={jalankanBulkGenerate} setBulkGenerateConfirm={setBulkGenerateConfirm}
      />

      <ModalHasilGenerateMassal
        bulkGenerateResult={bulkGenerateResult} setBulkGenerateResult={setBulkGenerateResult}
      />

      <ModalKonfirmBatch
        batchConfirm={batchConfirm} batchProcessing={batchProcessing} batchYear={batchYear} handleBatchProcess={handleBatchProcess} setBatchConfirm={setBatchConfirm} tranches={tranches}
      />

      <ModalBatalBatch
        batalBatch={batalBatch} jalankanBatalBatch={jalankanBatalBatch} ketikBatalBatch={ketikBatalBatch} membatalkan={membatalkan} setBatalBatch={setBatalBatch} setKetikBatalBatch={setKetikBatalBatch} tranches={tranches}
      />

      <ModalHapusTahapan
        hapusTahapan={hapusTahapan} jalankanHapusTahapan={jalankanHapusTahapan} ketikHapusTahapan={ketikHapusTahapan} membatalkan={membatalkan} setHapusTahapan={setHapusTahapan} setKetikHapusTahapan={setKetikHapusTahapan} tranches={tranches}
      />

      <ModalKonfirmGabung
        jalankanGabung={jalankanGabung} konfirmGabung={konfirmGabung} menggabung={menggabung} setKonfirmGabung={setKonfirmGabung}
      />

      <ModalKonfirmHapus
        jalankanHapus={jalankanHapus} konfirmHapus={konfirmHapus} menghapus={menghapus} setKonfirmHapus={setKonfirmHapus}
      />

      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
    </div>
  );
}
