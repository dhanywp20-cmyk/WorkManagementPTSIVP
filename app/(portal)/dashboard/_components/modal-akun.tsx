'use client';
import { adminCreateUser, adminSetAccessLevel, adminUpdateUser } from '@/lib/admin-users';
import { logAudit } from '@/lib/audit';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

import { createNotification } from '@/lib/notifications';

import { ConfirmDialog, type ConfirmState, Username } from '@/components/shared';
import { labelKelompokPTS, teamTypeDariLabelPTS, useKelompokPTS } from '@/lib/kelompok';
import { useDivisiSales } from '@/lib/merek';
import { ALL_MENU_KEYS, DEFAULT_MENU_KEYS, SALES_MENU_KEYS, User } from './shared';

import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { FormEditAkunInline } from './akun/FormEditAkunInline';
import { TabAkunTertunda } from './akun/TabAkunTertunda';
import { TabTambahAkun } from './akun/TabTambahAkun';
import { pesanSebar, propagateUserRename, sendWelcomeWA } from './modal-bersama';

/**
 * Minor (docs/UX-WORKFLOW-AUDIT.md): kolom Role dulu menampilkan enum
 * mentah dari database (guest/team/admin/superadmin) - kontras dengan
 * KpiRosterInline yang sudah pakai label ramah. Platform ini dijual ke
 * perusahaan lain, jadi kesan "dibuat developer untuk developer" ini
 * kecil tapi sebaiknya tidak ada.
 */
/**
 * Paket menu bawaan untuk sebuah kelompok PTS - mengikuti setelan "Tampilan
 * Dashboard" di Admin Panel -> Kelompok.
 *
 * Dipakai saat Tipe PTS dipilih di form Tambah Akun, jadi akun baru langsung
 * lahir dengan tampilan yang benar tanpa admin mencentang satu per satu.
 * Centangnya tetap bisa disesuaikan setelahnya - ini paket awal, bukan kunci.
 */
export function paketMenuKelompok(labelPTS: string, daftar: { label: string; dashboard: 'team' | 'sales' }[]): string[] {
  return daftar.find(k => k.label === labelPTS)?.dashboard === 'sales'
    ? [...SALES_MENU_KEYS]
    : [...DEFAULT_MENU_KEYS];
}

const LABEL_ROLE: Record<string, string> = {
  superadmin: 'Superadmin', admin: 'Administrator', team: 'Team', guest: 'Guest',
};
function labelRole(role: string): string {
  return LABEL_ROLE[role] ?? role;
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
  const [editPimpinanAwal, setEditPimpinanAwal] = useState(false);
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
    'tools-team': { label: 'AV Solution Tools', icon: '🧮' },
    'tools-pustaka': { label: 'Pustaka AV Solution Tools', icon: '📚' },
    'reminder-schedule': { label: 'Request Schedule', icon: '🗓️' },
    'picket-showroom': { label: 'Piket Showroom', icon: '🏪' },
    'learning-center': { label: 'Learning Center', icon: '🎓' },
    'tech-note': { label: 'Tech Note R&D', icon: '📝' },
    'kpi-team': { label: 'KPI Team', icon: '📊' },
    'summary-project': { label: 'Summary Project', icon: '🗂️' },
  };

  const notify = (type: 'success' | 'error', msg: string) => { setNotification({ type, msg }); setTimeout(() => setNotification(null), 3000); };
  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase.from('users').select('id,username,full_name,role,team_type,phone_number,sales_division,jabatan,allowed_menus,kpi_enabled,divisi,pts_type,pts_daerah,created_at,access_level,piket_akses,piket_ubah,bisa_ditugaskan').order('full_name');
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
      //  Penanda pimpinan: kueri terpisah & toleran (kolom baru, migrasi 034). Bila gagal = semua bukan pimpinan.
      const { data: pim } = await supabase.from('users').select('id,pimpinan');
      const adaPim = new Set<string>(((pim ?? []) as { id: string; pimpinan: boolean | null }[]).filter(p => p.pimpinan === true).map(p => p.id));
      const gabung = (u: User): User => ({ ...u, pimpinan: adaPim.has(u.id) });
      setPendingUsers(data.filter((u: User) => u.team_type === 'Pending Approval').map(gabung));
      setUsers(data.filter((u: User) => u.team_type !== 'Pending Approval').map(gabung));
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
    /*
      Administrator = peran admin + Full Access. Viewer = akun pimpinan (lib/pimpinan.ts): melihat
      semua, HANYA BACA - penolakan tulisnya ditegakkan basis data (migrasi 034), bukan cuma tombol
      yang disembunyikan. /api/admin/users juga melepas atasan, KPI & penugasan untuk pimpinan.
    */
    const peranKhusus: Record<string, unknown> =
      newUser.divisi === 'Administrator' ? { access_level: 'full', kpi_enabled: false }
      : newUser.divisi === 'Viewer' ? { pimpinan: true }
      : {};
    if (newUser.divisi === 'Administrator') {
      role = 'admin';
    } else if (newUser.divisi === 'Viewer') {
      role = 'guest'; team_type = 'Guest';
    } else if (newUser.divisi === 'PTS') {
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
    const insertPayload: Record<string, unknown> = { username: newUser.username, full_name: newUser.full_name, role, team_type, allowed_menus: newUser.allowed_menus, jabatan: newUser.jabatan || null, phone_number: newUser.phone_number || null, sales_division: (newUser.divisi === 'Sales' || newUser.divisi === 'Marketing') ? (newUser.sales_division || null) : null, is_internal_sales: isInternalSales, pts_daerah: isCabangBaru2 ? newUser.pts_daerah.trim() : null, ...peranKhusus };
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
      piket_akses: role === 'team' ? null : (editingUser.piket_akses === 'lingkup' ? 'lingkup' : null),
      //  Hak mengisi/menyunting Piket Showroom. Tim PTS selalu boleh (by role), jadi tidak disimpan.
      piket_ubah: role === 'team' ? false : editingUser.piket_ubah === true,
      //  Ikut updatePayload biasa: route admin menulisnya dengan service-role,
      //  jadi pembekuan kolom di trigger tidak menghalangi.
      bisa_ditugaskan: editBisaDitugaskan,
      //  Hanya dikirim bila diubah: kolom baru (migrasi 034), dan mengirimnya di setiap simpan akan
      //  menggagalkan SEMUA penyimpanan akun selama migrasi belum dijalankan. Server memaksa
      //  atasan_id = null, kpi_enabled = false, bisa_ditugaskan = false untuk pimpinan.
      ...((editingUser.pimpinan === true) !== editPimpinanAwal ? { pimpinan: role === 'team' ? false : editingUser.pimpinan === true } : {}) };
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
      //  Pesan asli Supabase disertakan - dulu selalu "Gagal menghapus akun."
      //  polos, jadi galat pelanggaran foreign key (akun yang sudah punya
      //  aktivitas: quiz, reminder, tiket, dst) tidak bisa dibedakan dari
      //  galat RLS tanpa membongkar basis data langsung.
      if (error) { notify('error', `Gagal menghapus akun: ${error.message}`); return; }
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
                <span><Ikon nama={m.icon} ukuran={14} /></span>
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
          <IkonTeks nama="👥" />Daftar Akun ({users.length})
        </button>
        <button onClick={() => { setActiveTab('add'); setEditingUser(null); setEditDivisi(''); setEditPtsType(''); setEditPtsDaerah(''); }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all mr-1 ${activeTab === 'add' ? 'border-rose-500 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <IkonTeks nama="➕" />Tambah Akun
        </button>
        <button onClick={() => { setActiveTab('pending'); setApprovingUser(null); }}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-all mr-1 ${activeTab === 'pending' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <IkonTeks nama="🕐" />Pending {pendingUsers.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full">{pendingUsers.length}</span>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'list' && (
          <>
            {/* Search bar */}
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <input aria-label="Cari nama, username, atau role..." type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama, username, atau role..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all" />
            </div>

            {loadingUsers ? (
              <div className="flex items-center justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-rose-600 border-rose-200 animate-spin" /></div>
            ) : editingUser ? (
              <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-800"><IkonTeks nama="✏" />Edit: {editingUser.full_name}</h3>
                  <button aria-label="Tutup" onClick={() => { setEditingUser(null); setEditDivisi(''); setEditPtsType(''); setEditPtsDaerah(''); }} className="text-slate-500 hover:text-slate-600 font-bold">✕</button>
                </div>
                <FormEditAkunInline
                  MenuPermissionSelector={MenuPermissionSelector} daftarDivisi={daftarDivisi} editAccessLevel={editAccessLevel} editBisaDitugaskan={editBisaDitugaskan} editDivisi={editDivisi} editPtsDaerah={editPtsDaerah} editPtsType={editPtsType} editingUser={editingUser} kelompokPTSList={kelompokPTSList} setEditAccessLevel={setEditAccessLevel} setEditBisaDitugaskan={setEditBisaDitugaskan} setEditDivisi={setEditDivisi} setEditPtsDaerah={setEditPtsDaerah} setEditPtsType={setEditPtsType} setEditingUser={setEditingUser}
                />
                <div className="flex gap-3 pt-1">
                  <button onClick={handleSaveEdit} disabled={saving} className="flex-1 bg-gradient-to-r from-rose-600 to-rose-700 text-white py-2.5 rounded-lg font-semibold hover:from-rose-700 hover:to-rose-800 transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                    {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    <IkonTeks nama="💾" />Simpan Perubahan
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
                      <tr><td colSpan={6} className="text-center py-10 text-slate-500 text-sm">Tidak ada akun ditemukan</td></tr>
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
                          <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-widest bg-slate-200 text-slate-600">{user.pimpinan ? 'Viewer' : labelRole(user.role)}</span></td>
                          <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{divisi}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">{user.phone_number ? <span className="text-emerald-700"><Ikon nama="📱" ukuran="1em" className="inline-block align-[-0.12em]" /> {user.phone_number}</span> : <span className="text-slate-400">—</span>}</td>
                          <td className="md:sticky md:right-0 px-4 py-2.5" style={{ background: rowBg }}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button onClick={() => {
                                let d = '', p = '';
                                if (user.role === 'team') { d = 'PTS'; p = labelKelompokPTS(user.team_type ?? ''); }
                                else if (user.team_type === 'Guest') { d = 'Sales'; }
                                else if (user.team_type === 'Marketing') { d = 'Marketing'; }
                                setEditDivisi(d); setEditPtsType(p); setEditPtsDaerah(user.pts_daerah ?? ''); setEditOrig({ username: user.username, full_name: user.full_name }); setEditAccessLevel(user.access_level === 'full' ? 'full' : 'guest'); setEditBisaDitugaskan(user.bisa_ditugaskan !== false); setEditPimpinanAwal(user.pimpinan === true); setEditingUser(user);
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

        <TabTambahAkun
          MenuPermissionSelector={MenuPermissionSelector} activeTab={activeTab} daftarDivisi={daftarDivisi} handleAddUser={handleAddUser} kelompokPTSList={kelompokPTSList} newUser={newUser} saving={saving} setNewUser={setNewUser}
        />

        <TabAkunTertunda
          activeTab={activeTab} approveMenus={approveMenus} approvingUser={approvingUser} handleApproveUser={handleApproveUser} handleRejectUser={handleRejectUser} loadingUsers={loadingUsers} menuLabels={menuLabels} pendingUsers={pendingUsers} saving={saving} setApproveMenus={setApproveMenus} setApprovingUser={setApprovingUser}
        />
      </div>
        </div>
      </div>
    </div>
  );
}
