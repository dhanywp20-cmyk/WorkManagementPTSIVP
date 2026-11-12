'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, User, Material, buildFolderTree, DialogState } from './shared';
import { logAudit } from '@/lib/audit';
import { getFolderColor } from './MateriPage';

export interface MateriPageKonteks {
  isAdmin: boolean;
  readOnly: boolean;
  user: User;
}

export function useMateriPage(k: MateriPageKonteks) {
  const { isAdmin, readOnly, user } = k;
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
  return {
    search, setSearch, setViewMode, viewMode, tulis, openForm, materials, rootFolderKeys,
    panelOpen, panelCol, selectedFolderNode, filtered, tree, handleDelete, setEditMaterial, rootHasFolders,
    selectedFolderKey, setSelectedFolderKey, setRightExpandedPaths, setRenameFolder, handleDeleteFolder, rightExpandedPaths, toggleRightPath, showForm,
    setShowForm, form, setForm, existingPaths, handleSave, uploading, renameFolder, handleRenameFolder,
    renameFolderSaving, editMaterial, editMaterialSaving, handleEditMaterial, dialog, setDialog,
  };
}
