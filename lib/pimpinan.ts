/**
 * Akun PIMPINAN (mis. Direktur): melihat SEMUA data di setiap menu tanpa filter
 * "milik saya" seperti Sales/Marketing lain, tetapi HANYA BACA.
 *
 * Pengaturan per akun (users.pimpinan, Kelola Akun), bukan dikodekan ke jabatan.
 * Penjaga yang sebenarnya ada di basis data (migrasi 034: boleh_lihat_* meloloskan
 * pimpinan; kebijakan RESTRICTIVE menolak INSERT/UPDATE/DELETE). Fungsi di sini
 * hanya cermin untuk antarmuka: melewati saringan klien dan menyembunyikan tombol
 * tambah/ubah/hapus supaya tidak menampilkan aksi yang pasti ditolak.
 */
/** Longgar (unknown): tiap modul punya tipe `User` lokal sendiri yang belum memuat field ini. */
export function isPimpinan(user: unknown): boolean {
  return !!user && (user as { pimpinan?: unknown }).pimpinan === true;
}

/**
 * Daftar id akun pimpinan, untuk menyaring mereka dari pilihan "Sales" (dropdown
 * Sales di form request, project progress, dst) - pimpinan bukan pemilik project.
 * Toleran: bila kolom belum ada (migrasi 034 belum dijalankan) hasilnya kosong.
 */
export async function muatIdPimpinan(
  klien: { from: (t: string) => any },   // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<Set<string>> {
  try {
    const { data, error } = await klien.from('users').select('id').eq('pimpinan', true);
    if (error || !Array.isArray(data)) return new Set();
    return new Set((data as { id: string }[]).map(r => r.id));
  } catch { return new Set(); }
}

/** Pesan bila aksi tulis tetap tertembus (mis. tombol yang belum disembunyikan). */
export const PESAN_HANYA_LIHAT = 'Akun pimpinan hanya bisa melihat data - tidak bisa menambah, mengubah, atau menghapus.';
