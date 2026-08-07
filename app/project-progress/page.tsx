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
import { ProjectDetailView } from './_components/ProjectDetailView';
import { exportProjectToExcel } from './_components/excel-export';
import {
  THEME, ProgressProject, ProgressLocation, ProgressComponent, ProgressIssue,
  ProjectDetail, ProjectStatus, ComponentState, Severity,
  STATUS_CONFIG, SEVERITY_CONFIG, COMPONENT_STATE_CONFIG,
  averageProgress, componentsOf, formatDatetime,
  newShareToken, shareUrl, canEditProjectProgress,
} from './_components/shared';

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
          onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="bg-white w-full h-full flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 flex items-center justify-between gap-3 flex-shrink-0"
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
                  <button onClick={() => setEditMode(m => !m)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                    style={editMode
                      ? { background: '#fff', color: THEME.colorLight }
                      : { background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}>
                    {editMode ? '✓ Selesai Edit' : '✏️ Edit'}
                  </button>
                )}
                <button onClick={() => exportProjectToExcel(detail)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition-all"
                  style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)' }}>
                  ⬇ Excel
                </button>
                <button onClick={() => setDetail(null)}
                  className="w-8 h-8 rounded-lg text-white font-bold flex items-center justify-center transition-all"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
              {detailLoading ? (
                <p className="text-center text-sm font-bold text-gray-400 py-16">Memuat detail…</p>
              ) : editMode && canEdit ? (
                <DetailEditor detail={detail} onChanged={reloadDetail} notify={notify}
                  setConfirmState={setConfirmState} />
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

function DetailEditor({ detail, onChanged, notify, setConfirmState }: {
  detail: ProjectDetail;
  onChanged: () => void;
  notify: (t: 'success' | 'error', m: string) => void;
  setConfirmState: (s: ConfirmState | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const locations = [...detail.locations].sort((a, b) => a.sort_order - b.sort_order);

  const run = async (fn: () => Promise<{ error: { message: string } | null }>, okMsg?: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { notify('error', 'Gagal: ' + error.message); return; }
    if (okMsg) notify('success', okMsg);
    onChanged();
  };

  const addLocation = () => run(async () =>
    await supabase.from('progress_locations').insert([{
      project_id: detail.project.id, name: 'Lokasi Baru', status: 'in_progress',
      progress: 0, sort_order: locations.length,
    }]), 'Lokasi ditambahkan.');

  const updateLocation = (id: string, patch: Partial<ProgressLocation>) => run(async () =>
    await supabase.from('progress_locations').update(patch).eq('id', id));

  const deleteLocation = (loc: ProgressLocation) => setConfirmState({
    message: 'Hapus Lokasi?',
    description: `"${loc.name}" beserta komponennya akan dihapus.`,
    confirmLabel: 'Hapus', danger: true,
    onConfirm: async () => {
      setConfirmState(null);
      await run(async () => await supabase.from('progress_locations').delete().eq('id', loc.id), 'Lokasi dihapus.');
    },
  });

  const addComponent = (locId: string, count: number) => run(async () =>
    await supabase.from('progress_components').insert([{
      location_id: locId, label: 'Komponen baru', state: 'done', sort_order: count,
    }]), 'Komponen ditambahkan.');

  const updateComponent = (id: string, patch: Partial<ProgressComponent>) => run(async () =>
    await supabase.from('progress_components').update(patch).eq('id', id));

  const deleteComponent = (id: string) => run(async () =>
    await supabase.from('progress_components').delete().eq('id', id), 'Komponen dihapus.');

  const addIssue = () => run(async () =>
    await supabase.from('progress_issues').insert([{
      project_id: detail.project.id, issue: 'Isu baru', severity: 'sedang',
      sort_order: detail.issues.length,
    }]), 'Isu ditambahkan.');

  const updateIssue = (id: string, patch: Partial<ProgressIssue>) => run(async () =>
    await supabase.from('progress_issues').update(patch).eq('id', id));

  const deleteIssue = (id: string) => run(async () =>
    await supabase.from('progress_issues').delete().eq('id', id), 'Isu dihapus.');

  return (
    <div className={`flex flex-col gap-5 ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
      <div className="rounded-xl px-4 py-3 text-[11px] font-semibold"
        style={{ background: '#ecfeff', border: '1px solid #a5f3fc', color: '#0e7490' }}>
        Mode edit aktif — perubahan langsung tersimpan. Klik “Selesai Edit” untuk kembali ke tampilan biasa.
      </div>

      {/* ── Lokasi ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Lokasi ({locations.length})</p>
        <button onClick={addLocation} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
          style={{ background: THEME.gradient }}>+ Tambah Lokasi</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {locations.map(loc => {
          const comps = componentsOf(detail.components, loc.id);
          return (
            <div key={loc.id} className="rounded-2xl p-4 flex flex-col gap-3 bg-white border border-gray-200">
              <div className="flex items-start gap-2">
                <input defaultValue={loc.name} onBlur={e => { if (e.target.value !== loc.name) updateLocation(loc.id, { name: e.target.value }); }}
                  className="flex-1 px-2.5 py-1.5 rounded-lg text-sm font-black text-gray-800 border-2 border-gray-200 focus:border-cyan-500 outline-none" />
                <button onClick={() => deleteLocation(loc)}
                  className="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 font-bold flex-shrink-0">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input defaultValue={loc.pic ?? ''} placeholder="PIC"
                  onBlur={e => { if (e.target.value !== (loc.pic ?? '')) updateLocation(loc.id, { pic: e.target.value || null }); }}
                  className={inputSm} />
                <select defaultValue={loc.status}
                  onChange={e => updateLocation(loc.id, { status: e.target.value as ProjectStatus })}
                  className={inputSm}>
                  {(['in_progress', 'done', 'blocked'] as ProjectStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input type="range" min={0} max={100} defaultValue={loc.progress}
                  onMouseUp={e => updateLocation(loc.id, { progress: Number((e.target as HTMLInputElement).value) })}
                  onTouchEnd={e => updateLocation(loc.id, { progress: Number((e.target as HTMLInputElement).value) })}
                  className="flex-1 accent-cyan-600" />
                <input type="number" min={0} max={100} defaultValue={loc.progress}
                  onBlur={e => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    if (v !== loc.progress) updateLocation(loc.id, { progress: v });
                  }}
                  className="w-16 px-2 py-1.5 rounded-lg text-xs font-bold text-center border-2 border-gray-200 focus:border-cyan-500 outline-none" />
              </div>

              {/* Komponen */}
              <div className="flex flex-col gap-1.5">
                {comps.map(c => (
                  <div key={c.id} className="flex items-center gap-1.5">
                    <select defaultValue={c.state} onChange={e => updateComponent(c.id, { state: e.target.value as ComponentState })}
                      className="px-1.5 py-1 rounded-md text-[10px] font-bold border border-gray-200 outline-none"
                      style={{ color: COMPONENT_STATE_CONFIG[c.state]?.dot }}>
                      <option value="done">● Selesai</option>
                      <option value="warning">● Perhatian</option>
                      <option value="blocked">● Blocker</option>
                    </select>
                    <input defaultValue={c.label}
                      onBlur={e => { if (e.target.value !== c.label) updateComponent(c.id, { label: e.target.value }); }}
                      className="flex-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-gray-200 focus:border-cyan-500 outline-none" />
                    <button onClick={() => deleteComponent(c.id)} className="text-gray-300 hover:text-rose-500 font-bold px-1">✕</button>
                  </div>
                ))}
                <button onClick={() => addComponent(loc.id, comps.length)}
                  className="text-[11px] font-bold text-cyan-700 hover:text-cyan-900 self-start">+ Tambah komponen</button>
              </div>

              <textarea defaultValue={loc.note ?? ''} rows={2} placeholder="Catatan lokasi…"
                onBlur={e => { if (e.target.value !== (loc.note ?? '')) updateLocation(loc.id, { note: e.target.value || null }); }}
                className={inputSm} />
              <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 cursor-pointer">
                <input type="checkbox" defaultChecked={loc.note_flag}
                  onChange={e => updateLocation(loc.id, { note_flag: e.target.checked })}
                  className="accent-rose-500" />
                Tandai sebagai catatan penting
              </label>
            </div>
          );
        })}
      </div>

      {/* ── Isu ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Rekap Isu ({detail.issues.length})</p>
        <button onClick={addIssue} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>+ Tambah Isu</button>
      </div>

      <div className="flex flex-col gap-2">
        {[...detail.issues].sort((a, b) => a.sort_order - b.sort_order).map(is => (
          <div key={is.id} className="rounded-xl p-3 bg-white border border-gray-200 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
            <input defaultValue={is.location_label ?? ''} placeholder="Lokasi"
              onBlur={e => { if (e.target.value !== (is.location_label ?? '')) updateIssue(is.id, { location_label: e.target.value || null }); }}
              className={`${inputSm} md:col-span-2`} />
            <input defaultValue={is.issue} placeholder="Isu"
              onBlur={e => { if (e.target.value !== is.issue) updateIssue(is.id, { issue: e.target.value }); }}
              className={`${inputSm} md:col-span-3`} />
            <select defaultValue={is.severity} onChange={e => updateIssue(is.id, { severity: e.target.value as Severity })}
              className={`${inputSm} md:col-span-2`}>
              {(['tinggi', 'sedang', 'rendah'] as Severity[]).map(s => (
                <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>
              ))}
            </select>
            <input defaultValue={is.note ?? ''} placeholder="Keterangan"
              onBlur={e => { if (e.target.value !== (is.note ?? '')) updateIssue(is.id, { note: e.target.value || null }); }}
              className={`${inputSm} md:col-span-4`} />
            <button onClick={() => deleteIssue(is.id)}
              className="md:col-span-1 text-rose-500 hover:bg-rose-50 rounded-lg py-1.5 font-bold">✕</button>
          </div>
        ))}
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
