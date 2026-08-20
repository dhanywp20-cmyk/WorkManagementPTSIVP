/**
 * lib/identitas.ts - mengikat baris ke ORANGNYA, bukan ke tulisan namanya.
 *
 * Setiap tabel yang mencatat kepemilikan kini punya dua kolom berdampingan,
 * dan keduanya menjawab pertanyaan yang berbeda:
 *
 *   sales_user_id (uuid)  SIAPA - dipakai pencocokan, assign, notifikasi, RLS
 *   sales_name    (teks)  TERCATAT SEBAGAI SIAPA - tampilan, riwayat, cetak
 *
 * Nama sengaja tidak dibuang. Ia potret siapa orang itu saat baris dibuat;
 * kalau riwayat di-JOIN ke akun, mengganti nama seseorang akan menulis ulang
 * seluruh sejarahnya.
 *
 * Selama masa peralihan, baris lama masih banyak yang uuid-nya kosong - lihat
 * sql/identitas-uuid.sql, yang sengaja menolak menebak nama ambigu. Karena itu
 * pembacaan memakai filterIdentitas(): cocok lewat uuid ATAU lewat nama.
 * Begitu kolom uuid terisi merata, klausa namanya bisa dicabut.
 */

export interface OrangRingkas {
  id: string;
  full_name?: string | null;
  username?: string | null;
}

/**
 * Cari id orang dari namanya - HANYA bila jawabannya tidak meragukan.
 *
 * Mengembalikan null bila namanya dimiliki lebih dari satu akun. Satu kantor
 * bisa punya dua orang bernama sama, dan menebak akan mengikat pekerjaan
 * seseorang ke orang lain - kesalahan yang tidak akan pernah terlihat dari
 * layar. Null berarti "pakai nama saja seperti dulu", dan itu tetap benar.
 */
export function idDariNama(
  orang: readonly OrangRingkas[] | null | undefined,
  nama: string | null | undefined,
): string | null {
  const cari = (nama ?? '').trim();
  if (!cari || !orang?.length) return null;
  const cocok = orang.filter(o => (o.full_name ?? '').trim() === cari);
  return cocok.length === 1 ? cocok[0].id : null;
}

/** Cari id dari username. Username unik, jadi tidak perlu penjagaan ambiguitas. */
export function idDariUsername(
  orang: readonly OrangRingkas[] | null | undefined,
  username: string | null | undefined,
): string | null {
  const cari = (username ?? '').trim().toLowerCase();
  if (!cari || !orang?.length) return null;
  return orang.find(o => (o.username ?? '').trim().toLowerCase() === cari)?.id ?? null;
}

/**
 * Kutip nilai untuk dipakai di dalam PostgREST .or().
 *
 * Nama bisa memuat koma, dan tanpa kutip PostgREST membacanya sebagai pemisah
 * kondisi - filternya jadi melar, yaitu justru membuka data yang seharusnya
 * tertutup. Tanda kutip di dalam nilai dibuang, bukan di-escape, supaya tidak
 * ada celah penyisipan sintaks.
 */
export function kutipNilai(v: string | null | undefined): string {
  return `"${(v ?? '').replace(/"/g, '')}"`;
}

/**
 * Filter PostgREST untuk "milik orang ini", lewat uuid ATAU nama.
 *
 * Nilai nama dikutip ganda karena nama bisa memuat koma - tanpa kutip,
 * PostgREST membacanya sebagai pemisah kondisi dan filternya jadi melar, yaitu
 * justru membuka data yang seharusnya tertutup. Tanda kutip di dalam nilai
 * dibuang, bukan di-escape, supaya tidak ada celah penyisipan sintaks.
 *
 * Mengembalikan null bila tidak ada satu pun yang bisa dicocokkan; pemanggil
 * WAJIB memperlakukan itu sebagai "tidak ada hasil", bukan "tanpa filter".
 */
export function filterIdentitas(
  kolomId: string, id: string | null | undefined,
  kolomNama: string, nama: string | null | undefined,
): string | null {
  const bagian: string[] = [];
  if (id) bagian.push(`${kolomId}.eq.${id}`);
  const n = (nama ?? '').trim().replace(/"/g, '');
  if (n) bagian.push(`${kolomNama}.eq."${n}"`);
  return bagian.length ? bagian.join(',') : null;
}

/**
 * Pasangan kolom yang ditulis bersamaan saat membuat atau mengalihkan baris.
 *
 * Dipakai supaya tidak ada satu pun tempat yang menulis nama tanpa uuid -
 * begitu itu terjadi, baris baru lahir dengan cacat yang sama seperti data
 * lama, dan seluruh perpindahan ini kehilangan gunanya.
 */
export function pasanganIdentitas(
  kolomId: string, kolomNama: string,
  id: string | null | undefined, nama: string | null | undefined,
): Record<string, unknown> {
  return {
    [kolomNama]: (nama ?? '').trim() || null,
    [kolomId]: id ?? null,
  };
}

// ─── Jalur mundur selama masa peralihan ──────────────────────────────────────
//
//  Kolom uuid baru ada setelah sql/identitas-uuid.sql dijalankan. Selama belum,
//  PostgREST menolak SELURUH baris kalau ada satu kolom yang tidak dikenalnya -
//  bukan cuma mengabaikan kolom itu. Artinya, tanpa penjagaan di bawah ini,
//  men-deploy kode ini sebelum SQL-nya jalan akan membuat SETIAP pembuatan
//  ticket, jadwal, dan request gagal total.
//
//  Karena itu penulisan dicoba dua kali: sekali dengan kolom uuid, dan kalau
//  basis datanya memang belum punya kolomnya, sekali lagi tanpa kolom itu.
//  Urutan deploy jadi tidak lagi menentukan.
//
//  BOLEH DIHAPUS setelah sql/identitas-uuid.sql dipastikan sudah jalan di semua
//  basis data. Sampai saat itu, biarkan.

const KOLOM_IDENTITAS = ['sales_user_id', 'assign_user_id', 'guest_user_id', 'pic_user_id'] as const;

interface GalatRingkas { message?: string | null; code?: string | null }

/** Benar hanya bila galatnya berbunyi "kolom identitas itu tidak ada di sini". */
export function kolomIdentitasBelumAda(galat: GalatRingkas | null | undefined): boolean {
  if (!galat) return false;
  const pesan = (galat.message ?? '').toLowerCase();
  if (!KOLOM_IDENTITAS.some(k => pesan.includes(k))) return false;
  return galat.code === 'PGRST204' || pesan.includes('column') || pesan.includes('schema cache');
}

/** Salinan baris tanpa kolom uuid - isi jalur mundurnya. */
export function tanpaIdentitas<T extends Record<string, unknown>>(baris: T): T {
  const salinan: Record<string, unknown> = { ...baris };
  for (const k of KOLOM_IDENTITAS) delete salinan[k];
  return salinan as T;
}

/**
 * Jalankan satu query, dan ulangi tanpa kolom uuid bila kolomnya belum ada.
 *
 * Dipakai untuk pembacaan maupun penulisan: filter .or() yang menyebut kolom
 * tak dikenal ditolak sama kerasnya dengan insert yang menyebutnya.
 *
 * `jalankan(true)` memakai kolom uuid, `jalankan(false)` tidak. Galat lain apa
 * pun diteruskan apa adanya - jalur mundur ini HANYA untuk kolom yang belum
 * ada, bukan penyembunyi kegagalan.
 */
export async function cobaIdentitas<H extends { error: GalatRingkas | null }>(
  jalankan: (pakaiUuid: boolean) => Promise<H>,
): Promise<H> {
  const hasil = await jalankan(true);
  return kolomIdentitasBelumAda(hasil.error) ? jalankan(false) : hasil;
}
