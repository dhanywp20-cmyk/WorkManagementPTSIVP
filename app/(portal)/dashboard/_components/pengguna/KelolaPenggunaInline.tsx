'use client';

import { useState, useEffect } from 'react';
import { KUNCI_PENGATURAN } from '@/lib/kunci-pengaturan';
import { supabase } from '@/lib/supabase';
import { adminUpdateUser } from '@/lib/admin-users';
import { User, JabatanType, JABATAN_CONFIG, JABATAN_CC_RULES } from '../shared';
import { useDivisiSales } from '@/lib/merek/inti';
import { DivisiSalesInline } from '../divisi-sales';
import { LingkupManagerInline } from '../lingkup-manager';
import { ConfirmDialog, type ConfirmState } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { TabProdukInline } from './TabProdukInline';
import { TabIVPInline } from './TabIVPInline';
import { TabAtasanInline } from './TabAtasanInline';
import { TabStrukturOrganisasi } from './TabStrukturOrganisasi';
import { TabUserCC } from './TabUserCC';
import { pesanGalat } from '@/lib/galat/pesan';

export function UserManagementInline() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [divSupMaps, setDivSupMaps] = useState<{ id: string; sales_division: string; supervisor_id: string }[]>([]);
  const [divIvpMaps, setDivIvpMaps] = useState<{ id: string; sales_division: string; ivp_id: string; brand_type?: string | null }[]>([]);
  const [userSupMaps, setUserSupMaps] = useState<{ id: string; user_id: string; supervisor_id: string }[]>([]);
  const [prodTeamMaps, setProdTeamMaps] = useState<{ id: string; product_type: string; team_types: string[] }[]>([]);
  const [prodType, setProdType] = useState('');
  const [prodTeamTypes, setProdTeamTypes] = useState<string[]>([]);
  const [managerUserId, setManagerUserId] = useState('');
  const [savingMgr, setSavingMgr] = useState(false);
  const [internalSearch, setInternalSearch] = useState('');
  const [savingInternal, setSavingInternal] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'org' | 'atasan' | 'ivp' | 'product' | 'user_cc' | 'divisi' | 'lingkup'>('org');
  const [orgFilter, setOrgFilter] = useState<'all' | 'Sales' | 'Marketing' | 'PTS'>('all');
  const [orgSelectedId, setOrgSelectedId] = useState('');
  const [orgSearch, setOrgSearch] = useState('');
  const [atasanDiv, setAtasanDiv] = useState('');
  const [atasanSupId, setAtasanSupId] = useState('');
  const [ivpDiv, setIvpDiv] = useState('');
  const [ivpUserId, setIvpUserId] = useState('');
  const [ivpBrand, setIvpBrand] = useState<'MVI' | 'IVP'>('MVI');
  const [selectedCCUserId, setSelectedCCUserId] = useState('');
  const [ccChecked, setCcChecked] = useState<Set<string>>(new Set());
  const [ccSaving, setCcSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const notify = (type: 'success' | 'error' | 'info', msg: string) => { setNotification({ type, msg }); setTimeout(() => setNotification(null), 3500); };
  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoadingData(true);
    const [usersRes, divSupRes, divIvpRes, userSupRes, atasanRes, prodRes, mgrRes, internalRes] = await Promise.all([
      supabase.from('users').select('id, username, full_name, role, team_type, sales_division, phone_number, jabatan').order('full_name'),
      supabase.from('division_supervisor_mappings').select('id,sales_division,supervisor_id').order('sales_division'),
      supabase.from('division_ivp_mappings').select('id,sales_division,ivp_id,brand_type').order('sales_division'),
      supabase.from('user_supervisor_mappings').select('id,user_id,supervisor_id'),
      supabase.from('users').select('id, atasan_id'),
      supabase.from('product_team_map').select('id,product_type,team_types').order('product_type'),
      supabase.from('app_settings').select('value').eq('key', KUNCI_PENGATURAN.MANAGER).maybeSingle(),
      supabase.from('users').select('id, is_internal_sales'),
    ]);
    if (usersRes.data) {
      const atasanMap = new Map<string, string | null>((atasanRes.data ?? []).map((r: { id: string; atasan_id: string | null }) => [r.id, r.atasan_id]));
      const internalMap = new Map<string, boolean>((internalRes.data ?? []).map((r: { id: string; is_internal_sales: boolean | null }) => [r.id, !!r.is_internal_sales]));
      setAllUsers(usersRes.data.map((u: User) => ({ ...u, atasan_id: atasanMap.get(u.id) ?? null, is_internal_sales: internalMap.get(u.id) ?? false })));
    }
    if (divSupRes.data) setDivSupMaps(divSupRes.data);
    if (divIvpRes.data) setDivIvpMaps(divIvpRes.data);
    if (userSupRes.data) setUserSupMaps(userSupRes.data);
    if (prodRes.data) setProdTeamMaps(prodRes.data as { id: string; product_type: string; team_types: string[] }[]);
    if (mgrRes.data?.value) setManagerUserId(String(mgrRes.data.value).replace(/^"|"$/g, ''));
    setLoadingData(false);
  };

  const getUserById = (id: string) => allUsers.find(u => u.id === id);
  const ATASAN_JABATAN: JabatanType[] = ['Supervisor', 'Manager', 'Deputy General Manager', 'General Manager', 'Direktur'];
  const supervisorCandidates = allUsers.filter(u => ['guest', 'team'].includes(u.role?.toLowerCase() ?? '') && u.jabatan && ATASAN_JABATAN.includes(u.jabatan as JabatanType));
  const ivpUsers = allUsers.filter(u => u.role?.toLowerCase() === 'guest' && ['IVP', 'MVI', 'MLDS'].includes(u.sales_division ?? ''));
  const mviUsers = allUsers.filter(u => u.role?.toLowerCase() === 'guest' && u.sales_division === 'MVI');
  const nonIvpDivisions = useDivisiSales().filter(d => d !== 'IVP' && d !== 'MVI');
  const INTERNAL_GROUPS = ['PTS', 'IVP'];
  const ccEligibleUsers = allUsers
    .filter(u => u.role?.toLowerCase() === 'guest' && u.jabatan && u.sales_division && u.sales_division !== 'IVP' && u.sales_division !== 'MVI')
    .sort((a, b) => (JABATAN_CONFIG[a.jabatan as JabatanType]?.tier ?? 0) - (JABATAN_CONFIG[b.jabatan as JabatanType]?.tier ?? 0));

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
      const { error: galatHapus } = await supabase.from('user_supervisor_mappings').delete().eq('user_id', selectedCCUserId).select('id');
      if (galatHapus) { notify('error', 'Gagal menghapus mapping lama: ' + galatHapus.message); setCcSaving(false); return; }
      const toInsert = Array.from(ccChecked).map(supId => ({ user_id: selectedCCUserId, supervisor_id: supId }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('user_supervisor_mappings').insert(toInsert);
        if (error) { notify('error', 'Gagal: ' + error.message); setCcSaving(false); return; }
      }
      notify('success', 'CC mapping disimpan!'); await fetchAll();
    } catch (e) { notify('error', pesanGalat(e)); }
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

  const handleDeleteAtasan = (id: string) => {
    setConfirmState({ message: 'Hapus mapping atasan ini?', danger: true, confirmLabel: 'Hapus', onConfirm: async () => {
      const { data, error } = await supabase.from('division_supervisor_mappings').delete().eq('id', id).select('id');
      if (error || !data || data.length === 0) { notify('error', 'Gagal menghapus mapping.'); return; }
      notify('success', 'Dihapus.'); await fetchAll();
    }});
  };

  const handleAddIvp = async () => {
    if (!ivpDiv || !ivpUserId) { notify('error', 'Pilih divisi dan IVP & MVI Account.'); return; }
    const dupBrand = divIvpMaps.find(m => m.sales_division === ivpDiv && (m.brand_type ?? 'MVI') === ivpBrand);
    if (dupBrand) { notify('info', `Divisi ${ivpDiv} sudah punya Sales Internal utk brand ${ivpBrand}. Hapus dulu kalau mau ganti.`); return; }
    setSaving(true);
    const { error } = await supabase.from('division_ivp_mappings').insert([{ sales_division: ivpDiv, ivp_id: ivpUserId, brand_type: ivpBrand }]);
    if (error) notify('error', 'Gagal: ' + error.message);
    else { notify('success', `Mapping ${ivpBrand} ditambahkan!`); setIvpDiv(''); setIvpUserId(''); await fetchAll(); }
    setSaving(false);
  };

  const handleDeleteIvp = (id: string) => {
    setConfirmState({ message: 'Hapus mapping IVP ini?', danger: true, confirmLabel: 'Hapus', onConfirm: async () => {
      const { data, error } = await supabase.from('division_ivp_mappings').delete().eq('id', id).select('id');
      if (error || !data || data.length === 0) { notify('error', 'Gagal menghapus mapping.'); return; }
      notify('success', 'Dihapus.'); await fetchAll();
    }});
  };

  const jabatanBadge = (u: User | undefined) => {
    if (!u?.jabatan) return null;
    const cfg = JABATAN_CONFIG[u.jabatan as JabatanType];
    if (!cfg) return null;
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm border" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}><Ikon nama={cfg.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {u.jabatan}</span>;
  };

  const orgGroupOf = (u: User | undefined): 'Sales' | 'Marketing' | 'PTS' | 'Lainnya' => {
    if (!u) return 'Lainnya';
    const tt = (u.team_type || '').toLowerCase();
    if (tt.startsWith('team pts')) return 'PTS';
    if (tt === 'marketing') return 'Marketing';
    if ((u.role || '').toLowerCase() === 'guest' || u.sales_division) return 'Sales';
    if (['team', 'admin', 'superadmin'].includes((u.role || '').toLowerCase())) return 'PTS';
    return 'Lainnya';
  };
  const ORG_GROUP_STYLE: Record<string, { bg: string; color: string }> = {
    Sales:     { bg: '#E6F1FB', color: '#0C447C' },
    Marketing: { bg: '#FBEAF0', color: '#72243E' },
    PTS:       { bg: '#E1F5EE', color: '#085041' },
    Lainnya:   { bg: '#F1EFE8', color: '#444441' },
  };
  const toggleProdTeamType = (tt: string) => {
    setProdTeamTypes(prev => prev.includes(tt) ? prev.filter(x => x !== tt) : [...prev, tt]);
  };
  const handleAddProdSup = async () => {
    if (!prodType || prodTeamTypes.length === 0) { notify('error', 'Pilih tipe produk & minimal 1 tim.'); return; }
    setSaving(true);
    const { error } = await supabase.from('product_team_map').upsert({ product_type: prodType, team_types: prodTeamTypes }, { onConflict: 'product_type' });
    if (error) notify('error', 'Gagal: ' + error.message);
    else { notify('success', 'Routing tipe produk disimpan!'); setProdType(''); setProdTeamTypes([]); await fetchAll(); }
    setSaving(false);
  };
  const handleDeleteProdSup = (id: string) => {
    setConfirmState({ message: 'Hapus routing tipe produk ini?', danger: true, confirmLabel: 'Hapus', onConfirm: async () => {
      const { data, error } = await supabase.from('product_team_map').delete().eq('id', id).select('id');
      if (error || !data || data.length === 0) { notify('error', 'Gagal menghapus routing.'); return; }
      notify('success', 'Dihapus.'); await fetchAll();
    }});
  };
  const handleSaveManager = async () => {
    if (!managerUserId) { notify('error', 'Pilih akun Manager.'); return; }
    setSavingMgr(true);
    const { error } = await supabase.from('app_settings').upsert({ key: KUNCI_PENGATURAN.MANAGER, value: managerUserId }, { onConflict: 'key' });
    if (error) notify('error', 'Gagal: ' + error.message);
    else notify('success', 'Akun Manager disimpan!');
    setSavingMgr(false);
  };
  const getSupervisorsForTeam = (teamType: string): string =>
    allUsers.filter(u => u.team_type === teamType && u.jabatan === 'Supervisor').map(u => u.full_name).join(', ') || '— (belum ada Supervisor di tim ini)';
  const handleToggleInternalSales = async (userId: string, current: boolean) => {
    setSavingInternal(userId);
    const { error } = await adminUpdateUser(userId, { is_internal_sales: !current });
    if (error) notify('error', 'Gagal: ' + error.message);
    else { setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, is_internal_sales: !current } : u)); notify('success', !current ? 'Ditandai Internal.' : 'Ditandai External.'); }
    setSavingInternal(null);
  };

  const orgWouldCycle = (userId: string, newAtasanId: string): boolean => {
    let cur: string | null | undefined = newAtasanId;
    let guard = 0;
    while (cur && guard < 60) {
      if (cur === userId) return true;
      cur = allUsers.find(u => u.id === cur)?.atasan_id;
      guard++;
    }
    return false;
  };
  const handleSetAtasan = async (userId: string, atasanId: string) => {
    if (atasanId && atasanId === userId) { notify('error', 'Tidak bisa menjadi atasan diri sendiri.'); return; }
    if (atasanId && orgWouldCycle(userId, atasanId)) { notify('error', 'Ditolak — pilihan ini membuat lingkaran hierarki.'); return; }
    setSaving(true);
    const { error } = await supabase.from('users').update({ atasan_id: atasanId || null }).eq('id', userId);
    if (error) notify('error', 'Gagal: ' + error.message + ' (pastikan migration atasan_id sudah dijalankan)');
    else { notify('success', 'Atasan diperbarui!'); await fetchAll(); }
    setSaving(false);
  };
  const orgChildren: Record<string, User[]> = {};
  const orgUserIds = new Set(allUsers.map(u => u.id));
  allUsers.forEach(u => {
    const pid = u.atasan_id && orgUserIds.has(u.atasan_id) ? u.atasan_id : '__root__';
    (orgChildren[pid] ||= []).push(u);
  });
  const orgTierOf = (u: User) => JABATAN_CONFIG[u.jabatan as JabatanType]?.tier ?? 0;
  Object.values(orgChildren).forEach(list => list.sort((a, b) => orgTierOf(b) - orgTierOf(a) || a.full_name.localeCompare(b.full_name, 'id')));
  const orgAncestorsOf = (u: User): Set<string> => {
    const out = new Set<string>();
    let cur = u.atasan_id; let g = 0;
    while (cur && g < 60) { out.add(cur); cur = allUsers.find(x => x.id === cur)?.atasan_id; g++; }
    return out;
  };
  let orgVisible: Set<string> | null = null;
  if (orgFilter !== 'all' || orgSearch.trim()) {
    orgVisible = new Set<string>();
    const q = orgSearch.trim().toLowerCase();
    allUsers.forEach(u => {
      const matchGroup = orgFilter === 'all' || orgGroupOf(u) === orgFilter;
      const matchSearch = !q || u.full_name.toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
      if (matchGroup && matchSearch) {
        orgVisible!.add(u.id);
        orgAncestorsOf(u).forEach(id => orgVisible!.add(id));
      }
    });
  }

  const atasanByDiv: Record<string, typeof divSupMaps> = {};
  divSupMaps.forEach(m => { if (!atasanByDiv[m.sales_division]) atasanByDiv[m.sales_division] = []; atasanByDiv[m.sales_division].push(m); });
  const ivpByDiv: Record<string, typeof divIvpMaps> = {};
  divIvpMaps.forEach(m => { if (!ivpByDiv[m.sales_division]) ivpByDiv[m.sales_division] = []; ivpByDiv[m.sales_division].push(m); });

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

  const filteredAtasanByDiv = Object.entries(atasanByDiv).filter(([div]) => !searchQuery || div.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredIvpByUser = Object.entries(ivpByUser).filter(([, { user }]) => !searchQuery || user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      {notification && (
        <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shrink-0 ${
          notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
          {notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : 'ℹ️'} {notification.msg}
        </div>
      )}

      <div className="flex-1 min-h-0 p-4">
        <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="flex border-b border-slate-100 px-5 pt-3 gap-1 shrink-0 flex-wrap bg-slate-50/60">
        <button onClick={() => setActiveTab('org')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'org' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <IkonTeks nama="🏛" />Struktur Organisasi
        </button>
        <button onClick={() => setActiveTab('atasan')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'atasan' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          👨‍💼 Mapping Atasan ({Object.keys(atasanByDiv).length} divisi)
        </button>
        <button onClick={() => setActiveTab('ivp')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'ivp' ? 'border-violet-500 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <IkonTeks nama="🔗" />IVP & MVI Account ({Object.keys(ivpByUser).length} orang)
        </button>
        <button onClick={() => setActiveTab('product')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'product' ? 'border-rose-500 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <IkonTeks nama="🎯" />Routing Tipe ({prodTeamMaps.length})
        </button>
        <button onClick={() => setActiveTab('user_cc')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'user_cc' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <IkonTeks nama="🏷" />CC per User ({userSupMaps.length})
        </button>
        <button onClick={() => setActiveTab('divisi')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'divisi' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <IkonTeks nama="🏷" />Divisi Sales
        </button>
        <button onClick={() => setActiveTab('lingkup')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'lingkup' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <IkonTeks nama="🧭" />Lingkup Manager
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
        {loadingData ? (
          <div className="flex items-center justify-center py-16"><div className="w-6 h-6 rounded-full border-2 border-t-teal-600 border-teal-200 animate-spin" /></div>
        ) : (
          <>
            <TabStrukturOrganisasi
              ORG_GROUP_STYLE={ORG_GROUP_STYLE} activeTab={activeTab} allUsers={allUsers} handleSetAtasan={handleSetAtasan} jabatanBadge={jabatanBadge}
              orgChildren={orgChildren} orgFilter={orgFilter} orgGroupOf={orgGroupOf} orgSearch={orgSearch} orgSelectedId={orgSelectedId} orgTierOf={orgTierOf}
              orgVisible={orgVisible} saving={saving} setOrgFilter={setOrgFilter} setOrgSearch={setOrgSearch} setOrgSelectedId={setOrgSelectedId}
            />

            {(activeTab === 'atasan' || activeTab === 'ivp') && (
              <div className="px-5 pt-4 shrink-0">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder={activeTab === 'ivp' ? 'Cari nama sales (IVP / MVI)...' : 'Cari divisi...'}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-hidden focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all" />
                </div>
              </div>
            )}

            <TabAtasanInline
              INTERNAL_GROUPS={INTERNAL_GROUPS} activeTab={activeTab} atasanDiv={atasanDiv} atasanSupId={atasanSupId} filteredAtasanByDiv={filteredAtasanByDiv}
              getUserById={getUserById} handleAddAtasan={handleAddAtasan} handleDeleteAtasan={handleDeleteAtasan} jabatanBadge={jabatanBadge}
              nonIvpDivisions={nonIvpDivisions} saving={saving} setAtasanDiv={setAtasanDiv} setAtasanSupId={setAtasanSupId}
              supervisorCandidates={supervisorCandidates}
            />

            <TabIVPInline
              activeTab={activeTab} filteredIvpByUser={filteredIvpByUser} handleAddIvp={handleAddIvp} handleDeleteIvp={handleDeleteIvp} ivpBrand={ivpBrand}
              ivpDiv={ivpDiv} ivpUserId={ivpUserId} ivpUsers={ivpUsers} mviUsers={mviUsers} nonIvpDivisions={nonIvpDivisions} saving={saving}
              setIvpBrand={setIvpBrand} setIvpDiv={setIvpDiv} setIvpUserId={setIvpUserId}
            />

            <TabProdukInline
              activeTab={activeTab} allUsers={allUsers} getSupervisorsForTeam={getSupervisorsForTeam} handleAddProdSup={handleAddProdSup}
              handleDeleteProdSup={handleDeleteProdSup} handleSaveManager={handleSaveManager} handleToggleInternalSales={handleToggleInternalSales}
              internalSearch={internalSearch} managerUserId={managerUserId} prodTeamMaps={prodTeamMaps} prodTeamTypes={prodTeamTypes} prodType={prodType}
              saving={saving} savingInternal={savingInternal} savingMgr={savingMgr} setInternalSearch={setInternalSearch} setManagerUserId={setManagerUserId}
              setProdType={setProdType} toggleProdTeamType={toggleProdTeamType}
            />

            <TabUserCC
              activeTab={activeTab} autoSuggested={autoSuggested} ccChecked={ccChecked} ccEligibleUsers={ccEligibleUsers} ccSaving={ccSaving}
              handleSaveUserCC={handleSaveUserCC} potentialCCTargets={potentialCCTargets} searchQuery={searchQuery} selectedCCUserId={selectedCCUserId}
              selectedUserObj={selectedUserObj} setCcChecked={setCcChecked} setSearchQuery={setSearchQuery} setSelectedCCUserId={setSelectedCCUserId}
            />

            {activeTab === 'divisi' && (
              <div className="p-5">
                <DivisiSalesInline />
              </div>
            )}

            {activeTab === 'lingkup' && (
              <div className="p-5">
                <LingkupManagerInline />
              </div>
            )}

          </>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}
