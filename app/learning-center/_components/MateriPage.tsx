'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  supabase, User, Material, FolderNode,
  buildFolderTree, countMaterials, fmtDate, SearchInput,
  AppDialog, DialogState,
} from './shared';

// ─── Folder color palette ─────────────────────────────────────────────────────
const FOLDER_COLORS = [
  { bg: 'from-blue-500 to-indigo-600',   light: '#dbeafe', icon: '#3b82f6' },
  { bg: 'from-emerald-500 to-teal-600',  light: '#d1fae5', icon: '#10b981' },
  { bg: 'from-violet-500 to-purple-600', light: '#ede9fe', icon: '#8b5cf6' },
  { bg: 'from-amber-500 to-orange-500',  light: '#fef3c7', icon: '#f59e0b' },
  { bg: 'from-rose-500 to-pink-600',     light: '#ffe4e6', icon: '#f43f5e' },
  { bg: 'from-cyan-500 to-sky-600',      light: '#cffafe', icon: '#06b6d4' },
];
const getFolderColor = (name: string) => FOLDER_COLORS[name.charCodeAt(0) % FOLDER_COLORS.length];

// ─── FolderIcon ───────────────────────────────────────────────────────────────
function FolderIcon({ size = 20, open = false }: { size?: number; open?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z"
        fill={open ? '#FCD34D' : '#FBBF24'} stroke="#D97706" strokeWidth="0.9" />
    </svg>
  );
}

// ─── MaterialCard ─────────────────────────────────────────────────────────────
function MaterialCard({ material: m, isAdmin, onDelete, colorHex }: {
  material: Material; isAdmin: boolean; onDelete?: (id: string) => void; colorHex?: string;
}) {
  return (
    <div className="group flex items-center gap-3.5 p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-md transition-all duration-200">
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
        style={{ background: colorHex ? `${colorHex}22` : '#dbeafe', border: `1.5px solid ${colorHex ? `${colorHex}44` : '#bfdbfe'}` }}>
        <svg className="w-5 h-5" style={{ color: colorHex || '#3b82f6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors truncate leading-snug">
          {m.materi_name}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {m.content_text && (
            <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md font-bold">
              ✦ AI Ready
            </span>
          )}
          <span className="text-[10px] text-slate-400 font-medium">{fmtDate(m.created_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {m.file_url && (
          <a href={m.file_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white shadow-sm transition-all hover:scale-105"
            style={{ background: colorHex ? `linear-gradient(135deg, ${colorHex}, ${colorHex}cc)` : 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Buka
          </a>
        )}
        {isAdmin && onDelete && (
          <button onClick={() => onDelete(m.id)}
            className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-500 border border-transparent hover:border-rose-400 transition-all" title="Hapus">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Always visible open button when no hover support */}
      {m.file_url && (
        <a href={m.file_url} target="_blank" rel="noreferrer"
          className="group-hover:hidden inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition-all flex-shrink-0">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Buka
        </a>
      )}
    </div>
  );
}

// ─── Recursive content renderer ───────────────────────────────────────────────
function FolderContent({
  node, isAdmin, onDelete, onAddToFolder, colorHex, depth = 0,
}: {
  node: FolderNode; isAdmin: boolean; onDelete?: (id: string) => void;
  onAddToFolder?: (path: string) => void; colorHex?: string; depth?: number;
}) {
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set());
  const subKeys = Object.keys(node.children).sort();

  const toggle = (path: string) =>
    setOpenSubs(prev => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });

  return (
    <div className={depth > 0 ? 'pl-0' : ''}>
      {/* Subfolder tiles */}
      {subKeys.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {subKeys.map(key => {
            const child = node.children[key];
            const isOpen = openSubs.has(child.path);
            const total = countMaterials(child);
            return (
              <div key={child.path}>
                <button onClick={() => toggle(child.path)}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all duration-150
                    ${isOpen ? 'border-amber-300 bg-amber-50/80 shadow-sm' : 'border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/40 hover:shadow-sm'}`}>
                  <FolderIcon size={22} open={isOpen} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate leading-snug">{child.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{total} item</p>
                  </div>
                  {isAdmin && onAddToFolder && (
                    <button onClick={e => { e.stopPropagation(); onAddToFolder(child.path); }}
                      className="w-5 h-5 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200 flex-shrink-0">+</button>
                  )}
                  <svg className={`w-3 h-3 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="mt-1.5 pl-3 border-l-2 border-amber-200">
                    <FolderContent
                      node={child} isAdmin={isAdmin} onDelete={onDelete}
                      onAddToFolder={onAddToFolder} colorHex={colorHex} depth={depth + 1}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Materials at this level */}
      {node.materials.length > 0 && (
        <div className="space-y-1.5">
          {node.materials.map(m => (
            <MaterialCard key={m.id} material={m} isAdmin={isAdmin} onDelete={onDelete} colorHex={colorHex} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MateriPage ───────────────────────────────────────────────────────────────
export function MateriPage({ user, isAdmin }: { user: User; isAdmin: boolean }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ materi_name: '', file_url: '', folder_path: '', content_text: '' });
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('lc_materials').select('*')
      .order('folder_path', { ascending: true }).order('materi_name', { ascending: true });
    setMaterials(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelectedKey(null); }, [search]);

  const openForm = (folderPath = '') => {
    setForm({ materi_name: '', file_url: '', folder_path: folderPath, content_text: '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.materi_name.trim()) { setDialog({ type: 'error', message: 'Nama materi wajib diisi!' }); return; }
    setUploading(true);
    const { error } = await supabase.from('lc_materials').insert([{
      materi_name: form.materi_name, content_text: form.content_text || null,
      file_url: form.file_url || null, folder_path: form.folder_path.trim() || null,
      file_name: null, file_type: null, created_by: user.id,
    }]);
    setUploading(false);
    if (error) { setDialog({ type: 'error', message: 'Gagal menyimpan: ' + error.message }); return; }
    setShowForm(false); load();
    setDialog({ type: 'success', message: 'Materi berhasil ditambahkan!' });
  };

  const handleDelete = (id: string) => {
    setDialog({
      type: 'confirm', title: 'Hapus Materi', message: 'Materi ini akan dihapus permanen. Lanjutkan?',
      confirmLabel: 'Hapus',
      onConfirm: async () => { await supabase.from('lc_materials').delete().eq('id', id); load(); },
    });
  };

  const filtered = search
    ? materials.filter(m =>
        m.materi_name.toLowerCase().includes(search.toLowerCase()) ||
        (m.folder_path ?? '').toLowerCase().includes(search.toLowerCase()))
    : materials;

  const tree = buildFolderTree(filtered);
  const rootKeys = Object.keys(tree.children).sort();
  const existingPaths = Array.from(new Set(materials.map(m => m.folder_path).filter(Boolean) as string[])).sort();

  const selectedNode = selectedKey ? (tree.children[selectedKey] ?? null) : null;
  const selectedColor = selectedKey ? getFolderColor(selectedKey) : null;

  // For search: flat list
  const isSearching = !!search;

  return (
    <div className="flex flex-col h-full" style={{ background: '#f1f5f9', minHeight: 'calc(100vh - 100px)' }}>

      {/* ── Top Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0"
        style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3">
          {/* Sidebar toggle */}
          <button onClick={() => setSidebarOpen(o => !o)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all border border-slate-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? 'M4 6h16M4 12h16M4 18h16' : 'M4 6h16M4 12h10M4 18h16'} />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">📚 Materi Training</h1>
            <p className="text-xs text-slate-500">{isAdmin ? 'Kelola & organisir materi training team' : 'Materi training tersedia untuk dipelajari'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari materi atau folder..." />
          {isAdmin && (
            <button onClick={() => openForm()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white rounded-xl shadow-md hover:scale-[1.03] transition-all"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>
              <span className="text-base leading-none">+</span> Tambah Materi
            </button>
          )}
        </div>
      </div>

      {/* ── Body: Sidebar + Content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR — Folder list ── */}
        {sidebarOpen && (
          <div className="w-60 flex-shrink-0 border-r border-slate-200 flex flex-col overflow-hidden"
            style={{ background: '#ffffff' }}>
            {/* Sidebar header */}
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {rootKeys.length} Folder tersedia
              </p>
            </div>

            {/* Folder list */}
            <div className="flex-1 overflow-y-auto py-2 px-2">
              {/* All materials option */}
              <button
                onClick={() => setSelectedKey(null)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-1 text-left transition-all
                  ${!selectedKey ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all
                  ${!selectedKey ? 'bg-white/20' : 'bg-slate-100'}`}>
                  <svg className={`w-4 h-4 ${!selectedKey ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${!selectedKey ? 'text-white' : 'text-slate-700'}`}>Semua Materi</p>
                  <p className={`text-[10px] ${!selectedKey ? 'text-white/70' : 'text-slate-400'}`}>{filtered.length} item</p>
                </div>
              </button>

              {/* Folder items */}
              {rootKeys.map(key => {
                const child = tree.children[key];
                const total = countMaterials(child);
                const isSelected = selectedKey === key;
                const col = getFolderColor(key);
                return (
                  <button key={key} onClick={() => setSelectedKey(isSelected ? null : key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-1 text-left transition-all
                      ${isSelected
                        ? 'text-white shadow-md scale-[1.01]'
                        : 'text-slate-600 hover:bg-slate-50 hover:scale-[1.01]'}`}
                    style={isSelected ? { background: `linear-gradient(135deg, ${col.bg.replace('from-','').replace('to-','').split(' ').map(c => {
                      const m: Record<string,string> = {'blue-500':'#3b82f6','indigo-600':'#4f46e5','emerald-500':'#10b981','teal-600':'#0d9488','violet-500':'#8b5cf6','purple-600':'#9333ea','amber-500':'#f59e0b','orange-500':'#f97316','rose-500':'#f43f5e','pink-600':'#db2777','cyan-500':'#06b6d4','sky-600':'#0284c7'};
                      return m[c]||'#6366f1';
                    }).join(',')})`, boxShadow: `0 4px 12px ${col.icon}44` } : {}}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all`}
                      style={{ background: isSelected ? 'rgba(255,255,255,0.25)' : col.light }}>
                      <FolderIcon size={16} open={isSelected} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-700'}`}>{child.name}</p>
                      <p className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>{total} item</p>
                    </div>
                    {isAdmin && (
                      <button onClick={e => { e.stopPropagation(); openForm(child.path); }}
                        className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs border flex-shrink-0 transition-all
                          ${isSelected ? 'bg-white/20 border-white/30 text-white hover:bg-white/30' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'}`}>+</button>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sidebar footer stats */}
            <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
              <div className="flex-1 text-center">
                <p className="text-base font-black text-slate-800">{materials.length}</p>
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Total Materi</p>
              </div>
              <div className="w-px h-8 bg-slate-100" />
              <div className="flex-1 text-center">
                <p className="text-base font-black text-slate-800">{rootKeys.length}</p>
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Folder</p>
              </div>
              <div className="w-px h-8 bg-slate-100" />
              <div className="flex-1 text-center">
                <p className="text-base font-black text-emerald-600">{materials.filter(m => m.content_text).length}</p>
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">AI Ready</p>
              </div>
            </div>
          </div>
        )}

        {/* ── RIGHT CONTENT ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Content header bar */}
          <div className="sticky top-0 z-10 flex items-center gap-3 px-5 py-3 border-b border-slate-200"
            style={{ background: 'rgba(241,245,249,0.97)', backdropFilter: 'blur(8px)' }}>
            {selectedNode ? (
              <>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: selectedColor?.light }}>
                  <FolderIcon size={16} open />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{selectedNode.name}</p>
                  <p className="text-[10px] text-slate-400">{countMaterials(selectedNode)} materi</p>
                </div>
                <button onClick={() => setSelectedKey(null)} className="ml-auto text-slate-400 hover:text-slate-600 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-slate-700">
                  {isSearching ? `🔍 Hasil pencarian: "${search}"` : '📋 Semua Materi'}
                </p>
                <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{filtered.length} item</span>
              </>
            )}
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="flex justify-center items-center py-20">
              <div className="text-center px-10 py-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="text-5xl mb-3">{search ? '🔍' : '📭'}</div>
                <p className="font-bold text-slate-700">{search ? 'Tidak ada materi yang cocok' : 'Belum ada materi'}</p>
                {isAdmin && !search && <p className="text-sm mt-1 text-slate-500">Klik + Tambah Materi untuk mulai</p>}
              </div>
            </div>
          )}

          {/* Content body */}
          {filtered.length > 0 && (
            <div className="p-5">
              {!isAdmin && (
                <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <span>ℹ️</span>
                  <p className="text-xs text-indigo-700">Klik tombol <strong>Buka</strong> untuk mengakses materi di OneDrive.</p>
                </div>
              )}

              {/* SELECTED FOLDER VIEW */}
              {selectedNode && (
                <FolderContent
                  node={selectedNode} isAdmin={isAdmin}
                  onDelete={isAdmin ? handleDelete : undefined}
                  onAddToFolder={isAdmin ? openForm : undefined}
                  colorHex={selectedColor?.icon}
                />
              )}

              {/* ALL MATERIALS VIEW */}
              {!selectedNode && !isSearching && (
                <div className="space-y-6">
                  {/* Root materials (no folder) */}
                  {tree.materials.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-4 rounded-full bg-slate-400" />
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tanpa Folder</p>
                      </div>
                      <div className="space-y-1.5">
                        {tree.materials.map(m => (
                          <MaterialCard key={m.id} material={m} isAdmin={isAdmin} onDelete={isAdmin ? handleDelete : undefined} />
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Folders as sections */}
                  {rootKeys.map(key => {
                    const child = tree.children[key];
                    const col = getFolderColor(key);
                    return (
                      <div key={key}>
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="w-1 h-4 rounded-full" style={{ background: col.icon }} />
                          <FolderIcon size={18} />
                          <p className="text-sm font-bold text-slate-700">{child.name}</p>
                          <span className="text-xs text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">{countMaterials(child)} item</span>
                          <button onClick={() => setSelectedKey(key)}
                            className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-800 transition-all flex items-center gap-1">
                            Lihat semua <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                          </button>
                        </div>
                        <FolderContent
                          node={child} isAdmin={isAdmin}
                          onDelete={isAdmin ? handleDelete : undefined}
                          onAddToFolder={isAdmin ? openForm : undefined}
                          colorHex={col.icon}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SEARCH RESULTS */}
              {isSearching && (
                <div className="space-y-1.5">
                  {filtered.map(m => (
                    <MaterialCard key={m.id} material={m} isAdmin={isAdmin} onDelete={isAdmin ? handleDelete : undefined} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Add Materi ── */}
      {isAdmin && showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
              style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm">✏️</span>
                Tambah Materi Baru
              </h3>
              <button onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-all text-lg font-light">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Nama Materi *</label>
                <input value={form.materi_name} onChange={e => setForm(p => ({ ...p, materi_name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="contoh: Pengenalan Produk Microvision" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Folder Path <span className="text-[10px] font-normal text-slate-400 normal-case">(opsional)</span>
                </label>
                <input value={form.folder_path} onChange={e => setForm(p => ({ ...p, folder_path: e.target.value }))}
                  list="folder-path-suggestions"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="contoh: Produk/Microvision" />
                <datalist id="folder-path-suggestions">
                  {existingPaths.map(p => <option key={p} value={p} />)}
                </datalist>
                {form.folder_path && (
                  <p className="text-xs text-slate-400 mt-1">📁 <strong className="text-slate-600">{form.folder_path}</strong></p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Link OneDrive <span className="text-[10px] font-normal text-slate-400 normal-case">(opsional)</span>
                </label>
                <input value={form.file_url} onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="https://1drv.ms/b/s!..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Konten AI <span className="text-[10px] font-normal text-slate-400 normal-case">(opsional)</span>
                </label>
                <textarea value={form.content_text} onChange={e => setForm(p => ({ ...p, content_text: e.target.value }))}
                  rows={3} placeholder="Paste ringkasan atau poin-poin materi untuk AI quiz..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none transition-all" />
                <p className="text-xs text-slate-400 mt-1">{form.content_text.length} karakter</p>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-all">
                Batal
              </button>
              <button onClick={handleSave} disabled={uploading}
                className="flex-1 py-2.5 text-white text-sm font-bold rounded-xl shadow transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
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
