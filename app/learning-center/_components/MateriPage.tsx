'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  supabase, User, Material, FolderNode,
  buildFolderTree, countMaterials, fmtDate, SearchInput,
  generateWithGemini,
} from './shared';

function MaterialCard({ material: m, isAdmin, onDelete }: { material: Material; isAdmin: boolean; onDelete?: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-slate-200 shadow-sm p-3.5 flex items-center gap-3 hover:shadow-md hover:border-blue-200 transition-all mb-1.5 group"
      style={{ background: '#ffffff' }}>
      <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-slate-800 text-sm truncate">{m.materi_name}</h4>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {m.content_text && (
            <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded font-semibold">AI ✓</span>
          )}
          <span className="text-[11px] text-slate-400">{fmtDate(m.created_at)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {m.file_url && (
          <a href={m.file_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-all">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
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

function FolderTreeView({
  node, depth = 0, isAdmin, onDelete, expandedPaths, togglePath,
}: {
  node: FolderNode; depth?: number; isAdmin: boolean; onDelete?: (id: string) => void;
  expandedPaths: Set<string>; togglePath: (path: string) => void;
}) {
  const folderKeys = Object.keys(node.children).sort();
  const hasMaterials = node.materials.length > 0;
  const hasFolders = folderKeys.length > 0;
  if (!hasMaterials && !hasFolders) return null;

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-slate-200 pl-3 mt-0.5' : ''}>
      {folderKeys.map(key => {
        const child = node.children[key];
        const isOpen = expandedPaths.has(child.path);
        const totalInside = countMaterials(child);
        return (
          <div key={child.path} className="mb-0.5">
            <button
              onClick={() => togglePath(child.path)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition-all text-left border border-transparent hover:border-blue-200 max-w-xl w-full"
              style={{ background: 'rgba(255,255,255,0.96)' }}
            >
              <svg className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z" fill={isOpen ? '#FCD34D' : '#FBBF24'} />
                <path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z" fill="none" stroke="#D97706" strokeWidth="1" />
              </svg>
              <span className="font-semibold text-slate-800 text-sm select-none">{child.name}</span>
              <span className="text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full flex-shrink-0 ml-auto">{totalInside} item</span>
            </button>
            {isOpen && (
              <div className="mt-0.5">
                <FolderTreeView
                  node={child} depth={depth + 1} isAdmin={isAdmin} onDelete={onDelete}
                  expandedPaths={expandedPaths} togglePath={togglePath}
                />
              </div>
            )}
          </div>
        );
      })}
      {node.materials.map(m => (
        <MaterialCard key={m.id} material={m} isAdmin={isAdmin} onDelete={onDelete} />
      ))}
    </div>
  );
}

export function MateriPage({ user, isAdmin }: { user: User; isAdmin: boolean }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ materi_name: '', file_url: '', folder_path: '', content_text: '' });
  const [uploading, setUploading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'folder' | 'list'>('folder');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('lc_materials').select('*').order('folder_path', { ascending: true }).order('materi_name', { ascending: true });
    setMaterials(data ?? []);
    // No auto-expand — folders start collapsed
  }, []);
  useEffect(() => { load(); }, [load]);

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.materi_name.trim()) return alert('Nama materi wajib diisi!');
    setUploading(true);
    const { error } = await supabase.from('lc_materials').insert([{
      materi_name: form.materi_name,
      content_text: form.content_text || null,
      file_url: form.file_url || null,
      folder_path: form.folder_path.trim() || null,
      file_name: null, file_type: null, created_by: user.id,
    }]);
    setUploading(false);
    if (error) return alert('Gagal menyimpan: ' + error.message);
    setShowForm(false);
    setForm({ materi_name: '', file_url: '', folder_path: '', content_text: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus materi ini?')) return;
    await supabase.from('lc_materials').delete().eq('id', id);
    load();
  };

  // Filter materials by search
  const filtered = search
    ? materials.filter(m =>
        m.materi_name.toLowerCase().includes(search.toLowerCase()) ||
        (m.folder_path ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : materials;

  const tree = buildFolderTree(filtered);
  const rootHasFolders = Object.keys(tree.children).length > 0;

  return (
    <div>
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/30 sticky top-0 z-10"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}>
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
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-2">
              <span>+</span> Tambah Materi
            </button>
          )}
        </div>
      </div>
      <div className="p-8">
        {isAdmin && showForm && (
          <div className="rounded-2xl border border-blue-100 shadow-lg p-6 mb-8" style={{ background: '#ffffff' }}>
            <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">✏️ Form Materi Baru</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Nama Materi *</label>
                  <input value={form.materi_name} onChange={e => setForm(p => ({ ...p, materi_name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="contoh: Pengenalan Produk Microvision" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                    Folder Path <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case tracking-normal">(opsional)</span>
                  </label>
                  <input value={form.folder_path} onChange={e => setForm(p => ({ ...p, folder_path: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="contoh: Produk/Microvision" />
                </div>
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
                  rows={4} placeholder="Paste ringkasan atau poin-poin materi..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" />
                <p className="text-xs text-slate-400 mt-1">{form.content_text.length} karakter</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={uploading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow transition-all disabled:opacity-60">
                  {uploading ? '💾 Menyimpan...' : '💾 Simpan Materi'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all">
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {!isAdmin && (
          <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-3 flex items-center gap-3">
            <span className="text-lg">ℹ️</span>
            <p className="text-sm text-indigo-700">Klik tombol <strong>Buka</strong> untuk mengakses file materi di OneDrive.</p>
          </div>
        )}

        {filtered.length === 0 && !showForm && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">{search ? '🔍' : '📭'}</div>
            <p className="font-semibold">{search ? 'Tidak ada materi yang cocok' : 'Belum ada materi'}</p>
            {isAdmin && !search && <p className="text-sm mt-1">Klik + Tambah Materi untuk mulai</p>}
          </div>
        )}

        {filtered.length > 0 && (
          <>
            {viewMode === 'folder' ? (
              <div>
                {tree.materials.length > 0 && (
                  <div className="mb-4">
                    {rootHasFolders && (
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">📄 Tanpa Folder</p>
                    )}
                    {tree.materials.map(m => (
                      <MaterialCard key={m.id} material={m} isAdmin={isAdmin} onDelete={isAdmin ? handleDelete : undefined} />
                    ))}
                  </div>
                )}
                <FolderTreeView
                  node={tree} isAdmin={isAdmin}
                  onDelete={isAdmin ? handleDelete : undefined}
                  expandedPaths={expandedPaths} togglePath={togglePath}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(m => (
                  <MaterialCard key={m.id} material={m} isAdmin={isAdmin} onDelete={isAdmin ? handleDelete : undefined} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
