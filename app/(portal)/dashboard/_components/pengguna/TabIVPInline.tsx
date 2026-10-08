'use client';

/** TabIVPInline - dipecah dari app/(portal)/dashboard/_components/modal-user.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import React from 'react';
import { User } from '../shared';

export interface TabIVPInlineProps {
  activeTab: "org" | "atasan" | "ivp" | "product" | "user_cc" | "divisi" | "lingkup";
  filteredIvpByUser: [string, { user: User | undefined; group: "IVP" | "MVI"; maps: { id: string; sales_division: string; ivp_id: string; brand_type?: string | null; }[]; }][];
  handleAddIvp: () => Promise<void>;
  handleDeleteIvp: (id: string) => void;
  ivpBrand: "MVI" | "IVP";
  ivpDiv: string;
  ivpUserId: string;
  ivpUsers: User[];
  mviUsers: User[];
  nonIvpDivisions: string[];
  saving: boolean;
  setIvpBrand: React.Dispatch<React.SetStateAction<"MVI" | "IVP">>;
  setIvpDiv: React.Dispatch<React.SetStateAction<string>>;
  setIvpUserId: React.Dispatch<React.SetStateAction<string>>;
}

export function TabIVPInline({ activeTab, filteredIvpByUser, handleAddIvp, handleDeleteIvp, ivpBrand, ivpDiv, ivpUserId, ivpUsers, mviUsers, nonIvpDivisions, saving, setIvpBrand, setIvpDiv, setIvpUserId }: TabIVPInlineProps) {
  return (
    <>
      {activeTab === 'ivp' && (
        <div className="p-5 space-y-5">
          {/* Add form */}
          <div className="p-4 rounded-xl border border-violet-200 bg-violet-50">
            <p className="text-xs font-bold text-violet-700 mb-2"><IkonTeks nama="➕" />Tambah Sales Handle (IVP / MVI) ke Divisi — <strong>per brand</strong></p>
            <div className="mb-3">
              <label className="block text-[11px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Brand yang di-handle *</label>
              <div className="flex gap-2">
                {(['MVI', 'IVP'] as const).map(b => (
                  <button key={b} type="button" onClick={() => setIvpBrand(b)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${ivpBrand === b ? 'border-violet-500 bg-violet-100 text-violet-800' : 'border-slate-200 bg-white text-slate-500 hover:border-violet-300'}`}>
                    {b === 'MVI' ? '🏠 MVI (House Brand)' : '🌐 IVP (Global Brand)'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 formulir:grid-cols-3 gap-3">
              <div>
                <label htmlFor="f-dashboard-components-modal-user-5" className="block text-[11px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Divisi Sales</label>
                <select id="f-dashboard-components-modal-user-5" value={ivpDiv} onChange={e => setIvpDiv(e.target.value)} className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-200 bg-white">
                  <option value="">-- Pilih Divisi --</option>{nonIvpDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="f-dashboard-components-modal-user-6" className="block text-[11px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Sales Account (IVP / MVI)</label>
                <select id="f-dashboard-components-modal-user-6" value={ivpUserId} onChange={e => setIvpUserId(e.target.value)} className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-200 bg-white">
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
          <div className="grid grid-cols-1 formulir:grid-cols-2 gap-3">
            {filteredIvpByUser.map(([userId, { user, group, maps }]) => (
              <div key={userId} className="rounded-xl border border-violet-200 overflow-hidden">
                {/* Card header — person name */}
                <div className="px-3 py-2 bg-violet-50 border-b border-violet-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-violet-900 text-xs truncate">{user?.full_name ?? '—'}</span>
                    <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${group === 'MVI' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-violet-100 text-violet-700 border-violet-200'}`}>{group}</span>
                  </div>
                  <span className="text-[11px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full flex-shrink-0">{maps.length}</span>
                </div>
                {/* Phone number row */}
                <div className="px-3 py-1 bg-violet-50/60 border-b border-violet-100">
                  {user?.phone_number
                    ? <p className="text-[11px] text-emerald-700"><Ikon nama="📱" ukuran="1em" className="inline-block align-[-0.12em]" /> {user.phone_number}</p>
                    : <p className="text-[11px] text-rose-600"><IkonTeks nama="⚠" />No WA</p>}
                </div>
                {/* Division chips */}
                <div className="px-3 py-2 flex flex-wrap gap-1.5 bg-white">
                  {maps.map(m => (
                    <div key={m.id} className="flex items-center gap-1 bg-violet-50 border border-violet-200 rounded-lg px-2 py-0.5 group">
                      <span className="text-[11px] font-semibold text-violet-800">{m.sales_division}</span>
                      <span className="text-[10px] font-bold px-1 rounded" style={(m.brand_type ?? '') === 'IVP' ? { background: '#dbeafe', color: '#1e40af' } : { background: '#fef3c7', color: '#92400e' }}>{(m.brand_type ?? 'MVI') === 'IVP' ? 'IVP' : 'MVI'}</span>
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
    </>
  );
}
