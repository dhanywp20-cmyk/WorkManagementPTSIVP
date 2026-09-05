/**
 * lib/jabatan.ts - hierarki jabatan & aturan CC eskalasi, satu sumber kebenaran.
 *
 * Sebelumnya JABATAN_TIER/JABATAN_CC_RULES disalin persis di 4 berkas
 * shared.ts berbeda (dashboard, analytics-dashboard, ticketing,
 * form-require-project) - menambah satu jabatan atau mengubah aturan CC
 * berarti menyunting 4 tempat, dan satu yang terlewat membuat aturan
 * eskalasi berbeda-beda tanpa sengaja antar modul.
 */

export const JABATAN_LIST = ['Staff', 'Supervisor', 'Manager', 'Deputy General Manager', 'General Manager', 'Direktur'] as const;
export type JabatanType = typeof JABATAN_LIST[number];

// Record<string, number> (bukan Record<JabatanType, number>) - dipakai untuk
// mengindeks jabatan dinamis (mis. user.jabatan) yang tipenya string biasa,
// bukan literal union JabatanType.
export const JABATAN_TIER: Record<string, number> = {
  'Staff': 1, 'Supervisor': 2, 'Manager': 3,
  'Deputy General Manager': 4, 'General Manager': 5, 'Direktur': 6,
};

// Rules CC otomatis: jabatan sender -> list jabatan yang wajib di-CC
export const JABATAN_CC_RULES: Record<JabatanType, JabatanType[]> = {
  'Staff':                   ['Supervisor', 'Manager', 'Deputy General Manager', 'General Manager'],
  'Supervisor':              ['Manager', 'Deputy General Manager', 'General Manager'],
  'Manager':                 ['General Manager', 'Deputy General Manager', 'Direktur'],
  'Deputy General Manager':  ['General Manager', 'Direktur'],
  'General Manager':         ['Direktur'],
  'Direktur':                [],
};

// Tampilan (ikon/warna) per jabatan - dipakai dashboard & analytics-dashboard.
export const JABATAN_CONFIG: Record<JabatanType, { icon: string; color: string; bg: string; border: string; tier: number }> = {
  'Staff':                  { icon: '👤', color: '#374151', bg: '#f9fafb',   border: '#d1d5db', tier: 1 },
  'Supervisor':             { icon: '👥', color: '#1e40af', bg: '#eff6ff',   border: '#93c5fd', tier: 2 },
  'Manager':                { icon: '🏅', color: '#7e22ce', bg: '#faf5ff',   border: '#c4b5fd', tier: 3 },
  'Deputy General Manager': { icon: '🎖️', color: '#b45309', bg: '#fffbeb',   border: '#fcd34d', tier: 4 },
  'General Manager':        { icon: '🌟', color: '#065f46', bg: '#ecfdf5',   border: '#6ee7b7', tier: 5 },
  'Direktur':               { icon: '👑', color: '#991b1b', bg: '#fff1f2',   border: '#fca5a5', tier: 6 },
};
