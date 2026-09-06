'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useCurrentUser, type CurrentUser } from '@/lib/use-current-user';
import { logAudit } from '@/lib/audit';
import { createNotificationForAdmins } from '@/lib/notifications';
import {
  PageHeader, LoadingScreen, Toast, type Notif,
  ConfirmDialog, type ConfirmState, EmptyState,
  ViewIconBtn, EditIconBtn, DeleteIconBtn, ActionGroup,
  MobileListCard, MobileCardBadge, MiniPieChart, AuditTrailPanel, ModalPortal } from '@/components/shared';
import { ProjectDetailView, SectionLabel } from './_components/ProjectDetailView';
import { exportProjectToExcel } from './_components/excel-export';
import {
  THEME, PALETTE, fontMono, ProgressProject, ProgressLocation, ProgressComponent, ProgressIssue,
  ProjectDetail, ProjectStatus, ComponentState, Severity, ProgressAuditEntry,
  STATUS_CONFIG, SEVERITY_CONFIG, COMPONENT_STATE_CONFIG, COMPONENT_STATES,
  averageProgress, componentsOf, formatDatetime, computeProgress, stateBreakdown,
  newShareToken, shareUrl, canEditProjectProgress,
  projectStatusBreakdown, projectProgressBreakdown, projectIssueBreakdown,
  resolveEditorMode, editableLocationIds, type EditorMode,
  timelineInfo, formatDate, resolveVisibility,
  projectHealth, type ProgressLocationLite,
} from './_components/shared';
import { isAssignablePTSTeam } from '@/lib/teams';
import { compressImage } from '@/lib/image-compress';

function ProjectProgressPageInner() {
  const currentUser = useCurrentUser();
  const canEdit = canEditProjectProgress(currentUser?.role, currentUser?.team_type, currentUser?.access_level);

  const [projects, setProjects] = useState<ProgressProject[]>([]);
  const [locCount, setLocCount] = useState<Record<string, { total: number; avg: number; issues: number; locsLite: ProgressLocationLite[] }>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Notif | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');

  // Modal detail
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Modal form proyek
  const [projectForm, setProjectForm] = useState<Partial<ProgressProject> | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal share
  const [shareFor, setShareFor] = useState<ProgressProject | null>(null);

  // Daftar PIC untuk dropdown lokasi - Team PTS assignable (lihat lib/teams.ts)
  const [teamUsers, setTeamUsers] = useState<{ id: string; full_name: string }[]>([]);
  /**
   * Daftar Sales untuk dropdown - sumber yang SAMA dengan Reminder Schedule
   * (users role='guest'), supaya nama yang tersimpan identik. Kecocokan nama
   * inilah yang menentukan proyek mana yang terlihat oleh tiap sales, jadi
   * mengetik bebas tidak boleh: satu huruf beda = proyeknya hilang dari daftar
   * miliknya.
   */
  const [salesUsers, setSalesUsers] = useState<{ id: string; full_name: string; sales_division: string | null }[]>([]);
  // Perubahan editor yang belum disimpan - dipakai untuk mencegah modal
  // tertutup tanpa sengaja dan menghilangkan pekerjaan.
  const [editorDirty, setEditorDirty] = useState(false);

  const notify = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3200);
  };

  // Load daftar proyek + ringkasan agregat
  const fetchProjects = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);

    // Isolasi antar-Sales
    // Daftar proyek bersifat rahasia antar-sales. Penyaringan dilakukan DI
    // QUERY, bukan saat render - kalau hanya disaring saat render, data proyek
    // sales lain tetap terkirim ke browser dan terbaca lewat DevTools.
    // Konsekuensinya pencarian pun otomatis aman: kotak Cari hanya menyaring
    // data yang memang sudah menjadi haknya.
    const vis = resolveVisibility(currentUser.role, currentUser.full_name);

    let allowedIds: string[] | null = null; // null = tanpa batas (admin/team)
    if (vis.scope === 'own_sales') {
      if (!vis.salesName) { setProjects([]); setLocCount({}); setLoading(false); return; }
      const [ownLocRes, ownProjRes] = await Promise.all([
        // Lokasi yang mencatat namanya - proyeknya ikut terlihat.
        supabase.from('progress_locations').select('project_id').eq('sales_name', vis.salesName),
        // Proyek yang mencatat namanya (mis. hasil auto-create dari reminder).
        supabase.from('progress_projects').select('id').eq('sales_name', vis.salesName),
      ]);
      allowedIds = [...new Set([
        ...(ownLocRes.data ?? []).map((l: { project_id: string }) => l.project_id),
        ...(ownProjRes.data ?? []).map((p: { id: string }) => p.id),
      ])];
      if (allowedIds.length === 0) { setProjects([]); setLocCount({}); setLoading(false); return; }
    }

    const pQuery = supabase.from('progress_projects').select('*').order('created_at', { ascending: false });
    // status/start_date/target_date ditambahkan (bukan cuma progress) supaya
    // Project Health bisa dihitung di listing tanpa query terpisah per proyek.
    const lQuery = supabase.from('progress_locations').select('project_id,progress,status,start_date,target_date');
    const iQuery = supabase.from('progress_issues').select('project_id');

    const [pRes, lRes, iRes] = await Promise.all([
      allowedIds ? pQuery.in('id', allowedIds) : pQuery,
      allowedIds ? lQuery.in('project_id', allowedIds) : lQuery,
      allowedIds ? iQuery.in('project_id', allowedIds) : iQuery,
    ]);
    const list = (pRes.data ?? []) as ProgressProject[];
    setProjects(list);

    const agg: Record<string, { total: number; avg: number; issues: number; locsLite: ProgressLocationLite[] }> = {};
    for (const p of list) agg[p.id] = { total: 0, avg: 0, issues: 0, locsLite: [] };
    const sums: Record<string, number> = {};
    type LiteRow = { project_id: string; progress: number; status: ProjectStatus; start_date: string | null; target_date: string | null };
    for (const l of (lRes.data ?? []) as LiteRow[]) {
      if (!agg[l.project_id]) continue;
      agg[l.project_id].total += 1;
      sums[l.project_id] = (sums[l.project_id] ?? 0) + (l.progress ?? 0);
      agg[l.project_id].locsLite.push({ status: l.status, progress: l.progress, start_date: l.start_date, target_date: l.target_date });
    }
    for (const id of Object.keys(agg)) {
      agg[id].avg = agg[id].total > 0 ? Math.round(sums[id] / agg[id].total) : 0;
    }
    for (const is of (iRes.data ?? []) as { project_id: string }[]) {
      if (agg[is.project_id]) agg[is.project_id].issues += 1;
    }
    setLocCount(agg);
    setLoading(false);
  }, [currentUser]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Daftar PIC: hanya Team PTS yang assignable, tanpa admin/superadmin -
  // pola yang sama dengan dropdown handler di Request Schedule.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('users')
        .select('id, full_name, role, team_type, sales_division').order('full_name');
      if (!data) return;
      const rows = data as { id: string; full_name: string; role: string; team_type?: string; sales_division?: string | null }[];
      setTeamUsers(
        rows
          .filter(u => isAssignablePTSTeam(u.team_type) && u.role !== 'admin' && u.role !== 'superadmin')
          .map(u => ({ id: u.id, full_name: u.full_name })),
      );
      // Sales = role 'guest', persis seperti dropdown Sales di Reminder Schedule.
      setSalesUsers(
        rows.filter(u => u.role === 'guest')
          .map(u => ({ id: u.id, full_name: u.full_name, sales_division: u.sales_division ?? null })),
      );
    })();
  }, []);

  // Buka detail
  const openDetail = async (project: ProgressProject) => {
    setDetailLoading(true);
    setEditMode(false);
    setDetail({ project, locations: [], components: [], issues: [] });
    const [lRes, iRes] = await Promise.all([
      supabase.from('progress_locations').select('*').eq('project_id', project.id).order('sort_order'),
      supabase.from('progress_issues').select('*').eq('project_id', project.id).order('sort_order'),
    ]);
    const locations = (lRes.data ?? []) as ProgressLocation[];
    let components: ProgressComponent[] = [];
    if (locations.length > 0) {
      const { data } = await supabase.from('progress_components')
        .select('*').in('location_id', locations.map(l => l.id)).order('sort_order');
      components = (data ?? []) as ProgressComponent[];
    }
    // Riwayat status/state se-proyek - dipakai ProjectDetailView (tampilan
    // "Lihat") untuk menggambar alur mendatar tanpa komponennya fetch sendiri.
    const idsRiwayat = [project.id, ...locations.map(l => l.id), ...components.map(c => c.id)];
    let auditTrail: ProgressAuditEntry[] = [];
    if (idsRiwayat.length > 0) {
      const { data } = await supabase.from('audit_trail')
        .select('id, target_id, user_name, action, target_name, old_value, new_value, notes, created_at')
        .in('target_id', idsRiwayat).eq('module', 'project-progress')
        .order('created_at', { ascending: false }).limit(500);
      auditTrail = (data ?? []) as ProgressAuditEntry[];
    }
    setDetail({ project, locations, components, issues: (iRes.data ?? []) as ProgressIssue[], auditTrail });
    setDetailLoading(false);
  };

  /** Tarik seluruh isi 1 proyek lalu kirim ke Excel - dipakai tabel & kartu mobile. */
  const handleExport = async (p: ProgressProject) => {
    const [lRes, iRes] = await Promise.all([
      supabase.from('progress_locations').select('*').eq('project_id', p.id).order('sort_order'),
      supabase.from('progress_issues').select('*').eq('project_id', p.id).order('sort_order'),
    ]);
    const locations = (lRes.data ?? []) as ProgressLocation[];
    let comps: ProgressComponent[] = [];
    if (locations.length > 0) {
      const { data } = await supabase.from('progress_components')
        .select('*').in('location_id', locations.map(l => l.id)).order('sort_order');
      comps = (data ?? []) as ProgressComponent[];
    }
    exportProjectToExcel({ project: p, locations, components: comps, issues: (iRes.data ?? []) as ProgressIssue[] });
  };

  /*
    Deep-link dari notifikasi (?open=<id lokasi>): buka proyek yang MEMUAT
    lokasi itu. Notifikasi "Lokasi X diblokir" membawa id lokasinya, bukan
    id proyeknya - jadi proyeknya dicari lebih dulu lewat progress_locations,
    baru detailnya dibuka. Tanpa ini penerimanya mendarat di daftar proyek
    dan harus menebak lokasi itu ada di proyek yang mana.
  */
  const searchParams = useSearchParams();
  const sudahBukaDariNotif = useRef(false);
  useEffect(() => {
    if (sudahBukaDariNotif.current) return;
    const openId = searchParams.get('open');
    if (!openId || projects.length === 0) return;
    sudahBukaDariNotif.current = true;
    void (async () => {
      //  id-nya bisa id proyek (notifikasi lain kelak) atau id lokasi.
      const langsung = projects.find(p => p.id === openId);
      if (langsung) { await openDetail(langsung); return; }
      const { data } = await supabase.from('progress_locations')
        .select('project_id').eq('id', openId).maybeSingle();
      const induk = data?.project_id ? projects.find(p => p.id === data.project_id) : null;
      if (induk) await openDetail(induk);
    })();
  }, [searchParams, projects]);

  const reloadDetail = async () => {
    if (!detail) return;
    const { data: p } = await supabase.from('progress_projects').select('*').eq('id', detail.project.id).maybeSingle();
    await openDetailKeepMode((p as ProgressProject) ?? detail.project);
  };

  const openDetailKeepMode = async (project: ProgressProject) => {
    const wasEdit = editMode;
    await openDetail(project);
    setEditMode(wasEdit);
  };

  /** Tutup modal detail - konfirmasi dulu bila ada perubahan belum tersimpan. */
  const closeDetail = () => {
    if (!editorDirty) { setDetail(null); setEditMode(false); return; }
    setConfirmState({
      message: 'Tutup tanpa menyimpan?',
      description: 'Ada perubahan yang belum disimpan. Kalau ditutup sekarang, perubahan itu hilang.',
      confirmLabel: 'Tutup & buang perubahan',
      danger: true,
      onConfirm: () => {
        setConfirmState(null);
        setEditorDirty(false);
        setEditMode(false);
        setDetail(null);
      },
    });
  };

  /** Keluar dari mode edit - juga dijaga bila masih ada perubahan. */
  const exitEditMode = () => {
    if (!editorDirty) { setEditMode(false); return; }
    setConfirmState({
      message: 'Keluar dari mode edit?',
      description: 'Ada perubahan yang belum disimpan dan akan hilang.',
      confirmLabel: 'Keluar & buang perubahan',
      danger: true,
      onConfirm: () => { setConfirmState(null); setEditorDirty(false); setEditMode(false); },
    });
  };

  // CRUD proyek
  const saveProject = async () => {
    if (!projectForm?.name?.trim()) { notify('error', 'Nama proyek wajib diisi.'); return; }
    setSaving(true);
    const payload = {
      name: projectForm.name.trim(),
      client: projectForm.client?.trim() || null,
      description: projectForm.description?.trim() || null,
      status: projectForm.status ?? 'in_progress',
      start_date: projectForm.start_date || null,
      target_date: projectForm.target_date || null,
      sales_name: projectForm.sales_name?.trim() || null,
      sales_division: projectForm.sales_division?.trim() || null,
    };
    if (projectForm.id) {
      const { error } = await supabase.from('progress_projects').update(payload).eq('id', projectForm.id);
      if (error) { notify('error', 'Gagal menyimpan: ' + error.message); setSaving(false); return; }
      notify('success', 'Proyek diperbarui.');
      // Status proyek dibandingkan dengan data SEBELUM edit (dari daftar yang
      // sudah dimuat) - payload di atas selalu berisi status baru, jadi tidak
      // bisa dipakai sendiri untuk tahu apakah nilainya benar-benar berubah.
      const before = projects.find(p => p.id === projectForm.id);
      if (before && before.status !== payload.status) {
        logAudit({
          user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
          action: 'status_change', module: 'project-progress',
          target_id: projectForm.id, target_name: payload.name,
          old_value: STATUS_CONFIG[before.status]?.label ?? before.status,
          new_value: STATUS_CONFIG[payload.status]?.label ?? payload.status,
        }).catch(() => {});
      }
    } else {
      const { data, error } = await supabase.from('progress_projects')
        .insert([{ ...payload, created_by: currentUser?.full_name ?? null }])
        .select('id').single();
      if (error) { notify('error', 'Gagal menyimpan: ' + error.message); setSaving(false); return; }
      notify('success', 'Proyek dibuat.');
      logAudit({
        user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
        action: 'create', module: 'project-progress',
        target_id: (data as { id: string }).id, target_name: payload.name,
      }).catch(() => {});
    }
    setSaving(false);
    setProjectForm(null);
    fetchProjects();
  };

  const deleteProject = (p: ProgressProject) => {
    setConfirmState({
      message: 'Hapus Proyek?',
      description: `"${p.name}" beserta seluruh lokasi, komponen, dan isu di dalamnya akan dihapus permanen.`,
      confirmLabel: 'Hapus',
      danger: true,
      onConfirm: async () => {
        setConfirmState(null);
        const { error } = await supabase.from('progress_projects').delete().eq('id', p.id);
        if (error) { notify('error', 'Gagal menghapus: ' + error.message); return; }
        notify('success', 'Proyek dihapus.');
        if (detail?.project.id === p.id) setDetail(null);
        fetchProjects();
      },
    });
  };

  // Share link
  const toggleShare = async (p: ProgressProject, enable: boolean) => {
    const token = p.share_token ?? newShareToken();
    const { error } = await supabase.from('progress_projects')
      .update({ share_token: token, share_enabled: enable }).eq('id', p.id);
    if (error) { notify('error', 'Gagal memperbarui link: ' + error.message); return; }
    const updated = { ...p, share_token: token, share_enabled: enable };
    setShareFor(updated);
    setProjects(prev => prev.map(x => x.id === p.id ? updated : x));
    if (detail?.project.id === p.id) setDetail({ ...detail, project: updated });
    notify('success', enable ? 'Link View-Only aktif.' : 'Link dinonaktifkan.');
  };

  const regenerateToken = async (p: ProgressProject) => {
    const token = newShareToken();
    const { error } = await supabase.from('progress_projects')
      .update({ share_token: token, share_enabled: true }).eq('id', p.id);
    if (error) { notify('error', 'Gagal membuat ulang link: ' + error.message); return; }
    const updated = { ...p, share_token: token, share_enabled: true };
    setShareFor(updated);
    setProjects(prev => prev.map(x => x.id === p.id ? updated : x));
    notify('success', 'Link lama dinonaktifkan, link baru dibuat.');
  };

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      notify('success', 'Link disalin ke clipboard.');
    } catch {
      notify('error', 'Gagal menyalin. Salin manual dari kotak di atas.');
    }
  };

  // Filter
  /**
   * Hak sunting untuk proyek yang sedang dibuka:
   * 'full' untuk admin/superadmin, 'pic' untuk anggota team yang di-tag PIC
   * minimal satu lokasi, null = hanya lihat.
   */
  const detailMode: EditorMode | null = useMemo(
    () => detail ? resolveEditorMode(detail.locations, currentUser?.role, currentUser?.full_name, currentUser?.team_type, currentUser?.access_level) : null,
    [detail, currentUser],
  );
  const detailEditableIds = useMemo(
    () => detail ? editableLocationIds(detail.locations, currentUser?.role, currentUser?.full_name, currentUser?.team_type, currentUser?.access_level) : new Set<string>(),
    [detail, currentUser],
  );

  /** Rata-rata progres seluruh project - angka tengah pie "Progres per Project". */
  const overallAvg = useMemo(() => {
    const vals = projects.map(p => locCount[p.id]?.avg ?? 0);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  }, [projects, locCount]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q)
        || (p.client ?? '').toLowerCase().includes(q)
        || (p.sales_name ?? '').toLowerCase().includes(q);
    });
  }, [projects, search, statusFilter]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{
      backgroundImage: `url('/IVP_Background.png')`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      {/* Tint TIPIS, bukan lapisan putih pekat — biar background IVP tetap
          kelihatan, cuma teks & kartu di atasnya tetap terbaca. */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.08)' }} />
      {/* TANPA z-index — disengaja. `relative z-10` di sini dulu membentuk
          stacking context, sehingga z-index SEMUA modal di dalamnya cuma
          dibandingkan sesama isi pembungkus ini, bukan dengan overlay yang
          di-portal ke <body>. Akibatnya modal z-[1100] bisa tampil DI BELAKANG
          modal z-[1000] yang di-portal. Urutan cat terhadap tint di atas tetap
          aman karena elemen ini datang belakangan di DOM. */}
      <div className="relative flex flex-col flex-1 overflow-hidden">

        {toast && <Toast notif={toast} />}

        <PageHeader icon="📊" title="Project Progress" subtitle="Progres instalasi per proyek & lokasi"
          color={THEME.color} colorLight={THEME.colorLight}>
          {canEdit && (
            <button onClick={() => setProjectForm({ status: 'in_progress' })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 hover:opacity-90"
              style={{ background: THEME.gradient, boxShadow: `0 4px 14px ${THEME.shadow}` }}>
              <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Tambah Project
            </button>
          )}
        </PageHeader>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 flex flex-col gap-4">

            {/* ── Ringkasan semua project ── */}
            {projects.length > 0 && (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                <MiniPieChart data={projectStatusBreakdown(projects)}
                  title="Distribusi Status Project" icon="📁" />
                {/* Nilai = persentase, jadi total slice tidak bermakna → pusat
                    diisi rata-rata seluruh project. */}
                <MiniPieChart data={projectProgressBreakdown(projects, locCount)}
                  title="Progres per Project" icon="📊"
                  centerValue={`${overallAvg}%`} centerLabel="RATA-RATA" valueSuffix="%" />
                <MiniPieChart data={projectIssueBreakdown(projects, locCount)}
                  title="Isu Terbuka per Project" icon="⚠️" />
              </div>
            )}

            {/* ── Filter bar ── */}
            <div className="flex flex-wrap items-center gap-2">
              <input aria-label="Cari nama project atau client…" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama project atau client…"
                className="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-md text-sm font-medium outline-none"
                style={{ border: `1px solid ${PALETTE.borderStrong}`, background: PALETTE.surface, color: PALETTE.ink }} />
              {(['all', 'in_progress', 'done', 'blocked'] as const).map(s => {
                const active = statusFilter === s;
                const label = s === 'all' ? 'Semua' : STATUS_CONFIG[s].label;
                return (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className="px-3.5 py-2 rounded-md text-xs font-bold transition-all"
                    style={active
                      ? { background: PALETTE.ink, color: PALETTE.paper, border: '1px solid transparent' }
                      : { background: PALETTE.surface, color: PALETTE.inkSoft, border: `1px solid ${PALETTE.borderStrong}` }}>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* ── List Project ── */}
            {filtered.length === 0 ? (
              <EmptyState icon="📊" title="Belum ada project"
                description={canEdit ? 'Klik "Tambah Project" untuk membuat project progress pertama.' : 'Belum ada project yang bisa ditampilkan.'} />
            ) : (
              <div className="rounded-md overflow-hidden"
                style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>

                {/* ── MOBILE: kartu daftar ── */}
                <div className="md:hidden divide-y divide-gray-100">
                  {filtered.map(p => {
                    const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.in_progress;
                    const agg = locCount[p.id] ?? { total: 0, avg: 0, issues: 0, locsLite: [] };
                    const health = projectHealth(p, agg.locsLite);
                    return (
                      <MobileListCard key={p.id}
                        title={p.name}
                        meta={<span>{formatDatetime(p.updated_at)}</span>}
                        accent={cfg.border}
                        badges={
                          <>
                            <MobileCardBadge style={{ background: health.bg, color: health.color, border: `1px solid ${health.border}` }}>
                              {health.label}
                            </MobileCardBadge>
                            <MobileCardBadge style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                              {cfg.label}
                            </MobileCardBadge>
                          </>
                        }
                        fields={[
                          { label: 'Client', value: p.client || '—' },
                          { label: 'Sales', value: p.sales_name || '—' },
                          { label: 'Lokasi', value: `${agg.total} lokasi` },
                          { label: 'Isu', value: `${agg.issues} isu` },
                          { label: 'Progres', value: `${agg.avg}%`, valueClass: 'font-black' },
                          { label: 'Timeline', value: timelineInfo(p).label, span2: true },
                        ]}
                        actions={<RowActions p={p}
                          canEditRow={canEdit || p.sales_name === currentUser?.full_name}
                          canDeleteRow={canEdit}
                          onView={() => openDetail(p)} onExport={() => handleExport(p)}
                          onShare={() => setShareFor(p)} onEdit={() => setProjectForm(p)}
                          onDelete={() => deleteProject(p)} />}
                      />
                    );
                  })}
                </div>

                {/* ── DESKTOP: tabel listing ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '3%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '11%' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: PALETTE.surfaceSunken, borderBottom: `1px solid ${PALETTE.border}` }}>
                        {['No', 'Nama Project', 'Client', 'Sales', 'Status', 'Health', 'Timeline', 'Lokasi', 'Progres'].map((h, i) => (
                          <th key={h} className={`px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200 ${i === 0 ? 'text-center' : 'text-left'}`}>
                            {h}
                          </th>
                        ))}
                        <th className="px-1 py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wide">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p, idx) => {
                        const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.in_progress;
                        const agg = locCount[p.id] ?? { total: 0, avg: 0, issues: 0, locsLite: [] };
                        const health = projectHealth(p, agg.locsLite);
                        return (
                          <tr key={p.id}
                            className="border-b border-gray-200 hover:bg-cyan-50/40 transition-colors cursor-pointer"
                            onClick={() => openDetail(p)}>
                            <td className="px-3 py-3 border-r border-gray-200 text-center align-middle">
                              <span className="text-[11px] font-bold text-gray-500">{idx + 1}</span>
                            </td>
                            <td className="px-3 py-3 border-r border-gray-200 align-middle">
                              <p className="text-xs font-bold text-gray-800 leading-snug break-words">
                                {p.name}
                                {p.origin === 'auto_reminder' && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold align-middle"
                                    style={{ background: '#ecfeff', color: '#0e7490', border: '1px solid #a5f3fc' }}
                                    title="Dibuat otomatis dari Reminder Schedule">AUTO</span>
                                )}
                              </p>
                              <p className="text-[10px] text-gray-400 font-semibold mt-0.5" style={fontMono}>{formatDatetime(p.updated_at)}</p>
                            </td>
                            <td className="px-3 py-3 border-r border-gray-200 align-middle">
                              <span className="text-[11px] font-semibold text-gray-600">{p.client || '—'}</span>
                            </td>
                            <td className="px-3 py-3 border-r border-gray-200 align-middle">
                              {p.sales_name ? (
                                <>
                                  <p className="text-[11px] font-semibold text-gray-700 truncate">{p.sales_name}</p>
                                  {p.sales_division && (
                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">{p.sales_division}</p>
                                  )}
                                </>
                              ) : <span className="text-[11px] text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-3 border-r border-gray-200 align-middle">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap"
                                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-3 py-3 border-r border-gray-200 align-middle">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap" title={health.reason}
                                style={{ background: health.bg, color: health.color, border: `1px solid ${health.border}` }}>
                                {health.label}
                              </span>
                            </td>
                            <td className="px-3 py-3 border-r border-gray-200 align-middle">
                              {(() => {
                                const t = timelineInfo(p);
                                if (t.state === 'no_date') return <span className="text-[10px] text-gray-300 font-semibold">—</span>;
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold self-start whitespace-nowrap"
                                      style={{ background: t.bg, color: t.color }}>{t.label}</span>
                                    <span className="text-[9px] text-gray-400 font-semibold" style={fontMono}>
                                      {p.target_date ? `Target ${formatDate(p.target_date)}` : 'Tanpa target'}
                                    </span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-3 py-3 border-r border-gray-200 align-middle">
                              <span className="text-[11px] font-semibold text-gray-600">{agg.total} lokasi</span>
                              {agg.issues > 0 && (
                                <span className="block text-[10px] font-bold text-amber-600">{agg.issues} isu</span>
                              )}
                            </td>
                            <td className="px-3 py-3 border-r border-gray-200 align-middle">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-200 min-w-[40px]">
                                  <div className="h-full rounded-full" style={{ width: `${agg.avg}%`, background: THEME.color }} />
                                </div>
                                <span className="text-[11px] font-bold flex-shrink-0" style={{ ...fontMono, color: THEME.color }}>{agg.avg}%</span>
                              </div>
                            </td>
                            <td className="px-1 py-3 align-middle" onClick={e => e.stopPropagation()}>
                              <RowActions p={p}
                                canEditRow={canEdit || p.sales_name === currentUser?.full_name}
                                canDeleteRow={canEdit}
                                onView={() => openDetail(p)} onExport={() => handleExport(p)}
                                onShare={() => setShareFor(p)} onEdit={() => setProjectForm(p)}
                                onDelete={() => deleteProject(p)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: `1px solid ${PALETTE.border}` }}>
                  <span className="text-xs" style={{ color: PALETTE.inkFaint }}>{filtered.length} project</span>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ══ MODAL DETAIL ══ */}
      {detail && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 z-[1000]"
          onClick={e => { if (e.target === e.currentTarget) closeDetail(); }}>
          <div className="w-full h-full flex flex-col overflow-hidden relative" style={{
            backgroundImage: `url('/IVP_Background.png')`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.10)' }} />
            <div className="px-5 py-3.5 flex items-center justify-between gap-3 flex-shrink-0 relative z-10"
              style={{ background: PALETTE.surface, borderBottom: `1px solid ${PALETTE.border}` }}>
              <div className="min-w-0">
                <p className="font-bold text-base truncate" style={{ color: PALETTE.ink }}>{detail.project.name}</p>
                <p className="text-[11px] font-semibold" style={{ color: PALETTE.inkFaint }}>
                  {detail.project.client ? `${detail.project.client} · ` : ''}
                  {detail.locations.length} lokasi · rata-rata <span style={fontMono}>{averageProgress(detail.locations)}%</span>
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {detailMode && (
                  <button onClick={() => editMode ? exitEditMode() : setEditMode(true)}
                    className="px-3 py-1.5 rounded-md text-[11px] font-bold transition-all"
                    style={editMode
                      ? { background: THEME.color, color: '#fff', border: '1px solid transparent' }
                      : { background: PALETTE.surface, color: PALETTE.inkSoft, border: `1px solid ${PALETTE.borderStrong}` }}>
                    {editMode ? (editorDirty ? '● Keluar Edit' : '✓ Selesai Edit') : '✏️ Edit'}
                  </button>
                )}
                <button onClick={() => exportProjectToExcel(detail)}
                  className="px-3 py-1.5 rounded-md text-[11px] font-bold transition-all"
                  style={{ background: PALETTE.surface, color: PALETTE.inkSoft, border: `1px solid ${PALETTE.borderStrong}` }}>
                  ⬇ Excel
                </button>
                <button aria-label="Tutup" onClick={closeDetail}
                  className="w-8 h-8 rounded-md font-bold flex items-center justify-center transition-all"
                  style={{ background: PALETTE.surface, color: PALETTE.inkSoft, border: `1px solid ${PALETTE.borderStrong}` }}>✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 relative z-10">
              {detailLoading ? (
                <div className="rounded-md py-12 text-center"
                  style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>
                  <p className="text-sm font-bold" style={{ color: PALETTE.inkFaint }}>Memuat detail…</p>
                </div>
              ) : editMode && detailMode ? (
                <DetailEditor
                  // key: paksa draft dibangun ulang HANYA saat ganti proyek /
                  // setelah simpan - bukan tiap render, supaya tidak berkedip.
                  key={`${detail.project.id}-${detail.locations.length}-${detail.components.length}-${detail.issues.length}`}
                  detail={detail} teamUsers={teamUsers} salesUsers={salesUsers}
                  mode={detailMode ?? 'pic'} editableIds={detailEditableIds}
                  currentUser={currentUser}
                  onSaved={() => { setEditorDirty(false); reloadDetail(); fetchProjects(); }}
                  onDirtyChange={setEditorDirty}
                  notify={notify} setConfirmState={setConfirmState} />
              ) : (
                <ProjectDetailView detail={detail} maxKolomLokasi={2} />
              )}
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* ══ MODAL FORM PROYEK ══ */}
      {projectForm && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1100]">
          <div className="rounded-md shadow-2xl w-full max-w-lg overflow-hidden" style={{ background: PALETTE.surface }}>
            <div className="px-6 py-4" style={{ borderBottom: `1px solid ${PALETTE.border}` }}>
              <h3 className="font-bold text-base" style={{ color: PALETTE.ink }}>
                {projectForm.id ? '✏️ Edit Project' : '➕ Tambah Project'}
              </h3>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <Field label="Nama Project *">
                <input value={projectForm.name ?? ''} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                  placeholder="mis. Instalasi AV BPKP" className={inputCls} />
              </Field>
              <Field label="Client">
                <input value={projectForm.client ?? ''} onChange={e => setProjectForm({ ...projectForm, client: e.target.value })}
                  placeholder="mis. BPKP" className={inputCls} />
              </Field>
              {/* Sales menentukan siapa yang boleh melihat proyek ini. Dipilih
                  dari daftar, bukan diketik: satu huruf beda berarti proyeknya
                  tidak muncul di daftar sales yang bersangkutan. */}
              <Field label="Sales">
                <select aria-label="— Tanpa Sales —"
                  value={projectForm.sales_name ?? ''}
                  onChange={e => {
                    const dipilih = salesUsers.find(u => u.full_name === e.target.value);
                    setProjectForm({
                      ...projectForm,
                      sales_name: e.target.value || null,
                      sales_division: dipilih?.sales_division ?? null,
                    });
                  }}
                  className={inputCls}>
                  <option value="">— Tanpa Sales —</option>
                  {salesUsers.map(u => (
                    <option key={u.id} value={u.full_name}>
                      {u.full_name}{u.sales_division ? ` · ${u.sales_division}` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-gray-400 font-medium">
                  Hanya Sales ini yang dapat melihat proyek tersebut. Dikosongkan = hanya admin &amp; team.
                </p>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tanggal Mulai">
                  <input type="date" value={projectForm.start_date ?? ''}
                    onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value || null })}
                    className={inputCls} />
                </Field>
                <Field label="Target Selesai">
                  <input type="date" value={projectForm.target_date ?? ''}
                    min={projectForm.start_date ?? undefined}
                    onChange={e => setProjectForm({ ...projectForm, target_date: e.target.value || null })}
                    className={inputCls} />
                </Field>
              </div>
              <Field label="Status">
                <select value={projectForm.status ?? 'in_progress'}
                  onChange={e => setProjectForm({ ...projectForm, status: e.target.value as ProjectStatus })}
                  className={inputCls}>
                  {(['in_progress', 'done', 'blocked'] as ProjectStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Deskripsi">
                <textarea value={projectForm.description ?? ''} rows={3}
                  onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                  placeholder="Catatan singkat status lapangan…" className={inputCls} />
              </Field>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setProjectForm(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">
                  Batal
                </button>
                <button onClick={saveProject} disabled={saving}
                  className="flex-[2] py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
                  style={{ background: THEME.gradient }}>
                  {saving ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* ══ MODAL SHARE ══ */}
      {shareFor && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1100]">
          <div className="rounded-md shadow-2xl w-full max-w-lg overflow-hidden" style={{ background: PALETTE.surface }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${PALETTE.border}` }}>
              <h3 className="font-bold text-base" style={{ color: PALETTE.ink }}>🔗 Share View-Only</h3>
              <button aria-label="Tutup" onClick={() => setShareFor(null)} className="font-bold" style={{ color: PALETTE.inkFaint }}>✕</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                Link ini bisa dibuka <b>tanpa login</b> dan hanya menampilkan progres
                (tidak bisa diubah). Matikan kapan saja untuk menonaktifkan link.
              </p>

              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                <div>
                  <p className="text-xs font-black text-gray-700">Status link</p>
                  <p className="text-[11px] font-semibold" style={{ color: shareFor.share_enabled ? '#059669' : '#94a3b8' }}>
                    {shareFor.share_enabled ? '● Aktif — bisa diakses publik' : '○ Nonaktif'}
                  </p>
                </div>
                <button onClick={() => toggleShare(shareFor, !shareFor.share_enabled)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all"
                  style={{ background: shareFor.share_enabled ? '#64748b' : 'linear-gradient(135deg,#059669,#047857)' }}>
                  {shareFor.share_enabled ? 'Matikan' : 'Aktifkan'}
                </button>
              </div>

              {shareFor.share_enabled && shareFor.share_token && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Link</p>
                    <div className="flex gap-2">
                      <input readOnly value={shareUrl(shareFor.share_token)}
                        onFocus={e => e.currentTarget.select()}
                        className="flex-1 px-3 py-2.5 rounded-xl text-[11px] font-mono border-2 border-gray-200 bg-gray-50 outline-none" />
                      <button onClick={() => copyLink(shareFor.share_token!)}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all"
                        style={{ background: THEME.gradient }}>
                        Salin
                      </button>
                    </div>
                  </div>
                  <button onClick={() => regenerateToken(shareFor)}
                    className="text-[11px] font-bold text-gray-500 hover:text-rose-600 transition-all self-start">
                    ↻ Buat ulang link (link lama langsung mati)
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </div>
  );
}

// Editor detail (lokasi / komponen / isu)

/**
 * Editor memakai DRAFT LOKAL: perubahan hanya mengubah state di memori sampai
 * "Simpan Perubahan" ditekan. Menyimpan tiap kali field kehilangan fokus
 * memaksa detail dimuat ulang, dan tampilan berkedip di tengah pengetikan.
 * Baris baru diberi id sementara berawalan "new-" supaya saat simpan bisa
 * dipisahkan antara INSERT dan UPDATE.
 */

type DraftComponent = { id: string; label: string; state: ComponentState; weight: number; photo_url: string | null; photo_thumb_url: string | null };
type DraftLocation = {
  id: string; name: string; pic: string | null; status: ProjectStatus;
  note: string | null; note_flag: boolean;
  start_date: string | null; target_date: string | null;
  sales_name: string | null; sales_division: string | null;
  components: DraftComponent[];
};
type DraftIssue = {
  id: string; location_label: string | null; issue: string;
  severity: Severity; note: string | null;
};

const tempId = () => `new-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
const isNew = (id: string) => id.startsWith('new-');

function buildDraft(detail: ProjectDetail): { locations: DraftLocation[]; issues: DraftIssue[] } {
  return {
    locations: [...detail.locations]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(l => ({
        id: l.id, name: l.name, pic: l.pic, status: l.status,
        note: l.note, note_flag: l.note_flag,
        start_date: l.start_date, target_date: l.target_date,
        sales_name: l.sales_name, sales_division: l.sales_division,
        components: componentsOf(detail.components, l.id)
          .map(c => ({ id: c.id, label: c.label, state: c.state, weight: c.weight ?? 1, photo_url: c.photo_url ?? null, photo_thumb_url: c.photo_thumb_url ?? null })),
      })),
    issues: [...detail.issues]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(i => ({
        id: i.id, location_label: i.location_label, issue: i.issue,
        severity: i.severity, note: i.note,
      })),
  };
}

function DetailEditor({ detail, teamUsers, salesUsers, mode, editableIds, currentUser, onSaved, onDirtyChange, notify, setConfirmState }: {
  detail: ProjectDetail;
  teamUsers: { id: string; full_name: string }[];
  salesUsers: { id: string; full_name: string; sales_division: string | null }[];
  /**
   * 'full' = admin/superadmin: seluruh struktur proyek.
   * 'pic'  = anggota team yang di-tag PIC: HANYA progres lokasinya sendiri -
   *          status komponen, foto evidence, dan catatan. Tidak boleh menambah/
   *          menghapus lokasi & komponen, mengubah PIC/status lokasi, atau
   *          menyunting rekap isu.
   */
  mode: EditorMode;
  editableIds: Set<string>;
  /** Dipakai untuk mencatat SIAPA di riwayat perubahan - lihat save(). */
  currentUser: CurrentUser | null;
  onSaved: () => void;
  onDirtyChange: (d: boolean) => void;
  notify: (t: 'success' | 'error', m: string) => void;
  setConfirmState: (s: ConfirmState | null) => void;
}) {
  const isFull = mode === 'full';
  const [locations, setLocations] = useState<DraftLocation[]>(
    () => buildDraft(detail).locations.filter(l => isFull || editableIds.has(l.id)),
  );
  const [issues, setIssues] = useState<DraftIssue[]>(
    () => isFull ? buildDraft(detail).issues : [],
  );
  const [removedLoc, setRemovedLoc] = useState<string[]>([]);
  const [removedComp, setRemovedComp] = useState<string[]>([]);
  const [removedIssue, setRemovedIssue] = useState<string[]>([]);
  // Draft lokasi/komponen tidak membawa created_at/sales_name - dipakai
  // timeline mini per field ("Lokasi dibuat" / "Komponen ditambahkan") lewat
  // lookup ke data asli ini.
  const origLocById = useMemo(() => new Map(detail.locations.map(l => [l.id, l])), [detail.locations]);
  const origCompById = useMemo(() => new Map(detail.components.map(c => [c.id, c])), [detail.components]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  /**
   * Dinaikkan tiap kali draft berhasil disimpan, dipakai sebagai bagian `key`
   * panel Riwayat per kartu lokasi supaya ia RE-MOUNT dan mengambil ulang
   * datanya - status/state yang berubah tidak mengubah id lokasi/komponen itu
   * sendiri, jadi effect di dalam AuditTrailPanel tidak akan tahu ada baris
   * baru untuk id yang sama tanpa dipaksa remount begini.
   */
  const [riwayatVersi, setRiwayatVersi] = useState(0);

  const touch = () => { if (!dirty) { setDirty(true); onDirtyChange(true); } };

  // Mutasi draft (murni lokal)
  const patchLoc = (id: string, patch: Partial<DraftLocation>) => {
    touch();
    setLocations(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  };
  const addLoc = () => {
    touch();
    setLocations(prev => [...prev, {
      id: tempId(), name: '', pic: null, status: 'in_progress',
      note: null, note_flag: false, start_date: null, target_date: null,
      sales_name: null, sales_division: null, components: [],
    }]);
  };
  const removeLoc = (loc: DraftLocation) => {
    const doRemove = () => {
      touch();
      if (!isNew(loc.id)) setRemovedLoc(prev => [...prev, loc.id]);
      setLocations(prev => prev.filter(l => l.id !== loc.id));
      setConfirmState(null);
    };
    if (isNew(loc.id) && !loc.name && loc.components.length === 0) { doRemove(); return; }
    setConfirmState({
      message: 'Hapus Lokasi?',
      description: `"${loc.name || 'Lokasi baru'}" beserta komponennya akan dihapus saat disimpan.`,
      confirmLabel: 'Hapus', danger: true,
      onConfirm: doRemove,
    });
  };

  const patchComp = (locId: string, compId: string, patch: Partial<DraftComponent>) => {
    touch();
    setLocations(prev => prev.map(l => l.id !== locId ? l : {
      ...l, components: l.components.map(c => c.id === compId ? { ...c, ...patch } : c),
    }));
  };
  const addComp = (locId: string) => {
    touch();
    setLocations(prev => prev.map(l => l.id !== locId ? l : {
      ...l, components: [...l.components, { id: tempId(), label: '', state: 'pending', weight: 1, photo_url: null, photo_thumb_url: null }],
    }));
  };
  const removeComp = (locId: string, compId: string) => {
    touch();
    if (!isNew(compId)) setRemovedComp(prev => [...prev, compId]);
    setLocations(prev => prev.map(l => l.id !== locId ? l : {
      ...l, components: l.components.filter(c => c.id !== compId),
    }));
  };

  /**
   * Foto evidence per komponen. File diunggah ke Storage saat dipilih, tapi
   * TAUTANNYA baru masuk database saat "Simpan Perubahan" ditekan - konsisten
   * dengan janji "tidak ada autosave".
   * Nama file disanitasi: Supabase Storage menolak key bertanda kurung/spasi.
   */
  const [uploadingComp, setUploadingComp] = useState<string | null>(null);
  const uploadPhoto = async (locId: string, compId: string, file: File) => {
    setUploadingComp(compId);
    try {
      // DUA berkas sekaligus, demi menekan egress Supabase paket gratis:
      //  - thumb 320px q0.6 (~15-30KB)  yang dirender di daftar komponen
      //  - full  1280px q0.7 (~120-250KB)  hanya diunduh saat thumbnail diklik
      // Foto evidence tidak perlu kualitas cetak, jadi 1280 sudah lebih dari
      // cukup untuk dibaca layar penuh.
      const [full, thumb] = await Promise.all([
        compressImage(file, { maxDim: 1280, quality: 0.7 }),
        compressImage(file, { maxDim: 320, quality: 0.6 }),
      ]);
      const safe = full.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const stamp = Date.now();
      const base = `project-progress/${detail.project.id}/${stamp}`;

      const [fullRes, thumbRes] = await Promise.all([
        supabase.storage.from('project-files')
          .upload(`${base}-${safe}`, full, { cacheControl: '31536000', upsert: false }),
        supabase.storage.from('project-files')
          .upload(`${base}-thumb-${safe}`, thumb, { cacheControl: '31536000', upsert: false }),
      ]);
      if (fullRes.error) { notify('error', 'Upload foto gagal: ' + fullRes.error.message); return; }

      const fullUrl = supabase.storage.from('project-files').getPublicUrl(`${base}-${safe}`).data.publicUrl;
      // Thumbnail gagal bukan alasan membatalkan upload - jatuh balik ke foto
      // penuh supaya fitur tetap jalan, hanya kurang hemat.
      const thumbUrl = thumbRes.error
        ? fullUrl
        : supabase.storage.from('project-files').getPublicUrl(`${base}-thumb-${safe}`).data.publicUrl;

      patchComp(locId, compId, { photo_url: fullUrl, photo_thumb_url: thumbUrl });
    } finally {
      setUploadingComp(null);
    }
  };

  const patchIssue = (id: string, patch: Partial<DraftIssue>) => {
    touch();
    setIssues(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  };
  const addIssue = () => {
    touch();
    setIssues(prev => [...prev, {
      id: tempId(), location_label: null, issue: '', severity: 'sedang', note: null,
    }]);
  };
  const removeIssue = (id: string) => {
    touch();
    if (!isNew(id)) setRemovedIssue(prev => [...prev, id]);
    setIssues(prev => prev.filter(i => i.id !== id));
  };

  // Simpan seluruh draft
  const save = async () => {
    if (locations.some(l => !l.name.trim())) {
      notify('error', 'Ada lokasi tanpa nama. Isi dulu sebelum menyimpan.');
      return;
    }
    setSaving(true);

    /* Riwayat perubahan (audit_trail). Ini penyimpanan diff, bukan autosave per
       field: satu tekan "Simpan" membawa banyak lokasi & komponen sekaligus,
       sebagian benar-benar berubah dan sebagian cuma ikut terkirim ulang, jadi
       pembandingnya WAJIB data asli sebelum draft disunting. Hanya status yang
       dibandingkan - itulah satu-satunya field yang menentukan progres. Tiap
       logAudit diberi .catch() sendiri supaya tidak pernah menggagalkan simpan. */
    const oleh = { user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '' };
    const origLoc = new Map(detail.locations.map(l => [l.id, l]));
    const origComp = new Map(detail.components.map(c => [c.id, c]));

    try {
      // 1) Hapus dulu, supaya baris yang dihapus tidak ikut divalidasi ulang.
      //    Dicatat SEBELUM dihapus - sesudahnya nama/labelnya sudah tidak
      //    terjangkau lagi.
      for (const id of removedComp) {
        const c = origComp.get(id);
        if (c) logAudit({ ...oleh, action: 'delete', module: 'project-progress', target_id: id, target_name: c.label }).catch(() => {});
      }
      for (const id of removedLoc) {
        const l = origLoc.get(id);
        if (l) logAudit({ ...oleh, action: 'delete', module: 'project-progress', target_id: id, target_name: l.name }).catch(() => {});
      }
      if (removedComp.length)  await supabase.from('progress_components').delete().in('id', removedComp);
      if (removedIssue.length) await supabase.from('progress_issues').delete().in('id', removedIssue);
      if (removedLoc.length)   await supabase.from('progress_locations').delete().in('id', removedLoc);

      // 2) Lokasi - progress DIHITUNG dari komponennya, tidak diisi manual.
      for (let i = 0; i < locations.length; i++) {
        const l = locations[i];
        // Mode 'pic' hanya boleh mengubah progres/catatan. sort_order SENGAJA
        // tidak ditulis: draft mode ini cuma memuat sebagian lokasi, sehingga
        // index i bukan urutan sebenarnya dan akan mengacak urutan lokasi lain.
        const payload = isFull
          ? {
              name: l.name.trim(),
              pic: l.pic?.trim() || null,
              status: l.status,
              note: l.note?.trim() || null,
              note_flag: l.note_flag,
              start_date: l.start_date || null,
              target_date: l.target_date || null,
              sales_name: l.sales_name || null,
              sales_division: l.sales_division || null,
              progress: computeProgress(l.components),
              sort_order: i,
            }
          : {
              note: l.note?.trim() || null,
              note_flag: l.note_flag,
              progress: computeProgress(l.components),
            };

        let realLocId = l.id;
        if (isNew(l.id)) {
          const { data, error } = await supabase.from('progress_locations')
            .insert([{ ...payload, project_id: detail.project.id }]).select('id').single();
          if (error) throw error;
          realLocId = (data as { id: string }).id;
          logAudit({ ...oleh, action: 'create', module: 'project-progress', target_id: realLocId, target_name: l.name }).catch(() => {});
        } else {
          const { error } = await supabase.from('progress_locations').update(payload).eq('id', l.id);
          if (error) throw error;
          // status hanya ada di payload mode 'full' - mode 'pic' tidak pernah
          // mengubahnya, jadi tidak ada yang perlu dibandingkan di sana.
          const before = origLoc.get(l.id);
          if (isFull && before && before.status !== l.status) {
            logAudit({
              ...oleh, action: 'status_change', module: 'project-progress',
              target_id: l.id, target_name: l.name,
              old_value: STATUS_CONFIG[before.status]?.label ?? before.status,
              new_value: STATUS_CONFIG[l.status]?.label ?? l.status,
            }).catch(() => {});
            /*
              M9 (docs/UX-WORKFLOW-AUDIT.md): modul ini dulu TIDAK PERNAH
              mengirim notifikasi apa pun (WA/Telegram/in-app) di transisi
              manapun - termasuk saat lokasi ditandai "Blocked" (kondisi
              kritis: material belum datang, dsb). Sales/admin harus buka
              dashboard manual untuk tahu ada masalah. Dikirim khusus saat
              status BARU menjadi 'blocked' (bukan tiap perubahan status -
              in_progress<->done rutin dan tidak butuh dorongan aktif).
            */
            if (l.status === 'blocked') {
              void createNotificationForAdmins({
                type: 'project',
                title: `🚧 Lokasi "${l.name}" diblokir`,
                body: `${detail.project.name}${l.sales_name ? ` — Sales ${l.sales_name}` : ''}${l.note ? ` — ${l.note}` : ''}`,
                action_url: '/project-progress',
                ref_id: l.id,
                created_by: currentUser?.full_name ?? '',
              });
            }
          }
        }

        // 3) Komponen milik lokasi ini
        const newComps = l.components.filter(c => isNew(c.id) && c.label.trim());
        if (newComps.length) {
          const rows = newComps.map((c, ci) => ({
            location_id: realLocId, label: c.label.trim(), state: c.state, weight: c.weight,
            photo_url: c.photo_url, photo_thumb_url: c.photo_thumb_url,
            sort_order: l.components.indexOf(c) >= 0 ? l.components.indexOf(c) : ci,
          }));
          let { data, error } = await supabase.from('progress_components').insert(rows).select('id');
          if (error) {
            // weight/category belum ada di DB (sql/project-progress-weighted-issues.sql
            // belum dijalankan) - coba lagi tanpa kolom itu supaya simpan tetap jalan.
            ({ data, error } = await supabase.from('progress_components')
              .insert(rows.map(({ weight: _weight, ...rest }) => rest)).select('id'));
          }
          if (error) throw error;
          ((data ?? []) as { id: string }[]).forEach((row, idx) => {
            logAudit({ ...oleh, action: 'create', module: 'project-progress', target_id: row.id, target_name: newComps[idx].label.trim(), notes: `Lokasi: ${l.name}` }).catch(() => {});
          });
        }
        for (const c of l.components) {
          if (isNew(c.id) || !c.label.trim()) continue;
          const compPayload = { label: c.label.trim(), state: c.state, weight: c.weight, photo_url: c.photo_url, photo_thumb_url: c.photo_thumb_url, sort_order: l.components.indexOf(c) };
          //  select('id') + panjangnya diperiksa: progress keseluruhan
          //  DIHITUNG dari komponen-komponen ini, jadi state yang gagal
          //  tersimpan diam-diam (RLS, 0 baris, tanpa galat) akan membuat
          //  persentase progres salah tanpa ada yang tahu sebabnya.
          let { data: terubah, error } = await supabase.from('progress_components').update(compPayload).eq('id', c.id).select('id');
          if (error) {
            // Sama seperti di atas - weight opsional, jangan sampai memblokir simpan progres.
            const { weight: _weight, ...withoutWeight } = compPayload;
            ({ data: terubah, error } = await supabase.from('progress_components').update(withoutWeight).eq('id', c.id).select('id'));
          }
          if (error) throw error;
          if (!terubah || terubah.length === 0) throw new Error(`Komponen "${c.label}" gagal tersimpan (tidak punya akses).`);
          const before = origComp.get(c.id);
          if (before && before.state !== c.state) {
            logAudit({
              ...oleh, action: 'status_change', module: 'project-progress',
              target_id: c.id, target_name: c.label.trim(), notes: `Lokasi: ${l.name}`,
              old_value: COMPONENT_STATE_CONFIG[before.state]?.label ?? before.state,
              new_value: COMPONENT_STATE_CONFIG[c.state]?.label ?? c.state,
            }).catch(() => {});
          }
        }
      }

      // 4) Isu
      const newIssues = issues.filter(i => isNew(i.id) && i.issue.trim());
      if (newIssues.length) {
        const { error } = await supabase.from('progress_issues').insert(
          newIssues.map(i => ({
            project_id: detail.project.id,
            location_label: i.location_label?.trim() || null,
            issue: i.issue.trim(), severity: i.severity,
            note: i.note?.trim() || null, sort_order: issues.indexOf(i),
          })),
        );
        if (error) throw error;
      }
      for (const i of issues) {
        if (isNew(i.id) || !i.issue.trim()) continue;
        const { error } = await supabase.from('progress_issues').update({
          location_label: i.location_label?.trim() || null,
          issue: i.issue.trim(), severity: i.severity,
          note: i.note?.trim() || null, sort_order: issues.indexOf(i),
        }).eq('id', i.id);
        if (error) throw error;
      }

      setRemovedLoc([]); setRemovedComp([]); setRemovedIssue([]);
      setDirty(false); onDirtyChange(false);
      setRiwayatVersi(v => v + 1);
      notify('success', 'Perubahan tersimpan.');
      onSaved();
    } catch (e) {
      notify('error', 'Gagal menyimpan: ' + ((e as { message?: string }).message ?? 'kesalahan tidak diketahui'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-24">
      <div className="rounded-xl px-4 py-3 text-[11px] font-semibold"
        style={{ background: '#ecfeff', border: '1px solid #a5f3fc', color: '#0e7490' }}>
        {isFull ? (
          <>Mode edit — perubahan <b>belum tersimpan</b> sampai kamu menekan tombol
          “Simpan Perubahan” di bawah. Progres tiap lokasi dihitung otomatis dari
          status komponennya.</>
        ) : (
          <>Kamu di-tag sebagai <b>PIC</b> pada lokasi di bawah, jadi hanya bisa
          memperbarui <b>progres</b>: status komponen, foto evidence, dan catatan.
          Struktur proyek & rekap isu diatur admin. Perubahan <b>belum tersimpan</b>
          sampai tombol “Simpan Perubahan” ditekan.</>
        )}
      </div>

      {/* ── Lokasi ── */}
      <div className="flex items-center justify-between">
        <SectionLabel>{isFull ? `Lokasi (${locations.length})` : `Lokasi Saya (${locations.length})`}</SectionLabel>
        {isFull && (
          <button onClick={addLoc} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
            style={{ background: THEME.gradient }}>+ Tambah Lokasi</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {locations.map(loc => {
          const pct = computeProgress(loc.components);
          const bd = stateBreakdown(loc.components);
          return (
            <div key={loc.id} className="rounded-2xl p-4 flex flex-col gap-3 bg-white border border-gray-200">
              <div className="flex items-start gap-2">
                {isFull ? (
                  <>
                    <input value={loc.name} placeholder="Nama lokasi"
                      onChange={e => patchLoc(loc.id, { name: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg text-sm font-black text-gray-800 border-2 border-gray-200 focus:border-cyan-500 outline-none" />
                    <button aria-label="Tutup" onClick={() => removeLoc(loc)}
                      className="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 font-bold flex-shrink-0">✕</button>
                  </>
                ) : (
                  <p className="flex-1 text-sm font-black text-gray-800">{loc.name}</p>
                )}
              </div>

              {!isFull && (
                <>
                  <p className="text-[11px] font-semibold text-gray-500">
                    PIC: {loc.pic ?? '—'} · Status: {STATUS_CONFIG[loc.status].label}
                  </p>
                  {loc.sales_name && (
                    <p className="text-[11px] font-semibold text-gray-500">
                      Sales: {loc.sales_name}{loc.sales_division ? ` · ${loc.sales_division}` : ''}
                    </p>
                  )}
                </>
              )}
              {/* Sales per lokasi — satu proyek bisa berisi lokasi milik sales
                  berbeda, dan nilai inilah yang menentukan siapa boleh melihat. */}
              {isFull && (
                <select aria-label="— Sales lokasi ini —" value={loc.sales_name ?? ''}
                  onChange={e => {
                    const dipilih = salesUsers.find(u => u.full_name === e.target.value);
                    patchLoc(loc.id, {
                      sales_name: e.target.value || null,
                      sales_division: dipilih?.sales_division ?? null,
                    });
                  }}
                  className={inputSm}>
                  <option value="">— Sales lokasi ini —</option>
                  {salesUsers.map(u => (
                    <option key={u.id} value={u.full_name}>
                      {u.full_name}{u.sales_division ? ` · ${u.sales_division}` : ''}
                    </option>
                  ))}
                </select>
              )}
              <div className={`grid grid-cols-2 gap-2 ${isFull ? '' : 'hidden'}`}>
                {/* PIC diambil dari daftar Team PTS — bukan ketikan bebas */}
                <select aria-label="— Pilih PIC —" value={loc.pic ?? ''} onChange={e => patchLoc(loc.id, { pic: e.target.value || null })}
                  className={inputSm}>
                  <option value="">— Pilih PIC —</option>
                  {teamUsers.map(u => <option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                  {/* Nilai lama yang bukan anggota team tetap ditampilkan agar tidak hilang diam-diam */}
                  {loc.pic && !teamUsers.some(u => u.full_name === loc.pic) && (
                    <option value={loc.pic}>{loc.pic} (di luar daftar)</option>
                  )}
                </select>
                <select value={loc.status} onChange={e => patchLoc(loc.id, { status: e.target.value as ProjectStatus })}
                  className={inputSm}>
                  {(['in_progress', 'done', 'blocked'] as ProjectStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>

              {/* Jadwal lokasi — hanya admin. PIC memperbarui progres, bukan jadwal. */}
              {isFull && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Mulai</span>
                    <input type="date" value={loc.start_date ?? ''}
                      onChange={e => patchLoc(loc.id, { start_date: e.target.value || null })}
                      className={inputSm} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Target</span>
                    <input type="date" value={loc.target_date ?? ''}
                      min={loc.start_date ?? undefined}
                      onChange={e => patchLoc(loc.id, { target_date: e.target.value || null })}
                      className={inputSm} />
                  </label>
                </div>
              )}
              {!isFull && (loc.start_date || loc.target_date) && (() => {
                const lt = timelineInfo(loc);
                return (
                  <p className="text-[10px] font-semibold" style={{ color: lt.color }}>
                    🗓️ {loc.start_date ? formatDate(loc.start_date) : '—'} → {loc.target_date ? formatDate(loc.target_date) : '—'}
                    <span className="ml-1.5 px-1.5 py-0.5 rounded" style={{ background: lt.bg }}>{lt.label}</span>
                  </p>
                );
              })()}

              {/* Progres otomatis — tidak bisa diketik */}
              <div className="rounded-xl p-2.5 bg-gray-50 border border-gray-200 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                    Progres otomatis
                  </span>
                  <span className="text-sm font-black" style={{ color: THEME.color }}>{pct}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-gray-200 flex">
                  {bd.filter(b => b.count > 0).map(b => (
                    <div key={b.state} style={{ width: `${b.percent}%`, background: b.color }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                  {bd.map(b => (
                    <span key={b.state} className="flex items-center gap-1 text-[10px] font-bold"
                      style={{ color: b.count > 0 ? b.color : '#cbd5e1' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.count > 0 ? b.color : '#e2e8f0' }} />
                      {b.label} {b.percent}% <span className="font-semibold text-gray-400">({b.count})</span>
                    </span>
                  ))}
                </div>
                {loc.components.length === 0 && (
                  <p className="text-[10px] text-gray-400 font-semibold">
                    Belum ada komponen — progres 0%.
                  </p>
                )}
              </div>

              {/* Komponen */}
              <div className="flex flex-col gap-2">
                {loc.components.map(c => (
                  <div key={c.id} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <select value={c.state} onChange={e => patchComp(loc.id, c.id, { state: e.target.value as ComponentState })}
                        className="px-1.5 py-1 rounded-md text-[10px] font-bold border border-gray-200 outline-none flex-shrink-0"
                        style={{ color: COMPONENT_STATE_CONFIG[c.state]?.dot }}>
                        {COMPONENT_STATES.map(st => (
                          <option key={st} value={st}>● {COMPONENT_STATE_CONFIG[st].label}</option>
                        ))}
                      </select>
                      {isFull && (
                        <input type="number" min={0.1} step={0.1} value={c.weight}
                          title="Bobot komponen ini dalam progres lokasi (default 1)"
                          onChange={e => {
                            const n = parseFloat(e.target.value);
                            patchComp(loc.id, c.id, { weight: Number.isFinite(n) && n > 0 ? n : 1 });
                          }}
                          className="w-10 px-1 py-1 rounded-md text-[10px] font-bold border border-gray-200 outline-none flex-shrink-0 text-center" />
                      )}
                      {isFull ? (
                        <input value={c.label} placeholder="Nama komponen"
                          onChange={e => patchComp(loc.id, c.id, { label: e.target.value })}
                          className="flex-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-gray-200 focus:border-cyan-500 outline-none" />
                      ) : (
                        // PIC hanya mengubah progres - nama komponen dikunci.
                        <span className="flex-1 px-2 py-1 text-[11px] font-semibold text-gray-700 truncate">{c.label}</span>
                      )}

                      {/* Foto evidence opsional */}
                      {c.photo_url ? (
                        <span className="flex items-center gap-1 flex-shrink-0">
                          <a href={c.photo_url} target="_blank" rel="noopener noreferrer" title="Lihat foto">
                            <img src={c.photo_thumb_url ?? c.photo_url} alt=""
                              loading="lazy" decoding="async" width={24} height={24}
                              className="w-6 h-6 rounded object-cover border border-gray-200" />
                          </a>
                          <button aria-label="Tutup" onClick={() => patchComp(loc.id, c.id, { photo_url: null, photo_thumb_url: null })}
                            title="Hapus foto" className="text-gray-300 hover:text-rose-500 text-[10px] font-bold">✕</button>
                        </span>
                      ) : (
                        <label title="Tambah foto evidence (opsional)"
                          className="flex-shrink-0 cursor-pointer text-[13px] px-1 opacity-50 hover:opacity-100 transition-opacity">
                          {uploadingComp === c.id ? '⏳' : '📷'}
                          <input type="file" accept="image/*" className="hidden"
                            disabled={uploadingComp === c.id}
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) uploadPhoto(loc.id, c.id, f);
                              e.target.value = '';
                            }} />
                        </label>
                      )}

                      {isFull && (
                        <button aria-label="Tutup" onClick={() => removeComp(loc.id, c.id)}
                          className="text-gray-300 hover:text-rose-500 font-bold px-1 flex-shrink-0">✕</button>
                      )}
                    </div>

                    {/* Alur perubahan KOMPONEN ini — timeline mini menempel
                        langsung di bawah barisnya sendiri. */}
                    {!isNew(c.id) && (
                      <AuditTrailPanel
                        key={`comp-${c.id}-${riwayatVersi}`}
                        targetId={c.id} modul="project-progress" kompak selaluTerbuka arah="horizontal"
                        awal={{
                          oleh: origLocById.get(loc.id)?.sales_name || detail.project.sales_name || detail.project.created_by || null,
                          waktu: origCompById.get(c.id)?.created_at ?? null,
                          keterangan: 'Komponen ditambahkan',
                        }}
                      />
                    )}
                  </div>
                ))}
                {isFull && (
                  <button onClick={() => addComp(loc.id)}
                    className="text-[11px] font-bold text-cyan-700 hover:text-cyan-900 self-start">+ Tambah komponen</button>
                )}
              </div>

              <textarea value={loc.note ?? ''} rows={2} placeholder="Catatan lokasi…"
                onChange={e => patchLoc(loc.id, { note: e.target.value })}
                className={inputSm} />
              <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 cursor-pointer">
                <input type="checkbox" checked={loc.note_flag}
                  onChange={e => patchLoc(loc.id, { note_flag: e.target.checked })}
                  className="accent-rose-500" />
                Tandai sebagai catatan penting
              </label>
            </div>
          );
        })}
      </div>

      {/* ── Isu — hanya admin/superadmin ── */}
      {isFull && (
      <div className="flex items-center justify-between">
        <SectionLabel>Rekap Isu ({issues.length})</SectionLabel>
        <button onClick={addIssue} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>+ Tambah Isu</button>
      </div>
      )}

      <div className="flex flex-col gap-2">
        {isFull && issues.map(is => (
          <div key={is.id} className="rounded-xl p-3 bg-white border border-gray-200 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
            <input value={is.location_label ?? ''} placeholder="Lokasi"
              onChange={e => patchIssue(is.id, { location_label: e.target.value })}
              className={`${inputSm} md:col-span-2`} />
            <input value={is.issue} placeholder="Isu"
              onChange={e => patchIssue(is.id, { issue: e.target.value })}
              className={`${inputSm} md:col-span-3`} />
            <select value={is.severity} onChange={e => patchIssue(is.id, { severity: e.target.value as Severity })}
              className={`${inputSm} md:col-span-2`}>
              {(['tinggi', 'sedang', 'rendah'] as Severity[]).map(s => (
                <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>
              ))}
            </select>
            <input value={is.note ?? ''} placeholder="Keterangan"
              onChange={e => patchIssue(is.id, { note: e.target.value })}
              className={`${inputSm} md:col-span-4`} />
            <button aria-label="Tutup" onClick={() => removeIssue(is.id)}
              className="md:col-span-1 text-rose-500 hover:bg-rose-50 rounded-lg py-1.5 font-bold">✕</button>
          </div>
        ))}
      </div>

      {/* ── Bar simpan (menempel di bawah area scroll) ── */}
      <div className="sticky bottom-0 -mx-5 px-5 py-3 flex items-center justify-between gap-3 border-t border-gray-200"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)' }}>
        <span className="text-[11px] font-bold" style={{ color: dirty ? '#b45309' : '#94a3b8' }}>
          {dirty ? '● Ada perubahan belum tersimpan' : '○ Belum ada perubahan'}
        </span>
        <button onClick={save} disabled={saving || !dirty}
          className="px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all"
          style={{ background: THEME.gradient }}>
          {saving ? 'Menyimpan…' : '💾 Simpan Perubahan'}
        </button>
      </div>
    </div>
  );
}

// UI kecil

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl text-sm font-medium border-2 border-gray-200 focus:border-cyan-500 outline-none bg-white';
const inputSm  = 'w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border-2 border-gray-200 focus:border-cyan-500 outline-none bg-white';

/**
 * Baris ikon aksi - dipakai DUA tempat (tabel desktop & kartu mobile) supaya
 * tidak ada duplikasi tombol yang bisa lupa disinkronkan.
 */
function RowActions({ p, canEditRow, canDeleteRow, onView, onExport, onShare, onEdit, onDelete }: {
  p: ProgressProject;
  /** Admin/Full Access, ATAU pemilik project ini (sales_name = dirinya). */
  canEditRow: boolean;
  /** Admin/Full Access SAJA - Hapus tetap terkunci dari pemilik biasa, sama seperti modul lain. */
  canDeleteRow: boolean;
  onView: () => void; onExport: () => void; onShare: () => void;
  onEdit: () => void; onDelete: () => void;
}) {
  return (
    <ActionGroup>
      <ViewIconBtn onClick={onView} label="Lihat Detail" />
      <IconBtn label="Export Excel" color="#059669" onClick={onExport}>
        <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
      </IconBtn>
      {canEditRow && (
        <>
          <IconBtn label={p.share_enabled ? 'Share View-Only (aktif)' : 'Share View-Only'}
            color={p.share_enabled ? '#0891b2' : '#94a3b8'} onClick={onShare} badge={p.share_enabled}>
            <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" /></svg>
          </IconBtn>
          <EditIconBtn onClick={onEdit} label="Edit" />
        </>
      )}
      {/*
        Hapus DIPISAH dari Edit (dulu satu syarat "canEdit" saja) - kebijakan
        platform: Team boleh Edit yang di-assign atas namanya, tapi Hapus
        tetap cuma Admin/Full Access, di semua modul.
      */}
      {canDeleteRow && <DeleteIconBtn onClick={onDelete} label="Hapus" />}
    </ActionGroup>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

function IconBtn({ label, color, onClick, children, badge }: {
  label: string; color: string; onClick: () => void; children: React.ReactNode;
  /** Minor (docs/UX-WORKFLOW-AUDIT.md): indikator share-link aktif dulu hanya
   *  beda warna icon (subtle, mudah kelewat saat scan cepat) - titik hijau
   *  ini terlihat tanpa perlu hover ke tooltip. */
  badge?: boolean;
}) {
  return (
    <button aria-label={label} onClick={onClick} title={label}
      className="relative w-7 h-7 rounded-lg border flex items-center justify-center transition-all hover:text-white"
      style={{ color, borderColor: `${color}40`, background: `${color}12` }}
      onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = '#fff'; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${color}12`; e.currentTarget.style.color = color; }}>
      {children}
      {badge && (
        <span aria-hidden="true" className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white"
          style={{ background: '#059669' }} />
      )}
    </button>
  );
}

/*
  useSearchParams() (dipakai deep-link ?open= di dalam) WAJIB berada di dalam
  batas Suspense - tanpa itu Next.js menolak halaman ini saat prerender.
  Pola yang sama dipakai app/ticketing/page.tsx.
*/
export default function ProjectProgressPage() {
  return (
    <Suspense>
      <ProjectProgressPageInner />
    </Suspense>
  );
}
