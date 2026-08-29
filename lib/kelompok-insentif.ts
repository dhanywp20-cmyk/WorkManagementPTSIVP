/**
 * lib/kelompok-insentif.ts - kapan beberapa jadwal dihitung SATU proyek insentif.
 *
 * Dua sebab jadwal terbelah, dan keduanya sah:
 *
 *   batch_id            satu pengiriman form untuk beberapa hari sekaligus
 *                       (jadwal 5 hari berturut-turut).
 *   incentive_group_id  jadwal-jadwal terpisah yang ternyata satu proyek
 *                       (Konfigurasi Senin, Training tiga hari kemudian).
 *
 * Bedanya penting: batch_id terbentuk sendiri dari cara form dikirim, sedangkan
 * incentive_group_id HANYA diisi oleh keputusan manusia. Tidak ada satu baris
 * pun di berkas ini yang mengelompokkan berdasar tebakan - yang ada cuma
 * penggabungan menurut penanda yang sudah ditetapkan, dan pendeteksi yang
 * MENANDAI kandidat tanpa pernah menggabungkannya sendiri.
 *
 * Alasan pemisahan itu ada di sql/incentive-kelompok-proyek.sql: penggabungan
 * otomatis yang keliru tidak terlihat siapa pun, sementara duplikat yang
 * dibiarkan cepat ketahuan. Untuk data uang, kesalahan yang terlihat jauh lebih
 * baik daripada yang tersembunyi.
 */

export interface BarisKelompok {
  id: string;
  project_name?: string | null;
  category?: string | null;
  assign_name?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  bast_date?: string | null;
  batch_id?: string | null;
  incentive_group_id?: string | null;
}

/** Rapikan spasi, abaikan besar-kecil huruf. Untuk MEMBANDINGKAN, bukan menampilkan. */
export function normalkanNama(v: string | null | undefined): string {
  return (v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Penanda satuan proyek untuk sebuah baris.
 *
 * Kelompok manusia menang atas batch: dua jadwal 5-hari yang digabungkan
 * menjadi satu proyek harus melebur seluruhnya, bukan tetap dua.
 */
export function kunciProyek(r: BarisKelompok): string {
  if (r.incentive_group_id) return `grup:${r.incentive_group_id}`;
  if (r.batch_id) return `batch:${r.batch_id}::${r.assigned_to ?? ''}`;
  return `baris:${r.id}`;
}

/**
 * Satu baris wakil per proyek.
 *
 * Yang dipertahankan: due_date PALING AKHIR. Untuk pekerjaan berhari-hari,
 * tanggal selesai itulah yang menentukan jendela tahun insentif dan yang cocok
 * dengan tanggal BAST - bukan hari pertama tim berangkat.
 *
 * Kunci batch menyertakan penangan, sebab satu batch bisa berisi lebih dari
 * satu orang (form mengalikan daftar orang dengan daftar tanggal). Menggabung
 * per batch saja akan menjatuhkan penangan kedua, dan di layar insentif itu
 * berarti seseorang kehilangan haknya tanpa ada yang menyadarinya.
 */
export function gabungkanProyek<T extends BarisKelompok>(baris: T[]): T[] {
  const terpilih = new Map<string, T>();
  for (const r of baris) {
    const k = kunciProyek(r);
    const ada = terpilih.get(k);
    if (!ada) { terpilih.set(k, r); continue; }
    const lebihBaru = (r.due_date ?? '') > (ada.due_date ?? '')
      || ((r.due_date ?? '') === (ada.due_date ?? '') && r.id < ada.id);
    if (lebihBaru) terpilih.set(k, r);
  }
  return [...terpilih.values()]
    .sort((a, b) => (b.due_date ?? '').localeCompare(a.due_date ?? ''));
}

export interface KandidatGabung {
  /** Nama apa adanya dari baris pertama - untuk ditampilkan, bukan dibandingkan. */
  nama: string;
  bast_date: string;
  /** Baris wakil dari tiap jadwal yang dicurigai satu proyek. */
  anggota: BarisKelompok[];
}

/**
 * Cari jadwal yang KEMUNGKINAN satu proyek. Hanya menandai - tidak menggabungkan.
 *
 * Penandanya tanggal BAST, bukan kemiripan nama. Alasannya: tanggal BAST sudah
 * WAJIB diisi handler saat menekan Completed, dan satu proyek = satu dokumen
 * BAST = satu tanggal. Dua kontrak berbeda untuk klien yang sama akan punya
 * BAST berbeda, jadi tetap terpisah sebagaimana mestinya.
 *
 * Nama tetap ikut diperiksa: dua proyek berbeda bisa saja diserahterimakan pada
 * hari yang sama, dan tanggal saja akan menyatukan hal-hal yang tak
 * berhubungan.
 *
 * Yang sudah punya incentive_group_id dilewati - keputusannya sudah diambil.
 */
export function deteksiKandidatGabung(baris: BarisKelompok[]): KandidatGabung[] {
  const peta = new Map<string, BarisKelompok[]>();

  for (const r of gabungkanProyek(baris)) {
    if (r.incentive_group_id) continue;      // sudah diputuskan manusia
    if (!r.bast_date) continue;              // tanpa BAST tidak ada penanda yang bisa dipercaya
    const nama = normalkanNama(r.project_name);
    if (!nama) continue;
    const k = `${nama}::${r.bast_date}`;
    if (!peta.has(k)) peta.set(k, []);
    peta.get(k)!.push(r);
  }

  const hasil: KandidatGabung[] = [];
  for (const anggota of peta.values()) {
    if (anggota.length < 2) continue;
    hasil.push({
      nama: (anggota[0].project_name ?? '').trim(),
      bast_date: anggota[0].bast_date ?? '',
      anggota,
    });
  }
  return hasil.sort((a, b) => b.bast_date.localeCompare(a.bast_date));
}

/** Id baris yang perlu diberi incentive_group_id bila sebuah kandidat digabungkan. */
export function idUntukDigabung(kandidat: KandidatGabung, semua: BarisKelompok[]): string[] {
  /*
    Bukan hanya baris wakilnya. Sebuah jadwal 5 hari diwakili satu baris di
    layar, tapi kelimanya harus ikut ditandai - kalau tidak, empat baris sisanya
    tetap berdiri sendiri dan proyeknya muncul lagi sebagai duplikat begitu
    daftarnya dimuat ulang.
  */
  const kunci = new Set(kandidat.anggota.map(kunciProyek));
  return semua.filter(r => kunci.has(kunciProyek(r))).map(r => r.id);
}
