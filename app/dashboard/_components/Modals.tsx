'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { setSession } from '@/lib/auth';
import {
  User, MenuItem, NotificationItem,
  SALES_DIVISIONS, JABATAN_LIST, JabatanType, JABATAN_CONFIG, JABATAN_CC_RULES,
  ALL_MENU_KEYS, ALL_MENU_LABELS, ROLE_BADGE,
  NotifBellProps, AdminPanelModalProps,
  DISPLAY_BRANDS_DB, MIDDLEWARE_BRANDS_DB, BrandPicMappingDB,
} from './shared';

interface AccountSettingsModalProps {
  onClose: () => void;
}

export function AccountSettingsModal({ onClose }: AccountSettingsModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDivisi, setEditDivisi] = useState('');
  const [editPtsType, setEditPtsType] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'guest',
    team_type: '',
    phone_number: '',
    sales_division: '',
    jabatan: '',
    allowed_menus: ALL_MENU_KEYS,
    divisi: '',
    pts_type: '',
  });
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const menuLabels: Record<string, { label: string; icon: string; gradient: string }> = {
    'dashboard': { label: 'Analytics Dashboard (KPI)', icon: '📊', gradient: 'from-blue-600 to-indigo-500' },
    'learning-center': { label: 'Learning Center', icon: '🎓', gradient: 'from-teal-600 to-teal-500' },
    'form-bast': { label: 'Form Review Demo & BAST', icon: '⭐', gradient: 'from-slate-600 to-slate-500' },
    'request-design-project': { label: 'Request Design Project', icon: '🏗️', gradient: 'from-violet-600 to-violet-500' },
    'ticket-troubleshooting': { label: 'Ticket Troubleshooting', icon: '🎫', gradient: 'from-rose-600 to-rose-500' },
    'daily-report': { label: 'Daily Report', icon: '📈', gradient: 'from-emerald-600 to-emerald-500' },
    'database-pts': { label: 'Database PTS', icon: '💼', gradient: 'from-indigo-600 to-indigo-500' },
    'unit-movement': { label: 'Unit Movement Log', icon: '🚚', gradient: 'from-amber-600 to-amber-500' },
    'reminder-schedule': { label: 'Reminder Schedule', icon: '🗓️', gradient: 'from-cyan-600 to-cyan-500' },
    'picket-showroom': { label: 'Piket Showroom', icon: '🏪', gradient: 'from-teal-600 to-teal-500' },
    'tech-note': { label: 'Tech Note R&D', icon: '📝', gradient: 'from-pink-600 to-rose-500' },
  };

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase.from('users').select('*').order('full_name');
    if (!error && data) setUsers(data);
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
    if (newUser.divisi === 'Sales' && !newUser.sales_division) {
      notify('error', 'Sales Division wajib diisi!'); return;
    }

    let role = 'guest';
    let team_type: string | null = null;
    if (newUser.divisi === 'PTS') {
      role = 'team';
      if (newUser.pts_type === 'PTS IVP') team_type = 'Team PTS';
      else if (newUser.pts_type === 'PTS UMP') team_type = 'Team PTS UMP';
      else if (newUser.pts_type === 'PTS MLDS') team_type = 'Team PTS MLDS';
    } else if (newUser.divisi === 'Sales') {
      role = 'guest';
      team_type = 'Guest';
    } else if (newUser.divisi === 'Marketing') {
      role = 'guest';
      team_type = 'Marketing';
    }

    setSaving(true);
    const insertPayload: Record<string, unknown> = {
      username: newUser.username,
      password: newUser.password,
      full_name: newUser.full_name,
      role,
      team_type,
      allowed_menus: newUser.allowed_menus,
      jabatan: newUser.jabatan || null,
      phone_number: newUser.phone_number || null,
      sales_division: newUser.divisi === 'Sales' ? (newUser.sales_division || null) : null,
    };
    const { error } = await supabase.from('users').insert([insertPayload]);
    setSaving(false);
    if (error) { notify('error', 'Gagal menambah akun: ' + error.message); return; }
    notify('success', 'Akun berhasil ditambahkan!');
    setNewUser({ username: '', password: '', full_name: '', role: 'guest', team_type: '', phone_number: '', sales_division: '', jabatan: '', allowed_menus: ALL_MENU_KEYS, divisi: '', pts_type: '' });
    setActiveTab('list');
    fetchUsers();
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSaving(true);

    let role = editingUser.role;
    let team_type: string | null = editingUser.team_type ?? null;

    if (editDivisi) {
      if (editDivisi === 'PTS') {
        role = 'team';
        if (editPtsType === 'PTS IVP') team_type = 'Team PTS';
        else if (editPtsType === 'PTS UMP') team_type = 'Team PTS UMP';
        else if (editPtsType === 'PTS MLDS') team_type = 'Team PTS MLDS';
        else team_type = null;
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
      password: editingUser.password,
      full_name: editingUser.full_name,
      role,
      team_type,
      allowed_menus: editingUser.allowed_menus ?? ALL_MENU_KEYS,
      jabatan: editingUser.jabatan ?? null,
      phone_number: editingUser.phone_number ?? null,
      sales_division: editDivisi === 'Sales' ? (editingUser.sales_division ?? null) : null,
    };
    const { error } = await supabase.from('users').update(updatePayload).eq('id', editingUser.id);
    setSaving(false);
    if (error) { notify('error', 'Gagal menyimpan: ' + error.message); return; }
    notify('success', 'Akun berhasil diperbarui!');
    setEditingUser(null);
    setEditDivisi('');
    setEditPtsType('');
    fetchUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Hapus akun ini?')) return;
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) { notify('error', 'Gagal menghapus akun.'); return; }
    notify('success', 'Akun dihapus.');
    fetchUsers();
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
                  {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 py-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Account Settings</h2>
              <p className="text-white/60 text-xs">Kelola akun & hak akses menu</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {notification && (
          <div className={`mx-6 mt-4 px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {notification.type === 'success' ? '✅' : '❌'} {notification.msg}
          </div>
        )}

        <div className="flex border-b border-slate-200 px-6 pt-4 flex-shrink-0">
          {(['list', 'add'] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setEditingUser(null); setEditDivisi(''); setEditPtsType(''); }}
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
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama, username, atau role..."
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
                        <button onClick={() => { setEditingUser(null); setEditDivisi(''); setEditPtsType(''); }} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
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
                          <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Password</label>
                          <input value={editingUser.password} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
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
                          <select value={editDivisi} onChange={e => { setEditDivisi(e.target.value); setEditPtsType(''); }}
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
                            <select value={editPtsType} onChange={e => setEditPtsType(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                              <option value="">-- Pilih Tipe PTS --</option>
                              <option value="PTS IVP">PTS IVP → Team PTS</option>
                              <option value="PTS UMP">PTS UMP → Team PTS UMP</option>
                              <option value="PTS MLDS">PTS MLDS → Team PTS MLDS</option>
                            </select>
                          </div>
                        )}
                        {editDivisi === 'Sales' && (
                          <div className="col-span-2">
                            <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Sales Division</label>
                            <select value={editingUser.sales_division || ''} onChange={e => setEditingUser({ ...editingUser, sales_division: e.target.value })}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                              <option value="">-- Pilih Divisi Sales --</option>
                              {SALES_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Jabatan / Posisi</label>
                          <select value={editingUser.jabatan || ''} onChange={e => setEditingUser({ ...editingUser, jabatan: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
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
                        <button onClick={() => { setEditingUser(null); setEditDivisi(''); setEditPtsType(''); }} className="px-6 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 text-sm transition-all">Batal</button>
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
                            <p className="text-xs text-slate-500">@{user.username}</p>
                            {user.phone_number && (
                              <p className="text-xs text-slate-400 mt-0.5">📞 {user.phone_number}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-slate-200 text-slate-600">{user.role}</span>
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
                                if (user.team_type === 'Team PTS') p = 'PTS IVP';
                                else if (user.team_type === 'Team PTS UMP') p = 'PTS UMP';
                                else if (user.team_type === 'Team PTS MLDS') p = 'PTS MLDS';
                              } else if (user.team_type === 'Guest') { d = 'Sales'; }
                              else if (user.team_type === 'Marketing') { d = 'Marketing'; }
                              setEditDivisi(d);
                              setEditPtsType(p);
                              setEditingUser(user);
                            }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all">Edit</button>
                            <button onClick={() => handleDeleteUser(user.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all">Hapus</button>
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
                  <input value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none" placeholder="password" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold mb-1 text-slate-600 tracking-widest uppercase">Divisi *</label>
                  <select value={newUser.divisi} onChange={e => setNewUser({ ...newUser, divisi: e.target.value, pts_type: '', sales_division: '' })}
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
                    <select value={newUser.pts_type} onChange={e => setNewUser({ ...newUser, pts_type: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none bg-white">
                      <option value="">-- Pilih Tipe PTS --</option>
                      <option value="PTS IVP">PTS IVP → Team PTS</option>
                      <option value="PTS UMP">PTS UMP → Team PTS UMP</option>
                      <option value="PTS MLDS">PTS MLDS → Team PTS MLDS</option>
                    </select>
                  </div>
                )}
                {newUser.divisi === 'Sales' && (
                  <div className="col-span-2">
                    <label className="block text-xs font-bold mb-1 text-slate-600 tracking-widest uppercase">Sales Division *</label>
                    <select value={newUser.sales_division} onChange={e => setNewUser({ ...newUser, sales_division: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none bg-white">
                      <option value="">-- Pilih Sales Division --</option>
                      {SALES_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-600 tracking-widest uppercase">Jabatan / Posisi</label>
                  <select value={newUser.jabatan} onChange={e => setNewUser({ ...newUser, jabatan: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-400 outline-none bg-white">
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
  );
}

// ─── UserProfileModal ─────────────────────────────────────────────────────────

interface UserProfileModalProps {
  currentUser: User;
  onClose: () => void;
}

export function UserProfileModal({ currentUser, onClose }: UserProfileModalProps) {
  const [userData, setUserData] = useState<User>(currentUser);
  const [editPhone, setEditPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState(currentUser.phone_number || '');
  const [editPassword, setEditPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [supervisors, setSupervisors] = useState<{ full_name: string; phone_number?: string; sales_division?: string; jabatan?: string }[]>([]);
  const [subordinates, setSubordinates] = useState<{ full_name: string; username: string; sales_division?: string; jabatan?: string }[]>([]);

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3500);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('users').select('*').eq('id', currentUser.id).single();
      if (data) { setUserData(data); setPhoneInput(data.phone_number || ''); }

      const userDiv = currentUser.sales_division;
      const selfTier = currentUser.jabatan ? (JABATAN_CONFIG[currentUser.jabatan as JabatanType]?.tier ?? 0) : 0;

      if (userDiv) {
        const { data: supMaps } = await supabase.from('division_supervisor_mappings').select('supervisor_id').eq('sales_division', userDiv);
        if (supMaps && supMaps.length > 0) {
          const ids = supMaps.map((s: any) => s.supervisor_id).filter((id: string) => id !== currentUser.id); // exclude self
          if (ids.length > 0) {
            const { data: sups } = await supabase.from('users').select('full_name, phone_number, sales_division, jabatan').in('id', ids);
            // Only show users with HIGHER tier (true atasan)
            const filtered = (sups ?? []).filter((s: any) => {
              const tier = s.jabatan ? (JABATAN_CONFIG[s.jabatan as JabatanType]?.tier ?? 0) : 0;
              return tier > selfTier;
            });
            if (filtered.length) setSupervisors(filtered);
          }
        }
        const { data: ivpMaps } = await supabase.from('division_ivp_mappings').select('ivp_id').eq('sales_division', userDiv);
        if (ivpMaps && ivpMaps.length > 0) {
          const ivpIds = ivpMaps.map((s: any) => s.ivp_id);
          const { data: ivps } = await supabase.from('users').select('full_name, phone_number, sales_division, jabatan').in('id', ivpIds);
          if (ivps) setSupervisors(prev => [...prev, ...ivps.map((iv: any) => ({ ...iv, _isIVP: true }))]);
        }
      }

      if (currentUser.jabatan && ['Supervisor', 'Manager', 'Deputy General Manager', 'General Manager', 'Direktur'].includes(currentUser.jabatan)) {
        const { data: divMaps } = await supabase.from('division_supervisor_mappings').select('sales_division').eq('supervisor_id', currentUser.id);
        if (divMaps && divMaps.length > 0) {
          const divs = divMaps.map((m: any) => m.sales_division);
          const { data: subUsers } = await supabase.from('users').select('full_name, username, sales_division, jabatan').in('sales_division', divs).eq('role', 'guest').neq('sales_division', 'IVP').neq('id', currentUser.id);
          // Only show users with LOWER tier (true bawahan), exclude self
          const filtered = (subUsers ?? []).filter((u: any) => {
            if (u.username === currentUser.username) return false; // exclude self
            const tier = u.jabatan ? (JABATAN_CONFIG[u.jabatan as JabatanType]?.tier ?? 0) : 0;
            return tier < selfTier;
          });
          if (filtered.length) setSubordinates(filtered);
        }
      }
    })();
  }, []);

  const handleSavePhone = async () => {
    setSaving(true);
    const { error } = await supabase.from('users').update({ phone_number: phoneInput.trim() }).eq('id', currentUser.id);
    if (error) { notify('error', 'Gagal menyimpan nomor telepon.'); }
    else {
      notify('success', 'Nomor WhatsApp berhasil diperbarui!');
      setEditPhone(false);
      const { data } = await supabase.from('users').select('*').eq('id', currentUser.id).single();
      if (data) { setUserData(data); setSession(data); }
    }
    setSaving(false);
  };

  const handleSavePassword = async () => {
    if (!passwordInput || passwordInput.length < 6) { notify('error', 'Password minimal 6 karakter.'); return; }
    if (passwordInput !== confirmPassword) { notify('error', 'Konfirmasi password tidak cocok.'); return; }
    setSaving(true);
    const { error } = await supabase.from('users').update({ password: passwordInput }).eq('id', currentUser.id);
    if (error) { notify('error', 'Gagal mengubah password.'); }
    else { notify('success', 'Password berhasil diubah!'); setEditPassword(false); setPasswordInput(''); setConfirmPassword(''); }
    setSaving(false);
  };

  const roleClass = ROLE_BADGE[userData.role?.toLowerCase()] || 'bg-slate-100 text-slate-700 border-slate-200';
  const initials = userData.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const jabatanCfg = userData.jabatan ? JABATAN_CONFIG[userData.jabatan as JabatanType] : null;

  const sortedSupervisors = [...supervisors].sort((a, b) => {
    const ta = a.jabatan ? (JABATAN_CONFIG[a.jabatan as JabatanType]?.tier ?? 0) : 0;
    const tb = b.jabatan ? (JABATAN_CONFIG[b.jabatan as JabatanType]?.tier ?? 0) : 0;
    return tb - ta;
  });
  const sortedSubordinates = [...subordinates].sort((a, b) => {
    const ta = a.jabatan ? (JABATAN_CONFIG[a.jabatan as JabatanType]?.tier ?? 0) : 0;
    const tb = b.jabatan ? (JABATAN_CONFIG[b.jabatan as JabatanType]?.tier ?? 0) : 0;
    return tb - ta;
  });

  const atasanList = sortedSupervisors.filter((s: any) => !s._isIVP);
  const ivpList = sortedSupervisors.filter((s: any) => s._isIVP);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto flex flex-col border border-slate-200">

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">User Profile</h2>
              <p className="text-white/60 text-xs">Informasi pribadi akun Anda</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {notification && (
          <div className={`mx-5 mt-4 px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {notification.type === 'success' ? '✅' : '❌'} {notification.msg}
          </div>
        )}

        <div className="p-5 space-y-4">

          {/* ── ROW 1: Identity card (avatar + info) ── */}
          <div className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: jabatanCfg?.border ?? '#e2e8f0' }}>
            {/* Avatar + name row */}
            <div className="flex items-center gap-4 px-5 py-4" style={{ background: jabatanCfg ? `linear-gradient(135deg, ${jabatanCfg.bg}, white)` : 'linear-gradient(135deg, #f8fafc, white)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-slate-900 text-xl leading-tight truncate">{userData.full_name}</p>
                <p className="text-slate-500 text-sm font-medium">@{userData.username}</p>
                {jabatanCfg ? (
                  <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                    style={{ background: jabatanCfg.bg, color: jabatanCfg.color, borderColor: jabatanCfg.border }}>
                    <span className="text-sm">{jabatanCfg.icon}</span>
                    {userData.jabatan}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-1 italic">Jabatan belum diset</p>
                )}
              </div>
            </div>

            {/* ── 3-column info grid ── */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100">
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Role Sistem</p>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${roleClass}`}>{userData.role}</span>
              </div>
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sales Division</p>
                <p className="text-sm font-semibold text-slate-700">{userData.sales_division || <span className="text-slate-400 italic">—</span>}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tim / Type</p>
                <p className="text-sm font-semibold text-slate-700">{userData.team_type && userData.team_type !== 'Pending Approval' ? userData.team_type : <span className="text-slate-400 italic">—</span>}</p>
              </div>
            </div>
          </div>

          {/* ── ROW 2: WA + Password side by side ── */}
          <div className="grid grid-cols-2 gap-4">
            {/* WhatsApp */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">📱 Nomor WhatsApp</p>
              </div>
              <div className="px-4 py-3">
                {editPhone ? (
                  <div className="space-y-2">
                    <input type="text" value={phoneInput} onChange={e => setPhoneInput(e.target.value)} placeholder="628123456789"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" />
                    <p className="text-[10px] text-slate-400">Format internasional, tanpa spasi</p>
                    <div className="flex gap-2">
                      <button onClick={handleSavePhone} disabled={saving} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">
                        {saving ? 'Menyimpan...' : 'Simpan'}
                      </button>
                      <button onClick={() => { setEditPhone(false); setPhoneInput(userData.phone_number || ''); }}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-all">Batal</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold flex-1 min-w-0">
                      {userData.phone_number
                        ? <span className="text-emerald-700 truncate block">📱 {userData.phone_number}</span>
                        : <span className="text-rose-500 italic text-xs">⚠️ Belum diisi</span>}
                    </p>
                    <button onClick={() => setEditPhone(true)} className="text-xs text-indigo-600 font-bold hover:underline flex-shrink-0">Edit</button>
                  </div>
                )}
              </div>
            </div>

            {/* Password */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">🔒 Password</p>
              </div>
              <div className="px-4 py-3">
                {editPassword ? (
                  <div className="space-y-2">
                    <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder="Password baru (min. 6)"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" />
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Konfirmasi password"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" />
                    <div className="flex gap-2">
                      <button onClick={handleSavePassword} disabled={saving} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">
                        {saving ? 'Menyimpan...' : 'Simpan'}
                      </button>
                      <button onClick={() => { setEditPassword(false); setPasswordInput(''); setConfirmPassword(''); }}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-all">Batal</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400 tracking-widest">••••••••</p>
                    <button onClick={() => setEditPassword(true)} className="text-xs text-indigo-600 font-bold hover:underline flex-shrink-0">Ubah</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── ROW 3: Hierarki (Atasan + IVP) side by side, Bawahan full width ── */}
          {(atasanList.length > 0 || ivpList.length > 0 || sortedSubordinates.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {/* Atasan */}
              {atasanList.length > 0 && (
                <div className="rounded-xl overflow-hidden border border-amber-200">
                  <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span>🔺</span>
                      <span className="font-bold text-amber-800 text-xs">Atasan · {userData.sales_division}</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-200">{atasanList.length}</span>
                  </div>
                  <div className="divide-y divide-amber-50">
                    {atasanList.map((sup, i) => {
                      const cfg = sup.jabatan ? JABATAN_CONFIG[sup.jabatan as JabatanType] : null;
                      return (
                        <div key={i} className="px-3 py-2.5 flex items-center gap-2.5 bg-white hover:bg-amber-50/40 transition-colors">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                            style={{ background: cfg?.bg ?? '#f1f5f9', border: `1.5px solid ${cfg?.border ?? '#e2e8f0'}` }}>
                            {cfg?.icon ?? '👤'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">{sup.full_name}</p>
                            {sup.jabatan && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: cfg?.bg, color: cfg?.color }}>
                                {cfg?.icon} {sup.jabatan}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-3 py-2 bg-amber-50 border-t border-amber-100">
                    <p className="text-[9px] text-amber-600 font-medium">✉️ Di-CC otomatis via WA</p>
                  </div>
                </div>
              )}

              {/* IVP Account */}
              {ivpList.length > 0 && (
                <div className="rounded-xl overflow-hidden border border-violet-200">
                  <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-200 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span>🔗</span>
                      <span className="font-bold text-violet-800 text-xs">IVP Account</span>
                    </div>
                    <span className="text-[10px] font-bold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full border border-violet-200">{ivpList.length}</span>
                  </div>
                  <div className="divide-y divide-violet-50">
                    {ivpList.map((ivp, i) => (
                      <div key={i} className="px-3 py-2.5 flex items-center gap-2.5 bg-white hover:bg-violet-50/40 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 border border-violet-200 flex items-center justify-center font-bold text-sm text-violet-700 flex-shrink-0">
                          {ivp.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-violet-900 text-sm truncate">{ivp.full_name}</p>
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-300 flex-shrink-0">IVP</span>
                          </div>
                          {ivp.phone_number
                            ? <p className="text-[10px] text-emerald-600">📱 {ivp.phone_number}</p>
                            : <p className="text-[10px] text-rose-400">⚠️ No WA</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-3 py-2 bg-violet-50 border-t border-violet-100">
                    <p className="text-[9px] text-violet-600 font-medium">✉️ Di-CC &amp; lihat ticket divisi ini</p>
                  </div>
                </div>
              )}

              {/* Jika hanya ada salah satu dari Atasan/IVP, isi kolom lain dengan Bawahan */}
              {atasanList.length === 0 && ivpList.length > 0 && sortedSubordinates.length > 0 && (
                <div className="rounded-xl overflow-hidden border border-indigo-200">
                  <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-200 flex items-center justify-between">
                    <div className="flex items-center gap-1.5"><span>🔻</span><span className="font-bold text-indigo-800 text-xs">Bawahan Anda</span></div>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full border border-indigo-200">{sortedSubordinates.length}</span>
                  </div>
                  <div className="p-3 flex flex-wrap gap-1.5 bg-white">
                    {sortedSubordinates.map((sub, i) => {
                      const cfg = sub.jabatan ? JABATAN_CONFIG[sub.jabatan as JabatanType] : null;
                      return (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs"
                          style={{ background: cfg?.bg ?? '#f8fafc', borderColor: cfg?.border ?? '#e2e8f0' }}>
                          <span className="flex-shrink-0">{cfg?.icon ?? '👤'}</span>
                          <div>
                            <p className="font-bold leading-tight" style={{ color: cfg?.color ?? '#374151' }}>{sub.full_name}</p>
                            <p className="text-[9px] text-slate-400">{sub.jabatan || '—'}{sub.sales_division ? ` · ${sub.sales_division}` : ''}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ROW 4: Bawahan full width (jika ada keduanya atasan dan IVP) ── */}
          {sortedSubordinates.length > 0 && (atasanList.length > 0 || (atasanList.length === 0 && ivpList.length === 0)) && (
            <div className="rounded-xl overflow-hidden border border-indigo-200">
              <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-200 flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="text-base">🔻</span><span className="font-bold text-indigo-800 text-sm">Bawahan Anda</span></div>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200">{sortedSubordinates.length} orang</span>
              </div>
              <div className="p-3 flex flex-wrap gap-2 bg-white">
                {sortedSubordinates.map((sub, i) => {
                  const cfg = sub.jabatan ? JABATAN_CONFIG[sub.jabatan as JabatanType] : null;
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs"
                      style={{ background: cfg?.bg ?? '#f8fafc', borderColor: cfg?.border ?? '#e2e8f0' }}>
                      <span className="text-base flex-shrink-0">{cfg?.icon ?? '👤'}</span>
                      <div>
                        <p className="font-bold" style={{ color: cfg?.color ?? '#374151' }}>{sub.full_name}</p>
                        <p className="text-[10px] text-slate-500">{sub.jabatan || '—'}{sub.sales_division ? ` · ${sub.sales_division}` : ''}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ROW 5: Menu Akses ── */}
          {userData.role?.toLowerCase() !== 'superadmin' && userData.role?.toLowerCase() !== 'admin' && userData.allowed_menus && userData.allowed_menus.length > 0 && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2"><span>🗂️</span><span className="font-bold text-slate-700 text-sm">Menu yang Dapat Diakses</span></div>
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-1.5">
                {userData.allowed_menus.map(key => {
                  const m = ALL_MENU_LABELS[key];
                  if (!m) return null;
                  return <span key={key} className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">{m.icon} {m.label}</span>;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── UserManagementModal ──────────────────────────────────────────────────────
interface UserManagementModalProps {
  onClose: () => void;
}

export function UserManagementModal({ onClose }: UserManagementModalProps) {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [divSupMaps, setDivSupMaps] = useState<{ id: string; sales_division: string; supervisor_id: string }[]>([]);
  const [divIvpMaps, setDivIvpMaps] = useState<{ id: string; sales_division: string; ivp_id: string }[]>([]);
  const [userSupMaps, setUserSupMaps] = useState<{ id: string; user_id: string; supervisor_id: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'atasan' | 'ivp' | 'user_cc'>('atasan');
  const [atasanDiv, setAtasanDiv] = useState('');
  const [atasanSupId, setAtasanSupId] = useState('');
  const [ivpDiv, setIvpDiv] = useState('');
  const [ivpUserId, setIvpUserId] = useState('');
  // User CC: selected user, then checklist of supervisor IDs to CC
  const [selectedCCUserId, setSelectedCCUserId] = useState('');
  const [ccChecked, setCcChecked] = useState<Set<string>>(new Set());
  const [ccSaving, setCcSaving] = useState(false);

  const notify = (type: 'success' | 'error' | 'info', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3500);
  };

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoadingData(true);
    const [usersRes, divSupRes, divIvpRes, userSupRes] = await Promise.all([
      supabase.from('users').select('id, username, full_name, role, team_type, sales_division, phone_number, jabatan').order('full_name'),
      supabase.from('division_supervisor_mappings').select('*').order('sales_division'),
      supabase.from('division_ivp_mappings').select('*').order('sales_division'),
      supabase.from('user_supervisor_mappings').select('*'),
    ]);
    if (usersRes.data) setAllUsers(usersRes.data);
    if (divSupRes.data) setDivSupMaps(divSupRes.data);
    if (divIvpRes.data) setDivIvpMaps(divIvpRes.data);
    if (userSupRes.data) setUserSupMaps(userSupRes.data);
    setLoadingData(false);
  };

  const getUserById = (id: string) => allUsers.find(u => u.id === id);

  const ATASAN_JABATAN: JabatanType[] = ['Supervisor', 'Manager', 'Deputy General Manager', 'General Manager', 'Direktur'];
  const supervisorCandidates = allUsers.filter(u =>
    u.role?.toLowerCase() === 'guest' && u.jabatan && ATASAN_JABATAN.includes(u.jabatan as JabatanType)
  );
  const ivpUsers = allUsers.filter(u => u.role?.toLowerCase() === 'guest' && u.sales_division === 'IVP');
  const nonIvpDivisions = SALES_DIVISIONS.filter(d => d !== 'IVP');

  // Users eligible for CC mapping (non-IVP guest with jabatan set)
  const ccEligibleUsers = allUsers.filter(u =>
    u.role?.toLowerCase() === 'guest' && u.jabatan && u.sales_division && u.sales_division !== 'IVP'
  ).sort((a, b) => {
    const ta = JABATAN_CONFIG[a.jabatan as JabatanType]?.tier ?? 0;
    const tb = JABATAN_CONFIG[b.jabatan as JabatanType]?.tier ?? 0;
    return ta - tb;
  });

  // When user is selected for CC tab, load their current mappings
  useEffect(() => {
    if (!selectedCCUserId) { setCcChecked(new Set()); return; }
    const existing = userSupMaps.filter(m => m.user_id === selectedCCUserId).map(m => m.supervisor_id);
    setCcChecked(new Set(existing));
  }, [selectedCCUserId, userSupMaps]);

  // Auto-suggest CC targets based on jabatan rules
  const getAutoSuggestedCC = (userId: string): string[] => {
    const user = getUserById(userId);
    if (!user?.jabatan || !user.sales_division) return [];
    const ccJabatan = JABATAN_CC_RULES[user.jabatan as JabatanType] ?? [];
    // Find users in same division who have the CC jabatan
    const supIds = divSupMaps
      .filter(m => m.sales_division === user.sales_division)
      .map(m => m.supervisor_id);
    return allUsers
      .filter(u => supIds.includes(u.id) && u.jabatan && ccJabatan.includes(u.jabatan as JabatanType))
      .map(u => u.id);
  };

  const handleSaveUserCC = async () => {
    if (!selectedCCUserId) return;
    setCcSaving(true);
    try {
      // Delete existing user_supervisor_mappings for this user
      await supabase.from('user_supervisor_mappings').delete().eq('user_id', selectedCCUserId);
      // Insert new
      const toInsert = Array.from(ccChecked).map(supId => ({ user_id: selectedCCUserId, supervisor_id: supId }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('user_supervisor_mappings').insert(toInsert);
        if (error) { notify('error', 'Gagal: ' + error.message); setCcSaving(false); return; }
      }
      notify('success', 'CC mapping disimpan!');
      await fetchAll();
    } catch (e: any) { notify('error', e.message); }
    setCcSaving(false);
  };

  const handleAddAtasan = async () => {
    if (!atasanDiv || !atasanSupId) { notify('error', 'Pilih divisi dan atasan.'); return; }
    const existing = divSupMaps.find(m => m.sales_division === atasanDiv && m.supervisor_id === atasanSupId);
    if (existing) { notify('info', 'Mapping ini sudah ada.'); return; }
    setSaving(true);
    const { error } = await supabase.from('division_supervisor_mappings').insert([{ sales_division: atasanDiv, supervisor_id: atasanSupId }]);
    if (error) notify('error', 'Gagal: ' + error.message);
    else { notify('success', 'Mapping atasan ditambahkan!'); setAtasanDiv(''); setAtasanSupId(''); await fetchAll(); }
    setSaving(false);
  };

  const handleDeleteAtasan = async (id: string) => {
    if (!confirm('Hapus mapping atasan ini?')) return;
    await supabase.from('division_supervisor_mappings').delete().eq('id', id);
    notify('success', 'Dihapus.'); await fetchAll();
  };

  const handleAddIvp = async () => {
    if (!ivpDiv || !ivpUserId) { notify('error', 'Pilih divisi dan IVP Account.'); return; }
    const existing = divIvpMaps.find(m => m.sales_division === ivpDiv && m.ivp_id === ivpUserId);
    if (existing) { notify('info', 'Mapping ini sudah ada.'); return; }
    setSaving(true);
    const { error } = await supabase.from('division_ivp_mappings').insert([{ sales_division: ivpDiv, ivp_id: ivpUserId }]);
    if (error) notify('error', 'Gagal: ' + error.message);
    else { notify('success', 'IVP mapping ditambahkan!'); setIvpDiv(''); setIvpUserId(''); await fetchAll(); }
    setSaving(false);
  };

  const handleDeleteIvp = async (id: string) => {
    if (!confirm('Hapus mapping IVP ini?')) return;
    await supabase.from('division_ivp_mappings').delete().eq('id', id);
    notify('success', 'Dihapus.'); await fetchAll();
  };

  const jabatanBadge = (u: User | undefined) => {
    if (!u?.jabatan) return null;
    const cfg = JABATAN_CONFIG[u.jabatan as JabatanType];
    if (!cfg) return null;
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>{cfg.icon} {u.jabatan}</span>;
  };

  const atasanByDiv: Record<string, typeof divSupMaps> = {};
  divSupMaps.forEach(m => { if (!atasanByDiv[m.sales_division]) atasanByDiv[m.sales_division] = []; atasanByDiv[m.sales_division].push(m); });

  const ivpByDiv: Record<string, typeof divIvpMaps> = {};
  divIvpMaps.forEach(m => { if (!ivpByDiv[m.sales_division]) ivpByDiv[m.sales_division] = []; ivpByDiv[m.sales_division].push(m); });

  const selectedUserObj = selectedCCUserId ? getUserById(selectedCCUserId) : null;
  const selectedJabatan = selectedUserObj?.jabatan as JabatanType | undefined;
  const autoSuggested = selectedCCUserId ? getAutoSuggestedCC(selectedCCUserId) : [];

  // Potential CC targets for selected user: all users with jabatan tier >= their tier
  const potentialCCTargets = selectedUserObj ? allUsers.filter(u => {
    if (u.id === selectedCCUserId) return false;
    if (!u.jabatan) return false;
    const targetTier = JABATAN_CONFIG[u.jabatan as JabatanType]?.tier ?? 0;
    const selfTier = JABATAN_CONFIG[selectedJabatan as JabatanType]?.tier ?? 0;
    return targetTier > selfTier; // only higher-tier users
  }).sort((a, b) => {
    const ta = JABATAN_CONFIG[a.jabatan as JabatanType]?.tier ?? 0;
    const tb = JABATAN_CONFIG[b.jabatan as JabatanType]?.tier ?? 0;
    return tb - ta; // highest first
  }) : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-slate-200">

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-6 py-5 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">User Management</h2>
              <p className="text-white/60 text-xs">Mapping Atasan, IVP Account &amp; CC per User</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {notification && (
          <div className={`mx-5 mt-3 px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 flex-shrink-0 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
            {notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : 'ℹ️'} {notification.msg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-5 pt-3 gap-1 flex-shrink-0 flex-wrap">
          <button onClick={() => setActiveTab('atasan')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'atasan' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            👨‍💼 Mapping Atasan ({Object.keys(atasanByDiv).length} divisi)
          </button>
          <button onClick={() => setActiveTab('ivp')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'ivp' ? 'border-violet-500 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            🔗 IVP Account ({Object.keys(ivpByDiv).length} divisi)
          </button>
          <button onClick={() => setActiveTab('user_cc')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'user_cc' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            🏷️ CC per User ({userSupMaps.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">

          {/* ══ TAB ATASAN ══ */}
          {activeTab === 'atasan' && (
            <>
              <div className="p-5 border-b border-slate-100 bg-amber-50/60 space-y-3 flex-shrink-0">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-widest">➕ Tambah Mapping Atasan Divisi</p>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Mapping divisi → atasan. User dengan <strong>divisi yang sama</strong> otomatis ter-CC ke atasan terdaftar. Untuk user beda divisi (misal Handono SGP 1 → Rainata SGP), gunakan tab <strong>CC per User</strong>.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Sales Division</label>
                    <select value={atasanDiv} onChange={e => setAtasanDiv(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white">
                      <option value="">— Pilih Divisi —</option>
                      {nonIvpDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Atasan (Jabatan Supervisor+)</label>
                    {supervisorCandidates.length === 0 ? (
                      <div className="text-[11px] text-rose-600 p-2 bg-rose-50 rounded-lg border border-rose-200">⚠️ Set jabatan user di Account Settings terlebih dahulu.</div>
                    ) : (
                      <select value={atasanSupId} onChange={e => setAtasanSupId(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white">
                        <option value="">— Pilih Atasan —</option>
                        {ATASAN_JABATAN.slice().reverse().map(tier => {
                          const list = supervisorCandidates.filter(u => u.jabatan === tier);
                          if (!list.length) return null;
                          const cfg = JABATAN_CONFIG[tier];
                          return (
                            <optgroup key={tier} label={`${cfg.icon} ${tier}`}>
                              {list.map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.full_name} (@{u.username}){u.sales_division ? ` [${u.sales_division}]` : ''}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                    )}
                  </div>
                </div>
                <button onClick={handleAddAtasan} disabled={saving || !atasanDiv || !atasanSupId}
                  className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#d97706,#b45309)' }}>
                  {saving ? '⏳ Menyimpan...' : '💾 Tambah Mapping Atasan'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {loadingData ? (
                  <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-t-amber-500 border-amber-200 animate-spin" /></div>
                ) : Object.keys(atasanByDiv).length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <p className="text-3xl mb-2">👨‍💼</p>
                    <p className="font-semibold">Belum ada mapping atasan</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(atasanByDiv).sort(([a], [b]) => a.localeCompare(b)).map(([division, maps]) => {
                      const supIdsInDiv = new Set(maps.map(m => m.supervisor_id));
                      const maxAtasanTier = maps.reduce((max, m) => {
                        const atasan = allUsers.find(a => a.id === m.supervisor_id);
                        const t = atasan?.jabatan ? (JABATAN_CONFIG[atasan.jabatan as JabatanType]?.tier ?? 0) : 0;
                        return Math.max(max, t);
                      }, 0);
                      // Atasan dengan tier tertinggi (yang jadi "puncak" divisi ini)
                      const topAtasanIds = new Set(maps
                        .filter(m => {
                          const atasan = allUsers.find(a => a.id === m.supervisor_id);
                          return (atasan?.jabatan ? (JABATAN_CONFIG[atasan.jabatan as JabatanType]?.tier ?? 0) : 0) === maxAtasanTier;
                        })
                        .map(m => m.supervisor_id)
                      );
                      const divUsers = allUsers.filter(u => {
                        if (u.role?.toLowerCase() !== 'guest') return false;
                        if (u.sales_division !== division) return false;
                        if (topAtasanIds.has(u.id)) return false; // exclude hanya top atasan
                        const userTier = u.jabatan ? (JABATAN_CONFIG[u.jabatan as JabatanType]?.tier ?? 0) : 0;
                        return maxAtasanTier === 0 || userTier < maxAtasanTier;
                      }).sort((a, b) => {
                        const ta = a.jabatan ? (JABATAN_CONFIG[a.jabatan as JabatanType]?.tier ?? 0) : 0;
                        const tb = b.jabatan ? (JABATAN_CONFIG[b.jabatan as JabatanType]?.tier ?? 0) : 0;
                        return tb - ta;
                      });
                      return (
                        <div key={division} className="rounded-xl border border-amber-200 overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                            <span className="text-base">🏢</span>
                            <span className="font-bold text-amber-800 text-sm">{division}</span>
                            <div className="ml-auto flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200">👤 {divUsers.length} user</span>
                              <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-200">{maps.length} atasan</span>
                            </div>
                          </div>
                          {divUsers.length > 0 && (
                            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bawahan di Divisi Ini</p>
                              <div className="flex flex-wrap gap-1.5">
                                {divUsers.map(u => {
                                  const cfg = u.jabatan ? JABATAN_CONFIG[u.jabatan as JabatanType] : null;
                                  return (
                                    <div key={u.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs">
                                      <div className="w-4 h-4 rounded-full flex items-center justify-center font-black text-[9px] flex-shrink-0"
                                        style={{ background: 'linear-gradient(135deg,#fde68a,#f59e0b)', color: '#78350f' }}>
                                        {u.full_name?.charAt(0)?.toUpperCase()}
                                      </div>
                                      <span className="font-semibold text-slate-700">{u.full_name}</span>
                                      {u.jabatan && (
                                        <span className="text-[9px] font-bold px-1 py-0.5 rounded"
                                          style={{ background: cfg?.bg ?? '#f1f5f9', color: cfg?.color ?? '#475569' }}>
                                          {cfg?.icon} {u.jabatan}
                                        </span>
                                      )}
                                      {u.sales_division && u.sales_division !== division && (
                                        <span className="text-[9px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded">{u.sales_division}</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          <div className="divide-y divide-amber-50 bg-white">
                            {maps.map(m => {
                              const sup = getUserById(m.supervisor_id);
                              const cfg = sup?.jabatan ? JABATAN_CONFIG[sup.jabatan as JabatanType] : null;
                              return (
                                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                                    style={{ background: cfg?.bg ?? '#f9fafb', border: `1.5px solid ${cfg?.border ?? '#e5e7eb'}` }}>
                                    {cfg?.icon ?? '👤'}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-bold text-sm" style={{ color: cfg?.color ?? '#374151' }}>{sup?.full_name ?? m.supervisor_id}</p>
                                      {jabatanBadge(sup)}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <p className="text-[10px] text-slate-400">@{sup?.username}</p>
                                      {sup?.phone_number
                                        ? <span className="text-[10px] text-emerald-600">📱 {sup.phone_number}</span>
                                        : <span className="text-[10px] text-rose-400">⚠️ No WA</span>}
                                    </div>
                                  </div>
                                  <button onClick={() => handleDeleteAtasan(m.id)}
                                    className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all flex-shrink-0">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══ TAB IVP ══ */}
          {activeTab === 'ivp' && (
            <>
              <div className="p-5 border-b border-slate-100 bg-violet-50/60 space-y-3 flex-shrink-0">
                <p className="text-xs font-bold text-violet-800 uppercase tracking-widest">🔗 Tambah Mapping IVP Account</p>
                <p className="text-[11px] text-violet-700 leading-relaxed">
                  Mapping divisi external ke IVP Account yang handle-nya. IVP Account hanya bisa melihat ticket dari divisi yang di-map.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Sales Division (External)</label>
                    <select value={ivpDiv} onChange={e => setIvpDiv(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 bg-white">
                      <option value="">— Pilih Divisi —</option>
                      {nonIvpDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">IVP Account (sales_division=IVP)</label>
                    {ivpUsers.length === 0 ? (
                      <div className="text-[11px] text-rose-600 p-2 bg-rose-50 rounded-lg border border-rose-200">⚠️ Tidak ada user IVP.</div>
                    ) : (
                      <select value={ivpUserId} onChange={e => setIvpUserId(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 bg-white">
                        <option value="">— Pilih IVP —</option>
                        {ivpUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name} (@{u.username}){!u.phone_number ? ' ⚠️' : ''}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <button onClick={handleAddIvp} disabled={saving || !ivpDiv || !ivpUserId}
                  className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                  {saving ? '⏳ Menyimpan...' : '🔗 Tambah IVP Mapping'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {loadingData ? (
                  <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-t-violet-500 border-violet-200 animate-spin" /></div>
                ) : Object.keys(ivpByDiv).length === 0 ? (
                  <div className="text-center py-10 text-slate-400"><p className="text-3xl mb-2">🔗</p><p className="font-semibold">Belum ada mapping IVP</p></div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(ivpByDiv).sort(([a], [b]) => a.localeCompare(b)).map(([division, maps]) => (
                      <div key={division} className="rounded-xl border border-violet-200 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border-b border-violet-100">
                          <span className="text-base">🔗</span>
                          <span className="font-bold text-violet-800 text-sm">{division}</span>
                          <span className="ml-auto text-[10px] text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full border border-violet-200">{maps.length} IVP</span>
                        </div>
                        <div className="divide-y divide-violet-50 bg-white">
                          {maps.map(m => {
                            const ivp = getUserById(m.ivp_id);
                            return (
                              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="w-8 h-8 rounded-lg bg-violet-100 border border-violet-200 flex items-center justify-center text-lg flex-shrink-0">🔗</div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-sm text-violet-800">{ivp?.full_name ?? m.ivp_id}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[10px] text-slate-400">@{ivp?.username}</p>
                                    {ivp?.phone_number
                                      ? <span className="text-[10px] text-emerald-600">📱 {ivp.phone_number}</span>
                                      : <span className="text-[10px] text-rose-400">⚠️ No WA</span>}
                                  </div>
                                </div>
                                <button onClick={() => handleDeleteIvp(m.id)}
                                  className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all flex-shrink-0">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══ TAB USER CC ══ */}
          {activeTab === 'user_cc' && (
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Left: user list */}
              <div className="w-56 border-r border-slate-200 flex flex-col flex-shrink-0">
                <div className="px-4 py-2.5 bg-teal-50 border-b border-teal-100">
                  <p className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">Pilih User</p>
                  <p className="text-[9px] text-teal-600 mt-0.5">Centang siapa yang di-CC saat user ini buat aktivitas</p>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {ccEligibleUsers.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs py-10">
                      <p className="text-3xl mb-2">🙅</p>
                      <p>Belum ada user dengan jabatan ter-set</p>
                      <p className="mt-1 text-[9px]">Set jabatan di Account Settings</p>
                    </div>
                  ) : ccEligibleUsers.map(u => {
                    const cfg = u.jabatan ? JABATAN_CONFIG[u.jabatan as JabatanType] : null;
                    const myMaps = userSupMaps.filter(m => m.user_id === u.id).length;
                    const isSelected = selectedCCUserId === u.id;
                    return (
                      <button key={u.id} onClick={() => setSelectedCCUserId(u.id)}
                        className={`w-full text-left px-3 py-3 border-b transition-all ${isSelected ? 'bg-teal-50 border-l-4 border-l-teal-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                        style={{ borderBottomColor: 'rgba(0,0,0,0.05)' }}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {cfg && <span className="text-xs">{cfg.icon}</span>}
                          <p className={`text-sm font-bold truncate ${isSelected ? 'text-teal-700' : 'text-slate-700'}`}>{u.full_name}</p>
                        </div>
                        <p className="text-[9px] text-slate-400 truncate">{u.jabatan}{u.sales_division ? ` · ${u.sales_division}` : ''}</p>
                        {myMaps > 0 && <span className="mt-1 inline-block bg-teal-100 text-teal-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{myMaps} CC ter-set</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: checklist */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {!selectedCCUserId ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                    <p className="text-5xl mb-3">👈</p>
                    <p className="text-sm font-medium">Pilih user di sebelah kiri</p>
                    <p className="text-xs mt-1">Lalu centang siapa yang di-CC saat user ini membuat ticket/form</p>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-3 bg-teal-50 border-b border-teal-100 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-teal-800">CC untuk: {selectedUserObj?.full_name}</p>
                          <p className="text-[10px] text-teal-600">{selectedJabatan} · {selectedUserObj?.sales_division}</p>
                        </div>
                        <button
                          onClick={() => { const s = new Set(autoSuggested); setCcChecked(s); }}
                          className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all hover:bg-teal-100"
                          style={{ background: 'rgba(13,148,136,0.08)', color: '#0d9488', borderColor: 'rgba(13,148,136,0.2)' }}>
                          ✨ Auto-pilih berdasarkan jabatan
                        </button>
                      </div>
                      {selectedJabatan && JABATAN_CC_RULES[selectedJabatan as JabatanType] && (
                        <div className="mt-2 p-2 rounded-lg text-[10px]" style={{ background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(13,148,136,0.15)' }}>
                          <span className="font-bold text-teal-700">Rules jabatan {selectedJabatan}:</span>
                          <span className="text-teal-600 ml-1">
                            otomatis CC ke {JABATAN_CC_RULES[selectedJabatan as JabatanType].length > 0
                              ? JABATAN_CC_RULES[selectedJabatan as JabatanType].join(', ')
                              : '(tidak ada — level tertinggi)'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                      {potentialCCTargets.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          <p className="text-3xl mb-2">🏆</p>
                          <p className="font-semibold text-sm">Tidak ada user dengan jabatan lebih tinggi</p>
                          <p className="text-xs mt-1">Ini adalah jabatan tertinggi yang tersedia</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {potentialCCTargets.map(u => {
                            const cfg = u.jabatan ? JABATAN_CONFIG[u.jabatan as JabatanType] : null;
                            const checked = ccChecked.has(u.id);
                            const isAutoSuggested = autoSuggested.includes(u.id);
                            return (
                              <button key={u.id} onClick={() => setCcChecked(prev => {
                                const n = new Set(prev); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n;
                              })}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${checked ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/30'}`}>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'border-teal-500 bg-teal-500' : 'border-slate-300 bg-white'}`}>
                                  {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ background: cfg?.bg ?? '#f1f5f9', border: `1.5px solid ${cfg?.border ?? '#e2e8f0'}` }}>
                                  <span className="text-base">{cfg?.icon ?? '👤'}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-sm" style={{ color: cfg?.color ?? '#374151' }}>{u.full_name}</p>
                                    {isAutoSuggested && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">⭐ Disarankan</span>}
                                  </div>
                                  <p className="text-[10px] text-slate-400">{u.jabatan}{u.sales_division ? ` · ${u.sales_division}` : ''}</p>
                                  {u.phone_number
                                    ? <p className="text-[10px] text-emerald-600">📱 {u.phone_number}</p>
                                    : <p className="text-[10px] text-rose-400">⚠️ No WA — tidak akan di-CC</p>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="p-4 border-t border-slate-100 flex-shrink-0 bg-slate-50/50 flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-[10px] text-slate-500">{ccChecked.size} orang dipilih untuk di-CC</p>
                      </div>
                      <button onClick={handleSaveUserCC} disabled={ccSaving}
                        className="px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 hover:scale-[1.02]"
                        style={{ background: 'linear-gradient(135deg,#0d9488,#0f766e)' }}>
                        {ccSaving ? '⏳ Menyimpan...' : '💾 Simpan CC'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── BrandPicSettingModal ─────────────────────────────────────────────────────

export function BrandPicSettingModal({ onClose }: { onClose: () => void }) {
  const [brandUsers, setBrandUsers] = useState<{id:string;full_name:string;sales_division?:string}[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState<{type:'success'|'error';msg:string}|null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('id, full_name, sales_division').eq('role','guest').eq('team_type','Marketing').order('full_name'),
      supabase.from('brand_pic_mappings').select('*'),
    ]).then(([usersRes, mapsRes]) => {
      if (usersRes.data) setBrandUsers(usersRes.data as any[]);
      if (mapsRes.data) {
        const map: Record<string,string> = {};
        (mapsRes.data as BrandPicMappingDB[]).forEach(m => { if(m.pic_user_id) map[`${m.brand_type}:${m.brand_name}`] = m.pic_user_id; });
        setMappings(map);
      }
      setLoading(false);
    });
  }, []);

  const notify = (type:'success'|'error', msg:string) => { setNotif({type,msg}); setTimeout(()=>setNotif(null),3000); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allBrands = [
        ...DISPLAY_BRANDS_DB.map(b=>({brand_type:'display' as const,brand_name:b})),
        ...MIDDLEWARE_BRANDS_DB.map(b=>({brand_type:'middleware' as const,brand_name:b})),
      ];
      for (const {brand_type,brand_name} of allBrands) {
        const key = `${brand_type}:${brand_name}`;
        const picId = mappings[key] || null;
        const picUser = picId ? brandUsers.find(u=>u.id===picId) : null;
        await supabase.from('brand_pic_mappings').upsert(
          {brand_type,brand_name,pic_user_id:picId,pic_user_name:picUser?.full_name||null},
          {onConflict:'brand_type,brand_name'}
        );
      }
      notify('success','Mapping PIC Brand disimpan!');
    } catch(e:any) { notify('error',e.message); }
    setSaving(false);
  };

  const Row = ({type,brand}:{type:'display'|'middleware';brand:string}) => {
    const key = `${type}:${brand}`;
    return (
      <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
        <span className="w-36 text-sm font-semibold text-slate-700 flex-shrink-0">{brand}</span>
        <select value={mappings[key]||''} onChange={e=>setMappings(p=>({...p,[key]:e.target.value}))}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400 appearance-none">
          <option value="">— Belum ada PIC —</option>
          {brandUsers.map(u=><option key={u.id} value={u.id}>{u.full_name} ({u.sales_division})</option>)}
        </select>
        {mappings[key] && <span className="text-[10px] text-teal-600 font-bold flex-shrink-0">✅</span>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col border border-slate-200">
        <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-5 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg">⚙️</div>
            <div><h2 className="text-base font-bold text-white">Setting PIC Brand</h2><p className="text-white/70 text-xs">Mapping brand ke PIC penanggung jawab (Request Design Project)</p></div>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-all">✕</button>
        </div>
        {notif && <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg text-sm font-semibold flex-shrink-0 ${notif.type==='success'?'bg-emerald-50 text-emerald-700 border border-emerald-200':'bg-red-50 text-red-700 border border-red-200'}`}>{notif.type==='success'?'✅':'❌'} {notif.msg}</div>}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? <div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-amber-500 border-amber-200 animate-spin"/></div> : (
            <>
              <div>
                <p className="text-sm font-bold text-amber-700 uppercase tracking-widest mb-3">🖥️ Brand Display</p>
                <div className="bg-amber-50/50 rounded-xl border border-amber-200 px-4 py-1">
                  {DISPLAY_BRANDS_DB.map(b=><Row key={b} type="display" brand={b}/>)}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-violet-700 uppercase tracking-widest mb-3">🔌 Brand Middleware</p>
                <div className="bg-violet-50/50 rounded-xl border border-violet-200 px-4 py-1">
                  {MIDDLEWARE_BRANDS_DB.map(b=><Row key={b} type="middleware" brand={b}/>)}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 border-2 border-slate-300 text-slate-600 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">Batal</button>
          <button onClick={handleSave} disabled={saving||loading} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50" style={{background:'linear-gradient(135deg,#d97706,#b45309)'}}>
            {saving?'⏳ Menyimpan...':'💾 Simpan Semua'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Notification Bell Component ─────────────────────────────────────────────

export function NotifBell({ icon, label, count, color, bgColor, borderColor, dotColor, items, onItemClick }: NotifBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins}m lalu`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}j lalu`;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          background: count > 0 ? bgColor : 'rgba(255,255,255,0.55)',
          border: `1.5px solid ${count > 0 ? borderColor : 'rgba(0,0,0,0.1)'}`,
          boxShadow: count > 0 ? `0 2px 12px ${borderColor}55` : 'none',
        }}
      >
        <span className="text-base leading-none">{icon}</span>
        <span className="text-xs font-bold hidden sm:block" style={{ color: count > 0 ? color : '#64748b' }}>{label}</span>
        {count > 0 && (
          <span className="flex items-center justify-center rounded-full text-white font-black text-[10px] min-w-[18px] h-[18px] px-1 animate-pulse"
            style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}88` }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
        {count === 0 && <span className="text-[10px] font-semibold text-slate-400">0</span>}
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 z-[100] rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: 320,
            background: 'rgba(255,255,255,0.97)',
            border: `1.5px solid ${borderColor}`,
            backdropFilter: 'blur(16px)',
            boxShadow: `0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px ${borderColor}33`,
            animation: 'dropIn 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: bgColor, borderBottom: `1px solid ${borderColor}44` }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{icon}</span>
              <span className="text-sm font-bold" style={{ color }}>{label}</span>
            </div>
            {count > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-white" style={{ background: dotColor }}>{count} baru</span>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <span className="text-3xl opacity-40">✅</span>
                <p className="text-xs text-slate-400 font-medium">Tidak ada notifikasi</p>
              </div>
            ) : (
              items.map((item) => (
                <button key={item.id} onClick={() => { onItemClick(item); setOpen(false); }}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100/80 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{item.title}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5">{formatTime(item.time)}</span>
                </button>
              ))
            )}
          </div>
          {items.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100">
              <p className="text-[10px] text-center text-slate-400 font-medium">Klik item untuk membuka</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Notification Bar Component ───────────────────────────────────────────────
interface NotificationBarProps {
  currentUser: User;
  onNavigate: (internalUrl: string, title: string) => void;
}

export function NotificationBar({ currentUser, onNavigate }: NotificationBarProps) {
  const [ticketNotifs, setTicketNotifs]   = useState<NotificationItem[]>([]);
  const [requireNotifs, setRequireNotifs] = useState<NotificationItem[]>([]);
  const [reminderNotifs, setReminderNotifs] = useState<NotificationItem[]>([]);
  const [reviewNotifs, setReviewNotifs]   = useState<NotificationItem[]>([]);

  const roleLC = (currentUser.role ?? '').trim().toLowerCase();
  const teamType = (currentUser.team_type ?? '').trim();
  const isTeamServices = roleLC === 'team' && teamType === 'Team Services';
  const isTeamPTS = roleLC === 'team' && teamType === 'Team PTS';
  const isTeamPTS_UMP = roleLC === 'team' && teamType === 'Team PTS UMP';
  const isTeamPTS_MLDS = roleLC === 'team' && teamType === 'Team PTS MLDS';
  const isTeamPTS_SubGroup = isTeamPTS_UMP || isTeamPTS_MLDS;
  const isPTS  = ['admin', 'superadmin'].includes(roleLC) || isTeamPTS;
  const isAdmin = ['admin', 'superadmin'].includes(roleLC);

  const fetchAll = useCallback(async () => {
    let assignedName: string = currentUser.full_name;
    let memberTeamType: string = teamType;
    try {
      const { data: allMembers } = await supabase.from('team_members').select('name, team_type, username');
      if (allMembers && allMembers.length > 0) {
        const found = (allMembers as any[]).find(m =>
          (m.username ?? '').toLowerCase().trim() === currentUser.username.toLowerCase().trim()
        );
        if (found?.name) assignedName = found.name;
        if (found?.team_type) memberTeamType = found.team_type;
      }
    } catch { /* fallback */ }

    // Nama-nama yang mungkin dipakai sebagai assign_name di berbagai tabel
    // (cover perbedaan nama di team_members vs nama asli user)
    const namesToCheck = [...new Set([assignedName, currentUser.full_name].filter(Boolean))];

    // ── 1. Ticket Troubleshooting ──
    try {
      if (isAdmin) {
        const { data } = await supabase.from('tickets').select('id, project_name, issue_case, assign_name, status, created_at').neq('status', 'Solved').order('created_at', { ascending: false }).limit(50);
        setTicketNotifs((data ?? []).map((t: any) => ({ id: t.id, type: 'ticket' as const, title: t.project_name, subtitle: `${t.status} · ${t.issue_case}`, time: t.created_at, url: '/ticketing', internalUrl: '/ticketing', menuTitle: 'Ticket Troubleshooting' })));
      } else if (roleLC === 'guest') {
        const isIVPUser = currentUser.sales_division === 'IVP';
        if (isIVPUser) {
          // IVP: notif ticket dari semua divisi yang dia handle
          const { data: ivpDivMaps } = await supabase
            .from('division_ivp_mappings').select('sales_division').eq('ivp_id', currentUser.id);
          const handledDivs = (ivpDivMaps ?? []).map((m: any) => m.sales_division as string);
          if (handledDivs.length > 0) {
            const { data } = await supabase.from('tickets')
              .select('id, project_name, issue_case, assign_name, status, created_at, sales_division')
              .in('sales_division', handledDivs).neq('status', 'Solved')
              .order('created_at', { ascending: false }).limit(50);
            setTicketNotifs((data ?? []).map((t: any) => ({
              id: t.id, type: 'ticket' as const,
              title: t.project_name,
              subtitle: `${t.status} · ${t.issue_case} · ${t.sales_division}`,
              time: t.created_at, url: '/ticketing', internalUrl: '/ticketing', menuTitle: 'Ticket Troubleshooting',
            })));
          } else { setTicketNotifs([]); }
        } else {
          // Non-IVP guest: existing logic
          const { data: mappings } = await supabase.from('guest_mappings').select('project_name').eq('guest_username', currentUser.username);
          const mapped = (mappings ?? []).map((m: any) => m.project_name as string);
          let q = supabase.from('tickets').select('id, project_name, issue_case, assign_name, status, created_at').neq('status', 'Solved');
          if (mapped.length > 0) {
            q = q.or(`created_by.eq.${currentUser.username},project_name.in.(${mapped.map((p: string) => `"${p}"`).join(',')})`);
          } else {
            q = q.eq('created_by', currentUser.username);
          }
          const { data } = await q.order('created_at', { ascending: false }).limit(30);
          setTicketNotifs((data ?? []).map((t: any) => ({ id: t.id, type: 'ticket' as const, title: t.project_name, subtitle: `${t.status} · ${t.issue_case}`, time: t.created_at, url: '/ticketing', internalUrl: '/ticketing', menuTitle: 'Ticket Troubleshooting' })));
        }
      } else if (roleLC === 'team' || roleLC === 'team_pts') {
        if (memberTeamType === 'Team Services') {
          // Fix: pakai .in() agar match meskipun nama beda antara team_members vs tickets
          const { data } = await supabase.from('tickets').select('id, project_name, issue_case, assign_name, status, services_status, created_at').in('assign_name', namesToCheck).neq('services_status', 'Solved').not('services_status', 'is', null).order('created_at', { ascending: false }).limit(30);
          setTicketNotifs((data ?? []).map((t: any) => ({ id: t.id, type: 'ticket' as const, title: t.project_name, subtitle: `Svc: ${t.services_status} · ${t.issue_case}`, time: t.created_at, url: '/ticketing', internalUrl: '/ticketing', menuTitle: 'Ticket Troubleshooting' })));
        } else {
          // Fix: pakai .in() agar match meskipun ada variasi nama
          const { data } = await supabase.from('tickets').select('id, project_name, issue_case, assign_name, status, created_at').in('assign_name', namesToCheck).neq('status', 'Solved').order('created_at', { ascending: false }).limit(30);
          setTicketNotifs((data ?? []).map((t: any) => ({ id: t.id, type: 'ticket' as const, title: t.project_name, subtitle: `${t.status} · ${t.issue_case}`, time: t.created_at, url: '/ticketing', internalUrl: '/ticketing', menuTitle: 'Ticket Troubleshooting' })));
        }
      }
    } catch (e) { console.error('[notif] ticket fetch error:', e); }

    // ── 2. Form Require Project ──
    // Helper: status yang dianggap "selesai" — exclude dari notif
    const DONE_STATUSES = ['completed', 'rejected', 'cancelled'];
    const excludeDone = (q: any) => DONE_STATUSES.reduce((acc, s) => acc.neq('status', s), q);
    // Helper: build notif item dari row
    const toRequireNotif = (r: any) => {
      const _sLbl: Record<string, string> = { pending: '⏳ Pending', approved: '✅ Approved', in_progress: '🔄 In Progress' };
      return { id: r.id, type: 'require' as const, title: r.project_name, subtitle: `${_sLbl[r.status] ?? ('🏗️ ' + r.status)} · ${r.sales_name}`, time: r.created_at, url: '/form-require-project', internalUrl: '/form-require-project', menuTitle: 'Request Design Project' };
    };

    try {
      if (isAdmin) {
        // Admin/superadmin: semua request aktif
        const { data } = await excludeDone(
          supabase.from('project_requests').select('id, project_name, status, sales_name, created_at')
        ).order('created_at', { ascending: false }).limit(50);
        setRequireNotifs((data ?? []).map(toRequireNotif));

      } else if (isPTS && !isAdmin) {
        // Team PTS: request yang di-assign ke mereka (cek dua nama: dari team_members DAN full_name login)
        // Ini fix utama: assign_name bisa pakai nama team_members ATAU currentUser.full_name
        const namesToCheck = [...new Set([assignedName, currentUser.full_name].filter(Boolean))];
        const { data } = await excludeDone(
          supabase.from('project_requests')
            .select('id, project_name, status, sales_name, assign_name, created_at')
            .in('assign_name', namesToCheck)
        ).order('created_at', { ascending: false }).limit(30);
        setRequireNotifs((data ?? []).map(toRequireNotif));

      } else if (roleLC === 'guest' || roleLC === 'sales') {
        const isIVPUser2 = currentUser.sales_division === 'IVP';
        const BRAND_DIVS = ['MLDS', 'UMP', 'OSS'];
        const isBrandPICNotif = BRAND_DIVS.includes(currentUser.sales_division || '');
        const selfJabatanN = (currentUser as any).jabatan as string | undefined;
        const TIER_MAP: Record<string, number> = { 'Staff': 1, 'Supervisor': 2, 'Manager': 3, 'Deputy General Manager': 4, 'General Manager': 5, 'Direktur': 6 };
        const selfTierN = selfJabatanN ? (TIER_MAP[selfJabatanN] ?? 0) : 0;
        const selfDivN = currentUser.sales_division;

        // ── Base: selalu ambil milik sendiri + yang di-assign via ivp_assignee ──
        // Ini cover semua kasus termasuk Hendri yang request-nya di-assign ke dia
        const [{ data: ownReqs }, { data: ivpAssignedReqs }] = await Promise.all([
          excludeDone(
            supabase.from('project_requests')
              .select('id, project_name, status, sales_name, created_at, sales_division, requester_id, ivp_assignee')
              .eq('requester_id', currentUser.id)
          ).order('created_at', { ascending: false }).limit(50),
          excludeDone(
            supabase.from('project_requests')
              .select('id, project_name, status, sales_name, created_at, sales_division, requester_id, ivp_assignee')
              .eq('ivp_assignee', currentUser.full_name)
          ).order('created_at', { ascending: false }).limit(50),
        ]);

        // Mulai dengan set base (milik sendiri + di-assign ke user ini)
        const baseMap = new Map<string, any>();
        [...(ownReqs ?? []), ...(ivpAssignedReqs ?? [])].forEach((r: any) => {
          if (!baseMap.has(r.id)) baseMap.set(r.id, r);
        });

        // ── Extended scope berdasarkan role ──
        if (isIVPUser2) {
          // IVP guest: tambahkan request dari divisi yang dia handle via mapping
          const { data: ivpDivMaps2 } = await supabase
            .from('division_ivp_mappings').select('sales_division').eq('ivp_id', currentUser.id);
          const handledDivs2 = (ivpDivMaps2 ?? []).map((m: any) => m.sales_division as string);
          if (handledDivs2.length > 0) {
            const { data: divReqs } = await excludeDone(
              supabase.from('project_requests')
                .select('id, project_name, status, sales_name, created_at, sales_division, requester_id, ivp_assignee')
                .in('sales_division', handledDivs2)
            ).order('created_at', { ascending: false }).limit(50);
            (divReqs ?? []).forEach((r: any) => { if (!baseMap.has(r.id)) baseMap.set(r.id, r); });
          }

        } else if (isBrandPICNotif) {
          // Brand PIC (MLDS/UMP/OSS): tambahkan request yang brand pic-nya = user ini
          const { data: allReqsBrand } = await excludeDone(
            supabase.from('project_requests')
              .select('id, project_name, status, sales_name, created_at, sales_division, requester_id, ivp_assignee, rooms')
          ).order('created_at', { ascending: false }).limit(100);
          (allReqsBrand ?? []).forEach((r: any) => {
            if (baseMap.has(r.id)) return;
            if (!r.rooms || !Array.isArray(r.rooms)) return;
            const isBrandPic = r.rooms.some((room: any) =>
              room.brand_display_pic_id === currentUser.id || room.brand_middleware_pic_id === currentUser.id
            );
            if (isBrandPic) baseMap.set(r.id, r);
          });

        } else if (selfTierN > 1 && selfDivN) {
          // Supervisor+: tambahkan request dari bawahan di divisi yang di-supervisi
          const { data: supMapsN } = await supabase.from('division_supervisor_mappings')
            .select('sales_division').eq('supervisor_id', currentUser.id);
          const supDivsN = (supMapsN ?? []).map((m: any) => m.sales_division as string);
          if (!supDivsN.includes(selfDivN)) supDivsN.push(selfDivN);

          const { data: allGuestsN } = await supabase.from('users')
            .select('id, jabatan, sales_division').in('role', ['guest', 'sales']);
          const subIdsN = (allGuestsN ?? [])
            .filter((u: any) => (TIER_MAP[(u.jabatan as string) ?? ''] ?? 0) < selfTierN && supDivsN.includes(u.sales_division))
            .map((u: any) => u.id as string);

          if (subIdsN.length > 0) {
            const { data: subReqs } = await excludeDone(
              supabase.from('project_requests')
                .select('id, project_name, status, sales_name, created_at, sales_division, requester_id, ivp_assignee')
                .in('requester_id', subIdsN)
            ).order('created_at', { ascending: false }).limit(50);
            (subReqs ?? []).forEach((r: any) => { if (!baseMap.has(r.id)) baseMap.set(r.id, r); });
          }
        }

        setRequireNotifs(Array.from(baseMap.values()).map(toRequireNotif));
      } else { setRequireNotifs([]); }
    } catch (e) { console.error('[notif] require fetch error:', e); }

    // ── 3. Reminder Schedule ──
    try {
      if (isAdmin) {
        // Admin: request jadwal dari sales yang belum di-assign (assigned_to kosong)
        const { data } = await supabase
          .from('reminders')
          .select('id, project_name, category, due_date, status, assigned_to, notes, sales_name, sales_division, created_at')
          .eq('status', 'pending')
          .eq('assigned_to', '')
          .ilike('notes', '%[REQUEST SALES]%')
          .order('created_at', { ascending: false })
          .limit(20);
        setReminderNotifs((data ?? []).map((r: any) => ({
          id: r.id,
          type: 'reminder' as const,
          title: r.project_name,
          subtitle: `📩 Req. Sales · ${r.sales_name}${r.sales_division ? ' · ' + r.sales_division : ''} · ${r.due_date}`,
          time: r.created_at,
          url: '/reminder-schedule',
          internalUrl: '/reminder-schedule',
          menuTitle: 'Reminder Schedule',
        })));
      } else if (isPTS) {
        // Team PTS: jadwal aktif yang di-assign ke diri sendiri
        const { data } = await supabase
          .from('reminders')
          .select('id, project_name, category, due_date, status, assigned_to, created_at')
          .neq('status', 'done')
          .neq('status', 'cancelled')
          .eq('assigned_to', currentUser.username)
          .order('due_date', { ascending: true })
          .limit(20);
        setReminderNotifs((data ?? []).map((r: any) => ({
          id: r.id,
          type: 'reminder' as const,
          title: r.project_name,
          subtitle: `🗓️ ${r.category} · ${r.due_date}`,
          time: r.created_at,
          url: '/reminder-schedule',
          internalUrl: '/reminder-schedule',
          menuTitle: 'Reminder Schedule',
        })));
      } else { setReminderNotifs([]); }
    } catch (e) { console.error('[notif] reminder fetch error:', e); }

    // ── 4. Form Review ──
    try {
      if (isAdmin) {
        // Admin/superadmin: semua review yang belum di-grade
        const { data } = await supabase.from('form_reviews')
          .select('id, project_name, reminder_category, sales_name, assign_name, created_at, grade_product_knowledge, grade_product_knowledge_bast, grade_training_customer')
          .order('created_at', { ascending: false }).limit(50);
        const pending = (data ?? []).filter((r: any) =>
          !r.grade_product_knowledge && !r.grade_product_knowledge_bast && !r.grade_training_customer
        );
        setReviewNotifs(pending.map((r: any) => ({ id: r.id, type: 'require' as const, title: r.project_name, subtitle: `⭐ ${r.reminder_category} · ${r.sales_name}`, time: r.created_at, url: '/form-review', internalUrl: '/form-review', menuTitle: 'Form Review Demo & BAST' })));
      } else if (isTeamPTS && !isTeamServices) {
        // Team PTS: review yang di-assign ke mereka dan belum di-grade
        const { data } = await supabase.from('form_reviews').select('id, project_name, reminder_category, sales_name, created_at, grade_product_knowledge, grade_product_knowledge_bast, grade_training_customer').in('assign_name', namesToCheck).order('created_at', { ascending: false }).limit(30);
        const pending = (data ?? []).filter((r: any) =>
          !r.grade_product_knowledge && !r.grade_product_knowledge_bast && !r.grade_training_customer
        );
        setReviewNotifs(pending.map((r: any) => ({ id: r.id, type: 'require' as const, title: r.project_name, subtitle: `⭐ ${r.reminder_category} · ${r.sales_name}`, time: r.created_at, url: '/form-review', internalUrl: '/form-review', menuTitle: 'Form Review Demo & BAST' })));
      } else if (roleLC === 'guest' || roleLC === 'sales') {
        // Guest & Sales: review yang ditujukan untuk mereka (sales_name = full_name) dan belum di-grade
        const { data } = await supabase.from('form_reviews')
          .select('id, project_name, reminder_category, sales_name, created_at, grade_product_knowledge, grade_product_knowledge_bast, grade_training_customer')
          .eq('sales_name', currentUser.full_name)
          .order('created_at', { ascending: false }).limit(30);
        const pending = (data ?? []).filter((r: any) =>
          !r.grade_product_knowledge && !r.grade_product_knowledge_bast && !r.grade_training_customer
        );
        setReviewNotifs(pending.map((r: any) => ({ id: r.id, type: 'require' as const, title: r.project_name, subtitle: `⭐ ${r.reminder_category} · ${r.sales_name}`, time: r.created_at, url: '/form-review', internalUrl: '/form-review', menuTitle: 'Form Review Demo & BAST' })));
      } else { setReviewNotifs([]); }
    } catch (e) { console.error('[notif] review fetch error:', e); }
  }, [currentUser, isAdmin, roleLC, teamType]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 120_000); // setiap 2 menit
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    const ch1 = supabase.channel('dash-notif-tickets-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => { setTimeout(fetchAll, 400); }).subscribe();
    const ch2 = supabase.channel('dash-notif-requires-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'project_requests' }, () => { setTimeout(fetchAll, 400); }).subscribe();
    const ch3 = supabase.channel('dash-notif-reminders-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => { setTimeout(fetchAll, 400); }).subscribe();
    const ch4 = supabase.channel('dash-notif-reviews-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'form_reviews' }, () => { setTimeout(fetchAll, 400); }).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); supabase.removeChannel(ch4); };
  }, [fetchAll]);

  const handleClick = (item: NotificationItem) => {
    if (item.internalUrl) onNavigate(item.internalUrl, item.menuTitle);
  };

  const totalCount = ticketNotifs.length + requireNotifs.length + reminderNotifs.length + reviewNotifs.length;

  // Jika semua notif disembunyikan (misal Team PTS UMP/MLDS), tidak render apapun
  const hasAnyBell = (
    (!isTeamPTS_SubGroup && (isAdmin || roleLC === 'team' || roleLC === 'team_pts' || roleLC === 'guest' || roleLC === 'sales')) ||
    (!isTeamPTS_SubGroup && (isAdmin || isPTS)) ||
    (!isTeamPTS_SubGroup && (isAdmin || (isTeamPTS && !isTeamServices) || roleLC === 'guest' || roleLC === 'sales'))
  );
  if (!hasAnyBell) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
      {/* Total count badge — di depan (kiri) */}
      {totalCount > 0 ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg flex-shrink-0 mr-1"
          style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 1px 4px rgba(220,38,38,0.35)' }}>
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-white font-bold text-xs leading-none">{totalCount}</span>
        </div>
      ) : (
        <div className="flex items-center justify-center px-2 py-1 rounded-lg flex-shrink-0 mr-1"
          style={{ background: 'rgba(0,0,0,0.05)' }}>
          <svg className="w-4 h-4" style={{ color: '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
      )}
      {/* Separator */}
      <div className="w-px h-5 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.09)' }} />
      {/* Individual bells */}
      <div className="flex items-center gap-1">
        {/* Ticket */}
        {!isTeamPTS_SubGroup && (isAdmin || roleLC === 'team' || roleLC === 'team_pts' || roleLC === 'guest' || roleLC === 'sales') && (
          <NotifBell icon="🎫" label="Ticket" count={ticketNotifs.length} color="#be123c" bgColor="rgba(254,205,211,0.6)" borderColor="#fda4af" dotColor="#e11d48" items={ticketNotifs} onItemClick={handleClick} />
        )}
        {/* Require */}
        {!isTeamPTS_SubGroup && (isAdmin || roleLC === 'team' || roleLC === 'team_pts' || roleLC === 'guest' || roleLC === 'sales') && (
          <NotifBell icon="🏗️" label="Require" count={requireNotifs.length} color="#7e22ce" bgColor="rgba(233,213,255,0.6)" borderColor="#c4b5fd" dotColor="#9333ea" items={requireNotifs} onItemClick={handleClick} />
        )}
        {/* Reminder */}
        {!isTeamPTS_SubGroup && (isAdmin || isPTS) && (
          <NotifBell icon="🗓️" label="Reminder" count={reminderNotifs.length} color="#0e7490" bgColor="rgba(207,250,254,0.6)" borderColor="#67e8f9" dotColor="#0891b2" items={reminderNotifs} onItemClick={handleClick} />
        )}
        {/* Review */}
        {!isTeamPTS_SubGroup && (isAdmin || (isTeamPTS && !isTeamServices) || roleLC === 'guest' || roleLC === 'sales') && (
          <NotifBell icon="⭐" label="Review" count={reviewNotifs.length} color="#b45309" bgColor="rgba(254,243,199,0.6)" borderColor="#fcd34d" dotColor="#d97706" items={reviewNotifs} onItemClick={handleClick} />
        )}
      </div>
    </div>
  );
}

// ─── BrandPicSettingContent (reusable inline, no overlay) ────────────────────
export function BrandPicSettingContent() {
  const [brandUsers, setBrandUsers] = useState<{id:string;full_name:string;sales_division?:string}[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState<{type:'success'|'error';msg:string}|null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('id, full_name, sales_division').eq('role','guest').eq('team_type','Marketing').order('full_name'),
      supabase.from('brand_pic_mappings').select('*'),
    ]).then(([usersRes, mapsRes]) => {
      if (usersRes.data) setBrandUsers(usersRes.data as any[]);
      if (mapsRes.data) {
        const map: Record<string,string> = {};
        (mapsRes.data as BrandPicMappingDB[]).forEach(m => { if(m.pic_user_id) map[`${m.brand_type}:${m.brand_name}`] = m.pic_user_id; });
        setMappings(map);
      }
      setLoading(false);
    });
  }, []);

  const notify = (type:'success'|'error', msg:string) => { setNotif({type,msg}); setTimeout(()=>setNotif(null),3000); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allBrands = [
        ...DISPLAY_BRANDS_DB.map(b=>({brand_type:'display' as const,brand_name:b})),
        ...MIDDLEWARE_BRANDS_DB.map(b=>({brand_type:'middleware' as const,brand_name:b})),
      ];
      for (const {brand_type,brand_name} of allBrands) {
        const key = `${brand_type}:${brand_name}`;
        const picId = mappings[key] || null;
        const picUser = picId ? brandUsers.find(u=>u.id===picId) : null;
        await supabase.from('brand_pic_mappings').upsert(
          {brand_type,brand_name,pic_user_id:picId,pic_user_name:picUser?.full_name||null},
          {onConflict:'brand_type,brand_name'}
        );
      }
      notify('success','Mapping PIC Brand disimpan!');
    } catch(e:any) { notify('error',e.message); }
    setSaving(false);
  };

  const Row = ({type,brand}:{type:'display'|'middleware';brand:string}) => {
    const key = `${type}:${brand}`;
    return (
      <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
        <span className="w-36 text-sm font-semibold text-slate-700 flex-shrink-0">{brand}</span>
        <select value={mappings[key]||''} onChange={e=>setMappings(p=>({...p,[key]:e.target.value}))}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-amber-400 appearance-none">
          <option value="">— Belum ada PIC —</option>
          {brandUsers.map(u=><option key={u.id} value={u.id}>{u.full_name} ({u.sales_division})</option>)}
        </select>
        {mappings[key] && <span className="text-[10px] text-amber-600 font-bold flex-shrink-0">✅</span>}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {notif && (
        <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg text-sm font-semibold flex-shrink-0 ${notif.type==='success'?'bg-emerald-50 text-emerald-700 border border-emerald-200':'bg-red-50 text-red-700 border border-red-200'}`}>
          {notif.type==='success'?'✅':'❌'} {notif.msg}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 rounded-full border-2 border-t-amber-500 border-amber-200 animate-spin"/></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <p className="text-sm font-bold text-amber-700 uppercase tracking-widest mb-3">🖥️ Brand Display</p>
                <div className="bg-amber-50/50 rounded-xl border border-amber-200 px-4 py-1">
                  {DISPLAY_BRANDS_DB.map(b=><Row key={b} type="display" brand={b}/>)}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-violet-700 uppercase tracking-widest mb-3">🔌 Brand Middleware</p>
                <div className="bg-violet-50/50 rounded-xl border border-violet-200 px-4 py-1">
                  {MIDDLEWARE_BRANDS_DB.map(b=><Row key={b} type="middleware" brand={b}/>)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0">
        <button onClick={handleSave} disabled={saving||loading}
          className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
          style={{background:'linear-gradient(135deg,#d97706,#b45309)'}}>
          {saving?'⏳ Menyimpan...':'💾 Simpan Semua Mapping PIC Brand'}
        </button>
      </div>
    </div>
  );
}

// ─── AdminPanelModal (unified: Settings + User Management + PIC Brand) ───────

export function AdminPanelModal({ initialTab, onClose }: AdminPanelModalProps) {
  const [activeSection, setActiveSection] = useState<'settings' | 'userManagement' | 'picBrand' | 'kpiRoster'>(initialTab);

  const navItems: { key: 'settings' | 'userManagement' | 'picBrand' | 'kpiRoster'; label: string; icon: React.ReactElement; color: string; activeBg: string; activeBorder: string; activeText: string }[] = [
    {
      key: 'settings',
      label: 'Account Settings',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      color: '#4338ca', activeBg: 'rgba(99,102,241,0.1)', activeBorder: 'rgba(99,102,241,0.4)', activeText: '#4338ca',
    },
    {
      key: 'userManagement',
      label: 'User Management',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      color: '#0f766e', activeBg: 'rgba(13,148,136,0.1)', activeBorder: 'rgba(13,148,136,0.4)', activeText: '#0f766e',
    },
    {
      key: 'picBrand',
      label: 'PIC Brand',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
      color: '#b45309', activeBg: 'rgba(217,119,6,0.1)', activeBorder: 'rgba(217,119,6,0.4)', activeText: '#b45309',
    },
    {
      key: 'kpiRoster',
      label: 'KPI Roster',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
      color: '#0369a1', activeBg: 'rgba(3,105,161,0.1)', activeBorder: 'rgba(3,105,161,0.4)', activeText: '#0369a1',
    },
  ];

  const activeNav = navItems.find(n => n.key === activeSection)!;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm pt-16 px-4 pb-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex overflow-hidden border border-slate-200">

        {/* ── LEFT SIDEBAR ── */}
        <div className="w-56 flex-shrink-0 flex flex-col border-r border-slate-100" style={{ background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 100%)' }}>
          {/* Sidebar header */}
          <div className="px-5 py-5 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">Admin Panel</p>
                <p className="text-white/40 text-[10px]">Superadmin Settings</p>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <div className="flex-1 p-3 space-y-1">
            {navItems.map(item => {
              const isActive = activeSection === item.key;
              return (
                <button key={item.key} onClick={() => setActiveSection(item.key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-sm font-semibold"
                  style={isActive
                    ? { background: item.activeBg, border: `1px solid ${item.activeBorder}`, color: item.activeText }
                    : { background: 'transparent', border: '1px solid transparent', color: 'rgba(255,255,255,0.55)' }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                  <span className={isActive ? '' : 'opacity-60'}>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.color }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT CONTENT ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Section header strip */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: activeNav.activeBg, border: `1px solid ${activeNav.activeBorder}`, color: activeNav.activeText }}>
              {activeNav.icon}
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-slate-800 text-base leading-tight">{activeNav.label}</h2>
              <p className="text-slate-500 text-xs">
                {activeSection === 'settings' && 'Kelola akun user & hak akses menu'}
                {activeSection === 'userManagement' && 'Mapping Atasan, IVP Account & CC per User'}
                {activeSection === 'picBrand' && 'Mapping Brand PIC per divisi & produk'}
                {activeSection === 'kpiRoster' && 'Pilih anggota tim yang masuk dalam penilaian KPI'}
              </p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all text-slate-400 hover:text-slate-700"
              style={{ background: 'rgba(0,0,0,0.05)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#dc2626'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = ''; }}
              title="Tutup">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Embedded content — no backdrop/fixed positioning */}
          <div className="flex-1 overflow-hidden">
            {activeSection === 'settings' && <AccountSettingsInline />}
            {activeSection === 'userManagement' && <UserManagementInline />}
            {activeSection === 'picBrand' && <BrandPicSettingInline />}
            {activeSection === 'kpiRoster' && <KpiRosterInline />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline variants (no fixed overlay, used inside AdminPanelModal) ──────────

// ─── KpiRosterInline ─────────────────────────────────────────────────────────
export function KpiRosterInline() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // userId sedang disimpan
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [filterTeam, setFilterTeam] = useState<'all' | 'Team PTS' | 'Team PTS MLDS'>('all');

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id,full_name,jabatan,team_type,role,kpi_enabled')
      .eq('role', 'team')
      .in('team_type', ['Team PTS', 'Team PTS MLDS'])
      .order('team_type')
      .order('full_name');
    if (!error && data) setUsers(data as User[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleKpi = async (user: User) => {
    setSaving(user.id);
    const newVal = !(user.kpi_enabled ?? true);
    const { error } = await supabase
      .from('users')
      .update({ kpi_enabled: newVal })
      .eq('id', user.id);
    setSaving(null);
    if (error) { notify('error', 'Gagal menyimpan: ' + error.message); return; }
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, kpi_enabled: newVal } : u));
    notify('success', `${user.full_name} ${newVal ? 'diaktifkan' : 'dinonaktifkan'} dari roster KPI.`);
  };

  const filtered = users.filter(u => filterTeam === 'all' || u.team_type === filterTeam);
  const ivpUsers = filtered.filter(u => u.team_type === 'Team PTS');
  const mldsUsers = filtered.filter(u => u.team_type === 'Team PTS MLDS');
  const activeCount = users.filter(u => u.kpi_enabled !== false).length;

  const TeamSection = ({ members, label, color, bg, border }: {
    members: User[]; label: string; color: string; bg: string; border: string;
  }) => {
    if (!members.length) return null;
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
          <span className="text-xs text-slate-400 font-medium">
            ({members.filter(u => u.kpi_enabled !== false).length}/{members.length} aktif)
          </span>
        </div>
        <div className="space-y-2">
          {members.map(u => {
            const enabled = u.kpi_enabled !== false;
            const isSaving = saving === u.id;
            return (
              <div key={u.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all"
                style={{
                  background: enabled ? bg : '#f8fafc',
                  borderColor: enabled ? border : '#e2e8f0',
                }}>
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                  style={{ background: enabled ? color : '#94a3b8' }}>
                  {u.full_name.charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${enabled ? 'text-slate-800' : 'text-slate-400'}`}>
                    {u.full_name}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{u.jabatan ?? '—'}</p>
                </div>
                {/* Status badge */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                  enabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-400 border-slate-200'
                }`}>
                  {enabled ? '✅ KPI Aktif' : '⏸ Nonaktif'}
                </span>
                {/* Toggle button */}
                <button
                  onClick={() => toggleKpi(u)}
                  disabled={isSaving}
                  className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 focus:outline-none ${
                    enabled ? 'bg-sky-500' : 'bg-slate-300'
                  } ${isSaving ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:opacity-90'}`}
                  title={enabled ? 'Nonaktifkan dari KPI' : 'Aktifkan ke KPI'}>
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                    style={{ transform: enabled ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {notification && (
        <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 flex-shrink-0 ${
          notification.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {notification.type === 'success' ? '✅' : '❌'} {notification.msg}
        </div>
      )}

      {/* Header info */}
      <div className="px-5 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-sky-50 border border-sky-200 mb-4">
          <div className="text-2xl">🎯</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-sky-800">KPI Roster</p>
            <p className="text-xs text-sky-600">Hanya anggota yang <strong>diaktifkan</strong> di sini yang akan muncul & dinilai di Dashboard KPI (berlaku untuk IVP & MLDS).</p>
          </div>
          {!loading && (
            <div className="text-right flex-shrink-0">
              <p className="text-xl font-black text-sky-700">{activeCount}</p>
              <p className="text-[10px] text-sky-500">aktif dari {users.length}</p>
            </div>
          )}
        </div>

        {/* Filter tim */}
        <div className="flex gap-1.5">
          {(['all', 'Team PTS', 'Team PTS MLDS'] as const).map(t => (
            <button key={t}
              onClick={() => setFilterTeam(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                filterTeam === t
                  ? t === 'Team PTS'
                    ? 'bg-teal-600 text-white border-teal-600'
                    : t === 'Team PTS MLDS'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-sky-700 text-white border-sky-700'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}>
              {t === 'all' ? '🌐 Semua Tim' : t === 'Team PTS' ? '🟢 IVP' : '🔵 MLDS'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 rounded-full border-2 border-t-sky-600 border-sky-200 animate-spin" />
          </div>
        ) : (
          <>
            {(filterTeam === 'all' || filterTeam === 'Team PTS') && (
              <TeamSection
                members={ivpUsers}
                label="Team PTS IVP"
                color="#0d9488"
                bg="#f0fdfa"
                border="#99f6e4"
              />
            )}
            {(filterTeam === 'all' || filterTeam === 'Team PTS MLDS') && (
              <TeamSection
                members={mldsUsers}
                label="Team PTS MLDS"
                color="#2563eb"
                bg="#eff6ff"
                border="#bfdbfe"
              />
            )}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">Tidak ada anggota ditemukan.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function AccountSettingsInline() {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'pending'>('list');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editDivisi, setEditDivisi] = useState('');
  const [editPtsType, setEditPtsType] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newUser, setNewUser] = useState({
    username: '', password: '', full_name: '', role: 'guest', team_type: '', phone_number: '', sales_division: '', jabatan: '', allowed_menus: ALL_MENU_KEYS, divisi: '', pts_type: '',
  });
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [approvingUser, setApprovingUser] = useState<User | null>(null);
  const [approveMenus, setApproveMenus] = useState<string[]>(ALL_MENU_KEYS);

  const menuLabels: Record<string, { label: string; icon: string }> = {
    'dashboard': { label: 'Analytics Dashboard (KPI)', icon: '📊' },
    'form-bast': { label: 'Form Review Demo & BAST', icon: '⭐' },
    'request-design-project': { label: 'Request Design Project', icon: '🏗️' },
    'ticket-troubleshooting': { label: 'Ticket Troubleshooting', icon: '🎫' },
    'daily-report': { label: 'Daily Report', icon: '📈' },
    'database-pts': { label: 'Database PTS', icon: '💼' },
    'unit-movement': { label: 'Unit Movement Log', icon: '🚚' },
    'reminder-schedule': { label: 'Reminder Schedule', icon: '🗓️' },
    'picket-showroom': { label: 'Piket Showroom', icon: '🏪' },
    'learning-center': { label: 'Learning Center', icon: '🎓' },
    'tech-note': { label: 'Tech Note R&D', icon: '📝' },
  };

  const notify = (type: 'success' | 'error', msg: string) => { setNotification({ type, msg }); setTimeout(() => setNotification(null), 3000); };
  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase.from('users').select('*').order('full_name');
    if (!error && data) {
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
    if (sd === 'PTS IVP') { role = 'team'; team_type = 'Team PTS'; }
    else if (sd === 'PTS UMP') { role = 'team'; team_type = 'Team PTS UMP'; }
    else if (sd === 'PTS MLDS') { role = 'team'; team_type = 'Team PTS MLDS'; }
    else if (sd.startsWith('Marketing:')) { role = 'guest'; team_type = 'Marketing'; sales_division = sd.replace('Marketing:', '') || null; }
    else { role = 'guest'; team_type = 'Guest'; sales_division = sd || null; }
    const { error } = await supabase.from('users').update({ role, team_type, sales_division, allowed_menus: approveMenus }).eq('id', approvingUser.id);
    setSaving(false);
    if (error) { notify('error', 'Gagal approve: ' + error.message); return; }
    notify('success', `Akun ${approvingUser.full_name} berhasil disetujui!`);
    setApprovingUser(null); setApproveMenus(ALL_MENU_KEYS); fetchUsers();
  };

  const handleRejectUser = async (userId: string, name: string) => {
    if (!confirm(`Tolak & hapus pendaftaran "${name}"?`)) return;
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) { notify('error', 'Gagal menolak.'); return; }
    notify('success', `Pendaftaran ${name} ditolak.`); fetchUsers();
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.full_name) { notify('error', 'Semua field wajib diisi!'); return; }
    if (!newUser.divisi) { notify('error', 'Divisi wajib dipilih!'); return; }
    if (newUser.divisi === 'PTS' && !newUser.pts_type) { notify('error', 'Tipe PTS wajib dipilih!'); return; }
    if (newUser.divisi === 'Sales' && !newUser.sales_division) { notify('error', 'Sales Division wajib diisi!'); return; }

    let role = 'guest';
    let team_type: string | null = null;
    if (newUser.divisi === 'PTS') {
      role = 'team';
      if (newUser.pts_type === 'PTS IVP') team_type = 'Team PTS';
      else if (newUser.pts_type === 'PTS UMP') team_type = 'Team PTS UMP';
      else if (newUser.pts_type === 'PTS MLDS') team_type = 'Team PTS MLDS';
    } else if (newUser.divisi === 'Sales') {
      role = 'guest'; team_type = 'Guest';
    } else if (newUser.divisi === 'Marketing') {
      role = 'guest'; team_type = 'Marketing';
    }

    setSaving(true);
    const insertPayload: Record<string, unknown> = { username: newUser.username, password: newUser.password, full_name: newUser.full_name, role, team_type, allowed_menus: newUser.allowed_menus, jabatan: newUser.jabatan || null, phone_number: newUser.phone_number || null, sales_division: (newUser.divisi === 'Sales' || newUser.divisi === 'Marketing') ? (newUser.sales_division || null) : null };
    const { error } = await supabase.from('users').insert([insertPayload]);
    setSaving(false);
    if (error) { notify('error', 'Gagal menambah akun: ' + error.message); return; }
    notify('success', 'Akun berhasil ditambahkan!');
    setNewUser({ username: '', password: '', full_name: '', role: 'guest', team_type: '', phone_number: '', sales_division: '', jabatan: '', allowed_menus: ALL_MENU_KEYS, divisi: '', pts_type: '' });
    setActiveTab('list'); fetchUsers();
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    let role = editingUser.role;
    let team_type: string | null = editingUser.team_type ?? null;
    if (editDivisi) {
      if (editDivisi === 'PTS') {
        role = 'team';
        if (editPtsType === 'PTS IVP') team_type = 'Team PTS';
        else if (editPtsType === 'PTS UMP') team_type = 'Team PTS UMP';
        else if (editPtsType === 'PTS MLDS') team_type = 'Team PTS MLDS';
        else team_type = null;
      } else if (editDivisi === 'Sales') { role = 'guest'; team_type = 'Guest'; }
      else if (editDivisi === 'Marketing') { role = 'guest'; team_type = 'Marketing'; }
    }
    const updatePayload: Record<string, unknown> = { username: editingUser.username, password: editingUser.password, full_name: editingUser.full_name, role, team_type, allowed_menus: editingUser.allowed_menus ?? ALL_MENU_KEYS, jabatan: editingUser.jabatan ?? null, phone_number: editingUser.phone_number ?? null, sales_division: (editDivisi === 'Sales' || editDivisi === 'Marketing') ? (editingUser.sales_division ?? null) : null };
    const { error } = await supabase.from('users').update(updatePayload).eq('id', editingUser.id);
    setSaving(false);
    if (error) { notify('error', 'Gagal menyimpan: ' + error.message); return; }
    notify('success', 'Akun berhasil diperbarui!');
    setEditingUser(null); setEditDivisi(''); setEditPtsType(''); fetchUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Hapus akun ini?')) return;
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) { notify('error', 'Gagal menghapus akun.'); return; }
    notify('success', 'Akun dihapus.'); fetchUsers();
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
                  {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
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
    <div className="h-full flex flex-col overflow-hidden">
      {notification && (
        <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 flex-shrink-0 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {notification.type === 'success' ? '✅' : '❌'} {notification.msg}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 px-5 pt-3 flex-shrink-0">
        <button onClick={() => { setActiveTab('list'); setEditingUser(null); setEditDivisi(''); setEditPtsType(''); }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all mr-1 ${activeTab === 'list' ? 'border-rose-500 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          👥 Daftar Akun ({users.length})
        </button>
        <button onClick={() => { setActiveTab('add'); setEditingUser(null); setEditDivisi(''); setEditPtsType(''); }}
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
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama, username, atau role..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all" />
            </div>

            {loadingUsers ? (
              <div className="flex items-center justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-rose-600 border-rose-200 animate-spin" /></div>
            ) : editingUser ? (
              <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-800">✏️ Edit: {editingUser.full_name}</h3>
                  <button onClick={() => { setEditingUser(null); setEditDivisi(''); setEditPtsType(''); }} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                </div>
                <div className="grid grid-cols-3 gap-3">
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
                    <select value={editDivisi} onChange={e => { setEditDivisi(e.target.value); setEditPtsType(''); }}
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
                      <select value={editPtsType} onChange={e => setEditPtsType(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                        <option value="">-- Pilih Tipe PTS --</option>
                        <option value="PTS IVP">PTS IVP → Team PTS</option>
                        <option value="PTS UMP">PTS UMP → Team PTS UMP</option>
                        <option value="PTS MLDS">PTS MLDS → Team PTS MLDS</option>
                      </select>
                    </div>
                  )}
                  {(editDivisi === 'Sales' || editDivisi === 'Marketing') && (
                    <div className="col-span-3">
                      <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Sales Division</label>
                      <select value={editingUser.sales_division || ''} onChange={e => setEditingUser({ ...editingUser, sales_division: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                        <option value="">-- Pilih Divisi Sales --</option>{SALES_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Jabatan</label>
                    <select value={editingUser.jabatan || ''} onChange={e => setEditingUser({ ...editingUser, jabatan: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                      <option value="">— Pilih Jabatan —</option>{JABATAN_LIST.map(j => <option key={j} value={j}>{JABATAN_CONFIG[j].icon} {j}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">📱 No. Telepon / WA</label>
                    <input value={editingUser.phone_number || ''} onChange={e => setEditingUser({ ...editingUser, phone_number: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" placeholder="Contoh: 08123456789" />
                  </div>
                  <div className="col-span-3">
                    <MenuPermissionSelector selected={editingUser.allowed_menus ?? ALL_MENU_KEYS} target="edit" />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={handleSaveEdit} disabled={saving} className="flex-1 bg-gradient-to-r from-rose-600 to-rose-700 text-white py-2.5 rounded-lg font-semibold hover:from-rose-700 hover:to-rose-800 transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                    {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    💾 Simpan Perubahan
                  </button>
                  <button onClick={() => { setEditingUser(null); setEditDivisi(''); setEditPtsType(''); }} className="px-6 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 text-sm transition-all">Batal</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.length === 0 ? (
                  <div className="col-span-2 text-center py-10 text-slate-400 text-sm">Tidak ada akun ditemukan</div>
                ) : (() => {
                  const getDivLabel = (u: typeof users[0]) => {
                    if (u.role === 'superadmin' || u.role === 'admin') return '⚙️ Admin / Superadmin';
                    if (u.role === 'team') return `👥 ${u.team_type ?? 'Team PTS'}`;
                    if (u.sales_division) return `🏢 ${u.sales_division}`;
                    if (u.team_type === 'Marketing') return '📣 Marketing';
                    return '👤 Lainnya';
                  };
                  const getSubLabel = (u: typeof users[0]) => u.team_type ?? u.role ?? '';
                  const grouped: Record<string, Record<string, typeof users>> = {};
                  filteredUsers.forEach(u => {
                    const div = getDivLabel(u);
                    const sub = getSubLabel(u);
                    if (!grouped[div]) grouped[div] = {};
                    if (!grouped[div][sub]) grouped[div][sub] = [];
                    grouped[div][sub].push(u);
                  });
                  const divOrder = ['⚙️ Admin / Superadmin', '👥 Team PTS', '👥 Team PTS UMP', '👥 Team PTS MLDS'];
                  const sortedDivs = [
                    ...divOrder.filter(d => grouped[d]),
                    ...Object.keys(grouped).filter(d => !divOrder.includes(d)).sort(),
                  ];
                  const divColors: Record<string, { hdr: string; dot: string }> = {
                    '⚙️ Admin / Superadmin': { hdr: 'bg-slate-100 border-slate-300 text-slate-700', dot: '#64748b' },
                    '👥 Team PTS':           { hdr: 'bg-rose-50 border-rose-200 text-rose-700',       dot: '#be123c' },
                    '👥 Team PTS UMP':       { hdr: 'bg-orange-50 border-orange-200 text-orange-700', dot: '#c2410c' },
                    '👥 Team PTS MLDS':      { hdr: 'bg-amber-50 border-amber-200 text-amber-700',    dot: '#b45309' },
                    '📣 Marketing':          { hdr: 'bg-cyan-50 border-cyan-200 text-cyan-700',       dot: '#0891b2' },
                    '👤 Lainnya':            { hdr: 'bg-slate-50 border-slate-200 text-slate-600',    dot: '#94a3b8' },
                  };
                  return sortedDivs.map(divLabel => {
                    const subGroups = grouped[divLabel];
                    const clr = divColors[divLabel] ?? { hdr: 'bg-violet-50 border-violet-200 text-violet-700', dot: '#7c3aed' };
                    const totalInDiv = Object.values(subGroups).flat().length;
                    return (
                      <div key={divLabel} className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                        <div className={`flex items-center justify-between px-4 py-2 border-b ${clr.hdr}`}>
                          <span className="text-xs font-black tracking-widest uppercase">{divLabel}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/70">{totalInDiv} akun</span>
                        </div>
                        {Object.entries(subGroups).map(([subLabel, subUsers]) => (
                          <div key={subLabel}>
                            {Object.keys(subGroups).length > 1 && (
                              <div className="px-4 py-1.5 flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.025)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: clr.dot }} />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{subLabel}</span>
                                <span className="text-[10px] text-slate-400 ml-auto">{subUsers.length}</span>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-0">
                              {subUsers.map((user, idx) => (
                                <div key={user.id} className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50 transition-all border-b border-slate-100"
                                  style={{ borderRight: idx % 2 === 0 ? '1px solid #f1f5f9' : 'none' }}>
                                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #fde68a, #f59e0b)', color: '#78350f' }}>
                                    {user.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-sm truncate">{user.full_name}</p>
                                    <p className="text-xs text-slate-500">@{user.username}</p>
                                    {user.phone_number && (
                                      <p className="text-[10px] text-emerald-600 mt-0.5">📱 {user.phone_number}</p>
                                    )}
                                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                      <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase bg-slate-200 text-slate-600">{user.role}</span>
                                      {user.jabatan && <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">🏷️ {user.jabatan}</span>}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-1 flex-shrink-0">
                                    <button onClick={() => {
                                      let d = '', p = '';
                                      if (user.role === 'team') { d = 'PTS'; if (user.team_type === 'Team PTS') p = 'PTS IVP'; else if (user.team_type === 'Team PTS UMP') p = 'PTS UMP'; else if (user.team_type === 'Team PTS MLDS') p = 'PTS MLDS'; }
                                      else if (user.team_type === 'Guest') { d = 'Sales'; }
                                      else if (user.team_type === 'Marketing') { d = 'Marketing'; }
                                      setEditDivisi(d); setEditPtsType(p); setEditingUser(user);
                                    }} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all">Edit</button>
                                    <button onClick={() => handleDeleteUser(user.id)} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all">Hapus</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </>
        )}

        {activeTab === 'add' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
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
                <select value={newUser.divisi} onChange={e => setNewUser({ ...newUser, divisi: e.target.value, pts_type: '', sales_division: '' })}
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
                  <select value={newUser.pts_type} onChange={e => setNewUser({ ...newUser, pts_type: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                    <option value="">-- Pilih Tipe PTS --</option>
                    <option value="PTS IVP">PTS IVP → Team PTS</option>
                    <option value="PTS UMP">PTS UMP → Team PTS UMP</option>
                    <option value="PTS MLDS">PTS MLDS → Team PTS MLDS</option>
                  </select>
                </div>
              )}
              {(newUser.divisi === 'Sales' || newUser.divisi === 'Marketing') && (
                <div className="col-span-3">
                  <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Sales Division *</label>
                  <select value={newUser.sales_division} onChange={e => setNewUser({ ...newUser, sales_division: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                    <option value="">-- Pilih Sales Division --</option>{SALES_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Jabatan</label>
                <select value={newUser.jabatan} onChange={e => setNewUser({ ...newUser, jabatan: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
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
                  <button onClick={() => { setApprovingUser(null); setApproveMenus(ALL_MENU_KEYS); }} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm bg-white p-3 rounded-lg border border-slate-200">
                  <div><span className="text-xs text-slate-500 uppercase font-bold">Nama</span><p className="font-semibold text-slate-800">{approvingUser.full_name}</p></div>
                  <div><span className="text-xs text-slate-500 uppercase font-bold">Username</span><p className="font-semibold text-slate-800">@{approvingUser.username}</p></div>
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
                            {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
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
                {pendingUsers.map(user => (
                  <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 bg-amber-200 text-amber-800">
                      {user.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{user.full_name}</p>
                      <p className="text-xs text-slate-500">@{user.username}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-200 text-amber-800">
                          {user.sales_division?.startsWith('PTS') ? `PTS • ${user.sales_division}` : user.sales_division?.startsWith('Marketing:') ? `Marketing • ${user.sales_division.replace('Marketing:', '')}` : `Sales • ${user.sales_division}`}
                        </span>
                        {user.jabatan && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">{user.jabatan}</span>}
                        {user.phone_number && <span className="text-[9px] text-slate-500">📱 {user.phone_number}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button onClick={() => { setApprovingUser(user); setApproveMenus(ALL_MENU_KEYS); }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all">Review</button>
                      <button onClick={() => handleRejectUser(user.id, user.full_name)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all">Tolak</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function UserManagementInline() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [divSupMaps, setDivSupMaps] = useState<{ id: string; sales_division: string; supervisor_id: string }[]>([]);
  const [divIvpMaps, setDivIvpMaps] = useState<{ id: string; sales_division: string; ivp_id: string }[]>([]);
  const [userSupMaps, setUserSupMaps] = useState<{ id: string; user_id: string; supervisor_id: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'atasan' | 'ivp' | 'user_cc'>('atasan');
  const [atasanDiv, setAtasanDiv] = useState('');
  const [atasanSupId, setAtasanSupId] = useState('');
  const [ivpDiv, setIvpDiv] = useState('');
  const [ivpUserId, setIvpUserId] = useState('');
  const [selectedCCUserId, setSelectedCCUserId] = useState('');
  const [ccChecked, setCcChecked] = useState<Set<string>>(new Set());
  const [ccSaving, setCcSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const notify = (type: 'success' | 'error' | 'info', msg: string) => { setNotification({ type, msg }); setTimeout(() => setNotification(null), 3500); };
  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoadingData(true);
    const [usersRes, divSupRes, divIvpRes, userSupRes] = await Promise.all([
      supabase.from('users').select('id, username, full_name, role, team_type, sales_division, phone_number, jabatan').order('full_name'),
      supabase.from('division_supervisor_mappings').select('*').order('sales_division'),
      supabase.from('division_ivp_mappings').select('*').order('sales_division'),
      supabase.from('user_supervisor_mappings').select('*'),
    ]);
    if (usersRes.data) setAllUsers(usersRes.data);
    if (divSupRes.data) setDivSupMaps(divSupRes.data);
    if (divIvpRes.data) setDivIvpMaps(divIvpRes.data);
    if (userSupRes.data) setUserSupMaps(userSupRes.data);
    setLoadingData(false);
  };

  const getUserById = (id: string) => allUsers.find(u => u.id === id);
  const ATASAN_JABATAN: JabatanType[] = ['Supervisor', 'Manager', 'Deputy General Manager', 'General Manager', 'Direktur'];
  const supervisorCandidates = allUsers.filter(u => u.role?.toLowerCase() === 'guest' && u.jabatan && ATASAN_JABATAN.includes(u.jabatan as JabatanType));
  const ivpUsers = allUsers.filter(u => u.role?.toLowerCase() === 'guest' && u.sales_division === 'IVP');
  const mviUsers = allUsers.filter(u => u.role?.toLowerCase() === 'guest' && u.sales_division === 'MVI');
  const salesHandleUsers = [...ivpUsers, ...mviUsers];
  const nonIvpDivisions = SALES_DIVISIONS.filter(d => d !== 'IVP' && d !== 'MVI');
  const ccEligibleUsers = allUsers.filter(u => u.role?.toLowerCase() === 'guest' && u.jabatan && u.sales_division && u.sales_division !== 'IVP' && u.sales_division !== 'MVI').sort((a, b) => (JABATAN_CONFIG[a.jabatan as JabatanType]?.tier ?? 0) - (JABATAN_CONFIG[b.jabatan as JabatanType]?.tier ?? 0));

  useEffect(() => {
    if (!selectedCCUserId) { setCcChecked(new Set()); return; }
    const existing = userSupMaps.filter(m => m.user_id === selectedCCUserId).map(m => m.supervisor_id);
    setCcChecked(new Set(existing));
  }, [selectedCCUserId, userSupMaps]);

  const getAutoSuggestedCC = (userId: string): string[] => {
    const user = getUserById(userId);
    if (!user?.jabatan || !user.sales_division) return [];
    const ccJabatan = JABATAN_CC_RULES[user.jabatan as JabatanType] ?? [];
    const supIds = divSupMaps.filter(m => m.sales_division === user.sales_division).map(m => m.supervisor_id);
    return allUsers.filter(u => supIds.includes(u.id) && u.jabatan && ccJabatan.includes(u.jabatan as JabatanType)).map(u => u.id);
  };

  const handleSaveUserCC = async () => {
    if (!selectedCCUserId) return;
    setCcSaving(true);
    try {
      await supabase.from('user_supervisor_mappings').delete().eq('user_id', selectedCCUserId);
      const toInsert = Array.from(ccChecked).map(supId => ({ user_id: selectedCCUserId, supervisor_id: supId }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('user_supervisor_mappings').insert(toInsert);
        if (error) { notify('error', 'Gagal: ' + error.message); setCcSaving(false); return; }
      }
      notify('success', 'CC mapping disimpan!'); await fetchAll();
    } catch (e: any) { notify('error', e.message); }
    setCcSaving(false);
  };

  const handleAddAtasan = async () => {
    if (!atasanDiv || !atasanSupId) { notify('error', 'Pilih divisi dan atasan.'); return; }
    const existing = divSupMaps.find(m => m.sales_division === atasanDiv && m.supervisor_id === atasanSupId);
    if (existing) { notify('info', 'Mapping ini sudah ada.'); return; }
    setSaving(true);
    const { error } = await supabase.from('division_supervisor_mappings').insert([{ sales_division: atasanDiv, supervisor_id: atasanSupId }]);
    if (error) notify('error', 'Gagal: ' + error.message);
    else { notify('success', 'Mapping atasan ditambahkan!'); setAtasanDiv(''); setAtasanSupId(''); await fetchAll(); }
    setSaving(false);
  };

  const handleDeleteAtasan = async (id: string) => {
    if (!confirm('Hapus mapping atasan ini?')) return;
    await supabase.from('division_supervisor_mappings').delete().eq('id', id);
    notify('success', 'Dihapus.'); await fetchAll();
  };

  const handleAddIvp = async () => {
    if (!ivpDiv || !ivpUserId) { notify('error', 'Pilih divisi dan IVP Account.'); return; }
    const existing = divIvpMaps.find(m => m.sales_division === ivpDiv && m.ivp_id === ivpUserId);
    if (existing) { notify('info', 'Mapping ini sudah ada.'); return; }
    setSaving(true);
    const { error } = await supabase.from('division_ivp_mappings').insert([{ sales_division: ivpDiv, ivp_id: ivpUserId }]);
    if (error) notify('error', 'Gagal: ' + error.message);
    else { notify('success', 'IVP mapping ditambahkan!'); setIvpDiv(''); setIvpUserId(''); await fetchAll(); }
    setSaving(false);
  };

  const handleDeleteIvp = async (id: string) => {
    if (!confirm('Hapus mapping IVP ini?')) return;
    await supabase.from('division_ivp_mappings').delete().eq('id', id);
    notify('success', 'Dihapus.'); await fetchAll();
  };

  const jabatanBadge = (u: User | undefined) => {
    if (!u?.jabatan) return null;
    const cfg = JABATAN_CONFIG[u.jabatan as JabatanType];
    if (!cfg) return null;
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>{cfg.icon} {u.jabatan}</span>;
  };

  const atasanByDiv: Record<string, typeof divSupMaps> = {};
  divSupMaps.forEach(m => { if (!atasanByDiv[m.sales_division]) atasanByDiv[m.sales_division] = []; atasanByDiv[m.sales_division].push(m); });
  const ivpByDiv: Record<string, typeof divIvpMaps> = {};
  divIvpMaps.forEach(m => { if (!ivpByDiv[m.sales_division]) ivpByDiv[m.sales_division] = []; ivpByDiv[m.sales_division].push(m); });

  // Group IVP/MVI mappings by person (ivp_id) — each person shows all divisions they handle
  const ivpByUser: Record<string, { user: User | undefined; group: 'IVP' | 'MVI'; maps: typeof divIvpMaps }> = {};
  divIvpMaps.forEach(m => {
    if (!ivpByUser[m.ivp_id]) {
      const u = getUserById(m.ivp_id);
      const group: 'IVP' | 'MVI' = u?.sales_division === 'MVI' ? 'MVI' : 'IVP';
      ivpByUser[m.ivp_id] = { user: u, group, maps: [] };
    }
    ivpByUser[m.ivp_id].maps.push(m);
  });

  const selectedUserObj = selectedCCUserId ? getUserById(selectedCCUserId) : null;
  const selectedJabatan = selectedUserObj?.jabatan as JabatanType | undefined;
  const autoSuggested = selectedCCUserId ? getAutoSuggestedCC(selectedCCUserId) : [];
  const potentialCCTargets = selectedUserObj ? allUsers.filter(u => {
    if (u.id === selectedCCUserId) return false;
    if (!u.jabatan) return false;
    const targetTier = JABATAN_CONFIG[u.jabatan as JabatanType]?.tier ?? 0;
    const selfTier = JABATAN_CONFIG[selectedJabatan as JabatanType]?.tier ?? 0;
    return targetTier > selfTier;
  }).sort((a, b) => (JABATAN_CONFIG[b.jabatan as JabatanType]?.tier ?? 0) - (JABATAN_CONFIG[a.jabatan as JabatanType]?.tier ?? 0)) : [];

  // Search filter for atasan/ivp tabs
  const filteredAtasanByDiv = Object.entries(atasanByDiv).filter(([div]) => !searchQuery || div.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredIvpByUser = Object.entries(ivpByUser).filter(([, { user }]) => !searchQuery || user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {notification && (
        <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 flex-shrink-0 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
          {notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : 'ℹ️'} {notification.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-5 pt-3 gap-1 flex-shrink-0 flex-wrap">
        <button onClick={() => setActiveTab('atasan')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'atasan' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          👨‍💼 Mapping Atasan ({Object.keys(atasanByDiv).length} divisi)
        </button>
        <button onClick={() => setActiveTab('ivp')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'ivp' ? 'border-violet-500 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          🔗 IVP Account ({Object.keys(ivpByUser).length} orang)
        </button>
        <button onClick={() => setActiveTab('user_cc')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'user_cc' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          🏷️ CC per User ({userSupMaps.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
        {loadingData ? (
          <div className="flex items-center justify-center py-16"><div className="w-6 h-6 rounded-full border-2 border-t-teal-600 border-teal-200 animate-spin" /></div>
        ) : (
          <>
            {/* Search bar for atasan & ivp tabs */}
            {(activeTab === 'atasan' || activeTab === 'ivp') && (
              <div className="px-5 pt-4 flex-shrink-0">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder={activeTab === 'ivp' ? 'Cari nama sales (IVP / MVI)...' : 'Cari divisi...'}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all" />
                </div>
              </div>
            )}

            {activeTab === 'atasan' && (
              <div className="p-5 space-y-5">
                {/* Add form */}
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
                  <p className="text-xs font-bold text-amber-700 mb-3">➕ Tambah Mapping Atasan</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Divisi Sales</label>
                      <select value={atasanDiv} onChange={e => setAtasanDiv(e.target.value)} className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white">
                        <option value="">-- Pilih Divisi --</option>{nonIvpDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Atasan</label>
                      <select value={atasanSupId} onChange={e => setAtasanSupId(e.target.value)} className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white">
                        <option value="">-- Pilih Atasan --</option>{supervisorCandidates.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.jabatan})</option>)}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button onClick={handleAddAtasan} disabled={saving} className="w-full py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition-all">
                        {saving ? '...' : '➕ Tambah'}
                      </button>
                    </div>
                  </div>
                </div>
                {/* List */}
                <div className="grid grid-cols-2 gap-3">
                  {filteredAtasanByDiv.map(([div, maps]) => (
                    <div key={div} className="rounded-xl border border-amber-200 overflow-hidden">
                      <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                        <span className="font-bold text-amber-800 text-xs">📁 {div}</span>
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{maps.length}</span>
                      </div>
                      <div className="divide-y divide-amber-50">
                        {maps.map(m => {
                          const u = getUserById(m.supervisor_id);
                          return (
                            <div key={m.id} className="px-3 py-2 flex items-center gap-2 bg-white hover:bg-amber-50/40 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 text-xs truncate">{u?.full_name ?? '—'}</p>
                                <div className="mt-0.5">{jabatanBadge(u as User)}</div>
                              </div>
                              <button onClick={() => handleDeleteAtasan(m.id)} className="text-red-400 hover:text-red-600 flex-shrink-0 p-1 rounded hover:bg-red-50 transition-all" title="Hapus">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'ivp' && (
              <div className="p-5 space-y-5">
                {/* Add form */}
                <div className="p-4 rounded-xl border border-violet-200 bg-violet-50">
                  <p className="text-xs font-bold text-violet-700 mb-3">➕ Tambah Sales Handle (IVP / MVI) ke Divisi</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Divisi Sales</label>
                      <select value={ivpDiv} onChange={e => setIvpDiv(e.target.value)} className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-200 bg-white">
                        <option value="">-- Pilih Divisi --</option>{nonIvpDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Sales Account (IVP / MVI)</label>
                      <select value={ivpUserId} onChange={e => setIvpUserId(e.target.value)} className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-200 bg-white">
                        <option value="">-- Pilih Account --</option>
                        {ivpUsers.length > 0 && (
                          <optgroup label="── IVP ──">
                            {ivpUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                          </optgroup>
                        )}
                        {mviUsers.length > 0 && (
                          <optgroup label="── MVI ──">
                            {mviUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button onClick={handleAddIvp} disabled={saving} className="w-full py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-50 transition-all">
                        {saving ? '...' : '➕ Tambah'}
                      </button>
                    </div>
                  </div>
                </div>
                {/* List — grouped by person */}
                <div className="grid grid-cols-2 gap-3">
                  {filteredIvpByUser.map(([userId, { user, group, maps }]) => (
                    <div key={userId} className="rounded-xl border border-violet-200 overflow-hidden">
                      {/* Card header — person name */}
                      <div className="px-3 py-2 bg-violet-50 border-b border-violet-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-violet-900 text-xs truncate">{user?.full_name ?? '—'}</span>
                          <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${group === 'MVI' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-violet-100 text-violet-700 border-violet-200'}`}>{group}</span>
                        </div>
                        <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full flex-shrink-0">{maps.length}</span>
                      </div>
                      {/* Phone number row */}
                      <div className="px-3 py-1 bg-violet-50/60 border-b border-violet-100">
                        {user?.phone_number
                          ? <p className="text-[10px] text-emerald-600">📱 {user.phone_number}</p>
                          : <p className="text-[10px] text-rose-400">⚠️ No WA</p>}
                      </div>
                      {/* Division chips */}
                      <div className="px-3 py-2 flex flex-wrap gap-1.5 bg-white">
                        {maps.map(m => (
                          <div key={m.id} className="flex items-center gap-1 bg-violet-50 border border-violet-200 rounded-lg px-2 py-0.5 group">
                            <span className="text-[10px] font-semibold text-violet-800">{m.sales_division}</span>
                            <button onClick={() => handleDeleteIvp(m.id)} className="text-violet-300 hover:text-red-500 transition-colors ml-0.5" title={`Hapus ${m.sales_division}`}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'user_cc' && (
              <div className="p-5 space-y-4">
                {/* Search user */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama user..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  {/* Left: user list */}
                  <div>
                    <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-widest">Pilih User</p>
                    <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                      {ccEligibleUsers.filter(u => !searchQuery || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())).map(u => {
                        const cfg = u.jabatan ? JABATAN_CONFIG[u.jabatan as JabatanType] : null;
                        const isSelected = selectedCCUserId === u.id;
                        return (
                          <button key={u.id} onClick={() => setSelectedCCUserId(u.id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all"
                            style={isSelected ? { background: 'rgba(13,148,136,0.1)', borderColor: 'rgba(13,148,136,0.4)' } : { background: '#f8fafc', borderColor: '#e2e8f0' }}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                              style={{ background: cfg?.bg ?? '#f1f5f9', border: `1.5px solid ${cfg?.border ?? '#e2e8f0'}` }}>
                              {cfg?.icon ?? '👤'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 text-xs truncate">{u.full_name}</p>
                              <p className="text-[10px] text-slate-500">{u.jabatan} · {u.sales_division}</p>
                            </div>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Right: CC targets */}
                  <div>
                    {selectedUserObj ? (
                      <>
                        <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-widest">CC Targets untuk {selectedUserObj.full_name}</p>
                        {autoSuggested.length > 0 && (
                          <button onClick={() => setCcChecked(new Set(autoSuggested))}
                            className="mb-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 transition-all">
                            ✨ Auto-suggest ({autoSuggested.length})
                          </button>
                        )}
                        <div className="space-y-1 max-h-64 overflow-y-auto pr-1 mb-3">
                          {potentialCCTargets.map(target => {
                            const cfg = target.jabatan ? JABATAN_CONFIG[target.jabatan as JabatanType] : null;
                            const isChecked = ccChecked.has(target.id);
                            return (
                              <button key={target.id} onClick={() => setCcChecked(prev => { const next = new Set(prev); isChecked ? next.delete(target.id) : next.add(target.id); return next; })}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-left"
                                style={isChecked ? { background: 'rgba(13,148,136,0.08)', borderColor: 'rgba(13,148,136,0.35)' } : { background: '#f8fafc', borderColor: '#e2e8f0' }}>
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isChecked ? 'border-teal-500 bg-teal-500' : 'border-slate-300 bg-white'}`}>
                                  {isChecked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-slate-800 text-xs truncate">{target.full_name}</p>
                                  <p className="text-[10px]" style={{ color: cfg?.color ?? '#64748b' }}>{cfg?.icon} {target.jabatan}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <button onClick={handleSaveUserCC} disabled={ccSaving}
                          className="w-full py-2.5 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                          {ccSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                          💾 Simpan CC Mapping
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">← Pilih user untuk setting CC</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function BrandPicSettingInline() {
  // Re-export BrandPicSettingModal content without the fixed-overlay wrapper
  return <BrandPicSettingContent />;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
