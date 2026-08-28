/**
 * lib/urutan-soal.ts - aturan urutan soal di Bank Soal.
 *
 * Dipisah dari komponennya karena ini logika murni yang menentukan apa yang
 * benar-benar ditulis ke database, dan hal semacam itu pantas bisa diuji tanpa
 * merender apa pun. Lihat uji/urutan-soal.mjs.
 */

/** Bentuk seminimal mungkin - sengaja tidak mengimpor tipe Question penuh. */
export interface SoalTerurut {
  id: string;
  urutan?: number | null;
  created_at?: string;
}

/**
 * Urutan tampil di dalam satu grup.
 *
 * Yang sudah bernomor selalu di atas yang belum. Sebabnya: satu grup bisa
 * berisi campuran - soal lama yang sudah diatur dan soal baru yang belum
 * tersentuh - dan menyelipkan yang belum bernomor ke tengah membuat susunan
 * yang tadi disusun tangan tampak berantakan sendiri.
 *
 * Yang belum bernomor jatuh ke created_at menurun, yaitu perilaku sebelum
 * kolom `urutan` ada. Tanpa itu, daftar pada pemasangan yang SQL-nya belum
 * dijalankan akan berubah urutan tanpa ada yang mengubahnya.
 */
export function bandingkanUrutan(a: SoalTerurut, b: SoalTerurut): number {
  const ua = a.urutan ?? null;
  const ub = b.urutan ?? null;
  if (ua !== null && ub !== null && ua !== ub) return ua - ub;
  if (ua !== null && ub === null) return -1;
  if (ua === null && ub !== null) return 1;
  return (b.created_at ?? '').localeCompare(a.created_at ?? '');
}

/**
 * Nomor baru untuk sebuah susunan - HANYA baris yang nomornya berubah.
 *
 * Sesudah satu grup bernomor rapi, menukar dua soal menghasilkan dua
 * perubahan, bukan seluruh isi grup. Untuk grup berisi puluhan soal bedanya
 * nyata, dan menyangkut kuota yang sama yang dijaga di seluruh platform ini.
 */
export function perubahanUrutan(susunanBaru: SoalTerurut[]): { id: string; urutan: number }[] {
  return susunanBaru
    .map((q, i) => ({ id: q.id, urutan: i + 1, lama: q.urutan ?? null }))
    .filter(x => x.lama !== x.urutan)
    .map(({ id, urutan }) => ({ id, urutan }));
}

/**
 * Susunan setelah satu soal digeser satu langkah.
 *
 * Mengembalikan `null` bila geserannya keluar batas, supaya pemanggilnya tidak
 * perlu memeriksa dua kali - tombol di ujung daftar memang tidak melakukan apa
 * pun, dan itu diputuskan di satu tempat saja.
 */
export function geser<T extends SoalTerurut>(daftar: T[], idx: number, arah: -1 | 1): T[] | null {
  const tujuan = idx + arah;
  if (idx < 0 || idx >= daftar.length) return null;
  if (tujuan < 0 || tujuan >= daftar.length) return null;
  const baru = [...daftar];
  [baru[idx], baru[tujuan]] = [baru[tujuan], baru[idx]];
  return baru;
}

/** Nomor untuk soal yang baru ditambahkan: di ekor grupnya. */
export function nomorBerikutnya(grup: SoalTerurut[]): number {
  return Math.max(0, ...grup.map(q => q.urutan ?? 0)) + 1;
}
