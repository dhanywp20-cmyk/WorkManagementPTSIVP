'use client';

import { useKelompokCabang, namaKelompokCabang } from '@/lib/kelompok/inti';
import { Ikon } from '@/components/shared/Ikon';

export type TeamFilter = 'PTS' | 'PTS Daerah' | 'Sales' | 'Marketing';

export const TEAM_FILTER_CONFIG: Record<TeamFilter, { label: string; emoji: string; activeClass: string }> = {
  PTS:           { label: 'PTS',        emoji: '🔵', activeClass: 'bg-indigo-600 text-white' },
  'PTS Daerah':  { label: 'PTS Daerah', emoji: '🟢', activeClass: 'bg-emerald-600 text-white' },
  Sales:         { label: 'Sales',      emoji: '🟠', activeClass: 'bg-orange-500 text-white' },
  Marketing:     { label: 'Marketing',  emoji: '🟣', activeClass: 'bg-purple-600 text-white' },
};

export function isPTSDaerahUser(u: { teamType?: string | null; team_type?: string | null }): boolean {
  const tt = (u.teamType ?? u.team_type ?? '').trim();
  return tt !== '' && namaKelompokCabang().includes(tt);
}

export function matchesTeamFilter(
  u: { role?: string | null; salesDivision?: string | null; sales_division?: string | null; teamType?: string | null; team_type?: string | null },
  filter: TeamFilter,
): boolean {
  const role = (u.role ?? '').toLowerCase();
  const sd = u.salesDivision ?? u.sales_division ?? '';
  if (filter === 'PTS')        return role === 'team' && !isPTSDaerahUser(u);
  if (filter === 'PTS Daerah') return role === 'team' && isPTSDaerahUser(u);
  if (filter === 'Sales')      return ['sales', 'guest'].includes(role) && !sd.startsWith('Marketing:');
  if (filter === 'Marketing')  return ['sales', 'guest'].includes(role) && sd.startsWith('Marketing:');
  return false;
}

export function TeamSwitch({ active, onChange }: { active: TeamFilter; onChange: (t: TeamFilter) => void }) {
  const cabang = useKelompokCabang();
  const daftar = (Object.keys(TEAM_FILTER_CONFIG) as TeamFilter[])
    .filter(t => t !== 'PTS Daerah' || cabang.length > 0);

  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
      {daftar.map(t => {
        const cfg = TEAM_FILTER_CONFIG[t];
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            aria-pressed={active === t}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              active === t ? cfg.activeClass + ' shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Ikon nama={cfg.emoji} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {cfg.label}
          </button>
        );
      })}
    </div>
  );
}
