'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, User, Material, buildFolderTree, countMaterials, SearchInput, AppDialog, DialogState } from './shared';
import { logAudit } from '@/lib/audit';
import { ModalPortal } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { MaterialCard, FolderTreeView } from './KartuMateri';
import { ModalEditMateri } from './ModalEditMateri';

const FOLDER_COLORS = [
  { gradient: 'linear-gradient(135deg,#3b82f6,#4f46e5)', light: '#dbeafe', icon: '#3b82f6' },
  { gradient: 'linear-gradient(135deg,#10b981,#0d9488)', light: '#d1fae5', icon: '#10b981' },
  { gradient: 'linear-gradient(135deg,#8b5cf6,#9333ea)', light: '#ede9fe', icon: '#8b5cf6' },
  { gradient: 'linear-gradient(135deg,#f59e0b,#f97316)', light: '#fef3c7', icon: '#f59e0b' },
  { gradient: 'linear-gradient(135deg,#f43f5e,#db2777)', light: '#ffe4e6', icon: '#f43f5e' },
  { gradient: 'linear-gradient(135deg,#06b6d4,#0284c7)', light: '#cffafe', icon: '#06b6d4' },
];
const getFolderColor = (name: string) => FOLDER_COLORS[name.charCodeAt(0) % FOLDER_COLORS.length];

export function MateriPage({ user, isAdmin, readOnly = false }: { user: User; isAdmin: boolean; readOnly?: boolean }) {
  const tulis = isAdmin && !readOnly;
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

  const [selectedFolderKey, setSelectedFolderKey] = useState<string | null>(null);
  const [rightExpandedPaths, setRightExpandedPaths] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data } = await supabase.from('lc_materials').select('*').order('folder_path', { ascending: true }).order('materi_name', { ascending: true });
    setMaterials(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

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
        const { error: qErr } = await supabase.from('lc_questions').delete().eq('material_id', id);
        if (qErr) { setDialog({ type: 'error', title: 'Gagal Hapus', message: 'Gagal hapus soal terkait: ' + qErr.message }); return; }
        const { error } = await supabase.from('lc_materials').delete().eq('id', id);
        if (error) { setDialog({ type: 'error', title: 'Gagal Hapus', message: 'Gagal hapus materi: ' + error.message }); return; }
        void logAudit({ user_id: user.id, user_name: user.full_name ?? '', action: 'delete', module: 'learning-center', target_id: id, notes: 'Hapus materi' });
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
        if (ids.length > 0) {
          const { error: qErr } = await supabase.from('lc_questions').delete().in('material_id', ids);
          if (qErr) { setDialog({ type: 'error', title: 'Gagal Hapus', message: 'Gagal hapus soal terkait: ' + qErr.message }); return; }
        }
        const results = await Promise.all(affected.map(m => supabase.from('lc_materials').delete().eq('id', m.id).select('id')));
        const err = results.find((r: { error: unknown }) => r.error)?.error as { message: string } | undefined;
        if (err) { setDialog({ type: 'error', title: 'Gagal Hapus Folder', message: 'Gagal hapus materi: ' + err.message }); return; }
        const gagalTerhapus = results.filter((r: { error: unknown; data: unknown[] | null }) => !r.error && (!r.data || r.data.length === 0)).length;
        if (gagalTerhapus > 0) {
          setDialog({ type: 'error', title: 'Gagal Hapus Folder', message: `${gagalTerhapus} dari ${affected.length} materi tidak punya akses untuk dihapus.` });
          return;
        }
        void logAudit({ user_id: user.id, user_name: user.full_name ?? '', action: 'delete', module: 'learning-center', notes: `Hapus folder "${folderName}" (${affected.length} materi)` });
        if (selectedFolderKey === folderName) setSelectedFolderKey(null);
        load();
      },
    });
  };

  const handleEditMaterial = async () => {
    if (!editMaterial) return;
    setEditMaterialSaving(true);
    const { data, error } = await supabase.from('lc_materials').update({
      materi_name: editMaterial.materi_name.trim(),
      file_url: editMaterial.file_url?.trim() || null,
      folder_path: editMaterial.folder_path?.trim() || null,
    }).eq('id', editMaterial.id).select('id');
    setEditMaterialSaving(false);
    if (error || !data || data.length === 0) {
      setDialog({ type: 'error', message: 'Gagal menyimpan perubahan materi.' });
      return;
    }
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

  const selectedFolderNode = selectedFolderKey ? (tree.children[selectedFolderKey] ?? null) : null;

  const panelCol = selectedFolderKey ? getFolderColor(selectedFolderKey) : null;
  const panelOpen = !!(selectedFolderNode && panelCol);

  return (
    <div className="flex flex-col overflow-hidden tinggi-materi-lc">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex-shrink-0"
        style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight leading-tight"><IkonTeks nama="📚" />Materi Training</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin ? 'Kelola & organisir materi training team' : 'Materi training tersedia untuk dipelajari'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari materi..." />
          <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
            <button onClick={() => setViewMode('folder')}
              className={`px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'folder' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <IkonTeks nama="📁" />Folder
            </button>
            <button onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <IkonTeks nama="📋" />List
            </button>
          </div>
          {tulis && (
            <button onClick={() => openForm()}
              className="tombol-utama flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold  rounded-kontrol shadow-md hover:scale-[1.03] transition-all whitespace-nowrap">
              <span className="text-base leading-none">+</span> Tambah Materi
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-5 px-4 sm:px-6 py-2 border-b border-slate-100 text-xs flex-shrink-0 flex-wrap"
        style={{ background: 'rgba(248,250,252,0.8)' }}>
        <span className="text-slate-500"><Ikon nama="📦" ukuran="1em" className="inline-block align-[-0.12em]" /> <strong className="text-slate-700">{materials.length}</strong> materi</span>
        <span className="text-slate-400">|</span>
        <span className="text-slate-500"><Ikon nama="📁" ukuran="1em" className="inline-block align-[-0.12em]" /> <strong className="text-slate-700">{rootFolderKeys.length}</strong> folder</span>
        {panelOpen && panelCol && (
          <>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">Folder: <strong style={{ color: panelCol.icon }}>{selectedFolderNode!.name}</strong></span>
          </>
        )}
      </div>

      <div className="flex-1 relative overflow-hidden">

        <div className={`h-full overflow-y-auto transition-[padding] duration-300 ${panelOpen ? 'sm:pr-[calc(42%+1px)]' : ''}`}>
          <div className="p-4 sm:p-6">

            {!isAdmin && (
              <div className="mb-5 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-3 flex items-center gap-3">
                <span className="text-lg"><Ikon nama="ℹ" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <p className="text-sm text-indigo-700">Klik tombol <strong>Buka</strong> untuk mengakses file materi di OneDrive.</p>
              </div>
            )}

            {filtered.length === 0 && (
              <div className="flex justify-center py-16">
                <div className="text-center px-10 py-8 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
                  <div className="text-5xl mb-3">{search ? '🔍' : '📭'}</div>
                  <p className="font-semibold text-slate-700">{search ? 'Tidak ada materi yang cocok' : 'Belum ada materi'}</p>
                  {tulis && !search && <p className="text-sm mt-1 text-slate-500">Klik + Tambah Materi untuk mulai</p>}
                </div>
              </div>
            )}

            {filtered.length > 0 && (
              <>
                {viewMode === 'folder' && (
                  <>
                    {tree.materials.length > 0 && (
                      <div className="mb-5">
                        {tree.materials.map(m => (
                          <MaterialCard key={m.id} material={m} isAdmin={tulis}
                            onDelete={tulis ? handleDelete : undefined}
                            onEdit={tulis ? setEditMaterial : undefined} />
                        ))}
                      </div>
                    )}

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
                                    <svg aria-hidden="true" focusable="false" width="22" height="22" viewBox="0 0 24 24" fill="none">
                                      <path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z"
                                        fill={isSelected ? '#FCD34D' : col.light === '#fef3c7' ? '#FBBF24' : col.icon + '88'}
                                        stroke={isSelected ? '#D97706' : col.icon} strokeWidth="0.9" />
                                    </svg>
                                  </div>
                                  <p className="text-sm font-bold text-slate-800 leading-snug mb-1.5 line-clamp-2 pr-6">{child.name}</p>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-slate-500">{totalInside} materi</span>
                                    <div className="flex items-center gap-1">
                                      {tulis && (
                                        <button
                                          onClick={e => { e.stopPropagation(); openForm(child.path); }}
                                          className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs border transition-all opacity-0 group-hover:opacity-100"
                                          style={{ background: col.light, border: `1px solid ${col.icon}44`, color: col.icon }}
                                          title={`Tambah ke "${child.name}"`}>+</button>
                                      )}
                                      <svg aria-hidden="true" focusable="false" className={`w-3 h-3 transition-all ${isSelected ? 'rotate-90' : 'text-slate-400'}`}
                                        style={isSelected ? { color: col.icon } : {}}
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                  </div>
                                </button>
                                {tulis && (
                                  <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button aria-label="Ubah nama folder"
                                      onClick={e => { e.stopPropagation(); setRenameFolder({ oldName: key, newName: key }); }}
                                      className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-blue-100 bg-white/80 border border-slate-200 hover:border-blue-300"
                                      title="Ubah nama folder">
                                      <svg aria-hidden="true" focusable="false" width="11" height="11" fill="none" stroke="#3b82f6" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button aria-label="Hapus folder"
                                      onClick={e => { e.stopPropagation(); handleDeleteFolder(key); }}
                                      className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-rose-100 bg-white/80 border border-slate-200 hover:border-rose-300"
                                      title="Hapus folder">
                                      <svg aria-hidden="true" focusable="false" width="11" height="11" fill="none" stroke="#be123c" viewBox="0 0 24 24">
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

                {viewMode === 'list' && (
                  <div className="space-y-1.5">
                    {filtered.map(m => {
                      const rootKey = m.folder_path ? m.folder_path.split('/')[0] : null;
                      const col = rootKey ? getFolderColor(rootKey) : null;
                      return (
                        <MaterialCard key={m.id} material={m} isAdmin={tulis}
                          onDelete={tulis ? handleDelete : undefined}
                          onEdit={tulis ? setEditMaterial : undefined}
                          colorHex={col?.icon} />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div
          className="absolute top-0 right-0 bottom-0 flex flex-col w-full sm:w-[42%] bg-white/95 sm:bg-white/60"
          style={{
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
              <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${panelCol.light}cc, rgba(255,255,255,0.55))`,
                  borderBottom: `1px solid ${panelCol.icon}22`,
                }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0"
                  style={{ background: panelCol.gradient }}>
                  <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none">
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
                {tulis && (
                  <>
                    <button aria-label="Ubah nama folder" onClick={() => setRenameFolder({ oldName: selectedFolderNode.name, newName: selectedFolderNode.name })}
                      className="w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all hover:scale-110"
                      style={{ background: panelCol.icon + '18', borderColor: panelCol.icon + '44' }}
                      title="Ubah nama folder">
                      <svg aria-hidden="true" focusable="false" width="14" height="14" fill="none" stroke={panelCol.icon} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => openForm(selectedFolderNode.path)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm border-2 transition-all hover:scale-110"
                      style={{ background: panelCol.icon + '18', borderColor: panelCol.icon + '44', color: panelCol.icon }}
                      title="Tambah materi ke folder ini">+</button>
                  </>
                )}
                <button aria-label="Tutup" onClick={() => setSelectedFolderKey(null)}
                  className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg border border-slate-200 transition-all flex-shrink-0">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-4" style={{ background: 'transparent' }}>
                <FolderTreeView
                  node={selectedFolderNode}
                  depth={0}
                  isAdmin={tulis}
                  onDelete={tulis ? handleDelete : undefined}
                  onEdit={tulis ? setEditMaterial : undefined}
                  expandedPaths={rightExpandedPaths}
                  togglePath={toggleRightPath}
                  onAddToFolder={tulis ? openForm : undefined}
                  gridCols={2}
                  colorHex={panelCol.icon}
                />
              </div>
            </>
          ) : null}
        </div>

      </div>

      {tulis && showForm && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-kartu shadow-modal w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><IkonTeks nama="✏" />Tambah Materi Baru</h3>
              <button aria-label="Tutup" onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all text-xl font-light">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="f-learning-center-components-materipage-1" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Nama Materi *</label>
                <input id="f-learning-center-components-materipage-1" value={form.materi_name} onChange={e => setForm(p => ({ ...p, materi_name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="contoh: Pengenalan Produk Microvision" autoFocus />
              </div>
              <div>
                <label htmlFor="f-learning-center-components-materipage-2" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Folder Path <span className="ml-1 text-[11px] font-normal text-slate-500 normal-case tracking-normal">(opsional)</span>
                </label>
                <input id="f-learning-center-components-materipage-2"
                  value={form.folder_path}
                  onChange={e => setForm(p => ({ ...p, folder_path: e.target.value }))}
                  list="folder-path-suggestions"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="contoh: Produk/Microvision" />
                <datalist id="folder-path-suggestions">
                  {existingPaths.map(p => <option key={p} value={p} />)}
                </datalist>
                {form.folder_path && (
                  <p className="text-xs text-slate-500 mt-1">Akan disimpan di: <strong className="text-slate-600">{form.folder_path}</strong></p>
                )}
              </div>
              <div>
                <label htmlFor="f-learning-center-components-materipage-3" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Link OneDrive <span className="ml-1 text-[11px] font-normal text-slate-500 normal-case tracking-normal">(opsional)</span>
                </label>
                <input id="f-learning-center-components-materipage-3" value={form.file_url} onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="https://1drv.ms/b/s!..." />
              </div>
              <div>
                <label htmlFor="f-learning-center-components-materipage-4" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Konten Teks untuk AI <span className="ml-1 text-[11px] font-normal text-slate-500 normal-case tracking-normal">(opsional)</span>
                </label>
                <textarea id="f-learning-center-components-materipage-4" value={form.content_text} onChange={e => setForm(p => ({ ...p, content_text: e.target.value }))}
                  rows={3} placeholder="Paste ringkasan atau poin-poin materi..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none" />
                <p className="text-xs text-slate-500 mt-1">{form.content_text.length} karakter</p>
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
      </ModalPortal>
      )}

      {tulis && renameFolder && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-kartu shadow-modal w-full max-w-sm border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><IkonTeks nama="✏" />Ubah Nama Folder</h3>
              <button aria-label="Tutup" onClick={() => setRenameFolder(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all text-xl font-light">×</button>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-500 mb-4">Semua materi dalam folder ini akan diperbarui secara otomatis.</p>
              <label htmlFor="f-learning-center-components-materipage-5" className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">Nama Folder Baru</label>
              <input id="f-learning-center-components-materipage-5"
                value={renameFolder.newName}
                onChange={e => setRenameFolder(p => p && ({ ...p, newName: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(); if (e.key === 'Escape') setRenameFolder(null); }}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-1"
                autoFocus
                placeholder="Nama folder baru..."
              />
              <p className="text-xs text-slate-500 mb-4">Sebelumnya: <strong className="text-slate-600">{renameFolder.oldName}</strong></p>
              <div className="flex gap-3">
                <button onClick={handleRenameFolder} disabled={renameFolderSaving}
                  className="tombol-utama flex-1 py-2.5  text-sm font-bold rounded-kontrol disabled:opacity-60 transition-all hover:opacity-90">
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
      </ModalPortal>
      )}

      {tulis && editMaterial && (
        <ModalEditMateri editMaterial={editMaterial} setEditMaterial={setEditMaterial} existingPaths={existingPaths}
          editMaterialSaving={editMaterialSaving} handleEditMaterial={handleEditMaterial} />
      )}

      {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
