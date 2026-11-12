'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from './shared';
import { muatKelompok, namaKelompokPTS, cariKelompok } from '@/lib/kelompok/inti';
import { StripInfo } from './modal-bersama';
import { IkonTeks } from '@/components/shared/Ikon';

export const TEAM_PALETTE: Record<string, { color: string; bg: string; border: string }> = {
  'Team PTS IVP': { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
  'Team PTS MVI': { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  'Team PTS UMP': { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
};

export const FALLBACK_PALETTE = [
  { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
  { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
];

export function KpiRosterInline() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [teamNames, setTeamNames] = useState<string[]>([]);

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    await muatKelompok();
    const teams = namaKelompokPTS();
    setTeamNames(teams);
    const { data, error } = await supabase
      .from('users')
      .select('id,full_name,jabatan,team_type,role,kpi_enabled')
      .eq('role', 'team')
      .in('team_type', teams)
      .order('team_type')
      .order('full_name');
    if (!error && data) setUsers(data as User[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleKpi = async (user: User) => {
    setSaving(user.id);
    const newVal = !(user.kpi_enabled ?? true);
    const { error } = await supabase
      .from('users')
      .update({ kpi_enabled: newVal })
      .eq('id', user.id);
    setSaving(null);
    if (error) { notify('error', 'Gagal menyimpan: ' + error.message); return; }
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, kpi_enabled: newVal } : u));
    notify('success', `${user.full_name} ${newVal ? 'diaktifkan' : 'dinonaktifkan'} dari roster KPI.`);
  };

  const filtered = users.filter(u => filterTeam === 'all' || u.team_type === filterTeam);
  const activeCount = users.filter(u => u.kpi_enabled !== false).length;

  const TeamSection = ({ members, label, color, bg, border }: {
    members: User[]; label: string; color: string; bg: string; border: string;
  }) => {
    if (!members.length) return null;
    const aktif = members.filter(u => u.kpi_enabled !== false).length;
    return (
      <div className="mb-4 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100 bg-slate-50/60">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-[11px] font-bold uppercase tracking-widest flex-1" style={{ color }}>{label}</span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
            {aktif}/{members.length} aktif
          </span>
        </div>
        <div className="p-3">
        <div className="space-y-2">
          {members.map(u => {
            const enabled = u.kpi_enabled !== false;
            const isSaving = saving === u.id;
            return (
              <div key={u.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all"
                style={{
                  background: enabled ? bg : '#f8fafc',
                  borderColor: enabled ? border : '#e2e8f0',
                }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
                  style={{ background: enabled ? color : '#94a3b8' }}>
                  {u.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${enabled ? 'text-slate-800' : 'text-slate-500'}`}>
                    {u.full_name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{u.jabatan ?? '—'}</p>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                  enabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {enabled ? '✅ KPI Aktif' : '⏸ Nonaktif'}
                </span>
                <button aria-label={enabled ? 'Nonaktifkan dari KPI' : 'Aktifkan ke KPI'}
                  onClick={() => toggleKpi(u)}
                  disabled={isSaving}
                  className={`relative w-11 h-6 rounded-full transition-all shrink-0 focus:outline-hidden ${
                    enabled ? 'bg-sky-500' : 'bg-slate-300'
                  } ${isSaving ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:opacity-90'}`}
                  title={enabled ? 'Nonaktifkan dari KPI' : 'Aktifkan ke KPI'}>
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform"
                    style={{ transform: enabled ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </button>
              </div>
            );
          })}
        </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      {notification && (
        <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shrink-0 ${
          notification.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {notification.type === 'success' ? '✅' : '❌'} {notification.msg}
        </div>
      )}

      <div className="px-5 pt-4 pb-3 shrink-0">
        <StripInfo icon="🎯" judul="KPI Roster"
          keterangan={<>Hanya anggota yang <strong>diaktifkan</strong> di sini yang akan muncul &amp; dinilai di halaman KPI Team.</>}
          angka={loading ? undefined : activeCount}
          satuan={`aktif dari ${users.length}`} />

        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterTeam('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              filterTeam === 'all' ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}>
            <IkonTeks nama="🌐" />Semua Tim
          </button>
          {teamNames.map(t => {
            const pal = TEAM_PALETTE[t] ?? FALLBACK_PALETTE[teamNames.indexOf(t) % FALLBACK_PALETTE.length];
            const aktifPilih = filterTeam === t;
            return (
              <button key={t}
                onClick={() => setFilterTeam(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                style={aktifPilih
                  ? { background: pal.color, color: '#fff', borderColor: pal.color }
                  : { background: '#fff', color: '#64748b', borderColor: '#e2e8f0' }}>
                {cariKelompok(t)?.label ?? t.replace('Team PTS ', '')}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 rounded-full border-2 border-t-sky-600 border-sky-200 animate-spin" />
          </div>
        ) : (
          <>
            {teamNames.filter(t => filterTeam === 'all' || filterTeam === t).map(t => {
              const pal = TEAM_PALETTE[t] ?? FALLBACK_PALETTE[teamNames.indexOf(t) % FALLBACK_PALETTE.length];
              return (
                <TeamSection key={t}
                  members={filtered.filter(u => u.team_type === t)}
                  label={t}
                  color={pal.color}
                  bg={pal.bg}
                  border={pal.border}
                />
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-sm">Tidak ada anggota ditemukan.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
