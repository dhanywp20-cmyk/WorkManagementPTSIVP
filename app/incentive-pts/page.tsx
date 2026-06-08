'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getSession, startSessionWatcher } from '@/lib/auth';
import * as XLSX from 'xlsx';

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
  // from reminder join
  description?: string;
  notes?: string;
  address?: string;
  pic_name?: string;
  pic_phone?: string;
  product?: string;
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
  description?: string;
  notes?: string;
  address?: string;
  pic_name?: string;
  pic_phone?: string;
  product?: string;
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
    green:  'bg-emerald-100 text-emerald-700 border border-emerald-200',
    amber:  'bg-amber-100 text-amber-700 border border-amber-200',
    blue:   'bg-blue-100 text-blue-700 border border-blue-200',
    gray:   'bg-gray-100 text-gray-600 border border-gray-200',
    red:    'bg-red-100 text-red-700 border border-red-200',
    purple: 'bg-purple-100 text-purple-700 border border-purple-200',
    indigo: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
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
  const [filterMode, setFilterMode] = useState<'bulan' | 'kuartal' | 'tahun'>('bulan');
  const [filterPeriode, setFilterPeriode] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterQuarter, setFilterQuarter] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQ, setSearchQ] = useState('');

  // Modals
  const [showBiayaModal, setShowBiayaModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
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

    // ── Auto-sync realtime: listen to reminders table changes ──
    const ch = supabase
      .channel('incentive-reminder-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => {
        // Debounce: re-fetch projects after reminder changes
        setTimeout(() => autoSyncAndFetch(), 800);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [currentUser]);

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

  // ── Auto-sync: upsert reminders done → incentive_projects, then fetch ──
  const autoSyncAndFetch = async () => {
    await doAutoSync();
    await fetchProjects();
  };

  const fetchProjectsAndAutoSync = async () => {
    await doAutoSync();
    await fetchProjects();
  };

  const doAutoSync = async () => {
    const { data: reminders } = await supabase
      .from('reminders')
      .select('id, project_name, category, assign_name, assigned_to, sales_name, sales_division, due_date, status, description, notes, address, pic_name, pic_phone, product')
      .in('category', INCENTIVE_CATEGORIES)
      .eq('status', 'done');

    if (!reminders?.length) return;

    // Get existing reminder_ids already in incentive_projects
    const { data: existing } = await supabase
      .from('incentive_projects')
      .select('reminder_id')
      .not('reminder_id', 'is', null);

    const existingIds = new Set((existing ?? []).map((e: { reminder_id: string }) => e.reminder_id));
    const newReminders = reminders.filter((r: ReminderRow) => !existingIds.has(r.id));

    if (!newReminders.length) return;

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
      description: r.description,
      notes: r.notes,
      address: r.address,
      pic_name: r.pic_name,
      pic_phone: r.pic_phone,
      product: r.product,
    }));

    await supabase.from('incentive_projects').insert(toInsert);
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
    await supabase.from('incentive_disbursements').delete().eq('project_id', project.id);
    const handlerAmt = (project.biaya_cadangan * settings.handler_pct) / 100;
    const backupTotal = (project.biaya_cadangan * settings.backup_pct) / 100;
    const backupCount = project.backup_names.length;
    const backupPerPerson = backupCount > 0 ? backupTotal / backupCount : 0;
    const rows: Omit<IncentiveDisbursement, 'id' | 'created_at'>[] = [];
    rows.push({
      project_id: project.id, person_name: project.handler_name,
      person_username: project.handler_username, role_type: 'handler',
      pct: settings.handler_pct, amount_rp: handlerAmt, periode: project.periode,
    });
    for (const name of project.backup_names) {
      const u = teamUsers.find(u => u.full_name === name);
      rows.push({
        project_id: project.id, person_name: name, person_username: u?.username,
        role_type: 'backup', pct: backupCount > 0 ? settings.backup_pct / backupCount : 0,
        amount_rp: backupPerPerson, periode: project.periode,
      });
    }
    await supabase.from('incentive_disbursements').insert(rows);
  };

  // ── Save backup ──
  const saveBackup = async () => {
    if (!selectedProject) return;
    setSavingBackup(true);
    const { error } = await supabase.from('incentive_projects').update({ backup_names: backupSelected }).eq('id', selectedProject.id);
    if (error) { notify('error', 'Gagal simpan backup'); setSavingBackup(false); return; }
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
      status: 'paid', paid_at: new Date().toISOString(), paid_by: currentUser?.full_name,
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
  const allYears = useMemo(() => {
    const set = new Set(projects.map(p => p.periode?.slice(0, 4)).filter(Boolean));
    return Array.from(set).sort().reverse() as string[];
  }, [projects]);

  const periodeOptions = useMemo(() => {
    const set = new Set(projects.map(p => p.periode).filter(Boolean));
    return Array.from(set).sort().reverse() as string[];
  }, [projects]);

  const projectMatchesFilter = (p: IncentiveProject) => {
    const periode = p.periode ?? '';
    if (filterMode === 'tahun') {
      if (filterYear !== 'all' && !periode.startsWith(filterYear)) return false;
    } else if (filterMode === 'kuartal') {
      if (filterYear !== 'all' && !periode.startsWith(filterYear)) return false;
      if (filterQuarter !== 'all') {
        const month = parseInt(periode.slice(5, 7));
        const q = Math.ceil(month / 3);
        if (`Q${q}` !== filterQuarter) return false;
      }
    } else {
      if (filterPeriode !== 'all' && periode !== filterPeriode) return false;
    }
    return true;
  };

  const filteredProjects = useMemo(() => projects.filter(p => {
    if (!projectMatchesFilter(p)) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (searchQ && !p.project_name.toLowerCase().includes(searchQ.toLowerCase()) &&
      !p.handler_name.toLowerCase().includes(searchQ.toLowerCase()) &&
      !(p.sales_name ?? '').toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  }), [projects, filterMode, filterPeriode, filterYear, filterQuarter, filterStatus, searchQ]);

  const rekapData = useMemo(() => {
    const filtered = disbursements.filter(d => {
      const proj = projects.find(p => p.id === d.project_id);
      return proj && projectMatchesFilter(proj);
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
  }, [disbursements, projects, filterMode, filterPeriode, filterYear, filterQuarter]);

  const totalBiaya = filteredProjects.reduce((s, p) => s + p.biaya_cadangan, 0);
  const totalIncentive = rekapData.reduce((s, r) => s + r.total_rp, 0);
  const totalPaid = filteredProjects.filter(p => p.status === 'paid').length;

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

  // ── Export Excel ──
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const allPersons = Array.from(new Set(rekapData.map(r => r.person_name)));
    const headerRow1 = ['No', 'Project Name', 'Sales Division', 'Final Incentive',
      ...allPersons.flatMap(name => [name + ' %', name + ' Rp']), 'Control'];
    const rows1 = filteredProjects.map((proj, idx) => {
      const projDisb = disbursements.filter(d => d.project_id === proj.id);
      const perPersonCols = allPersons.flatMap(name => {
        const d = projDisb.find(d => d.person_name === name);
        return d ? [fmtPct(d.pct), d.amount_rp] : ['', ''];
      });
      const pctTotal = projDisb.reduce((s, d) => s + d.pct, 0);
      return [idx + 1, proj.project_name, proj.sales_division ?? '', proj.biaya_cadangan, ...perPersonCols, pctTotal > 0 ? `${Math.round(pctTotal)}%` : ''];
    });
    const totalRow1 = ['', 'Total Finance', '', totalBiaya,
      ...allPersons.flatMap(name => {
        const personTotal = disbursements.filter(d => d.person_name === name && filteredProjects.some(p => p.id === d.project_id)).reduce((s, d) => s + d.amount_rp, 0);
        return ['', personTotal];
      }), ''];
    const ws1 = XLSX.utils.aoa_to_sheet([
      [`Pengajuan Incentive Project-Project IVP — ${filterLabel}`],
      ['Saya yang bertanda tangan di bawah ini, ingin mengajukan pengeluaran Incentive Project-project IVP dengan dasar perhitungan sebagai berikut:'],
      [], headerRow1, ...rows1, totalRow1,
    ]);
    ws1['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 16 }, { wch: 18 }, ...allPersons.flatMap(() => [{ wch: 8 }, { wch: 16 }]), { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Detail Project');

    const years = Array.from(new Set(filteredProjects.map(p => p.periode?.slice(0, 4)).filter(Boolean))).sort() as string[];
    const header2 = ['Nama', ...years.flatMap(y => [`${y} %`, `${y} Amount`])];
    const rows2 = rekapData.map(r => {
      const yearCols = years.flatMap(y => {
        const amt = disbursements.filter(d => d.person_name === r.person_name && d.periode?.startsWith(y) && filteredProjects.some(p => p.id === d.project_id)).reduce((s, d) => s + d.amount_rp, 0);
        const pct = disbursements.filter(d => d.person_name === r.person_name && d.periode?.startsWith(y) && filteredProjects.some(p => p.id === d.project_id));
        const avgPct = pct.length > 0 ? pct.reduce((s, d) => s + d.pct, 0) / pct.length : 0;
        return [amt > 0 ? fmtPct(avgPct) : '', amt || ''];
      });
      return [r.person_name, ...yearCols];
    });
    const ws2 = XLSX.utils.aoa_to_sheet([['Rekap Nilai Pengajuan Incentive — ' + filterLabel], [], header2, ...rows2]);
    ws2['!cols'] = [{ wch: 22 }, ...years.flatMap(() => [{ wch: 10 }, { wch: 16 }])];
    XLSX.utils.book_append_sheet(wb, ws2, 'Rekap Per Orang');

    const ws3 = XLSX.utils.aoa_to_sheet([
      ['Ringkasan Incentive PTS — ' + filterLabel], [],
      ['Total Project', filteredProjects.length], ['Total Biaya Cadangan', totalBiaya],
      ['Total Incentive Terdistribusi', totalIncentive], ['Project Sudah Lunas', totalPaid],
      ['Project Masih Pending', filteredProjects.filter(p => p.status === 'pending').length], [],
      ['Persentase Setting'],
      ['Handler Utama', settings ? `${settings.handler_pct}%` : '-'],
      ['Backup Team', settings ? `${settings.backup_pct}%` : '-'],
    ]);
    ws3['!cols'] = [{ wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Summary');
    const fileName = `Incentive_PTS_${filterLabel.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    notify('success', `Export berhasil: ${fileName}`);
  };

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
    <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Background */}
      <div className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/IVP_Background.png')" }} />
      <div className="fixed inset-0 z-0" style={{ background: 'rgba(240,244,255,0.88)' }} />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="relative z-50 flex-shrink-0 px-6 py-3 flex items-center justify-between gap-4"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '3px solid #6366f1',
          boxShadow: '0 2px 16px rgba(99,102,241,0.10)',
        }}>
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
      <div className="relative z-40 flex-shrink-0 px-6"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(99,102,241,0.12)',
        }}>
        <div className="flex gap-1 overflow-x-auto">
          {([
            { id: 'projects', label: '📋 Projects', adminOnly: false },
            { id: 'rekap',    label: '📊 Rekap Incentive', adminOnly: false },
            { id: 'history',  label: '🕒 History', adminOnly: false },
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

      {/* Scrollable content */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto w-full space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon="📋" label="Total Project" value={String(filteredProjects.length)} sub={`${totalPaid} sudah dibayar`} color="#6366f1" />
            <StatCard icon="💵" label="Total Biaya Cadangan" value={fmtRp(totalBiaya)} sub="Project terfilter" color="#0ea5e9" />
            <StatCard icon="💰" label="Total Incentive" value={fmtRp(totalIncentive)} sub="Terdistribusi" color="#10b981" />
            <StatCard icon="⏳" label="Menunggu Pembayaran" value={String(filteredProjects.filter(p => p.status === 'pending' && p.biaya_cadangan > 0).length)} sub="Project pending" color="#f59e0b" />
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Cari project, handler, sales..."
                  className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent" />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
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
                {(['bulan', 'kuartal', 'tahun'] as const).map(m => (
                  <button key={m} onClick={() => { setFilterMode(m); setFilterPeriode('all'); setFilterYear('all'); setFilterQuarter('all'); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize ${filterMode === m ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                    {m === 'bulan' ? '📅 Bulan' : m === 'kuartal' ? '📊 Kuartal' : '📆 Tahun'}
                  </button>
                ))}
              </div>
              {(filterMode === 'tahun' || filterMode === 'kuartal') && (
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="all">Semua Tahun</option>
                  {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
              {filterMode === 'kuartal' && (
                <select value={filterQuarter} onChange={e => setFilterQuarter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="all">Semua Kuartal</option>
                  <option value="Q1">Q1 (Jan–Mar)</option>
                  <option value="Q2">Q2 (Apr–Jun)</option>
                  <option value="Q3">Q3 (Jul–Sep)</option>
                  <option value="Q4">Q4 (Okt–Des)</option>
                </select>
              )}
              {filterMode === 'bulan' && (
                <select value={filterPeriode} onChange={e => setFilterPeriode(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="all">Semua Bulan</option>
                  {periodeOptions.map(p => <option key={p} value={p}>{fmtPeriode(p)}</option>)}
                </select>
              )}
              {filterLabel !== 'Semua Periode' && filterLabel !== 'Semua Tahun' && filterLabel !== 'Semua' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
                  🔍 {filterLabel}
                  <button onClick={() => { setFilterPeriode('all'); setFilterYear('all'); setFilterQuarter('all'); }}
                    className="ml-1 text-indigo-400 hover:text-indigo-600">✕</button>
                </span>
              )}
            </div>
          </div>

          {/* ══════════ TAB: PROJECTS — TABLE ══════════ */}
          {activeTab === 'projects' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Table header */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100" style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(139,92,246,0.04))' }}>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-10">No</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Project Name</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Kategori</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-36">Handler</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-36">Sales</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Tanggal</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-36">Nominal Cadangan</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-36">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredProjects.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-16 text-center">
                          <p className="text-4xl mb-3">📭</p>
                          <p className="text-gray-500 font-medium">Belum ada project incentive</p>
                          <p className="text-gray-400 text-xs mt-1">Data otomatis muncul dari Reminder Schedule kategori Training / Konfigurasi & Training yang sudah selesai</p>
                        </td>
                      </tr>
                    ) : filteredProjects.map((proj, idx) => (
                      <tr key={proj.id} className="hover:bg-indigo-50/30 transition-colors group">
                        {/* No */}
                        <td className="px-4 py-3 text-xs text-gray-400 font-medium">{idx + 1}</td>
                        {/* Project Name */}
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800 text-sm leading-snug">{proj.project_name}</p>
                          {proj.address && <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[240px]">📍 {proj.address}</p>}
                        </td>
                        {/* Kategori */}
                        <td className="px-4 py-3">
                          <Badge color="purple">{proj.category}</Badge>
                        </td>
                        {/* Handler */}
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-700">{proj.handler_name}</p>
                          {proj.backup_names.length > 0 && (
                            <p className="text-[11px] text-gray-400 mt-0.5">+{proj.backup_names.length} backup</p>
                          )}
                        </td>
                        {/* Sales */}
                        <td className="px-4 py-3">
                          {proj.sales_name ? (
                            <>
                              <p className="text-sm text-gray-700">{proj.sales_name}</p>
                              {proj.sales_division && <p className="text-[11px] text-gray-400">{proj.sales_division}</p>}
                            </>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        {/* Tanggal — hanya due_date, periode hanya untuk filter */}
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-600">{fmtDate(proj.due_date)}</p>
                          <p className="text-[11px] text-gray-400">{fmtPeriode(proj.periode)}</p>
                        </td>
                        {/* Nominal */}
                        <td className="px-4 py-3 text-right">
                          {proj.biaya_cadangan > 0 ? (
                            <p className="font-bold text-indigo-600 text-sm">{fmtRp(proj.biaya_cadangan)}</p>
                          ) : (
                            <span className="text-gray-300 text-xs">Belum diinput</span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          <Badge color={proj.status === 'paid' ? 'green' : proj.biaya_cadangan > 0 ? 'amber' : 'gray'}>
                            {proj.status === 'paid' ? '✅ Lunas' : proj.biaya_cadangan > 0 ? '⏳ Pending' : '⚪ Belum ada biaya'}
                          </Badge>
                        </td>
                        {/* Aksi */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* View */}
                            <button
                              onClick={() => { setSelectedProject(proj); setShowViewModal(true); }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                              title="Lihat detail">
                              👁 View
                            </button>
                            {/* Backup — admin only */}
                            {isAdmin && (
                              <button onClick={() => { setSelectedProject(proj); setBackupSelected(proj.backup_names); setShowBackupModal(true); }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors"
                                title="Set backup">
                                🤝
                              </button>
                            )}
                            {/* Input / Edit Biaya */}
                            {canInputBiaya && proj.status === 'pending' && (
                              <button onClick={() => { setSelectedProject(proj); setBiayaInput(proj.biaya_cadangan > 0 ? String(proj.biaya_cadangan) : ''); setShowBiayaModal(true); }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                                title={proj.biaya_cadangan > 0 ? 'Edit biaya' : 'Input biaya'}>
                                {proj.biaya_cadangan > 0 ? '✏️' : '💵'}
                              </button>
                            )}
                            {/* Tandai Lunas — admin only */}
                            {isAdmin && proj.status === 'pending' && proj.biaya_cadangan > 0 && (
                              <button onClick={() => { setSelectedProject(proj); setShowPaidModal(true); }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 transition-colors"
                                title="Tandai lunas">
                                ✅
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Footer count */}
              {filteredProjects.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    Menampilkan {filteredProjects.length} dari {projects.length} project
                  </span>
                  <span className="text-xs text-gray-400">
                    Total: <strong className="text-indigo-600">{fmtRp(totalBiaya)}</strong>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ══════════ TAB: REKAP ══════════ */}
          {activeTab === 'rekap' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-bold text-gray-800">📊 Rekap Incentive Per Orang</h2>
                  <div className="flex items-center gap-2">
                    {filterLabel !== 'Semua Periode' && filterLabel !== 'Semua Tahun' && filterLabel !== 'Semua' && (
                      <Badge color="blue">{filterLabel}</Badge>
                    )}
                    <button onClick={exportExcel}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                      Export Excel
                    </button>
                  </div>
                </div>
                {rekapData.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-4xl mb-3">📊</p>
                    <p className="text-gray-500">Belum ada data rekap untuk periode ini</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {rekapData.map((r, i) => {
                      if (isTeamPTS && !isAdmin && r.person_name !== currentUser?.full_name) return null;
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
                                <p className="text-xs text-gray-400">{r.handler_count}x handler · {r.backup_count}x backup</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-indigo-600">{fmtRp(r.total_rp)}</p>
                              <p className="text-xs text-gray-400">{r.count} project</p>
                            </div>
                          </div>
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

          {/* ══════════ TAB: HISTORY ══════════ */}
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
                  {projects.filter(p => p.status === 'paid' && projectMatchesFilter(p)).map(proj => {
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

          {/* ══════════ TAB: SETTINGS ══════════ */}
          {activeTab === 'settings' && isAdmin && (
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">⚙️ Pengaturan Persentase</h2>
                {settings && (
                  <p className="text-xs text-gray-400">Terakhir diperbarui: {fmtDate(settings.updated_at)} oleh {settings.updated_by}</p>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">⭐ Handler Utama (%)</label>
                  <input type="number" value={editHandlerPct} min="0" max="100"
                    onChange={e => { setEditHandlerPct(e.target.value); setEditBackupPct(String(100 - parseFloat(e.target.value || '0'))); }}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">🤝 Backup Team (%) — dibagi rata ke semua backup</label>
                  <input type="number" value={editBackupPct} min="0" max="100"
                    onChange={e => { setEditBackupPct(e.target.value); setEditHandlerPct(String(100 - parseFloat(e.target.value || '0'))); }}
                    className={inputCls} />
                </div>
                <div className={`p-3 rounded-xl text-sm font-semibold text-center ${parseFloat(editHandlerPct) + parseFloat(editBackupPct) === 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  Total: {(parseFloat(editHandlerPct || '0') + parseFloat(editBackupPct || '0')).toFixed(0)}%
                  {parseFloat(editHandlerPct) + parseFloat(editBackupPct) === 100 ? ' ✅' : ' ❌ harus = 100%'}
                </div>
                <button onClick={saveSettings} disabled={savingSettings || parseFloat(editHandlerPct) + parseFloat(editBackupPct) !== 100}
                  className={`${btnPrimary} w-full`} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                  {savingSettings ? 'Menyimpan...' : '💾 Simpan Setting'}
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">👥 Izin Input Biaya Cadangan</h2>
                <p className="text-xs text-gray-400">User yang diizinkan menginput biaya cadangan selain Admin</p>
                <AllowBiayaList isAdmin={isAdmin} notify={notify} />
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ══ MODAL: View Detail ══ */}
      {showViewModal && selectedProject && (() => {
        const projDisb = disbursements.filter(d => d.project_id === selectedProject.id);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
              {/* Modal header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3 flex-shrink-0">
                <div>
                  <h3 className="font-bold text-gray-800 text-base leading-snug">{selectedProject.project_name}</h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge color="purple">{selectedProject.category}</Badge>
                    <Badge color={selectedProject.status === 'paid' ? 'green' : selectedProject.biaya_cadangan > 0 ? 'amber' : 'gray'}>
                      {selectedProject.status === 'paid' ? '✅ Lunas' : selectedProject.biaya_cadangan > 0 ? '⏳ Pending' : '⚪ Belum ada biaya'}
                    </Badge>
                  </div>
                </div>
                <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0">✕</button>
              </div>

              {/* Modal body — scrollable */}
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

                {/* Info Proyek */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Informasi Proyek</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <p className="text-[11px] text-gray-400">Handler</p>
                      <p className="font-semibold text-gray-700">⭐ {selectedProject.handler_name}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400">Sales</p>
                      <p className="font-semibold text-gray-700">{selectedProject.sales_name ?? '—'}</p>
                      {selectedProject.sales_division && <p className="text-[11px] text-gray-400">{selectedProject.sales_division}</p>}
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400">Tanggal</p>
                      <p className="font-semibold text-gray-700">{fmtDate(selectedProject.due_date)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400">Periode</p>
                      <p className="font-semibold text-gray-700">{fmtPeriode(selectedProject.periode)}</p>
                    </div>
                    {selectedProject.address && (
                      <div className="col-span-2">
                        <p className="text-[11px] text-gray-400">Lokasi</p>
                        <p className="font-semibold text-gray-700">📍 {selectedProject.address}</p>
                      </div>
                    )}
                    {selectedProject.pic_name && (
                      <div>
                        <p className="text-[11px] text-gray-400">PIC</p>
                        <p className="font-semibold text-gray-700">{selectedProject.pic_name}</p>
                        {selectedProject.pic_phone && <p className="text-[11px] text-gray-400">📱 {selectedProject.pic_phone}</p>}
                      </div>
                    )}
                    {selectedProject.product && (
                      <div>
                        <p className="text-[11px] text-gray-400">Produk</p>
                        <p className="font-semibold text-gray-700">{selectedProject.product}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Keterangan */}
                {(selectedProject.description || selectedProject.notes) && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Keterangan</p>
                    {selectedProject.description && (
                      <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">
                        <p className="text-[11px] text-gray-400 mb-1">Deskripsi</p>
                        {selectedProject.description}
                      </div>
                    )}
                    {selectedProject.notes && (
                      <div className="bg-amber-50 rounded-xl p-3 text-sm text-gray-700 border border-amber-100">
                        <p className="text-[11px] text-amber-500 mb-1">📝 Catatan</p>
                        {selectedProject.notes}
                      </div>
                    )}
                  </div>
                )}

                {/* Tim Backup */}
                {selectedProject.backup_names.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tim Backup</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedProject.backup_names.map(name => (
                        <span key={name} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold">
                          🤝 {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Biaya & Distribusi */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Biaya & Distribusi Incentive</p>
                  {selectedProject.biaya_cadangan > 0 ? (
                    <>
                      <div className="bg-indigo-50 rounded-xl p-3 flex items-center justify-between">
                        <p className="text-sm text-indigo-700 font-semibold">Biaya Cadangan</p>
                        <p className="text-lg font-bold text-indigo-600">{fmtRp(selectedProject.biaya_cadangan)}</p>
                      </div>
                      {projDisb.length > 0 && (
                        <div className="space-y-1.5">
                          {projDisb.map(d => (
                            <div key={d.id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm border ${d.role_type === 'handler' ? 'bg-indigo-50 border-indigo-200' : 'bg-blue-50 border-blue-200'}`}>
                              <div className="flex items-center gap-2">
                                <span>{d.role_type === 'handler' ? '⭐' : '🤝'}</span>
                                <span className="font-semibold text-gray-700">{d.person_name}</span>
                                <Badge color={d.role_type === 'handler' ? 'indigo' : 'blue'}>{d.role_type}</Badge>
                              </div>
                              <div className="text-right">
                                <span className="text-gray-500 text-xs mr-2">{fmtPct(d.pct)}</span>
                                <span className="font-bold text-gray-800">{fmtRp(d.amount_rp)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedProject.biaya_input_by && (
                        <p className="text-[11px] text-gray-400">
                          Diinput oleh {selectedProject.biaya_input_by} · {fmtDate(selectedProject.biaya_input_at)}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-400">
                      Biaya cadangan belum diinput
                    </div>
                  )}
                </div>

                {/* Paid info */}
                {selectedProject.status === 'paid' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm">
                    <p className="font-semibold text-emerald-700">✅ Incentive Sudah Dibayarkan</p>
                    <p className="text-emerald-600 text-xs mt-0.5">
                      {fmtDate(selectedProject.paid_at)} · oleh {selectedProject.paid_by}
                    </p>
                  </div>
                )}
              </div>

              {/* Modal footer actions */}
              <div className="px-6 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0 flex-wrap">
                {isAdmin && (
                  <button onClick={() => { setShowViewModal(false); setBackupSelected(selectedProject.backup_names); setShowBackupModal(true); }}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}>
                    🤝 Set Backup
                  </button>
                )}
                {canInputBiaya && selectedProject.status === 'pending' && (
                  <button onClick={() => { setShowViewModal(false); setBiayaInput(selectedProject.biaya_cadangan > 0 ? String(selectedProject.biaya_cadangan) : ''); setShowBiayaModal(true); }}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                    {selectedProject.biaya_cadangan > 0 ? '✏️ Edit Biaya' : '💵 Input Biaya'}
                  </button>
                )}
                {isAdmin && selectedProject.status === 'pending' && selectedProject.biaya_cadangan > 0 && (
                  <button onClick={() => { setShowViewModal(false); setShowPaidModal(true); }}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                    ✅ Tandai Lunas
                  </button>
                )}
                <button onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ MODAL: Input / Edit Biaya ══ */}
      {showBiayaModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">
              {selectedProject.biaya_cadangan > 0 ? '✏️ Edit Biaya Cadangan' : '💵 Input Biaya Cadangan'}
            </h3>
            <div className="bg-indigo-50 rounded-xl p-3 text-sm">
              <p className="font-semibold text-indigo-700">{selectedProject.project_name}</p>
              <p className="text-indigo-500 text-xs">{selectedProject.category} · Handler: {selectedProject.handler_name}</p>
            </div>
            {settings && (
              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
                <p>⭐ Handler ({selectedProject.handler_name}): <strong className="text-gray-700">{fmtPct(settings.handler_pct)}</strong></p>
                {selectedProject.backup_names.length > 0 ? (
                  <p>🤝 Backup ({selectedProject.backup_names.length} orang): <strong className="text-gray-700">{selectedProject.backup_names.join(', ')}</strong></p>
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
              <button onClick={() => setShowBiayaModal(false)} className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Batal</button>
              <button onClick={saveBiaya} disabled={savingBiaya} className={`flex-1 ${btnPrimary}`} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                {savingBiaya ? 'Menyimpan...' : '💾 Simpan & Kalkulasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Set Backup ══ */}
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
                🤝 {backupSelected.length} orang backup · masing-masing {fmtPct(settings.backup_pct / backupSelected.length)} dari biaya cadangan
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

      {/* ══ MODAL: Konfirmasi Lunas ══ */}
      {showPaidModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-3xl mx-auto">✅</div>
            <h3 className="font-bold text-gray-800 text-lg">Tandai Lunas?</h3>
            <p className="text-sm text-gray-500">
              Project <strong className="text-gray-700">{selectedProject.project_name}</strong> akan ditandai sebagai{' '}
              <strong className="text-emerald-600">LUNAS</strong> dengan total incentive{' '}
              <strong className="text-indigo-600">{fmtRp(selectedProject.biaya_cadangan)}</strong>.
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

// ─── Allow Biaya List ─────────────────────────────────────────────────────────
function AllowBiayaList({ isAdmin, notify }: { isAdmin: boolean; notify: (t: 'success' | 'error', m: string) => void }) {
  const [users, setUsers] = useState<(User & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('users').select('id, full_name, role, allow_incentive_input')
      .in('role', ['guest', 'sales', 'team']).order('full_name')
      .then(({ data }: { data: (User & { id: string })[] | null }) => {
        setUsers(data ?? []);
        setLoading(false);
      });
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

// ─── Export ───────────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <Suspense>
      <IncentivePTSPage />
    </Suspense>
  );
}
