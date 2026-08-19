/**
 * lib/teams.ts - daftar Team PTS yang boleh di-assign tugas di platform kerja.
 *
 * Dipakai di dropdown "assign ke tim" pada Reminder Schedule, Ticket Troubleshooting,
 * dan Request Design Project. Piket Showroom PUNYA daftar sendiri (memang menyertakan
 * Team PTS UMP) - TIDAK memakai konstanta ini.
 *
 *  Untuk menampilkan/menyembunyikan sebuah team di SEMUA dropdown assign sekaligus,
 *   cukup ubah daftar di bawah ini (satu tempat) - tidak perlu sunting tiap platform.
 */
export const ASSIGNABLE_PTS_TEAMS = ['Team PTS IVP', 'Team PTS MVI'] as const;

export function isAssignablePTSTeam(teamType?: string | null): boolean {
  return !!teamType && (ASSIGNABLE_PTS_TEAMS as readonly string[]).includes(teamType);
}
