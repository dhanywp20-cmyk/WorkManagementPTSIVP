'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  supabase, User, Material, FolderNode,
  buildFolderTree, countMaterials, fmtDate, SearchInput,
  AppDialog, DialogState, BtnEdit, BtnDelete, BtnOpen,
} from './shared';

// ─── Folder Color Palette ─────────────────────────────────────────────────────

const FOLDER_COLORS = [
  { gradient: 'linear-gradient(135deg,#3b82f6,#4f46e5)', light: '#dbeafe', icon: '#3b82f6' },
  { gradient: 'linear-gradient(135deg,#10b981,#0d9488)', light: '#d1fae5', icon: '#10b981' },
  { gradient: 'linear-gradient(135deg,#8b5cf6,#9333ea)', light: '#ede9fe', icon: '#8b5cf6' },
  { gradient: 'linear-gradient(135deg,#f59e0b,#f97316)', light: '#fef3c7', icon: '#f59e0b' },
  { gradient: 'linear-gradient(135deg,#f43f5e,#db2777)', light: '#ffe4e6', icon: '#f43f5e' },
  { gradient: 'linear-gradient(135deg,#06b6d4,#0284c7)', light: '#cffafe', icon: '#06b6d4' },
];
const getFolderColor = (name: string) => FOLDER_COLORS[name.charCodeAt(0) % FOLDER_COLORS.length];

// ─── Grid helper ──────────────────────────────────────────────────────────────

const GRID_COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

// ─── MaterialCard ─────────────────────────────────────────────────────────────

function MaterialCard({
  material: m, isAdmin, onDelete, onEdit, compact, colorHex,
}: {
  material: Material; isAdmin: boolean; onDelete?: (id: string) => void;
  onEdit?: (m: Material) => void;
  compact?: boolean; colorHex?: string;
}) {
  const hex = colorHex || '#3b82f6';
  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl border border-white/60 hover:border-white/90 hover:shadow-md transition-all duration-200 mb-1.5"
      style={{ background: 'rgba(255,255,255,0.72)' }}>
      <div className={`${compact ? 'w-7 h-7' : 'w-9 h-9'} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}
        style={{ background: `${hex}18`, border: `1.5px solid ${hex}33` }}>
        <svg className={`${compact ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5'}`} style={{ color: hex }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`font-semibold text-slate-800 group-hover:text-blue-700 transition-colors ${compact ? 'text-xs' : 'text-sm'} truncate`}>{m.materi_name}</h4>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] text-slate-400">{fmtDate(m.created_at)}</span>
          {m.file_url && <span className="text-[10px] text-slate-300">• ada link</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {m.file_url && (
          <BtnOpen onClick={() => window.open(m.file_url!, '_blank')}>Buka</BtnOpen>
        )}
        {isAdmin && onEdit && (
          <BtnEdit onClick={() => onEdit(m)} />
        )}
        {isAdmin && onDelete && (
          <BtnDelete onClick={() => onDelete(m.id)} />
        )}
      </div>
    </div>
  );
}

// ─── FolderTreeView (used inside right panel) ────────────────────────────────

function FolderTreeView({
  node, depth = 0, isAdmin, onDelete, onEdit, expandedPaths, togglePath, onAddToFolder, gridCols = 2, colorHex,
}: {
  node: FolderNode; depth?: number; isAdmin: boolean; onDelete?: (id: string) => void;
  onEdit?: (m: Material) => void;
  expandedPaths: Set<string>; togglePath: (path: string) => void;
  onAddToFolder?: (path: string) => void;
  gridCols?: number; colorHex?: string;
}) {
  const folderKeys = Object.keys(node.children).sort();
  const hasMaterials = node.materials.length > 0;
  const hasFolders = folderKeys.length > 0;
  if (!hasMaterials && !hasFolders) return null;

  return (
    <div className={depth > 0 ? 'mt-1' : ''}>
      {/* Files at this level */}
      {hasMaterials && (
        <div className="space-y-1 mb-3">
          {node.materials.map(m => (
            <MaterialCard key={m.id} material={m} isAdmin={isAdmin} onDelete={onDelete} onEdit={onEdit} compact colorHex={colorHex} />
          ))}
        </div>
      )}

      {/* Subfolder grid */}
      {hasFolders && (
        <div className={`grid ${GRID_COLS[gridCols] ?? 'grid-cols-2'} gap-2`}>
          {folderKeys.map(key => {
            const child = node.children[key];
            const isOpen = expandedPaths.has(child.path);
            const totalInside = countMaterials(child);
            return (
              <div key={child.path}
                onClick={() => togglePath(child.path)}
                className={`flex flex-col gap-1.5 p-2.5 rounded-xl border cursor-pointer select-none transition-all
                  ${isOpen
                    ? 'border-blue-300 bg-blue-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm hover:bg-blue-50/40'}`}>
                <div className="flex items-start justify-between gap-1">
                  <svg className="w-7 h-7 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z"
                      fill={isOpen ? '#FCD34D' : '#FBBF24'} stroke="#D97706" strokeWidth="0.8" />
                  </svg>
                  {isAdmin && onAddToFolder && (
                    <button
                      onClick={e => { e.stopPropagation(); onAddToFolder(child.path); }}
                      className="w-4 h-4 rounded bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200 transition-all flex-shrink-0"
                      title={`Tambah ke "${child.name}"`}>+</button>
                  )}
                </div>
                <p className="text-[11px] font-bold text-slate-800 leading-snug line-clamp-2">{child.name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-400 font-medium">{totalInside} item</span>
                  <svg className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded subfolder panels */}
      {folderKeys.map(key => {
        const child = node.children[key];
        if (!expandedPaths.has(child.path)) return null;
        const hasContent = Object.keys(child.children).length > 0 || child.materials.length > 0;
        if (!hasContent) return null;
        return (
          <div key={`exp-${child.path}`} className="mt-2 rounded-xl border border-blue-200 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-blue-100 bg-blue-50/80">
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z" fill="#FCD34D" stroke="#D97706" strokeWidth="0.8" />
              </svg>
              <span className="text-[11px] font-bold text-blue-800 truncate">{child.name}</span>
              <span className="ml-auto text-[9px] text-blue-400 flex-shrink-0">{countMaterials(child)} item</span>
            </div>
            <div className="p-2.5">
              <FolderTreeView
                node={child} depth={depth + 1} isAdmin={isAdmin} onDelete={onDelete} onEdit={onEdit}
                expandedPaths={expandedPaths} togglePath={togglePath} onAddToFolder={onAddToFolder}
                gridCols={gridCols} colorHex={colorHex}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MateriPage ───────────────────────────────────────────────────────────────

export function MateriPage({ user, isAdmin }: { user: User; isAdmin: boolean }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ materi_name: '', file_url: '', folder_path: '', content_text: '' });
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'folder' | 'list'>('folder');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [renameFolder, setRenameFolder] = useState<{ oldName: string; newName: string } | null>(null);
  const [renameFolderSaving, setRenameFolderSaving] = useState(false);
  const [editMaterial, setEditMaterial] = useState<Material | null>(null);
  const [editMaterialSaving, setEditMaterialSaving] = useState(false);

  // Split-view state
  const [selectedFolderKey, setSelectedFolderKey] = useState<string | null>(null);
  const [rightExpandedPaths, setRightExpandedPaths] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data } = await supabase.from('lc_materials').select('*').order('folder_path', { ascending: true }).order('materi_name', { ascending: true });
    setMaterials(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Clear right panel when search changes
  useEffect(() => {
    setSelectedFolderKey(null);
    setRightExpandedPaths(new Set());
  }, [search]);

  const toggleRightPath = (path: string) => {
    setRightExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const openForm = (folderPath = '') => {
    setForm({ materi_name: '', file_url: '', folder_path: folderPath, content_text: '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.materi_name.trim()) {
      setDialog({ type: 'error', message: 'Nama materi wajib diisi!' });
      return;
    }
    setUploading(true);
    const { error } = await supabase.from('lc_materials').insert([{
      materi_name: form.materi_name,
      content_text: form.content_text || null,
      file_url: form.file_url || null,
      folder_path: form.folder_path.trim() || null,
      file_name: null, file_type: null, created_by: user.id,
    }]);
    setUploading(false);
    if (error) {
      setDialog({ type: 'error', message: 'Gagal menyimpan: ' + error.message });
      return;
    }
    setShowForm(false);
    load();
    setDialog({ type: 'success', message: 'Materi berhasil ditambahkan!' });
  };

  const handleDelete = (id: string) => {
    setDialog({
      type: 'confirm',
      title: 'Hapus Materi',
      message: 'Materi dan semua soal yang terkait akan dihapus permanen. Lanjutkan?',
      confirmLabel: 'Hapus',
      onConfirm: async () => {
        // Delete linked questions first (FK constraint)
        const { error: qErr } = await supabase.from('lc_questions').delete().eq('material_id', id);
        if (qErr) { setDialog({ type: 'error', title: 'Gagal Hapus', message: 'Gagal hapus soal terkait: ' + qErr.message }); return; }
        const { error } = await supabase.from('lc_materials').delete().eq('id', id);
        if (error) { setDialog({ type: 'error', title: 'Gagal Hapus', message: 'Gagal hapus materi: ' + error.message }); return; }
        load();
      },
    });
  };

  const handleRenameFolder = async () => {
    if (!renameFolder || !renameFolder.newName.trim()) return;
    const { oldName, newName } = renameFolder;
    if (oldName === newName.trim()) { setRenameFolder(null); return; }
    setRenameFolderSaving(true);
    const affected = materials.filter(m =>
      m.folder_path === oldName || m.folder_path?.startsWith(oldName + '/')
    );
    await Promise.all(affected.map(m =>
      supabase.from('lc_materials').update({
        folder_path: m.folder_path!.replace(oldName, newName.trim()),
      }).eq('id', m.id)
    ));
    setRenameFolderSaving(false);
    setRenameFolder(null);
    if (selectedFolderKey === oldName) setSelectedFolderKey(newName.trim());
    load();
  };

  const handleDeleteFolder = (folderName: string) => {
    const affected = materials.filter(m =>
      m.folder_path === folderName || m.folder_path?.startsWith(folderName + '/')
    );
    setDialog({
      type: 'confirm',
      title: 'Hapus Folder',
      message: `Folder "${folderName}" dan semua ${affected.length} materi di dalamnya akan dihapus permanen. Lanjutkan?`,
      confirmLabel: 'Hapus Folder',
      onConfirm: async () => {
        const ids = affected.map(m => m.id);
        // Delete linked questions first (FK constraint)
        if (ids.length > 0) {
          const { error: qErr } = await supabase.from('lc_questions').delete().in('material_id', ids);
          if (qErr) { setDialog({ type: 'error', title: 'Gagal Hapus', message: 'Gagal hapus soal terkait: ' + qErr.message }); return; }
        }
        const results = await Promise.all(affected.map(m => supabase.from('lc_materials').delete().eq('id', m.id)));
        const err = results.find((r: { error: unknown }) => r.error)?.error as { message: string } | undefined;
        if (err) { setDialog({ type: 'error', title: 'Gagal Hapus Folder', message: 'Gagal hapus materi: ' + err.message }); return; }
        if (selectedFolderKey === folderName) setSelectedFolderKey(null);
        load();
      },
    });
  };

  const handleEditMaterial = async () => {
    if (!editMaterial) return;
    setEditMaterialSaving(true);
    await supabase.from('lc_materials').update({
      materi_name: editMaterial.materi_name.trim(),
      file_url: editMaterial.file_url?.trim() || null,
      folder_path: editMaterial.folder_path?.trim() || null,
    }).eq('id', editMaterial.id);
    setEditMaterialSaving(false);
    setEditMaterial(null);
    load();
  };

  const filtered = search
    ? materials.filter(m =>
        m.materi_name.toLowerCase().includes(search.toLowerCase()) ||
        (m.folder_path ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : materials;

  const tree = buildFolderTree(filtered);
  const rootFolderKeys = Object.keys(tree.children).sort();
  const rootHasFolders = rootFolderKeys.length > 0;
  const existingPaths = Array.from(new Set(materials.map(m => m.folder_path).filter(Boolean) as string[])).sort();

  // Selected folder node (always root-level child)
  const selectedFolderNode = selectedFolderKey ? (tree.children[selectedFolderKey] ?? null) : null;

  // Derived color for open panel
  const panelCol = selectedFolderKey ? getFolderColor(selectedFolderKey) : null;
  const panelOpen = !!(selectedFolderNode && panelCol);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0"
        style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight">📚 Materi Training</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin ? 'Kelola & organisir materi training team' : 'Materi training tersedia untuk dipelajari'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari materi..." />
          <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
            <button onClick={() => setViewMode('folder')}
              className={`px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'folder' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              📁 Folder
            </button>
            <button onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              📋 List
            </button>
          </div>
          {isAdmin && (
            <button onClick={() => openForm()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white rounded-xl shadow-md hover:scale-[1.03] transition-all"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>
              <span className="text-base leading-none">+</span> Tambah Materi
            </button>
          )}
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="flex items-center gap-5 px-6 py-2 border-b border-slate-100 text-xs flex-shrink-0"
        style={{ background: 'rgba(248,250,252,0.8)' }}>
        <span className="text-slate-500">📦 <strong className="text-slate-700">{materials.length}</strong> materi</span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-500">📁 <strong className="text-slate-700">{rootFolderKeys.length}</strong> folder</span>
        {panelOpen && panelCol && (
          <>
            <span className="text-slate-300">|</span>
            <span className="text-slate-400">Folder: <strong style={{ color: panelCol.icon }}>{selectedFolderNode!.name}</strong></span>
          </>
        )}
      </div>

      {/* ── Main area: left scrollable + right pane ── */}
      <div className="flex-1 relative overflow-hidden">

        {/* LEFT scrollable content */}
        <div className="h-full overflow-y-auto"
          style={{
            paddingRight: panelOpen ? 'calc(42% + 1px)' : '0',
            transition: 'padding-right 0.28s cubic-bezier(0.4,0,0.2,1)',
          }}>
          <div className="p-6">

            {!isAdmin && (
              <div className="mb-5 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-3 flex items-center gap-3">
                <span className="text-lg">ℹ️</span>
                <p className="text-sm text-indigo-700">Klik tombol <strong>Buka</strong> untuk mengakses file materi di OneDrive.</p>
              </div>
            )}

            {filtered.length === 0 && (
              <div className="flex justify-center py-16">
                <div className="text-center px-10 py-8 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
                  <div className="text-5xl mb-3">{search ? '🔍' : '📭'}</div>
                  <p className="font-semibold text-slate-700">{search ? 'Tidak ada materi yang cocok' : 'Belum ada materi'}</p>
                  {isAdmin && !search && <p className="text-sm mt-1 text-slate-500">Klik + Tambah Materi untuk mulai</p>}
                </div>
              </div>
            )}

            {filtered.length > 0 && (
              <>
                {/* ── FOLDER VIEW ── */}
                {viewMode === 'folder' && (
                  <>
                    {/* Root-level files */}
                    {tree.materials.length > 0 && (
                      <div className="mb-5">
                        {tree.materials.map(m => (
                          <MaterialCard key={m.id} material={m} isAdmin={isAdmin}
                            onDelete={isAdmin ? handleDelete : undefined}
                            onEdit={isAdmin ? setEditMaterial : undefined} />
                        ))}
                      </div>
                    )}

                    {/* Colorful folder grid */}
                    {rootHasFolders && (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {rootFolderKeys.map(key => {
                            const child = tree.children[key];
                            const isSelected = selectedFolderKey === key;
                            const totalInside = countMaterials(child);
                            const col = getFolderColor(key);
                            return (
                              <div key={child.path} className="group relative">
                                <button
                                  onClick={() => {
                                    setSelectedFolderKey(isSelected ? null : key);
                                    setRightExpandedPaths(new Set());
                                  }}
                                  className={`w-full text-left rounded-2xl border-2 p-4 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5
                                    ${isSelected ? 'shadow-lg -translate-y-0.5' : 'border-slate-200 bg-white'}`}
                                  style={isSelected ? { borderColor: col.icon, background: col.light } : {}}>
                                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 shadow-sm transition-all"
                                    style={{ background: isSelected ? col.gradient : col.light }}>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                      <path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z"
                                        fill={isSelected ? '#FCD34D' : col.light === '#fef3c7' ? '#FBBF24' : col.icon + '88'}
                                        stroke={isSelected ? '#D97706' : col.icon} strokeWidth="0.9" />
                                    </svg>
                                  </div>
                                  <p className="text-sm font-bold text-slate-800 leading-snug mb-1.5 line-clamp-2 pr-6">{child.name}</p>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-medium text-slate-400">{totalInside} materi</span>
                                    <div className="flex items-center gap-1">
                                      {isAdmin && (
                                        <button
                                          onClick={e => { e.stopPropagation(); openForm(child.path); }}
                                          className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs border transition-all opacity-0 group-hover:opacity-100"
                                          style={{ background: col.light, border: `1px solid ${col.icon}44`, color: col.icon }}
                                          title={`Tambah ke "${child.name}"`}>+</button>
                                      )}
                                      <svg className={`w-3 h-3 transition-all ${isSelected ? 'rotate-90' : 'text-slate-300'}`}
                                        style={isSelected ? { color: col.icon } : {}}
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                  </div>
                                </button>
                                {/* Folder action buttons */}
                                {isAdmin && (
                                  <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button
                                      onClick={e => { e.stopPropagation(); setRenameFolder({ oldName: key, newName: key }); }}
                                      className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-blue-100 bg-white/80 border border-slate-200 hover:border-blue-300"
                                      title="Ubah nama folder">
                                      <svg width="11" height="11" fill="none" stroke="#3b82f6" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleDeleteFolder(key); }}
                                      className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-rose-100 bg-white/80 border border-slate-200 hover:border-rose-300"
                                      title="Hapus folder">
                                      <svg width="11" height="11" fill="none" stroke="#be123c" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* ── LIST VIEW ── */}
                {viewMode === 'list' && (
                  <div className="space-y-1.5">
                    {filtered.map(m => {
                      const rootKey = m.folder_path ? m.folder_path.split('/')[0] : null;
                      const col = rootKey ? getFolderColor(rootKey) : null;
                      return (
                        <MaterialCard key={m.id} material={m} isAdmin={isAdmin}
                          onDelete={isAdmin ? handleDelete : undefined}
                          onEdit={isAdmin ? setEditMaterial : undefined}
                          colorHex={col?.icon} />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT PANE: Windows Explorer style, full height ── */}
        <div
          className="absolute top-0 right-0 bottom-0 flex flex-col"
          style={{
            width: '42%',
            background: 'rgba(255,255,255,0.62)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            borderLeft: panelOpen && panelCol
              ? `2px solid ${panelCol.icon}40`
              : '1px solid rgba(0,0,0,0.07)',
            boxShadow: panelOpen ? '-4px 0 24px rgba(0,0,0,0.08)' : 'none',
            transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1), border-color 0.2s ease, box-shadow 0.2s ease',
          }}>

          {panelOpen && panelCol && selectedFolderNode ? (
            <>
              {/* Panel header — colored strip */}
              <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${panelCol.light}cc, rgba(255,255,255,0.55))`,
                  borderBottom: `1px solid ${panelCol.icon}22`,
                }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0"
                  style={{ background: panelCol.gradient }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z"
                      fill="#FCD34D" stroke="#D97706" strokeWidth="0.8" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-slate-800 truncate">{selectedFolderNode.name}</p>
                  <p className="text-xs font-medium" style={{ color: panelCol.icon }}>
                    {countMaterials(selectedFolderNode)} materi
                  </p>
                </div>
                {isAdmin && (
                  <>
                    <button onClick={() => setRenameFolder({ oldName: selectedFolderNode.name, newName: selectedFolderNode.name })}
                      className="w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all hover:scale-110"
                      style={{ background: panelCol.icon + '18', borderColor: panelCol.icon + '44' }}
                      title="Ubah nama folder">
                      <svg width="14" height="14" fill="none" stroke={panelCol.icon} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => openForm(selectedFolderNode.path)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm border-2 transition-all hover:scale-110"
                      style={{ background: panelCol.icon + '18', borderColor: panelCol.icon + '44', color: panelCol.icon }}
                      title="Tambah materi ke folder ini">+</button>
                  </>
                )}
                <button onClick={() => setSelectedFolderKey(null)}
                  className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg border border-slate-200 transition-all flex-shrink-0">✕</button>
              </div>

              {/* Panel content — scrollable */}
              <div className="flex-1 overflow-y-auto p-4" style={{ background: 'transparent' }}>
                <FolderTreeView
                  node={selectedFolderNode}
                  depth={0}
                  isAdmin={isAdmin}
                  onDelete={isAdmin ? handleDelete : undefined}
                  onEdit={isAdmin ? setEditMaterial : undefined}
                  expandedPaths={rightExpandedPaths}
                  togglePath={toggleRightPath}
                  onAddToFolder={isAdmin ? openForm : undefined}
                  gridCols={2}
                  colorHex={panelCol.icon}
                />
              </div>
            </>
          ) : null}
        </div>

      </div>

      {/* ── Modal: Add Materi ── */}
      {isAdmin && showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">✏️ Tambah Materi Baru</h3>
              <button onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all text-xl font-light">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Nama Materi *</label>
                <input value={form.materi_name} onChange={e => setForm(p => ({ ...p, materi_name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="contoh: Pengenalan Produk Microvision" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Folder Path <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case tracking-normal">(opsional)</span>
                </label>
                <input
                  value={form.folder_path}
                  onChange={e => setForm(p => ({ ...p, folder_path: e.target.value }))}
                  list="folder-path-suggestions"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="contoh: Produk/Microvision" />
                <datalist id="folder-path-suggestions">
                  {existingPaths.map(p => <option key={p} value={p} />)}
                </datalist>
                {form.folder_path && (
                  <p className="text-xs text-slate-400 mt-1">Akan disimpan di: <strong className="text-slate-600">{form.folder_path}</strong></p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Link OneDrive <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case tracking-normal">(opsional)</span>
                </label>
                <input value={form.file_url} onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="https://1drv.ms/b/s!..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Konten Teks untuk AI <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case tracking-normal">(opsional)</span>
                </label>
                <textarea value={form.content_text} onChange={e => setForm(p => ({ ...p, content_text: e.target.value }))}
                  rows={3} placeholder="Paste ringkasan atau poin-poin materi..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" />
                <p className="text-xs text-slate-400 mt-1">{form.content_text.length} karakter</p>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-all">
                Batal
              </button>
              <button onClick={handleSave} disabled={uploading}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow transition-all disabled:opacity-60">
                {uploading ? '💾 Menyimpan...' : '💾 Simpan Materi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Rename Folder ── */}
      {isAdmin && renameFolder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">✏️ Ubah Nama Folder</h3>
              <button onClick={() => setRenameFolder(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all text-xl font-light">×</button>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-400 mb-4">Semua materi dalam folder ini akan diperbarui secara otomatis.</p>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Nama Folder Baru</label>
              <input
                value={renameFolder.newName}
                onChange={e => setRenameFolder(p => p && ({ ...p, newName: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(); if (e.key === 'Escape') setRenameFolder(null); }}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-1"
                autoFocus
                placeholder="Nama folder baru..."
              />
              <p className="text-xs text-slate-400 mb-4">Sebelumnya: <strong className="text-slate-600">{renameFolder.oldName}</strong></p>
              <div className="flex gap-3">
                <button onClick={handleRenameFolder} disabled={renameFolderSaving}
                  className="flex-1 py-2.5 text-white text-sm font-bold rounded-xl disabled:opacity-60 transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#3b82f6,#4f46e5)' }}>
                  {renameFolderSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Menyimpan...
                    </span>
                  ) : '💾 Simpan'}
                </button>
                <button onClick={() => setRenameFolder(null)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-all">
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Material ── */}
      {isAdmin && editMaterial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">✏️ Edit Materi</h3>
              <button onClick={() => setEditMaterial(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all text-xl font-light">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Nama Materi *</label>
                <input
                  value={editMaterial.materi_name}
                  onChange={e => setEditMaterial(p => p && ({ ...p, materi_name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  autoFocus
                  placeholder="Nama materi..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Folder Path <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case tracking-normal">(opsional)</span>
                </label>
                <input
                  value={editMaterial.folder_path ?? ''}
                  onChange={e => setEditMaterial(p => p && ({ ...p, folder_path: e.target.value }))}
                  list="edit-folder-path-suggestions"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="contoh: Produk/Microvision" />
                <datalist id="edit-folder-path-suggestions">
                  {existingPaths.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Link OneDrive <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case tracking-normal">(opsional)</span>
                </label>
                <input
                  value={editMaterial.file_url ?? ''}
                  onChange={e => setEditMaterial(p => p && ({ ...p, file_url: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="https://1drv.ms/b/s!..." />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setEditMaterial(null)}
                className="flex-1 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-all">
                Batal
              </button>
              <button onClick={handleEditMaterial} disabled={editMaterialSaving}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow transition-all disabled:opacity-60">
                {editMaterialSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Menyimpan...
                  </span>
                ) : '💾 Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
