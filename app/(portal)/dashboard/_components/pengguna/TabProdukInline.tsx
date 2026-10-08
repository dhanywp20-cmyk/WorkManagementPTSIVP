'use client';

/** TabProdukInline - dipecah dari app/(portal)/dashboard/_components/modal-user.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { PRODUCT_TYPES } from '@/app/(portal)/reminder-schedule/_components/shared';
import React from 'react';
import { User } from '../shared';

export interface TabProdukInlineProps {
  activeTab: "org" | "atasan" | "ivp" | "product" | "user_cc" | "divisi" | "lingkup";
  allUsers: User[];
  getSupervisorsForTeam: (teamType: string) => string;
  handleAddProdSup: () => Promise<void>;
  handleDeleteProdSup: (id: string) => void;
  handleSaveManager: () => Promise<void>;
  handleToggleInternalSales: (userId: string, current: boolean) => Promise<void>;
  internalSearch: string;
  managerUserId: string;
  prodTeamMaps: { id: string; product_type: string; team_types: string[]; }[];
  prodTeamTypes: string[];
  prodType: string;
  saving: boolean;
  savingInternal: string | null;
  savingMgr: boolean;
  setInternalSearch: React.Dispatch<React.SetStateAction<string>>;
  setManagerUserId: React.Dispatch<React.SetStateAction<string>>;
  setProdType: React.Dispatch<React.SetStateAction<string>>;
  toggleProdTeamType: (tt: string) => void;
}

export function TabProdukInline({ activeTab, allUsers, getSupervisorsForTeam, handleAddProdSup, handleDeleteProdSup, handleSaveManager, handleToggleInternalSales, internalSearch, managerUserId, prodTeamMaps, prodTeamTypes, prodType, saving, savingInternal, savingMgr, setInternalSearch, setManagerUserId, setProdType, toggleProdTeamType }: TabProdukInlineProps) {
  return (
    <>
      {activeTab === 'product' && (
        <div className="p-5 space-y-5">
          {/* Routing tipe produk → TIM (bukan orang) */}
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50">
            <p className="text-xs font-bold text-rose-700 mb-1"><IkonTeks nama="🎯" />Routing Tipe Produk → Tim</p>
            <p className="text-[11px] text-slate-500 mb-3">Request diarahkan otomatis ke Supervisor tim sesuai tipe produk (Supervisor dicari live dari Struktur Organisasi — bukan hardcode nama). "LED &amp; LCD" boleh diarahkan ke 2 tim sekaligus (keduanya di-notify, 1 tim yang eksekusi).</p>
            <div className="grid grid-cols-1 formulir:grid-cols-3 gap-3">
              <div>
                <label htmlFor="f-dashboard-components-modal-user-7" className="block text-[11px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Tipe Produk</label>
                <select id="f-dashboard-components-modal-user-7" value={prodType} onChange={e => setProdType(e.target.value)} className="w-full border border-rose-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 bg-white">
                  <option value="">-- Pilih Tipe --</option>
                  {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="formulir:col-span-2">
                <label className="block text-[11px] font-bold mb-1 text-slate-500 uppercase tracking-widest">Tim PTS (bisa pilih lebih dari 1)</label>
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
              {prodTeamMaps.length === 0 ? <p className="text-[11px] text-slate-500">Belum ada routing tipe produk.</p> : prodTeamMaps.map(m => (
                <div key={m.id} className="bg-white border border-rose-200 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">{m.product_type}</span>
                      <span className="text-slate-500">→</span>
                      {m.team_types.map(tt => <span key={tt} className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{tt.replace('Team PTS ', '')}</span>)}
                    </div>
                    <button aria-label="Hapus" onClick={() => handleDeleteProdSup(m.id)} className="text-rose-300 hover:text-red-500 transition-colors" title="Hapus">
                      <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Supervisor saat ini: {m.team_types.map(tt => getSupervisorsForTeam(tt)).join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Akun Manager (gerbang approval) */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
            <p className="text-xs font-bold text-amber-700 mb-1"><IkonTeks nama="👑" />Akun Manager (gerbang approval)</p>
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
            <p className="text-xs font-bold text-sky-700 mb-1"><IkonTeks nama="🏷" />Sales Internal / External</p>
            <p className="text-[11px] text-slate-500 mb-3">Tandai akun Guest mana yang Sales Internal (pemilik akun, approve request dari Sales External) — dipakai pipeline, bukan tebakan dari divisi.</p>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <input aria-label="Cari nama sales..." value={internalSearch} onChange={e => setInternalSearch(e.target.value)} placeholder="Cari nama sales..."
                className="w-full pl-9 pr-3 py-2 border border-sky-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-200 bg-white" />
            </div>
            {/* TANPA max-h di sini: tab ini sudah menggulir sebagai satu blok
                (bungkusnya flex-1 overflow-y-auto di induk). Kotak
                setinggi 256px yang menggulir sendiri DI DALAM blok yang
                juga menggulir berarti dua scrollbar bertumpuk - dan
                508px konten tersembunyi di baliknya, terukur langsung:
                scrollHeight - clientHeight = 508px pada max-h-64 ini. */}
            <div className="space-y-1.5 pr-1">
              {allUsers.filter(u => (u.role || '').toLowerCase() === 'guest' && (!internalSearch || u.full_name?.toLowerCase().includes(internalSearch.toLowerCase()))).map(u => (
                <div key={u.id} className="flex items-center justify-between bg-white border border-sky-100 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{u.full_name}</p>
                    <p className="text-[11px] text-slate-500">{u.sales_division || '—'}</p>
                  </div>
                  <button onClick={() => handleToggleInternalSales(u.id, !!u.is_internal_sales)} disabled={savingInternal === u.id}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex-shrink-0"
                    style={u.is_internal_sales ? { background: '#0ea5e9', color: 'white' } : { background: '#f1f5f9', color: '#64748b' }}>
                    {u.is_internal_sales ? '✓ Internal' : 'External'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
