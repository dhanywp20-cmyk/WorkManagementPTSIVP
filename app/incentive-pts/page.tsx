'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useCurrentUser, isAdminRole } from '@/lib/use-current-user';
import {
  IncentiveProject, IncentiveTranche, IncentiveSplit, SupportAssignment, LateTicketLink,
  fetchIncentiveProjects, fetchTranches, fetchSplits, fetchSupportAssignments, fetchLateTickets,
  insertTranches, insertSplits, processYearlyBatch,
  calculateIncentiveSplits, validateSplitTotal, generateTranches,
  formatRupiah, formatPct,
  ROLE_LABELS, TRANCHE_STATUS,
} from './_components/shared';
import { exportPengajuanIncentive } from './_components/exportPengajuan';
import { LoadingScreen } from '@/components/shared';

type TabKey = 'projects' | 'tranches' | 'late_tickets';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'projects', label: 'Project Overview', icon: '📊' },
  { key: 'tranches', label: 'Tranche Schedule', icon: '📅' },
  { key: 'late_tickets', label: 'Late Ticket Queue', icon: '🔗' },
];

export default function IncentivePTSPage() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const isAdmin = isAdminRole(currentUser);

  const [appReady, setAppReady] = useState(false);
  const [tab, setTab] = useState<TabKey>('projects');
  const [projects, setProjects] = useState<IncentiveProject[]>([]);
  const [tranches, setTranches] = useState<(IncentiveTranche & { project: IncentiveProject })[]>([]);
  const [allSplits, setAllSplits] = useState<IncentiveSplit[]>([]);
  const [lateTickets, setLateTickets] = useState<LateTicketLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Filters
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [searchProject, setSearchProject] = useState('');

  // Batch processing state
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [batchYear, setBatchYear] = useState<number>(new Date().getFullYear());

  // Detail modal
  const [detailProject, setDetailProject] = useState<IncentiveProject | null>(null);
  const [detailSplits, setDetailSplits] = useState<IncentiveSplit[]>([]);
  const [detailTranches, setDetailTranches] = useState<IncentiveTranche[]>([]);
  const [detailSupports, setDetailSupports] = useState<SupportAssignment[]>([]);

  // Support assignment modal
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportProject, setSupportProject] = useState<IncentiveProject | null>(null);
  const [supportUsers, setSupportUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [newSupportUserId, setNewSupportUserId] = useState('');
  const [newSupportDomain, setNewSupportDomain] = useState<'led' | 'middleware'>('led');

  // Generate tranche modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateProject, setGenerateProject] = useState<IncentiveProject | null>(null);
  const [generating, setGenerating] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  // Team info (loaded from DB by jabatan)
  const [teamManager, setTeamManager] = useState<{ id: string; full_name: string } | null>(null);
  const [teamSupervisor, setTeamSupervisor] = useState<{ id: string; full_name: string } | null>(null);

  const notify = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    loadAll().then(() => setAppReady(true));
  }, []);

  async function loadAll() {
    setLoading(true);
    const [projRes, trancheRes, splitRes, lateRes] = await Promise.all([
      fetchIncentiveProjects(),
      fetchTranches(),
      fetchSplits(),
      fetchLateTickets(),
    ]);
    if (projRes.data) setProjects(projRes.data);
    if (trancheRes.data) setTranches(trancheRes.data);
    if (splitRes.data) setAllSplits(splitRes.data);
    if (lateRes.data) setLateTickets(lateRes.data);

    // Fetch PTS team users for support assignment
    const { data: users } = await supabase.from('users').select('id, full_name').in('team_type', ['Team PTS IVP']);
    if (users) setSupportUsers(users);

    // Lookup Manager dan Supervisor berdasarkan jabatan dari User Management
    const [{ data: mgr }, { data: sup }] = await Promise.all([
      supabase.from('users').select('id, full_name').eq('jabatan', 'Manager').eq('team_type', 'Team PTS IVP').limit(1).single(),
      supabase.from('users').select('id, full_name').eq('jabatan', 'Supervisor').eq('team_type', 'Team PTS IVP').limit(1).single(),
    ]);
    if (mgr) setTeamManager(mgr);
    if (sup) setTeamSupervisor(sup);

    setLoading(false);
  }

  async function openProjectDetail(p: IncentiveProject) {
    setDetailProject(p);
    const [splitsRes, tranchesRes, supportsRes] = await Promise.all([
      fetchSplits(p.id),
      supabase.from('incentive_tranches').select('*').eq('project_id', p.id).order('tranche_number'),
      fetchSupportAssignments(p.id),
    ]);
    setDetailSplits(splitsRes.data || []);
    setDetailTranches((tranchesRes.data || []) as IncentiveTranche[]);
    setDetailSupports(supportsRes.data || []);
  }

  async function handleGenerateTranches() {
    if (!generateProject?.bast_date) { notify('error', 'Tanggal BAST belum diisi!'); return; }
    setGenerating(true);
    const { error } = await insertTranches(generateProject.id, generateProject.bast_date);
    if (error) { notify('error', 'Gagal generate: ' + error.message); }
    else { notify('success', 'Tranche berhasil di-generate!'); }
    setGenerating(false);
    setShowGenerateModal(false);
    setGenerateProject(null);
    loadAll();
  }

  async function handleBatchProcess() {
    if (!currentUser) return;
    setBatchProcessing(true);
    // Gunakan data Manager & Supervisor dari state (sudah di-load berdasarkan jabatan)
    const managerId = teamManager?.id || currentUser.id || '';
    const managerName = teamManager?.full_name || 'Manager PTS IVP';
    const supervisorId = teamSupervisor?.id || '';
    const supervisorName = teamSupervisor?.full_name || '';

    const result = await processYearlyBatch(batchYear, managerId, managerName, supervisorId, supervisorName);
    if (result.error) {
      notify('error', 'Batch error: ' + result.error.message);
    } else {
      let msg = `Batch ${batchYear}: ${result.processed}/${result.total} tranche diproses.`;
      if (result.errors && result.errors.length > 0) msg += ` Errors: ${result.errors.join('; ')}`;
      notify(result.errors && result.errors.length > 0 ? 'error' : 'success', msg);
    }
    setBatchProcessing(false);
    setBatchConfirm(false);
    loadAll();
  }

  async function handleAddSupport() {
    if (!supportProject || !newSupportUserId) return;
    const user = supportUsers.find(u => u.id === newSupportUserId);
    const { error } = await supabase.from('ticket_support_assignment').insert([{
      project_id: supportProject.id,
      user_id: newSupportUserId,
      user_name: user?.full_name || '',
      domain: newSupportDomain,
      assigned_by: currentUser?.id || null,
    }]);
    if (error) { notify('error', 'Gagal: ' + error.message); return; }
    notify('success', 'Support assigned!');
    setNewSupportUserId('');
    if (detailProject?.id === supportProject.id) openProjectDetail(supportProject);
    loadAll();
  }

  async function handleExport() {
    setExporting(true);
    try {
      const yearTranches = tranches.filter(t => t.payment_year === filterYear && (t.status === 'processed' || t.status === 'paid'));
      const yearProjectIds = new Set(yearTranches.map(t => t.project_id));
      const yearProjects = projects.filter(p => yearProjectIds.has(p.id));
      const yearSplits = allSplits.filter(s => {
        const tranche = yearTranches.find(t => t.id === s.tranche_id);
        return !!tranche;
      });

      await exportPengajuanIncentive({
        year: filterYear,
        projects: yearProjects,
        splits: yearSplits,
        tranches: yearTranches,
        managerName: teamManager?.full_name || 'Manager PTS IVP',
        directorName: 'Direktur PT. IVP',
      });
      notify('success', `Export Pengajuan ${filterYear} berhasil!`);
    } catch (err: any) {
      notify('error', 'Export gagal: ' + err.message);
    }
    setExporting(false);
  }

  async function handleMarkTranchePaid(trancheId: string) {
    const { error } = await supabase.from('incentive_tranches').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', trancheId);
    if (error) { notify('error', error.message); return; }
    notify('success', 'Tranche ditandai Paid!');
    loadAll();
    if (detailProject) openProjectDetail(detailProject);
  }

  if (!appReady) return <LoadingScreen />;

  // ─── Filtered data ──────────────────────────────────────────────────────────
  const filteredProjects = projects.filter(p =>
    (!searchProject || p.project_name.toLowerCase().includes(searchProject.toLowerCase()))
  );

  const filteredTranches = tranches.filter(t =>
    (!filterYear || t.payment_year === filterYear)
  );

  const uniqueYears = [...new Set(tranches.map(t => t.payment_year))].sort();

  // ─── KPI summary ───────────────────────────────────────────────────────────
  const totalPool = projects.reduce((s, p) => s + (p.incentive_value || 0), 0);
  const totalProjects = projects.length;
  const pendingTranches = tranches.filter(t => t.status === 'pending').length;
  const processedTranches = tranches.filter(t => t.status === 'processed').length;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)' }}>
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">💰 Incentive PTS</h1>
            <p className="text-slate-400 text-sm mt-1">Domain Ownership · Controller Automation · Tranche Management</p>
          </div>
          <button onClick={() => router.push('/dashboard')}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all">
            ← Dashboard
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Total Pool', value: formatRupiah(totalPool), icon: '💵', color: '#10b981' },
            { label: 'Projects', value: String(totalProjects), icon: '📁', color: '#3b82f6' },
            { label: 'Pending Tranche', value: String(pendingTranches), icon: '⏳', color: '#f59e0b' },
            { label: 'Processed', value: String(processedTranches), icon: '✅', color: '#8b5cf6' },
          ].map(k => (
            <div key={k.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{k.icon}</span>
                <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400">{k.label}</p>
              </div>
              <p className="text-xl font-black mt-1" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={tab === t.key
                ? { background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }
                : { color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mx-6 mb-3 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700' : 'bg-red-900/50 text-red-300 border border-red-700'}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Content */}
      <div className="px-6 pb-8">
        {loading && <div className="flex justify-center py-10"><div className="w-8 h-8 rounded-full border-2 border-t-blue-400 border-blue-800 animate-spin" /></div>}

        {/* ═══ TAB: Projects ═══ */}
        {tab === 'projects' && !loading && (
          <div className="space-y-3">
            {/* Search + info row */}
            <div className="flex items-center gap-3">
              <input value={searchProject} onChange={e => setSearchProject(e.target.value)}
                placeholder="Cari project..."
                className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} />
              <div className="text-[11px] text-slate-500 whitespace-nowrap">
                {teamSupervisor && <span className="mr-3">SPV: <span className="text-blue-300 font-semibold">{teamSupervisor.full_name}</span></span>}
                {teamManager && <span>MGR: <span className="text-emerald-300 font-semibold">{teamManager.full_name}</span></span>}
              </div>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <p className="text-4xl mb-3">📊</p>
                <p className="font-semibold">Belum ada project dengan incentive</p>
                <p className="text-sm mt-1">Tambahkan nilai incentive di Reminder Schedule untuk memulai</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                  <thead>
                    <tr>
                      {['No', 'Project', 'PIC', 'Pool (Rp)', 'Execution', 'BAST', 'Tranche', 'Aksi'].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-[10px] font-bold tracking-widest uppercase text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((p, idx) => {
                      const projectTranches = tranches.filter(t => t.project_id === p.id);
                      const hasTranches = projectTranches.length > 0;
                      return (
                        <tr key={p.id} className="group cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)' }}
                          onClick={() => openProjectDetail(p)}>
                          <td className="px-3 py-3 rounded-l-xl text-slate-500 text-xs">{idx + 1}</td>
                          <td className="px-3 py-3 max-w-[220px]">
                            <p className="font-bold text-white text-sm leading-snug truncate">{p.project_name}</p>
                            <div className="flex gap-1 flex-wrap mt-0.5">
                              {p.pic_type === 'manager_pic' && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-300" style={{ background: 'rgba(245,158,11,0.2)' }}>MGR PIC</span>
                              )}
                              {p.requires_controller_automation && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-emerald-300" style={{ background: 'rgba(16,185,129,0.2)' }}>⚡ {p.controller_automation_brand?.toUpperCase()}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-slate-200 text-xs font-semibold">{p.assign_name}</p>
                            <p className="text-slate-500 text-[10px]">{p.category}</p>
                          </td>
                          <td className="px-3 py-3 font-black text-emerald-400">{formatRupiah(p.incentive_value || 0)}</td>
                          <td className="px-3 py-3">
                            {p.execution_mode ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold text-blue-300" style={{ background: 'rgba(59,130,246,0.15)' }}>
                                {p.execution_mode === 'onsite' ? '🏢' : '🌐'} {p.execution_mode}
                              </span>
                            ) : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-3 text-slate-400 text-xs">{p.bast_date || '—'}</td>
                          <td className="px-3 py-3">
                            {hasTranches ? (
                              <div className="flex gap-0.5">
                                {projectTranches.map(t => {
                                  const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                                  return (
                                    <div key={t.id} title={`T${t.tranche_number} (${t.percentage}%) - ${st.label}`}
                                      className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black"
                                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}40` }}>
                                      {t.tranche_number}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : <span className="text-slate-600 text-[10px]">No tranche</span>}
                          </td>
                          <td className="px-3 py-3 rounded-r-xl" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              {/* View — semua role */}
                              <button onClick={() => openProjectDetail(p)} title="Lihat Detail"
                                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all text-blue-400 hover:bg-blue-500/20">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                              </button>
                              {/* Generate Tranche — admin only */}
                              {isAdmin && !hasTranches && p.bast_date && (
                                <button onClick={() => { setGenerateProject(p); setShowGenerateModal(true); }} title="Generate Tranche"
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all text-amber-400 hover:bg-amber-500/20">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                </button>
                              )}
                              {/* Assign Support — admin only */}
                              {isAdmin && (
                                <button onClick={() => { setSupportProject(p); setShowSupportModal(true); }} title="Assign Support"
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all text-violet-400 hover:bg-violet-500/20">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: Tranche Schedule ═══ */}
        {tab === 'tranches' && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-2 items-center">
                <label className="text-xs font-bold text-slate-400">Tahun:</label>
                <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                  {uniqueYears.length === 0 && <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
                </select>
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <button onClick={() => { setBatchYear(filterYear); setBatchConfirm(true); }}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2 hover:scale-[1.02] transition-all"
                    style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}>
                    🚀 Process Batch {filterYear}
                  </button>
                )}
                <button onClick={handleExport} disabled={exporting}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#059669,#047857)', boxShadow: '0 4px 14px rgba(5,150,105,0.35)' }}>
                  {exporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '📄'}
                  Export Pengajuan {filterYear}
                </button>
              </div>
            </div>

            {filteredTranches.length === 0 && (
              <div className="text-center py-10 text-slate-500">
                <p className="text-4xl mb-3">📅</p>
                <p className="font-semibold">Tidak ada tranche untuk tahun {filterYear}</p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                <thead>
                  <tr>
                    {['Project', 'Tranche', '%', 'Tahun Bayar', 'Status', 'Aksi'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold tracking-widest uppercase text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTranches.map(t => {
                    const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                    const proj = t.project;
                    return (
                      <tr key={t.id} className="rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <td className="px-4 py-3 rounded-l-xl">
                          <p className="font-bold text-white text-sm truncate max-w-[200px]">{proj?.project_name || '—'}</p>
                          <p className="text-[10px] text-slate-500">{proj?.assign_name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(255,255,255,0.08)', color: '#e2e8f0' }}>
                            T{t.tranche_number}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-white">{t.percentage}%</td>
                        <td className="px-4 py-3 text-slate-300">{t.payment_year}</td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: st.bg, color: st.color }}>
                            {st.icon} {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 rounded-r-xl">
                          {t.status === 'processed' && isAdmin && (
                            <button onClick={() => handleMarkTranchePaid(t.id)}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20 transition-all" style={{ border: '1px solid rgba(16,185,129,0.3)' }}>
                              ✅ Tandai Paid
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ TAB: Late Ticket Queue ═══ */}
        {tab === 'late_tickets' && !loading && (
          <div className="space-y-4">
            {lateTickets.length === 0 && (
              <div className="text-center py-10 text-slate-500">
                <p className="text-4xl mb-3">🔗</p>
                <p className="font-semibold">Belum ada late ticket</p>
                <p className="text-sm mt-1">Ticket troubleshooting yang muncul setelah cutoff akan muncul di sini</p>
              </div>
            )}
            {lateTickets.map(lt => {
              const parentProject = projects.find(p => p.id === lt.parent_project_id);
              return (
                <div key={lt.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">Ticket → {parentProject?.project_name || lt.parent_project_id}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Attached to Tranche T{lt.attached_tranche_number}
                        {lt.is_sunset && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-300 bg-amber-500/20">🌅 Sunset — Siklus Independen</span>}
                      </p>
                      {lt.note && <p className="text-xs text-slate-500 mt-1">{lt.note}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-400">{formatRupiah(lt.ticket_value || 0)}</p>
                      <p className="text-[10px] text-slate-500">{new Date(lt.attached_at).toLocaleDateString('id-ID')}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ MODAL: Project Detail ═══ */}
      {detailProject && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[110] p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setDetailProject(null); }}>
          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl my-4 overflow-hidden" style={{ border: '1.5px solid rgba(255,255,255,0.1)' }}>
            <div className="px-6 py-5 rounded-t-2xl" style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{detailProject.project_name}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-blue-200">{detailProject.assign_name} · {detailProject.category}</span>
                    {detailProject.pic_type === 'manager_pic' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-300 bg-amber-500/20">👤 Manager PIC</span>}
                    {detailProject.requires_controller_automation && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-300 bg-emerald-500/20">⚡ {detailProject.controller_automation_brand?.toUpperCase()}</span>}
                  </div>
                </div>
                <button onClick={() => setDetailProject(null)} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">
              {/* Pool info */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Total Pool</p>
                  <p className="text-lg font-black text-emerald-300">{formatRupiah(detailProject.incentive_value || 0)}</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Execution</p>
                  <p className="text-lg font-bold text-blue-300">{detailProject.execution_mode === 'onsite' ? '🏢 Onsite' : detailProject.execution_mode === 'remote' ? '🌐 Remote' : '—'}</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">BAST</p>
                  <p className="text-sm font-bold text-violet-300">{detailProject.bast_date || '—'}</p>
                </div>
              </div>

              {/* Team info row */}
              {(teamSupervisor || teamManager) && (
                <div className="grid grid-cols-2 gap-3">
                  {teamSupervisor && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(3,105,161,0.1)', border: '1px solid rgba(3,105,161,0.2)' }}>
                      <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Supervisor</p>
                      <p className="text-sm font-bold text-sky-200 mt-0.5">{teamSupervisor.full_name}</p>
                    </div>
                  )}
                  {teamManager && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.2)' }}>
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Manager</p>
                      <p className="text-sm font-bold text-emerald-200 mt-0.5">{teamManager.full_name}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tranches */}
              <div>
                <h3 className="text-sm font-bold text-white mb-2">📅 Tranches</h3>
                {detailTranches.length === 0 ? (
                  <p className="text-xs text-slate-500">Belum ada tranche. Generate setelah BAST date diisi.</p>
                ) : (
                  <div className="space-y-2">
                    {detailTranches.map(t => {
                      const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                      const trancheAmount = (detailProject.incentive_value || 0) * (t.percentage / 100);
                      return (
                        <div key={t.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-white">T{t.tranche_number}</span>
                            <span className="text-sm text-slate-300">{t.percentage}% · {formatRupiah(Math.round(trancheAmount))}</span>
                            <span className="text-xs text-slate-500">Tahun {t.payment_year}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                            {t.status === 'processed' && isAdmin && (
                              <button onClick={() => handleMarkTranchePaid(t.id)}
                                className="px-2 py-1 rounded text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/20" style={{ border: '1px solid rgba(16,185,129,0.3)' }}>
                                Tandai Paid
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Splits */}
              <div>
                <h3 className="text-sm font-bold text-white mb-2">💰 Incentive Splits</h3>
                {detailSplits.length === 0 ? (
                  <p className="text-xs text-slate-500">Belum ada split. Proses batch untuk generate.</p>
                ) : (
                  <div className="space-y-2">
                    {detailSplits.map(s => {
                      const rl = ROLE_LABELS[s.role] || { label: s.role, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
                      return (
                        <div key={s.id} className="flex items-center justify-between rounded-lg px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: rl.bg, color: rl.color }}>{rl.label}</span>
                            <span className="text-sm text-slate-300">{s.user_name || '—'}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-white">{formatRupiah(s.amount || 0)}</span>
                            <span className="text-xs text-slate-500 ml-2">({formatPct(s.percentage)})</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Support Assignments */}
              <div>
                <h3 className="text-sm font-bold text-white mb-2">👥 Support Assignments</h3>
                {detailSupports.length === 0 ? (
                  <p className="text-xs text-slate-500">Belum ada support yang di-assign.</p>
                ) : (
                  <div className="space-y-1">
                    {detailSupports.map(s => (
                      <div key={s.id} className="flex items-center justify-between rounded-lg px-4 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <span className="text-sm text-slate-300">{s.user_name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold text-violet-300 bg-violet-500/20">{s.domain}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Generate Tranche ═══ */}
      {showGenerateModal && generateProject && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[120] p-4"
          onClick={e => { if (e.target === e.currentTarget) { setShowGenerateModal(false); setGenerateProject(null); } }}>
          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6" style={{ border: '1.5px solid rgba(59,130,246,0.3)' }}>
            <h3 className="text-lg font-bold text-white mb-4">⚡ Generate Tranche</h3>
            <p className="text-sm text-slate-400 mb-4">Project: <strong className="text-white">{generateProject.project_name}</strong></p>
            <p className="text-sm text-slate-400 mb-2">BAST Date: <strong className="text-white">{generateProject.bast_date}</strong></p>
            <div className="space-y-2 mb-6">
              {generateTranches(generateProject.id, generateProject.bast_date!).map(t => (
                <div key={t.tranche_number} className="flex justify-between rounded-lg px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-sm text-white font-bold">Tranche {t.tranche_number}</span>
                  <span className="text-sm text-slate-300">{t.percentage}% · Bayar {t.payment_year}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowGenerateModal(false); setGenerateProject(null); }}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-slate-400" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Batal</button>
              <button onClick={handleGenerateTranches} disabled={generating}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
                {generating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Assign Support ═══ */}
      {showSupportModal && supportProject && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[120] p-4"
          onClick={e => { if (e.target === e.currentTarget) { setShowSupportModal(false); setSupportProject(null); } }}>
          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6" style={{ border: '1.5px solid rgba(124,58,237,0.3)' }}>
            <h3 className="text-lg font-bold text-white mb-4">👥 Assign Support</h3>
            <p className="text-sm text-slate-400 mb-4">Project: <strong className="text-white">{supportProject.project_name}</strong></p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-400 uppercase tracking-widest">Team Member</label>
                <select value={newSupportUserId} onChange={e => setNewSupportUserId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <option value="">-- Pilih --</option>
                  {supportUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-400 uppercase tracking-widest">Domain</label>
                <div className="flex gap-2">
                  {(['led', 'middleware'] as const).map(d => (
                    <button key={d} type="button" onClick={() => setNewSupportDomain(d)}
                      className="flex-1 px-3 py-2 rounded-xl text-sm font-bold transition-all"
                      style={newSupportDomain === d
                        ? { background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.4)' }
                        : { color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {d === 'led' ? '💡 LED' : '🔌 Middleware'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowSupportModal(false); setSupportProject(null); }}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-slate-400" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Batal</button>
              <button onClick={handleAddSupport} disabled={!newSupportUserId}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                ✅ Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Batch Confirm ═══ */}
      {batchConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[120] p-4"
          onClick={e => { if (e.target === e.currentTarget) setBatchConfirm(false); }}>
          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6" style={{ border: '1.5px solid rgba(239,68,68,0.3)' }}>
            <h3 className="text-lg font-bold text-white mb-2">🚀 Konfirmasi Process Batch</h3>
            <p className="text-sm text-slate-400 mb-4">
              Ini akan memproses SEMUA tranche dengan <strong className="text-white">payment_year = {batchYear}</strong> dan status <strong className="text-white">pending</strong>.
              Ini adalah trigger pembayaran finansial — pastikan data sudah benar.
            </p>
            <div className="px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-xs font-bold text-red-400">⚠️ Aksi ini tidak bisa di-undo. Splits akan di-generate dan tranche di-mark sebagai processed.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setBatchConfirm(false)}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-slate-400" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Batal</button>
              <button onClick={handleBatchProcess} disabled={batchProcessing}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
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
