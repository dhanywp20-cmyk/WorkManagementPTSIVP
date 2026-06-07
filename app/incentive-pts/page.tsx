'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getSession, setSession, clearSession, startSessionWatcher } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  id?: string;
  username: string;
  full_name: string;
  role: string;
  team_type?: string;
  jabatan?: string;
  allow_incentive_input?: boolean;
  allowed_menus?: string[];
}

interface IncentiveSetting {
  id: string;
  handler_pct: number;
  backup_pct: number;
  updated_by?: string;
  updated_at?: string;
}

interface IncentiveProject {
  id: string;
  reminder_id?: string;
  project_name: string;
  category: string;
  sales_name?: string;
  sales_division?: string;
  due_date?: string;
  handler_name: string;
  handler_username?: string;
  backup_names: string[];
  biaya_cadangan: number;
  biaya_input_by?: string;
  biaya_input_at?: string;
  periode?: string;
  status: 'pending' | 'paid';
  paid_at?: string;
  paid_by?: string;
  created_at: string;
}

interface IncentiveDisbursement {
  id: string;
  project_id: string;
  person_name: string;
  person_username?: string;
  role_type: 'handler' | 'backup';
  pct: number;
  amount_rp: number;
  periode?: string;
}

interface ReminderRow {
  id: string;
  project_name: string;
  category: string;
  assign_name?: string;
  assigned_to?: string;
  sales_name?: string;
  sales_division?: string;
  due_date?: string;
  status?: string;
}

const INCENTIVE_CATEGORIES = ['Konfigurasi & Training', 'Training'];
const fmtRp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${Number(n).toFixed(1)}%`;
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtPeriode = (s?: string) => {
  if (!s) return '-';
  const [y, m] = s.split('-');
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  return `${months[parseInt(m)-1]} ${y}`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const map: Record<string, string> = {
    green: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border border-amber-200',
    blue: 'bg-blue-100 text-blue-700 border border-blue-200',
    gray: 'bg-gray-100 text-gray-600 border border-gray-200',
    red: 'bg-red-100 text-red-700 border border-red-200',
    purple: 'bg-purple-100 text-purple-700 border border-purple-200',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[color] ?? map.gray}`}>{children}</span>;
}

function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: color + '20' }}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function IncentivePTSPage() {
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'projects' | 'rekap' | 'history' | 'settings'>('projects');

  // Data
  const [settings, setSettings] = useState<IncentiveSetting | null>(null);
  const [projects, setProjects] = useState<IncentiveProject[]>([]);
  const [disbursements, setDisbursements] = useState<IncentiveDisbursement[]>([]);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);

  // Filters
  const [filterPeriode, setFilterPeriode] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQ, setSearchQ] = useState('');

  // Modals
  const [showBiayaModal, setShowBiayaModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<IncentiveProject | null>(null);

  // Settings form
  const [editHandlerPct, setEditHandlerPct] = useState('70');
  const [editBackupPct, setEditBackupPct] = useState('30');
  const [savingSettings, setSavingSettings] = useState(false);

  // Biaya form
  const [biayaInput, setBiayaInput] = useState('');
  const [savingBiaya, setSavingBiaya] = useState(false);

  // Backup form
  const [backupSelected, setBackupSelected] = useState<string[]>([]);
  const [savingBackup, setSavingBackup] = useState(false);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const notify = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };

  const isAdmin = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');
  const isTeamPTS = currentUser?.role === 'team';
  const canInputBiaya = isAdmin || currentUser?.allow_incentive_input === true;

  // ── Init ──
  useEffect(() => {
    const user = getSession<User>();
    if (!user) { window.location.href = '/dashboard'; return; }
    if (!['admin', 'superadmin', 'team'].includes(user.role?.toLowerCase() ?? '')) {
      window.location.href = '/dashboard'; return;
    }
    setCurrentUser(user);

    const q = searchParams.get('q');
    if (q) setSearchQ(q);

    const cleanup = startSessionWatcher();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetchAll();
  }, [currentUser]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchSettings(), fetchProjects(), fetchDisbursements(), fetchTeamUsers()]);
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('incentive_settings').select('*').limit(1).single();
    if (data) {
      setSettings(data);
      setEditHandlerPct(String(data.handler_pct));
      setEditBackupPct(String(data.backup_pct));
    }
  };

  const fetchProjects = async () => {
    let q = supabase.from('incentive_projects').select('*').order('created_at', { ascending: false });
    if (isTeamPTS && !isAdmin) {
      // team only sees projects where they are handler or backup
      q = q.or(`handler_name.eq.${currentUser!.full_name},backup_names.cs.{"${currentUser!.full_name}"}`);
    }
    const { data } = await q;
    setProjects(data ?? []);
  };

  const fetchDisbursements = async () => {
    let q = supabase.from('incentive_disbursements').select('*').order('created_at', { ascending: false });
    if (isTeamPTS && !isAdmin) {
      q = q.eq('person_name', currentUser!.full_name);
    }
    const { data } = await q;
    setDisbursements(data ?? []);
  };

  const fetchTeamUsers = async () => {
    const { data } = await supabase.from('users').select('username, full_name, role, team_type, jabatan')
      .eq('role', 'team').order('full_name');
    setTeamUsers(data ?? []);
  };

  // ── Sync from reminders ──
  const syncFromReminders = async () => {
    const { data: reminders } = await supabase
      .from('reminders')
      .select('id, project_name, category, assign_name, assigned_to, sales_name, sales_division, due_date, status')
      .in('category', INCENTIVE_CATEGORIES)
      .eq('status', 'done');

    if (!reminders?.length) { notify('error', 'Tidak ada data reminder baru untuk disync'); return; }

    const existingIds = projects.map(p => p.reminder_id).filter(Boolean);
    const newReminders = reminders.filter((r: ReminderRow) => !existingIds.includes(r.id));

    if (!newReminders.length) { notify('error', 'Semua reminder sudah tersync'); return; }

    const toInsert = newReminders.map((r: ReminderRow) => ({
      reminder_id: r.id,
      project_name: r.project_name,
      category: r.category,
      sales_name: r.sales_name,
      sales_division: r.sales_division,
      due_date: r.due_date,
      handler_name: r.assign_name ?? '',
      handler_username: r.assigned_to ?? '',
      backup_names: [],
      biaya_cadangan: 0,
      periode: r.due_date ? r.due_date.slice(0, 7) : new Date().toISOString().slice(0, 7),
      status: 'pending',
    }));

    const { error } = await supabase.from('incentive_projects').insert(toInsert);
    if (error) { notify('error', 'Gagal sync: ' + error.message); return; }
    notify('success', `${toInsert.length} project berhasil disync!`);
    fetchProjects();
  };

  // ── Save biaya cadangan ──
  const saveBiaya = async () => {
    if (!selectedProject) return;
    const biaya = parseFloat(biayaInput.replace(/\./g, '').replace(',', '.'));
    if (isNaN(biaya) || biaya <= 0) { notify('error', 'Biaya harus lebih dari 0'); return; }

    setSavingBiaya(true);
    const { error } = await supabase.from('incentive_projects').update({
      biaya_cadangan: biaya,
      biaya_input_by: currentUser?.full_name,
      biaya_input_at: new Date().toISOString(),
    }).eq('id', selectedProject.id);

    if (error) { notify('error', 'Gagal simpan biaya'); setSavingBiaya(false); return; }

    // Auto-create disbursements
    await createDisbursements({ ...selectedProject, biaya_cadangan: biaya });

    notify('success', 'Biaya tersimpan & incentive dikalkulasi!');
    setSavingBiaya(false);
    setShowBiayaModal(false);
    setBiayaInput('');
    fetchProjects();
    fetchDisbursements();
  };

  const createDisbursements = async (project: IncentiveProject) => {
    if (!settings || project.biaya_cadangan <= 0) return;

    // Delete existing disbursements for this project (recalculate)
    await supabase.from('incentive_disbursements').delete().eq('project_id', project.id);

    const handlerAmt = (project.biaya_cadangan * settings.handler_pct) / 100;
    const backupTotal = (project.biaya_cadangan * settings.backup_pct) / 100;
    const backupCount = project.backup_names.length;
    const backupPerPerson = backupCount > 0 ? backupTotal / backupCount : 0;

    const rows: Omit<IncentiveDisbursement, 'id' | 'created_at'>[] = [];

    // Handler
    rows.push({
      project_id: project.id,
      person_name: project.handler_name,
      person_username: project.handler_username,
      role_type: 'handler',
      pct: settings.handler_pct,
      amount_rp: handlerAmt,
      periode: project.periode,
    });

    // Backup
    for (const name of project.backup_names) {
      const u = teamUsers.find(u => u.full_name === name);
      rows.push({
        project_id: project.id,
        person_name: name,
        person_username: u?.username,
        role_type: 'backup',
        pct: backupCount > 0 ? settings.backup_pct / backupCount : 0,
        amount_rp: backupPerPerson,
        periode: project.periode,
      });
    }

    await supabase.from('incentive_disbursements').insert(rows);
  };

  // ── Save backup ──
  const saveBackup = async () => {
    if (!selectedProject) return;
    setSavingBackup(true);

    const { error } = await supabase.from('incentive_projects').update({
      backup_names: backupSelected,
    }).eq('id', selectedProject.id);

    if (error) { notify('error', 'Gagal simpan backup'); setSavingBackup(false); return; }

    // Recalculate disbursements if biaya already set
    if (selectedProject.biaya_cadangan > 0) {
      await createDisbursements({ ...selectedProject, backup_names: backupSelected });
    }

    notify('success', 'Tim backup diperbarui!');
    setSavingBackup(false);
    setShowBackupModal(false);
    fetchProjects();
    fetchDisbursements();
  };

  // ── Mark as paid ──
  const markPaid = async () => {
    if (!selectedProject) return;
    const { error } = await supabase.from('incentive_projects').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: currentUser?.full_name,
    }).eq('id', selectedProject.id);
    if (error) { notify('error', 'Gagal update status'); return; }
    notify('success', 'Project ditandai sebagai lunas!');
    setShowPaidModal(false);
    fetchProjects();
  };

  // ── Save settings ──
  const saveSettings = async () => {
    const h = parseFloat(editHandlerPct);
    const b = parseFloat(editBackupPct);
    if (isNaN(h) || isNaN(b) || h + b !== 100) { notify('error', 'Total handler + backup harus = 100%'); return; }
    setSavingSettings(true);
    const { error } = await supabase.from('incentive_settings').update({
      handler_pct: h, backup_pct: b, updated_by: currentUser?.full_name, updated_at: new Date().toISOString(),
    }).eq('id', settings!.id);
    if (error) { notify('error', 'Gagal simpan setting'); } else { notify('success', 'Setting tersimpan!'); fetchSettings(); }
    setSavingSettings(false);
  };

  // ── Derived data ──
  const periodeOptions = useMemo(() => {
    const set = new Set(projects.map(p => p.periode).filter(Boolean));
    return Array.from(set).sort().reverse() as string[];
  }, [projects]);

  const filteredProjects = useMemo(() => projects.filter(p => {
    if (filterPeriode !== 'all' && p.periode !== filterPeriode) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (searchQ && !p.project_name.toLowerCase().includes(searchQ.toLowerCase()) &&
      !p.handler_name.toLowerCase().includes(searchQ.toLowerCase()) &&
      !(p.sales_name ?? '').toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  }), [projects, filterPeriode, filterStatus, searchQ]);

  // Rekap per orang
  const rekapData = useMemo(() => {
    const filtered = disbursements.filter(d => {
      const proj = projects.find(p => p.id === d.project_id);
      if (!proj) return false;
      if (filterPeriode !== 'all' && d.periode !== filterPeriode) return false;
      return true;
    });
    const map: Record<string, { person_name: string; total_rp: number; count: number; handler_count: number; backup_count: number }> = {};
    for (const d of filtered) {
      if (!map[d.person_name]) map[d.person_name] = { person_name: d.person_name, total_rp: 0, count: 0, handler_count: 0, backup_count: 0 };
      map[d.person_name].total_rp += d.amount_rp;
      map[d.person_name].count += 1;
      if (d.role_type === 'handler') map[d.person_name].handler_count += 1;
      else map[d.person_name].backup_count += 1;
    }
    return Object.values(map).sort((a, b) => b.total_rp - a.total_rp);
  }, [disbursements, projects, filterPeriode]);

  const totalBiaya = filteredProjects.reduce((s, p) => s + p.biaya_cadangan, 0);
  const totalIncentive = rekapData.reduce((s, r) => s + r.total_rp, 0);
  const totalPaid = filteredProjects.filter(p => p.status === 'paid').length;

  // ─── Render ───────────────────────────────────────────────────────────────
  const inputCls = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';
  const btnPrimary = 'px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02]';

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#6366f1' }} />
        <p className="text-slate-500 text-sm font-semibold">Memuat Incentive PTS...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white flex items-center gap-2 transition-all ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg">💰</div>
          <div>
            <h1 className="text-base font-bold text-gray-800">Incentive PTS</h1>
            <p className="text-[11px] text-gray-400">IndoVisual Professional Tools</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={syncFromReminders}
              className={`${btnPrimary} flex items-center gap-1.5`}
              style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Sync Reminder
            </button>
          )}
          <div className="text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-xl">
            👤 {currentUser?.full_name}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="flex gap-1 overflow-x-auto">
          {([
            { id: 'projects', label: '📋 Projects', adminOnly: false },
            { id: 'rekap', label: '📊 Rekap Incentive', adminOnly: false },
            { id: 'history', label: '🕒 History', adminOnly: false },
            { id: 'settings', label: '⚙️ Settings', adminOnly: true },
          ] as { id: typeof activeTab; label: string; adminOnly: boolean }[])
            .filter(t => !t.adminOnly || isAdmin)
            .map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${activeTab === t.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
        </div>
      </div>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-5">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon="📋" label="Total Project" value={String(filteredProjects.length)} sub={`${totalPaid} sudah dibayar`} color="#6366f1" />
          <StatCard icon="💵" label="Total Biaya Cadangan" value={fmtRp(totalBiaya)} sub="Project terfilter" color="#0ea5e9" />
          <StatCard icon="💰" label="Total Incentive" value={fmtRp(totalIncentive)} sub="Terdistribusi" color="#10b981" />
          <StatCard icon="⏳" label="Menunggu Pembayaran" value={String(filteredProjects.filter(p => p.status === 'pending' && p.biaya_cadangan > 0).length)} sub="Project pending" color="#f59e0b" />
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Cari project, handler, sales..."
              className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400" />
          </div>
          <select value={filterPeriode} onChange={e => setFilterPeriode(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="all">Semua Periode</option>
            {periodeOptions.map(p => <option key={p} value={p}>{fmtPeriode(p)}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="all">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Lunas</option>
          </select>
        </div>

        {/* ══════════════════ TAB: PROJECTS ══════════════════ */}
        {activeTab === 'projects' && (
          <div className="space-y-3">
            {filteredProjects.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-gray-500 font-medium">Belum ada project incentive</p>
                {isAdmin && <p className="text-gray-400 text-sm mt-1">Klik "Sync Reminder" untuk mengambil data dari Reminder Schedule</p>}
              </div>
            ) : filteredProjects.map(proj => {
              const projDisb = disbursements.filter(d => d.project_id === proj.id);
              return (
                <div key={proj.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-gray-800 text-base">{proj.project_name}</h3>
                        <Badge color={proj.status === 'paid' ? 'green' : proj.biaya_cadangan > 0 ? 'amber' : 'gray'}>
                          {proj.status === 'paid' ? '✅ Lunas' : proj.biaya_cadangan > 0 ? '⏳ Pending' : '⚪ Belum ada biaya'}
                        </Badge>
                        <Badge color="purple">{proj.category}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                        <span>👤 Handler: <strong className="text-gray-700">{proj.handler_name}</strong></span>
                        {proj.sales_name && <span>🏢 Sales: <strong className="text-gray-700">{proj.sales_name}</strong></span>}
                        {proj.due_date && <span>📅 {fmtDate(proj.due_date)}</span>}
                        {proj.periode && <span>📆 {fmtPeriode(proj.periode)}</span>}
                        {proj.backup_names.length > 0 && (
                          <span>🤝 Backup: <strong className="text-gray-700">{proj.backup_names.join(', ')}</strong></span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      {proj.biaya_cadangan > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Biaya Cadangan</p>
                          <p className="text-base font-bold text-indigo-600">{fmtRp(proj.biaya_cadangan)}</p>
                        </div>
                      )}
                      {isAdmin && (
                        <button onClick={() => { setSelectedProject(proj); setBackupSelected(proj.backup_names); setShowBackupModal(true); }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200">
                          🤝 Backup
                        </button>
                      )}
                      {canInputBiaya && proj.status === 'pending' && (
                        <button onClick={() => { setSelectedProject(proj); setBiayaInput(proj.biaya_cadangan > 0 ? String(proj.biaya_cadangan) : ''); setShowBiayaModal(true); }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors border border-indigo-200">
                          💵 {proj.biaya_cadangan > 0 ? 'Edit Biaya' : 'Input Biaya'}
                        </button>
                      )}
                      {isAdmin && proj.status === 'pending' && proj.biaya_cadangan > 0 && (
                        <button onClick={() => { setSelectedProject(proj); setShowPaidModal(true); }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors border border-emerald-200">
                          ✅ Tandai Lunas
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Disbursement breakdown */}
                  {projDisb.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-2">💰 Distribusi Incentive</p>
                      <div className="flex flex-wrap gap-2">
                        {projDisb.map(d => (
                          <div key={d.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border ${d.role_type === 'handler' ? 'bg-indigo-50 border-indigo-200' : 'bg-blue-50 border-blue-200'}`}>
                            <span>{d.role_type === 'handler' ? '⭐' : '🤝'}</span>
                            <span className="font-semibold text-gray-700">{d.person_name}</span>
                            <span className={d.role_type === 'handler' ? 'text-indigo-600' : 'text-blue-600'}>{fmtPct(d.pct)}</span>
                            <span className="font-bold text-gray-800">{fmtRp(d.amount_rp)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════ TAB: REKAP ══════════════════ */}
        {activeTab === 'rekap' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-gray-800">📊 Rekap Incentive Per Orang</h2>
                {filterPeriode !== 'all' && <Badge color="blue">{fmtPeriode(filterPeriode)}</Badge>}
              </div>
              {rekapData.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-4xl mb-3">📊</p>
                  <p className="text-gray-500">Belum ada data rekap untuk periode ini</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {rekapData.map((r, i) => {
                    const myData = isTeamPTS && !isAdmin && r.person_name !== currentUser?.full_name;
                    if (myData) return null;
                    const personDisb = disbursements.filter(d => d.person_name === r.person_name &&
                      (filterPeriode === 'all' || d.periode === filterPeriode));
                    return (
                      <div key={r.person_name} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                              {i + 1}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800">{r.person_name}</p>
                              <p className="text-xs text-gray-400">{r.handler_count}x handler · {r.backup_count}x backup · {r.count} project total</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-indigo-600">{fmtRp(r.total_rp)}</p>
                            <p className="text-xs text-gray-400">{r.count} project</p>
                          </div>
                        </div>
                        {/* Detail per project */}
                        <div className="mt-3 space-y-1.5">
                          {personDisb.map(d => {
                            const proj = projects.find(p => p.id === d.project_id);
                            return (
                              <div key={d.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-xl px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span>{d.role_type === 'handler' ? '⭐' : '🤝'}</span>
                                  <span className="text-gray-700 font-medium">{proj?.project_name ?? '-'}</span>
                                  <Badge color={d.role_type === 'handler' ? 'purple' : 'blue'}>{d.role_type}</Badge>
                                  {proj?.status === 'paid' && <Badge color="green">Lunas</Badge>}
                                </div>
                                <div className="text-right">
                                  <span className="text-gray-500 mr-2">{fmtPct(d.pct)}</span>
                                  <span className="font-bold text-gray-800">{fmtRp(d.amount_rp)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ TAB: HISTORY ══════════════════ */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">🕒 History Pembayaran</h2>
            </div>
            {projects.filter(p => p.status === 'paid').length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-4xl mb-3">🕒</p>
                <p className="text-gray-500">Belum ada pembayaran yang diselesaikan</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {projects.filter(p => p.status === 'paid' &&
                  (filterPeriode === 'all' || p.periode === filterPeriode))
                  .map(proj => {
                    const projDisb = disbursements.filter(d => d.project_id === proj.id);
                    return (
                      <div key={proj.id} className="px-5 py-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                          <div>
                            <h3 className="font-bold text-gray-800">{proj.project_name}</h3>
                            <p className="text-xs text-gray-400">
                              Lunas: {fmtDate(proj.paid_at)} · oleh {proj.paid_by} · Periode: {fmtPeriode(proj.periode)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">Biaya Cadangan</p>
                            <p className="font-bold text-indigo-600">{fmtRp(proj.biaya_cadangan)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {projDisb.map(d => (
                            <div key={d.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border ${d.role_type === 'handler' ? 'bg-indigo-50 border-indigo-200' : 'bg-blue-50 border-blue-200'}`}>
                              <span>{d.role_type === 'handler' ? '⭐' : '🤝'}</span>
                              <span className="font-semibold text-gray-700">{d.person_name}</span>
                              <span className="text-gray-500">{fmtPct(d.pct)}</span>
                              <span className="font-bold text-emerald-600">{fmtRp(d.amount_rp)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ TAB: SETTINGS ══════════════════ */}
        {activeTab === 'settings' && isAdmin && (
          <div className="grid md:grid-cols-2 gap-5">
            {/* % Settings */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">⚙️ Pengaturan Persentase</h2>
              {settings && (
                <p className="text-xs text-gray-400">Terakhir diperbarui: {fmtDate(settings.updated_at)} oleh {settings.updated_by}</p>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  ⭐ Handler Utama (%)
                </label>
                <input type="number" value={editHandlerPct} min="0" max="100"
                  onChange={e => { setEditHandlerPct(e.target.value); setEditBackupPct(String(100 - parseFloat(e.target.value || '0'))); }}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  🤝 Backup Team (%) — dibagi rata ke semua backup
                </label>
                <input type="number" value={editBackupPct} min="0" max="100"
                  onChange={e => { setEditBackupPct(e.target.value); setEditHandlerPct(String(100 - parseFloat(e.target.value || '0'))); }}
                  className={inputCls} />
              </div>
              <div className={`p-3 rounded-xl text-sm font-semibold text-center ${parseFloat(editHandlerPct) + parseFloat(editBackupPct) === 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                Total: {(parseFloat(editHandlerPct || '0') + parseFloat(editBackupPct || '0')).toFixed(0)}% {parseFloat(editHandlerPct) + parseFloat(editBackupPct) === 100 ? '✅' : '❌ harus = 100%'}
              </div>
              <button onClick={saveSettings} disabled={savingSettings || parseFloat(editHandlerPct) + parseFloat(editBackupPct) !== 100}
                className={`${btnPrimary} w-full`} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                {savingSettings ? 'Menyimpan...' : '💾 Simpan Setting'}
              </button>
            </div>

            {/* Allow Input Biaya */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">👥 Izin Input Biaya Cadangan</h2>
              <p className="text-xs text-gray-400">User yang diizinkan menginput biaya cadangan selain Admin</p>
              <AllowBiayaList isAdmin={isAdmin} notify={notify} />
            </div>
          </div>
        )}
      </main>

      {/* ── Modal: Input Biaya ── */}
      {showBiayaModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">💵 Input Biaya Cadangan</h3>
            <div className="bg-indigo-50 rounded-xl p-3 text-sm">
              <p className="font-semibold text-indigo-700">{selectedProject.project_name}</p>
              <p className="text-indigo-500 text-xs">{selectedProject.category} · Handler: {selectedProject.handler_name}</p>
            </div>
            {settings && (
              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
                <p>⭐ Handler ({selectedProject.handler_name}): <strong className="text-gray-700">{fmtPct(settings.handler_pct)}</strong></p>
                {selectedProject.backup_names.length > 0 ? (
                  <p>🤝 Backup ({selectedProject.backup_names.length} orang, {fmtPct(settings.backup_pct / selectedProject.backup_names.length)} each):
                    <strong className="text-gray-700"> {selectedProject.backup_names.join(', ')}</strong></p>
                ) : (
                  <p className="text-amber-600">⚠️ Belum ada backup — 100% ke handler</p>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Biaya Cadangan (Rp)</label>
              <input type="text" value={biayaInput}
                onChange={e => setBiayaInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Contoh: 5000000"
                className={inputCls} />
              {biayaInput && settings && (
                <div className="mt-2 p-3 bg-indigo-50 rounded-xl space-y-1 text-xs">
                  <p className="font-semibold text-indigo-700">Preview distribusi:</p>
                  <p>⭐ {selectedProject.handler_name}: <strong>{fmtRp(parseFloat(biayaInput) * settings.handler_pct / 100)}</strong> ({fmtPct(settings.handler_pct)})</p>
                  {selectedProject.backup_names.length > 0 && selectedProject.backup_names.map(b => (
                    <p key={b}>🤝 {b}: <strong>{fmtRp(parseFloat(biayaInput) * settings.backup_pct / 100 / selectedProject.backup_names.length)}</strong> ({fmtPct(settings.backup_pct / selectedProject.backup_names.length)})</p>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowBiayaModal(false)} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">Batal</button>
              <button onClick={saveBiaya} disabled={savingBiaya} className={`flex-1 ${btnPrimary}`} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                {savingBiaya ? 'Menyimpan...' : '💾 Simpan & Kalkulasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Set Backup ── */}
      {showBackupModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">🤝 Set Tim Backup</h3>
            <div className="bg-blue-50 rounded-xl p-3 text-sm">
              <p className="font-semibold text-blue-700">{selectedProject.project_name}</p>
              <p className="text-blue-500 text-xs">Handler: {selectedProject.handler_name}</p>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {teamUsers.filter(u => u.full_name !== selectedProject.handler_name).map(u => (
                <label key={u.username} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${backupSelected.includes(u.full_name) ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                  <input type="checkbox" checked={backupSelected.includes(u.full_name)}
                    onChange={e => setBackupSelected(prev => e.target.checked ? [...prev, u.full_name] : prev.filter(n => n !== u.full_name))}
                    className="w-4 h-4 rounded accent-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{u.full_name}</p>
                    <p className="text-xs text-gray-400">{u.jabatan ?? u.team_type ?? u.role}</p>
                  </div>
                </label>
              ))}
            </div>
            {backupSelected.length > 0 && settings && (
              <p className="text-xs text-blue-600 bg-blue-50 rounded-xl px-3 py-2">
                🤝 {backupSelected.length} orang backup · masing-masing dapat {fmtPct(settings.backup_pct / backupSelected.length)} dari biaya cadangan
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowBackupModal(false)} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Batal</button>
              <button onClick={saveBackup} disabled={savingBackup} className={`flex-1 ${btnPrimary}`} style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}>
                {savingBackup ? 'Menyimpan...' : '💾 Simpan Backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Konfirmasi Lunas ── */}
      {showPaidModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-3xl mx-auto">✅</div>
            <h3 className="font-bold text-gray-800 text-lg">Tandai Lunas?</h3>
            <p className="text-sm text-gray-500">
              Project <strong className="text-gray-700">{selectedProject.project_name}</strong> akan ditandai sebagai <strong className="text-emerald-600">LUNAS</strong> dengan total incentive <strong className="text-indigo-600">{fmtRp(selectedProject.biaya_cadangan)}</strong>.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowPaidModal(false)} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Batal</button>
              <button onClick={markPaid} className={`flex-1 ${btnPrimary}`} style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                ✅ Konfirmasi Lunas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Allow Biaya List sub-component ─────────────────────────────────────────
function AllowBiayaList({ isAdmin, notify }: { isAdmin: boolean; notify: (t: 'success' | 'error', m: string) => void }) {
  const [users, setUsers] = useState<(User & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('users').select('id, full_name, role, allow_incentive_input')
      .in('role', ['guest', 'sales', 'team']).order('full_name')
      .then(({ data }) => { setUsers(data ?? []); setLoading(false); });
  }, []);

  const toggle = async (userId: string, current: boolean) => {
    const { error } = await supabase.from('users').update({ allow_incentive_input: !current }).eq('id', userId);
    if (error) { notify('error', 'Gagal update'); return; }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, allow_incentive_input: !current } : u));
    notify('success', 'Permission diperbarui!');
  };

  if (loading) return <p className="text-sm text-gray-400">Memuat...</p>;

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {users.map(u => (
        <div key={u.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${u.allow_incentive_input ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}>
          <div>
            <p className="text-sm font-semibold text-gray-700">{u.full_name}</p>
            <p className="text-xs text-gray-400 capitalize">{u.role}</p>
          </div>
          <button onClick={() => toggle(u.id!, !!u.allow_incentive_input)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${u.allow_incentive_input ? 'bg-indigo-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${u.allow_incentive_input ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Export with Suspense ────────────────────────────────────────────────────
export default function Page() {
  return (
    <Suspense>
      <IncentivePTSPage />
    </Suspense>
  );
}
