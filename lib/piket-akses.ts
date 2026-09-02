/**
 * lib/piket-akses.ts - siapa boleh melihat & mengisi apa di Piket Showroom.
 *
 * Dua pertanyaan berbeda yang selama ini tercampur:
 *
 *   1. Siapa boleh MELIHAT catatan tamu (piket_tamu_detail)?
 *   2. Siapa boleh MENGISI / MENYUNTING kegiatannya?
 *
 * Sebelumnya jawaban pertanyaan (1) diambil dari hitungLingkupProject() -
 * aturan yang ditulis untuk Sales, dan benar untuk Sales - sementara
 * pertanyaan (2) tidak pernah dijawab sama sekali: tombol Edit dirender
 * tanpa syarat apa pun, jadi tamu mana pun yang punya menunya bisa
 * menyunting catatan hari itu.
 *
 * Berkas ini menjawab keduanya, dan sengaja MURNI (tanpa Supabase) supaya
 * aturan yang sama bisa dipakai layar maupun route server.
 */

/** Bentuk longgar - tiap modul punya tipe User lokalnya sendiri. */
export interface PenggunaPiket {
  role?: string | null;
  team_type?: string | null;
  access_level?: string | null;
  piket_akses?: string | null;
}

export type LingkupPiket = 'lingkup' | 'semua';

export const LABEL_PIKET_AKSES: Record<LingkupPiket, string> = {
  lingkup: 'Sesuai divisi',
  semua: 'Semua catatan',
};

export const JELAS_PIKET_AKSES: Record<LingkupPiket, string> = {
  lingkup: 'Hanya catatan tamu atas namanya sendiri / divisinya. Bawaan untuk Sales & Marketing.',
  semua: 'Melihat seluruh catatan tamu showroom — untuk resepsionis / front desk. Tetap tidak bisa menyunting.',
};

function peran(u: PenggunaPiket | null | undefined): string {
  return (u?.role ?? '').toLowerCase();
}

/**
 * Tim PTS (termasuk admin) - merekalah yang benar-benar bertugas piket.
 *
 * Dipakai untuk hak MENGISI, bukan hak melihat. Orang yang piket hari itulah
 * yang mencatat tamunya; Sales dan resepsionis membaca hasilnya.
 */
export function adalahPTS(u: PenggunaPiket | null | undefined): boolean {
  return ['admin', 'superadmin', 'team', 'team_pts'].includes(peran(u));
}

/**
 * Boleh melihat SELURUH catatan tamu, tanpa batas divisi.
 *
 * Tim PTS selalu boleh - mereka yang mencatatnya. Selain itu hanya akun yang
 * memang disetel 'semua' dari Kelola Akun (resepsionis / front desk). Yang
 * lain tetap dibatasi hitungLingkupProject() seperti sebelumnya: daftar
 * kunjungan pelanggan divisi tetangga bukan urusan Sales divisi lain.
 */
export function bisaLihatSemuaTamu(u: PenggunaPiket | null | undefined): boolean {
  if (adalahPTS(u)) return true;
  return (u?.piket_akses ?? '') === 'semua';
}

/**
 * Boleh mengisi & menyunting kegiatan piket.
 *
 * HANYA Tim PTS dan admin. Tombol Edit dulu dirender tanpa syarat - siapa pun
 * yang diberi menu Piket Showroom bisa mengubah catatan hari itu, termasuk
 * akun Sales dan resepsionis yang seharusnya hanya membaca.
 */
export function bisaIsiKegiatan(u: PenggunaPiket | null | undefined): boolean {
  return adalahPTS(u);
}

/** Nilai yang sah untuk disimpan ke kolom - dipakai route server sebelum menulis. */
export function lingkupPiketSah(v: unknown): LingkupPiket | null {
  return v === 'lingkup' || v === 'semua' ? v : null;
}
