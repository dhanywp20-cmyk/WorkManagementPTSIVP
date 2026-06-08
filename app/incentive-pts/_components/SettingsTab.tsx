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
  const [users, setUsers] = useState<(User & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {users.map((u) => (
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
      ))}
    </div>
  );
}
