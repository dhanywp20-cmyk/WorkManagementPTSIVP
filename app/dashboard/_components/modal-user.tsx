'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

import { adminUpdateUser } from '@/lib/admin-users';

import { PRODUCT_TYPES } from '@/app/reminder-schedule/_components/shared';
import { User, SALES_DIVISIONS, JabatanType, JABATAN_CONFIG, JABATAN_CC_RULES } from './shared';
import { ConfirmDialog, type ConfirmState, Username, ModalPortal } from '@/components/shared';

import { maskPhone } from './modal-bersama';

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

  const handleDeleteAtasan = (id: string) => {
    setConfirmState({ message: 'Hapus mapping atasan ini?', danger: true, confirmLabel: 'Hapus', onConfirm: async () => {
      await supabase.from('division_supervisor_mappings').delete().eq('id', id);
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
      await supabase.from('division_ivp_mappings').delete().eq('id', id);
      notify('success', 'Dihapus.'); await fetchAll();
    }});
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
            🔗 IVP & MVI Account ({Object.keys(ivpByDiv).length} divisi)
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
                    <select aria-label="— Pilih Divisi —" value={atasanDiv} onChange={e => setAtasanDiv(e.target.value)}
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
                      <select aria-label="— Pilih Atasan —" value={atasanSupId} onChange={e => setAtasanSupId(e.target.value)}
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
                                  {u.full_name}{u.sales_division ? ` — ${u.sales_division}` : ''}
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
                                      <p className="text-[10px] text-slate-400"><Username value={sup?.username} /></p>
                                      {sup?.phone_number
                                        ? <span className="text-[10px] text-emerald-600">📱 {maskPhone(sup.phone_number)}</span>
                                        : <span className="text-[10px] text-rose-400">⚠️ No WA</span>}
                                    </div>
                                  </div>
                                  <button aria-label="Tutup" onClick={() => handleDeleteAtasan(m.id)}
                                    className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all flex-shrink-0">
                                    <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
                <p className="text-xs font-bold text-violet-800 uppercase tracking-widest">🔗 Tambah Mapping IVP & MVI Account</p>
                <p className="text-[11px] text-violet-700 leading-relaxed">
                  Mapping divisi external ke IVP & MVI Account yang handle-nya, <strong>per brand</strong>.
                  1 divisi bisa punya 2 handler: MVI (House Brand) &amp; IVP (Global Brand). Sales External
                  pilih brand saat request → CC/approval ke handler brand itu.
                </p>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Brand yang di-handle akun ini *</label>
                  <div className="flex gap-2">
                    {(['MVI', 'IVP'] as const).map(b => (
                      <button key={b} type="button" onClick={() => setIvpBrand(b)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all ${ivpBrand === b ? 'border-violet-500 bg-violet-100 text-violet-800' : 'border-slate-200 bg-white text-slate-500 hover:border-violet-300'}`}>
                        {b === 'MVI' ? '🏠 MVI (House Brand)' : '🌐 IVP (Global Brand)'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Sales Division (External)</label>
                    <select aria-label="— Pilih Divisi —" value={ivpDiv} onChange={e => setIvpDiv(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 bg-white">
                      <option value="">— Pilih Divisi —</option>
                      {nonIvpDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">IVP & MVI Account (Sales Internal: IVP/MVI/MLDS)</label>
                    {ivpUsers.length === 0 ? (
                      <div className="text-[11px] text-rose-600 p-2 bg-rose-50 rounded-lg border border-rose-200">⚠️ Tidak ada akun Sales Internal.</div>
                    ) : (
                      <select aria-label="— Pilih Sales Internal —" value={ivpUserId} onChange={e => setIvpUserId(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 bg-white">
                        <option value="">— Pilih Sales Internal —</option>
                        {ivpUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name}{!u.phone_number ? ' ⚠️' : ''}</option>
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
                                <div className="w-8 h-8 rounded-lg bg-violet-100 border border-violet-200 flex items-center justify-center text-lg flex-shrink-0">{(m.brand_type ?? '') === 'IVP' ? '🌐' : '🏠'}</div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-sm text-violet-800 flex items-center gap-1.5">{ivp?.full_name ?? m.ivp_id}
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border" style={(m.brand_type ?? '') === 'IVP' ? { background: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd' } : { background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }}>{(m.brand_type ?? 'MVI') === 'IVP' ? 'IVP · Global' : 'MVI · House'}</span>
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-[10px] text-slate-400"><Username value={ivp?.username} /></p>
                                    {ivp?.phone_number
                                      ? <span className="text-[10px] text-emerald-600">📱 {maskPhone(ivp.phone_number)}</span>
                                      : <span className="text-[10px] text-rose-400">⚠️ No WA</span>}
                                  </div>
                                </div>
                                <button aria-label="Tutup" onClick={() => handleDeleteIvp(m.id)}
                                  className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all flex-shrink-0">
                                  <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
                                  {checked && <svg aria-hidden="true" focusable="false" className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
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
                                    ? <p className="text-[10px] text-emerald-600">📱 {maskPhone(u.phone_number)}</p>
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
  const [activeTab, setActiveTab] = useState<'org' | 'atasan' | 'ivp' | 'product' | 'user_cc'>('org');
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
      supabase.from('app_settings').select('value').eq('key', 'manager_user_id').maybeSingle(),
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
  const nonIvpDivisions = SALES_DIVISIONS.filter(d => d !== 'IVP' && d !== 'MVI');
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

  const handleDeleteAtasan = (id: string) => {
    setConfirmState({ message: 'Hapus mapping atasan ini?', danger: true, confirmLabel: 'Hapus', onConfirm: async () => {
      await supabase.from('division_supervisor_mappings').delete().eq('id', id);
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
      await supabase.from('division_ivp_mappings').delete().eq('id', id);
      notify('success', 'Dihapus.'); await fetchAll();
    }});
  };

  const jabatanBadge = (u: User | undefined) => {
    if (!u?.jabatan) return null;
    const cfg = JABATAN_CONFIG[u.jabatan as JabatanType];
    if (!cfg) return null;
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>{cfg.icon} {u.jabatan}</span>;
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
      await supabase.from('product_team_map').delete().eq('id', id);
      notify('success', 'Dihapus.'); await fetchAll();
    }});
  };
  const handleSaveManager = async () => {
    if (!managerUserId) { notify('error', 'Pilih akun Manager.'); return; }
    setSavingMgr(true);
    const { error } = await supabase.from('app_settings').upsert({ key: 'manager_user_id', value: managerUserId }, { onConflict: 'key' });
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
          🏛️ Struktur Organisasi
        </button>
        <button onClick={() => setActiveTab('atasan')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'atasan' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          👨‍💼 Mapping Atasan ({Object.keys(atasanByDiv).length} divisi)
        </button>
        <button onClick={() => setActiveTab('ivp')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'ivp' ? 'border-violet-500 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          🔗 IVP & MVI Account ({Object.keys(ivpByUser).length} orang)
        </button>
        <button onClick={() => setActiveTab('product')} className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'product' ? 'border-rose-500 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          🎯 Routing Tipe ({prodTeamMaps.length})
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
            {/* ══ TAB STRUKTUR ORGANISASI ══ */}
            {activeTab === 'org' && (() => {
              const flat: { u: User; depth: number; directCount: number }[] = [];
              const walk = (u: User, depth: number) => {
                if (orgVisible && !orgVisible.has(u.id)) return;
                flat.push({ u, depth, directCount: (orgChildren[u.id] || []).length });
                (orgChildren[u.id] || []).forEach(k => walk(k, depth + 1));
              };
              (orgChildren['__root__'] || []).forEach(r => walk(r, 0));

              /**
               * Siapa yang TIDAK muncul di pohon sama sekali. Penelusuran
               * berangkat dari orang tanpa atasan, jadi rantai yang melingkar
               * (A atasan B, B atasan A) tidak tersambung ke akar mana pun dan
               * anggotanya lenyap dari layar tanpa pesan. Dihitung tanpa
               * filter pencarian supaya peringatannya tidak ikut hilang saat
               * daftar sedang disaring.
               */
              const tampilSemua = new Set<string>();
              const walkAll = (u: User) => {
                if (tampilSemua.has(u.id)) return;      // penjaga siklus
                tampilSemua.add(u.id);
                (orgChildren[u.id] || []).forEach(walkAll);
              };
              (orgChildren['__root__'] || []).forEach(walkAll);
              const tidakTampil = allUsers.filter(u => !tampilSemua.has(u.id));

              return (
                <div className="p-5 space-y-4">
                  <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <p className="text-xs font-bold text-emerald-800 mb-1">🏛️ Struktur Organisasi — satu tempat untuk semua divisi</p>
                    <p className="text-[11px] text-emerald-600 leading-relaxed">Atur atasan langsung setiap orang (Sales, Marketing, PTS) dalam satu pohon Direktur → Staff. Satu atasan bisa membawahi banyak orang. Klik nama untuk mengubah atasannya.</p>
                  </div>

                  {/* Peringatan: akun yang tidak muncul di pohon mana pun. */}
                  {tidakTampil.length > 0 && (
                    <div className="px-4 py-3 rounded-xl" style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
                      <p className="text-xs font-bold text-amber-800 mb-1">
                        ⚠ {tidakTampil.length} akun tidak muncul di pohon ini
                      </p>
                      <p className="text-[11px] text-amber-700 leading-relaxed mb-2">
                        Penyebabnya salah satu dari dua: <strong>belum punya atasan</strong>, atau
                        <strong> rantai atasannya melingkar</strong> (A atasan B, B atasan A) sehingga
                        tidak pernah tersambung ke puncak. Keduanya membuat orang tersebut tidak masuk
                        rekap dan routing siapa pun. Klik namanya di daftar bawah untuk menetapkan atasan.
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {tidakTampil.map(u => (
                          <span key={u.id} className="text-[10px] px-2 py-0.5 rounded-full bg-white text-amber-800 border border-amber-300">
                            {u.full_name}{u.jabatan ? ` · ${u.jabatan}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {(['all', 'Sales', 'Marketing', 'PTS'] as const).map(f => (
                      <button key={f} onClick={() => setOrgFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${orgFilter === f ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                        {f === 'all' ? 'Semua' : f}
                      </button>
                    ))}
                    <div className="relative flex-1 min-w-[160px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                      <input aria-label="Cari nama / username..." type="text" value={orgSearch} onChange={e => setOrgSearch(e.target.value)} placeholder="Cari nama / username..."
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#185FA5' }} /> Sales</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#D4537E' }} /> Marketing</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#1D9E75' }} /> PTS</span>
                    <span className="ml-auto">Indentasi = tingkat jabatan · {flat.length} orang</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-2">
                    {flat.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-sm">
                        <p className="text-2xl mb-1">🏛️</p>
                        Tidak ada hasil. Coba ubah filter atau jalankan migration <code className="text-[10px]">atasan_id</code>.
                      </div>
                    ) : flat.map(({ u, depth, directCount }) => {
                      const grp = orgGroupOf(u);
                      const gs = ORG_GROUP_STYLE[grp];
                      const isSel = orgSelectedId === u.id;
                      return (
                        <div key={u.id}>
                          <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                            style={{ marginLeft: depth * 18 }} onClick={() => setOrgSelectedId(isSel ? '' : u.id)}>
                            {depth > 0 && <span className="text-slate-300 text-xs flex-shrink-0">└</span>}
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: gs.bg, color: gs.color }}>
                              {u.full_name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <span className="text-sm font-semibold text-slate-800 truncate">{u.full_name}</span>
                            {jabatanBadge(u)}
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: gs.bg, color: gs.color }}>{grp}</span>
                            {directCount > 0 && <span className="text-[10px] text-slate-400 flex-shrink-0">· {directCount} bawahan</span>}
                            <span className="ml-auto text-slate-300 text-xs flex-shrink-0">{isSel ? '▲' : '▼'}</span>
                          </div>
                          {isSel && (
                            <div style={{ marginLeft: depth * 18 + 30 }} className="my-1 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-1.5">Atur atasan langsung — {u.full_name}</p>
                              <select aria-label="— Tidak ada (puncak / Direktur) —" value={u.atasan_id || ''} onChange={e => { handleSetAtasan(u.id, e.target.value); setOrgSelectedId(''); }} disabled={saving}
                                className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200 bg-white">
                                <option value="">— Tidak ada (puncak / Direktur) —</option>
                                {allUsers.filter(c => c.id !== u.id).slice().sort((a, b) => orgTierOf(b) - orgTierOf(a) || a.full_name.localeCompare(b.full_name, 'id')).map(c => (
                                  <option key={c.id} value={c.id}>{c.full_name}{c.jabatan ? ` · ${c.jabatan}` : ''} ({orgGroupOf(c)})</option>
                                ))}
                              </select>
                              <p className="text-[10px] text-emerald-500 mt-1.5">Daftar berisi SEMUA user lintas divisi · otomatis tervalidasi anti-loop.</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Divisi / Grup</label>
                      <select aria-label="-- Pilih Divisi / Grup --" value={atasanDiv} onChange={e => setAtasanDiv(e.target.value)} className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white">
                        <option value="">-- Pilih Divisi / Grup --</option>
                        <optgroup label="Divisi Sales">{nonIvpDivisions.map(d => <option key={d} value={d}>{d}</option>)}</optgroup>
                        <optgroup label="Tim Internal / IVP">{INTERNAL_GROUPS.map(d => <option key={d} value={d}>{d === 'IVP' ? '🔗' : '🔧'} {d}</option>)}</optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Atasan</label>
                      <select aria-label="-- Pilih Atasan --" value={atasanSupId} onChange={e => setAtasanSupId(e.target.value)} className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white">
                        <option value="">-- Pilih Atasan --</option>{supervisorCandidates.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.jabatan}{u.team_type ? ` · ${u.team_type}` : ''})</option>)}
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
                              <button aria-label="Hapus" onClick={() => handleDeleteAtasan(m.id)} className="text-red-400 hover:text-red-600 flex-shrink-0 p-1 rounded hover:bg-red-50 transition-all" title="Hapus">
                                <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
                  <p className="text-xs font-bold text-violet-700 mb-2">➕ Tambah Sales Handle (IVP / MVI) ke Divisi — <strong>per brand</strong></p>
                  <div className="mb-3">
                    <label className="block text-[10px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Brand yang di-handle *</label>
                    <div className="flex gap-2">
                      {(['MVI', 'IVP'] as const).map(b => (
                        <button key={b} type="button" onClick={() => setIvpBrand(b)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${ivpBrand === b ? 'border-violet-500 bg-violet-100 text-violet-800' : 'border-slate-200 bg-white text-slate-500 hover:border-violet-300'}`}>
                          {b === 'MVI' ? '🏠 MVI (House Brand)' : '🌐 IVP (Global Brand)'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Divisi Sales</label>
                      <select aria-label="-- Pilih Divisi --" value={ivpDiv} onChange={e => setIvpDiv(e.target.value)} className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-200 bg-white">
                        <option value="">-- Pilih Divisi --</option>{nonIvpDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Sales Account (IVP / MVI)</label>
                      <select aria-label="-- Pilih Account --" value={ivpUserId} onChange={e => setIvpUserId(e.target.value)} className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-200 bg-white">
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
                            <span className="text-[8px] font-bold px-1 rounded" style={(m.brand_type ?? '') === 'IVP' ? { background: '#dbeafe', color: '#1e40af' } : { background: '#fef3c7', color: '#92400e' }}>{(m.brand_type ?? 'MVI') === 'IVP' ? 'IVP' : 'MVI'}</span>
                            <button onClick={() => handleDeleteIvp(m.id)} className="text-violet-300 hover:text-red-500 transition-colors ml-0.5" title={`Hapus ${m.sales_division}`}>
                              <svg aria-hidden="true" focusable="false" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'product' && (
              <div className="p-5 space-y-5">
                {/* Routing tipe produk → TIM (bukan orang) */}
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50">
                  <p className="text-xs font-bold text-rose-700 mb-1">🎯 Routing Tipe Produk → Tim</p>
                  <p className="text-[11px] text-slate-500 mb-3">Request diarahkan otomatis ke Supervisor tim sesuai tipe produk (Supervisor dicari live dari Struktur Organisasi — bukan hardcode nama). "LED &amp; LCD" boleh diarahkan ke 2 tim sekaligus (keduanya di-notify, 1 tim yang eksekusi).</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Tipe Produk</label>
                      <select aria-label="-- Pilih Tipe --" value={prodType} onChange={e => setProdType(e.target.value)} className="w-full border border-rose-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 bg-white">
                        <option value="">-- Pilih Tipe --</option>
                        {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Tim PTS (bisa pilih lebih dari 1)</label>
                      <div className="flex flex-wrap gap-2">
                        {['Team PTS IVP', 'Team PTS UMP', 'Team PTS MVI'].map(tt => (
                          <button key={tt} type="button" onClick={() => toggleProdTeamType(tt)}
                            className="px-3 py-2 rounded-lg text-xs font-bold border-2 transition-all"
                            style={prodTeamTypes.includes(tt)
                              ? { borderColor: '#e11d48', background: 'rgba(225,29,72,0.1)', color: '#e11d48' }
                              : { borderColor: 'rgba(0,0,0,0.1)', background: 'white', color: '#64748b' }}>
                            {tt.replace('Team PTS ', '')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button onClick={handleAddProdSup} disabled={saving} className="mt-3 px-5 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 disabled:opacity-50 transition-all">{saving ? '...' : '💾 Simpan Routing'}</button>
                  <div className="mt-4 space-y-2">
                    {prodTeamMaps.length === 0 ? <p className="text-[11px] text-slate-400">Belum ada routing tipe produk.</p> : prodTeamMaps.map(m => (
                      <div key={m.id} className="bg-white border border-rose-200 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">{m.product_type}</span>
                            <span className="text-slate-400">→</span>
                            {m.team_types.map(tt => <span key={tt} className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{tt.replace('Team PTS ', '')}</span>)}
                          </div>
                          <button aria-label="Hapus" onClick={() => handleDeleteProdSup(m.id)} className="text-rose-300 hover:text-red-500 transition-colors" title="Hapus">
                            <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400">
                          Supervisor saat ini: {m.team_types.map(tt => getSupervisorsForTeam(tt)).join(' · ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Akun Manager (gerbang approval) */}
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
                  <p className="text-xs font-bold text-amber-700 mb-1">👑 Akun Manager (gerbang approval)</p>
                  <p className="text-[11px] text-slate-500 mb-3">Manager yang wajib approve sebelum request turun ke supervisor. Untuk sekarang boleh sama dengan Admin (Dhany); bisa dialihkan ke akun lain kapan saja.</p>
                  <div className="flex gap-3">
                    <select aria-label="-- Pilih Akun Manager --" value={managerUserId} onChange={e => setManagerUserId(e.target.value)} className="flex-1 min-w-0 border border-amber-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white">
                      <option value="">-- Pilih Akun Manager --</option>
                      {allUsers.filter(u => u.jabatan === 'Manager' || ['admin', 'superadmin'].includes((u.role || '').toLowerCase())).map(u => <option key={u.id} value={u.id}>{u.full_name}{u.jabatan ? ` (${u.jabatan})` : ''}</option>)}
                    </select>
                    <button onClick={handleSaveManager} disabled={savingMgr} className="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition-all">{savingMgr ? '...' : '💾 Simpan'}</button>
                  </div>
                </div>

                {/* Internal / External Sales */}
                <div className="p-4 rounded-xl border border-sky-200 bg-sky-50">
                  <p className="text-xs font-bold text-sky-700 mb-1">🏷️ Sales Internal / External</p>
                  <p className="text-[11px] text-slate-500 mb-3">Tandai akun Guest mana yang Sales Internal (pemilik akun, approve request dari Sales External) — dipakai pipeline, bukan tebakan dari divisi.</p>
                  <div className="relative mb-3">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                    <input aria-label="Cari nama sales..." value={internalSearch} onChange={e => setInternalSearch(e.target.value)} placeholder="Cari nama sales..."
                      className="w-full pl-9 pr-3 py-2 border border-sky-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-200 bg-white" />
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {allUsers.filter(u => (u.role || '').toLowerCase() === 'guest' && (!internalSearch || u.full_name?.toLowerCase().includes(internalSearch.toLowerCase()))).map(u => (
                      <div key={u.id} className="flex items-center justify-between bg-white border border-sky-100 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{u.full_name}</p>
                          <p className="text-[10px] text-slate-400">{u.sales_division || '—'}</p>
                        </div>
                        <button onClick={() => handleToggleInternalSales(u.id, !!u.is_internal_sales)} disabled={savingInternal === u.id}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex-shrink-0"
                          style={u.is_internal_sales ? { background: '#0ea5e9', color: 'white' } : { background: '#f1f5f9', color: '#64748b' }}>
                          {u.is_internal_sales ? '✓ Internal' : 'External'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'user_cc' && (
              <div className="p-5 space-y-4">
                {/* Search user */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                  <input aria-label="Cari nama user..." type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama user..."
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
                                  {isChecked && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
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
      </div>
    </div>
  );
}
