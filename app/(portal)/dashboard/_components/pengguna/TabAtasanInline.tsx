'use client';

/** TabAtasanInline - dipecah dari app/(portal)/dashboard/_components/modal-user.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { User } from '../shared';
import React from 'react';

export interface TabAtasanInlineProps {
  INTERNAL_GROUPS: string[];
  activeTab: "org" | "atasan" | "ivp" | "product" | "user_cc" | "divisi" | "lingkup";
  atasanDiv: string;
  atasanSupId: string;
  filteredAtasanByDiv: [string, { id: string; sales_division: string; supervisor_id: string; }[]][];
  getUserById: (id: string) => User | undefined;
  handleAddAtasan: () => Promise<void>;
  handleDeleteAtasan: (id: string) => void;
  jabatanBadge: (u: User | undefined) => React.JSX.Element | null;
  nonIvpDivisions: string[];
  saving: boolean;
  setAtasanDiv: React.Dispatch<React.SetStateAction<string>>;
  setAtasanSupId: React.Dispatch<React.SetStateAction<string>>;
  supervisorCandidates: User[];
}

export function TabAtasanInline({ INTERNAL_GROUPS, activeTab, atasanDiv, atasanSupId, filteredAtasanByDiv, getUserById, handleAddAtasan, handleDeleteAtasan, jabatanBadge, nonIvpDivisions, saving, setAtasanDiv, setAtasanSupId, supervisorCandidates }: TabAtasanInlineProps) {
  return (
    <>
      {activeTab === 'atasan' && (
        <div className="p-5 space-y-5">
          {/* Add form */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
            <p className="text-xs font-bold text-amber-700 mb-3"><IkonTeks nama="➕" />Tambah Mapping Atasan</p>
            <div className="grid grid-cols-1 formulir:grid-cols-3 gap-3">
              <div>
                <label htmlFor="f-dashboard-components-modal-user-3" className="block text-[11px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Divisi / Grup</label>
                <select id="f-dashboard-components-modal-user-3" value={atasanDiv} onChange={e => setAtasanDiv(e.target.value)} className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white">
                  <option value="">-- Pilih Divisi / Grup --</option>
                  <optgroup label="Divisi Sales">{nonIvpDivisions.map(d => <option key={d} value={d}>{d}</option>)}</optgroup>
                  <optgroup label="Tim Internal / IVP">{INTERNAL_GROUPS.map(d => <option key={d} value={d}>{d === 'IVP' ? '🔗' : '🔧'} {d}</option>)}</optgroup>
                </select>
              </div>
              <div>
                <label htmlFor="f-dashboard-components-modal-user-4" className="block text-[11px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Atasan</label>
                <select id="f-dashboard-components-modal-user-4" value={atasanSupId} onChange={e => setAtasanSupId(e.target.value)} className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200 bg-white">
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
          <div className="grid grid-cols-1 formulir:grid-cols-2 gap-3">
            {filteredAtasanByDiv.map(([div, maps]) => (
              <div key={div} className="rounded-xl border border-amber-200 overflow-hidden">
                <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                  <span className="font-bold text-amber-800 text-xs"><Ikon nama="📁" ukuran="1em" className="inline-block align-[-0.12em]" /> {div}</span>
                  <span className="text-[11px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{maps.length}</span>
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
                        <button aria-label="Hapus" onClick={() => handleDeleteAtasan(m.id)} className="text-red-600 hover:text-red-700 flex-shrink-0 p-1 rounded hover:bg-red-50 transition-all" title="Hapus">
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
    </>
  );
}
