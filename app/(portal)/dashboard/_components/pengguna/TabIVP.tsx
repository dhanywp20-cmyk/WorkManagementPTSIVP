'use client';

/** TabIVP - dipecah dari app/(portal)/dashboard/_components/modal-user.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { Username } from '@/components/shared';
import { maskPhone } from '../modal-bersama';
import React from 'react';
import { User } from '../shared';

export interface TabIVPProps {
  activeTab: "atasan" | "ivp" | "user_cc";
  getUserById: (id: string) => User | undefined;
  handleAddIvp: () => Promise<void>;
  handleDeleteIvp: (id: string) => void;
  ivpBrand: "MVI" | "IVP";
  ivpByDiv: Record<string, { id: string; sales_division: string; ivp_id: string; brand_type?: string | null; }[]>;
  ivpDiv: string;
  ivpUserId: string;
  ivpUsers: User[];
  loadingData: boolean;
  nonIvpDivisions: string[];
  saving: boolean;
  setIvpBrand: React.Dispatch<React.SetStateAction<"MVI" | "IVP">>;
  setIvpDiv: React.Dispatch<React.SetStateAction<string>>;
  setIvpUserId: React.Dispatch<React.SetStateAction<string>>;
}

export function TabIVP({ activeTab, getUserById, handleAddIvp, handleDeleteIvp, ivpBrand, ivpByDiv, ivpDiv, ivpUserId, ivpUsers, loadingData, nonIvpDivisions, saving, setIvpBrand, setIvpDiv, setIvpUserId }: TabIVPProps) {
  return (
    <>
      {activeTab === 'ivp' && (
        <>
          <div className="p-5 border-b border-slate-100 bg-violet-50/60 space-y-3 flex-shrink-0">
            <p className="text-xs font-bold text-violet-800 uppercase tracking-widest"><IkonTeks nama="🔗" />Tambah Mapping IVP & MVI Account</p>
            <p className="text-[11px] text-violet-700 leading-relaxed">
              Mapping divisi external ke IVP & MVI Account yang handle-nya, <strong>per brand</strong>.
              1 divisi bisa punya 2 handler: MVI (House Brand) &amp; IVP (Global Brand). Sales External
              pilih brand saat request → CC/approval ke handler brand itu.
            </p>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Brand yang di-handle akun ini *</label>
              <div className="flex gap-2">
                {(['MVI', 'IVP'] as const).map(b => (
                  <button key={b} type="button" onClick={() => setIvpBrand(b)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all ${ivpBrand === b ? 'border-violet-500 bg-violet-100 text-violet-800' : 'border-slate-200 bg-white text-slate-500 hover:border-violet-300'}`}>
                    {b === 'MVI' ? '🏠 MVI (House Brand)' : '🌐 IVP (Global Brand)'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 formulir:grid-cols-2 gap-3">
              <div>
                <label htmlFor="f-dashboard-components-modal-user-2" className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Sales Division (External)</label>
                <select id="f-dashboard-components-modal-user-2" value={ivpDiv} onChange={e => setIvpDiv(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 bg-white">
                  <option value="">— Pilih Divisi —</option>
                  {nonIvpDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">IVP & MVI Account (Sales Internal: IVP/MVI/MLDS)</label>
                {ivpUsers.length === 0 ? (
                  <div className="text-[11px] text-rose-600 p-2 bg-rose-50 rounded-lg border border-rose-200"><IkonTeks nama="⚠" />Tidak ada akun Sales Internal.</div>
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
              <div className="text-center py-10 text-slate-500"><p className="text-3xl mb-2"><Ikon nama="🔗" ukuran="1em" className="inline-block align-[-0.12em]" /></p><p className="font-semibold">Belum ada mapping IVP</p></div>
            ) : (
              <div className="space-y-3">
                {Object.entries(ivpByDiv).sort(([a], [b]) => a.localeCompare(b)).map(([division, maps]) => (
                  <div key={division} className="rounded-xl border border-violet-200 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border-b border-violet-100">
                      <span className="text-base"><Ikon nama="🔗" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                      <span className="font-bold text-violet-800 text-sm">{division}</span>
                      <span className="ml-auto text-[11px] text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full border border-violet-200">{maps.length} IVP</span>
                    </div>
                    <div className="divide-y divide-violet-50 bg-white">
                      {maps.map(m => {
                        const ivp = getUserById(m.ivp_id);
                        return (
                          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="w-8 h-8 rounded-lg bg-violet-100 border border-violet-200 flex items-center justify-center text-lg flex-shrink-0">{(m.brand_type ?? '') === 'IVP' ? '🌐' : '🏠'}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-violet-800 flex items-center gap-1.5">{ivp?.full_name ?? m.ivp_id}
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border" style={(m.brand_type ?? '') === 'IVP' ? { background: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd' } : { background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }}>{(m.brand_type ?? 'MVI') === 'IVP' ? 'IVP · Global' : 'MVI · House'}</span>
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[11px] text-slate-500"><Username value={ivp?.username} /></p>
                                {ivp?.phone_number
                                  ? <span className="text-[11px] text-emerald-700"><Ikon nama="📱" ukuran="1em" className="inline-block align-[-0.12em]" /> {maskPhone(ivp.phone_number)}</span>
                                  : <span className="text-[11px] text-rose-600"><IkonTeks nama="⚠" />No WA</span>}
                              </div>
                            </div>
                            <button aria-label="Tutup" onClick={() => handleDeleteIvp(m.id)}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-all flex-shrink-0">
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
    </>
  );
}
