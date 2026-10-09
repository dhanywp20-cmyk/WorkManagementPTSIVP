'use client';
import React, { useState, useEffect } from 'react';
import { KUNCI_PENGATURAN } from '@/lib/kunci-pengaturan';
import { supabase } from '@/lib/supabase';

import { adminUpdateUser } from '@/lib/admin-users';

import { PRODUCT_TYPES } from '@/app/(portal)/reminder-schedule/_components/shared';
import { User, SALES_DIVISIONS, JabatanType, JABATAN_CONFIG, JABATAN_CC_RULES } from './shared';
import { useDivisiSales } from '@/lib/merek';
import { DivisiSalesInline } from './divisi-sales';
import { LingkupManagerInline } from './lingkup-manager';
import { ConfirmDialog, type ConfirmState, Username, ModalPortal } from '@/components/shared';

import { maskPhone } from './modal-bersama';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { TabProdukInline } from './pengguna/TabProdukInline';
import { TabIVPInline } from './pengguna/TabIVPInline';
import { TabAtasanInline } from './pengguna/TabAtasanInline';
import { TabStrukturOrganisasi } from './pengguna/TabStrukturOrganisasi';
import { TabUserCC } from './pengguna/TabUserCC';
import { TabIVP } from './pengguna/TabIVP';
import { TabAtasan } from './pengguna/TabAtasan';

// UserManagementModal
interface UserManagementModalProps {
  onClose: () => void;
}

export function UserManagementModal({ onClose }: UserManagementModalProps) {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [divSupMaps, setDivSupMaps] = useState<{ id: string; sales_division: string; supervisor_id: string }[]>([]);
  const [divIvpMaps, setDivIvpMaps] = useState<{ id: string; sales_division: string; ivp_id: string; brand_type?: string | null }[]>([]);
  const [userSupMaps, setUserSupMaps] = useState<{ id: string; user_id: string; supervisor_id: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'atasan' | 'ivp' | 'user_cc'>('atasan');
  const [atasanDiv, setAtasanDiv] = useState('');
  const [atasanSupId, setAtasanSupId] = useState('');
  const [ivpDiv, setIvpDiv] = useState('');
  const [ivpUserId, setIvpUserId] = useState('');
  const [ivpBrand, setIvpBrand] = useState<'MVI' | 'IVP'>('MVI'); // brand mapping: House (MVI) / Global (IVP)
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
      supabase.from('division_supervisor_mappings').select('id,sales_division,supervisor_id').order('sales_division'),
      supabase.from('division_ivp_mappings').select('id,sales_division,ivp_id,brand_type').order('sales_division'),
      supabase.from('user_supervisor_mappings').select('id,user_id,supervisor_id'),
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
  const ivpUsers = allUsers.filter(u => u.role?.toLowerCase() === 'guest' && ['IVP', 'MVI', 'MLDS'].includes(u.sales_division ?? ''));
  const nonIvpDivisions = useDivisiSales().filter(d => d !== 'IVP');

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
      //  Diperiksa: RLS yang diam-diam menolak (0 baris, tanpa galat)
      //  akan meninggalkan mapping LAMA tetap aktif sementara layar sudah
      //  menunjukkan yang baru - notifikasi CC berikutnya akan salah kirim.
      const { data: terhapus, error: galatHapus } = await supabase.from('user_supervisor_mappings')
        .delete().eq('user_id', selectedCCUserId).select('id');
      if (galatHapus) { notify('error', 'Gagal menghapus mapping lama: ' + galatHapus.message); setCcSaving(false); return; }
      // Insert new
      const toInsert = Array.from(ccChecked).map(supId => ({ user_id: selectedCCUserId, supervisor_id: supId }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('user_supervisor_mappings').insert(toInsert);
        if (error) { notify('error', 'Gagal: ' + error.message); setCcSaving(false); return; }
      }
      void terhapus;
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

  const handleDeleteAtasan = (id: string) => {
    setConfirmState({ message: 'Hapus mapping atasan ini?', danger: true, confirmLabel: 'Hapus', onConfirm: async () => {
      //  select('id') supaya penolakan diam-diam RLS ikut terlihat, bukan
      //  tampak berhasil padahal mapping routing-nya masih aktif.
      const { data, error } = await supabase.from('division_supervisor_mappings').delete().eq('id', id).select('id');
      if (error || !data || data.length === 0) { notify('error', 'Gagal menghapus mapping.'); return; }
      notify('success', 'Dihapus.'); await fetchAll();
    }});
  };

  const handleAddIvp = async () => {
    if (!ivpDiv || !ivpUserId) { notify('error', 'Pilih divisi dan IVP & MVI Account.'); return; }
    // 1 divisi bisa punya mapping per brand (MVI / IVP). Cegah duplikat brand yg sama utk divisi.
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
      //  select('id') supaya penolakan diam-diam RLS ikut terlihat.
      const { data, error } = await supabase.from('division_ivp_mappings').delete().eq('id', id).select('id');
      if (error || !data || data.length === 0) { notify('error', 'Gagal menghapus mapping.'); return; }
      notify('success', 'Dihapus.'); await fetchAll();
    }});
  };

  const jabatanBadge = (u: User | undefined) => {
    if (!u?.jabatan) return null;
    const cfg = JABATAN_CONFIG[u.jabatan as JabatanType];
    if (!cfg) return null;
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}><Ikon nama={cfg.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {u.jabatan}</span>;
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
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-full flex flex-col border border-slate-200">

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-6 py-5 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">User Management</h2>
              <p className="text-white/60 text-xs">Mapping Atasan, IVP & MVI Account &amp; CC per User</p>
            </div>
          </div>
          <button aria-label="Tutup" onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-all">
            <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {notification && (
          <div className={`mx-5 mt-3 px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 flex-shrink-0 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
            {notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : 'ℹ️'} {notification.msg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-5 pt-3 gap-1 flex-shrink-0 flex-wrap bg-slate-50/60">
          <button onClick={() => setActiveTab('atasan')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'atasan' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            👨‍💼 Mapping Atasan ({Object.keys(atasanByDiv).length} divisi)
          </button>
          <button onClick={() => setActiveTab('ivp')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'ivp' ? 'border-violet-500 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <IkonTeks nama="🔗" />IVP & MVI Account ({Object.keys(ivpByDiv).length} divisi)
          </button>
          <button onClick={() => setActiveTab('user_cc')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'user_cc' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <IkonTeks nama="🏷" />CC per User ({userSupMaps.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">

          {/* ══ TAB ATASAN ══ */}
          <TabAtasan
            ATASAN_JABATAN={ATASAN_JABATAN} activeTab={activeTab} allUsers={allUsers} atasanByDiv={atasanByDiv} atasanDiv={atasanDiv} atasanSupId={atasanSupId} getUserById={getUserById} handleAddAtasan={handleAddAtasan} handleDeleteAtasan={handleDeleteAtasan} jabatanBadge={jabatanBadge} loadingData={loadingData} nonIvpDivisions={nonIvpDivisions} saving={saving} setAtasanDiv={setAtasanDiv} setAtasanSupId={setAtasanSupId} supervisorCandidates={supervisorCandidates}
          />

          {/* ══ TAB IVP ══ */}
          <TabIVP
            activeTab={activeTab} getUserById={getUserById} handleAddIvp={handleAddIvp} handleDeleteIvp={handleDeleteIvp} ivpBrand={ivpBrand} ivpByDiv={ivpByDiv} ivpDiv={ivpDiv} ivpUserId={ivpUserId} ivpUsers={ivpUsers} loadingData={loadingData} nonIvpDivisions={nonIvpDivisions} saving={saving} setIvpBrand={setIvpBrand} setIvpDiv={setIvpDiv} setIvpUserId={setIvpUserId}
          />

          {/* ══ TAB USER CC ══ */}
          {activeTab === 'user_cc' && (
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Left: user list */}
              <div className="w-56 border-r border-slate-200 flex flex-col flex-shrink-0">
                <div className="px-4 py-2.5 bg-teal-50 border-b border-teal-100">
                  <p className="text-[11px] font-bold text-teal-700 uppercase tracking-widest">Pilih User</p>
                  <p className="text-[10px] text-teal-700 mt-0.5">Centang siapa yang di-CC saat user ini buat aktivitas</p>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {ccEligibleUsers.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs py-10">
                      <p className="text-3xl mb-2">🙅</p>
                      <p>Belum ada user dengan jabatan ter-set</p>
                      <p className="mt-1 text-[10px]">Set jabatan di Account Settings</p>
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
                          {cfg && <span className="text-xs"><Ikon nama={cfg.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></span>}
                          <p className={`text-sm font-bold truncate ${isSelected ? 'text-teal-700' : 'text-slate-700'}`}>{u.full_name}</p>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">{u.jabatan}{u.sales_division ? ` · ${u.sales_division}` : ''}</p>
                        {myMaps > 0 && <span className="mt-1 inline-block bg-teal-100 text-teal-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{myMaps} CC ter-set</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: checklist */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {!selectedCCUserId ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12">
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
                          <p className="text-[11px] text-teal-700">{selectedJabatan} · {selectedUserObj?.sales_division}</p>
                        </div>
                        <button
                          onClick={() => { const s = new Set(autoSuggested); setCcChecked(s); }}
                          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all hover:bg-teal-100"
                          style={{ background: 'rgba(13,148,136,0.08)', color: '#0d9488', borderColor: 'rgba(13,148,136,0.2)' }}>
                          <IkonTeks nama="✨" />Auto-pilih berdasarkan jabatan
                        </button>
                      </div>
                      {selectedJabatan && JABATAN_CC_RULES[selectedJabatan as JabatanType] && (
                        <div className="mt-2 p-2 rounded-lg text-[11px]" style={{ background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(13,148,136,0.15)' }}>
                          <span className="font-bold text-teal-700">Rules jabatan {selectedJabatan}:</span>
                          <span className="text-teal-700 ml-1">
                            otomatis CC ke {JABATAN_CC_RULES[selectedJabatan as JabatanType].length > 0
                              ? JABATAN_CC_RULES[selectedJabatan as JabatanType].join(', ')
                              : '(tidak ada — level tertinggi)'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                      {potentialCCTargets.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <p className="text-3xl mb-2"><Ikon nama="🏆" ukuran="1em" className="inline-block align-[-0.12em]" /></p>
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
                                  {checked && <svg aria-hidden="true" focusable="false" className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ background: cfg?.bg ?? '#f1f5f9', border: `1.5px solid ${cfg?.border ?? '#e2e8f0'}` }}>
                                  <span className="text-base">{cfg?.icon ?? '👤'}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-sm" style={{ color: cfg?.color ?? '#374151' }}>{u.full_name}</p>
                                    {isAutoSuggested && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><IkonTeks nama="⭐" />Disarankan</span>}
                                  </div>
                                  <p className="text-[11px] text-slate-500">{u.jabatan}{u.sales_division ? ` · ${u.sales_division}` : ''}</p>
                                  {u.phone_number
                                    ? <p className="text-[11px] text-emerald-700"><Ikon nama="📱" ukuran="1em" className="inline-block align-[-0.12em]" /> {maskPhone(u.phone_number)}</p>
                                    : <p className="text-[11px] text-rose-600"><IkonTeks nama="⚠" />No WA — tidak akan di-CC</p>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="p-4 border-t border-slate-100 flex-shrink-0 bg-slate-50/50 flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-[11px] text-slate-500">{ccChecked.size} orang dipilih untuk di-CC</p>
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
  </ModalPortal>
  );
}

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
  const [ivpBrand, setIvpBrand] = useState<'MVI' | 'IVP'>('MVI'); // brand mapping: House (MVI) / Global (IVP)
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
      // Query terpisah & tahan-error: jika kolom atasan_id belum ada (migration belum jalan),
      // ini hanya error sendiri tanpa mematahkan load user utama.
      supabase.from('users').select('id, atasan_id'),
      // Routing pipeline (Fase 1) - tahan-error bila tabel/setting belum ada.
      supabase.from('product_team_map').select('id,product_type,team_types').order('product_type'),
      supabase.from('app_settings').select('value').eq('key', KUNCI_PENGATURAN.MANAGER).maybeSingle(),
      // Flag Internal/External Sales - tahan-error bila kolom belum ada.
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
  // Kandidat atasan: guest (Sales) ATAU team (PTS) dengan jabatan struktural
  const supervisorCandidates = allUsers.filter(u => ['guest', 'team'].includes(u.role?.toLowerCase() ?? '') && u.jabatan && ATASAN_JABATAN.includes(u.jabatan as JabatanType));
  const ivpUsers = allUsers.filter(u => u.role?.toLowerCase() === 'guest' && ['IVP', 'MVI', 'MLDS'].includes(u.sales_division ?? ''));
  const mviUsers = allUsers.filter(u => u.role?.toLowerCase() === 'guest' && u.sales_division === 'MVI');
  const salesHandleUsers = [...ivpUsers, ...mviUsers];
  const nonIvpDivisions = useDivisiSales().filter(d => d !== 'IVP' && d !== 'MVI');
  // Grup non-Sales (tim internal / IVP) yang juga bisa dipetakan atasan-nya
  const INTERNAL_GROUPS = ['PTS', 'IVP'];
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
      //  Diperiksa: RLS yang diam-diam menolak (0 baris, tanpa galat) akan
      //  meninggalkan mapping LAMA tetap aktif sementara layar menunjukkan
      //  yang baru - notifikasi CC berikutnya akan salah kirim.
      const { error: galatHapus } = await supabase.from('user_supervisor_mappings').delete().eq('user_id', selectedCCUserId).select('id');
      if (galatHapus) { notify('error', 'Gagal menghapus mapping lama: ' + galatHapus.message); setCcSaving(false); return; }
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

  const handleDeleteAtasan = (id: string) => {
    setConfirmState({ message: 'Hapus mapping atasan ini?', danger: true, confirmLabel: 'Hapus', onConfirm: async () => {
      //  select('id') supaya penolakan diam-diam RLS ikut terlihat, bukan
      //  tampak berhasil padahal mapping routing-nya masih aktif.
      const { data, error } = await supabase.from('division_supervisor_mappings').delete().eq('id', id).select('id');
      if (error || !data || data.length === 0) { notify('error', 'Gagal menghapus mapping.'); return; }
      notify('success', 'Dihapus.'); await fetchAll();
    }});
  };

  const handleAddIvp = async () => {
    if (!ivpDiv || !ivpUserId) { notify('error', 'Pilih divisi dan IVP & MVI Account.'); return; }
    // 1 divisi bisa punya mapping per brand (MVI / IVP). Cegah duplikat brand yg sama utk divisi.
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
      //  select('id') supaya penolakan diam-diam RLS ikut terlihat.
      const { data, error } = await supabase.from('division_ivp_mappings').delete().eq('id', id).select('id');
      if (error || !data || data.length === 0) { notify('error', 'Gagal menghapus mapping.'); return; }
      notify('success', 'Dihapus.'); await fetchAll();
    }});
  };

  const jabatanBadge = (u: User | undefined) => {
    if (!u?.jabatan) return null;
    const cfg = JABATAN_CONFIG[u.jabatan as JabatanType];
    if (!cfg) return null;
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}><Ikon nama={cfg.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {u.jabatan}</span>;
  };

  // Struktur Organisasi (atasan_id) helpers
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
  // Routing pipeline: tipe produk  TIM (bukan orang) + akun Manager
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
      //  select('id') supaya penolakan diam-diam RLS ikut terlihat.
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
  // Supervisor tim dicari LIVE dari Struktur Organisasi (team_type + jabatan=Supervisor) -
  // tidak disimpan, jadi otomatis benar walau supervisornya berganti orang.
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

  // Group IVP/MVI mappings by person (ivp_id) - each person shows all divisions they handle
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
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
      {notification && (
        <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 flex-shrink-0 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
          {notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : 'ℹ️'} {notification.msg}
        </div>
      )}

      {/* Isi dibungkus kartu putih di atas latar slate — bentuk yang sama
          dengan Kartu di halaman Profil. Sebelumnya tab dan isinya menempel
          langsung ke latar tanpa bidang sendiri, jadi bagian ini terlihat
          belum jadi dibanding bagian lain. */}
      <div className="flex-1 min-h-0 p-4">
        <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-slate-100 px-5 pt-3 gap-1 flex-shrink-0 flex-wrap bg-slate-50/60">
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
        {/* Divisi Sales ada DI SINI, bukan di pengaturan tampilan: yang
            mengurusnya orang yang sama dengan yang mengurus akun, dan divisi
            baru berarti sesuatu lewat akun yang memakainya. */}
        <button onClick={() => setActiveTab('divisi')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'divisi' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <IkonTeks nama="🏷" />Divisi Sales
        </button>
        {/* Lingkup Manager melengkapi Struktur Organisasi: pohon atasan menjawab
            siapa membawahi SIAPA, lingkup menjawab siapa membawahi KELOMPOK
            mana - dan yang kedua itulah yang menentukan pekerjaan kelompok lain
            ikut terbaca atau tidak. */}
        <button onClick={() => setActiveTab('lingkup')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'lingkup' ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <IkonTeks nama="🧭" />Lingkup Manager
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
        {loadingData ? (
          <div className="flex items-center justify-center py-16"><div className="w-6 h-6 rounded-full border-2 border-t-teal-600 border-teal-200 animate-spin" /></div>
        ) : (
          <>
            {/* ══ TAB STRUKTUR ORGANISASI ══ */}
            <TabStrukturOrganisasi
              ORG_GROUP_STYLE={ORG_GROUP_STYLE} activeTab={activeTab} allUsers={allUsers} handleSetAtasan={handleSetAtasan} jabatanBadge={jabatanBadge} orgChildren={orgChildren} orgFilter={orgFilter} orgGroupOf={orgGroupOf} orgSearch={orgSearch} orgSelectedId={orgSelectedId} orgTierOf={orgTierOf} orgVisible={orgVisible} saving={saving} setOrgFilter={setOrgFilter} setOrgSearch={setOrgSearch} setOrgSelectedId={setOrgSelectedId}
            />

            {/* Search bar for atasan & ivp tabs */}
            {(activeTab === 'atasan' || activeTab === 'ivp') && (
              <div className="px-5 pt-4 flex-shrink-0">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder={activeTab === 'ivp' ? 'Cari nama sales (IVP / MVI)...' : 'Cari divisi...'}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all" />
                </div>
              </div>
            )}

            <TabAtasanInline
              INTERNAL_GROUPS={INTERNAL_GROUPS} activeTab={activeTab} atasanDiv={atasanDiv} atasanSupId={atasanSupId} filteredAtasanByDiv={filteredAtasanByDiv} getUserById={getUserById} handleAddAtasan={handleAddAtasan} handleDeleteAtasan={handleDeleteAtasan} jabatanBadge={jabatanBadge} nonIvpDivisions={nonIvpDivisions} saving={saving} setAtasanDiv={setAtasanDiv} setAtasanSupId={setAtasanSupId} supervisorCandidates={supervisorCandidates}
            />

            <TabIVPInline
              activeTab={activeTab} filteredIvpByUser={filteredIvpByUser} handleAddIvp={handleAddIvp} handleDeleteIvp={handleDeleteIvp} ivpBrand={ivpBrand} ivpDiv={ivpDiv} ivpUserId={ivpUserId} ivpUsers={ivpUsers} mviUsers={mviUsers} nonIvpDivisions={nonIvpDivisions} saving={saving} setIvpBrand={setIvpBrand} setIvpDiv={setIvpDiv} setIvpUserId={setIvpUserId}
            />

            <TabProdukInline
              activeTab={activeTab} allUsers={allUsers} getSupervisorsForTeam={getSupervisorsForTeam} handleAddProdSup={handleAddProdSup} handleDeleteProdSup={handleDeleteProdSup} handleSaveManager={handleSaveManager} handleToggleInternalSales={handleToggleInternalSales} internalSearch={internalSearch} managerUserId={managerUserId} prodTeamMaps={prodTeamMaps} prodTeamTypes={prodTeamTypes} prodType={prodType} saving={saving} savingInternal={savingInternal} savingMgr={savingMgr} setInternalSearch={setInternalSearch} setManagerUserId={setManagerUserId} setProdType={setProdType} toggleProdTeamType={toggleProdTeamType}
            />

            <TabUserCC
              activeTab={activeTab} autoSuggested={autoSuggested} ccChecked={ccChecked} ccEligibleUsers={ccEligibleUsers} ccSaving={ccSaving} handleSaveUserCC={handleSaveUserCC} potentialCCTargets={potentialCCTargets} searchQuery={searchQuery} selectedCCUserId={selectedCCUserId} selectedUserObj={selectedUserObj} setCcChecked={setCcChecked} setSearchQuery={setSearchQuery} setSelectedCCUserId={setSelectedCCUserId}
            />

            {/* ══ TAB DIVISI SALES ══ */}
            {activeTab === 'divisi' && (
              <div className="p-5">
                <DivisiSalesInline />
              </div>
            )}

            {/* ══ TAB LINGKUP MANAGER ══ */}
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
