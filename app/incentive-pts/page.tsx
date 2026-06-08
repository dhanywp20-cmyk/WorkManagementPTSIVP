'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getSession, startSessionWatcher } from '@/lib/auth';
import * as XLSX from 'xlsx';

import { User, IncentiveSetting, IncentiveProject, IncentiveDisbursement, ReminderRow, RekapItem } from './_components/types';
import { INCENTIVE_CATEGORIES, StatCard, fmtRp, fmtPct, fmtPeriode } from './_components/shared';
import { ProjectsTab }  from './_components/ProjectsTab';
import { RekapTab }     from './_components/RekapTab';
import { HistoryTab }   from './_components/HistoryTab';
import { SettingsTab }  from './_components/SettingsTab';
import { ViewModal, BiayaModal, BackupModal, PaidModal } from './_components/Modals';

// ─── Safe top-window redirect (works inside iframe too) ──────────────────────
function topRedirect(url: string) {
  const target = (window.top && window.top !== window) ? window.top : window;
  target.location.href = url;
}

// ─── Main Component ───────────────────────────────────────────────────────────
function IncentivePTSPage() {
  const searchParams = useSearchParams();

  // ── Auth / user ──
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading]         = useState(true);

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<'projects' | 'rekap' | 'history' | 'settings'>('projects');

  // ── Data ──
  const [settings,      setSettings]      = useState<IncentiveSetting | null>(null);
  const [projects,      setProjects]      = useState<IncentiveProject[]>([]);
  const [disbursements, setDisbursements] = useState<IncentiveDisbursement[]>([]);
  const [teamUsers,     setTeamUsers]     = useState<User[]>([]);

  // ── Filters ──
  const [filterMode,    setFilterMode]    = useState<'bulan' | 'kuartal' | 'tahun'>('bulan');
  const [filterPeriode, setFilterPeriode] = useState('all');
  const [filterYear,    setFilterYear]    = useState('all');
  const [filterQuarter, setFilterQuarter] = useState('all');
  const [filterStatus,  setFilterStatus]  = useState('all');
  const [searchQ,       setSearchQ]       = useState('');

  // ── Modals ──
  const [showBiayaModal,  setShowBiayaModal]  = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showPaidModal,   setShowPaidModal]   = useState(false);
  const [showViewModal,   setShowViewModal]   = useState(false);
  const [selectedProject, setSelectedProject] = useState<IncentiveProject | null>(null);

  // ── Settings form ──
  const [editHandlerPct, setEditHandlerPct] = useState('70');
  const [editBackupPct,  setEditBackupPct]  = useState('30');
  const [savingSettings, setSavingSettings] = useState(false);

  // ── Biaya form ──
  const [biayaInput,      setBiayaInput]      = useState('');
  const [cosProjectNoInput, setCosProjectNoInput] = useState('');
  const [savingBiaya,     setSavingBiaya]     = useState(false);

  // ── Backup form ──
  const [backupSelected, setBackupSelected] = useState<string[]>([]);
  const [savingBackup,   setSavingBackup]   = useState(false);

  // ── Toast ──
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const notify = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const isAdmin      = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase() ?? '');
  const isTeamPTS    = currentUser?.role === 'team';
  const canInputBiaya = isAdmin || currentUser?.allow_incentive_input === true;

  // ── Init / auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    const user = getSession<User>();
    if (!user) { topRedirect('/dashboard'); return; }
    setCurrentUser(user);
    const q = searchParams.get('q');
    if (q) setSearchQ(q);
    const cleanup = startSessionWatcher();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetchAll();
    const ch = supabase
      .channel('incentive-reminder-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => {
        setTimeout(() => { autoSyncAndFetch(); }, 800);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentUser]);

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchSettings(), fetchProjectsAndAutoSync(), fetchDisbursements(), fetchTeamUsers()]);
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

  const autoSyncAndFetch = async () => { await doAutoSync(); await fetchProjects(); };
  const fetchProjectsAndAutoSync = async () => { await doAutoSync(); await fetchProjects(); };

  const doAutoSync = async () => {
    const { data: reminders } = await supabase
      .from('reminders')
      .select('id,project_name,category,assign_name,assigned_to,sales_name,sales_division,due_date,status,description,notes,address,pic_name,pic_phone,product')
      .in('category', INCENTIVE_CATEGORIES)
      .eq('status', 'done');
    if (!reminders?.length) return;

    const { data: existing } = await supabase
      .from('incentive_projects').select('reminder_id').not('reminder_id', 'is', null);
    const existingIds = new Set((existing ?? []).map((e: { reminder_id: string }) => e.reminder_id));
    const newReminders = reminders.filter((r: ReminderRow) => !existingIds.has(r.id));
    if (!newReminders.length) return;

    await supabase.from('incentive_projects').insert(
      newReminders.map((r: ReminderRow) => ({
        reminder_id: r.id, project_name: r.project_name, category: r.category,
        sales_name: r.sales_name, sales_division: r.sales_division, due_date: r.due_date,
        handler_name: r.assign_name ?? '', handler_username: r.assigned_to ?? '',
        backup_names: [], biaya_cadangan: 0,
        periode: r.due_date ? r.due_date.slice(0, 7) : new Date().toISOString().slice(0, 7),
        status: 'pending', description: r.description, notes: r.notes,
        address: r.address, pic_name: r.pic_name, pic_phone: r.pic_phone, product: r.product,
      }))
    );
  };

  const fetchProjects = async () => {
    let q = supabase.from('incentive_projects').select('*').order('created_at', { ascending: false });
    if (isTeamPTS && !isAdmin) {
      q = q.or(`handler_name.eq.${currentUser!.full_name},backup_names.cs.{"${currentUser!.full_name}"}`);
    }
    const { data } = await q;
    setProjects(data ?? []);
  };

  const fetchDisbursements = async () => {
    let q = supabase.from('incentive_disbursements').select('*').order('created_at', { ascending: false });
    if (isTeamPTS && !isAdmin) q = q.eq('person_name', currentUser!.full_name);
    const { data } = await q;
    setDisbursements(data ?? []);
  };

  const fetchTeamUsers = async () => {
    const { data } = await supabase
      .from('users').select('username,full_name,role,team_type,jabatan')
      .eq('role', 'team').order('full_name');
    setTeamUsers(data ?? []);
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const createDisbursements = async (project: IncentiveProject) => {
    if (!settings || project.biaya_cadangan <= 0) return;
    await supabase.from('incentive_disbursements').delete().eq('project_id', project.id);
    const handlerAmt   = (project.biaya_cadangan * settings.handler_pct) / 100;
    const backupTotal  = (project.biaya_cadangan * settings.backup_pct) / 100;
    const backupCount  = project.backup_names.length;
    const backupPer    = backupCount > 0 ? backupTotal / backupCount : 0;
    const rows: Omit<IncentiveDisbursement, 'id' | 'created_at'>[] = [
      { project_id: project.id, person_name: project.handler_name,
        person_username: project.handler_username, role_type: 'handler',
        pct: settings.handler_pct, amount_rp: handlerAmt, periode: project.periode },
      ...project.backup_names.map((name) => {
        const u = teamUsers.find((u) => u.full_name === name);
        return { project_id: project.id, person_name: name, person_username: u?.username,
          role_type: 'backup' as const, pct: backupCount > 0 ? settings.backup_pct / backupCount : 0,
          amount_rp: backupPer, periode: project.periode };
      }),
    ];
    await supabase.from('incentive_disbursements').insert(rows);
  };

  const saveBiaya = async () => {
    if (!selectedProject) return;
    const biaya = parseFloat(biayaInput.replace(/\./g, '').replace(',', '.'));
    if (isNaN(biaya) || biaya <= 0) { notify('error', 'Biaya harus lebih dari 0'); return; }
    setSavingBiaya(true);
    const { error } = await supabase.from('incentive_projects').update({
      biaya_cadangan: biaya, biaya_input_by: currentUser?.full_name,
      biaya_input_at: new Date().toISOString(),
      ...(cosProjectNoInput.trim() ? { cos_project_no: cosProjectNoInput.trim() } : {}),
    }).eq('id', selectedProject.id);
    if (error) { notify('error', 'Gagal simpan biaya'); setSavingBiaya(false); return; }
    await createDisbursements({ ...selectedProject, biaya_cadangan: biaya });
    notify('success', 'Biaya tersimpan & incentive dikalkulasi!');
    setSavingBiaya(false); setShowBiayaModal(false); setBiayaInput(''); setCosProjectNoInput('');
    fetchProjects(); fetchDisbursements();
  };

  const saveBackup = async () => {
    if (!selectedProject) return;
    setSavingBackup(true);
    const { error } = await supabase.from('incentive_projects')
      .update({ backup_names: backupSelected }).eq('id', selectedProject.id);
    if (error) { notify('error', 'Gagal simpan backup'); setSavingBackup(false); return; }
    if (selectedProject.biaya_cadangan > 0) {
      await createDisbursements({ ...selectedProject, backup_names: backupSelected });
    }
    notify('success', 'Tim backup diperbarui!');
    setSavingBackup(false); setShowBackupModal(false);
    fetchProjects(); fetchDisbursements();
  };

  const markPaid = async () => {
    if (!selectedProject) return;
    const { error } = await supabase.from('incentive_projects').update({
      status: 'paid', paid_at: new Date().toISOString(), paid_by: currentUser?.full_name,
    }).eq('id', selectedProject.id);
    if (error) { notify('error', 'Gagal update status'); return; }
    notify('success', 'Project ditandai sebagai lunas!');
    setShowPaidModal(false); fetchProjects();
  };

  const saveSettings = async () => {
    const h = parseFloat(editHandlerPct), b = parseFloat(editBackupPct);
    if (isNaN(h) || isNaN(b) || h + b !== 100) { notify('error', 'Total handler + backup harus = 100%'); return; }
    setSavingSettings(true);
    const { error } = await supabase.from('incentive_settings').update({
      handler_pct: h, backup_pct: b,
      updated_by: currentUser?.full_name, updated_at: new Date().toISOString(),
    }).eq('id', settings!.id);
    if (error) { notify('error', 'Gagal simpan setting'); } else { notify('success', 'Setting tersimpan!'); fetchSettings(); }
    setSavingSettings(false);
  };

  // ── Derived / filter ─────────────────────────────────────────────────────
  const allYears = useMemo(() => {
    const s = new Set(projects.map((p) => p.periode?.slice(0, 4)).filter(Boolean));
    return Array.from(s).sort().reverse() as string[];
  }, [projects]);

  const periodeOptions = useMemo(() => {
    const s = new Set(projects.map((p) => p.periode).filter(Boolean));
    return Array.from(s).sort().reverse() as string[];
  }, [projects]);

  const projectMatchesFilter = (p: IncentiveProject) => {
    const periode = p.periode ?? '';
    if (filterMode === 'tahun') {
      if (filterYear !== 'all' && !periode.startsWith(filterYear)) return false;
    } else if (filterMode === 'kuartal') {
      if (filterYear !== 'all' && !periode.startsWith(filterYear)) return false;
      if (filterQuarter !== 'all') {
        const month = parseInt(periode.slice(5, 7));
        if (`Q${Math.ceil(month / 3)}` !== filterQuarter) return false;
      }
    } else {
      if (filterPeriode !== 'all' && periode !== filterPeriode) return false;
    }
    return true;
  };

  const filteredProjects = useMemo(
    () => projects.filter((p) => {
      if (!projectMatchesFilter(p)) return false;
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (searchQ) {
        const q = searchQ.toLowerCase();
        if (!p.project_name.toLowerCase().includes(q) &&
            !p.handler_name.toLowerCase().includes(q) &&
            !(p.sales_name ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    }),
    [projects, filterMode, filterPeriode, filterYear, filterQuarter, filterStatus, searchQ]
  );

  const rekapData: RekapItem[] = useMemo(() => {
    const filtered = disbursements.filter((d) => {
      const proj = projects.find((p) => p.id === d.project_id);
      return proj && projectMatchesFilter(proj);
    });
    const map: Record<string, RekapItem> = {};
    for (const d of filtered) {
      if (!map[d.person_name]) map[d.person_name] = { person_name: d.person_name, total_rp: 0, count: 0, handler_count: 0, backup_count: 0 };
      map[d.person_name].total_rp += d.amount_rp;
      map[d.person_name].count    += 1;
      if (d.role_type === 'handler') map[d.person_name].handler_count++;
      else map[d.person_name].backup_count++;
    }
    return Object.values(map).sort((a, b) => b.total_rp - a.total_rp);
  }, [disbursements, projects, filterMode, filterPeriode, filterYear, filterQuarter]);

  const totalBiaya     = filteredProjects.reduce((s, p) => s + p.biaya_cadangan, 0);
  const totalIncentive = rekapData.reduce((s, r) => s + r.total_rp, 0);
  const totalPaid      = filteredProjects.filter((p) => p.status === 'paid').length;

  const filterLabel = useMemo(() => {
    if (filterMode === 'tahun') return filterYear !== 'all' ? `Tahun ${filterYear}` : 'Semua Tahun';
    if (filterMode === 'kuartal') {
      const y = filterYear !== 'all' ? filterYear : '';
      const q = filterQuarter !== 'all' ? filterQuarter : '';
      if (y && q) return `${q} ${y}`;
      if (y) return `Tahun ${y}`;
      if (q) return q;
      return 'Semua';
    }
    return filterPeriode !== 'all' ? fmtPeriode(filterPeriode) : 'Semua Periode';
  }, [filterMode, filterYear, filterQuarter, filterPeriode]);

  // ── Export Excel ─────────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const allPersons = Array.from(new Set(rekapData.map((r) => r.person_name)));
    const headerRow1 = ['No', 'Project Name', 'No. COS Project', 'Sales Division', 'Final Incentive',
      ...allPersons.flatMap((n) => [n + ' %', n + ' Rp']), 'Control'];
    const rows1 = filteredProjects.map((proj, idx) => {
      const pd = disbursements.filter((d) => d.project_id === proj.id);
      const perPerson = allPersons.flatMap((name) => {
        const d = pd.find((d) => d.person_name === name);
        return d ? [fmtPct(d.pct), d.amount_rp] : ['', ''];
      });
      const pctTotal = pd.reduce((s, d) => s + d.pct, 0);
      return [idx + 1, proj.project_name, proj.cos_project_no ?? '', proj.sales_division ?? '', proj.biaya_cadangan, ...perPerson, pctTotal > 0 ? `${Math.round(pctTotal)}%` : ''];
    });
    const totalRow1 = ['', 'Total Finance', '', '', totalBiaya,
      ...allPersons.flatMap((name) => {
        const tot = disbursements.filter((d) => d.person_name === name && filteredProjects.some((p) => p.id === d.project_id)).reduce((s, d) => s + d.amount_rp, 0);
        return ['', tot];
      }), ''];
    const ws1 = XLSX.utils.aoa_to_sheet([
      [`Pengajuan Incentive Project-Project IVP — ${filterLabel}`],
      ['Saya yang bertanda tangan di bawah ini, ingin mengajukan pengeluaran Incentive Project-project IVP dengan dasar perhitungan sebagai berikut:'],
      [], headerRow1, ...rows1, totalRow1,
    ]);
    ws1['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, ...allPersons.flatMap(() => [{ wch: 8 }, { wch: 16 }]), { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Detail Project');

    const years = Array.from(new Set(filteredProjects.map((p) => p.periode?.slice(0, 4)).filter(Boolean))).sort() as string[];
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Rekap Nilai Pengajuan Incentive — ' + filterLabel], [],
      ['Nama', ...years.flatMap((y) => [`${y} %`, `${y} Amount`])],
      ...rekapData.map((r) => [r.person_name, ...years.flatMap((y) => {
        const amt = disbursements.filter((d) => d.person_name === r.person_name && d.periode?.startsWith(y) && filteredProjects.some((p) => p.id === d.project_id)).reduce((s, d) => s + d.amount_rp, 0);
        const pcts = disbursements.filter((d) => d.person_name === r.person_name && d.periode?.startsWith(y) && filteredProjects.some((p) => p.id === d.project_id));
        const avgPct = pcts.length > 0 ? pcts.reduce((s, d) => s + d.pct, 0) / pcts.length : 0;
        return [amt > 0 ? fmtPct(avgPct) : '', amt || ''];
      })]),
    ]);
    ws2['!cols'] = [{ wch: 22 }, ...years.flatMap(() => [{ wch: 10 }, { wch: 16 }])];
    XLSX.utils.book_append_sheet(wb, ws2, 'Rekap Per Orang');

    const ws3 = XLSX.utils.aoa_to_sheet([
      ['Ringkasan Incentive PTS — ' + filterLabel], [],
      ['Total Project', filteredProjects.length], ['Total Biaya Cadangan', totalBiaya],
      ['Total Incentive Terdistribusi', totalIncentive], ['Project Sudah Lunas', totalPaid],
      ['Project Masih Pending', filteredProjects.filter((p) => p.status === 'pending').length], [],
      ['Persentase Setting'],
      ['Handler Utama', settings ? `${settings.handler_pct}%` : '-'],
      ['Backup Team',   settings ? `${settings.backup_pct}%` : '-'],
    ]);
    ws3['!cols'] = [{ wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Summary');
    const fileName = `Incentive_PTS_${filterLabel.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    notify('success', `Export berhasil: ${fileName}`);
  };

  // ── Modal helpers ────────────────────────────────────────────────────────
  const openView       = (p: IncentiveProject) => { setSelectedProject(p); setShowViewModal(true); };
  const openSetBackup  = (p: IncentiveProject) => { setSelectedProject(p); setBackupSelected(p.backup_names); setShowBackupModal(true); };
  const openInputBiaya = (p: IncentiveProject) => { setSelectedProject(p); setBiayaInput(p.biaya_cadangan > 0 ? String(p.biaya_cadangan) : ''); setCosProjectNoInput(p.cos_project_no ?? ''); setShowBiayaModal(true); };
  const openMarkPaid   = (p: IncentiveProject) => { setSelectedProject(p); setShowPaidModal(true); };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50" style={{ minHeight: '100vh' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#6366f1' }} />
        <p className="text-slate-500 text-sm font-semibold">Memuat Incentive PTS...</p>
      </div>
    </div>
  );

  const isFilterActive = filterLabel !== 'Semua Periode' && filterLabel !== 'Semua Tahun' && filterLabel !== 'Semua';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>

      {/* Background */}
      <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/IVP_Background.png')" }} />
      <div className="absolute inset-0 z-0" style={{ background: 'rgba(240,244,255,0.88)' }} />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 flex-shrink-0 px-6 py-3 flex items-center justify-between gap-4"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '3px solid #6366f1', boxShadow: '0 2px 16px rgba(99,102,241,0.10)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg flex-shrink-0">💰</div>
          <div>
            <h1 className="text-base font-bold text-gray-800">Incentive PTS</h1>
            <p className="text-[11px] text-gray-400">IndoVisual Professional Tools</p>
          </div>
        </div>
        <div className="text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-xl">
          👤 {currentUser?.full_name}
        </div>
      </header>

      {/* Tabs */}
      <div className="sticky top-[57px] z-40 flex-shrink-0 px-6"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
        <div className="flex gap-1 overflow-x-auto">
          {([
            { id: 'projects', label: '📋 Projects',       adminOnly: false },
            { id: 'rekap',    label: '📊 Rekap Incentive', adminOnly: false },
            { id: 'history',  label: '🕒 History',         adminOnly: false },
            { id: 'settings', label: '⚙️ Settings',        adminOnly: true  },
          ] as { id: typeof activeTab; label: string; adminOnly: boolean }[])
            .filter((t) => !t.adminOnly || isAdmin)
            .map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${activeTab === t.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
        </div>
      </div>

      {/* Main content */}
      <main className="relative z-10">
        <div className="p-4 w-full space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon="📋" label="Total Project"          value={String(filteredProjects.length)} sub={`${totalPaid} sudah dibayar`} color="#6366f1" />
            <StatCard icon="💵" label="Total Biaya Cadangan"   value={fmtRp(totalBiaya)}               sub="Project terfilter"           color="#0ea5e9" />
            <StatCard icon="💰" label="Total Incentive"        value={fmtRp(totalIncentive)}            sub="Terdistribusi"               color="#10b981" />
            <StatCard icon="⏳" label="Menunggu Pembayaran"    value={String(filteredProjects.filter((p) => p.status === 'pending' && p.biaya_cadangan > 0).length)} sub="Project pending" color="#f59e0b" />
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Cari project, handler, sales..."
                  className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent" />
              </div>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="all">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Lunas</option>
              </select>
              <button onClick={exportExcel}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export Excel
              </button>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex bg-gray-100 rounded-xl p-0.5">
                {(['bulan', 'kuartal', 'tahun'] as const).map((m) => (
                  <button key={m}
                    onClick={() => { setFilterMode(m); setFilterPeriode('all'); setFilterYear('all'); setFilterQuarter('all'); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize ${filterMode === m ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                    {m === 'bulan' ? '📅 Bulan' : m === 'kuartal' ? '📊 Kuartal' : '📆 Tahun'}
                  </button>
                ))}
              </div>
              {(filterMode === 'tahun' || filterMode === 'kuartal') && (
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="all">Semua Tahun</option>
                  {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
              {filterMode === 'kuartal' && (
                <select value={filterQuarter} onChange={(e) => setFilterQuarter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="all">Semua Kuartal</option>
                  <option value="Q1">Q1 (Jan–Mar)</option>
                  <option value="Q2">Q2 (Apr–Jun)</option>
                  <option value="Q3">Q3 (Jul–Sep)</option>
                  <option value="Q4">Q4 (Okt–Des)</option>
                </select>
              )}
              {filterMode === 'bulan' && (
                <select value={filterPeriode} onChange={(e) => setFilterPeriode(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="all">Semua Bulan</option>
                  {periodeOptions.map((p) => <option key={p} value={p}>{fmtPeriode(p)}</option>)}
                </select>
              )}
              {isFilterActive && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
                  🔍 {filterLabel}
                  <button onClick={() => { setFilterPeriode('all'); setFilterYear('all'); setFilterQuarter('all'); }}
                    className="ml-1 text-indigo-400 hover:text-indigo-600">✕</button>
                </span>
              )}
            </div>
          </div>

          {/* Tab content */}
          {activeTab === 'projects' && (
            <ProjectsTab
              filteredProjects={filteredProjects}
              totalProjects={projects.length}
              totalBiaya={totalBiaya}
              isAdmin={isAdmin}
              canInputBiaya={canInputBiaya}
              onView={openView}
              onSetBackup={openSetBackup}
              onInputBiaya={openInputBiaya}
              onMarkPaid={openMarkPaid}
            />
          )}
          {activeTab === 'rekap' && (
            <RekapTab
              rekapData={rekapData}
              disbursements={disbursements}
              projects={projects}
              filterPeriode={filterPeriode}
              isTeamPTS={isTeamPTS}
              isAdmin={isAdmin}
              currentUser={currentUser}
              filterLabel={filterLabel}
              onExport={exportExcel}
            />
          )}
          {activeTab === 'history' && (
            <HistoryTab
              projects={projects}
              disbursements={disbursements}
              projectMatchesFilter={projectMatchesFilter}
            />
          )}
          {activeTab === 'settings' && isAdmin && (
            <SettingsTab
              settings={settings}
              editHandlerPct={editHandlerPct}
              editBackupPct={editBackupPct}
              onHandlerPctChange={setEditHandlerPct}
              onBackupPctChange={setEditBackupPct}
              savingSettings={savingSettings}
              onSave={saveSettings}
              isAdmin={isAdmin}
              notify={notify}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      {showViewModal && selectedProject && (
        <ViewModal
          project={selectedProject}
          disbursements={disbursements.filter((d) => d.project_id === selectedProject.id)}
          isAdmin={isAdmin}
          canInputBiaya={canInputBiaya}
          onClose={() => setShowViewModal(false)}
          onSetBackup={() => { setShowViewModal(false); setBackupSelected(selectedProject.backup_names); setShowBackupModal(true); }}
          onInputBiaya={() => { setShowViewModal(false); setBiayaInput(selectedProject.biaya_cadangan > 0 ? String(selectedProject.biaya_cadangan) : ''); setCosProjectNoInput(selectedProject.cos_project_no ?? ''); setShowBiayaModal(true); }}
          onMarkPaid={() => { setShowViewModal(false); setShowPaidModal(true); }}
        />
      )}
      {showBiayaModal && selectedProject && (
        <BiayaModal
          project={selectedProject}
          settings={settings}
          biayaInput={biayaInput}
          cosInput={cosProjectNoInput}
          saving={savingBiaya}
          onClose={() => setShowBiayaModal(false)}
          onSave={saveBiaya}
          onBiayaChange={setBiayaInput}
          onCosChange={setCosProjectNoInput}
        />
      )}
      {showBackupModal && selectedProject && (
        <BackupModal
          project={selectedProject}
          teamUsers={teamUsers}
          backupSelected={backupSelected}
          settings={settings}
          saving={savingBackup}
          onClose={() => setShowBackupModal(false)}
          onSave={saveBackup}
          onToggle={(name, checked) =>
            setBackupSelected((prev) => checked ? [...prev, name] : prev.filter((n) => n !== name))
          }
        />
      )}
      {showPaidModal && selectedProject && (
        <PaidModal
          project={selectedProject}
          onClose={() => setShowPaidModal(false)}
          onConfirm={markPaid}
        />
      )}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <Suspense>
      <IncentivePTSPage />
    </Suspense>
  );
}
