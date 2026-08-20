'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

import { User, AdminPanelModalProps } from './shared';
import { ModalPortal } from '@/components/shared';

import { StripInfo } from './modal-bersama';
import { AccountSettingsInline } from './modal-akun';
import { UserManagementInline } from './modal-user';
import { BrandPicSettingInline } from './modal-brand-pic';

// AdminPanelModal (unified: Settings + User Management + PIC Brand)

export function AdminPanelModal({ initialTab, onClose }: AdminPanelModalProps) {
  const [activeSection, setActiveSection] = useState<'settings' | 'userManagement' | 'picBrand' | 'kpiRoster'>(initialTab);

  const navItems: { key: 'settings' | 'userManagement' | 'picBrand' | 'kpiRoster'; label: string; icon: React.ReactElement; color: string; activeBg: string; activeBorder: string; activeText: string }[] = [
    {
      key: 'settings',
      label: 'Account Settings',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      color: '#4338ca', activeBg: 'rgba(99,102,241,0.1)', activeBorder: 'rgba(99,102,241,0.4)', activeText: '#4338ca',
    },
    {
      key: 'userManagement',
      label: 'User Management',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      color: '#0f766e', activeBg: 'rgba(13,148,136,0.1)', activeBorder: 'rgba(13,148,136,0.4)', activeText: '#0f766e',
    },
    {
      key: 'picBrand',
      label: 'PIC Brand',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
      color: '#b45309', activeBg: 'rgba(217,119,6,0.1)', activeBorder: 'rgba(217,119,6,0.4)', activeText: '#b45309',
    },
    {
      key: 'kpiRoster',
      label: 'KPI Roster',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
      color: '#0369a1', activeBg: 'rgba(3,105,161,0.1)', activeBorder: 'rgba(3,105,161,0.4)', activeText: '#0369a1',
    },
  ];

  const activeNav = navItems.find(n => n.key === activeSection)!;

  return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm pt-16 px-4 pb-4">
      {/* Di ponsel panel navigasi TIDAK boleh berdiri sebagai kolom kiri: 224px
          dari layar 360px hanya menyisakan seratusan piksel untuk isinya, dan
          tabel di dalamnya jadi terpotong sampai hanya kolom aksi yang terlihat.
          Di sana ia berubah jadi deretan tab mendatar di atas isi. */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col sm:flex-row overflow-hidden border border-slate-200">

        {/* ── LEFT SIDEBAR (ponsel: bilah tab atas) ── */}
        <div className="w-full sm:w-56 flex-shrink-0 flex flex-col border-b sm:border-b-0 sm:border-r border-slate-100" style={{ background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 100%)' }}>
          {/* Sidebar header */}
          <div className="px-4 sm:px-5 py-3 sm:py-5 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">Admin Panel</p>
                <p className="text-white/40 text-[10px] hidden sm:block">Superadmin Settings</p>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <div role="tablist" aria-label="Bagian Admin Panel"
            className="flex-1 p-2 sm:p-3 flex flex-row overflow-x-auto sm:flex-col gap-1 sm:gap-0 sm:space-y-1">
            {navItems.map(item => {
              const isActive = activeSection === item.key;
              return (
                <button key={item.key} type="button" role="tab" aria-selected={isActive} onClick={() => setActiveSection(item.key)}
                  className="flex-shrink-0 sm:w-full flex items-center gap-2 sm:gap-3 px-3 py-2 sm:py-2.5 rounded-xl text-left transition-all text-xs sm:text-sm font-semibold whitespace-nowrap"
                  style={isActive
                    ? { background: item.activeBg, border: `1px solid ${item.activeBorder}`, color: item.activeText }
                    : { background: 'transparent', border: '1px solid transparent', color: 'rgba(255,255,255,0.55)' }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                  <span className={isActive ? '' : 'opacity-60'}>{item.icon}</span>
                  <span className="sm:truncate">{item.label}</span>
                  {isActive && <div className="hidden sm:block ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.color }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT CONTENT ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Section header strip */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center gap-2 sm:gap-3 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: activeNav.activeBg, border: `1px solid ${activeNav.activeBorder}`, color: activeNav.activeText }}>
              {activeNav.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">{activeNav.label}</h2>
              <p className="text-slate-500 text-[10px] sm:text-xs hidden sm:block">
                {activeSection === 'settings' && 'Kelola akun user & hak akses menu'}
                {activeSection === 'userManagement' && 'Mapping Atasan, IVP & MVI Account & CC per User'}
                {activeSection === 'picBrand' && 'Mapping Brand PIC per divisi & produk'}
                {activeSection === 'kpiRoster' && 'Pilih anggota tim yang masuk dalam penilaian KPI'}
              </p>
            </div>
            <button aria-label="Tutup" onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all text-slate-400 hover:text-slate-700"
              style={{ background: 'rgba(0,0,0,0.05)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#dc2626'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = ''; }}
              title="Tutup">
              <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
  </ModalPortal>
  );
}

export function KpiRosterInline() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // userId sedang disimpan
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [filterTeam, setFilterTeam] = useState<'all' | 'Team PTS IVP' | 'Team PTS MVI'>('all');

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
      .in('team_type', ['Team PTS IVP', 'Team PTS MVI'])
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
  const ivpUsers = filtered.filter(u => u.team_type === 'Team PTS IVP');
  const mviUsers = filtered.filter(u => u.team_type === 'Team PTS MVI');
  const activeCount = users.filter(u => u.kpi_enabled !== false).length;

  const TeamSection = ({ members, label, color, bg, border }: {
    members: User[]; label: string; color: string; bg: string; border: string;
  }) => {
    if (!members.length) return null;
    const aktif = members.filter(u => u.kpi_enabled !== false).length;
    return (
      // Kartu putih di atas latar slate - bentuk yang sama dengan Kartu di
      // halaman Profil, supaya berpindah antar bagian tidak terasa seperti
      // berpindah aplikasi.
      <div className="mb-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100 bg-slate-50/60">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-[11px] font-bold uppercase tracking-widest flex-1" style={{ color }}>{label}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
            {aktif}/{members.length} aktif
          </span>
        </div>
        <div className="p-3">
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
                <button aria-label={enabled ? 'Nonaktifkan dari KPI' : 'Aktifkan ke KPI'}
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
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
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
        <StripInfo icon="🎯" judul="KPI Roster"
          keterangan={<>Hanya anggota yang <strong>diaktifkan</strong> di sini yang akan muncul &amp; dinilai di halaman KPI Team.</>}
          angka={loading ? undefined : activeCount}
          satuan={`aktif dari ${users.length}`} />

        {/* Filter tim */}
        <div className="flex gap-1.5">
          {(['all', 'Team PTS IVP', 'Team PTS MVI'] as const).map(t => (
            <button key={t}
              onClick={() => setFilterTeam(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                filterTeam === t
                  ? t === 'Team PTS IVP'
                    ? 'bg-teal-600 text-white border-teal-600'
                    : t === 'Team PTS MVI'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-sky-700 text-white border-sky-700'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}>
              {t === 'all' ? '🌐 Semua Tim' : t === 'Team PTS IVP' ? '🟢 IVP' : '🔵 MVI'}
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
            {(filterTeam === 'all' || filterTeam === 'Team PTS IVP') && (
              <TeamSection
                members={ivpUsers}
                label="Team PTS IVP"
                color="#0d9488"
                bg="#f0fdfa"
                border="#99f6e4"
              />
            )}
            {(filterTeam === 'all' || filterTeam === 'Team PTS MVI') && (
              <TeamSection
                members={mviUsers}
                label="Team PTS MVI"
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
