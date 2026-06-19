'use client';
// ─── Incentive PTS — Tab: Settings ───────────────────────────────────────────

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { IncentiveSetting, User } from './types';
import { inputCls, btnPrimary, fmtDate } from './shared';

interface SettingsTabProps {
  settings: IncentiveSetting | null;
  editHandlerPct: string;
  editBackupPct: string;
  onHandlerPctChange: (v: string) => void;
  onBackupPctChange: (v: string) => void;
  savingSettings: boolean;
  onSave: () => void;
  isAdmin: boolean;
  notify: (type: 'success' | 'error', msg: string) => void;
}

export function SettingsTab({
  settings,
  editHandlerPct,
  editBackupPct,
  onHandlerPctChange,
  onBackupPctChange,
  savingSettings,
  onSave,
  isAdmin,
  notify,
}: SettingsTabProps) {
  const total = parseFloat(editHandlerPct || '0') + parseFloat(editBackupPct || '0');
  const totalOk = total === 100;

  return (
    <div className="grid md:grid-cols-2 gap-5">
      {/* Persentase settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">⚙️ Pengaturan Persentase</h2>
        {settings && (
          <p className="text-xs text-gray-400">
            Terakhir diperbarui: {fmtDate(settings.updated_at)} oleh {settings.updated_by}
          </p>
        )}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">⭐ Handler Utama (%)</label>
          <input
            type="number"
            value={editHandlerPct}
            min="0"
            max="100"
            onChange={(e) => {
              onHandlerPctChange(e.target.value);
              onBackupPctChange(String(100 - parseFloat(e.target.value || '0')));
            }}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            🤝 Backup Team (%) — dibagi rata ke semua backup
          </label>
          <input
            type="number"
            value={editBackupPct}
            min="0"
            max="100"
            onChange={(e) => {
              onBackupPctChange(e.target.value);
              onHandlerPctChange(String(100 - parseFloat(e.target.value || '0')));
            }}
            className={inputCls}
          />
        </div>
        <div
          className={`p-3 rounded-xl text-sm font-semibold text-center ${
            totalOk ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          }`}
        >
          Total: {total.toFixed(0)}%{totalOk ? ' ✅' : ' ❌ harus = 100%'}
        </div>
        <button
          onClick={onSave}
          disabled={savingSettings || !totalOk}
          className={`${btnPrimary} w-full`}
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
        >
          {savingSettings ? 'Menyimpan...' : '💾 Simpan Setting'}
        </button>
      </div>

      {/* Izin input biaya */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">👥 Izin Input Biaya Cadangan</h2>
        <p className="text-xs text-gray-400">User yang diizinkan menginput biaya cadangan selain Admin</p>
        <AllowBiayaList isAdmin={isAdmin} notify={notify} />
      </div>

      {/* Konfigurasi Supervisor & Manager PTS */}
      {settings && (
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-indigo-100 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-gray-800">🎖️ Konfigurasi Struktur Tim PTS (Incentive)</h2>
          </div>
          <p className="text-xs text-gray-400">
            Tentukan siapa Supervisor dan Manager PTS untuk kalkulasi distribusi incentive.
            Jika tidak diset, sistem akan fallback ke field Jabatan di profil user.
          </p>
          <PtsRolesConfig settings={settings} isAdmin={isAdmin} notify={notify} />
        </div>
      )}
    </div>
  );
}

// ─── PTS Roles Config (sub-component) ────────────────────────────────────────
function PtsRolesConfig({
  settings,
  isAdmin,
  notify,
}: {
  settings: IncentiveSetting;
  isAdmin: boolean;
  notify: (t: 'success' | 'error', m: string) => void;
}) {
  const [teamUsers, setTeamUsers]       = useState<User[]>([]);
  const [supervisorUn, setSupervisorUn] = useState(settings.pts_supervisor_username ?? '');
  const [managerUn,    setManagerUn]    = useState(settings.pts_manager_username ?? '');
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    supabase.from('users').select('username,full_name,jabatan,team_type')
      .eq('role', 'team').order('full_name')
      .then(({ data }: { data: User[] | null }) => setTeamUsers(data ?? []));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('incentive_settings').update({
      pts_supervisor_username: supervisorUn || null,
      pts_manager_username:    managerUn    || null,
    }).eq('id', settings.id);
    setSaving(false);
    if (error) notify('error', 'Gagal simpan: ' + error.message);
    else       notify('success', 'Konfigurasi struktur tim disimpan!');
  };

  const supUser = teamUsers.find(u => u.username === supervisorUn);
  const mgrUser = teamUsers.find(u => u.username === managerUn);

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {/* Supervisor */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
          🎖️ Supervisor PTS
        </label>
        <select
          value={supervisorUn}
          onChange={e => setSupervisorUn(e.target.value)}
          disabled={!isAdmin}
          className={inputCls}
        >
          <option value="">— Tidak diset (pakai jabatan) —</option>
          {teamUsers.map(u => (
            <option key={u.username} value={u.username}>
              {u.full_name}{u.jabatan ? ` · ${u.jabatan}` : ''}
            </option>
          ))}
        </select>
        {supUser && (
          <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
            <div className="w-7 h-7 rounded-lg bg-purple-200 flex items-center justify-center text-xs font-bold text-purple-800 flex-shrink-0">
              {supUser.full_name.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-semibold text-purple-800">{supUser.full_name}</p>
              <p className="text-[10px] text-purple-500">{supUser.team_type ?? ''}</p>
            </div>
            <span className="ml-auto text-[10px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded">Supervisor</span>
          </div>
        )}
      </div>

      {/* Manager */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
          👔 Manager PTS
        </label>
        <select
          value={managerUn}
          onChange={e => setManagerUn(e.target.value)}
          disabled={!isAdmin}
          className={inputCls}
        >
          <option value="">— Tidak diset (pakai jabatan) —</option>
          {teamUsers.map(u => (
            <option key={u.username} value={u.username}>
              {u.full_name}{u.jabatan ? ` · ${u.jabatan}` : ''}
            </option>
          ))}
        </select>
        {mgrUser && (
          <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
            <div className="w-7 h-7 rounded-lg bg-violet-200 flex items-center justify-center text-xs font-bold text-violet-800 flex-shrink-0">
              {mgrUser.full_name.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-semibold text-violet-800">{mgrUser.full_name}</p>
              <p className="text-[10px] text-violet-500">{mgrUser.team_type ?? ''}</p>
            </div>
            <span className="ml-auto text-[10px] font-bold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded">Manager</span>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="sm:col-span-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${btnPrimary} w-full`}
            style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }}
          >
            {saving ? 'Menyimpan...' : '💾 Simpan Konfigurasi Tim'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Allow Biaya List (sub-component) ────────────────────────────────────────
function AllowBiayaList({
  isAdmin,
  notify,
}: {
  isAdmin: boolean;
  notify: (t: 'success' | 'error', m: string) => void;
}) {
  const [users, setUsers]     = useState<(User & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    supabase
      .from('users')
      .select('id, full_name, role, allow_incentive_input')
      .in('role', ['guest', 'sales', 'team'])
      .order('full_name')
      .then(({ data }: { data: (User & { id: string })[] | null }) => {
        setUsers(data ?? []);
        setLoading(false);
      });
  }, []);

  const toggle = async (userId: string, current: boolean) => {
    const { error } = await supabase
      .from('users')
      .update({ allow_incentive_input: !current })
      .eq('id', userId);
    if (error) { notify('error', 'Gagal update'); return; }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, allow_incentive_input: !current } : u))
    );
    notify('success', 'Permission diperbarui!');
  };

  if (loading) return <p className="text-sm text-gray-400">Memuat...</p>;

  const filtered = search.trim()
    ? users.filter((u) => u.full_name.toLowerCase().includes(search.toLowerCase()))
    : users;

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama..."
          className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400 bg-transparent"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-sm leading-none">✕</button>
        )}
      </div>

      {/* List */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Tidak ada hasil</p>
        ) : (
          filtered.map((u) => (
            <div
              key={u.id}
              className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                u.allow_incentive_input ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-gray-700">{u.full_name}</p>
                <p className="text-xs text-gray-400 capitalize">{u.role}</p>
              </div>
              <button
                onClick={() => toggle(u.id!, !!u.allow_incentive_input)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                  u.allow_incentive_input ? 'bg-indigo-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    u.allow_incentive_input ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
