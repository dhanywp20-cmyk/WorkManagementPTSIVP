'use client';

/** TabAkunTertunda - dipecah dari app/(portal)/dashboard/_components/modal-akun.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { IkonTeks } from '@/components/shared/Ikon';
import { User, ALL_MENU_KEYS, DEFAULT_MENU_KEYS } from '../shared';
import { Username } from '@/components/shared';
import { Ikon } from '@/components/shared/Ikon';
import React from 'react';

export interface TabAkunTertundaProps {
  activeTab: "list" | "add" | "pending";
  approveMenus: string[];
  approvingUser: User | null;
  handleApproveUser: () => Promise<void>;
  handleRejectUser: (userId: string, name: string) => void;
  loadingUsers: boolean;
  menuLabels: Record<string, { label: string; icon: string; }>;
  pendingUsers: User[];
  saving: boolean;
  setApproveMenus: React.Dispatch<React.SetStateAction<string[]>>;
  setApprovingUser: React.Dispatch<React.SetStateAction<User | null>>;
}

export function TabAkunTertunda({ activeTab, approveMenus, approvingUser, handleApproveUser, handleRejectUser, loadingUsers, menuLabels, pendingUsers, saving, setApproveMenus, setApprovingUser }: TabAkunTertundaProps) {
  return (
    <>
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-amber-500 border-amber-200 animate-spin" /></div>
          ) : approvingUser ? (
            <div className="space-y-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800"><IkonTeks nama="✅" />Review Pendaftaran: {approvingUser.full_name}</h3>
                <button aria-label="Tutup" onClick={() => { setApprovingUser(null); setApproveMenus(DEFAULT_MENU_KEYS); }} className="text-slate-500 hover:text-slate-600 font-bold">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm bg-white p-3 rounded-lg border border-slate-200">
                <div><span className="text-xs text-slate-500 uppercase font-bold">Nama</span><p className="font-semibold text-slate-800">{approvingUser.full_name}</p></div>
                <div><span className="text-xs text-slate-500 uppercase font-bold">Username</span><p className="font-semibold text-slate-800"><Username value={approvingUser.username} /></p></div>
                <div><span className="text-xs text-slate-500 uppercase font-bold">Divisi / Request</span>
                  <p className="font-semibold text-amber-700">{
                    approvingUser.sales_division?.startsWith('PTS') ? `PTS → ${approvingUser.sales_division}`
                    : approvingUser.sales_division?.startsWith('Marketing:') ? `Marketing → ${approvingUser.sales_division.replace('Marketing:', '')}`
                    : `Sales → ${approvingUser.sales_division}`
                  }</p>
                </div>
                <div><span className="text-xs text-slate-500 uppercase font-bold">Jabatan</span><p className="font-semibold text-slate-800">{approvingUser.jabatan || '—'}</p></div>
                {approvingUser.phone_number && <div className="col-span-2"><span className="text-xs text-slate-500 uppercase font-bold">No. Telepon</span><p className="font-semibold text-slate-800">{approvingUser.phone_number}</p></div>}
              </div>
              <div>
                <label className="block text-xs font-bold mb-2 text-slate-700 tracking-widest uppercase">Menu yang Diberikan</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_MENU_KEYS.map(key => {
                    const m = menuLabels[key]; const checked = approveMenus.includes(key);
                    return (
                      <button key={key} type="button" onClick={() => setApproveMenus(prev => checked ? prev.filter(k => k !== key) : [...prev, key])}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-left text-xs ${checked ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'border-amber-500 bg-amber-500' : 'border-slate-300 bg-white'}`}>
                          {checked && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span><Ikon nama={m.icon} ukuran={14} /></span><span className="font-semibold truncate">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={handleApproveUser} disabled={saving}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2 hover:from-emerald-700 hover:to-emerald-800 transition-all">
                  {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  <IkonTeks nama="✅" />Setujui Akun
                </button>
                <button onClick={() => handleRejectUser(approvingUser.id, approvingUser.full_name)}
                  className="px-5 py-2.5 rounded-lg border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-all">
                  <IkonTeks nama="❌" />Tolak
                </button>
              </div>
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              <div className="text-3xl mb-2"><Ikon nama="✅" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
              Tidak ada pendaftaran yang menunggu
            </div>
          ) : (
            <div className="space-y-2">
              {pendingUsers.map(user => {
                const daysPending = user.created_at
                  ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000)
                  : null;
                const isStale = daysPending !== null && daysPending > 14;
                return (
                <div key={user.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isStale ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${isStale ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
                    {user.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800 text-sm truncate">{user.full_name}</p>
                      {daysPending !== null && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black flex-shrink-0 ${isStale ? 'bg-red-200 text-red-800' : 'bg-amber-100 text-amber-700'}`}>
                          {isStale ? `⚠️ ${daysPending}h` : `${daysPending}h`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500"><Username value={user.username} /></p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-800">
                        {user.sales_division?.startsWith('PTS') ? `PTS • ${user.sales_division}` : user.sales_division?.startsWith('Marketing:') ? `Marketing • ${user.sales_division.replace('Marketing:', '')}` : `Sales • ${user.sales_division}`}
                      </span>
                      {user.jabatan && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">{user.jabatan}</span>}
                      {user.phone_number && <span className="text-[10px] text-slate-500"><Ikon nama="📱" ukuran="1em" className="inline-block align-[-0.12em]" /> {user.phone_number}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => { setApprovingUser(user); setApproveMenus(DEFAULT_MENU_KEYS); }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all">Review</button>
                    <button onClick={() => handleRejectUser(user.id, user.full_name)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all">Tolak</button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
