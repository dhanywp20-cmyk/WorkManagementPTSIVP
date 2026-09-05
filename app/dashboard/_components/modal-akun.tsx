'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { adminCreateUser, adminUpdateUser, adminSetAccessLevel } from '@/lib/admin-users';
import { logAudit } from '@/lib/audit';

import { createNotification } from '@/lib/notifications';

import { User, JABATAN_LIST, JABATAN_CONFIG, ALL_MENU_KEYS, DEFAULT_MENU_KEYS } from './shared';
import { useDivisiSales } from '@/lib/merek';
import { useKelompokPTS, labelKelompokPTS, teamTypeDariLabelPTS } from '@/lib/kelompok';
import { ConfirmDialog, type ConfirmState, Username, ModalPortal } from '@/components/shared';

import { propagateUserRename, pesanSebar, sendWelcomeWA } from './modal-bersama';

/**
 * Minor (docs/UX-WORKFLOW-AUDIT.md): kolom Role dulu menampilkan enum
 * mentah dari database (guest/team/admin/superadmin) - kontras dengan
 * KpiRosterInline yang sudah pakai label ramah. Platform ini dijual ke
 * perusahaan lain, jadi kesan "dibuat developer untuk developer" ini
 * kecil tapi sebaiknya tidak ada.
 */
const LABEL_ROLE: Record<string, string> = {
  superadmin: 'Superadmin', admin: 'Admin', team: 'Team', guest: 'Guest',
};
function labelRole(role: string): string {
  return LABEL_ROLE[role] ?? role;
}

interface AccountSettingsModalProps {
  onClose: () => void;
}

export function AccountSettingsModal({ onClose }: AccountSettingsModalProps) {
  const daftarDivisi = useDivisiSales();
  const kelompokPTSList = useKelompokPTS();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editOrig, setEditOrig] = useState<{ username: string; full_name: string } | null>(null);
  const [editDivisi, setEditDivisi] = useState('');
  const [editPtsType, setEditPtsType] = useState('');
  const [editPtsDaerah, setEditPtsDaerah] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'guest',
    team_type: '',
    phone_number: '',
    sales_division: '',
    jabatan: '',
    allowed_menus: DEFAULT_MENU_KEYS,
    divisi: '',
    pts_type: '',
    pts_daerah: '',
  });
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const menuLabels: Record<string, { label: string; icon: string; gradient: string }> = {
    'dashboard': { label: 'Analytics Dashboard (KPI)', icon: '📊', gradient: 'from-blue-600 to-indigo-500' },
    'learning-center': { label: 'Learning Center', icon: '🎓', gradient: 'from-teal-600 to-teal-500' },
    'form-bast': { label: 'Form Review Demo & BAST', icon: '⭐', gradient: 'from-slate-600 to-slate-500' },
    'request-design-project': { label: 'Request Design Project', icon: '🏗️', gradient: 'from-violet-600 to-violet-500' },
    'ticket-troubleshooting': { label: 'Ticket Troubleshooting', icon: '🎫', gradient: 'from-rose-600 to-rose-500' },
    'incentive-pts': { label: 'Incentive Team PTS IVP', icon: '💰', gradient: 'from-rose-600 to-rose-500' },
    'project-progress': { label: 'Project Progress', icon: '📊', gradient: 'from-cyan-600 to-teal-500' },
    'daily-report': { label: 'Daily Report', icon: '📈', gradient: 'from-emerald-600 to-emerald-500' },
    'database-pts': { label: 'Database PTS', icon: '💼', gradient: 'from-indigo-600 to-indigo-500' },
    'unit-movement': { label: 'Unit Movement Log', icon: '🚚', gradient: 'from-amber-600 to-amber-500' },
    'reminder-schedule': { label: 'Request Schedule', icon: '🗓️', gradient: 'from-cyan-600 to-cyan-500' },
    'picket-showroom': { label: 'Piket Showroom', icon: '🏪', gradient: 'from-teal-600 to-teal-500' },
    'tech-note': { label: 'Tech Note R&D', icon: '📝', gradient: 'from-pink-600 to-rose-500' },
    'kpi-team': { label: 'KPI Team', icon: '📊', gradient: 'from-sky-600 to-sky-500' },
  };

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase.from('users').select('id,username,full_name,role,team_type,sales_division,jabatan,phone_number,allowed_menus,kpi_enabled,pts_daerah').order('full_name');
    if (error) {
      const { data: fallback } = await supabase.from('users').select('id,username,full_name,role,team_type,sales_division,jabatan,phone_number,allowed_menus').order('full_name');
      if (fallback) setUsers(fallback);
      else notify('error', `Gagal memuat akun: ${error.message}`);
    } else if (data) {
      setUsers(data);
    }
    setLoadingUsers(false);
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.full_name) {
      notify('error', 'Semua field wajib diisi!'); return;
    }
    if (!newUser.divisi) {
      notify('error', 'Divisi wajib dipilih!'); return;
    }
    if (newUser.divisi === 'PTS' && !newUser.pts_type) {
      notify('error', 'Tipe PTS wajib dipilih!'); return;
    }
    if ((newUser.divisi === 'Sales' || newUser.divisi === 'Marketing') && !newUser.sales_division) {
      notify('error', `${newUser.divisi} Division wajib dipilih!`); return;
    }
    const isCabangBaru = kelompokPTSList.find(k => k.label === newUser.pts_type)?.cabang === true;
    if (newUser.divisi === 'PTS' && isCabangBaru && !newUser.pts_daerah.trim()) {
      notify('error', 'Alamat Daerah wajib diisi untuk PTS Cabang!'); return;
    }

    let role = 'guest';
    let team_type: string | null = null;
    if (newUser.divisi === 'PTS') {
      role = 'team';
      team_type = teamTypeDariLabelPTS(newUser.pts_type);
    } else if (newUser.divisi === 'Sales') {
      role = 'guest';
      team_type = 'Guest';
    } else if (newUser.divisi === 'Marketing') {
      role = 'guest';
      team_type = 'Marketing';
    }

    setSaving(true);
    // Marketing & Sales divisi IVP/MVI = "Sales Internal" utk routing pipeline -
    // request mereka sendiri (project direct ke user) tidak boleh kena gerbang
    // review internal. Auto-set di sini supaya admin tidak perlu toggle manual.
    const isInternalSales = newUser.divisi === 'Marketing' || (newUser.divisi === 'Sales' && ['IVP', 'MVI', 'MLDS'].includes(newUser.sales_division));
    const insertPayload: Record<string, unknown> = {
      username: newUser.username,
      full_name: newUser.full_name,
      role,
      team_type,
      allowed_menus: newUser.allowed_menus,
      jabatan: newUser.jabatan || null,
      phone_number: newUser.phone_number || null,
      sales_division: (newUser.divisi === 'Sales' || newUser.divisi === 'Marketing') ? (newUser.sales_division || null) : null,
      is_internal_sales: isInternalSales,
      pts_daerah: isCabangBaru ? newUser.pts_daerah.trim() : null,
    };
    const { id: newId, error } = await adminCreateUser(insertPayload);
    // Password disimpan ke user_credentials via server route (yang dibaca login),
    // bukan kolom legacy users.password.
    if (!error && newId && newUser.password) {
      const credRes = await fetch('/api/auth/set-credential', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: newId, password: newUser.password }),
      });
      if (!credRes.ok) { const j = await credRes.json().catch(() => ({})); setSaving(false); notify('error', 'Akun dibuat tapi gagal set password: ' + (j.error || '')); return; }
    }
    setSaving(false);
    if (error) { notify('error', 'Gagal menambah akun: ' + error.message); return; }
    notify('success', 'Akun berhasil ditambahkan!');
    sendWelcomeWA(newUser.phone_number, newUser.full_name, newUser.username, newUser.password);
    const admin = getSession<User>(); void logAudit({ user_id: admin?.id ?? '', user_name: admin?.full_name ?? '', action: 'create', module: 'user', target_name: newUser.full_name, notes: `Tambah akun: ${newUser.username}` });
    setNewUser({ username: '', password: '', full_name: '', role: 'guest', team_type: '', phone_number: '', sales_division: '', jabatan: '', allowed_menus: DEFAULT_MENU_KEYS, divisi: '', pts_type: '', pts_daerah: '' });
    setActiveTab('list');
    fetchUsers();
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    const isCabangEdit = editDivisi === 'PTS' && kelompokPTSList.find(k => k.label === editPtsType)?.cabang === true;
    if (isCabangEdit && !editPtsDaerah.trim()) {
      notify('error', 'Alamat Daerah wajib diisi untuk PTS Cabang!'); return;
    }
    setSaving(true);

    let role = editingUser.role;
    let team_type: string | null = editingUser.team_type ?? null;

    if (editDivisi) {
      if (editDivisi === 'PTS') {
        role = 'team';
        team_type = teamTypeDariLabelPTS(editPtsType);
      } else if (editDivisi === 'Sales') {
        role = 'guest';
        team_type = 'Guest';
      } else if (editDivisi === 'Marketing') {
        role = 'guest';
        team_type = 'Marketing';
      }
    }

    const updatePayload: Record<string, unknown> = {
      username: editingUser.username,
      full_name: editingUser.full_name,
      role,
      team_type,
      allowed_menus: editingUser.allowed_menus ?? ALL_MENU_KEYS,
      jabatan: editingUser.jabatan ?? null,
      phone_number: editingUser.phone_number ?? null,
      sales_division: (editDivisi === 'Sales' || editDivisi === 'Marketing') ? (editingUser.sales_division ?? null) : null,
      // Ikut update is_internal_sales HANYA kalau admin ganti divisi (editDivisi
      // terisi) - kalau cuma edit field lain, jangan sentuh nilai yang sudah ada.
      ...(editDivisi ? { is_internal_sales: editDivisi === 'Marketing' || (editDivisi === 'Sales' && ['IVP', 'MVI', 'MLDS'].includes(editingUser.sales_division ?? '')) } : {}),
      // pts_daerah cuma disentuh kalau admin memang sedang menyunting divisi PTS -
      // kalau bukan, jangan timpa nilai yang sudah ada (mis. sekadar ganti No. Telepon).
      ...(editDivisi === 'PTS' ? { pts_daerah: isCabangEdit ? editPtsDaerah.trim() : null } : {}),
    };
    // Password baru harus masuk ke user_credentials - itu satu-satunya tempat
    // yang dibaca login. Kolom lama users.password tidak dibaca siapa pun, jadi
    // menulis ke sana membuat reset password tampak berhasil tanpa berlaku.
    if (editingUser.password) {
      const pwdRes = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: editingUser.id, newPassword: editingUser.password }),
      });
      if (!pwdRes.ok) {
        const j = await pwdRes.json().catch(() => ({}));
        setSaving(false);
        notify('error', 'Gagal mengubah password: ' + (j.error || 'permintaan ditolak'));
        return;
      }
    }
    const { error } = await adminUpdateUser(editingUser.id, updatePayload);
    if (error) { setSaving(false); notify('error', 'Gagal menyimpan: ' + error.message); return; }
    const sebar = await propagateUserRename(editingUser, editOrig);
    setSaving(false);
    notify(sebar.taraf === 'ok' ? 'success' : 'error', pesanSebar(sebar));
    const admin = getSession<User>(); void logAudit({ user_id: admin?.id ?? '', user_name: admin?.full_name ?? '', action: 'update', module: 'user', target_id: editingUser.id, target_name: editingUser.full_name });
    setEditingUser(null);
    setEditDivisi('');
    setEditPtsType('');
    fetchUsers();
  };

  const handleDeleteUser = (userId: string, name: string) => {
    setConfirmState({ message: `Hapus akun "${name}"?`, description: 'Tindakan ini tidak bisa dibatalkan.', danger: true, confirmLabel: 'Hapus', onConfirm: async () => {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) { notify('error', 'Gagal menghapus akun.'); return; }
      notify('success', 'Akun dihapus.');
      const admin = getSession<User>(); void logAudit({ user_id: admin?.id ?? '', user_name: admin?.full_name ?? '', action: 'delete', module: 'user', target_id: userId });
      fetchUsers();
    }});
  };

  function MenuPermissionSelector({ selected, target }: { selected: string[]; target: 'new' | 'edit' }) {
    const toggle = (key: string) => {
      if (target === 'new') {
        setNewUser(u => ({ ...u, allowed_menus: u.allowed_menus.includes(key) ? u.allowed_menus.filter(k => k !== key) : [...u.allowed_menus, key] }));
      } else if (editingUser) {
        const cur = editingUser.allowed_menus ?? ALL_MENU_KEYS;
        setEditingUser({ ...editingUser, allowed_menus: cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key] });
      }
    };
    return (
      <div>
        <label className="block text-xs font-bold mb-2 text-slate-600 tracking-widest uppercase">Menu Access</label>
        <div className="grid grid-cols-1 gap-1.5">
          {ALL_MENU_KEYS.map(key => {
            const m = menuLabels[key];
            if (!m) return null;
            const checked = selected.includes(key);
            return (
              <button key={key} type="button" onClick={() => toggle(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left ${checked ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'}`}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'border-rose-500 bg-rose-500' : 'border-slate-300 bg-white'}`}>
                  {checked && <svg aria-hidden="true" focusable="false" className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="text-lg">{m.icon}</span>
                <span className="font-semibold text-sm">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(u =>
    !searchQuery ||
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.sales_division?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.team_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-full flex flex-col overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 py-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Account Settings</h2>
              <p className="text-white/60 text-xs">Kelola akun & hak akses menu</p>
            </div>
          </div>
          <button aria-label="Tutup" onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-all">
            <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {notification && (
          <div className={`mx-6 mt-4 px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {notification.type === 'success' ? '✅' : '❌'} {notification.msg}
          </div>
        )}

        <div className="flex border-b border-slate-200 px-6 pt-4 flex-shrink-0">
          {(['list', 'add'] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setEditingUser(null); setEditDivisi(''); setEditPtsType(''); setEditPtsDaerah(''); }}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-all mr-1 ${activeTab === tab ? 'border-rose-500 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab === 'list' ? `👥 Daftar Akun (${users.length})` : '➕ Tambah Akun'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'list' && (
            <>
              <div className="relative mb-4">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                <input aria-label="Cari nama, username, atau role..." type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama, username, atau role..."
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all" />
              </div>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-rose-600 border-rose-200 animate-spin" /></div>
              ) : (
                <>
                  {editingUser ? (
                    <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-slate-800">✏️ Edit: {editingUser.full_name}</h3>
                        <button aria-label="Tutup" onClick={() => { setEditingUser(null); setEditDivisi(''); setEditPtsType(''); setEditPtsDaerah(''); }} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Full Name</label>
                          <input value={editingUser.full_name} onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Username</label>
                          <input value={editingUser.username} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Password Baru</label>
                          <input type="password" value={editingUser.password ?? ''} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} placeholder="Kosongkan jika tidak diubah" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Role</label>
                          <select value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                            <option value="superadmin">Superadmin</option>
                            <option value="admin">Admin</option>
                            <option value="team">Team</option>
                            <option value="guest">Guest</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Divisi</label>
                          <select aria-label="-- Pilih Divisi --" value={editDivisi} onChange={e => { setEditDivisi(e.target.value); setEditPtsType(''); }}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                            <option value="">-- Pilih Divisi --</option>
                            <option value="PTS">PTS</option>
                            <option value="Sales">Sales</option>
                            <option value="Marketing">Marketing</option>
                          </select>
                        </div>
                        {editDivisi === 'PTS' && (
                          <div className="col-span-2">
                            <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Tipe PTS</label>
                            <select aria-label="-- Pilih Tipe PTS --" value={editPtsType} onChange={e => setEditPtsType(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                              <option value="">-- Pilih Tipe PTS --</option>
                              {kelompokPTSList.map(k => <option key={k.nama} value={k.label}>{k.label} → {k.nama}</option>)}
                            </select>
                          </div>
                        )}
                        {editDivisi === 'PTS' && kelompokPTSList.find(k => k.label === editPtsType)?.cabang && (
                          <div className="col-span-2">
                            <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Alamat Daerah *</label>
                            <input value={editPtsDaerah} onChange={e => setEditPtsDaerah(e.target.value)}
                              placeholder="Contoh: Surabaya, Bandung, Medan..."
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
                            <p className="text-[10px] text-slate-400 mt-1">Otomatis mengisi Daerah/Kota saat dipilih di dropdown PTS Cabang, Reminder Schedule.</p>
                          </div>
                        )}
                        {(editDivisi === 'Sales' || editDivisi === 'Marketing') && (
                          <div className="col-span-2">
                            <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">
                              {editDivisi === 'Marketing' ? 'Marketing Division' : 'Sales Division'}
                            </label>
                            <select aria-label="-- Pilih {editDivisi} Division --" value={editingUser.sales_division || ''} onChange={e => setEditingUser({ ...editingUser, sales_division: e.target.value })}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                              <option value="">-- Pilih {editDivisi} Division --</option>
                              {daftarDivisi.map(div => <option key={div} value={div}>{div}</option>)}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Jabatan / Posisi</label>
                          <select aria-label="— Pilih Jabatan —" value={editingUser.jabatan || ''} onChange={e => setEditingUser({ ...editingUser, jabatan: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                            <option value="">— Pilih Jabatan —</option>
                            {JABATAN_LIST.map(j => <option key={j} value={j}>{JABATAN_CONFIG[j].icon} {j}</option>)}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Nomor Telepon / WhatsApp</label>
                          <input value={editingUser.phone_number || ''} onChange={e => setEditingUser({ ...editingUser, phone_number: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" placeholder="Contoh: 08123456789" />
                        </div>
                      </div>
                      <MenuPermissionSelector selected={editingUser.allowed_menus ?? ALL_MENU_KEYS} target="edit" />
                      <div className="flex gap-3 pt-2">
                        <button onClick={handleSaveEdit} disabled={saving} className="flex-1 bg-gradient-to-r from-rose-600 to-rose-700 text-white py-2.5 rounded-lg font-semibold hover:from-rose-700 hover:to-rose-800 transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                          {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                          💾 Simpan Perubahan
                        </button>
                        <button onClick={() => { setEditingUser(null); setEditDivisi(''); setEditPtsType(''); setEditPtsDaerah(''); }} className="px-6 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 text-sm transition-all">Batal</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.map(user => (
                        <div key={user.id} className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-all">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}>
                            {user.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">{user.full_name}</p>
                            <p className="text-xs text-slate-500"><Username value={user.username} /></p>
                            {user.phone_number && (
                              <p className="text-xs text-slate-400 mt-0.5">📞 {user.phone_number}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-slate-200 text-slate-600">{labelRole(user.role)}</span>
                              {user.jabatan && (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">🏷️ {user.jabatan}</span>
                              )}
                              {user.team_type && (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-rose-100 text-rose-600 border border-rose-200">👥 {user.team_type}</span>
                              )}
                              {user.sales_division && (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-violet-100 text-violet-600 border border-violet-200">🏢 {user.sales_division}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => {
                              let d = '', p = '';
                              if (user.role === 'team') {
                                d = 'PTS';
                                p = labelKelompokPTS(user.team_type ?? '');
                              } else if (user.team_type === 'Guest') { d = 'Sales'; }
                              else if (user.team_type === 'Marketing') { d = 'Marketing'; }
                              setEditDivisi(d);
                              setEditPtsType(p);
                              setEditPtsDaerah(user.pts_daerah ?? '');
                              setEditOrig({ username: user.username, full_name: user.full_name });
                              setEditingUser(user);
                            }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all">Edit</button>
                            <button onClick={() => handleDeleteUser(user.id, user.full_name)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all">Hapus</button>
                          </div>
                        </div>
                      ))}
                      {filteredUsers.length === 0 && (
                        <div className="text-center py-10 text-slate-400 text-sm">
                          <div className="text-3xl mb-2">🔍</div>
                          Tidak ada akun yang cocok
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'add' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 tracking-widest uppercase">Full Name *</label>
                  <input value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none" placeholder="Nama lengkap" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 tracking-widest uppercase">Username *</label>
                  <input value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none" placeholder="username" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 tracking-widest uppercase">Password *</label>
                  <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none" placeholder="Minimal 6 karakter" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold mb-1 text-slate-600 tracking-widest uppercase">Divisi *</label>
                  <select aria-label="-- Pilih Divisi --" value={newUser.divisi} onChange={e => setNewUser({ ...newUser, divisi: e.target.value, pts_type: '', pts_daerah: '', sales_division: '' })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none bg-white">
                    <option value="">-- Pilih Divisi --</option>
                    <option value="PTS">PTS</option>
                    <option value="Sales">Sales</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
                {newUser.divisi === 'PTS' && (
                  <div className="col-span-2">
                    <label className="block text-xs font-bold mb-1 text-slate-600 tracking-widest uppercase">Tipe PTS *</label>
                    <select aria-label="-- Pilih Tipe PTS --" value={newUser.pts_type} onChange={e => setNewUser({ ...newUser, pts_type: e.target.value, pts_daerah: '' })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none bg-white">
                      <option value="">-- Pilih Tipe PTS --</option>
                      {kelompokPTSList.map(k => <option key={k.nama} value={k.label}>{k.label} → {k.nama}</option>)}
                    </select>
                  </div>
                )}
                {newUser.divisi === 'PTS' && kelompokPTSList.find(k => k.label === newUser.pts_type)?.cabang && (
                  <div className="col-span-2">
                    <label className="block text-xs font-bold mb-1 text-slate-600 tracking-widest uppercase">Alamat Daerah *</label>
                    <input value={newUser.pts_daerah} onChange={e => setNewUser({ ...newUser, pts_daerah: e.target.value })}
                      placeholder="Contoh: Surabaya, Bandung, Medan..."
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none" />
                    <p className="text-[10px] text-slate-400 mt-1">Otomatis mengisi Daerah/Kota saat dipilih di dropdown PTS Cabang, Reminder Schedule.</p>
                  </div>
                )}
                {(newUser.divisi === 'Sales' || newUser.divisi === 'Marketing') && (
                  <div className="col-span-2">
                    <label className="block text-xs font-bold mb-1 text-slate-600 tracking-widest uppercase">
                      {newUser.divisi === 'Marketing' ? 'Marketing Division *' : 'Sales Division *'}
                    </label>
                    <select aria-label="-- Pilih {newUser.divisi} Division --" value={newUser.sales_division} onChange={e => setNewUser({ ...newUser, sales_division: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none bg-white">
                      <option value="">-- Pilih {newUser.divisi} Division --</option>
                      {daftarDivisi.map(div => <option key={div} value={div}>{div}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 tracking-widest uppercase">Jabatan / Posisi</label>
                  <select aria-label="— Pilih Jabatan —" value={newUser.jabatan} onChange={e => setNewUser({ ...newUser, jabatan: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none bg-white">
                    <option value="">— Pilih Jabatan —</option>
                    {JABATAN_LIST.map(j => <option key={j} value={j}>{JABATAN_CONFIG[j].icon} {j}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 tracking-widest uppercase">Nomor Telepon / WhatsApp</label>
                  <input value={newUser.phone_number} onChange={e => setNewUser({ ...newUser, phone_number: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none" placeholder="Contoh: 08123456789" />
                </div>
              </div>

              <MenuPermissionSelector selected={newUser.allowed_menus} target="new" />
              <button onClick={handleAddUser} disabled={saving}
                className="w-full bg-gradient-to-r from-rose-600 to-rose-700 text-white py-3 rounded-lg font-semibold hover:from-rose-700 hover:to-rose-800 transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                ➕ Tambah Akun
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}

export function AccountSettingsInline() {
  const daftarDivisi = useDivisiSales();
  const kelompokPTSList = useKelompokPTS();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'pending'>('list');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editOrig, setEditOrig] = useState<{ username: string; full_name: string } | null>(null);
  const [editDivisi, setEditDivisi] = useState('');
  const [editPtsType, setEditPtsType] = useState('');
  const [editPtsDaerah, setEditPtsDaerah] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newUser, setNewUser] = useState({
    username: '', password: '', full_name: '', role: 'guest', team_type: '', phone_number: '', sales_division: '', jabatan: '', allowed_menus: DEFAULT_MENU_KEYS, divisi: '', pts_type: '', pts_daerah: '',
  });
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [approvingUser, setApprovingUser] = useState<User | null>(null);
  const [approveMenus, setApproveMenus] = useState<string[]>(DEFAULT_MENU_KEYS);
  /**
   * Nilai AKSES yang sedang dipilih di form Edit.
   *
   * Dulu ini tombol di kolom tersendiri pada tabel, yang berarti satu klik
   * langsung mengubah hak akses tanpa konfirmasi apa pun - mudah tersenggol
   * saat menggulir daftar 74 akun. Sekarang ia jadi bagian form Edit dan baru
   * berlaku saat "Simpan Perubahan" ditekan, sama seperti field lainnya.
   */
  const [editAccessLevel, setEditAccessLevel] = useState<'full' | 'guest'>('guest');
  /** Muncul di dropdown penerima tugas? Lihat bolehDitugaskan di lib/teams.ts. */
  const [editBisaDitugaskan, setEditBisaDitugaskan] = useState(true);

  const menuLabels: Record<string, { label: string; icon: string }> = {
    'dashboard': { label: 'Analytics Dashboard (KPI)', icon: '📊' },
    'form-bast': { label: 'Form Review Demo & BAST', icon: '⭐' },
    'request-design-project': { label: 'Request Design Project', icon: '🏗️' },
    'ticket-troubleshooting': { label: 'Ticket Troubleshooting', icon: '🎫' },
    'incentive-pts': { label: 'Incentive Team PTS IVP', icon: '💰' },
    'project-progress': { label: 'Project Progress', icon: '📊' },
    'daily-report': { label: 'Daily Report', icon: '📈' },
    'database-pts': { label: 'Database PTS', icon: '💼' },
    'unit-movement': { label: 'Unit Movement Log', icon: '🚚' },
    'reminder-schedule': { label: 'Request Schedule', icon: '🗓️' },
    'picket-showroom': { label: 'Piket Showroom', icon: '🏪' },
    'learning-center': { label: 'Learning Center', icon: '🎓' },
    'tech-note': { label: 'Tech Note R&D', icon: '📝' },
    'kpi-team': { label: 'KPI Team', icon: '📊' },
  };

  const notify = (type: 'success' | 'error', msg: string) => { setNotification({ type, msg }); setTimeout(() => setNotification(null), 3000); };
  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase.from('users').select('id,username,full_name,role,team_type,phone_number,sales_division,jabatan,allowed_menus,kpi_enabled,divisi,pts_type,pts_daerah,created_at,access_level,piket_akses,bisa_ditugaskan').order('full_name');
    if (error) {
      // Fallback: try without extended columns (divisi/pts_type may not exist yet)
      const { data: fallback, error: err2 } = await supabase.from('users').select('id,username,full_name,role,team_type,phone_number,sales_division,jabatan,allowed_menus,kpi_enabled,created_at').order('full_name');
      if (!err2 && fallback) {
        setPendingUsers(fallback.filter((u: User) => u.team_type === 'Pending Approval'));
        setUsers(fallback.filter((u: User) => u.team_type !== 'Pending Approval'));
      } else {
        notify('error', `Gagal memuat akun: ${err2?.message ?? error.message}`);
      }
    } else if (data) {
      setPendingUsers(data.filter((u: User) => u.team_type === 'Pending Approval'));
      setUsers(data.filter((u: User) => u.team_type !== 'Pending Approval'));
    }
    setLoadingUsers(false);
  };

  const handleApproveUser = async () => {
    if (!approvingUser) return;
    setSaving(true);
    const sd = approvingUser.sales_division ?? '';
    let role = 'guest'; let team_type: string | null = null; let sales_division: string | null = null;
    const timDariLabel = teamTypeDariLabelPTS(sd);
    if (timDariLabel) { role = 'team'; team_type = timDariLabel; }
    else if (sd.startsWith('Marketing:')) { role = 'guest'; team_type = 'Marketing'; sales_division = sd.replace('Marketing:', '') || null; }
    else { role = 'guest'; team_type = 'Guest'; sales_division = sd || null; }
    const { error } = await adminUpdateUser(approvingUser.id, { role, team_type, sales_division, allowed_menus: approveMenus });
    setSaving(false);
    if (error) { notify('error', 'Gagal approve: ' + error.message); return; }
    notify('success', `Akun ${approvingUser.full_name} berhasil disetujui!`);
    // Audit
    const admin = getSession<User>();
    logAudit({ user_id: admin?.id ?? '', user_name: admin?.full_name ?? '', action: 'approve', module: 'user', target_id: approvingUser.id, target_name: approvingUser.full_name, new_value: role }).catch(() => {});
    void createNotification({ user_id: approvingUser.id, type: 'user', title: '✅ Akun kamu telah disetujui', body: `Selamat! Akun ${approvingUser.full_name} sudah aktif. Silakan login.`, action_url: '/dashboard', created_by: admin?.full_name ?? '' });
    setApprovingUser(null); setApproveMenus(DEFAULT_MENU_KEYS); fetchUsers();
  };

  const handleRejectUser = (userId: string, name: string) => {
    setConfirmState({ message: `Tolak & hapus pendaftaran "${name}"?`, description: 'Tindakan ini tidak bisa dibatalkan.', danger: true, confirmLabel: 'Tolak', onConfirm: async () => {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) { notify('error', 'Gagal menolak.'); return; }
      notify('success', `Pendaftaran ${name} ditolak.`);
      const admin = getSession<User>();
      logAudit({ user_id: admin?.id ?? '', user_name: admin?.full_name ?? '', action: 'reject', module: 'user', target_id: userId, target_name: name }).catch(() => {});
      fetchUsers();
    }});
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.full_name) { notify('error', 'Semua field wajib diisi!'); return; }
    if (!newUser.divisi) { notify('error', 'Divisi wajib dipilih!'); return; }
    if (newUser.divisi === 'PTS' && !newUser.pts_type) { notify('error', 'Tipe PTS wajib dipilih!'); return; }
    if (newUser.divisi === 'Sales' && !newUser.sales_division) { notify('error', 'Sales Division wajib diisi!'); return; }
    const isCabangBaru2 = kelompokPTSList.find(k => k.label === newUser.pts_type)?.cabang === true;
    if (newUser.divisi === 'PTS' && isCabangBaru2 && !newUser.pts_daerah.trim()) { notify('error', 'Alamat Daerah wajib diisi untuk PTS Cabang!'); return; }

    let role = 'guest';
    let team_type: string | null = null;
    if (newUser.divisi === 'PTS') {
      role = 'team';
      team_type = teamTypeDariLabelPTS(newUser.pts_type);
    } else if (newUser.divisi === 'Sales') {
      role = 'guest'; team_type = 'Guest';
    } else if (newUser.divisi === 'Marketing') {
      role = 'guest'; team_type = 'Marketing';
    }

    setSaving(true);
    // Marketing & Sales divisi IVP/MVI = "Sales Internal" utk routing pipeline -
    // request mereka sendiri (project direct ke user) tidak boleh kena gerbang
    // review internal. Auto-set di sini supaya admin tidak perlu toggle manual.
    const isInternalSales = newUser.divisi === 'Marketing' || (newUser.divisi === 'Sales' && ['IVP', 'MVI', 'MLDS'].includes(newUser.sales_division));
    const insertPayload: Record<string, unknown> = { username: newUser.username, full_name: newUser.full_name, role, team_type, allowed_menus: newUser.allowed_menus, jabatan: newUser.jabatan || null, phone_number: newUser.phone_number || null, sales_division: (newUser.divisi === 'Sales' || newUser.divisi === 'Marketing') ? (newUser.sales_division || null) : null, is_internal_sales: isInternalSales, pts_daerah: isCabangBaru2 ? newUser.pts_daerah.trim() : null };
    const { id: createdId, error } = await adminCreateUser(insertPayload);
    // Simpan password via server route (hash + insert ke user_credentials di server).
    if (!error && createdId && newUser.password) {
      await fetch('/api/auth/set-credential', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: createdId, password: newUser.password }),
      });
    }
    setSaving(false);
    if (error) { notify('error', 'Gagal menambah akun: ' + error.message); return; }
    notify('success', 'Akun berhasil ditambahkan!');
    sendWelcomeWA(newUser.phone_number, newUser.full_name, newUser.username, newUser.password);
    const admin = getSession<User>(); void logAudit({ user_id: admin?.id ?? '', user_name: admin?.full_name ?? '', action: 'create', module: 'user', target_name: newUser.full_name, notes: `Tambah akun: ${newUser.username}` });
    setNewUser({ username: '', password: '', full_name: '', role: 'guest', team_type: '', phone_number: '', sales_division: '', jabatan: '', allowed_menus: DEFAULT_MENU_KEYS, divisi: '', pts_type: '', pts_daerah: '' });
    setActiveTab('list'); fetchUsers();
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    const isCabangEdit2 = editDivisi === 'PTS' && kelompokPTSList.find(k => k.label === editPtsType)?.cabang === true;
    if (isCabangEdit2 && !editPtsDaerah.trim()) { notify('error', 'Alamat Daerah wajib diisi untuk PTS Cabang!'); return; }
    setSaving(true);
    let role = editingUser.role;
    let team_type: string | null = editingUser.team_type ?? null;
    if (editDivisi) {
      if (editDivisi === 'PTS') {
        role = 'team';
        team_type = teamTypeDariLabelPTS(editPtsType);
      } else if (editDivisi === 'Sales') { role = 'guest'; team_type = 'Guest'; }
      else if (editDivisi === 'Marketing') { role = 'guest'; team_type = 'Marketing'; }
    }
    const updatePayload: Record<string, unknown> = { username: editingUser.username, full_name: editingUser.full_name, role, team_type, allowed_menus: editingUser.allowed_menus ?? ALL_MENU_KEYS, jabatan: editingUser.jabatan ?? null, phone_number: editingUser.phone_number ?? null, sales_division: (editDivisi === 'Sales' || editDivisi === 'Marketing') ? (editingUser.sales_division ?? null) : null,
      // Ikut update is_internal_sales HANYA kalau admin ganti divisi (editDivisi terisi).
      ...(editDivisi ? { is_internal_sales: editDivisi === 'Marketing' || (editDivisi === 'Sales' && ['IVP', 'MVI', 'MLDS'].includes(editingUser.sales_division ?? '')) } : {}),
      ...(editDivisi === 'PTS' ? { pts_daerah: isCabangEdit2 ? editPtsDaerah.trim() : null } : {}),
      //  Lingkup catatan tamu Piket Showroom. Ikut updatePayload biasa (bukan
      //  jalur tersendiri seperti access_level) karena route admin sudah
      //  memasukkannya ke whitelist dan menulisnya dengan service-role, jadi
      //  trigger pembekuan kolom tidak menghalangi.
      piket_akses: role === 'team' ? null : (editingUser.piket_akses ?? null),
      //  Ikut updatePayload biasa: route admin menulisnya dengan service-role,
      //  jadi pembekuan kolom di trigger tidak menghalangi.
      bisa_ditugaskan: editBisaDitugaskan };
    const { error } = await adminUpdateUser(editingUser.id, updatePayload);
    if (error) { setSaving(false); notify('error', 'Gagal menyimpan: ' + error.message); return; }

    // access_level TIDAK bisa ikut updatePayload di atas: kolom itu dibekukan
    // trigger guard_users_privileged_columns() untuk anon/authenticated, jadi
    // harus lewat jalur admin tersendiri. Hanya dikirim kalau memang berubah,
    // supaya tiap simpan form tidak menambah baris audit palsu.
    const aksesLama = editingUser.access_level === 'full' ? 'full' : 'guest';
    if (role === 'team' && editAccessLevel !== aksesLama) {
      const { error: eAkses } = await adminSetAccessLevel(editingUser.id, editAccessLevel);
      if (eAkses) { setSaving(false); notify('error', 'Data tersimpan, tapi akses gagal diubah: ' + eAkses.message); return; }
    }

    const sebar = await propagateUserRename(editingUser, editOrig);
    setSaving(false);
    notify(sebar.taraf === 'ok' ? 'success' : 'error', pesanSebar(sebar));
    const admin = getSession<User>(); void logAudit({ user_id: admin?.id ?? '', user_name: admin?.full_name ?? '', action: 'update', module: 'user', target_id: editingUser.id, target_name: editingUser.full_name });
    setEditingUser(null); setEditDivisi(''); setEditPtsType(''); setEditPtsDaerah(''); fetchUsers();
  };

  const handleDeleteUser = (userId: string, name: string) => {
    setConfirmState({ message: `Hapus akun "${name}"?`, description: 'Tindakan ini tidak bisa dibatalkan.', danger: true, confirmLabel: 'Hapus', onConfirm: async () => {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) { notify('error', 'Gagal menghapus akun.'); return; }
      notify('success', 'Akun dihapus.');
      const admin = getSession<User>(); void logAudit({ user_id: admin?.id ?? '', user_name: admin?.full_name ?? '', action: 'delete', module: 'user', target_id: userId });
      fetchUsers();
    }});
  };

  function MenuPermissionSelector({ selected, target }: { selected: string[]; target: 'new' | 'edit' }) {
    const toggle = (key: string) => {
      if (target === 'new') { setNewUser(u => ({ ...u, allowed_menus: u.allowed_menus.includes(key) ? u.allowed_menus.filter(k => k !== key) : [...u.allowed_menus, key] })); }
      else if (editingUser) { const cur = editingUser.allowed_menus ?? ALL_MENU_KEYS; setEditingUser({ ...editingUser, allowed_menus: cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key] }); }
    };
    return (
      <div>
        <label className="block text-xs font-bold mb-2 text-slate-600 tracking-widest uppercase">Menu Access</label>
        <div className="grid grid-cols-2 gap-1.5">
          {ALL_MENU_KEYS.map(key => {
            const m = menuLabels[key]; const checked = selected.includes(key);
            if (!m) return null;
            return (
              <button key={key} type="button" onClick={() => toggle(key)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-left text-xs ${checked ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'}`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'border-rose-500 bg-rose-500' : 'border-slate-300 bg-white'}`}>
                  {checked && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span>{m.icon}</span>
                <span className="font-semibold truncate">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(u => !searchQuery || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || u.role?.toLowerCase().includes(searchQuery.toLowerCase()) || u.sales_division?.toLowerCase().includes(searchQuery.toLowerCase()) || u.team_type?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      {notification && (
        <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 flex-shrink-0 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {notification.type === 'success' ? '✅' : '❌'} {notification.msg}
        </div>
      )}

      {/* Isi dibungkus kartu putih di atas latar slate — bentuk yang sama
          dengan Kartu di halaman Profil. Sebelumnya tab dan isinya menempel
          langsung ke latar tanpa bidang sendiri, jadi bagian ini terlihat
          belum jadi dibanding bagian lain. */}
      <div className="flex-1 min-h-0 p-4">
        <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-slate-100 px-5 pt-3 flex-shrink-0 bg-slate-50/60">
        <button onClick={() => { setActiveTab('list'); setEditingUser(null); setEditDivisi(''); setEditPtsType(''); setEditPtsDaerah(''); }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all mr-1 ${activeTab === 'list' ? 'border-rose-500 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          👥 Daftar Akun ({users.length})
        </button>
        <button onClick={() => { setActiveTab('add'); setEditingUser(null); setEditDivisi(''); setEditPtsType(''); setEditPtsDaerah(''); }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all mr-1 ${activeTab === 'add' ? 'border-rose-500 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          ➕ Tambah Akun
        </button>
        <button onClick={() => { setActiveTab('pending'); setApprovingUser(null); }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all mr-1 ${activeTab === 'pending' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          🕐 Pending {pendingUsers.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-full">{pendingUsers.length}</span>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'list' && (
          <>
            {/* Search bar */}
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input aria-label="Cari nama, username, atau role..." type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama, username, atau role..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all" />
            </div>

            {loadingUsers ? (
              <div className="flex items-center justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-rose-600 border-rose-200 animate-spin" /></div>
            ) : editingUser ? (
              <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-800">✏️ Edit: {editingUser.full_name}</h3>
                  <button aria-label="Tutup" onClick={() => { setEditingUser(null); setEditDivisi(''); setEditPtsType(''); setEditPtsDaerah(''); }} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                </div>
                <div className="grid grid-cols-1 formulir:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Full Name</label>
                    <input value={editingUser.full_name} onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Username</label>
                    <input value={editingUser.username} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Password</label>
                    <input value={editingUser.password} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Role</label>
                    <select value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                      <option value="superadmin">Superadmin</option><option value="admin">Admin</option><option value="team">Team</option><option value="guest">Guest</option>
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Divisi</label>
                    <select aria-label="-- Pilih Divisi --" value={editDivisi} onChange={e => { setEditDivisi(e.target.value); setEditPtsType(''); }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                      <option value="">-- Pilih Divisi --</option>
                      <option value="PTS">PTS</option>
                      <option value="Sales">Sales</option>
                      <option value="Marketing">Marketing</option>
                    </select>
                  </div>
                  {editDivisi === 'PTS' && (
                    <div className="col-span-3">
                      <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Tipe PTS</label>
                      <select aria-label="-- Pilih Tipe PTS --" value={editPtsType} onChange={e => setEditPtsType(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                        <option value="">-- Pilih Tipe PTS --</option>
                        {kelompokPTSList.map(k => <option key={k.nama} value={k.label}>{k.label} → {k.nama}</option>)}
                      </select>
                    </div>
                  )}
                  {editDivisi === 'PTS' && kelompokPTSList.find(k => k.label === editPtsType)?.cabang && (
                    <div className="col-span-3">
                      <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Alamat Daerah *</label>
                      <input value={editPtsDaerah} onChange={e => setEditPtsDaerah(e.target.value)}
                        placeholder="Contoh: Surabaya, Bandung, Medan..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
                      <p className="text-[10px] text-slate-400 mt-1">Otomatis mengisi Daerah/Kota saat dipilih di dropdown PTS Cabang, Reminder Schedule.</p>
                    </div>
                  )}
                  {(editDivisi === 'Sales' || editDivisi === 'Marketing') && (
                    <div className="col-span-3">
                      <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Sales Division</label>
                      <select aria-label="-- Pilih Divisi Sales --" value={editingUser.sales_division || ''} onChange={e => setEditingUser({ ...editingUser, sales_division: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                        <option value="">-- Pilih Divisi Sales --</option>{daftarDivisi.map(div => <option key={div} value={div}>{div}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Jabatan</label>
                    <select aria-label="— Pilih Jabatan —" value={editingUser.jabatan || ''} onChange={e => setEditingUser({ ...editingUser, jabatan: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                      <option value="">— Pilih Jabatan —</option>{JABATAN_LIST.map(j => <option key={j} value={j}>{JABATAN_CONFIG[j].icon} {j}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">📱 No. Telepon / WA</label>
                    <input value={editingUser.phone_number || ''} onChange={e => setEditingUser({ ...editingUser, phone_number: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" placeholder="Contoh: 08123456789" />
                  </div>
                  {/* AKSES — dulu tombol di kolom tabel tersendiri. Dipindah ke sini
                      supaya perubahannya melewati "Simpan Perubahan" seperti field lain,
                      bukan berubah seketika begitu tersenggol di daftar. */}
                  {editingUser.role === 'team' && (
                    <div className="col-span-3">
                      <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">🔑 Akses Platform</label>
                      <div className="flex gap-2">
                        {([
                          { v: 'guest' as const, icon: '🔒', label: 'Guest',       desc: 'Hanya data miliknya sendiri' },
                          { v: 'full'  as const, icon: '🔓', label: 'Full Access', desc: 'Setara admin di modul data' },
                        ]).map(o => (
                          <button key={o.v} type="button" onClick={() => setEditAccessLevel(o.v)}
                            className={`flex-1 text-left px-3 py-2 rounded-lg border-2 transition-all ${
                              editAccessLevel === o.v
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}>
                            <span className="block text-sm font-bold">{o.icon} {o.label}</span>
                            <span className="block text-[11px] mt-0.5 opacity-80">{o.desc}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        Full Access memberi akses setara admin pada modul <strong>data</strong> (Ticketing,
                        Request Schedule, Piket Showroom, KPI Team, dll) — termasuk edit detail &amp; re-route.
                        Hak kelola akun tetap hanya admin/superadmin.
                      </p>
                    </div>
                  )}
                  {/* BISA DITUGASKAN — memisahkan "punya wewenang" dari "ikut
                      mengerjakan". Sebelumnya Ticketing mengecualikan Manager
                      lewat jabatan yang dipaku di kode, sementara Reminder
                      Schedule & Design Project tidak mengecualikan siapa pun -
                      sehingga Supervisor bisa (dan pernah) meng-assign
                      pekerjaan ke Manager karena namanya memang ditawarkan. */}
                  {editingUser.role === 'team' && (
                    <div className="col-span-3">
                      <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">🎯 Penerima Tugas</label>
                      <div className="flex gap-2">
                        {([
                          { v: true,  icon: '🛠️', label: 'Bisa ditugaskan',   desc: 'Muncul di dropdown assign' },
                          { v: false, icon: '🚫', label: 'Tidak ditugaskan',  desc: 'Menyetujui, bukan mengerjakan' },
                        ]).map(o => (
                          <button key={String(o.v)} type="button" onClick={() => setEditBisaDitugaskan(o.v)}
                            className={`flex-1 text-left px-3 py-2 rounded-lg border-2 transition-all ${
                              editBisaDitugaskan === o.v
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}>
                            <span className="block text-sm font-bold">{o.icon} {o.label}</span>
                            <span className="block text-[11px] mt-0.5 opacity-80">{o.desc}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        Menentukan apakah namanya ditawarkan saat assign pekerjaan di <strong>Ticketing,
                        Reminder Schedule, dan Request Design</strong>. Matikan untuk akun yang perannya
                        menyetujui &amp; mengarahkan — ia tetap bisa approve, re-route, dan melihat semuanya.
                      </p>
                    </div>
                  )}
                  {/* PIKET SHOWROOM — hanya untuk akun non-PTS. Tim PTS yang
                      bertugas piket selalu melihat seluruh catatan, jadi
                      kontrolnya tidak berarti apa-apa untuk mereka.

                      Ada karena resepsionis / front desk tidak muat di aturan
                      lingkup Sales: namanya tidak pernah muncul sebagai
                      nama_sales, sehingga batas itu menyisakan NOL baris dan
                      seluruh ringkasan Piket Showroom tampil kosong. */}
                  {editingUser.role !== 'team' && (
                    <div className="col-span-3">
                      <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">🏪 Piket Showroom — Catatan Tamu</label>
                      <div className="flex gap-2">
                        {([
                          { v: 'lingkup' as const, icon: '🔒', label: 'Sesuai divisi', desc: 'Hanya catatan atas namanya / divisinya' },
                          { v: 'semua'   as const, icon: '🏪', label: 'Semua catatan', desc: 'Resepsionis / front desk — tetap tidak bisa menyunting' },
                        ]).map(o => {
                          const aktif = (editingUser.piket_akses ?? 'lingkup') === o.v;
                          return (
                            <button key={o.v} type="button"
                              onClick={() => setEditingUser({ ...editingUser, piket_akses: o.v === 'lingkup' ? null : o.v })}
                              className={`flex-1 text-left px-3 py-2 rounded-lg border-2 transition-all ${
                                aktif ? 'bg-teal-50 border-teal-400 text-teal-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                              }`}>
                              <span className="block text-sm font-bold">{o.icon} {o.label}</span>
                              <span className="block text-[11px] mt-0.5 opacity-80">{o.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        Mengatur apa yang <strong>dilihat</strong> saja. Mengisi &amp; menyunting kegiatan piket tetap
                        hanya Tim PTS — akun non-PTS tidak mendapat tombol Edit.
                      </p>
                    </div>
                  )}
                  <div className="col-span-3">
                    <MenuPermissionSelector selected={editingUser.allowed_menus ?? ALL_MENU_KEYS} target="edit" />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={handleSaveEdit} disabled={saving} className="flex-1 bg-gradient-to-r from-rose-600 to-rose-700 text-white py-2.5 rounded-lg font-semibold hover:from-rose-700 hover:to-rose-800 transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                    {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    💾 Simpan Perubahan
                  </button>
                  <button onClick={() => { setEditingUser(null); setEditDivisi(''); setEditPtsType(''); setEditPtsDaerah(''); }} className="px-6 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 text-sm transition-all">Batal</button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left">
                      {['Nama', 'Username', 'Role', 'Divisi', 'No. Telepon'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                      {/* Menempel di kanan hanya mulai layar md. Di ponsel kolom
                          ini menutupi kolom lain sampai yang terlihat cuma
                          tombol Edit/Hapus berulang tanpa nama pemiliknya. */}
                      <th className="md:sticky md:right-0 bg-slate-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-500 text-right whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-10 text-slate-400 text-sm">Tidak ada akun ditemukan</td></tr>
                    ) : filteredUsers.map((user, idx) => {
                      const divisi = (user.role === 'superadmin' || user.role === 'admin')
                        ? 'Admin / Superadmin'
                        : user.role === 'team'
                          ? (user.team_type ?? '—')
                          : (user.sales_division || (user.team_type === 'Marketing' ? 'Marketing' : '—'));
                      const rowBg = idx % 2 === 0 ? 'white' : '#fafafa';
                      return (
                        <tr key={user.id} className="border-b border-slate-100 hover:bg-rose-50/30 transition-colors" style={{ background: rowBg }}>
                          <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{user.full_name}</td>
                          <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap"><Username value={user.username} /></td>
                          <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-200 text-slate-600">{labelRole(user.role)}</span></td>
                          <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{divisi}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">{user.phone_number ? <span className="text-emerald-600">📱 {user.phone_number}</span> : <span className="text-slate-300">—</span>}</td>
                          <td className="md:sticky md:right-0 px-4 py-2.5" style={{ background: rowBg }}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button onClick={() => {
                                let d = '', p = '';
                                if (user.role === 'team') { d = 'PTS'; p = labelKelompokPTS(user.team_type ?? ''); }
                                else if (user.team_type === 'Guest') { d = 'Sales'; }
                                else if (user.team_type === 'Marketing') { d = 'Marketing'; }
                                setEditDivisi(d); setEditPtsType(p); setEditPtsDaerah(user.pts_daerah ?? ''); setEditOrig({ username: user.username, full_name: user.full_name }); setEditAccessLevel(user.access_level === 'full' ? 'full' : 'guest'); setEditBisaDitugaskan(user.bisa_ditugaskan !== false); setEditingUser(user);
                              }} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all">Edit</button>
                              <button onClick={() => handleDeleteUser(user.id, user.full_name)} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all">Hapus</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'add' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 formulir:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Full Name *</label>
                <input value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" placeholder="Nama lengkap" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Username *</label>
                <input value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" placeholder="username" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Password *</label>
                <input value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" placeholder="min 6 karakter" />
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Divisi *</label>
                <select aria-label="-- Pilih Divisi --" value={newUser.divisi} onChange={e => setNewUser({ ...newUser, divisi: e.target.value, pts_type: '', pts_daerah: '', sales_division: '' })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                  <option value="">-- Pilih Divisi --</option>
                  <option value="PTS">PTS</option>
                  <option value="Sales">Sales</option>
                  <option value="Marketing">Marketing</option>
                </select>
              </div>
              {newUser.divisi === 'PTS' && (
                <div className="col-span-3">
                  <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Tipe PTS *</label>
                  <select aria-label="-- Pilih Tipe PTS --" value={newUser.pts_type} onChange={e => setNewUser({ ...newUser, pts_type: e.target.value, pts_daerah: '' })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                    <option value="">-- Pilih Tipe PTS --</option>
                    {kelompokPTSList.map(k => <option key={k.nama} value={k.label}>{k.label} → {k.nama}</option>)}
                  </select>
                </div>
              )}
              {newUser.divisi === 'PTS' && kelompokPTSList.find(k => k.label === newUser.pts_type)?.cabang && (
                <div className="col-span-3">
                  <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Alamat Daerah *</label>
                  <input value={newUser.pts_daerah} onChange={e => setNewUser({ ...newUser, pts_daerah: e.target.value })}
                    placeholder="Contoh: Surabaya, Bandung, Medan..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
                  <p className="text-[10px] text-slate-400 mt-1">Otomatis mengisi Daerah/Kota saat dipilih di dropdown PTS Cabang, Reminder Schedule.</p>
                </div>
              )}
              {(newUser.divisi === 'Sales' || newUser.divisi === 'Marketing') && (
                <div className="col-span-3">
                  <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Sales Division *</label>
                  <select aria-label="-- Pilih Sales Division --" value={newUser.sales_division} onChange={e => setNewUser({ ...newUser, sales_division: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                    <option value="">-- Pilih Sales Division --</option>{daftarDivisi.map(div => <option key={div} value={div}>{div}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Jabatan</label>
                <select aria-label="— Pilih Jabatan —" value={newUser.jabatan} onChange={e => setNewUser({ ...newUser, jabatan: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                  <option value="">— Pilih Jabatan —</option>{JABATAN_LIST.map(j => <option key={j} value={j}>{JABATAN_CONFIG[j].icon} {j}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">📱 No. Telepon / WA</label>
                <input value={newUser.phone_number} onChange={e => setNewUser({ ...newUser, phone_number: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" placeholder="Contoh: 08123456789" />
              </div>
              <div className="col-span-3">
                <MenuPermissionSelector selected={newUser.allowed_menus} target="new" />
              </div>
            </div>
            <button onClick={handleAddUser} disabled={saving}
              className="w-full bg-gradient-to-r from-rose-600 to-rose-700 text-white py-3 rounded-lg font-semibold hover:from-rose-700 hover:to-rose-800 transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              ➕ Tambah Akun
            </button>
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="space-y-3">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-amber-500 border-amber-200 animate-spin" /></div>
            ) : approvingUser ? (
              <div className="space-y-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">✅ Review Pendaftaran: {approvingUser.full_name}</h3>
                  <button aria-label="Tutup" onClick={() => { setApprovingUser(null); setApproveMenus(DEFAULT_MENU_KEYS); }} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm bg-white p-3 rounded-lg border border-slate-200">
                  <div><span className="text-xs text-slate-500 uppercase font-bold">Nama</span><p className="font-semibold text-slate-800">{approvingUser.full_name}</p></div>
                  <div><span className="text-xs text-slate-500 uppercase font-bold">Username</span><p className="font-semibold text-slate-800"><Username value={approvingUser.username} /></p></div>
                  <div><span className="text-xs text-slate-500 uppercase font-bold">Divisi / Request</span>
                    <p className="font-semibold text-amber-700">{
                      approvingUser.sales_division?.startsWith('PTS') ? `PTS → ${approvingUser.sales_division}`
                      : approvingUser.sales_division?.startsWith('Marketing:') ? `Marketing → ${approvingUser.sales_division.replace('Marketing:', '')}`
                      : `Sales → ${approvingUser.sales_division}`
                    }</p>
                  </div>
                  <div><span className="text-xs text-slate-500 uppercase font-bold">Jabatan</span><p className="font-semibold text-slate-800">{approvingUser.jabatan || '—'}</p></div>
                  {approvingUser.phone_number && <div className="col-span-2"><span className="text-xs text-slate-500 uppercase font-bold">No. Telepon</span><p className="font-semibold text-slate-800">{approvingUser.phone_number}</p></div>}
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-700 tracking-widest uppercase">Menu yang Diberikan</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_MENU_KEYS.map(key => {
                      const m = menuLabels[key]; const checked = approveMenus.includes(key);
                      return (
                        <button key={key} type="button" onClick={() => setApproveMenus(prev => checked ? prev.filter(k => k !== key) : [...prev, key])}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-left text-xs ${checked ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'border-amber-500 bg-amber-500' : 'border-slate-300 bg-white'}`}>
                            {checked && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span>{m.icon}</span><span className="font-semibold truncate">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={handleApproveUser} disabled={saving}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2 hover:from-emerald-700 hover:to-emerald-800 transition-all">
                    {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    ✅ Setujui Akun
                  </button>
                  <button onClick={() => handleRejectUser(approvingUser.id, approvingUser.full_name)}
                    className="px-5 py-2.5 rounded-lg border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-all">
                    ❌ Tolak
                  </button>
                </div>
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                <div className="text-3xl mb-2">✅</div>
                Tidak ada pendaftaran yang menunggu
              </div>
            ) : (
              <div className="space-y-2">
                {pendingUsers.map(user => {
                  const daysPending = user.created_at
                    ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000)
                    : null;
                  const isStale = daysPending !== null && daysPending > 14;
                  return (
                  <div key={user.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isStale ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${isStale ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
                      {user.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800 text-sm truncate">{user.full_name}</p>
                        {daysPending !== null && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black flex-shrink-0 ${isStale ? 'bg-red-200 text-red-800' : 'bg-amber-100 text-amber-700'}`}>
                            {isStale ? `⚠️ ${daysPending}h` : `${daysPending}h`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500"><Username value={user.username} /></p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-200 text-amber-800">
                          {user.sales_division?.startsWith('PTS') ? `PTS • ${user.sales_division}` : user.sales_division?.startsWith('Marketing:') ? `Marketing • ${user.sales_division.replace('Marketing:', '')}` : `Sales • ${user.sales_division}`}
                        </span>
                        {user.jabatan && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">{user.jabatan}</span>}
                        {user.phone_number && <span className="text-[9px] text-slate-500">📱 {user.phone_number}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button onClick={() => { setApprovingUser(user); setApproveMenus(DEFAULT_MENU_KEYS); }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all">Review</button>
                      <button onClick={() => handleRejectUser(user.id, user.full_name)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all">Tolak</button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}
