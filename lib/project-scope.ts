import { supabase } from './supabase';

/**
 * Siapa boleh melihat project milik siapa. Terpusat di sini supaya tiap modul
 * tidak menurunkan aturannya sendiri-sendiri - satu modul yang lupa cukup
 * untuk membuat Sales divisi mana pun menemukan project divisi lain hanya
 * dengan mengetik sepotong namanya.
 *
 * Aturan yang berlaku:
 *   - admin / superadmin / Team PTS   seluruh project (mereka memang menangani
 *                                      semua divisi)
 *   - Sales Internal (IVP/MVI)        divisi yang dipetakan ke dirinya lewat
 *                                      division_ivp_mappings, plus divisinya
 *   - Sales biasa (guest)             HANYA project atas namanya sendiri
 */

export interface PenggunaLingkup {
  id: string;
  full_name: string;
  role?: string | null;
  team_type?: string | null;
  sales_division?: string | null;
  is_internal_sales?: boolean | null;
  access_level?: string | null;
}

export interface LingkupProject {
  /** true = boleh melihat seluruh project tanpa batas divisi. */
  semua: boolean;
  /** Divisi yang boleh dilihat. Kosong berarti tidak ada divisi tambahan. */
  divisi: string[];
  /** Nama sales yang project-nya boleh dilihat (dirinya sendiri). */
  namaSendiri: string;
}

/**
 * Siapa yang boleh mencari SELURUH project tanpa batas divisi.
 *
 * SENGAJA BERBEDA dari hasFullAccess() di lib/constants.ts. Fungsi itu menuntut
 * role 'team' DAN access_level 'full'; fungsi ini menerima seluruh role 'team'
 * apa pun access_level-nya. Perbedaannya bukan kelalaian, dan tidak boleh
 * "dirapikan" menjadi seragam tanpa membaca alasan berikut.
 *
 * access_level mengatur hak KELOLA data - siapa boleh menyunting dan menghapus
 * milik orang lain. Yang diatur di sini pertanyaan lain: project mana yang
 * boleh DITEMUKAN saat membuat ticket. Teknisi PTS menangani proyek lintas
 * divisi - itu memang pekerjaannya, dan proyek yang ia tangani tidak pernah
 * atas namanya sendiri. Membatasinya ke "project atas nama sendiri" berarti
 * ia tidak menemukan satu pun proyek yang ia kerjakan, lalu mengetik namanya
 * manual, lalu nama itu menyimpang - dan porsi Tim Support pada Incentive
 * dicocokkan lewat nama, sehingga porsinya hilang tanpa pesan apa pun.
 *
 * Yang TIDAK termasuk di sini tetap tertutup rapat: Sales biasa hanya melihat
 * project atas namanya sendiri, dan Sales Internal hanya divisi yang dipetakan
 * kepadanya. Merekalah yang tidak boleh saling melihat daftar pelanggan.
 */
function adalahPTS(u: PenggunaLingkup): boolean {
  const r = (u.role ?? '').toLowerCase();
  return ['admin', 'superadmin', 'team', 'team_pts'].includes(r);
}

/**
 * Nilai penanda "tidak ada seorang pun" untuk namaSendiri. Dipakai saat
 * pemanggil tidak punya user sama sekali.
 */
const TANPA_LINGKUP = '__tanpa_lingkup__';

/**
 * Hitung lingkup project untuk user ini.
 *
 * Menyentuh database HANYA untuk Sales Internal, karena hanya merekalah yang
 * lingkupnya ditentukan tabel pemetaan. Untuk yang lain jawabannya sudah bisa
 * disimpulkan dari profilnya sendiri.
 */
export async function hitungLingkupProject(u: PenggunaLingkup | null): Promise<LingkupProject> {
  // Tanpa user: sengaja memakai nama yang tidak mungkin cocok, BUKAN lingkup
  // kosong - lingkup kosong pada pemanggil yang lalai menghasilkan "tanpa
  // filter", yaitu justru membuka semuanya.
  //
  // Penandanya BUKAN karakter NUL. NUL memang tidak mungkin ada di dalam
  // nama - kolom text Postgres tidak bisa memuatnya sama sekali - tetapi
  // justru itu masalahnya: nilai yang tidak bisa disimpan Postgres membuat
  // kuerinya GAGAL, bukan menghasilkan nol baris. Dan kueri yang gagal di
  // sini tampil sebagai "tidak ada hasil", persis kekeliruan yang baru saja
  // diperbaiki di pencarian project. NUL juga membuat berkas ini terbaca
  // sebagai biner oleh grep dan sebagian penyunting.
  //
  // Penggantinya teks biasa yang tidak akan pernah jadi nama orang.
  if (!u) return { semua: false, divisi: [], namaSendiri: TANPA_LINGKUP };

  if (adalahPTS(u)) return { semua: true, divisi: [], namaSendiri: u.full_name };

  const divisi = new Set<string>();
  if (u.is_internal_sales) {
    const { data } = await supabase
      .from('division_ivp_mappings').select('sales_division').eq('ivp_id', u.id);
    for (const m of (data ?? []) as { sales_division: string }[]) {
      if (m.sales_division) divisi.add(m.sales_division);
    }
    // Divisinya sendiri ikut, bahkan bila belum dipetakan - Sales Internal
    // selalu boleh melihat project divisinya sendiri.
    if (u.sales_division) divisi.add(u.sales_division);
  }
  return { semua: false, divisi: Array.from(divisi), namaSendiri: u.full_name };
}

/**
 * Filter PostgREST `.or(...)` untuk lingkup di atas.
 *
 * Mengembalikan null bila user boleh melihat semuanya - pemanggil lalu tidak
 * perlu memasang filter apa pun.
 *
 * @param kolomNamaSales nama kolom yang memuat nama sales pada tabel terkait,
 *                       karena namanya berbeda antar tabel.
 */
export function filterLingkup(
  l: LingkupProject,
  kolomNamaSales = 'sales_name',
  kolomDivisi = 'sales_division',
  opsi: {
    /**
     * Ikutkan baris yang TIDAK punya pemilik sama sekali (nama sales NULL).
     *
     * Bawaannya false - untuk project, baris tanpa nama sales tetap milik
     * seseorang yang namanya belum terisi, jadi menampilkannya ke semua orang
     * salah.
     *
     * Untuk catatan kegiatan Piket Showroom keadaannya berbeda dan harus
     * dinyatakan sendiri: hampir separuh barisnya memang tidak berpemilik -
     * training internal, maintenance, standby - bukan kunjungan pelanggan
     * siapa pun. Membuangnya berarti setiap akun non-PTS kehilangan separuh
     * isi halaman, termasuk Sales yang batasannya memang seharusnya cuma
     * "jangan lihat pelanggan divisi tetangga".
     */
    sertakanTanpaPemilik?: boolean;
  } = {},
): string | null {
  if (l.semua) return null;
  // Nilai dikutip ganda karena nama & divisi bisa memuat koma - tanpa kutip,
  // PostgREST membacanya sebagai pemisah kondisi dan batasannya jadi melar,
  // yaitu justru membuka data yang seharusnya tertutup. Tanda kutip di dalam
  // nilai dibuang, bukan di-escape, supaya tidak ada celah penyisipan sintaks.
  const aman = (v: string) => v.replace(/"/g, '');
  const bagian = [`${kolomNamaSales}.eq."${aman(l.namaSendiri)}"`];
  for (const d of l.divisi) bagian.push(`${kolomDivisi}.eq."${aman(d)}"`);
  if (opsi.sertakanTanpaPemilik) bagian.push(`${kolomNamaSales}.is.null`);
  return bagian.join(',');
}
