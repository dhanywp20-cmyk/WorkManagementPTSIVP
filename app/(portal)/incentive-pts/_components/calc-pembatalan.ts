/** calc-pembatalan.ts - dipecah dari calc.ts (scripts/pecah-modul.mjs); calc.ts tetap mengekspor ulang semuanya. */
import { supabase } from '@/lib/supabase';
import { hapusSplitsServer } from './calc-data';

// Pembatalan (rollback)

/*
  DUA PEMBATALAN, DUA TINGKAT - dan keduanya menolak menyentuh yang sudah Paid.

  Ini ada supaya seluruh alur insentif bisa diuji tanpa mempertaruhkan data
  yang sudah jadi. Tanpa jalan kembali, satu kali salah pencet pada Process
  Batch akan meninggalkan baris pembagian yang tidak bisa dicabut, dan
  satu-satunya cara membersihkannya adalah menghapus baris lewat SQL langsung
  di produksi - persis keadaan yang paling mudah membuat celaka.

  YANG SUDAH `paid` TIDAK PERNAH BISA DIBATALKAN dari sini. Status itu berarti
  uangnya sudah keluar; membatalkannya di layar tidak menarik uang itu kembali,
  ia hanya membuat catatan platform tidak lagi cocok dengan yang benar-benar
  terjadi. Bila memang ada kekeliruan pada tahap yang sudah dibayar, itu
  perkara koreksi pembukuan, bukan tombol.
*/

export interface HasilPembatalan {
  /** Jumlah tahapan yang dikembalikan / dihapus. */
  jumlah: number;
  /** Tahapan yang DILEWATI karena sudah berstatus paid. */
  dilewati: number;
  error: { message: string } | null;
}

/**
 * Batalkan hasil Process Batch satu tahun: hapus baris pembagian yang dibuat
 * batch itu, lalu kembalikan tahapannya dari `processed` ke `pending`.
 *
 * Tahapannya sendiri TIDAK dihapus - yang dibatalkan hanya pemrosesannya,
 * sehingga batch tahun itu bisa dijalankan ulang setelah datanya dibetulkan.
 */
export async function batalkanBatchTahun(paymentYear: number): Promise<HasilPembatalan> {
  const { data: semua, error: bacaErr } = await supabase
    .from('incentive_tranches')
    .select('id, status')
    .eq('payment_year', paymentYear);
  if (bacaErr) return { jumlah: 0, dilewati: 0, error: bacaErr };

  const baris = (semua ?? []) as { id: string; status: string }[];
  const bisa = baris.filter(t => t.status === 'processed');
  const dilewati = baris.filter(t => t.status === 'paid').length;

  /*
    PEMBERSIHAN MENCAKUP YANG MASIH `pending`, bukan hanya yang `processed`.

    Versi lama hanya menyasar tahapan berstatus processed. Justru tahapan
    pending-lah yang paling mungkin punya baris pembagian nyasar: ia jadi
    pending PERSIS karena Process Batch gagal di tengah - splits sudah
    tertulis, penandaan processed-nya yang gagal - atau karena pembatalan
    sebelumnya mengembalikan statusnya tanpa pernah benar-benar menghapus
    splits-nya (penghapusan dari klien selalu 0 baris, lihat
    hapusSplitsServer). Membiarkannya berarti Process Batch berikutnya
    menumpuk set kedua di atas yang lama, dan itulah "Bagian Saya" yang
    tampil berlipat.

    Yang `paid` tetap tidak disentuh - uangnya sudah keluar.
  */
  const idBersihkan = baris.filter(t => t.status !== 'paid').map(t => t.id);
  if (idBersihkan.length === 0) return { jumlah: 0, dilewati, error: null };

  //  Pembagian dihapus LEBIH DULU. Kalau urutannya dibalik dan penghapusan
  //  split gagal, tahapannya sudah terlanjur jadi `pending` sementara baris
  //  pembagiannya masih ada - menjalankan batch lagi akan menambah set kedua
  //  di atas yang lama, dan orang dibayar dua kali.
  const { error: hapusErr } = await hapusSplitsServer({ trancheIds: idBersihkan });
  if (hapusErr) return { jumlah: 0, dilewati, error: hapusErr };

  if (bisa.length === 0) return { jumlah: 0, dilewati, error: null };

  const { data: ubahRows, error: ubahErr } = await supabase
    .from('incentive_tranches')
    .update({ status: 'pending', processed_at: null })
    .in('id', bisa.map(t => t.id))
    .select('id');
  if (ubahErr) return { jumlah: 0, dilewati, error: ubahErr };
  //  `.select('id')` + periksa jumlahnya: UPDATE yang ditolak RLS tidak
  //  mengembalikan galat, hanya nol baris. Tanpa pemeriksaan ini layar akan
  //  melapor "dibatalkan" padahal statusnya tidak berubah sama sekali.
  if ((ubahRows ?? []).length === 0) {
    return {
      jumlah: 0, dilewati,
      error: { message: 'Baris pembagian sudah dihapus, tetapi status tahapan TIDAK bisa dikembalikan ke pending (ditolak izin akses). Minta pemegang akses penuh menjalankan ulang pembatalan ini.' },
    };
  }

  return { jumlah: (ubahRows ?? []).length, dilewati, error: null };
}

/**
 * Hapus SELURUH tahapan pencairan satu proyek, berikut pembagiannya.
 *
 * Dipakai bila tahapannya memang ter-generate keliru - mis. nominal pool salah,
 * atau skemanya baru dibetulkan sesudah tahapan dibuat. Sesudah ini, nominal
 * proyek terbuka lagi untuk disunting dan tahapannya bisa dibuat ulang.
 */
export async function hapusTahapanProyek(projectId: string): Promise<HasilPembatalan> {
  const { data: semua, error: bacaErr } = await supabase
    .from('incentive_tranches')
    .select('id, status')
    .eq('project_id', projectId);
  if (bacaErr) return { jumlah: 0, dilewati: 0, error: bacaErr };

  const baris = (semua ?? []) as { id: string; status: string }[];
  const sudahDibayar = baris.filter(t => t.status === 'paid').length;
  if (sudahDibayar > 0) {
    return {
      jumlah: 0, dilewati: sudahDibayar,
      error: { message: `Proyek ini punya ${sudahDibayar} tahapan berstatus Paid — tahapannya tidak boleh dihapus.` },
    };
  }
  if (baris.length === 0) return { jumlah: 0, dilewati: 0, error: null };

  const ids = baris.map(t => t.id);
  //  Split dihapus lewat project_id, bukan hanya tranche_id: baris pembagian
  //  yang tranche_id-nya null (dibuat sebelum tahapan ada) juga ikut, kalau
  //  tidak ia tertinggal sebagai yatim yang tetap terhitung di rekap.
  const { error: hapusSplit } = await hapusSplitsServer({ projectId });
  if (hapusSplit) return { jumlah: 0, dilewati: 0, error: hapusSplit };

  const { data: trHapus, error: hapusTr } = await supabase
    .from('incentive_tranches').delete().in('id', ids).select('id');
  if (hapusTr) return { jumlah: 0, dilewati: 0, error: hapusTr };
  if ((trHapus ?? []).length === 0) {
    return {
      jumlah: 0, dilewati: 0,
      error: { message: 'Baris pembagian sudah dihapus, tetapi tahapannya TIDAK bisa dihapus (ditolak izin akses). Butuh akses konfigurasi penuh Incentive PTS.' },
    };
  }

  return { jumlah: (trHapus ?? []).length, dilewati: 0, error: null };
}
