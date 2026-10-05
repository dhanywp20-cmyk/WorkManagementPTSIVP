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
  /** 'lingkup' = dibatasi (pilihan eksplisit); kosong / 'semua' = melihat semua (bawaan). */
  piket_akses?: string | null;
  /** true = akun non-PTS boleh mengisi & menyunting kegiatan (bawaan false = lihat & export saja). */
  piket_ubah?: boolean | null;
}

export type LingkupPiket = 'lingkup' | 'semua';

export const LABEL_PIKET_AKSES: Record<LingkupPiket, string> = {
  lingkup: 'Sesuai divisi',
  semua: 'Semua catatan',
};

export const JELAS_PIKET_AKSES: Record<LingkupPiket, string> = {
  lingkup: 'Dibatasi: hanya catatan atas namanya / divisinya (plus kegiatan internal). Pilih hanya bila akun ini memang tidak boleh melihat kunjungan lain.',
  semua: 'Bawaan: melihat seluruh catatan tamu showroom dan boleh export Excel.',
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
 * BAWAAN: semua akun yang punya menu Piket Showroom (keputusan pemilik -
 * Sales/Marketing melihat semuanya dan hanya dibatasi mengisi/menyunting).
 * Hanya akun yang di Kelola Akun disetel 'lingkup' yang tetap dibatasi
 * hitungLingkupProject(). Tim PTS selalu melihat semuanya.
 *
 * Aturan yang SAMA dijaga di database (piket_akses_semua(), migrasi 033);
 * ini hanya cermin untuk layar - bukan penjaga.
 */
export function bisaLihatSemuaTamu(u: PenggunaPiket | null | undefined): boolean {
  if (adalahPTS(u)) return true;
  return (u?.piket_akses ?? '') !== 'lingkup';
}

/**
 * Boleh mengisi & menyunting kegiatan piket.
 *
 * Tim PTS dan admin (yang bertugas piket), ATAU akun yang diberi pengaturan
 * "boleh mengisi" di Kelola Akun (users.piket_ubah). Bawaan akun lain: lihat &
 * export saja. Penjaga sebenarnya ada di database (piket_boleh_ubah(),
 * migrasi 032) - tombol di layar hanya cermin.
 */
export function bisaIsiKegiatan(u: PenggunaPiket | null | undefined): boolean {
  return adalahPTS(u) || u?.piket_ubah === true;
}

/** Nilai yang sah untuk disimpan ke kolom - dipakai route server sebelum menulis. */
export function lingkupPiketSah(v: unknown): LingkupPiket | null {
  return v === 'lingkup' || v === 'semua' ? v : null;
}
