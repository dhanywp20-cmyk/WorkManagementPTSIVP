'use client';

/**
 * Penyaring tim untuk Learning Center - SATU sumber untuk Dashboard admin dan
 * halaman Analytics.
 *
 * Sebelumnya tipe, konfigurasi, fungsi pencocokan, dan komponen tombolnya
 * DISALIN UTUH di AdminDashboard.tsx dan AnalyticsPage.tsx. Menambah satu
 * penyaring berarti menyunting keduanya, dan yang terlewat akan membuat tab
 * itu ada di satu layar tapi tidak di layar lain - tanpa pesan apa pun.
 */

import { useKelompokCabang, namaKelompokCabang } from '@/lib/kelompok';

export type TeamFilter = 'PTS' | 'PTS Daerah' | 'Sales' | 'Marketing';

export const TEAM_FILTER_CONFIG: Record<TeamFilter, { label: string; emoji: string; activeClass: string }> = {
  PTS:           { label: 'PTS',        emoji: '🔵', activeClass: 'bg-indigo-600 text-white' },
  'PTS Daerah':  { label: 'PTS Daerah', emoji: '🟢', activeClass: 'bg-emerald-600 text-white' },
  Sales:         { label: 'Sales',      emoji: '🟠', activeClass: 'bg-orange-500 text-white' },
  Marketing:     { label: 'Marketing',  emoji: '🟣', activeClass: 'bg-purple-600 text-white' },
};

/**
 * Anggota kelompok bertanda "PTS Cabang" di Admin Panel -> Kelompok.
 *
 * Dipisahkan dari tab PTS karena mereka mitra daerah, bukan tim internal
 * harian - mencampurnya membuat rata-rata nilai tim internal ikut bergeser,
 * dan itulah yang membuat pemantauannya tidak bisa dibaca terpisah.
 */
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
  //  PTS = tim internal SAJA. PTS Daerah sengaja dikeluarkan dari sini,
  //  bukan hanya ditambahkan sebagai tab baru - kalau ia tetap ikut terhitung
  //  di tab PTS, "terpisah" cuma jadi nama.
  if (filter === 'PTS')        return role === 'team' && !isPTSDaerahUser(u);
  if (filter === 'PTS Daerah') return role === 'team' && isPTSDaerahUser(u);
  if (filter === 'Sales')      return ['sales', 'guest'].includes(role) && !sd.startsWith('Marketing:');
  if (filter === 'Marketing')  return ['sales', 'guest'].includes(role) && sd.startsWith('Marketing:');
  return false;
}

export function TeamSwitch({ active, onChange }: { active: TeamFilter; onChange: (t: TeamFilter) => void }) {
  /*
    Tab "PTS Daerah" hanya muncul kalau memang ADA kelompok bertanda PTS
    Cabang. Perusahaan yang tidak memakainya tidak perlu melihat tab yang
    selalu kosong - dan tab kosong tanpa penjelasan lebih membingungkan
    daripada tab yang tidak ada.
  */
  const cabang = useKelompokCabang();
  const daftar = (Object.keys(TEAM_FILTER_CONFIG) as TeamFilter[])
    .filter(t => t !== 'PTS Daerah' || cabang.length > 0);

  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 flex-shrink-0">
      {daftar.map(t => {
        const cfg = TEAM_FILTER_CONFIG[t];
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            aria-pressed={active === t}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              active === t ? cfg.activeClass + ' shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {cfg.emoji} {cfg.label}
          </button>
        );
      })}
    </div>
  );
}
