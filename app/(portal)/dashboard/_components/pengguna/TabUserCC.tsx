'use client';

/** TabUserCC - dipecah dari app/(portal)/dashboard/_components/modal-user.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { User, JabatanType, JABATAN_CONFIG } from '../shared';
import React from 'react';

export interface TabUserCCProps {
  activeTab: "org" | "atasan" | "ivp" | "product" | "user_cc" | "divisi" | "lingkup";
  autoSuggested: string[];
  ccChecked: Set<string>;
  ccEligibleUsers: User[];
  ccSaving: boolean;
  handleSaveUserCC: () => Promise<void>;
  potentialCCTargets: User[];
  searchQuery: string;
  selectedCCUserId: string;
  selectedUserObj: User | null | undefined;
  setCcChecked: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setSelectedCCUserId: React.Dispatch<React.SetStateAction<string>>;
}

export function TabUserCC({ activeTab, autoSuggested, ccChecked, ccEligibleUsers, ccSaving, handleSaveUserCC, potentialCCTargets, searchQuery, selectedCCUserId, selectedUserObj, setCcChecked, setSearchQuery, setSelectedCCUserId }: TabUserCCProps) {
  return (
    <>
      {activeTab === 'user_cc' && (
        /* flex-1 + min-h-0: isinya MENGISI tinggi panel, dan daftar di
           dalamnya yang menggulir - bukan kotak setinggi 320px yang
           menggulir sendiri sementara 178px di bawahnya kosong
           menganga. Terukur sebelum perbaikan: kotak 320px memuat isi
           634px, jadi separuh daftarnya tersembunyi padahal ruangnya ada. */
        <div className="flex-1 min-h-0 flex flex-col p-5 gap-4">
          {/* Search user */}
          <div className="relative flex-shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <input aria-label="Cari nama user..." type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama user..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all" />
          </div>
          <div className="flex-1 min-h-0 grid grid-cols-1 formulir:grid-cols-2 gap-5">
            {/* Left: user list */}
            <div className="flex flex-col min-h-0">
              <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-widest flex-shrink-0">Pilih User</p>
              <div className="space-y-1 flex-1 min-h-0 overflow-y-auto pr-1">
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
                        <p className="text-[11px] text-slate-500">{u.jabatan} · {u.sales_division}</p>
                      </div>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Right: CC targets */}
            <div className="flex flex-col min-h-0">
              {selectedUserObj ? (
                <>
                  <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-widest flex-shrink-0">CC Targets untuk {selectedUserObj.full_name}</p>
                  {autoSuggested.length > 0 && (
                    <button onClick={() => setCcChecked(new Set(autoSuggested))}
                      className="mb-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 transition-all">
                      <IkonTeks nama="✨" />Auto-suggest ({autoSuggested.length})
                    </button>
                  )}
                  <div className="space-y-1 flex-1 min-h-0 overflow-y-auto pr-1 mb-3">
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
                            <p className="text-[11px]" style={{ color: cfg?.color ?? '#64748b' }}><Ikon nama={cfg?.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {target.jabatan}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={handleSaveUserCC} disabled={ccSaving}
                    className="w-full py-2.5 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 flex-shrink-0">
                    {ccSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    <IkonTeks nama="💾" />Simpan CC Mapping
                  </button>
                </>
              ) : (
                <div className="flex-1 min-h-0 flex items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-500 text-sm">
                  ← Pilih user untuk setting CC
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
