'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getSession, startSessionWatcher } from '@/lib/auth';
import * as XLSX from 'xlsx';

import { User, IncentiveSetting, IncentiveProject, IncentiveDisbursement, ReminderRow, RekapItem } from './_components/types';
import { logAudit } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { INCENTIVE_CATEGORIES, INCENTIVE_TRIGGER_CATEGORIES, StatCard, fmtRp, fmtPct, fmtPeriode } from './_components/shared';
import { MiniPieChart } from '@/components/shared/MiniPieChart';
import { ProjectsTab }  from './_components/ProjectsTab';
import { RekapTab }     from './_components/RekapTab';
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
  const [activeTab, setActiveTab] = useState<'projects' | 'rekap' | 'settings'>('projects');

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
  const [backupSelected,  setBackupSelected]  = useState<string[]>([]);
  const [detectedSupport, setDetectedSupport] = useState<string[]>([]);
  const [savingBackup,    setSavingBackup]    = useState(false);

  // ── Sync loading ──
  const [syncing, setSyncing] = useState(false);

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
    // Refresh allow_incentive_input from DB — may have changed since login
    supabase
      .from('users')
      .select('allow_incentive_input')
      .eq('username', user.username)
      .single()
      .then(({ data }: { data: { allow_incentive_input: boolean } | null }) => {
        if (data) {
          setCurrentUser((prev) =>
            prev ? { ...prev, allow_incentive_input: data.allow_incentive_input } : prev
          );
        }
      });
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
  const fetchProjectsAndAutoSync = async () => {
    setSyncing(true);
    await doAutoSync();
    await fetchProjects();
    setSyncing(false);
  };

  const doAutoSync = async () => {
    // Try with mode columns; fall back to core-only if migration not yet applied
    let reminders: ReminderRow[] | null = null;
    let queryError: string | null = null;
    {
      const { data, error } = await supabase
        .from('reminders')
        .select('id,project_name,category,assign_name,assigned_to,sales_name,sales_division,due_date,status,description,notes,address,pic_name,pic_phone,product,mode_penyelesaian,installer_name,installer_daerah')
        .in('category', INCENTIVE_CATEGORIES)
        .eq('status', 'done');
      if (error) {
        queryError = error.message;
        // Fallback: mode columns may not exist yet
        const { data: fallback, error: fbErr } = await supabase
          .from('reminders')
          .select('id,project_name,category,assign_name,assigned_to,sales_name,sales_division,due_date,status,description,notes,address,pic_name,pic_phone,product')
          .in('category', INCENTIVE_CATEGORIES)
          .eq('status', 'done');
        if (fbErr) { notify('error', `Sync gagal baca reminders: ${fbErr.message}`); return; }
        reminders = fallback;
      } else {
        reminders = data;
      }
    }
    if (!reminders?.length) {
      if (queryError) notify('error', `Query reminders error: ${queryError}`);
      return;
    }

    // Build quick lookup map
    const reminderMap: Record<string, ReminderRow> = {};
    (reminders as ReminderRow[]).forEach(r => { reminderMap[r.id] = r; });

    const { data: existing, error: existingErr } = await supabase
      .from('incentive_projects')
      .select('id,reminder_id,description,notes,address,product,mode_penyelesaian,installer_name,installer_daerah')
      .not('reminder_id', 'is', null);

    if (existingErr) { notify('error', `Sync gagal baca existing projects: ${existingErr.message}`); return; }

    const existingMap: Record<string, any> = {};
    (existing ?? []).forEach((e: any) => { existingMap[e.reminder_id] = e; });

    // Insert new — satu per satu agar satu gagal tidak memblokir yang lain
    const newReminders = (reminders as ReminderRow[]).filter(r => !existingMap[r.id]);
    if (newReminders.length) {
      let insertedCount = 0;
      for (const r of newReminders) {
        const baseRow = {
          reminder_id: r.id, project_name: r.project_name, category: r.category,
          sales_name: r.sales_name, sales_division: r.sales_division, due_date: r.due_date,
          handler_name: r.assign_name ?? '', handler_username: r.assigned_to ?? '',
          backup_names: [], biaya_cadangan: 0,
          periode: r.due_date ? r.due_date.slice(0, 7) : new Date().toISOString().slice(0, 7),
          status: 'pending', description: r.description, notes: r.notes,
          address: r.address, pic_name: r.pic_name, pic_phone: r.pic_phone, product: r.product,
        };
        // Coba insert dengan mode columns
        const { error: insErr } = await supabase.from('incentive_projects').insert({
          ...baseRow,
          mode_penyelesaian: (r as ReminderRow).mode_penyelesaian ?? null,
          installer_name: (r as ReminderRow).installer_name ?? null,
          installer_daerah: (r as ReminderRow).installer_daerah ?? null,
        });
        if (insErr) {
          // Fallback: insert tanpa mode columns (untuk DB yang belum migrasi)
          const { error: insErr2 } = await supabase.from('incentive_projects').insert(baseRow);
          if (!insErr2) insertedCount++;
        } else {
          insertedCount++;
        }
      }
      if (insertedCount > 0) notify('success', `${insertedCount} project baru disync ke Incentive PTS!`);
    }

    // Backfill missing detail fields for existing projects
    const toBackfill = (existing ?? []).filter((p: any) =>
      p.reminder_id && reminderMap[p.reminder_id] &&
      (!p.description || !p.notes || !p.address || !p.product ||
        (reminderMap[p.reminder_id].mode_penyelesaian && !p.mode_penyelesaian))
    );
    await Promise.all(toBackfill.map(async (p: any) => {
      const r = reminderMap[p.reminder_id];
      await supabase.from('incentive_projects').update({
        description: p.description || r.description || null,
        notes: p.notes || r.notes || null,
        address: p.address || r.address || null,
        product: p.product || r.product || null,
        mode_penyelesaian: p.mode_penyelesaian || r.mode_penyelesaian || null,
        installer_name: p.installer_name || r.installer_name || null,
        installer_daerah: p.installer_daerah || r.installer_daerah || null,
      }).eq('id', p.id);
    }));
  };

  const fetchProjects = async () => {
    let q = supabase.from('incentive_projects').select('*').order('created_at', { ascending: false }).order('id', { ascending: true }).limit(500);
    if (isTeamPTS && !isAdmin) {
      q = q.or(`handler_name.eq.${currentUser!.full_name},backup_names.cs.{"${currentUser!.full_name}"}`);
    }
    const { data } = await q;
    setProjects(data ?? []);
  };

  const fetchDisbursements = async () => {
    let q = supabase.from('incentive_disbursements').select('*').order('created_at', { ascending: false }).limit(500);
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

    const base = project.biaya_cadangan;
    const isIncentiveCat = (INCENTIVE_TRIGGER_CATEGORIES as string[]).includes(project.category);
    const mode = project.mode_penyelesaian;
    const backupCount = project.backup_names.length;

    const managerUser    = settings?.pts_manager_username
      ? teamUsers.find(u => u.username === settings.pts_manager_username)
      : teamUsers.find(u => u.jabatan === 'Manager');
    const supervisorUser = settings?.pts_supervisor_username
      ? teamUsers.find(u => u.username === settings.pts_supervisor_username)
      : teamUsers.find(u => u.jabatan === 'Supervisor');
    const supervisorIsHandler = supervisorUser?.full_name === project.handler_name;

    const rows: Omit<IncentiveDisbursement, 'id'>[] = [];
    const amt = (pct: number) => Math.round((base * pct) / 100);

    const mkPTS = (name: string, username: string | undefined, role: IncentiveDisbursement['role_type'], pct: number) => ({
      project_id: project.id, person_name: name, person_username: username,
      role_type: role, pct, amount_rp: amt(pct), periode: project.periode,
      payment_year_1_paid: false, payment_year_2_paid: false, payment_year_3_paid: false,
      member_status: 'active' as const,
    });

    if (isIncentiveCat && (mode === 'onsite' || mode === 'remote')) {
      const SUPERVISOR_PCT = 10;
      const MANAGER_BASE   = 10;
      const managerPct     = supervisorIsHandler ? MANAGER_BASE + SUPERVISOR_PCT : MANAGER_BASE;

      if (mode === 'onsite') {
        // PIC 65%, Support pool 15% (ke PIC jika kosong), Supervisor 10%, Manager 10/20%
        const SUPPORT_POOL = 15;
        const picPct = backupCount === 0 ? 65 + SUPPORT_POOL : 65;
        rows.push(mkPTS(project.handler_name, project.handler_username, 'handler', picPct));
        if (backupCount > 0) {
          const perPct = SUPPORT_POOL / backupCount;
          project.backup_names.forEach(name => {
            const u = teamUsers.find(u => u.full_name === name);
            rows.push(mkPTS(name, u?.username, 'backup', perPct));
          });
        }
        if (supervisorUser && !supervisorIsHandler) {
          rows.push(mkPTS(supervisorUser.full_name, supervisorUser.username, 'supervisor', SUPERVISOR_PCT));
          await supabase.from('incentive_projects').update({ supervisor_name: supervisorUser.full_name }).eq('id', project.id);
        }
        if (managerUser) {
          rows.push(mkPTS(managerUser.full_name, managerUser.username, 'manager', managerPct));
          await supabase.from('incentive_projects').update({ atasan_name: managerUser.full_name }).eq('id', project.id);
        }

      } else {
        // PIC 60% + missed pools, Installer 10%, Support pool 10%, Supervisor 10%, Manager 10/20%
        const INSTALLER_PCT = 10;
        const SUPPORT_POOL  = 10;
        const hasInstaller  = !!project.installer_name;
        const hasSupport    = backupCount > 0;
        const picPct = 60 + (hasInstaller ? 0 : INSTALLER_PCT) + (hasSupport ? 0 : SUPPORT_POOL);

        rows.push(mkPTS(project.handler_name, project.handler_username, 'handler', picPct));

        if (hasInstaller) {
          rows.push({
            project_id: project.id, person_name: project.installer_name!, person_username: undefined,
            role_type: 'installer', pct: INSTALLER_PCT, amount_rp: amt(INSTALLER_PCT), periode: project.periode,
            payment_year_1_paid: false, payment_year_2_paid: false, payment_year_3_paid: false,
            member_status: 'active' as const,
          });
          await supabase.from('incentive_projects').update({
            installer_incentive_pct: INSTALLER_PCT, installer_incentive_nominal: amt(INSTALLER_PCT),
          }).eq('id', project.id);
        }

        if (hasSupport) {
          const perPct = SUPPORT_POOL / backupCount;
          project.backup_names.forEach(name => {
            const u = teamUsers.find(u => u.full_name === name);
            rows.push(mkPTS(name, u?.username, 'backup', perPct));
          });
        }

        if (supervisorUser && !supervisorIsHandler) {
          rows.push(mkPTS(supervisorUser.full_name, supervisorUser.username, 'supervisor', SUPERVISOR_PCT));
          await supabase.from('incentive_projects').update({ supervisor_name: supervisorUser.full_name }).eq('id', project.id);
        }
        if (managerUser) {
          rows.push(mkPTS(managerUser.full_name, managerUser.username, 'manager', managerPct));
          await supabase.from('incentive_projects').update({ atasan_name: managerUser.full_name }).eq('id', project.id);
        }
      }

    } else {
      // Legacy — use settings.handler_pct / settings.backup_pct
      const backupPer = backupCount > 0 ? settings.backup_pct / backupCount : 0;
      rows.push(mkPTS(project.handler_name, project.handler_username, 'handler', settings.handler_pct));
      project.backup_names.forEach(name => {
        const u = teamUsers.find(u => u.full_name === name);
        rows.push(mkPTS(name, u?.username, 'backup', backupPer));
      });
    }

    if (rows.length) {
      const { error } = await supabase.from('incentive_disbursements').insert(rows);
      if (error) {
        // Fallback: columns not yet migrated — insert without year-tracking fields
        const legacyRows = rows.map(({ payment_year_1_paid: _y1, payment_year_2_paid: _y2, payment_year_3_paid: _y3, member_status: _ms, ...r }) => r);
        await supabase.from('incentive_disbursements').insert(legacyRows);
      }
    }
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
    void logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'update', module: 'incentive-pts', target_id: selectedProject.id, target_name: selectedProject.project_name, notes: `Biaya cadangan: ${biaya}` });
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
    void logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'update', module: 'incentive-pts', target_id: selectedProject.id, target_name: selectedProject.project_name, notes: `Backup team: ${backupSelected.join(', ')}` });
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
    void logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'update', module: 'incentive-pts', target_id: selectedProject.id, target_name: selectedProject.project_name, notes: 'Status → paid' });
    const handlerUser = teamUsers.find(u => u.username === selectedProject.handler_username || u.full_name === selectedProject.handler_name);
    if (handlerUser?.id) {
      void createNotification({ user_id: handlerUser.id, type: 'system', title: '💰 Incentive Dibayarkan', body: `Project "${selectedProject.project_name}" telah ditandai lunas oleh ${currentUser?.full_name ?? 'Admin'}.`, action_url: '/incentive-pts', ref_id: selectedProject.id, created_by: currentUser?.full_name ?? '' });
    }
    notify('success', 'Project ditandai sebagai lunas!');
    setShowPaidModal(false); fetchProjects();
  };

  const recalculateDisbursements = async () => {
    if (!selectedProject || selectedProject.biaya_cadangan <= 0) return;
    await createDisbursements(selectedProject);
    await fetchDisbursements();
    notify('success', 'Distribusi incentive diperbarui!');
  };

  const markYearPaid = async (disbId: string, year: 1 | 2 | 3) => {
    const field = year === 1 ? 'payment_year_1_paid' : year === 2 ? 'payment_year_2_paid' : 'payment_year_3_paid';
    const { error } = await supabase.from('incentive_disbursements').update({ [field]: true }).eq('id', disbId);
    if (error) { notify('error', `Gagal update: ${error.message}`); return; }
    await fetchDisbursements();
    notify('success', `Tahun ${year} ditandai lunas!`);
  };

  const markMemberResigned = async (disbId: string) => {
    if (!selectedProject) return;
    const disb = disbursements.find(d => d.id === disbId);
    if (!disb) return;
    await supabase.from('incentive_disbursements')
      .update({ member_status: 'resigned', resigned_at: new Date().toISOString() }).eq('id', disbId);
    const remainingPct =
      (disb.payment_year_1_paid ? 0 : 0.50) +
      (disb.payment_year_2_paid ? 0 : 0.35) +
      (disb.payment_year_3_paid ? 0 : 0.15);
    const remainingRp = Math.round(disb.amount_rp * remainingPct);
    if (remainingRp > 0) {
      const activeDisbs = disbursements.filter(d =>
        d.project_id === selectedProject.id && d.id !== disbId &&
        d.role_type !== 'installer' && d.member_status !== 'resigned'
      );
      if (activeDisbs.length > 0) {
        const perPerson = Math.round(remainingRp / activeDisbs.length);
        await Promise.all(activeDisbs.map(d =>
          supabase.from('incentive_disbursements').update({ amount_rp: d.amount_rp + perPerson }).eq('id', d.id)
        ));
        await supabase.from('incentive_disbursements')
          .update({ redistributed_to: activeDisbs.map(d => d.person_name) }).eq('id', disbId);
        notify('success', `Resign dicatat. Sisa ${fmtRp(remainingRp)} didistribusikan ke ${activeDisbs.length} anggota.`);
      } else {
        notify('success', `${disb.person_name} ditandai resign.`);
      }
    } else {
      notify('success', `${disb.person_name} ditandai resign. Semua sudah lunas.`);
    }
    await fetchDisbursements();
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

  // ── Mini pie chart data ──────────────────────────────────────────────────
  const statusPieData = useMemo(() => [
    { label: 'Lunas', value: filteredProjects.filter((p) => p.status === 'paid').length, color: '#10b981' },
    { label: 'Pending', value: filteredProjects.filter((p) => p.status === 'pending' && p.biaya_cadangan > 0).length, color: '#f59e0b' },
    { label: 'Belum input', value: filteredProjects.filter((p) => p.status === 'pending' && p.biaya_cadangan === 0).length, color: '#94a3b8' },
  ].filter((d) => d.value > 0), [filteredProjects]);

  const categoryPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredProjects.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
    const COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b'];
    return Object.entries(counts).map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }));
  }, [filteredProjects]);

  const divisionPieData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredProjects.forEach((p) => { const div = p.sales_division || 'Lainnya'; counts[div] = (counts[div] || 0) + 1; });
    const COLORS = ['#0ea5e9', '#06b6d4', '#14b8a6', '#84cc16', '#f97316', '#ef4444', '#ec4899', '#a855f7'];
    return Object.entries(counts).map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }));
  }, [filteredProjects]);

  // ── Export Excel ─────────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const allPersons = Array.from(new Set(rekapData.map((r) => r.person_name)));

    // Helper: add thin borders to all occupied cells in a sheet
    const addBorders = (ws: XLSX.WorkSheet) => {
      if (!ws['!ref']) return;
      const range = XLSX.utils.decode_range(ws['!ref']);
      const thin = { style: 'thin' as const, color: { rgb: 'CCCCCC' } };
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[addr]) ws[addr] = { t: 's', v: '' };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ws[addr] as any).s = { border: { top: thin, bottom: thin, left: thin, right: thin } };
        }
      }
    };

    const colCount1 = 5 + allPersons.length * 2 + 1;
    const blank1    = Array<string>(colCount1).fill('');

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

    // Footer rows (signature block)
    const half = Math.floor(colCount1 / 2);
    const fRow1 = [...blank1]; fRow1[0] = 'Dibuat oleh'; fRow1[half] = 'Menyetujui';
    const fRow2 = [...blank1]; fRow2[0] = 'Dhany Wahyu Perdana'; fRow2[half] = 'Jonny';
    const fRow3 = [...blank1]; fRow3[0] = 'Manager PTS IVP'; fRow3[half] = 'Director';

    const ws1 = XLSX.utils.aoa_to_sheet([
      [`Pengajuan Incentive Project-Project IVP — ${filterLabel}`],
      ['Saya yang bertanda tangan di bawah ini, ingin mengajukan pengeluaran Incentive Project-project IVP dengan dasar perhitungan sebagai berikut:'],
      [], headerRow1, ...rows1, totalRow1,
      [...blank1], fRow1, fRow2, fRow3,
    ]);
    ws1['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, ...allPersons.flatMap(() => [{ wch: 8 }, { wch: 16 }]), { wch: 10 }];
    addBorders(ws1);
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
      [], ['Dibuat oleh', '', 'Menyetujui'],
      ['Dhany Wahyu Perdana', '', 'Jonny'],
      ['Manager PTS IVP', '', 'Director'],
    ]);
    ws2['!cols'] = [{ wch: 22 }, ...years.flatMap(() => [{ wch: 10 }, { wch: 16 }])];
    addBorders(ws2);
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
    addBorders(ws3);
    XLSX.utils.book_append_sheet(wb, ws3, 'Summary');
    const fileName = `Incentive_PTS_${filterLabel.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    notify('success', `Export berhasil: ${fileName}`);
  };

  // ── Modal helpers ────────────────────────────────────────────────────────
  const openView       = (p: IncentiveProject) => { setSelectedProject(p); setShowViewModal(true); };
  const openInputBiaya = (p: IncentiveProject) => { setSelectedProject(p); setBiayaInput(p.biaya_cadangan > 0 ? String(p.biaya_cadangan) : ''); setCosProjectNoInput(p.cos_project_no ?? ''); setShowBiayaModal(true); };
  const openMarkPaid   = (p: IncentiveProject) => { setSelectedProject(p); setShowPaidModal(true); };

  const openSetBackup = async (p: IncentiveProject) => {
    setSelectedProject(p);
    // Auto-detect support dari reminder Troubleshooting dengan project_name yang sama
    const { data: tsData } = await supabase
      .from('reminders')
      .select('assign_name')
      .eq('project_name', p.project_name)
      .eq('category', 'Troubleshooting')
      .not('assign_name', 'is', null);

    const detected: string[] = [...new Set<string>(
      (tsData ?? [])
        .map((r: any) => r.assign_name as string)
        .filter((name: string) => name && name !== p.handler_name)
    )];

    setDetectedSupport(detected);
    // Prioritaskan auto-detected; jika tidak ada, gunakan backup yang sudah ada
    setBackupSelected(detected.length > 0 ? detected : p.backup_names);
    setShowBackupModal(true);
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center" style={{ minHeight: '100vh', backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="flex flex-col items-center gap-3 bg-white/90 rounded-2xl px-8 py-6 shadow-xl">
        <div className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#6366f1' }} />
        <p className="text-slate-500 text-sm font-semibold">Memuat Incentive PTS...</p>
      </div>
    </div>
  );

  const isFilterActive = filterLabel !== 'Semua Periode' && filterLabel !== 'Semua Tahun' && filterLabel !== 'Semua';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ fontFamily: "'Inter', sans-serif", backgroundImage: "url('/IVP_Background.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Header — stays at top, flex-shrink-0 so it never scrolls away */}
      <header className="flex-shrink-0 z-50"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '3px solid #6366f1', boxShadow: '0 2px 12px rgba(99,102,241,0.10)' }}>
        <div className="w-full px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg flex-shrink-0">💰</div>
          <div>
            <h1 className="text-base font-bold text-gray-800">Incentive PTS</h1>
            <p className="text-[11px] text-gray-400">IndoVisual Professional Tools</p>
          </div>
        </div>
      </header>

      {/* Tabs — stays below header, never scrolls */}
      <div className="flex-shrink-0 z-40"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
        <div className="w-full px-4 flex gap-1 overflow-x-auto">
          {([
            { id: 'projects', label: '📋 Projects',       adminOnly: false },
            { id: 'rekap',    label: '📊 Rekap Incentive', adminOnly: false },
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

      {/* Main content — scrollable area */}
      <main className="flex-1 overflow-y-auto">
        <div className="w-full px-4 py-4 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard icon="📋" label="Total Project"        value={String(filteredProjects.length)} sub={`${totalPaid} sudah dibayar`} color="#6366f1" />
            <StatCard icon="💵" label="Total Biaya Cadangan" value={fmtRp(totalBiaya)}               sub="Project terfilter"           color="#0ea5e9" />
            <StatCard icon="💰" label="Total Incentive"      value={fmtRp(totalIncentive)}            sub="Terdistribusi"               color="#10b981" />
          </div>

          {/* Mini Pie Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MiniPieChart data={statusPieData}   title="Status Pembayaran" icon="💳" />
            <MiniPieChart data={categoryPieData} title="Kategori Project"  icon="📋" />
            <MiniPieChart data={divisionPieData} title="Sales Division"    icon="🏢" />
          </div>

          {/* Tab content */}
          {activeTab === 'projects' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* ── Filter bar — integrated above table ── */}
              <div className="px-4 pt-4 pb-3 border-b border-gray-200 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  {/* Search */}
                  <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Cari project, handler, sales..."
                      className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent" />
                  </div>
                  {/* Status filter */}
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="all">Semua Status</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Lunas</option>
                  </select>
                  {/* Refresh button */}
                  <button onClick={fetchProjectsAndAutoSync} disabled={syncing} title="Refresh data"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-all text-xs font-semibold disabled:opacity-60">
                    <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {syncing ? 'Memuat...' : 'Refresh'}
                  </button>
                  {/* Export */}
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
              {/* ── Table ── */}
              <div className={`transition-opacity duration-300 ${syncing ? 'opacity-40' : 'opacity-100'}`}>
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
              </div>
            </div>
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
          onRecalculate={recalculateDisbursements}
          onMarkYearPaid={canInputBiaya ? markYearPaid : undefined}
          onMarkResigned={isAdmin ? markMemberResigned : undefined}
        />
      )}
      {showBiayaModal && selectedProject && (
        <BiayaModal
          project={selectedProject}
          settings={settings}
          teamUsers={teamUsers}
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
          detectedSupport={detectedSupport}
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
