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

/**
 * Boleh muncul di dropdown penerima tugas?
 *
 * Dua syarat, dan keduanya berbeda pertanyaan:
 *   1. TIM-nya memang tim yang ditugaskan pekerjaan (isAssignablePTSTeam)
 *   2. ORANG-nya tidak dikecualikan admin lewat toggle bisa_ditugaskan
 *
 * Syarat kedua ada karena sebuah tim yang mengerjakan pekerjaan tetap punya
 * anggota yang perannya menyetujui, bukan mengerjakan - Manager, misalnya.
 * Sebelumnya hal itu ditangani Ticketing dengan `jabatan !== 'Manager'` yang
 * dipaku di kode, sementara Reminder Schedule dan Design Project tidak
 * menanganinya sama sekali; akibatnya Supervisor bisa - dan pernah -
 * meng-assign pekerjaan ke Manager karena namanya memang ditawarkan.
 *
 * Dijawab lewat data, bukan jabatan: perusahaan lain yang memakai platform
 * ini bisa saja Manager-nya memang ikut mengerjakan, dan mereka harus bisa
 * mengaturnya dari Admin Panel tanpa menyunting kode.
 *
 * Nilai undefined/null DIANGGAP BOLEH - supaya baris lama (dan pemasangan
 * yang belum menjalankan migrasinya) tidak mendadak menghilang dari seluruh
 * dropdown, yang jauh lebih merusak daripada satu nama yang kelebihan.
 */
export function bolehDitugaskan(u: {
  team_type?: string | null;
  bisa_ditugaskan?: boolean | null;
}): boolean {
  if (!isAssignablePTSTeam(u.team_type)) return false;
  return u.bisa_ditugaskan !== false;
}
