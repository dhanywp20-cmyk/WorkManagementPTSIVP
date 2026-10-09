'use client';

/** TabTambahAkun - dipecah dari app/(portal)/dashboard/_components/modal-akun.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { JABATAN_LIST, JABATAN_CONFIG } from '../shared';
import { IkonTeks } from '@/components/shared/Ikon';
import React from 'react';
import { paketMenuKelompok } from '../modal-akun';

export interface TabTambahAkunProps {
  MenuPermissionSelector: ({ selected, target }: { selected: string[]; target: "new" | "edit"; }) => React.JSX.Element;
  activeTab: "list" | "add" | "pending";
  daftarDivisi: string[];
  handleAddUser: () => Promise<void>;
  kelompokPTSList: import("@/lib/kelompok").Kelompok[];
  newUser: { username: string; password: string; full_name: string; role: string; team_type: string; phone_number: string; sales_division: string; jabatan: string; allowed_menus: string[]; divisi: string; pts_type: string; pts_daerah: string; };
  saving: boolean;
  setNewUser: React.Dispatch<React.SetStateAction<{ username: string; password: string; full_name: string; role: string; team_type: string; phone_number: string; sales_division: string; jabatan: string; allowed_menus: string[]; divisi: string; pts_type: string; pts_daerah: string; }>>;
}

export function TabTambahAkun({ MenuPermissionSelector, activeTab, daftarDivisi, handleAddUser, kelompokPTSList, newUser, saving, setNewUser }: TabTambahAkunProps) {
  return (
    <>
      {activeTab === 'add' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 formulir:grid-cols-3 gap-3">
            <div>
              <label htmlFor="f-dashboard-components-modal-akun-30" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Full Name *</label>
              <input id="f-dashboard-components-modal-akun-30" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" placeholder="Nama lengkap" />
            </div>
            <div>
              <label htmlFor="f-dashboard-components-modal-akun-31" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Username *</label>
              <input id="f-dashboard-components-modal-akun-31" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" placeholder="username" />
            </div>
            <div>
              <label htmlFor="f-dashboard-components-modal-akun-32" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Password *</label>
              <input id="f-dashboard-components-modal-akun-32" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" placeholder="min 6 karakter" />
            </div>
            <div className="formulir:col-span-3">
              <label htmlFor="f-dashboard-components-modal-akun-33" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Divisi *</label>
              <select id="f-dashboard-components-modal-akun-33" value={newUser.divisi} onChange={e => setNewUser({ ...newUser, divisi: e.target.value, pts_type: '', pts_daerah: '', sales_division: '' })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                <option value="">-- Pilih Divisi --</option>
                <option value="PTS">PTS</option>
                <option value="Sales">Sales</option>
                <option value="Marketing">Marketing</option>
              </select>
            </div>
            {newUser.divisi === 'PTS' && (
              <div className="formulir:col-span-3">
                <label htmlFor="f-dashboard-components-modal-akun-34" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Tipe PTS *</label>
                <select id="f-dashboard-components-modal-akun-34" value={newUser.pts_type} onChange={e => setNewUser({ ...newUser, pts_type: e.target.value, pts_daerah: '', allowed_menus: paketMenuKelompok(e.target.value, kelompokPTSList) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                  <option value="">-- Pilih Tipe PTS --</option>
                  {kelompokPTSList.map(k => <option key={k.nama} value={k.label}>{k.label} → {k.nama}</option>)}
                </select>
              </div>
            )}
            {newUser.divisi === 'PTS' && kelompokPTSList.find(k => k.label === newUser.pts_type)?.cabang && (
              <div className="formulir:col-span-3">
                <label htmlFor="f-dashboard-components-modal-akun-35" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Alamat Daerah *</label>
                <input id="f-dashboard-components-modal-akun-35" value={newUser.pts_daerah} onChange={e => setNewUser({ ...newUser, pts_daerah: e.target.value })}
                  placeholder="Contoh: Surabaya, Bandung, Medan..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
                <p className="text-[11px] text-slate-500 mt-1">Otomatis mengisi Daerah/Kota saat dipilih di dropdown PTS Cabang, Reminder Schedule.</p>
              </div>
            )}
            {(newUser.divisi === 'Sales' || newUser.divisi === 'Marketing') && (
              <div className="formulir:col-span-3">
                <label htmlFor="f-dashboard-components-modal-akun-36" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Sales Division *</label>
                <select id="f-dashboard-components-modal-akun-36" value={newUser.sales_division} onChange={e => setNewUser({ ...newUser, sales_division: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                  <option value="">-- Pilih Sales Division --</option>{daftarDivisi.map(div => <option key={div} value={div}>{div}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="f-dashboard-components-modal-akun-37" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Jabatan</label>
              <select id="f-dashboard-components-modal-akun-37" value={newUser.jabatan} onChange={e => setNewUser({ ...newUser, jabatan: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
                <option value="">— Pilih Jabatan —</option>{JABATAN_LIST.map(j => <option key={j} value={j}>{JABATAN_CONFIG[j].icon} {j}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-dashboard-components-modal-akun-38" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest"><IkonTeks nama="📱" />No. Telepon / WA</label>
              <input id="f-dashboard-components-modal-akun-38" value={newUser.phone_number} onChange={e => setNewUser({ ...newUser, phone_number: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" placeholder="Contoh: 08123456789" />
            </div>
            <div className="formulir:col-span-3">
              {MenuPermissionSelector({ selected: newUser.allowed_menus, target: "new" })}
            </div>
          </div>
          <button onClick={handleAddUser} disabled={saving}
            className="w-full bg-gradient-to-r from-rose-600 to-rose-700 text-white py-3 rounded-lg font-semibold hover:from-rose-700 hover:to-rose-800 transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <IkonTeks nama="➕" />Tambah Akun
          </button>
        </div>
      )}
    </>
  );
}
