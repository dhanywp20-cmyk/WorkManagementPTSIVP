'use client';
import { Keterangan } from '@/components/shared/Keterangan';

/** TabAtasan - dipecah dari app/(portal)/dashboard/_components/modal-user.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { User, JabatanType, JABATAN_CONFIG } from '../shared';
import { Username } from '@/components/shared';
import { maskPhone } from '../modal-bersama';
import React from 'react';

export interface TabAtasanProps {
  ATASAN_JABATAN: ("Staff" | "Supervisor" | "Manager" | "Deputy General Manager" | "General Manager" | "Direktur")[];
  activeTab: "atasan" | "ivp" | "user_cc";
  allUsers: User[];
  atasanByDiv: Record<string, { id: string; sales_division: string; supervisor_id: string; }[]>;
  atasanDiv: string;
  atasanSupId: string;
  getUserById: (id: string) => User | undefined;
  handleAddAtasan: () => Promise<void>;
  handleDeleteAtasan: (id: string) => void;
  jabatanBadge: (u: User | undefined) => React.JSX.Element | null;
  loadingData: boolean;
  nonIvpDivisions: string[];
  saving: boolean;
  setAtasanDiv: React.Dispatch<React.SetStateAction<string>>;
  setAtasanSupId: React.Dispatch<React.SetStateAction<string>>;
  supervisorCandidates: User[];
}

export function TabAtasan({ ATASAN_JABATAN, activeTab, allUsers, atasanByDiv, atasanDiv, atasanSupId, getUserById, handleAddAtasan, handleDeleteAtasan, jabatanBadge, loadingData, nonIvpDivisions, saving, setAtasanDiv, setAtasanSupId, supervisorCandidates }: TabAtasanProps) {
  return (
    <>
      {activeTab === 'atasan' && (
        <>
          <div className="p-5 border-b border-slate-100 bg-amber-50/60 space-y-3 flex-shrink-0">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-widest"><IkonTeks nama="➕" />Tambah Mapping Atasan Divisi</p>
            <Keterangan className="ml-1">Mapping divisi → atasan. User dengan <strong>divisi yang sama</strong> otomatis ter-CC ke atasan terdaftar. Untuk user beda divisi (misal Handono SGP 1 → Rainata SGP), gunakan tab <strong>CC per User</strong>.</Keterangan>
            <div className="grid grid-cols-1 formulir:grid-cols-2 gap-3">
              <div>
                <label htmlFor="f-dashboard-components-modal-user-1" className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Sales Division</label>
                <select id="f-dashboard-components-modal-user-1" value={atasanDiv} onChange={e => setAtasanDiv(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white">
                  <option value="">— Pilih Divisi —</option>
                  {nonIvpDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Atasan (Jabatan Supervisor+)</label>
                {supervisorCandidates.length === 0 ? (
                  <div className="text-[11px] text-rose-600 p-2 bg-rose-50 rounded-lg border border-rose-200"><IkonTeks nama="⚠" />Set jabatan user di Account Settings terlebih dahulu.</div>
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
              <div className="text-center py-10 text-slate-500">
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
                        <span className="text-base"><Ikon nama="🏢" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                        <span className="font-bold text-amber-800 text-sm">{division}</span>
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200"><Ikon nama="👤" ukuran="1em" className="inline-block align-[-0.12em]" /> {divUsers.length} user</span>
                          <span className="text-[11px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-200">{maps.length} atasan</span>
                        </div>
                      </div>
                      {divUsers.length > 0 && (
                        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Bawahan di Divisi Ini</p>
                          <div className="flex flex-wrap gap-1.5">
                            {divUsers.map(u => {
                              const cfg = u.jabatan ? JABATAN_CONFIG[u.jabatan as JabatanType] : null;
                              return (
                                <div key={u.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs">
                                  <div className="w-4 h-4 rounded-full flex items-center justify-center font-black text-[10px] flex-shrink-0"
                                    style={{ background: 'linear-gradient(135deg,#fde68a,#f59e0b)', color: '#78350f' }}>
                                    {u.full_name?.charAt(0)?.toUpperCase()}
                                  </div>
                                  <span className="font-semibold text-slate-700">{u.full_name}</span>
                                  {u.jabatan && (
                                    <span className="text-[10px] font-bold px-1 py-0.5 rounded"
                                      style={{ background: cfg?.bg ?? '#f1f5f9', color: cfg?.color ?? '#475569' }}>
                                      <Ikon nama={cfg?.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {u.jabatan}
                                    </span>
                                  )}
                                  {u.sales_division && u.sales_division !== division && (
                                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded">{u.sales_division}</span>
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
                                  <p className="text-[11px] text-slate-500"><Username value={sup?.username} /></p>
                                  {sup?.phone_number
                                    ? <span className="text-[11px] text-emerald-700"><Ikon nama="📱" ukuran="1em" className="inline-block align-[-0.12em]" /> {maskPhone(sup.phone_number)}</span>
                                    : <span className="text-[11px] text-rose-600"><IkonTeks nama="⚠" />No WA</span>}
                                </div>
                              </div>
                              <button aria-label="Tutup" onClick={() => handleDeleteAtasan(m.id)}
                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-all flex-shrink-0">
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
    </>
  );
}
