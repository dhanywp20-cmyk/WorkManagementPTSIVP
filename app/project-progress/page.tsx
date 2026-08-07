'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/use-current-user';
import {
  PageHeader, LoadingScreen, Toast, type Notif,
  ConfirmDialog, type ConfirmState, EmptyState,
  ViewIconBtn, EditIconBtn, DeleteIconBtn, ActionGroup,
  MobileListCard, MobileCardBadge,
} from '@/components/shared';
import { ProjectDetailView, SectionLabel } from './_components/ProjectDetailView';
import { exportProjectToExcel } from './_components/excel-export';
import {
  THEME, ProgressProject, ProgressLocation, ProgressComponent, ProgressIssue,
  ProjectDetail, ProjectStatus, ComponentState, Severity,
  STATUS_CONFIG, SEVERITY_CONFIG, COMPONENT_STATE_CONFIG, COMPONENT_STATES,
  averageProgress, componentsOf, formatDatetime, computeProgress, stateBreakdown,
  newShareToken, shareUrl, canEditProjectProgress,
} from './_components/shared';
import { isAssignablePTSTeam } from '@/lib/teams';

export default function ProjectProgressPage() {
  const currentUser = useCurrentUser();
  const canEdit = canEditProjectProgress(currentUser?.role);

  const [projects, setProjects] = useState<ProgressProject[]>([]);
  const [locCount, setLocCount] = useState<Record<string, { total: number; avg: number; issues: number }>>({});
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

  // Daftar PIC untuk dropdown lokasi — Team PTS assignable (lihat lib/teams.ts)
  const [teamUsers, setTeamUsers] = useState<{ id: string; full_name: string }[]>([]);
  // Perubahan editor yang belum disimpan — dipakai untuk mencegah modal
  // tertutup tanpa sengaja dan menghilangkan pekerjaan.
  const [editorDirty, setEditorDirty] = useState(false);

  const notify = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3200);
  };

  // ── Load daftar proyek + ringkasan agregat ────────────────────────────────
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const [pRes, lRes, iRes] = await Promise.all([
      supabase.from('progress_projects').select('*').order('created_at', { ascending: false }),
      supabase.from('progress_locations').select('project_id,progress'),
      supabase.from('progress_issues').select('project_id'),
    ]);
    const list = (pRes.data ?? []) as ProgressProject[];
    setProjects(list);

    const agg: Record<string, { total: number; avg: number; issues: number }> = {};
    for (const p of list) agg[p.id] = { total: 0, avg: 0, issues: 0 };
    const sums: Record<string, number> = {};
    for (const l of (lRes.data ?? []) as { project_id: string; progress: number }[]) {
      if (!agg[l.project_id]) continue;
      agg[l.project_id].total += 1;
      sums[l.project_id] = (sums[l.project_id] ?? 0) + (l.progress ?? 0);
    }
    for (const id of Object.keys(agg)) {
      agg[id].avg = agg[id].total > 0 ? Math.round(sums[id] / agg[id].total) : 0;
    }
    for (const is of (iRes.data ?? []) as { project_id: string }[]) {
      if (agg[is.project_id]) agg[is.project_id].issues += 1;
    }
    setLocCount(agg);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Daftar PIC: hanya Team PTS yang assignable, tanpa admin/superadmin —
  // pola yang sama dengan dropdown handler di Request Schedule.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('users')
        .select('id, full_name, role, team_type').order('full_name');
      if (!data) return;
      setTeamUsers(
        (data as { id: string; full_name: string; role: string; team_type?: string }[])
          .filter(u => isAssignablePTSTeam(u.team_type) && u.role !== 'admin' && u.role !== 'superadmin')
          .map(u => ({ id: u.id, full_name: u.full_name })),
      );
    })();
  }, []);

  // ── Buka detail ───────────────────────────────────────────────────────────
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
    setDetail({ project, locations, components, issues: (iRes.data ?? []) as ProgressIssue[] });
    setDetailLoading(false);
  };

  /** Tarik seluruh isi 1 proyek lalu kirim ke Excel — dipakai tabel & kartu mobile. */
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

  /** Tutup modal detail — konfirmasi dulu bila ada perubahan belum tersimpan. */
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

  /** Keluar dari mode edit — juga dijaga bila masih ada perubahan. */
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

  // ── CRUD proyek ───────────────────────────────────────────────────────────
  const saveProject = async () => {
    if (!projectForm?.name?.trim()) { notify('error', 'Nama proyek wajib diisi.'); return; }
    setSaving(true);
    const payload = {
      name: projectForm.name.trim(),
      client: projectForm.client?.trim() || null,
      description: projectForm.description?.trim() || null,
      status: projectForm.status ?? 'in_progress',
    };
    if (projectForm.id) {
      const { error } = await supabase.from('progress_projects').update(payload).eq('id', projectForm.id);
      if (error) { notify('error', 'Gagal menyimpan: ' + error.message); setSaving(false); return; }
      notify('success', 'Proyek diperbarui.');
    } else {
      const { error } = await supabase.from('progress_projects')
        .insert([{ ...payload, created_by: currentUser?.full_name ?? null }]);
      if (error) { notify('error', 'Gagal menyimpan: ' + error.message); setSaving(false); return; }
      notify('success', 'Proyek dibuat.');
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

  // ── Share link ────────────────────────────────────────────────────────────
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

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.client ?? '').toLowerCase().includes(q);
    });
  }, [projects, search, statusFilter]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="h-screen overflow-hidden flex flex-col relative" style={{
      backgroundImage: `url('/IVP_Background.png')`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">

        {toast && <Toast notif={toast} />}

        <PageHeader icon="📊" title="Project Progress" subtitle="Progres instalasi per proyek & lokasi"
          color={THEME.color} colorLight={THEME.colorLight}>
          {canEdit && (
            <button onClick={() => setProjectForm({ status: 'in_progress' })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 hover:opacity-90"
              style={{ background: THEME.gradient, boxShadow: `0 4px 14px ${THEME.shadow}` }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Tambah Project
            </button>
          )}
        </PageHeader>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 flex flex-col gap-4">

            {/* ── Filter bar ── */}
            <div className="flex flex-wrap items-center gap-2">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama project atau client…"
                className="flex-1 min-w-[220px] px-4 py-2.5 rounded-xl text-sm font-medium border-2 border-gray-200 focus:border-cyan-500 outline-none bg-white/95" />
              {(['all', 'in_progress', 'done', 'blocked'] as const).map(s => {
                const active = statusFilter === s;
                const label = s === 'all' ? 'Semua' : STATUS_CONFIG[s].label;
                return (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all border-2"
                    style={active
                      ? { background: THEME.gradient, color: '#fff', borderColor: 'transparent' }
                      : { background: 'rgba(255,255,255,0.9)', color: '#64748b', borderColor: '#e2e8f0' }}>
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
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 2px 10px rgba(15,23,42,0.05)' }}>

                {/* ── MOBILE: kartu daftar ── */}
                <div className="md:hidden divide-y divide-gray-100">
                  {filtered.map(p => {
                    const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.in_progress;
                    const agg = locCount[p.id] ?? { total: 0, avg: 0, issues: 0 };
                    return (
                      <MobileListCard key={p.id}
                        title={p.name}
                        meta={<span>{formatDatetime(p.updated_at)}</span>}
                        accent={cfg.border}
                        badges={
                          <MobileCardBadge style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                            {cfg.label}
                          </MobileCardBadge>
                        }
                        fields={[
                          { label: 'Client', value: p.client || '—' },
                          { label: 'Lokasi', value: `${agg.total} lokasi` },
                          { label: 'Isu', value: `${agg.issues} isu` },
                          { label: 'Progres', value: `${agg.avg}%`, valueClass: 'font-black' },
                        ]}
                        actions={<RowActions p={p} canEdit={canEdit}
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
                      <col style={{ width: '4%' }} />
                      <col style={{ width: '26%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '16%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b-2 border-gray-100" style={{ background: 'rgba(255,255,255,0.97)' }}>
                        {['No', 'Nama Project', 'Client', 'Status', 'Lokasi', 'Progres'].map((h, i) => (
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
                        const agg = locCount[p.id] ?? { total: 0, avg: 0, issues: 0 };
                        return (
                          <tr key={p.id}
                            className="border-b border-gray-200 hover:bg-cyan-50/40 transition-colors cursor-pointer"
                            onClick={() => openDetail(p)}>
                            <td className="px-3 py-3 border-r border-gray-200 text-center align-middle">
                              <span className="text-[11px] font-bold text-gray-500">{idx + 1}</span>
                            </td>
                            <td className="px-3 py-3 border-r border-gray-200 align-middle">
                              <p className="text-xs font-bold text-gray-800 leading-snug break-words">{p.name}</p>
                              <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{formatDatetime(p.updated_at)}</p>
                            </td>
                            <td className="px-3 py-3 border-r border-gray-200 align-middle">
                              <span className="text-[11px] font-semibold text-gray-600">{p.client || '—'}</span>
                            </td>
                            <td className="px-3 py-3 border-r border-gray-200 align-middle">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap"
                                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                {cfg.label}
                              </span>
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
                                  <div className="h-full rounded-full" style={{ width: `${agg.avg}%`, background: THEME.gradient }} />
                                </div>
                                <span className="text-[11px] font-black flex-shrink-0" style={{ color: THEME.color }}>{agg.avg}%</span>
                              </div>
                            </td>
                            <td className="px-1 py-3 align-middle" onClick={e => e.stopPropagation()}>
                              <RowActions p={p} canEdit={canEdit}
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

                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white/90">
                  <span className="text-xs text-gray-400">{filtered.length} project</span>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ══ MODAL DETAIL ══ */}
      {detail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 z-[9990]"
          onClick={e => { if (e.target === e.currentTarget) closeDetail(); }}>
          <div className="w-full h-full flex flex-col overflow-hidden relative" style={{
            backgroundImage: `url('/IVP_Background.png')`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.10)' }} />
            <div className="px-5 py-3.5 flex items-center justify-between gap-3 flex-shrink-0 relative z-10"
              style={{ background: THEME.gradient }}>
              <div className="min-w-0">
                <p className="text-white font-black text-base truncate">{detail.project.name}</p>
                <p className="text-white/80 text-[11px] font-semibold">
                  {detail.project.client ? `${detail.project.client} · ` : ''}
                  {detail.locations.length} lokasi · rata-rata {averageProgress(detail.locations)}%
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {canEdit && (
                  <button onClick={() => editMode ? exitEditMode() : setEditMode(true)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                    style={editMode
                      ? { background: '#fff', color: THEME.colorLight }
                      : { background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}>
                    {editMode ? (editorDirty ? '● Keluar Edit' : '✓ Selesai Edit') : '✏️ Edit'}
                  </button>
                )}
                <button onClick={() => exportProjectToExcel(detail)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition-all"
                  style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)' }}>
                  ⬇ Excel
                </button>
                <button onClick={closeDetail}
                  className="w-8 h-8 rounded-lg text-white font-bold flex items-center justify-center transition-all"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 relative z-10">
              {detailLoading ? (
                <div className="rounded-2xl py-12 text-center"
                  style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.8)' }}>
                  <p className="text-sm font-bold text-gray-500">Memuat detail…</p>
                </div>
              ) : editMode && canEdit ? (
                <DetailEditor
                  // key: paksa draft dibangun ulang HANYA saat ganti proyek /
                  // setelah simpan — bukan tiap render, supaya tidak berkedip.
                  key={`${detail.project.id}-${detail.locations.length}-${detail.components.length}-${detail.issues.length}`}
                  detail={detail} teamUsers={teamUsers}
                  onSaved={() => { setEditorDirty(false); reloadDetail(); fetchProjects(); }}
                  onDirtyChange={setEditorDirty}
                  notify={notify} setConfirmState={setConfirmState} />
              ) : (
                <ProjectDetailView detail={detail} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL FORM PROYEK ══ */}
      {projectForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9995]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4" style={{ background: THEME.gradient }}>
              <h3 className="text-white font-black text-base">
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
      )}

      {/* ══ MODAL SHARE ══ */}
      {shareFor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9995]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: THEME.gradient }}>
              <h3 className="text-white font-black text-base">🔗 Share View-Only</h3>
              <button onClick={() => setShareFor(null)} className="text-white/80 hover:text-white font-bold">✕</button>
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
      )}
    </div>
  );
}

// ─── Editor detail (lokasi / komponen / isu) ─────────────────────────────────

/**
 * Editor memakai DRAFT LOKAL. Semua perubahan hanya mengubah state di memori;
 * tidak ada penulisan ke database sampai tombol "Simpan Perubahan" ditekan.
 *
 * Ini sengaja: versi sebelumnya menyimpan tiap kali field kehilangan fokus lalu
 * memuat ulang seluruh detail, sehingga komponen ter-mount ulang dan tampilan
 * berkedip di tengah pengetikan.
 *
 * Baris baru diberi id sementara berawalan "new-" supaya saat simpan bisa
 * dipisahkan antara INSERT dan UPDATE.
 */

type DraftComponent = { id: string; label: string; state: ComponentState };
type DraftLocation = {
  id: string; name: string; pic: string | null; status: ProjectStatus;
  note: string | null; note_flag: boolean; components: DraftComponent[];
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
        components: componentsOf(detail.components, l.id)
          .map(c => ({ id: c.id, label: c.label, state: c.state })),
      })),
    issues: [...detail.issues]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(i => ({
        id: i.id, location_label: i.location_label, issue: i.issue,
        severity: i.severity, note: i.note,
      })),
  };
}

function DetailEditor({ detail, teamUsers, onSaved, onDirtyChange, notify, setConfirmState }: {
  detail: ProjectDetail;
  teamUsers: { id: string; full_name: string }[];
  onSaved: () => void;
  onDirtyChange: (d: boolean) => void;
  notify: (t: 'success' | 'error', m: string) => void;
  setConfirmState: (s: ConfirmState | null) => void;
}) {
  const [locations, setLocations] = useState<DraftLocation[]>(() => buildDraft(detail).locations);
  const [issues, setIssues] = useState<DraftIssue[]>(() => buildDraft(detail).issues);
  const [removedLoc, setRemovedLoc] = useState<string[]>([]);
  const [removedComp, setRemovedComp] = useState<string[]>([]);
  const [removedIssue, setRemovedIssue] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const touch = () => { if (!dirty) { setDirty(true); onDirtyChange(true); } };

  // ── Mutasi draft (murni lokal) ──────────────────────────────────────────
  const patchLoc = (id: string, patch: Partial<DraftLocation>) => {
    touch();
    setLocations(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  };
  const addLoc = () => {
    touch();
    setLocations(prev => [...prev, {
      id: tempId(), name: '', pic: null, status: 'in_progress',
      note: null, note_flag: false, components: [],
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
      ...l, components: [...l.components, { id: tempId(), label: '', state: 'pending' }],
    }));
  };
  const removeComp = (locId: string, compId: string) => {
    touch();
    if (!isNew(compId)) setRemovedComp(prev => [...prev, compId]);
    setLocations(prev => prev.map(l => l.id !== locId ? l : {
      ...l, components: l.components.filter(c => c.id !== compId),
    }));
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

  // ── Simpan seluruh draft ────────────────────────────────────────────────
  const save = async () => {
    if (locations.some(l => !l.name.trim())) {
      notify('error', 'Ada lokasi tanpa nama. Isi dulu sebelum menyimpan.');
      return;
    }
    setSaving(true);
    try {
      // 1) Hapus dulu, supaya baris yang dihapus tidak ikut divalidasi ulang.
      if (removedComp.length)  await supabase.from('progress_components').delete().in('id', removedComp);
      if (removedIssue.length) await supabase.from('progress_issues').delete().in('id', removedIssue);
      if (removedLoc.length)   await supabase.from('progress_locations').delete().in('id', removedLoc);

      // 2) Lokasi — progress DIHITUNG dari komponennya, tidak diisi manual.
      for (let i = 0; i < locations.length; i++) {
        const l = locations[i];
        const payload = {
          name: l.name.trim(),
          pic: l.pic?.trim() || null,
          status: l.status,
          note: l.note?.trim() || null,
          note_flag: l.note_flag,
          progress: computeProgress(l.components),
          sort_order: i,
        };

        let realLocId = l.id;
        if (isNew(l.id)) {
          const { data, error } = await supabase.from('progress_locations')
            .insert([{ ...payload, project_id: detail.project.id }]).select('id').single();
          if (error) throw error;
          realLocId = (data as { id: string }).id;
        } else {
          const { error } = await supabase.from('progress_locations').update(payload).eq('id', l.id);
          if (error) throw error;
        }

        // 3) Komponen milik lokasi ini
        const newComps = l.components.filter(c => isNew(c.id) && c.label.trim());
        if (newComps.length) {
          const { error } = await supabase.from('progress_components').insert(
            newComps.map((c, ci) => ({
              location_id: realLocId, label: c.label.trim(), state: c.state,
              sort_order: l.components.indexOf(c) >= 0 ? l.components.indexOf(c) : ci,
            })),
          );
          if (error) throw error;
        }
        for (const c of l.components) {
          if (isNew(c.id) || !c.label.trim()) continue;
          const { error } = await supabase.from('progress_components')
            .update({ label: c.label.trim(), state: c.state, sort_order: l.components.indexOf(c) })
            .eq('id', c.id);
          if (error) throw error;
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
        Mode edit — perubahan <b>belum tersimpan</b> sampai kamu menekan tombol
        “Simpan Perubahan” di bawah. Progres tiap lokasi dihitung otomatis dari
        status komponennya.
      </div>

      {/* ── Lokasi ── */}
      <div className="flex items-center justify-between">
        <SectionLabel>Lokasi ({locations.length})</SectionLabel>
        <button onClick={addLoc} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
          style={{ background: THEME.gradient }}>+ Tambah Lokasi</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {locations.map(loc => {
          const pct = computeProgress(loc.components);
          const bd = stateBreakdown(loc.components);
          return (
            <div key={loc.id} className="rounded-2xl p-4 flex flex-col gap-3 bg-white border border-gray-200">
              <div className="flex items-start gap-2">
                <input value={loc.name} placeholder="Nama lokasi"
                  onChange={e => patchLoc(loc.id, { name: e.target.value })}
                  className="flex-1 px-2.5 py-1.5 rounded-lg text-sm font-black text-gray-800 border-2 border-gray-200 focus:border-cyan-500 outline-none" />
                <button onClick={() => removeLoc(loc)}
                  className="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 font-bold flex-shrink-0">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* PIC diambil dari daftar Team PTS — bukan ketikan bebas */}
                <select value={loc.pic ?? ''} onChange={e => patchLoc(loc.id, { pic: e.target.value || null })}
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
              <div className="flex flex-col gap-1.5">
                {loc.components.map(c => (
                  <div key={c.id} className="flex items-center gap-1.5">
                    <select value={c.state} onChange={e => patchComp(loc.id, c.id, { state: e.target.value as ComponentState })}
                      className="px-1.5 py-1 rounded-md text-[10px] font-bold border border-gray-200 outline-none flex-shrink-0"
                      style={{ color: COMPONENT_STATE_CONFIG[c.state]?.dot }}>
                      {COMPONENT_STATES.map(st => (
                        <option key={st} value={st}>● {COMPONENT_STATE_CONFIG[st].label}</option>
                      ))}
                    </select>
                    <input value={c.label} placeholder="Nama komponen"
                      onChange={e => patchComp(loc.id, c.id, { label: e.target.value })}
                      className="flex-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-gray-200 focus:border-cyan-500 outline-none" />
                    <button onClick={() => removeComp(loc.id, c.id)}
                      className="text-gray-300 hover:text-rose-500 font-bold px-1 flex-shrink-0">✕</button>
                  </div>
                ))}
                <button onClick={() => addComp(loc.id)}
                  className="text-[11px] font-bold text-cyan-700 hover:text-cyan-900 self-start">+ Tambah komponen</button>
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

      {/* ── Isu ── */}
      <div className="flex items-center justify-between">
        <SectionLabel>Rekap Isu ({issues.length})</SectionLabel>
        <button onClick={addIssue} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>+ Tambah Isu</button>
      </div>

      <div className="flex flex-col gap-2">
        {issues.map(is => (
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
            <button onClick={() => removeIssue(is.id)}
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

// ─── UI kecil ────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl text-sm font-medium border-2 border-gray-200 focus:border-cyan-500 outline-none bg-white';
const inputSm  = 'w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border-2 border-gray-200 focus:border-cyan-500 outline-none bg-white';

/**
 * Baris ikon aksi — dipakai DUA tempat (tabel desktop & kartu mobile) supaya
 * tidak ada duplikasi tombol yang bisa lupa disinkronkan.
 */
function RowActions({ p, canEdit, onView, onExport, onShare, onEdit, onDelete }: {
  p: ProgressProject; canEdit: boolean;
  onView: () => void; onExport: () => void; onShare: () => void;
  onEdit: () => void; onDelete: () => void;
}) {
  return (
    <ActionGroup>
      <ViewIconBtn onClick={onView} label="Lihat Detail" />
      <IconBtn label="Export Excel" color="#059669" onClick={onExport}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
      </IconBtn>
      {canEdit && (
        <>
          <IconBtn label={p.share_enabled ? 'Share View-Only (aktif)' : 'Share View-Only'}
            color={p.share_enabled ? '#0891b2' : '#94a3b8'} onClick={onShare}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" /></svg>
          </IconBtn>
          <EditIconBtn onClick={onEdit} label="Edit" />
          <DeleteIconBtn onClick={onDelete} label="Hapus" />
        </>
      )}
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

function IconBtn({ label, color, onClick, children }: {
  label: string; color: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={label}
      className="w-7 h-7 rounded-lg border flex items-center justify-center transition-all hover:text-white"
      style={{ color, borderColor: `${color}40`, background: `${color}12` }}
      onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = '#fff'; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${color}12`; e.currentTarget.style.color = color; }}>
      {children}
    </button>
  );
}
