'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@/app/dashboard/_components/shared';
import {
  TechNoteFolder, TechNote, TechNoteHistory,
  STATUS_CONFIG, ACTION_CONFIG, KKM_REQUIRED,
  formatDate, formatDateShort, getInitials,
} from './_components/shared';

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
    </div>
  );
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const colors = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444'];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: colors[idx],
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, flexShrink: 0, fontFamily: 'monospace',
    }}>
      {getInitials(name)}
    </div>
  );
}

function StatusBadge({ status }: { status: TechNote['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: cfg.color, background: cfg.bg, border: `1.5px solid ${cfg.border}`,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── KPI Summary Bar (di atas list) ──────────────────────────────────────────
function TechNoteKPISummary({
  technotes, currentUser, year,
}: { technotes: TechNote[]; currentUser: User; year: number }) {
  const isTeam = currentUser.role === 'team' || currentUser.role === 'team_pts';

  // Per-user stats untuk team
  if (isTeam) {
    const myNotes = technotes.filter(t => t.author_id === currentUser.id);
    const approved = myNotes.filter(t => t.status === 'approved').length;
    const pending  = myNotes.filter(t => t.status === 'pending').length;
    const pct = Math.min(100, Math.round((approved / KKM_REQUIRED) * 100));
    const met = approved >= KKM_REQUIRED;
    return (
      <div className="rounded-2xl border p-4 mb-5" style={{ background: met ? '#d1fae5' : '#fdf4ff', borderColor: met ? '#6ee7b7' : '#ec489940' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: met ? '#065f46' : '#be185d' }}>
              📝 KPI R&D Tech Note {year} — Progres Saya
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Target KKM: <b>{KKM_REQUIRED} Tech Note approved</b> per tahun (bobot 10%)</div>
          </div>
          <span className="text-[11px] font-black px-2.5 py-1 rounded-full" style={{
            background: met ? '#065f46' : pct >= 50 ? '#92400e' : '#991b1b',
            color: '#fff',
          }}>
            {met ? '✅ KKM Terpenuhi' : `${pct}% — ${KKM_REQUIRED - approved} lagi`}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-3 bg-white/60 rounded-full overflow-hidden border" style={{ borderColor: met ? '#6ee7b7' : '#ec489960' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: met ? 'linear-gradient(90deg,#10b981,#34d399)' : pct >= 50 ? 'linear-gradient(90deg,#f59e0b,#fcd34d)' : 'linear-gradient(90deg,#ec4899,#f9a8d4)' }} />
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-2xl font-black" style={{ color: met ? '#059669' : '#ec4899' }}>{approved}</span>
            <span className="text-sm text-slate-400 font-medium"> / {KKM_REQUIRED} approved</span>
          </div>
        </div>
        {pending > 0 && (
          <div className="mt-2 text-[11px] text-amber-600 font-semibold">
            ⏳ {pending} Tech Note sedang menunggu review
          </div>
        )}
      </div>
    );
  }

  // Admin/SPV: summary semua anggota
  const teamMembers = [...new Set(technotes.map(t => t.author_id))];
  const totalApproved = technotes.filter(t => t.status === 'approved').length;
  const totalPending  = technotes.filter(t => t.status === 'pending').length;
  return (
    <div className="rounded-2xl border border-pink-200 p-4 mb-5" style={{ background: '#fdf4ff' }}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-pink-700 mb-3">
        📝 Ringkasan KPI R&D Tech Note {year} — Semua Tim (Target: {KKM_REQUIRED}/orang)
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 text-center border border-pink-100">
          <div className="text-2xl font-black text-pink-600">{totalApproved}</div>
          <div className="text-[11px] text-slate-500 font-medium">Total Approved</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center border border-amber-100">
          <div className="text-2xl font-black text-amber-500">{totalPending}</div>
          <div className="text-[11px] text-slate-500 font-medium">Pending Review</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
          <div className="text-2xl font-black text-slate-700">{technotes.length}</div>
          <div className="text-[11px] text-slate-500 font-medium">Total Submissions</div>
        </div>
      </div>
    </div>
  );
}

// ─── Folder Sidebar ───────────────────────────────────────────────────────────
function FolderSidebar({
  folders, technotes, selected, onSelect,
  onAdd, canManage,
}: {
  folders: TechNoteFolder[]; technotes: TechNote[];
  selected: string | null; onSelect: (id: string | null) => void;
  onAdd: () => void; canManage: boolean;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const roots = folders.filter(f => !f.parent_id);

  function countNotes(fid: string): number {
    const direct = technotes.filter(t => t.folder_id === fid).length;
    const children = folders.filter(f => f.parent_id === fid);
    return direct + children.reduce((s, c) => s + countNotes(c.id), 0);
  }

  function FolderItem({ folder, depth = 0 }: { folder: TechNoteFolder; depth?: number }) {
    const children = folders.filter(f => f.parent_id === folder.id);
    const isOpen = expanded[folder.id];
    const isSelected = selected === folder.id;
    const count = countNotes(folder.id);
    return (
      <div>
        <div
          onClick={() => {
            onSelect(isSelected ? null : folder.id);
            if (children.length) setExpanded(e => ({ ...e, [folder.id]: !e[folder.id] }));
          }}
          className="flex items-center gap-2 rounded-xl cursor-pointer transition-all mb-0.5"
          style={{
            padding: `7px 10px 7px ${10 + depth * 18}px`,
            background: isSelected ? `${folder.color}18` : 'transparent',
            border: isSelected ? `1.5px solid ${folder.color}50` : '1.5px solid transparent',
          }}
        >
          {children.length > 0 && (
            <span className="text-[9px] text-slate-400 transition-transform" style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
          )}
          {!children.length && <span className="w-3" />}
          <span className="text-base">{folder.icon}</span>
          <span className="flex-1 text-[13px] font-semibold truncate" style={{ color: isSelected ? folder.color : '#374151' }}>{folder.name}</span>
          {count > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: folder.color }}>{count}</span>
          )}
        </div>
        {isOpen && children.map(c => <FolderItem key={c.id} folder={c} depth={depth + 1} />)}
      </div>
    );
  }

  return (
    <div className="w-56 shrink-0 bg-white border-r border-slate-200 p-3 overflow-y-auto flex flex-col gap-1">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Folder</span>
        {canManage && (
          <button onClick={onAdd}
            className="text-[11px] font-bold bg-pink-50 text-pink-600 border border-pink-200 rounded-lg px-2 py-0.5 hover:bg-pink-100 transition-colors">
            + Folder
          </button>
        )}
      </div>
      {/* All */}
      <div
        onClick={() => onSelect(null)}
        className="flex items-center gap-2 rounded-xl px-2.5 py-2 cursor-pointer transition-all mb-1"
        style={{ background: selected === null ? '#fdf4ff' : 'transparent', border: selected === null ? '1.5px solid #ec489940' : '1.5px solid transparent' }}
      >
        <span className="text-base">🏠</span>
        <span className="flex-1 text-[13px] font-semibold" style={{ color: selected === null ? '#ec4899' : '#374151' }}>Semua Tech Note</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white bg-pink-400">{technotes.length}</span>
      </div>
      {roots.map(f => <FolderItem key={f.id} folder={f} />)}
    </div>
  );
}

// ─── Approval History Timeline ────────────────────────────────────────────────
function HistoryTimeline({ history }: { history: TechNoteHistory[] }) {
  if (!history.length) return null;
  return (
    <div className="mt-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">📋 Riwayat Approval</div>
      <div className="space-y-2">
        {history.map((h, i) => {
          const actionKey = h.action as keyof typeof ACTION_CONFIG;
          const cfg = ACTION_CONFIG[actionKey] ?? { label: h.action, color: '#6b7280', icon: '📌' };
          return (
            <div key={h.id ?? i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 shrink-0"
                  style={{ background: `${cfg.color}18`, borderColor: `${cfg.color}40` }}>
                  {cfg.icon}
                </div>
                {i < history.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-1 mb-1 min-h-[12px]" />}
              </div>
              <div className="pb-3 flex-1">
                <div className="text-[12px] font-bold capitalize" style={{ color: cfg.color }}>{cfg.label}</div>
                <div className="text-[11px] text-slate-500">
                  oleh <b className="text-slate-700">{h.performed_by_name}</b> · {formatDate(h.created_at)}
                </div>
                {h.note && (
                  <div className="mt-1.5 text-[12px] text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border-l-2" style={{ borderColor: cfg.color }}>
                    {h.note}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, width = 560, children }: {
  open: boolean; onClose: () => void; title: string; width?: number; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 text-lg leading-none transition-colors">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[12px] font-bold text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm text-slate-800 bg-slate-50 outline-none focus:border-pink-400 focus:bg-white transition-all";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TechNotePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [folders, setFolders] = useState<TechNoteFolder[]>([]);
  const [technotes, setTechnotes] = useState<TechNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'pending' | 'mine'>('all');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [year, setYear] = useState(new Date().getFullYear());

  // Modals
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [detailNote, setDetailNote] = useState<TechNote | null>(null);
  const [detailHistory, setDetailHistory] = useState<TechNoteHistory[]>([]);
  const [approveModal, setApproveModal] = useState<TechNote | null>(null);

  // Forms
  const [folderForm, setFolderForm] = useState({ name: '', icon: '📄', color: '#ec4899', parent_id: '' });
  const [uploadForm, setUploadForm] = useState({ title: '', description: '', product: '', one_drive_link: '', folder_id: '', tags: '' });
  const [approvalForm, setApprovalForm] = useState({ action: 'approved', note: '' });
  const [saving, setSaving] = useState(false);

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'supervisor';
  const isTeam = !canManage;

  // ── Auth ──
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('currentUser') : null;
    if (stored) {
      try { setCurrentUser(JSON.parse(stored) as User); } catch {}
    }
  }, []);

  // ── Fetch ──
  const fetchFolders = useCallback(async () => {
    const { data } = await supabase.from('tech_note_folders').select('*').order('name');
    setFolders((data ?? []) as TechNoteFolder[]);
  }, []);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    const yearStart = `${year}-01-01`;
    const yearEnd   = `${year}-12-31`;
    let q = supabase.from('tech_notes').select('*')
      .gte('submitted_at', yearStart)
      .lte('submitted_at', yearEnd + 'T23:59:59')
      .order('submitted_at', { ascending: false });
    if (isTeam && currentUser) q = q.eq('author_id', currentUser.id);
    const { data } = await q;
    setTechnotes((data ?? []) as TechNote[]);
    setLoading(false);
  }, [year, currentUser, isTeam]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);
  useEffect(() => { if (currentUser) fetchNotes(); }, [fetchNotes, currentUser]);

  // ── Open detail → fetch history ──
  async function openDetail(tn: TechNote) {
    setDetailNote(tn);
    const { data } = await supabase
      .from('tech_note_history')
      .select('*')
      .eq('tech_note_id', tn.id)
      .order('created_at');
    setDetailHistory((data ?? []) as TechNoteHistory[]);
  }

  // ── Folder CRUD ──
  async function saveFolder() {
    if (!folderForm.name.trim()) return;
    setSaving(true);
    await supabase.from('tech_note_folders').insert({
      name: folderForm.name.trim(),
      icon: folderForm.icon || '📄',
      color: folderForm.color,
      parent_id: folderForm.parent_id || null,
      created_by: currentUser?.full_name ?? 'Admin',
    });
    setFolderForm({ name: '', icon: '📄', color: '#ec4899', parent_id: '' });
    setSaving(false);
    setShowFolderModal(false);
    fetchFolders();
  }

  // ── Upload Tech Note ──
  async function submitTechNote() {
    if (!uploadForm.title.trim() || !uploadForm.folder_id || !uploadForm.one_drive_link.trim()) return;
    if (!currentUser) return;
    setSaving(true);
    const now = new Date().toISOString();
    const tags = uploadForm.tags.split(',').map(s => s.trim()).filter(Boolean);
    const { data: inserted } = await supabase.from('tech_notes').insert({
      title: uploadForm.title.trim(),
      description: uploadForm.description.trim(),
      folder_id: uploadForm.folder_id,
      author_id: currentUser.id,
      author_name: currentUser.full_name,
      one_drive_link: uploadForm.one_drive_link.trim(),
      product: uploadForm.product.trim(),
      tags,
      status: 'pending',
      submitted_at: now,
      team_type: currentUser.team_type ?? '',
    }).select('id').single();

    if (inserted && (inserted as { id: string }).id) {
      const insertedId = (inserted as { id: string }).id;
      await supabase.from('tech_note_history').insert({
        tech_note_id: insertedId,
        action: 'submitted',
        performed_by: currentUser.id,
        performed_by_name: currentUser.full_name,
        note: 'Submitted for review',
        created_at: now,
      });
    }
    setUploadForm({ title: '', description: '', product: '', one_drive_link: '', folder_id: '', tags: '' });
    setSaving(false);
    setShowUploadModal(false);
    fetchNotes();
  }

  // ── Approval ──
  async function submitApproval() {
    if (!approveModal || !currentUser) return;
    setSaving(true);
    const now = new Date().toISOString();
    const newStatus = approvalForm.action === 'approved' ? 'approved'
                    : approvalForm.action === 'rejected' ? 'rejected'
                    : 'revision';
    await supabase.from('tech_notes').update({
      status: newStatus,
      reviewed_at: now,
      reviewed_by: currentUser.id,
      reviewed_by_name: currentUser.full_name,
      review_note: approvalForm.note || null,
    }).eq('id', approveModal.id);

    await supabase.from('tech_note_history').insert({
      tech_note_id: approveModal.id,
      action: approvalForm.action,
      performed_by: currentUser.id,
      performed_by_name: currentUser.full_name,
      note: approvalForm.note || null,
      created_at: now,
    });

    setSaving(false);
    setApproveModal(null);
    setDetailNote(null);
    setApprovalForm({ action: 'approved', note: '' });
    fetchNotes();
  }

  // ── Filtered list ──
  const pendingCount = technotes.filter(t => t.status === 'pending').length;
  const filtered = technotes.filter(t => {
    if (selectedFolder && t.folder_id !== selectedFolder) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (tab === 'pending' && t.status !== 'pending') return false;
    if (tab === 'mine' && t.author_id !== currentUser?.id) return false;
    const q = search.toLowerCase();
    if (q && !t.title.toLowerCase().includes(q) && !t.product.toLowerCase().includes(q) && !(t.tags ?? []).some(g => g.toLowerCase().includes(q))) return false;
    return true;
  });

  const currentYear = new Date().getFullYear();

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* ── Top Bar ── */}
      <div className="bg-gradient-to-r from-pink-800 via-rose-700 to-pink-600 px-5 py-3 flex items-center gap-3 shadow-lg shrink-0">
        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl">📝</div>
        <div>
          <h1 className="text-white font-black text-lg leading-tight tracking-tight">Tech Note R&D</h1>
          <p className="text-pink-200 text-[11px] font-medium">Dokumentasi teknikal & R&D · KPI 10% · Target {KKM_REQUIRED} approved/tahun</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Year filter */}
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-white/20 text-white border border-white/30 rounded-xl px-3 py-1.5 text-sm font-bold outline-none">
            {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y} className="text-slate-800">{y}</option>)}
          </select>
          <button onClick={() => setShowUploadModal(true)}
            className="bg-white text-pink-700 font-bold text-sm px-4 py-2 rounded-xl hover:bg-pink-50 transition-colors shadow-sm flex items-center gap-1.5">
            ➕ Upload Tech Note
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <FolderSidebar
          folders={folders} technotes={technotes}
          selected={selectedFolder} onSelect={setSelectedFolder}
          onAdd={() => setShowFolderModal(true)} canManage={canManage}
        />

        {/* ── Main Content ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* KPI Summary */}
          {currentUser && (
            <TechNoteKPISummary technotes={technotes} currentUser={currentUser} year={year} />
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4">
            {([ 
              { id: 'all',     label: `Semua (${technotes.length})` },
              ...(canManage ? [{ id: 'pending', label: `⏳ Approval Queue${pendingCount > 0 ? ` (${pendingCount})` : ''}` }] : []),
              { id: 'mine',   label: `📁 Milik Saya (${technotes.filter(t => t.author_id === currentUser?.id).length})` },
            ] as { id: string; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
                className="px-4 py-1.5 rounded-xl text-[13px] font-bold transition-all"
                style={{
                  background: tab === t.id ? '#be185d' : '#fff',
                  color: tab === t.id ? '#fff' : '#64748b',
                  border: tab === t.id ? '1.5px solid #be185d' : '1.5px solid #e2e8f0',
                }}>
                {t.label}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari judul, produk, tag..."
                  className="pl-8 pr-3 py-2 text-[13px] border-2 border-slate-200 rounded-xl outline-none focus:border-pink-400 bg-white w-52 transition-all" />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2 text-[13px] border-2 border-slate-200 rounded-xl outline-none bg-white focus:border-pink-400">
                <option value="all">Semua Status</option>
                <option value="approved">✅ Approved</option>
                <option value="pending">⏳ Pending</option>
                <option value="revision">🔄 Perlu Revisi</option>
                <option value="rejected">❌ Ditolak</option>
              </select>
            </div>
          </div>

          {/* Cards */}
          {loading ? <Spinner /> : (
            <>
              {filtered.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <div className="text-5xl mb-3">📭</div>
                  <div className="font-bold text-base">Tidak ada Tech Note ditemukan</div>
                  <div className="text-sm mt-1">Coba ubah filter atau upload Tech Note baru</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map(tn => {
                    const folder = folders.find(f => f.id === tn.folder_id);
                    return (
                      <div key={tn.id}
                        onClick={() => openDetail(tn)}
                        className="bg-white rounded-2xl border-2 border-slate-100 p-4 cursor-pointer hover:border-pink-300 hover:shadow-lg transition-all group"
                      >
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {folder && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${folder.color}18`, color: folder.color }}>
                                {folder.icon} {folder.name}
                              </span>
                            )}
                          </div>
                          <StatusBadge status={tn.status} />
                        </div>
                        <h4 className="font-bold text-[14px] text-slate-900 leading-snug mb-1.5 group-hover:text-pink-700 transition-colors">{tn.title}</h4>
                        <p className="text-[12px] text-slate-500 mb-3 line-clamp-2">{tn.description}</p>
                        {(tn.tags ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {(tn.tags ?? []).slice(0, 3).map(tag => (
                              <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-medium">#{tag}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <Avatar name={tn.author_name} size={22} />
                            <span className="text-[11px] text-slate-600 font-medium truncate max-w-[100px]">{tn.author_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">{formatDateShort(tn.submitted_at)}</span>
                            {tn.one_drive_link && (
                              <a href={tn.one_drive_link} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1">
                                ☁️ Drive
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══ MODAL: Add Folder ══ */}
      <Modal open={showFolderModal} onClose={() => setShowFolderModal(false)} title="➕ Buat Folder Baru">
        <Field label="Nama Folder *">
          <input className={inputCls} value={folderForm.name} onChange={e => setFolderForm(p => ({ ...p, name: e.target.value }))} placeholder="cth: Engine Systems" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Icon (emoji)">
            <input className={inputCls} value={folderForm.icon} onChange={e => setFolderForm(p => ({ ...p, icon: e.target.value }))} placeholder="📄" />
          </Field>
          <Field label="Warna">
            <input type="color" value={folderForm.color} onChange={e => setFolderForm(p => ({ ...p, color: e.target.value }))}
              className="w-full h-11 border-2 border-slate-200 rounded-xl cursor-pointer p-1" />
          </Field>
        </div>
        <Field label="Parent Folder (opsional)">
          <select className={inputCls} value={folderForm.parent_id} onChange={e => setFolderForm(p => ({ ...p, parent_id: e.target.value }))}>
            <option value="">— Root (tidak ada parent) —</option>
            {folders.filter(f => !f.parent_id).map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
          </select>
        </Field>
        <div className="flex gap-3 justify-end mt-2">
          <button onClick={() => setShowFolderModal(false)} className="px-4 py-2 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50">Batal</button>
          <button onClick={saveFolder} disabled={saving || !folderForm.name.trim()}
            className="px-4 py-2 rounded-xl bg-pink-600 text-white text-sm font-bold hover:bg-pink-700 disabled:opacity-50 transition-colors">
            {saving ? '⏳ Menyimpan...' : '💾 Simpan Folder'}
          </button>
        </div>
      </Modal>

      {/* ══ MODAL: Upload Tech Note ══ */}
      <Modal open={showUploadModal} onClose={() => setShowUploadModal(false)} title="📤 Upload Tech Note" width={600}>
        <Field label="Judul Tech Note *">
          <input className={inputCls} value={uploadForm.title} onChange={e => setUploadForm(p => ({ ...p, title: e.target.value }))} placeholder="cth: Prosedur Overhaul Engine 6HK1" />
        </Field>
        <Field label="Deskripsi">
          <textarea className={inputCls} rows={3} value={uploadForm.description} onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))} placeholder="Jelaskan isi Tech Note secara singkat..." />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nama Produk *">
            <input className={inputCls} value={uploadForm.product} onChange={e => setUploadForm(p => ({ ...p, product: e.target.value }))} placeholder="cth: Engine 6HK1" />
          </Field>
          <Field label="Folder *">
            <select className={inputCls} value={uploadForm.folder_id} onChange={e => setUploadForm(p => ({ ...p, folder_id: e.target.value }))}>
              <option value="">— Pilih Folder —</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="🔗 Link OneDrive *">
          <input className={inputCls} value={uploadForm.one_drive_link} onChange={e => setUploadForm(p => ({ ...p, one_drive_link: e.target.value }))} placeholder="https://1drv.ms/b/..." />
        </Field>
        <Field label="Tags (pisahkan koma)">
          <input className={inputCls} value={uploadForm.tags} onChange={e => setUploadForm(p => ({ ...p, tags: e.target.value }))} placeholder="cth: overhaul, engine, isuzu" />
        </Field>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-700 font-medium mb-4">
          ⚠️ Tech Note akan masuk ke <b>Approval Queue</b> dan perlu disetujui Admin/Supervisor. Setelah disetujui, akan otomatis terhitung dalam KPI R&D Anda.
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50">Batal</button>
          <button onClick={submitTechNote} disabled={saving || !uploadForm.title.trim() || !uploadForm.folder_id || !uploadForm.one_drive_link.trim()}
            className="px-4 py-2 rounded-xl bg-pink-600 text-white text-sm font-bold hover:bg-pink-700 disabled:opacity-50 transition-colors">
            {saving ? '⏳ Mengirim...' : '📤 Submit untuk Review'}
          </button>
        </div>
      </Modal>

      {/* ══ MODAL: Detail Tech Note ══ */}
      {detailNote && (
        <Modal open={!!detailNote} onClose={() => setDetailNote(null)} title="📄 Detail Tech Note" width={640}>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-black text-[16px] text-slate-900 leading-snug flex-1">{detailNote.title}</h3>
              <StatusBadge status={detailNote.status} />
            </div>
            <p className="text-[13px] text-slate-600 leading-relaxed mb-3">{detailNote.description}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] text-slate-500">
              <span>🏷️ <b className="text-slate-700">Produk:</b> {detailNote.product}</span>
              <span>👤 <b className="text-slate-700">Author:</b> {detailNote.author_name}</span>
              <span>📅 <b className="text-slate-700">Submit:</b> {formatDate(detailNote.submitted_at)}</span>
              {detailNote.reviewed_by_name && <span>✅ <b className="text-slate-700">Reviewed by:</b> {detailNote.reviewed_by_name}</span>}
            </div>
            {(detailNote.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {(detailNote.tags ?? []).map(tag => (
                  <span key={tag} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold border border-blue-200">#{tag}</span>
                ))}
              </div>
            )}
            {detailNote.one_drive_link && (
              <a href={detailNote.one_drive_link} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 bg-blue-600 text-white text-[12px] font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
                ☁️ Buka di OneDrive →
              </a>
            )}
          </div>

          {detailNote.review_note && (
            <div className="rounded-xl border px-4 py-3 mb-4 text-[12px]"
              style={{ background: STATUS_CONFIG[detailNote.status].bg, borderColor: STATUS_CONFIG[detailNote.status].border, color: STATUS_CONFIG[detailNote.status].color }}>
              <b>Catatan Reviewer:</b> {detailNote.review_note}
            </div>
          )}

          <HistoryTimeline history={detailHistory} />

          {canManage && detailNote.status === 'pending' && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 justify-end">
              <button onClick={() => { setApproveModal(detailNote); setApprovalForm({ action: 'approved', note: '' }); }}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors">✅ Approve</button>
              <button onClick={() => { setApproveModal(detailNote); setApprovalForm({ action: 'revision_requested', note: '' }); }}
                className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors">🔄 Minta Revisi</button>
              <button onClick={() => { setApproveModal(detailNote); setApprovalForm({ action: 'rejected', note: '' }); }}
                className="px-4 py-2 rounded-xl bg-slate-400 text-white text-sm font-bold hover:bg-slate-500 transition-colors">❌ Tolak</button>
            </div>
          )}
        </Modal>
      )}

      {/* ══ MODAL: Approval Decision ══ */}
      {approveModal && (
        <Modal open={!!approveModal} onClose={() => setApproveModal(null)} title="📋 Keputusan Approval" width={460}>
          <p className="text-[13px] text-slate-600 mb-4">
            Tech Note: <b className="text-slate-900">"{approveModal.title}"</b><br />
            <span className="text-[11px] text-slate-400">oleh {approveModal.author_name} · {formatDateShort(approveModal.submitted_at)}</span>
          </p>
          <Field label="Keputusan *">
            <select className={inputCls} value={approvalForm.action} onChange={e => setApprovalForm(p => ({ ...p, action: e.target.value }))}>
              <option value="approved">✅ Approve — Setujui Tech Note</option>
              <option value="revision_requested">🔄 Minta Revisi — Perlu perbaikan</option>
              <option value="rejected">❌ Tolak — Tech Note ditolak</option>
            </select>
          </Field>
          <Field label={`Catatan ${approvalForm.action === 'approved' ? '(opsional)' : '*'}`}>
            <textarea className={inputCls} rows={3} value={approvalForm.note}
              onChange={e => setApprovalForm(p => ({ ...p, note: e.target.value }))}
              placeholder={approvalForm.action === 'approved' ? 'Berikan komentar positif...' : 'Jelaskan apa yang perlu diperbaiki...'} />
          </Field>
          {approvalForm.action === 'approved' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] text-emerald-700 font-medium mb-4">
              ✅ Tech Note akan otomatis terhitung dalam KPI R&D anggota ({KKM_REQUIRED} target/tahun)
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button onClick={() => setApproveModal(null)} className="px-4 py-2 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-bold">Batal</button>
            <button onClick={submitApproval} disabled={saving}
              className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-colors"
              style={{ background: approvalForm.action === 'approved' ? '#10b981' : approvalForm.action === 'revision_requested' ? '#f59e0b' : '#6b7280' }}>
              {saving ? '⏳...' : approvalForm.action === 'approved' ? '✅ Konfirmasi Approve' : approvalForm.action === 'revision_requested' ? '🔄 Kirim Revisi' : '❌ Tolak'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
