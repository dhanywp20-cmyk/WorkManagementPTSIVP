'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getSession, startSessionWatcher } from '@/lib/auth';
import {
  IncentiveProjectRow, IncentiveTranche, IncentiveSplit, LateTicketLink,
  fetchIncentiveProjects, fetchTranches, fetchSplits, fetchSupportFromTickets, fetchLateTickets,
  insertTranches, insertSplits, processYearlyBatch,
  calculateIncentiveSplits, validateSplitTotal, generateTranches, getSupervisorTeamForPic,
  formatRupiah, formatPct,
  ROLE_LABELS, TRANCHE_STATUS,
} from './_components/calc';
import { exportPengajuanIncentive, exportSummaryIncentive } from './_components/exportPengajuan';

void insertSplits; void validateSplitTotal;

interface CurrentUser { id?: string; username?: string; full_name?: string; role?: string; team_type?: string; allow_incentive_input?: boolean; [k: string]: unknown; }

function isAdmin(u: CurrentUser | null) { const r = (u?.role || '').toLowerCase(); return r === 'admin' || r === 'superadmin'; }
function canInputNominal(u: CurrentUser | null) { return isAdmin(u) || !!u?.allow_incentive_input; }

function calcHandlerSplit(p: IncentiveProjectRow): { pct: number; amt: number } | null {
  const pool = p.incentive_value || 0;
  if (!pool || !p.mode_penyelesaian) return null;
  const remote = p.mode_penyelesaian === 'remote';
  if (p.pic_type === 'manager_pic') {
    return { pct: remote ? 85 : 100, amt: Math.round(pool * (remote ? 0.85 : 1.0)) };
  }
  const factor = remote ? 0.85 : 1.0;
  return { pct: 60 * factor, amt: Math.round(pool * 0.60 * factor) };
}

type TabKey = 'projects' | 'tranches' | 'late' | 'settings';

export default function IncentivePTSPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [appReady, setAppReady] = useState(false);
  const [tab, setTab] = useState<TabKey>('projects');

  const [projects, setProjects] = useState<IncentiveProjectRow[]>([]);
  const [tranches, setTranches] = useState<(IncentiveTranche & { project: IncentiveProjectRow })[]>([]);
  const [allSplits, setAllSplits] = useState<IncentiveSplit[]>([]);
  const [allUsers, setAllUsers] = useState<CurrentUser[]>([]);
  const [ptsTeamMappings, setPtsTeamMappings] = useState<{ staff_user_id: string; supervisor_user_id: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [searchProject, setSearchProject] = useState('');

  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [batchYear, setBatchYear] = useState<number>(new Date().getFullYear());

  const [detailProject, setDetailProject] = useState<IncentiveProjectRow | null>(null);
  const [detailSplits, setDetailSplits] = useState<IncentiveSplit[]>([]);
  const [detailTranches, setDetailTranches] = useState<IncentiveTranche[]>([]);
  const [detailSupports, setDetailSupports] = useState<{ user_id: string; user_name: string }[]>([]);

  const [nominalProject, setNominalProject] = useState<IncentiveProjectRow | null>(null);
  const [nominalValue, setNominalValue] = useState('');
  const [savingNominal, setSavingNominal] = useState(false);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateProject, setGenerateProject] = useState<IncentiveProjectRow | null>(null);
  const [generating, setGenerating] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [lateTickets, setLateTickets] = useState<LateTicketLink[]>([]);

  const notify = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    const u = getSession<CurrentUser>();
    if (!u) { window.location.href = '/dashboard'; return; }
    setCurrentUser(u);
    supabase.from('users').select('allow_incentive_input').eq('username', u.username as string).single().then(({ data }: { data: { allow_incentive_input: boolean } | null }) => {
      if (data) setCurrentUser(prev => prev ? { ...prev, allow_incentive_input: data.allow_incentive_input } : prev);
    });
    loadAll().then(() => setAppReady(true));
    const cleanup = startSessionWatcher();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);
    const [projRes, trancheRes, splitRes, lateRes] = await Promise.all([
      fetchIncentiveProjects(), fetchTranches(), fetchSplits(), fetchLateTickets(),
    ]);
    if (projRes.data) setProjects(projRes.data);
    if (trancheRes.data) setTranches(trancheRes.data);
    if (splitRes.data) setAllSplits(splitRes.data);
    if (lateRes.data) setLateTickets(lateRes.data);
    const [usersRes, ptsTeamRes] = await Promise.all([
      supabase.from('users').select('id, username, full_name, role, team_type, allow_incentive_input').order('full_name'),
      supabase.from('pts_team_mappings').select('staff_user_id, supervisor_user_id'),
    ]);
    if (usersRes.data) setAllUsers(usersRes.data as CurrentUser[]);
    if (ptsTeamRes.data) setPtsTeamMappings(ptsTeamRes.data as { staff_user_id: string; supervisor_user_id: string }[]);
    setLoading(false);
  }

  async function openProjectDetail(p: IncentiveProjectRow) {
    setDetailProject(p);
    const [splitsRes, tranchesRes, supportsRes] = await Promise.all([
      fetchSplits(p.id),
      supabase.from('incentive_tranches').select('*').eq('project_id', p.id).order('tranche_number'),
      fetchSupportFromTickets(p.project_name),
    ]);
    setDetailSplits(splitsRes.data || []);
    setDetailTranches((tranchesRes.data || []) as IncentiveTranche[]);
    setDetailSupports(supportsRes.data || []);
  }

  async function handleSaveNominal() {
    if (!nominalProject) return;
    if (!nominalValue || Number(nominalValue) <= 0) { notify('error', 'Nominal incentive harus > 0'); return; }
    setSavingNominal(true);
    const { error } = await supabase.from('reminders').update({ incentive_value: Number(nominalValue), updated_at: new Date().toISOString() }).eq('id', nominalProject.id);
    if (error) { notify('error', 'Gagal: ' + error.message); setSavingNominal(false); return; }
    notify('success', `Nominal ${formatRupiah(Number(nominalValue))} berhasil disimpan!`);
    setSavingNominal(false); setNominalProject(null); setNominalValue('');
    loadAll();
  }

  async function handleGenerateTranches() {
    if (!generateProject?.bast_date) { notify('error', 'BAST belum ada — isi saat Handler klik Completed di Reminder Schedule!'); return; }
    setGenerating(true);
    const { error } = await insertTranches(generateProject.id, generateProject.bast_date, generateProject.mode_penyelesaian);
    if (error) { notify('error', 'Gagal: ' + error.message); } else { notify('success', 'Tranche berhasil di-generate!'); }
    setGenerating(false); setShowGenerateModal(false); setGenerateProject(null);
    loadAll();
  }

  async function handleBatchProcess() {
    if (!currentUser) return;
    setBatchProcessing(true);
    const { data: dhanyData } = await supabase.from('users').select('id, full_name').ilike('full_name', '%dhany%').limit(1).single();
    const managerId = (dhanyData?.id || currentUser.id || '') as string;
    const managerName = (dhanyData?.full_name || 'Dhany') as string;
    const result = await processYearlyBatch(batchYear, managerId, managerName);
    if (result.error) { notify('error', 'Batch error: ' + (result.error as { message: string }).message); }
    else {
      let msg = `Batch ${batchYear}: ${result.processed}/${result.total} tranche diproses.`;
      if (result.errors?.length) msg += ` Errors: ${result.errors.join('; ')}`;
      notify(result.errors?.length ? 'error' : 'success', msg);
    }
    setBatchProcessing(false); setBatchConfirm(false); loadAll();
  }

  async function handleExport() {
    setExporting(true);
    try {
      const yt = tranches.filter(t => t.payment_year === filterYear && (t.status === 'processed' || t.status === 'paid'));
      const yids = new Set(yt.map(t => t.project_id));
      const yp = projects.filter(p => yids.has(p.id));
      const ys = allSplits.filter(s => !!yt.find(t => t.id === s.tranche_id));
      const { data: dhany } = await supabase.from('users').select('full_name').ilike('full_name', '%dhany%').limit(1).single();
      await exportPengajuanIncentive({ year: filterYear, projects: yp, splits: ys, tranches: yt, managerName: (dhany?.full_name || 'Dhany Widya Putra') as string, directorName: 'Director PT. IVP' });
      notify('success', `Export ${filterYear} berhasil!`);
    } catch (err: unknown) { notify('error', 'Export gagal: ' + (err as Error).message); }
    setExporting(false);
  }

  async function handleExportSummary() {
    setExporting(true);
    try {
      const { data: dhany } = await supabase.from('users').select('id, full_name').ilike('full_name', '%dhany%').limit(1).single();
      const managerUserId = (dhany?.id || '') as string;
      const managerName   = (dhany?.full_name || 'Dhany Widya Putra') as string;
      // Fetch ALL troubleshooting tickets done in one call
      const { data: trouble } = await supabase.from('reminders').select('project_name, assigned_to, assign_name').eq('category', 'Troubleshooting').eq('status', 'done');
      const supportsMap = new Map<string, { user_id: string; user_name: string }[]>();
      for (const t of (trouble || []) as { project_name: string; assigned_to: string | null; assign_name: string | null }[]) {
        if (!t.assigned_to) continue;
        const arr = supportsMap.get(t.project_name) || [];
        if (!arr.find(x => x.user_id === t.assigned_to)) arr.push({ user_id: t.assigned_to, user_name: t.assign_name || '' });
        supportsMap.set(t.project_name, arr);
      }
      await exportSummaryIncentive({ projects, allUsers: allUsers as { id?: string; full_name?: string }[], supportsMap, managerName, managerUserId });
      notify('success', 'Export summary semua project berhasil!');
    } catch (err: unknown) { notify('error', 'Export gagal: ' + (err as Error).message); }
    setExporting(false);
  }

  async function handleMarkPaid(trancheId: string) {
    const { error } = await supabase.from('incentive_tranches').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', trancheId);
    if (error) { notify('error', error.message); return; }
    notify('success', 'Tranche ditandai Paid!'); loadAll();
    if (detailProject) openProjectDetail(detailProject);
  }

  async function handleToggleAllowInput(userId: string, current: boolean) {
    const { error } = await supabase.from('users').update({ allow_incentive_input: !current }).eq('id', userId);
    if (error) { notify('error', error.message); return; }
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, allow_incentive_input: !current } : u));
    notify('success', !current ? 'Akses diberikan' : 'Akses dicabut');
  }

  if (!appReady) return (
    <div className="flex items-center justify-center" style={{ minHeight: '100vh', backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="flex flex-col items-center gap-3 bg-white/90 rounded-2xl px-8 py-6 shadow-xl">
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#6366f1' }} />
        <p className="text-slate-500 text-sm font-semibold">Memuat Incentive PTS...</p>
      </div>
    </div>
  );

  const filteredProjects = projects.filter(p =>
    !searchProject || p.project_name.toLowerCase().includes(searchProject.toLowerCase()) || (p.assign_name || '').toLowerCase().includes(searchProject.toLowerCase())
  );
  const uniqueYears = [...new Set(tranches.map(t => t.payment_year))].sort();
  const filteredTranches = tranches.filter(t => !filterYear || t.payment_year === filterYear);
  const totalPool = projects.filter(p => (p.incentive_value || 0) > 0).reduce((s, p) => s + (p.incentive_value || 0), 0);
  const pendingNominal = projects.filter(p => !(p.incentive_value || 0)).length;
  const pendingTranche = tranches.filter(t => t.status === 'pending').length;

  const thCls = 'px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200';

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ fontFamily: "'Inter', sans-serif", backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>

      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 z-50"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '3px solid #6366f1', boxShadow: '0 2px 12px rgba(99,102,241,0.10)' }}>
        <div className="w-full px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg flex-shrink-0">💰</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-800">Incentive PTS</h1>
            <p className="text-[11px] text-gray-400">IndoVisual Professional Tools</p>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-right">
            <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total Pool</p><p className="text-sm font-black text-emerald-600">{formatRupiah(totalPool)}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Projects</p><p className="text-sm font-black text-indigo-600">{projects.length}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Pending Nominal</p><p className="text-sm font-black text-amber-600">{pendingNominal}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Pending Tranche</p><p className="text-sm font-black text-rose-600">{pendingTranche}</p></div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex-shrink-0 z-40"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
        <div className="w-full px-4 flex gap-1 overflow-x-auto">
          {([
            { id: 'projects', label: '📋 Projects',            adminOnly: false },
            { id: 'tranches', label: '📅 Tranche Schedule',    adminOnly: false },
            { id: 'late',     label: '🕐 Late Ticket Queue',   adminOnly: false },
            { id: 'settings', label: '⚙️ Pengaturan Akses',   adminOnly: true  },
          ] as { id: TabKey; label: string; adminOnly: boolean }[])
            .filter(t => !t.adminOnly || isAdmin(currentUser))
            .map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${tab === t.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#6366f1' }} />
          </div>
        )}

        {/* ─── Projects tab ─── */}
        {tab === 'projects' && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-gray-200 space-y-2">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <input value={searchProject} onChange={e => setSearchProject(e.target.value)}
                  placeholder="🔍 Cari project atau handler..."
                  className="flex-1 min-w-[180px] max-w-sm px-4 py-2 rounded-lg text-sm outline-none bg-gray-50 border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-indigo-400" />
                <div className="flex items-center gap-2 flex-wrap">
                  {canInputNominal(currentUser) && (
                    <span className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200">✏️ Kamu bisa input nominal</span>
                  )}
                  <button onClick={handleExportSummary} disabled={exporting}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-1.5">
                    {exporting ? <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-500 rounded-full animate-spin" /> : '📊'} Export Summary
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                <span className="font-bold text-gray-600">{filteredProjects.length}</span> project ·&nbsp;
                <span className="font-bold text-emerald-600">{filteredProjects.filter(p => (p.incentive_value||0)>0).length}</span> ada nominal ·&nbsp;
                <span className="font-bold text-amber-600">{filteredProjects.filter(p => !(p.incentive_value||0)).length}</span> belum isi nominal
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.10),rgba(139,92,246,0.07))' }}>
                    <th className={`${thCls} w-10 text-center`}>No</th>
                    <th className={`${thCls} min-w-[200px]`}>Project</th>
                    <th className={`${thCls} w-[130px]`}>Handler</th>
                    <th className={`${thCls} w-[140px]`}>Kategori</th>
                    <th className={`${thCls} w-[100px]`}>Mode</th>
                    <th className={`${thCls} w-[110px]`}>BAST</th>
                    <th className="px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200 w-[155px]">Nominal</th>
                    <th className="px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-200 w-[145px]">Bagian Handler</th>
                    <th className={`${thCls} w-[90px] text-center`}>Tranche</th>
                    <th className={`${thCls} w-[100px] text-center`}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-16 text-center border border-gray-200">
                      <p className="text-4xl mb-3">📭</p>
                      <p className="text-gray-500 font-medium">Belum ada project incentive</p>
                      <p className="text-gray-400 text-xs mt-1">Data muncul dari Reminder Schedule kategori Konfigurasi / Training yang sudah Completed</p>
                    </td></tr>
                  ) : filteredProjects.map((p, idx) => {
                    const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-indigo-50/30';
                    const cellCls = `border border-gray-200 px-3 py-2.5 ${rowBg}`;
                    const hasNominal = (p.incentive_value || 0) > 0;
                    const projTranches = tranches.filter(t => t.project_id === p.id);
                    const handlerSplit = calcHandlerSplit(p);
                    return (
                      <tr key={p.id} className="hover:bg-indigo-50/60 transition-colors cursor-pointer group" onClick={() => openProjectDetail(p)}>
                        <td className={`${cellCls} text-xs text-gray-400 text-center`}>{idx + 1}</td>
                        <td className={cellCls}>
                          <p className="font-semibold text-gray-800 leading-snug">{p.project_name}</p>
                          {p.product && <p className="text-[11px] text-indigo-500 mt-0.5 truncate max-w-[240px]">📦 {p.product}</p>}
                          {p.address && <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[240px]">📍 {p.address}</p>}
                        </td>
                        <td className={cellCls}>
                          <p className="text-sm font-medium text-gray-700">{p.assign_name || '—'}</p>
                          {p.pic_type === 'manager_pic' && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5 inline-block">Manager PIC</span>}
                        </td>
                        <td className={cellCls}>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">{p.category}</span>
                          {p.requires_controller_automation && (
                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">⚡{p.controller_automation_brand?.toUpperCase()}</span>
                          )}
                        </td>
                        <td className={cellCls}>
                          {p.mode_penyelesaian === 'onsite' && <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">🏢 Onsite</span>}
                          {p.mode_penyelesaian === 'remote' && (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">💻 Remote</span>
                              {p.installer_name && <p className="text-[10px] text-blue-600 mt-0.5 truncate max-w-[90px]">🔧 {p.installer_name}</p>}
                              {p.installer_daerah && <p className="text-[10px] text-gray-400 truncate max-w-[90px]">📍 {p.installer_daerah}</p>}
                            </div>
                          )}
                          {!p.mode_penyelesaian && <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className={cellCls}>
                          {p.bast_date
                            ? <p className="text-xs font-semibold text-gray-700">{new Date(p.bast_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            : <span className="text-xs text-amber-500 italic">Belum diisi</span>}
                        </td>
                        <td className={`${cellCls} text-right`}>
                          {hasNominal
                            ? <p className="text-sm font-black text-emerald-600">{formatRupiah(p.incentive_value || 0)}</p>
                            : <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">⏳ Belum</span>}
                        </td>
                        <td className={`${cellCls} text-right`}>
                          {handlerSplit ? (
                            <div>
                              <p className="text-sm font-black text-indigo-700">{formatRupiah(handlerSplit.amt)}</p>
                              <p className="text-[10px] text-gray-400">{handlerSplit.pct.toFixed(0)}% pool</p>
                            </div>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className={`${cellCls} text-center`}>
                          {projTranches.length > 0 ? (
                            <div className="flex gap-0.5 justify-center">
                              {projTranches.map(t => {
                                const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                                return <span key={t.id} title={`T${t.tranche_number} ${st.label}`} className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center" style={{ background: st.bg, color: st.color }}>{t.tranche_number}</span>;
                              })}
                            </div>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className={`${cellCls} text-center`} onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1 justify-center">
                            {canInputNominal(currentUser) && (
                              <button onClick={() => { setNominalProject(p); setNominalValue(String(p.incentive_value || '')); }}
                                title="Input Nominal"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all bg-white border-slate-200 text-indigo-500 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </button>
                            )}
                            {hasNominal && projTranches.length === 0 && p.bast_date && (
                              <button onClick={() => { setGenerateProject(p); setShowGenerateModal(true); }}
                                title="Generate Tranche"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all bg-white border-slate-200 text-blue-500 hover:bg-blue-50 hover:border-blue-300 hover:shadow-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {filteredProjects.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'rgba(99,102,241,0.06)' }}>
                      <td colSpan={6} className="px-3 py-2.5 border border-gray-200 text-xs font-bold text-gray-600 text-right">TOTAL</td>
                      <td className="px-3 py-2.5 border border-gray-200 text-right text-sm font-black text-emerald-700">{formatRupiah(totalPool)}</td>
                      <td className="px-3 py-2.5 border border-gray-200 text-right text-sm font-black text-indigo-700">
                        {formatRupiah(filteredProjects.reduce((s, p) => s + (calcHandlerSplit(p)?.amt || 0), 0))}
                      </td>
                      <td colSpan={2} className="border border-gray-200" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ─── Tranches tab ─── */}
        {tab === 'tranches' && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-2 items-center">
                <label className="text-xs font-bold text-gray-500">Tahun:</label>
                <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg text-sm border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                  {uniqueYears.length === 0 && <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
                </select>
              </div>
              <div className="flex gap-2">
                {isAdmin(currentUser) && (
                  <button onClick={() => { setBatchYear(filterYear); setBatchConfirm(true); }}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                    🚀 Process Batch {filterYear}
                  </button>
                )}
                <button onClick={handleExport} disabled={exporting}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                  {exporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '📄'} Export {filterYear}
                </button>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.10),rgba(139,92,246,0.07))' }}>
                      {['Project', 'Handler', 'Tranche', '%', 'Tahun Bayar', 'Status', 'Aksi'].map(h => (
                        <th key={h} className={thCls}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTranches.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center border border-gray-200">
                        <p className="text-3xl mb-2">📅</p>
                        <p className="text-gray-500 font-medium">Tidak ada tranche untuk tahun {filterYear}</p>
                      </td></tr>
                    ) : filteredTranches.map((t, idx) => {
                      const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                      const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-indigo-50/30';
                      return (
                        <tr key={t.id} className={`hover:bg-indigo-50/60 transition-colors ${rowBg}`}>
                          <td className="px-3 py-2.5 border border-gray-200">
                            <p className="font-bold text-gray-800">{t.project?.project_name || '—'}</p>
                            <p className="text-[10px] text-gray-400">{t.project?.category}</p>
                          </td>
                          <td className="px-3 py-2.5 border border-gray-200 text-sm text-gray-700">{t.project?.assign_name || '—'}</td>
                          <td className="px-3 py-2.5 border border-gray-200"><span className="px-2 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-600">T{t.tranche_number}</span></td>
                          <td className="px-3 py-2.5 border border-gray-200 font-bold text-gray-700">{t.percentage}%</td>
                          <td className="px-3 py-2.5 border border-gray-200 text-gray-600">{t.payment_year}</td>
                          <td className="px-3 py-2.5 border border-gray-200"><span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span></td>
                          <td className="px-3 py-2.5 border border-gray-200">
                            {t.status === 'processed' && isAdmin(currentUser) && (
                              <button onClick={() => handleMarkPaid(t.id)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition-all">✅ Tandai Paid</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── Late Ticket Queue tab ─── */}
        {tab === 'late' && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200" style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(234,88,12,0.05))' }}>
              <h2 className="font-bold text-gray-800">🕐 Late Ticket Queue</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ticket Troubleshooting yang masuk setelah cutoff project induk — dilampirkan ke tranche berikutnya yang belum dibayar.</p>
            </div>
            {lateTickets.length === 0
              ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-2xl mb-2">📭</p>
                  <p className="text-sm text-gray-500 italic">Belum ada late ticket yang dilampirkan.</p>
                </div>
              )
              : (
                <div className="divide-y divide-gray-100">
                  {lateTickets.map(lt => (
                    <div key={lt.id} className="px-5 py-3 flex items-center justify-between hover:bg-amber-50/40 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Tranche {lt.attached_tranche_number}</p>
                        <p className="text-xs text-gray-400">{new Date(lt.attached_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}{lt.note ? ` · ${lt.note}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-amber-700">{formatRupiah(lt.ticket_value || 0)}</span>
                        {lt.is_sunset && <span className="px-2 py-0.5 rounded text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200">Sunset</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* ─── Settings tab ─── */}
        {tab === 'settings' && isAdmin(currentUser) && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200" style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.05))' }}>
              <h2 className="font-bold text-gray-800">⚙️ Akses Input Nominal Incentive</h2>
              <p className="text-xs text-gray-400 mt-0.5">Pilih user marketing yang boleh mengisi nominal. Admin selalu bisa mengisi.</p>
            </div>
            <div className="divide-y divide-gray-100">
              {allUsers.filter(u => u.role === 'guest' || u.role === 'team').map(u => (
                <div key={u.id as string} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{u.full_name as string}</p>
                    <p className="text-xs text-gray-400">{u.username as string} · {u.role as string}{u.team_type ? ` · ${u.team_type}` : ''}</p>
                  </div>
                  <button onClick={() => handleToggleAllowInput(u.id as string, !!u.allow_incentive_input)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${u.allow_incentive_input ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-indigo-300'}`}>
                    {u.allow_incentive_input ? '✅ Diizinkan' : 'Izinkan'}
                  </button>
                </div>
              ))}
              {allUsers.filter(u => u.role === 'guest' || u.role === 'team').length === 0 && (
                <p className="px-5 py-4 text-sm text-gray-400 italic">Tidak ada user guest/team.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── MODAL: Input Nominal ─── */}
      {nominalProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4" onClick={e => { if (e.target === e.currentTarget) setNominalProject(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" style={{ border: '1.5px solid rgba(99,102,241,0.3)' }}>
            <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              <h3 className="text-base font-bold text-white">💰 Input Nominal Incentive</h3>
              <p className="text-xs text-indigo-200 mt-0.5 truncate">{nominalProject.project_name}</p>
            </div>
            <div className="p-5 space-y-4">
              {/* BAST — auto from reminder */}
              <div className="flex items-start justify-between gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-0.5">Tanggal BAST</p>
                  {nominalProject.bast_date
                    ? <p className="text-sm font-semibold text-gray-800">{new Date(nominalProject.bast_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    : <p className="text-xs text-amber-600 italic">Belum ada — diisi saat Handler klik Completed di Reminder Schedule</p>}
                </div>
                {nominalProject.bast_date && <span className="flex-shrink-0 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">Auto ✓</span>}
              </div>

              {/* Mode info */}
              {nominalProject.mode_penyelesaian && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${nominalProject.mode_penyelesaian === 'onsite' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {nominalProject.mode_penyelesaian === 'onsite' ? '🏢 Onsite' : '💻 Remote'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {nominalProject.pic_type === 'manager_pic'
                      ? `Manager PIC → ${nominalProject.mode_penyelesaian === 'onsite' ? '100%' : '85%'} handler`
                      : `Standard → ${nominalProject.mode_penyelesaian === 'onsite' ? '60%' : '51%'} handler`}
                  </span>
                </div>
              )}

              {/* Nominal */}
              <div>
                <label className="block text-xs font-bold mb-1.5 text-gray-500 uppercase tracking-widest">Nilai Incentive (Rp) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">Rp</span>
                  <input type="number" min={0} value={nominalValue} onChange={e => setNominalValue(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Contoh: 15000000" autoFocus />
                </div>
                {nominalValue && Number(nominalValue) > 0 && (
                  <div className="mt-2 p-3 rounded-xl bg-indigo-50 border border-indigo-100 space-y-1">
                    <p className="text-xs font-bold text-indigo-600">{formatRupiah(Number(nominalValue))}</p>
                    {nominalProject.mode_penyelesaian && (() => {
                      const split = calcHandlerSplit({ ...nominalProject, incentive_value: Number(nominalValue) });
                      return split ? <p className="text-[11px] text-gray-500">Bagian handler: <strong className="text-indigo-700">{formatRupiah(split.amt)}</strong> ({formatPct(split.pct)})</p> : null;
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => { setNominalProject(null); setNominalValue(''); }} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Batal</button>
              <button onClick={handleSaveNominal} disabled={savingNominal}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                {savingNominal && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Project Detail ─── */}
      {detailProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) setDetailProject(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 overflow-hidden border border-gray-200">
            <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{detailProject.project_name}</h2>
                  <p className="text-xs text-indigo-200 mt-0.5">{detailProject.assign_name} · {detailProject.category}</p>
                </div>
                <button onClick={() => setDetailProject(null)} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl p-3 text-center bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Total Pool</p>
                  <p className="text-base font-black text-emerald-700">{formatRupiah(detailProject.incentive_value || 0)}</p>
                </div>
                <div className="rounded-xl p-3 text-center bg-blue-50 border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Mode</p>
                  <p className="text-sm font-bold text-blue-700">{detailProject.mode_penyelesaian === 'onsite' ? '🏢 Onsite' : detailProject.mode_penyelesaian === 'remote' ? '💻 Remote' : '—'}</p>
                  {detailProject.mode_penyelesaian === 'remote' && detailProject.installer_name && (
                    <p className="text-[10px] text-blue-500 mt-0.5 font-medium">🔧 {detailProject.installer_name}{detailProject.installer_daerah ? ` · ${detailProject.installer_daerah}` : ''}</p>
                  )}
                </div>
                <div className="rounded-xl p-3 text-center bg-violet-50 border border-violet-100">
                  <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">BAST</p>
                  <p className="text-sm font-bold text-violet-700">{detailProject.bast_date ? new Date(detailProject.bast_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                </div>
              </div>

              {/* Pembagian Incentive — auto-calculated, selalu tampil */}
              {(() => {
                const pool = detailProject.incentive_value || 0;
                const effectiveMode = detailProject.mode_penyelesaian || 'onsite';
                const effectivePool = pool > 0 ? pool : 1_000_000;
                const isEstimate = pool <= 0 || !detailProject.mode_penyelesaian;
                const dhany = allUsers.find(u => (u.full_name as string || '').toLowerCase().includes('dhany'));
                const managerId   = (dhany?.id        || '') as string;
                const managerName = (dhany?.full_name || 'Dhany') as string;
                // Supervisor from Admin Panel DB mapping (pts_team_mappings), fallback to name-based
                const dbPtsMap = ptsTeamMappings.find(m => m.staff_user_id === detailProject.assigned_to);
                const supTeam = dbPtsMap ? null : getSupervisorTeamForPic(detailProject.assign_name);
                const supUser = dbPtsMap
                  ? allUsers.find(u => u.id === dbPtsMap.supervisor_user_id)
                  : supTeam ? allUsers.find(u => (u.full_name as string || '').toLowerCase().includes(supTeam)) : undefined;
                const supervisorId   = (supUser?.id        || '') as string;
                const supervisorName = (supUser?.full_name || 'Supervisor') as string;
                const displayProject: IncentiveProjectRow = { ...detailProject, incentive_value: effectivePool, mode_penyelesaian: effectiveMode };
                const splits = calculateIncentiveSplits(displayProject, managerId, managerName, supervisorId, supervisorName, detailSupports);
                if (!splits.length) return null;
                const schemeLabel = detailProject.pic_type === 'manager_pic' ? 'Manager sebagai PIC' : 'Standard';
                const modeLabel = effectiveMode === 'remote' ? 'Remote' : 'Onsite';
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-gray-700">💰 Pembagian Incentive</h3>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{schemeLabel} · {modeLabel}</span>
                        {isEstimate && <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Estimasi</span>}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {splits.map((s, i) => {
                        const rl = ROLE_LABELS[s.role] || { label: s.role, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
                        const isInstaller = s.role === 'installer';
                        return (
                          <div key={i} className="flex items-center justify-between rounded-xl px-4 py-2.5"
                            style={{ background: isInstaller ? 'rgba(245,158,11,0.07)' : 'rgba(99,102,241,0.05)', border: `1px solid ${isInstaller ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.12)'}` }}>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: rl.bg, color: rl.color }}>{rl.label}</span>
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{s.user_name || '—'}</p>
                                {isInstaller && detailProject.installer_daerah && (
                                  <p className="text-[10px] text-gray-400">📍 {detailProject.installer_daerah}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-gray-800">
                                {pool > 0 ? formatRupiah(s.amount) : '—'}
                              </p>
                              <p className="text-[10px] text-gray-400">{formatPct(s.percentage)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {isEstimate && (
                      <p className="text-[10px] text-amber-500 mt-1.5 italic">
                        {!pool
                          ? '* Belum ada nominal — angka Rp akan muncul setelah input nominal.'
                          : '* Mode belum diset (estimasi Onsite) — akan update setelah Handler klik Completed di Reminder Schedule.'}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">📅 Tranches</h3>
                {detailTranches.length === 0
                  ? <p className="text-xs text-gray-400 italic">Belum ada tranche.</p>
                  : detailTranches.map(t => {
                    const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                    const amt = (detailProject.incentive_value || 0) * (t.percentage / 100);
                    return (
                      <div key={t.id} className="flex items-center justify-between rounded-lg px-4 py-3 bg-gray-50 border border-gray-100 mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-gray-700">T{t.tranche_number}</span>
                          <span className="text-sm text-gray-600">{t.percentage}% · {formatRupiah(Math.round(amt))}</span>
                          <span className="text-xs text-gray-400">Tahun {t.payment_year}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                          {t.status === 'processed' && isAdmin(currentUser) && (
                            <button onClick={() => handleMarkPaid(t.id)} className="px-2 py-1 rounded text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 border border-emerald-200">Tandai Paid</button>
                          )}
                        </div>
                      </div>
                    );
                  })
                }
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">💰 Incentive Splits</h3>
                {detailSplits.length === 0
                  ? <p className="text-xs text-gray-400 italic">Belum ada split. Proses batch untuk generate.</p>
                  : detailSplits.map(s => {
                    const rl = ROLE_LABELS[s.role] || { label: s.role, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
                    return (
                      <div key={s.id} className="flex items-center justify-between rounded-lg px-4 py-2.5 bg-gray-50 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: rl.bg, color: rl.color }}>{rl.label}</span>
                          <span className="text-sm text-gray-700">{s.user_name || '—'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-800">{formatRupiah(s.amount || 0)}</span>
                          <span className="text-xs text-gray-400 ml-2">({formatPct(s.percentage)})</span>
                        </div>
                      </div>
                    );
                  })
                }
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-1">👥 Support (Auto dari Ticket Troubleshooting)</h3>
                {detailSupports.length === 0
                  ? <p className="text-xs text-gray-400 italic">Belum ada ticket Troubleshooting selesai untuk project ini.</p>
                  : detailSupports.map(s => (
                    <div key={s.user_id} className="flex items-center justify-between rounded-lg px-4 py-2 bg-gray-50 mb-1">
                      <span className="text-sm text-gray-700">{s.user_name || s.user_id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200">Troubleshooting</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Generate Tranche ─── */}
      {showGenerateModal && generateProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4" onClick={e => { if (e.target === e.currentTarget) { setShowGenerateModal(false); setGenerateProject(null); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">⚡ Generate Tranche</h3>
            <p className="text-sm text-gray-500 mb-1">Project: <strong className="text-gray-800">{generateProject.project_name}</strong></p>
            <p className="text-sm text-gray-500 mb-4">BAST: <strong>{generateProject.bast_date}</strong> · Pool: <strong className="text-emerald-600">{formatRupiah(generateProject.incentive_value || 0)}</strong></p>
            <div className="space-y-2 mb-6">
              {generateTranches(generateProject.id, generateProject.bast_date!, generateProject.mode_penyelesaian).map(t => {
                const isInstallerT3 = t.tranche_number === 3 && generateProject.mode_penyelesaian === 'remote';
                return (
                  <div key={t.tranche_number} className="flex justify-between rounded-lg px-4 py-2.5 border border-gray-100" style={{ background: isInstallerT3 ? 'rgba(245,158,11,0.07)' : 'rgb(249,250,251)' }}>
                    <div>
                      <span className="text-sm font-bold text-gray-700">Tranche {t.tranche_number}</span>
                      {isInstallerT3 && <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Installer (upfront)</span>}
                    </div>
                    <span className="text-sm text-gray-500">{t.percentage}% · Bayar {t.payment_year} · {formatRupiah(Math.round((generateProject.incentive_value || 0) * t.percentage / 100))}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowGenerateModal(false); setGenerateProject(null); }} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Batal</button>
              <button onClick={handleGenerateTranches} disabled={generating}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                {generating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Batch Confirm ─── */}
      {batchConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4" onClick={e => { if (e.target === e.currentTarget) setBatchConfirm(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-red-200">
            <h3 className="text-lg font-bold text-gray-800 mb-2">🚀 Konfirmasi Process Batch</h3>
            <p className="text-sm text-gray-500 mb-2">Proses semua tranche <strong>payment_year = {batchYear}</strong> status <strong>pending</strong>.</p>
            {(() => {
              const cnt = tranches.filter(t => t.payment_year === batchYear && t.status === 'pending').length;
              return cnt > 0
                ? <p className="text-sm font-bold text-indigo-600 mb-3">📋 {cnt} tranche siap diproses</p>
                : <p className="text-sm font-bold text-amber-600 mb-3">⚠️ Tidak ada tranche pending untuk tahun {batchYear}. Pastikan tranche sudah di-generate terlebih dahulu.</p>;
            })()}
            <div className="px-4 py-3 rounded-xl mb-4 bg-red-50 border border-red-200">
              <p className="text-xs font-bold text-red-600">⚠️ Aksi ini tidak bisa di-undo.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setBatchConfirm(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Batal</button>
              <button onClick={handleBatchProcess} disabled={batchProcessing}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                {batchProcessing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Proses Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
