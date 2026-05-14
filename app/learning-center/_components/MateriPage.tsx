'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  supabase, User, Material, FolderNode,
  buildFolderTree, countMaterials, fmtDate, SearchInput,
  AppDialog, DialogState,
} from './shared';

// ─── Grid helper ──────────────────────────────────────────────────────────────

const GRID_COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

// ─── MaterialCard ─────────────────────────────────────────────────────────────

function MaterialCard({
  material: m, isAdmin, onDelete, compact,
}: {
  material: Material; isAdmin: boolean; onDelete?: (id: string) => void; compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3 hover:shadow-md hover:border-blue-200 transition-all mb-1.5"
      style={{ background: '#ffffff' }}>
      <div className={`${compact ? 'w-7 h-7' : 'w-9 h-9'} rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0`}>
        <svg className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`font-semibold text-slate-800 ${compact ? 'text-xs' : 'text-sm'} truncate`}>{m.materi_name}</h4>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {m.content_text && (
            <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded font-semibold">AI ✓</span>
          )}
          <span className="text-[10px] text-slate-400">{fmtDate(m.created_at)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {m.file_url && (
          <a href={m.file_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg transition-all">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Buka
          </a>
        )}
        {isAdmin && onDelete && (
          <button onClick={() => onDelete(m.id)}
            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all" title="Hapus materi">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── FolderTreeView (used inside right panel) ────────────────────────────────

function FolderTreeView({
  node, depth = 0, isAdmin, onDelete, expandedPaths, togglePath, onAddToFolder, gridCols = 2,
}: {
  node: FolderNode; depth?: number; isAdmin: boolean; onDelete?: (id: string) => void;
  expandedPaths: Set<string>; togglePath: (path: string) => void;
  onAddToFolder?: (path: string) => void;
  gridCols?: number;
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
            <MaterialCard key={m.id} material={m} isAdmin={isAdmin} onDelete={onDelete} compact />
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
                node={child} depth={depth + 1} isAdmin={isAdmin} onDelete={onDelete}
                expandedPaths={expandedPaths} togglePath={togglePath} onAddToFolder={onAddToFolder}
                gridCols={gridCols}
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
      message: 'Materi ini akan dihapus permanen. Lanjutkan?',
      confirmLabel: 'Hapus',
      onConfirm: async () => {
        await supabase.from('lc_materials').delete().eq('id', id);
        load();
      },
    });
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

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">📚 Materi Training</h1>
          <p className="text-sm text-slate-500 mt-0.5">
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-2">
              <span>+</span> Tambah Materi
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="p-8">
        {!isAdmin && (
          <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-3 flex items-center gap-3">
            <span className="text-lg">ℹ️</span>
            <p className="text-sm text-indigo-700">Klik tombol <strong>Buka</strong> untuk mengakses file materi di OneDrive.</p>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">{search ? '🔍' : '📭'}</div>
            <p className="font-semibold">{search ? 'Tidak ada materi yang cocok' : 'Belum ada materi'}</p>
            {isAdmin && !search && <p className="text-sm mt-1">Klik + Tambah Materi untuk mulai</p>}
          </div>
        )}

        {filtered.length > 0 && (
          <>
            {/* ── FOLDER VIEW — Split Layout ── */}
            {viewMode === 'folder' && (
              <div className="flex gap-5 items-start">

                {/* LEFT: root files + folder grid */}
                <div className="flex-1 min-w-0">
                  {/* Root-level files (no folder) */}
                  {tree.materials.length > 0 && (
                    <div className="mb-5">
                      {rootHasFolders && (
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">📄 Tanpa Folder</p>
                      )}
                      {tree.materials.map(m => (
                        <MaterialCard key={m.id} material={m} isAdmin={isAdmin} onDelete={isAdmin ? handleDelete : undefined} />
                      ))}
                    </div>
                  )}

                  {/* 5-column folder grid */}
                  {rootHasFolders && (
                    <div className="grid grid-cols-5 gap-2.5">
                      {rootFolderKeys.map(key => {
                        const child = tree.children[key];
                        const isSelected = selectedFolderKey === key;
                        const totalInside = countMaterials(child);
                        return (
                          <div key={child.path}
                            onClick={() => {
                              setSelectedFolderKey(isSelected ? null : key);
                              setRightExpandedPaths(new Set());
                            }}
                            className={`flex flex-col gap-2 p-3 rounded-xl border cursor-pointer select-none transition-all
                              ${isSelected
                                ? 'border-blue-400 bg-blue-50 shadow-md ring-2 ring-blue-100'
                                : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm hover:bg-blue-50/40'}`}>
                            <div className="flex items-start justify-between gap-1">
                              <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                                <path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z"
                                  fill={isSelected ? '#FCD34D' : '#FBBF24'} stroke="#D97706" strokeWidth="0.8" />
                              </svg>
                              {isAdmin && (
                                <button
                                  onClick={e => { e.stopPropagation(); openForm(child.path); }}
                                  className="w-5 h-5 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200 transition-all flex-shrink-0 mt-0.5"
                                  title={`Tambah materi ke "${child.name}"`}>+</button>
                              )}
                            </div>
                            <p className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">{child.name}</p>
                            <div className="flex items-center justify-between mt-auto">
                              <span className="text-[10px] text-slate-400 font-medium">{totalInside} item</span>
                              <svg className={`w-3 h-3 transition-transform ${isSelected ? 'text-blue-500 rotate-90' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* RIGHT: detail panel */}
                <div className="w-72 flex-shrink-0">
                  {selectedFolderNode ? (
                    <div className="bg-white border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
                      {/* Panel header */}
                      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                          <path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z" fill="#FCD34D" stroke="#D97706" strokeWidth="0.8" />
                        </svg>
                        <span className="text-sm font-bold text-blue-900 flex-1 truncate">{selectedFolderNode.name}</span>
                        <span className="text-xs text-blue-400 font-medium flex-shrink-0">{countMaterials(selectedFolderNode)} item</span>
                        <button onClick={() => setSelectedFolderKey(null)}
                          className="w-6 h-6 rounded-lg bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-blue-500 font-bold text-sm transition-all flex-shrink-0">✕</button>
                      </div>
                      {/* Panel content */}
                      <div className="p-3 max-h-[calc(100vh-230px)] overflow-y-auto">
                        <FolderTreeView
                          node={selectedFolderNode}
                          depth={0}
                          isAdmin={isAdmin}
                          onDelete={isAdmin ? handleDelete : undefined}
                          expandedPaths={rightExpandedPaths}
                          togglePath={toggleRightPath}
                          onAddToFolder={isAdmin ? openForm : undefined}
                          gridCols={2}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Empty state */
                    <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center">
                      <div className="text-4xl mb-3">📂</div>
                      <p className="text-sm font-semibold text-slate-500">Klik folder untuk<br/>melihat isi</p>
                      {rootHasFolders && (
                        <p className="text-xs text-slate-400 mt-2">{rootFolderKeys.length} folder tersedia</p>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ── LIST VIEW ── */}
            {viewMode === 'list' && (
              <div className="space-y-3">
                {filtered.map(m => (
                  <MaterialCard key={m.id} material={m} isAdmin={isAdmin} onDelete={isAdmin ? handleDelete : undefined} />
                ))}
              </div>
            )}
          </>
        )}
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

      {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
