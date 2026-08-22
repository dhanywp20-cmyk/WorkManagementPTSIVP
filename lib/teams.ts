/**
 * lib/teams.ts - daftar Team PTS yang boleh di-assign tugas di platform kerja.
 *
 * Dipakai dropdown "assign ke tim" pada Reminder Schedule, Ticket
 * Troubleshooting, dan Request Design Project - dan, lewat modal-notifikasi,
 * ikut menentukan siapa yang berhak melihat lonceng ketiga platform itu.
 *
 * Daftarnya TIDAK lagi ditulis di sini: sumbernya lib/kelompok.ts, yang
 * membacanya dari database supaya kelompok baru bisa ditambahkan dari Admin
 * Panel tanpa deploy. Berkas ini tinggal jembatan tipis, dipertahankan supaya
 * berkas yang sudah mengimpornya tidak perlu ikut berubah.
 *
 * Piket Showroom PUNYA daftar sendiri (memang menyertakan Team PTS UMP) -
 * TIDAK memakai konstanta ini.
 */
import { kelompokDitugaskan, KELOMPOK_BAWAAN } from './kelompok';

/**
 * Nilai bawaan, dipakai di luar React dan saat pengaturannya belum termuat.
 * Bukan lagi sumber kebenaran - gunakan isAssignablePTSTeam() atau
 * daftarTimDitugaskan() supaya kelompok yang baru ditambahkan ikut terbaca.
 */
export const ASSIGNABLE_PTS_TEAMS = KELOMPOK_BAWAAN
  .filter(k => k.ditugaskan)
  .map(k => k.nama) as readonly string[];

/** Nama team_type yang sedang boleh ditugaskan pekerjaan. */
export function daftarTimDitugaskan(): string[] {
  return kelompokDitugaskan().map(k => k.nama);
}

export function isAssignablePTSTeam(teamType?: string | null): boolean {
  const t = (teamType ?? '').trim();
  if (!t) return false;
  return daftarTimDitugaskan().includes(t);
}
