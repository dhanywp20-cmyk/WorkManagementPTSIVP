'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import {
  IncentiveProjectRow, IncentiveTranche, IncentiveSplit, SupportAssignment, LateTicketLink,
  fetchIncentiveProjects, fetchTranches, fetchSplits, fetchSupportAssignments, fetchLateTickets,
  insertTranches, insertSplits, processYearlyBatch,
  calculateIncentiveSplits, validateSplitTotal, generateTranches,
  formatRupiah, formatPct,
  ROLE_LABELS, TRANCHE_STATUS,
} from './_components/calc';
import { exportPengajuanIncentive } from './_components/exportPengajuan';

// silence unused-import TS warnings for functions used only inside processYearlyBatch
void insertSplits; void calculateIncentiveSplits; void validateSplitTotal;

interface CurrentUser { id?: string; username?: string; full_name?: string; role?: string; team_type?: string; allow_incentive_input?: boolean; [k: string]: unknown; }

function isAdmin(u: CurrentUser | null) { const r = (u?.role || '').toLowerCase(); return r === 'admin' || r === 'superadmin'; }
function canInputNominal(u: CurrentUser | null) { return isAdmin(u) || !!u?.allow_incentive_input; }

type TabKey = 'projects' | 'tranches' | 'late_tickets' | 'settings';

export default function IncentivePTSPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [appReady, setAppReady] = useState(false);
  const [tab, setTab] = useState<TabKey>('projects');

  const [projects, setProjects] = useState<IncentiveProjectRow[]>([]);
  const [tranches, setTranches] = useState<(IncentiveTranche & { project: IncentiveProjectRow })[]>([]);
  const [allSplits, setAllSplits] = useState<IncentiveSplit[]>([]);
  const [lateTickets, setLateTickets] = useState<LateTicketLink[]>([]);
  const [allUsers, setAllUsers] = useState<CurrentUser[]>([]);
  const [supportUsers, setSupportUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [searchProject, setSearchProject] = useState('');

  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [batchYear, setBatchYear] = useState<number>(new Date().getFullYear());

  // Detail modal
  const [detailProject, setDetailProject] = useState<IncentiveProjectRow | null>(null);
  const [detailSplits, setDetailSplits] = useState<IncentiveSplit[]>([]);
  const [detailTranches, setDetailTranches] = useState<IncentiveTranche[]>([]);
  const [detailSupports, setDetailSupports] = useState<SupportAssignment[]>([]);

  // Nominal input modal
  const [nominalProject, setNominalProject] = useState<IncentiveProjectRow | null>(null);
  const [nominalValue, setNominalValue] = useState('');
  const [bastDateValue, setBastDateValue] = useState('');
  const [savingNominal, setSavingNominal] = useState(false);

  // Assign support
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportProject, setSupportProject] = useState<IncentiveProjectRow | null>(null);
  const [newSupportUserId, setNewSupportUserId] = useState('');
  const [newSupportDomain, setNewSupportDomain] = useState<'led' | 'middleware'>('led');

  // Generate tranche
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateProject, setGenerateProject] = useState<IncentiveProjectRow | null>(null);
  const [generating, setGenerating] = useState(false);

  const [exporting, setExporting] = useState(false);

  const notify = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    const u = getSession<CurrentUser>();
    if (!u) { window.location.href = '/dashboard'; return; }
    setCurrentUser(u);
    loadAll().then(() => setAppReady(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const { data: users } = await supabase.from('users').select('id, username, full_name, role, team_type, allow_incentive_input').order('full_name');
    if (users) {
      setAllUsers(users as CurrentUser[]);
      setSupportUsers((users as { id: string; full_name: string; team_type?: string }[]).filter(u => u.team_type === 'Team PTS IVP'));
    }
    setLoading(false);
  }

  async function openProjectDetail(p: IncentiveProjectRow) {
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

  async function handleSaveNominal() {
    if (!nominalProject) return;
    if (!nominalValue || Number(nominalValue) <= 0) { notify('error', 'Nominal incentive harus > 0'); return; }
    if (!bastDateValue) { notify('error', 'Tanggal BAST wajib diisi'); return; }
    setSavingNominal(true);
    const { error } = await supabase.from('reminders').update({
      incentive_value: Number(nominalValue),
      bast_date: bastDateValue,
      updated_at: new Date().toISOString(),
    }).eq('id', nominalProject.id);
    if (error) { notify('error', 'Gagal: ' + error.message); setSavingNominal(false); return; }
    notify('success', `Nominal Rp ${Number(nominalValue).toLocaleString('id-ID')} berhasil disimpan!`);
    setSavingNominal(false);
    setNominalProject(null);
    setNominalValue('');
    setBastDateValue('');
    loadAll();
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
    setBatchProcessing(false);
    setBatchConfirm(false);
    loadAll();
  }

  async function handleAddSupport() {
    if (!supportProject || !newSupportUserId) return;
    const user = allUsers.find(u => u.id === newSupportUserId);
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
      const yearSplits = allSplits.filter(s => !!yearTranches.find(t => t.id === s.tranche_id));
      const { data: dhany } = await supabase.from('users').select('full_name').ilike('full_name', '%dhany%').limit(1).single();
      await exportPengajuanIncentive({ year: filterYear, projects: yearProjects, splits: yearSplits, tranches: yearTranches, managerName: (dhany?.full_name || 'Dhany Widya Putra') as string, directorName: 'Director PT. IVP' });
      notify('success', `Export Pengajuan ${filterYear} berhasil!`);
    } catch (err: unknown) { notify('error', 'Export gagal: ' + (err as Error).message); }
    setExporting(false);
  }

  async function handleMarkTranchePaid(trancheId: string) {
    const { error } = await supabase.from('incentive_tranches').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', trancheId);
    if (error) { notify('error', error.message); return; }
    notify('success', 'Tranche ditandai Paid!');
    loadAll();
    if (detailProject) openProjectDetail(detailProject);
  }

  async function handleToggleAllowInput(userId: string, current: boolean) {
    const { error } = await supabase.from('users').update({ allow_incentive_input: !current }).eq('id', userId);
    if (error) { notify('error', error.message); return; }
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, allow_incentive_input: !current } : u));
    notify('success', !current ? 'Akses input nominal diberikan' : 'Akses input nominal dicabut');
  }

  if (!appReady) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh', backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="flex flex-col items-center gap-3 bg-white/90 rounded-2xl px-8 py-6 shadow-xl">
          <div className="w-8 h-8 rounded-full border-2 border-t-indigo-500 border-indigo-200 animate-spin" />
          <p className="text-sm font-semibold text-gray-600">Memuat Incentive PTS...</p>
        </div>
      </div>
    );
  }

  const filteredProjects = projects.filter(p => !searchProject || p.project_name.toLowerCase().includes(searchProject.toLowerCase()));
  const filteredTranches = tranches.filter(t => !filterYear || t.payment_year === filterYear);
  const uniqueYears = [...new Set(tranches.map(t => t.payment_year))].sort();
  const totalPool = projects.filter(p => (p.incentive_value || 0) > 0).reduce((s, p) => s + (p.incentive_value || 0), 0);
  const withNominal = projects.filter(p => (p.incentive_value || 0) > 0).length;
  const pendingNominal = projects.filter(p => !(p.incentive_value || 0)).length;
  const pendingTranches = tranches.filter(t => t.status === 'pending').length;

  const cardCls = 'bg-white rounded-2xl shadow-sm border border-gray-100';

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ fontFamily: "'Inter', sans-serif", backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>

      {/* Toast */}
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
            <p className="text-[11px] text-gray-400">Domain Ownership · Controller Automation · Tranche Management</p>
          </div>
          {/* KPI strip */}
          <div className="hidden sm:flex items-center gap-4 text-right">
            <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total Pool</p><p className="text-sm font-black text-emerald-600">{formatRupiah(totalPool)}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Projects</p><p className="text-sm font-black text-indigo-600">{projects.length}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Pending Nominal</p><p className="text-sm font-black text-amber-600">{pendingNominal}</p></div>
            <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Pending Tranche</p><p className="text-sm font-black text-rose-600">{pendingTranches}</p></div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex-shrink-0 z-40"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
        <div className="w-full px-4 flex gap-1 overflow-x-auto">
          {([
            { id: 'projects',     label: '📋 Project Overview',  adminOnly: false },
            { id: 'tranches',     label: '📅 Tranche Schedule',  adminOnly: false },
            { id: 'late_tickets', label: '🔗 Late Ticket Queue', adminOnly: false },
            { id: 'settings',     label: '⚙️ Pengaturan Akses',  adminOnly: true  },
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

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4 max-w-5xl mx-auto">
          {loading && (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 rounded-full border-2 border-t-indigo-500 border-indigo-200 animate-spin" />
            </div>
          )}

          {/* ═══ TAB: Projects ═══ */}
          {tab === 'projects' && !loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input value={searchProject} onChange={e => setSearchProject(e.target.value)}
                  placeholder="🔍 Cari project..."
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-indigo-400" />
              </div>

              {filteredProjects.length === 0 && (
                <div className={`${cardCls} p-10 text-center`}>
                  <p className="text-4xl mb-3">📊</p>
                  <p className="font-semibold text-gray-600">Belum ada project completed di kategori Konfigurasi / Training</p>
                </div>
              )}

              {filteredProjects.map(p => {
                const projectTranches = tranches.filter(t => t.project_id === p.id);
                const hasTranches = projectTranches.length > 0;
                const hasNominal = (p.incentive_value || 0) > 0;
                return (
                  <div key={p.id} className={`${cardCls} p-4 cursor-pointer hover:shadow-md transition-all`} onClick={() => openProjectDetail(p)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-gray-800 truncate">{p.project_name}</span>
                          {p.pic_type === 'manager_pic' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200">👤 Manager PIC</span>
                          )}
                          {p.requires_controller_automation && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">⚡ {p.controller_automation_brand?.toUpperCase() || 'Controller'}</span>
                          )}
                          {p.mode_penyelesaian && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200">
                              {p.mode_penyelesaian === 'onsite' ? '🏢 Onsite' : '🌐 Remote'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{p.assign_name} · {p.category} · {p.sales_name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {hasNominal
                          ? <p className="text-base font-black text-emerald-600">{formatRupiah(p.incentive_value || 0)}</p>
                          : <span className="px-2 py-1 rounded-full text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200">⏳ Nominal belum diisi</span>
                        }
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {hasTranches ? `${projectTranches.length} tranche` : 'No tranche'}
                        </p>
                      </div>
                    </div>

                    {hasTranches && (
                      <div className="flex gap-1 mt-3">
                        {projectTranches.map(t => {
                          const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                          return (
                            <div key={t.id} title={`T${t.tranche_number} (${t.percentage}%) - ${st.label}`}
                              className="flex-1 h-1.5 rounded-full" style={{ background: st.bg, border: `1px solid ${st.color}40` }}>
                              <div className="h-full rounded-full" style={{ width: '100%', background: st.color, opacity: 0.7 }} />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex gap-2 mt-3 flex-wrap" onClick={e => e.stopPropagation()}>
                      {canInputNominal(currentUser) && (
                        <button onClick={() => { setNominalProject(p); setNominalValue(String(p.incentive_value || '')); setBastDateValue(p.bast_date || ''); }}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 transition-all border border-indigo-200">
                          💰 {hasNominal ? 'Edit Nominal' : 'Input Nominal'}
                        </button>
                      )}
                      {hasNominal && !hasTranches && p.bast_date && (
                        <button onClick={() => { setGenerateProject(p); setShowGenerateModal(true); }}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-blue-600 hover:bg-blue-50 transition-all border border-blue-200">
                          ⚡ Generate Tranche
                        </button>
                      )}
                      <button onClick={() => { setSupportProject(p); setShowSupportModal(true); }}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-violet-600 hover:bg-violet-50 transition-all border border-violet-200">
                        👥 Assign Support
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ TAB: Tranches ═══ */}
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
                      className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                      🚀 Process Batch {filterYear}
                    </button>
                  )}
                  <button onClick={handleExport} disabled={exporting}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                    {exporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '📄'}
                    Export Pengajuan {filterYear}
                  </button>
                </div>
              </div>

              {filteredTranches.length === 0 && (
                <div className={`${cardCls} p-10 text-center`}>
                  <p className="text-4xl mb-3">📅</p>
                  <p className="font-semibold text-gray-600">Tidak ada tranche untuk tahun {filterYear}</p>
                </div>
              )}

              <div className={`${cardCls} overflow-x-auto`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Project', 'Tranche', '%', 'Tahun Bayar', 'Status', 'Aksi'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-bold tracking-widest uppercase text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTranches.map(t => {
                      const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                      return (
                        <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/70 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-bold text-gray-800 text-sm">{t.project?.project_name || '—'}</p>
                            <p className="text-[10px] text-gray-400">{t.project?.assign_name}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-600">T{t.tranche_number}</span>
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-700">{t.percentage}%</td>
                          <td className="px-4 py-3 text-gray-600">{t.payment_year}</td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            {t.status === 'processed' && isAdmin(currentUser) && (
                              <button onClick={() => handleMarkTranchePaid(t.id)}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition-all">
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

          {/* ═══ TAB: Late Tickets ═══ */}
          {tab === 'late_tickets' && !loading && (
            <div className="space-y-3">
              {lateTickets.length === 0 && (
                <div className={`${cardCls} p-10 text-center`}>
                  <p className="text-4xl mb-3">🔗</p>
                  <p className="font-semibold text-gray-600">Belum ada late ticket</p>
                  <p className="text-sm text-gray-400 mt-1">Ticket yang muncul setelah cutoff akan muncul di sini</p>
                </div>
              )}
              {lateTickets.map(lt => {
                const parentProject = projects.find(p => p.id === lt.parent_project_id);
                return (
                  <div key={lt.id} className={`${cardCls} p-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-800">Ticket → {parentProject?.project_name || lt.parent_project_id}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Attached to Tranche T{lt.attached_tranche_number}
                          {lt.is_sunset && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200">🌅 Sunset</span>}
                        </p>
                        {lt.note && <p className="text-xs text-gray-400 mt-1">{lt.note}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600">{formatRupiah(lt.ticket_value || 0)}</p>
                        <p className="text-[10px] text-gray-400">{new Date(lt.attached_at).toLocaleDateString('id-ID')}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ TAB: Settings ═══ */}
          {tab === 'settings' && isAdmin(currentUser) && !loading && (
            <div className="space-y-4">
              <div className={cardCls}>
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2">⚙️ Akses Input Nominal Incentive</h2>
                  <p className="text-xs text-gray-400 mt-1">Pilih user dari team marketing yang boleh mengisi nominal incentive. Admin selalu bisa mengisi.</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {allUsers.filter(u => (u.role === 'guest' || u.role === 'team')).map(u => (
                    <div key={u.id as string} className="flex items-center justify-between px-5 py-3">
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
            </div>
          )}
        </div>
      </div>

      {/* ═══ MODAL: Input Nominal ═══ */}
      {nominalProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4"
          onClick={e => { if (e.target === e.currentTarget) setNominalProject(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" style={{ border: '1.5px solid rgba(99,102,241,0.3)' }}>
            <h3 className="text-lg font-bold text-gray-800 mb-1">💰 Input Nominal Incentive</h3>
            <p className="text-sm text-gray-500 mb-5">{nominalProject.project_name}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-gray-500 uppercase tracking-widest">Nilai Incentive (Rp) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">Rp</span>
                  <input type="number" min={0} value={nominalValue} onChange={e => setNominalValue(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Contoh: 15000000" />
                </div>
                {nominalValue && Number(nominalValue) > 0 && (
                  <p className="text-xs text-indigo-600 mt-1 font-semibold">{formatRupiah(Number(nominalValue))}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-gray-500 uppercase tracking-widest">Tanggal BAST *</label>
                <input type="date" value={bastDateValue} onChange={e => setBastDateValue(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-400" />
                {bastDateValue && (
                  <p className="text-xs text-gray-400 mt-1">
                    Tranche: T1 bayar {new Date(bastDateValue).getFullYear()+1} · T2 bayar {new Date(bastDateValue).getFullYear()+2} · T3 bayar {new Date(bastDateValue).getFullYear()+3}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setNominalProject(null); setNominalValue(''); setBastDateValue(''); }}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Batal</button>
              <button onClick={handleSaveNominal} disabled={savingNominal}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                {savingNominal && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Project Detail ═══ */}
      {detailProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setDetailProject(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 overflow-hidden border border-gray-200">
            <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
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
                  <p className="text-base font-bold text-blue-700">{detailProject.mode_penyelesaian === 'onsite' ? '🏢 Onsite' : detailProject.mode_penyelesaian === 'remote' ? '🌐 Remote' : '—'}</p>
                </div>
                <div className="rounded-xl p-3 text-center bg-violet-50 border border-violet-100">
                  <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">BAST</p>
                  <p className="text-sm font-bold text-violet-700">{detailProject.bast_date || '—'}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">📅 Tranches</h3>
                {detailTranches.length === 0
                  ? <p className="text-xs text-gray-400 italic">Belum ada tranche. Generate setelah nominal & BAST diisi.</p>
                  : <div className="space-y-2">
                    {detailTranches.map(t => {
                      const st = TRANCHE_STATUS[t.status] || TRANCHE_STATUS.pending;
                      const amt = (detailProject.incentive_value || 0) * (t.percentage / 100);
                      return (
                        <div key={t.id} className="flex items-center justify-between rounded-lg px-4 py-3 bg-gray-50 border border-gray-100">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-gray-700">T{t.tranche_number}</span>
                            <span className="text-sm text-gray-600">{t.percentage}% · {formatRupiah(Math.round(amt))}</span>
                            <span className="text-xs text-gray-400">Tahun {t.payment_year}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                            {t.status === 'processed' && isAdmin(currentUser) && (
                              <button onClick={() => handleMarkTranchePaid(t.id)} className="px-2 py-1 rounded text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 border border-emerald-200">Tandai Paid</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                }
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">💰 Incentive Splits</h3>
                {detailSplits.length === 0
                  ? <p className="text-xs text-gray-400 italic">Belum ada split. Proses batch untuk generate.</p>
                  : <div className="space-y-2">
                    {detailSplits.map(s => {
                      const rl = ROLE_LABELS[s.role] || { label: s.role, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
                      return (
                        <div key={s.id} className="flex items-center justify-between rounded-lg px-4 py-2.5 bg-gray-50">
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
                    })}
                  </div>
                }
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">👥 Support Assignments</h3>
                {detailSupports.length === 0
                  ? <p className="text-xs text-gray-400 italic">Belum ada support yang di-assign.</p>
                  : <div className="space-y-1">
                    {detailSupports.map(s => (
                      <div key={s.id} className="flex items-center justify-between rounded-lg px-4 py-2 bg-gray-50">
                        <span className="text-sm text-gray-700">{s.user_name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200">{s.domain}</span>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Generate Tranche ═══ */}
      {showGenerateModal && generateProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4"
          onClick={e => { if (e.target === e.currentTarget) { setShowGenerateModal(false); setGenerateProject(null); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">⚡ Generate Tranche</h3>
            <p className="text-sm text-gray-500 mb-1">Project: <strong className="text-gray-800">{generateProject.project_name}</strong></p>
            <p className="text-sm text-gray-500 mb-4">BAST: <strong className="text-gray-800">{generateProject.bast_date}</strong> · Pool: <strong className="text-emerald-600">{formatRupiah(generateProject.incentive_value || 0)}</strong></p>
            <div className="space-y-2 mb-6">
              {generateTranches(generateProject.id, generateProject.bast_date!).map(t => (
                <div key={t.tranche_number} className="flex justify-between rounded-lg px-4 py-2.5 bg-gray-50 border border-gray-100">
                  <span className="text-sm font-bold text-gray-700">Tranche {t.tranche_number}</span>
                  <span className="text-sm text-gray-500">{t.percentage}% · Bayar {t.payment_year} · {formatRupiah(Math.round((generateProject.incentive_value || 0) * t.percentage / 100))}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowGenerateModal(false); setGenerateProject(null); }} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Batal</button>
              <button onClick={handleGenerateTranches} disabled={generating}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                {generating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Assign Support ═══ */}
      {showSupportModal && supportProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4"
          onClick={e => { if (e.target === e.currentTarget) { setShowSupportModal(false); setSupportProject(null); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">👥 Assign Support</h3>
            <p className="text-sm text-gray-500 mb-4">Project: <strong className="text-gray-800">{supportProject.project_name}</strong></p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-gray-500 uppercase tracking-widest">Team Member</label>
                <select value={newSupportUserId} onChange={e => setNewSupportUserId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm border border-gray-200 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">-- Pilih --</option>
                  {supportUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-gray-500 uppercase tracking-widest">Domain</label>
                <div className="flex gap-2">
                  {(['led', 'middleware'] as const).map(d => (
                    <button key={d} type="button" onClick={() => setNewSupportDomain(d)}
                      className="flex-1 px-3 py-2 rounded-xl text-sm font-bold transition-all border-2"
                      style={newSupportDomain === d ? { borderColor: '#7c3aed', background: 'rgba(124,58,237,0.08)', color: '#7c3aed' } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                      {d === 'led' ? '💡 LED' : '🔌 Middleware'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowSupportModal(false); setSupportProject(null); }} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Batal</button>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4"
          onClick={e => { if (e.target === e.currentTarget) setBatchConfirm(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-red-200">
            <h3 className="text-lg font-bold text-gray-800 mb-2">🚀 Konfirmasi Process Batch</h3>
            <p className="text-sm text-gray-500 mb-4">Proses SEMUA tranche <strong>payment_year = {batchYear}</strong> status <strong>pending</strong>. Pastikan data sudah benar.</p>
            <div className="px-4 py-3 rounded-xl mb-4 bg-red-50 border border-red-200">
              <p className="text-xs font-bold text-red-600">⚠️ Aksi ini tidak bisa di-undo. Splits akan di-generate dan tranche di-mark processed.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setBatchConfirm(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">Batal</button>
              <button onClick={handleBatchProcess} disabled={batchProcessing}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
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
